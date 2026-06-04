import {
  ClothingItem,
  ColorRule,
  FeedbackType,
  Outfit,
  OutfitRecord,
  Thickness,
} from '@/types';

// ── 気温 → 素材の厚さマッピング ────────────────────────────────────────────────

function topThickness(maxTemp: number): Thickness[] {
  if (maxTemp >= 28) return ['thin'];
  if (maxTemp >= 22) return ['thin', 'medium'];
  if (maxTemp >= 16) return ['medium'];
  if (maxTemp >= 10) return ['medium', 'thick'];
  return ['thick'];
}

function outerThickness(minTemp: number): Thickness[] {
  if (minTemp < 5) return ['thick'];
  if (minTemp < 10) return ['medium', 'thick'];
  if (minTemp < 15) return ['medium'];
  return ['thin', 'medium'];
}

// ── 色マッチング ────────────────────────────────────────────────────────────────
// 部分一致（例: "ネイビーブルー" ↔ "ネイビー" はマッチ）

function matchColor(itemColor: string, ruleColor: string): boolean {
  const a = itemColor.trim().toLowerCase();
  const b = ruleColor.trim().toLowerCase();
  return a.includes(b) || b.includes(a);
}

function getOutfitItems(outfit: Outfit): ClothingItem[] {
  return [outfit.dress, outfit.top, outfit.bottom, outfit.outer, outfit.shoes, outfit.accessory].filter(
    (x): x is ClothingItem => x !== undefined
  );
}

// ── ランダム揺らぎ ─────────────────────────────────────────────────────────────
// 毎回同じ提案にならないよう、スコアに小さなランダム揺らぎを加える。
// フィードバック重み（±10〜20）と同程度の範囲にとどめることで、
// 好みの傾向は活かしつつ、生成するたびに違うコーデが出るようにする。
const ITEM_JITTER   = 20; // アイテムプール選択時の揺らぎ（± この値）
const OUTFIT_JITTER = 30; // コーデ最終スコアの揺らぎ（± この値）

function jitter(range: number): number {
  return (Math.random() - 0.5) * range * 2;
}

// ── アイテムスコア（フィードバック履歴） ─────────────────────────────────────────

const FEEDBACK_WEIGHTS: Partial<Record<FeedbackType, number>> = {
  like: 15,
  complimented: 20,
  mood_up: 15,
  cold: -10,
  hot: -10,
  uncomfortable: -15,
};

function buildItemScores(pastRecords: OutfitRecord[]): Map<string, number> {
  // ① フィードバックスコア（直近20件のみ・±40 でキャップ）
  //    全履歴を使うとスコアが際限なく積み上がり、提案が固定化する
  const FEEDBACK_WINDOW = 20;
  const SCORE_CAP = 40;
  const feedbackScores = new Map<string, number>();
  for (const record of pastRecords.slice(0, FEEDBACK_WINDOW)) {
    for (const fb of record.feedbacks) {
      const outfit = record.outfits[fb.outfitIndex];
      if (!outfit) continue;
      const weight = FEEDBACK_WEIGHTS[fb.type] ?? 0;
      for (const item of getOutfitItems(outfit)) {
        const cur = feedbackScores.get(item.id) ?? 0;
        feedbackScores.set(
          item.id,
          Math.max(-SCORE_CAP, Math.min(SCORE_CAP, cur + weight))
        );
      }
    }
  }

  // ② 直近提案への減衰ペナルティ（バリエーション確保）
  //    直近に出たアイテムほど次の提案で選ばれにくくする
  const RECENT_PENALTIES = [-20, -12, -6]; // 最新, 1件前, 2件前
  const recentPenalties = new Map<string, number>();
  for (let ri = 0; ri < Math.min(RECENT_PENALTIES.length, pastRecords.length); ri++) {
    for (const outfit of pastRecords[ri].outfits) {
      for (const item of getOutfitItems(outfit)) {
        // 複数コーデで登場しても最も重いペナルティのみ適用
        const cur = recentPenalties.get(item.id) ?? 0;
        recentPenalties.set(item.id, Math.min(cur, RECENT_PENALTIES[ri]));
      }
    }
  }

  // ③ 合算して返す
  const map = new Map<string, number>();
  for (const id of new Set([...feedbackScores.keys(), ...recentPenalties.keys()])) {
    map.set(id, (feedbackScores.get(id) ?? 0) + (recentPenalties.get(id) ?? 0));
  }
  return map;
}

/** 用途タグによるスコアボーナス
 *  シーン選択をフィードバック履歴より優先させるため、
 *  ボーナス/ペナルティをフィードバック重みより大きく設定する。
 *    一致タグ: +40/件 → 「褒められた」×2 (+40) と同等
 *    専用外タグ: -20  → 別シーン向け服を明確に後回し
 *    タグなし:    0   → 汎用品として中立（タグ付き服がなければ普通に選ばれる）
 */
function purposeBonus(item: ClothingItem, purposes: string[]): number {
  if (purposes.length === 0) return 0;
  const matches = item.purposeTags.filter((t) => purposes.includes(t)).length;
  if (matches > 0) return matches * 40;
  if (item.purposeTags.length > 0) return -20; // 別の用途に専用タグがある
  return 0; // タグなし = 汎用品として中立
}

// ── コーデスコア ───────────────────────────────────────────────────────────────

const HARD_THRESHOLD = -500; // これ以下は「避けたい」として除外

function scoreOutfit(
  outfit: Outfit,
  purposes: string[],
  colorRules: ColorRule[],
  itemScores: Map<string, number>
): number {
  const items = getOutfitItems(outfit);
  let score = 0;

  // アイテムごとのフィードバックスコア + 用途ボーナス
  for (const item of items) {
    score += itemScores.get(item.id) ?? 0;
    score += purposeBonus(item, purposes);
  }

  // 色ルール
  const colors = items.map((i) => i.color);
  for (const rule of colorRules) {
    if (rule.type === 'avoid_pair') {
      const hasC1 = colors.some((c) => matchColor(c, rule.colors[0]));
      const hasC2 = colors.some((c) => matchColor(c, rule.colors[1]));
      if (hasC1 && hasC2) score -= 1000;
    } else if (rule.type === 'like_pair') {
      const hasC1 = colors.some((c) => matchColor(c, rule.colors[0]));
      const hasC2 = colors.some((c) => matchColor(c, rule.colors[1]));
      if (hasC1 && hasC2) score += 25;
    } else if (rule.type === 'avoid_overall') {
      // 全アイテムが「避けたい色セット」に収まる場合
      const allBad = items.every((item) =>
        rule.colors.some((rc) => matchColor(item.color, rc))
      );
      if (allBad) score -= 800;
    }
  }

  return score;
}

// ── 多様性を保ちながら上位3件を選択 ──────────────────────────────────────────────

/** 選択済みコーデと共有しているアイテム数を返す */
function countOverlap(outfit: Outfit, selected: Outfit[]): number {
  if (selected.length === 0) return 0;
  const ids = new Set(getOutfitItems(outfit).map((i) => i.id));
  let count = 0;
  for (const sel of selected) {
    for (const item of getOutfitItems(sel)) {
      if (ids.has(item.id)) count++;
    }
  }
  return count;
}

/**
 * グリーディ選択:
 *   1件ずつ「既選択との重複アイテム数が最小 → スコアが最大」の順で選ぶ。
 *   重複が避けられない場合は自然にフォールバックするため、
 *   服の登録数が少なくても動作する。
 */
function selectDiverse(
  scored: { outfit: Outfit; score: number }[],
  n: number
): Outfit[] {
  const result: Outfit[] = [];
  const remaining = [...scored];

  while (result.length < n && remaining.length > 0) {
    let bestIdx = 0;
    let bestOverlap = countOverlap(remaining[0].outfit, result);
    let bestScore = remaining[0].score;

    for (let i = 1; i < remaining.length; i++) {
      const overlap = countOverlap(remaining[i].outfit, result);
      const score = remaining[i].score;
      if (overlap < bestOverlap || (overlap === bestOverlap && score > bestScore)) {
        bestIdx = i;
        bestOverlap = overlap;
        bestScore = score;
      }
    }

    result.push(remaining[bestIdx].outfit);
    remaining.splice(bestIdx, 1);
  }

  return result;
}

// ── 候補生成ヘルパー ───────────────────────────────────────────────────────────

function buildCandidates(
  clothes: ClothingItem[],
  tThick: Thickness[] | null, // null = 厚さ制限なし
  needOuter: boolean,
  oThick: Thickness[],
  purposes: string[],
  itemScores: Map<string, number>,
  minTemp: number,
): {
  candidates: Outfit[];
  topsAll: number;
  topsInTemp: number;
  dressesAll: number;
  dressesInTemp: number;
  bottoms: number;
  shoes: number;
  outersAvailable: number;
} {
  function sortedPool(items: ClothingItem[]): ClothingItem[] {
    return [...items]
      .map((item) => ({
        item,
        score: (itemScores.get(item.id) ?? 0) + purposeBonus(item, purposes) + jitter(ITEM_JITTER),
      }))
      .sort((a, b) => b.score - a.score)
      .map(({ item }) => item);
  }

  const allTops    = clothes.filter((c) => c.category === 'top');
  const allDresses = clothes.filter((c) => c.category === 'dress');

  const topsInTemp    = tThick ? allTops.filter((c) => tThick.includes(c.thickness)) : allTops;
  const dressesInTemp = tThick ? allDresses.filter((c) => tThick.includes(c.thickness)) : allDresses;

  const tops    = sortedPool(topsInTemp);
  const bottoms = sortedPool(clothes.filter((c) => c.category === 'bottom'));
  const dresses = sortedPool(dressesInTemp);

  const outerRaw = needOuter
    ? clothes.filter(
        (c) => (c.category === 'outer' || c.category === 'jacket') && oThick.includes(c.thickness)
      )
    : [];
  const outers = [...outerRaw].sort((a, b) => {
    const jacketBonus = (item: ClothingItem) =>
      minTemp >= 10 && item.category === 'jacket' ? 30 : 0;
    const sa = (itemScores.get(a.id) ?? 0) + purposeBonus(a, purposes) + jacketBonus(a);
    const sb = (itemScores.get(b.id) ?? 0) + purposeBonus(b, purposes) + jacketBonus(b);
    return sb - sa;
  });
  const shoes       = sortedPool(clothes.filter((c) => c.category === 'shoes'));
  const accessories = sortedPool(clothes.filter((c) => c.category === 'accessory'));

  const hasTopBottom = tops.length > 0 && bottoms.length > 0;
  const hasDress     = dresses.length > 0;

  const candidates: Outfit[] = [];

  if (hasTopBottom || hasDress) {
    const outerPool:     (ClothingItem | undefined)[] = outers.length     ? outers.slice(0, 4)     : [undefined];
    const shoesPool:     (ClothingItem | undefined)[] = shoes.length      ? shoes.slice(0, 4)      : [undefined];
    // アクセサリーは任意なので undefined（なし）を常に含める
    const accessoryPool: (ClothingItem | undefined)[] = accessories.length
      ? [...accessories.slice(0, 3), undefined]
      : [undefined];

    if (hasTopBottom) {
      for (const top of tops.slice(0, 6)) {
        for (const bottom of bottoms.slice(0, 6)) {
          for (const outer of outerPool) {
            for (const shoe of shoesPool) {
              for (const accessory of accessoryPool) {
                candidates.push({ top, bottom, outer, shoes: shoe, accessory });
              }
            }
          }
        }
      }
    }
    if (hasDress) {
      for (const dress of dresses.slice(0, 5)) {
        for (const outer of outerPool) {
          for (const shoe of shoesPool) {
            for (const accessory of accessoryPool) {
              candidates.push({ dress, outer, shoes: shoe, accessory });
            }
          }
        }
      }
    }
  }

  return {
    candidates,
    topsAll:         allTops.length,
    topsInTemp:      topsInTemp.length,
    dressesAll:      allDresses.length,
    dressesInTemp:   dressesInTemp.length,
    bottoms:         bottoms.length,
    shoes:           shoes.length,
    outersAvailable: outerRaw.length,
  };
}

// ── メインエクスポート ─────────────────────────────────────────────────────────

export interface Diagnostics {
  totalClothes: number;
  topsAll: number;
  topsInTemp: number;
  dressesAll: number;
  dressesInTemp: number;
  bottoms: number;
  shoes: number;
  outersNeeded: boolean;
  outersAvailable: number;
  candidates: number;
  validCandidates: number;
}

export interface SuggestResult {
  outfits: Outfit[];
  relaxed: boolean;
  /** 0=通常, 1=厚さ条件を緩和, 2=アウター任意化 */
  fallbackLevel: 0 | 1 | 2;
  diagnostics: Diagnostics;
}

export function suggestOutfits(params: {
  clothes: ClothingItem[];
  maxTemp: number;
  minTemp: number;
  purposes: string[];
  colorRules: ColorRule[];
  pastRecords: OutfitRecord[];
}): SuggestResult {
  const { clothes, maxTemp, minTemp, purposes, colorRules, pastRecords } = params;

  const tThick   = topThickness(maxTemp);
  const needOuter = minTemp < 18;
  const oThick   = outerThickness(minTemp);
  const itemScores = buildItemScores(pastRecords);

  function tryGenerate(
    thicknessFilter: Thickness[] | null,
    forceNoOuter: boolean,
  ): { outfits: Outfit[]; relaxed: boolean; diagnostics: Diagnostics } {
    const useOuter = !forceNoOuter && needOuter;
    const info = buildCandidates(clothes, thicknessFilter, useOuter, oThick, purposes, itemScores, minTemp);

    const diagnostics: Diagnostics = {
      totalClothes:    clothes.length,
      topsAll:         info.topsAll,
      topsInTemp:      info.topsInTemp,
      dressesAll:      info.dressesAll,
      dressesInTemp:   info.dressesInTemp,
      bottoms:         info.bottoms,
      shoes:           info.shoes,
      outersNeeded:    needOuter,
      outersAvailable: info.outersAvailable,
      candidates:      info.candidates.length,
      validCandidates: 0,
    };

    if (info.candidates.length === 0) {
      return { outfits: [], relaxed: false, diagnostics };
    }

    const scored = info.candidates
      .map((outfit) => ({
        outfit,
        score: scoreOutfit(outfit, purposes, colorRules, itemScores) + jitter(OUTFIT_JITTER),
      }))
      .sort((a, b) => b.score - a.score);

    const valid = scored.filter((s) => s.score > HARD_THRESHOLD);
    diagnostics.validCandidates = valid.length;

    if (valid.length > 0) {
      return { outfits: selectDiverse(valid, 3), relaxed: false, diagnostics };
    } else {
      return { outfits: selectDiverse(scored, 3), relaxed: true, diagnostics };
    }
  }

  // Level 0: 通常（気温に合った厚さ + アウター）
  const l0 = tryGenerate(tThick, false);
  if (l0.outfits.length > 0) {
    return { ...l0, fallbackLevel: 0 };
  }

  // Level 1: 厚さ制限を緩和（全トップス・ワンピースを候補に）
  const l1 = tryGenerate(null, false);
  if (l1.outfits.length > 0) {
    return { ...l1, fallbackLevel: 1 };
  }

  // Level 2: 厚さ制限を緩和 + アウター任意化
  const l2 = tryGenerate(null, true);
  if (l2.outfits.length > 0) {
    return { ...l2, fallbackLevel: 2 };
  }

  // すべて失敗 — diagnostics だけ返す
  return { outfits: [], relaxed: false, fallbackLevel: 0, diagnostics: l0.diagnostics };
}

// ── UI ヘルパー ────────────────────────────────────────────────────────────────

export function tempMessage(maxTemp: number, minTemp: number): string {
  const diff = maxTemp - minTemp;
  let msg = '';
  if (maxTemp >= 30) msg = `真夏日 (最高${maxTemp}°C) — 薄着が◎`;
  else if (maxTemp >= 25) msg = `夏日 (最高${maxTemp}°C) — 涼しめに`;
  else if (maxTemp >= 20) msg = `過ごしやすい (最高${maxTemp}°C)`;
  else if (maxTemp >= 15) msg = `やや涼しい (最高${maxTemp}°C) — 羽織があると安心`;
  else if (maxTemp >= 10) msg = `肌寒い (最高${maxTemp}°C) — アウター必要`;
  else msg = `寒い日 (最高${maxTemp}°C) — しっかり防寒を`;
  if (diff >= 10) msg += ' ／ 寒暖差大';
  return msg;
}

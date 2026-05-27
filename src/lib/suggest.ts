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
  return [outfit.dress, outfit.top, outfit.bottom, outfit.outer, outfit.shoes].filter(
    (x): x is ClothingItem => x !== undefined
  );
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

// ── メインエクスポート ─────────────────────────────────────────────────────────

export interface SuggestResult {
  outfits: Outfit[];
  relaxed: boolean;
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

  const tThick = topThickness(maxTemp);
  const needOuter = minTemp < 18;
  const oThick = outerThickness(minTemp);
  const itemScores = buildItemScores(pastRecords);

  // スコア順にソートされたプールを返すヘルパー
  function sortedPool(items: ClothingItem[]): ClothingItem[] {
    return [...items].sort((a, b) => {
      const sa = (itemScores.get(a.id) ?? 0) + purposeBonus(a, purposes);
      const sb = (itemScores.get(b.id) ?? 0) + purposeBonus(b, purposes);
      return sb - sa;
    });
  }

  const tops = sortedPool(clothes.filter((c) => c.category === 'top' && tThick.includes(c.thickness)));
  const bottoms = sortedPool(clothes.filter((c) => c.category === 'bottom'));
  const dresses = sortedPool(clothes.filter((c) => c.category === 'dress' && tThick.includes(c.thickness)));
  // 春〜秋 (minTemp >= 10°C) はジャケットを優先、冬はアウターを優先してソート
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
  const shoes = sortedPool(clothes.filter((c) => c.category === 'shoes'));

  const hasTopBottom = tops.length > 0 && bottoms.length > 0;
  const hasDress = dresses.length > 0;
  if (!hasTopBottom && !hasDress) return { outfits: [], relaxed: false };

  // 候補生成（各カテゴリ上位N件の直積）
  const outerPool: (ClothingItem | undefined)[] = outers.length ? outers.slice(0, 4) : [undefined];
  const shoesPool: (ClothingItem | undefined)[] = shoes.length ? shoes.slice(0, 4) : [undefined];
  const candidates: Outfit[] = [];

  if (hasTopBottom) {
    for (const top of tops.slice(0, 6)) {
      for (const bottom of bottoms.slice(0, 6)) {
        for (const outer of outerPool) {
          for (const shoe of shoesPool) {
            candidates.push({ top, bottom, outer, shoes: shoe });
          }
        }
      }
    }
  }
  if (hasDress) {
    for (const dress of dresses.slice(0, 5)) {
      for (const outer of outerPool) {
        for (const shoe of shoesPool) {
          candidates.push({ dress, outer, shoes: shoe });
        }
      }
    }
  }

  // スコアリング & ソート
  const scored = candidates
    .map((outfit) => ({ outfit, score: scoreOutfit(outfit, purposes, colorRules, itemScores) }))
    .sort((a, b) => b.score - a.score);

  const valid = scored.filter((s) => s.score > HARD_THRESHOLD);

  // 有効な候補が1件以上あればそれだけを表示、ゼロなら条件を緩めて全候補から選ぶ
  if (valid.length > 0) {
    return { outfits: selectDiverse(valid, 3), relaxed: false };
  } else {
    return { outfits: selectDiverse(scored, 3), relaxed: true };
  }
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

/**
 * ブラウザ内 localStorage を使ったデータ永続化層。
 * サーバー不要で Vercel などの静的ホスティングでも動作する。
 * db.ts (fs ベース) の代替。
 */
import {
  ClothingItem,
  ColorRule,
  FeedbackType,
  Outfit,
  OutfitRecord,
  PURPOSE_TAG_MIGRATION,
} from '@/types';

const KEY = {
  clothes:     'wardrobe:clothes',
  suggestions: 'wardrobe:suggestions',
  colorRules:  'wardrobe:colorRules',
} as const;

function load<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    // QuotaExceededError: Safari の容量上限（約5MB）に達した場合
    const name = e instanceof Error ? e.name : '';
    if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      throw new Error('保存容量が上限に達しました。⚙️ データ管理から不要なデータを削除するか、写真のない服を登録してください。');
    }
    throw e;
  }
}

// ── 提案履歴の写真除去（localStorage 5MB 上限対策） ─────────────────────────────
// OutfitRecord に ClothingItem の photoUrl（base64）が含まれると
// 1 件あたり数百 KB になり、iPhone Safari の 5MB 上限をすぐに超える。
// 写真は wardrobe:clothes に保存済みのため、履歴側には不要。
function stripPhoto(item: ClothingItem | undefined): ClothingItem | undefined {
  if (!item) return undefined;
  const { photoUrl: _p, ...rest } = item;   // photoUrl を除いた残りだけ返す
  return rest as ClothingItem;
}
function stripOutfitPhotos(outfit: Outfit): Outfit {
  return {
    top:       stripPhoto(outfit.top),
    bottom:    stripPhoto(outfit.bottom),
    dress:     stripPhoto(outfit.dress),
    outer:     stripPhoto(outfit.outer),
    shoes:     stripPhoto(outfit.shoes),
    accessory: stripPhoto(outfit.accessory),
  };
}
function stripRecordPhotos(r: OutfitRecord): OutfitRecord {
  return {
    ...r,
    outfits:   (r.outfits   ?? []).map(stripOutfitPhotos),
    feedbacks: r.feedbacks  ?? [],
    purposes:  r.purposes   ?? [],
    relaxed:   r.relaxed    ?? false,
  };
}

export const storage = {
  clothes: {
    getAll(): ClothingItem[] {
      return load<ClothingItem[]>(KEY.clothes, []).map((item) => ({
        ...item,
        purposeTags: (item.purposeTags ?? []).map(
          (t) => PURPOSE_TAG_MIGRATION[t] ?? t
        ),
      }));
    },
    getById(id: string): ClothingItem | undefined {
      return this.getAll().find((c) => c.id === id);
    },
    create(item: ClothingItem): ClothingItem {
      const list = this.getAll();
      // 写真は IndexedDB に保存するため localStorage には含めない
      const { photoUrl: _p, ...itemWithoutPhoto } = item;
      list.push(itemWithoutPhoto as ClothingItem);
      save(KEY.clothes, list);
      return item;
    },
    update(id: string, updates: Partial<ClothingItem>): ClothingItem | null {
      const list = this.getAll();
      const idx = list.findIndex((c) => c.id === id);
      if (idx === -1) return null;
      const { photoUrl: _p, ...updatesWithoutPhoto } = updates;
      list[idx] = { ...list[idx], ...updatesWithoutPhoto, updatedAt: new Date().toISOString() };
      save(KEY.clothes, list);
      return list[idx];
    },
    delete(id: string): boolean {
      const list = this.getAll();
      const next = list.filter((c) => c.id !== id);
      if (next.length === list.length) return false;
      save(KEY.clothes, next);
      return true;
    },
  },

  suggestions: {
    getAll(): OutfitRecord[] {
      const raw      = load<OutfitRecord[]>(KEY.suggestions, []);
      const stripped = raw.map(stripRecordPhotos);
      // 写真つきレコードが残っていたら即座に書き戻してストレージを解放する
      // （縮小後のデータは必ず元より小さいため setItem は成功する）
      if (typeof window !== 'undefined') {
        const hasPhotos = raw.some((r) =>
          (r.outfits ?? []).some((o) =>
            [o.top, o.bottom, o.dress, o.outer, o.shoes, o.accessory].some(
              (i) => i?.photoUrl
            )
          )
        );
        if (hasPhotos) {
          try { localStorage.setItem(KEY.suggestions, JSON.stringify(stripped)); } catch { /* 無視 */ }
        }
      }
      return stripped;
    },
    create(record: OutfitRecord): OutfitRecord {
      // 既存レコードも含めて写真を除去してから保存（一括縮小）
      const list = this.getAll();          // getAll() 内で写真除去済み
      list.unshift(stripRecordPhotos(record));
      save(KEY.suggestions, list.slice(0, 100));
      return record;                       // 呼び出し元には写真あり元データを返す（表示用）
    },
    /** adoptedIndex / eveningFeedbackDone など写真以外のフィールドを部分更新する */
    patchRecord(id: string, patch: Partial<OutfitRecord>): OutfitRecord | null {
      const list = this.getAll();
      const idx = list.findIndex((r) => r.id === id);
      if (idx === -1) return null;
      list[idx] = { ...list[idx], ...patch };
      save(KEY.suggestions, list);
      return list[idx];
    },
    /** バックアップからのインポート用: 既存にないIDのレコードだけ日付降順にマージして追加する */
    restoreMany(records: OutfitRecord[]): number {
      const existing    = this.getAll();
      const existingIds = new Set(existing.map((r) => r.id));
      const toAdd = records
        .filter((r) => r.id && !existingIds.has(r.id))
        .map(stripRecordPhotos);
      if (toAdd.length === 0) return 0;

      const merged = [...existing, ...toAdd].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      save(KEY.suggestions, merged);
      return toAdd.length;
    },
    toggleFeedback(
      id: string,
      outfitIndex: number,
      type: FeedbackType
    ): OutfitRecord | null {
      const list = this.getAll();          // 写真なしで読み込み済み
      const idx = list.findIndex((r) => r.id === id);
      if (idx === -1) return null;

      const existingIdx = list[idx].feedbacks.findIndex(
        (f) => f.outfitIndex === outfitIndex && f.type === type
      );
      if (existingIdx >= 0) {
        list[idx].feedbacks.splice(existingIdx, 1);
      } else {
        list[idx].feedbacks.push({
          outfitIndex,
          type,
          recordedAt: new Date().toISOString(),
        });
      }

      save(KEY.suggestions, list);
      return list[idx];
    },
  },

  colorRules: {
    getAll(): ColorRule[] {
      return load<ColorRule[]>(KEY.colorRules, []);
    },
    create(rule: ColorRule): ColorRule {
      const list = this.getAll();
      list.push(rule);
      save(KEY.colorRules, list);
      return rule;
    },
    delete(id: string): boolean {
      const list = this.getAll();
      const next = list.filter((r) => r.id !== id);
      if (next.length === list.length) return false;
      save(KEY.colorRules, next);
      return true;
    },
  },
};

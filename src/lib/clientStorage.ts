/**
 * ブラウザ内 localStorage を使ったデータ永続化層。
 * サーバー不要で Vercel などの静的ホスティングでも動作する。
 * db.ts (fs ベース) の代替。
 */
import {
  ClothingItem,
  ColorRule,
  FeedbackType,
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
      list.push(item);
      save(KEY.clothes, list);
      return item;
    },
    update(id: string, updates: Partial<ClothingItem>): ClothingItem | null {
      const list = this.getAll();
      const idx = list.findIndex((c) => c.id === id);
      if (idx === -1) return null;
      list[idx] = { ...list[idx], ...updates, updatedAt: new Date().toISOString() };
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
      return load<OutfitRecord[]>(KEY.suggestions, []).map((r) => ({
        ...r,
        purposes: r.purposes ?? [],
        relaxed:  r.relaxed  ?? false,
      }));
    },
    create(record: OutfitRecord): OutfitRecord {
      const list = this.getAll();
      list.unshift(record);
      save(KEY.suggestions, list.slice(0, 100));
      return record;
    },
    toggleFeedback(
      id: string,
      outfitIndex: number,
      type: FeedbackType
    ): OutfitRecord | null {
      const list = this.getAll();
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

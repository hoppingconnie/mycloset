export type Category = 'top' | 'bottom' | 'dress' | 'jacket' | 'outer' | 'shoes' | 'accessory';
export type Thickness = 'thin' | 'medium' | 'thick';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type Formality = 'casual' | 'smart-casual' | 'formal';
export type FeedbackType =
  | 'like' | 'complimented' | 'mood_up'
  | 'cold' | 'hot' | 'uncomfortable';
export type ColorRuleType = 'avoid_pair' | 'like_pair' | 'avoid_overall';

export interface ClothingItem {
  id: string;
  category: Category;
  name: string;
  color: string;
  thickness: Thickness;
  seasons: Season[];
  formality: Formality;
  purposeTags: string[];   // 用途タグ（複数）
  photoUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ColorRule {
  id: string;
  type: ColorRuleType;
  colors: string[];
  note?: string;
  createdAt: string;
}

export interface Outfit {
  dress?: ClothingItem;
  top?: ClothingItem;
  bottom?: ClothingItem;
  outer?: ClothingItem;
  shoes?: ClothingItem;
  accessory?: ClothingItem;
}

export interface FeedbackEntry {
  outfitIndex: number;
  type: FeedbackType;
  recordedAt: string;
}

export interface OutfitRecord {
  id: string;
  date: string;
  maxTemp: number;
  minTemp: number;
  purposes: string[];
  outfits: Outfit[];
  feedbacks: FeedbackEntry[];
  relaxed?: boolean;
  createdAt: string;
}

// ── Display labels ────────────────────────────────────────────────────────────

export const CATEGORY_LABELS: Record<Category, string> = {
  top: 'トップス',
  bottom: 'ボトムス',
  dress: 'ワンピース',
  jacket: 'ジャケット',
  outer: 'アウター',
  shoes: '靴',
  accessory: 'アクセサリー',
};

export const THICKNESS_LABELS: Record<Thickness, string> = {
  thin: '薄手',
  medium: '中厚',
  thick: '厚手',
};

export const SEASON_LABELS: Record<Season, string> = {
  spring: '春',
  summer: '夏',
  autumn: '秋',
  winter: '冬',
};

export const FORMALITY_LABELS: Record<Formality, string> = {
  casual: 'カジュアル',
  'smart-casual': 'スマートカジュアル',
  formal: 'フォーマル',
};

export const CATEGORY_EMOJI: Record<Category, string> = {
  top: '👕',
  bottom: '👖',
  dress: '👗',
  jacket: '🥼',
  outer: '🧥',
  shoes: '👟',
  accessory: '💍',
};

export const COLOR_RULE_LABELS: Record<ColorRuleType, string> = {
  avoid_pair: '避けたい組み合わせ',
  like_pair: '好きな組み合わせ',
  avoid_overall: '避けたい全体印象',
};

export const FEEDBACK_CONFIG: Record<
  FeedbackType,
  { label: string; activeClass: string }
> = {
  like:         { label: '♡ 好き',        activeClass: 'bg-rose-100 text-rose-600 border-rose-300' },
  complimented: { label: '🌟 褒められた',  activeClass: 'bg-yellow-100 text-yellow-600 border-yellow-300' },
  mood_up:      { label: '😊 気分が上がった', activeClass: 'bg-green-100 text-green-600 border-green-300' },
  cold:         { label: '🥶 寒かった',    activeClass: 'bg-blue-100 text-blue-600 border-blue-300' },
  hot:          { label: '🥵 暑かった',    activeClass: 'bg-orange-100 text-orange-600 border-orange-300' },
  uncomfortable:{ label: '😣 動きにくかった', activeClass: 'bg-purple-100 text-purple-600 border-purple-300' },
};

export const DEFAULT_PURPOSES: string[] = [
  '会社', '女友達と外出', '旅行', '雨の日', '疲れている日', '学校行事・PTA',
];

/** 旧タグ名 → 新タグ名 のマイグレーションマップ */
export const PURPOSE_TAG_MIGRATION: Record<string, string> = {
  'PTA': '学校行事・PTA',
  '学校行事': '学校行事・PTA',
};

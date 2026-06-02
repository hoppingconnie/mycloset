'use client';
import {
  Shirt, AlignJustify, Layers, Wind, Footprints, Gem,
  Heart, Star, Smile, Thermometer, Frown, LucideIcon,
} from 'lucide-react';
import {
  ClothingItem, Category, FeedbackType, Outfit,
  CATEGORY_LABELS, THICKNESS_LABELS, FEEDBACK_CONFIG,
} from '@/types';

// カテゴリ → Lucide アイコン
const CATEGORY_ICON: Record<Category, LucideIcon> = {
  top:       Shirt,
  bottom:    AlignJustify,
  dress:     Shirt,
  jacket:    Layers,
  outer:     Wind,
  shoes:     Footprints,
  accessory: Gem,
};

// フィードバック → Lucide アイコン
const FEEDBACK_ICON: Record<FeedbackType, LucideIcon> = {
  like:          Heart,
  complimented:  Star,
  mood_up:       Smile,
  cold:          Thermometer,
  hot:           Thermometer,
  uncomfortable: Frown,
};

interface Props {
  outfit: Outfit;
  index: number;
  feedbacks: FeedbackType[];
  onFeedback: (type: FeedbackType) => void;
}

function ItemSlot({ item, category }: { item?: ClothingItem; category: Category }) {
  const Icon = CATEGORY_ICON[category];
  return (
    <div className="bg-ivory-dark rounded-xl p-2.5 flex flex-col items-center justify-center text-center min-h-[5rem] gap-1.5">
      {item ? (
        <>
          {item.photoUrl ? (
            <img src={item.photoUrl} alt={item.name} className="w-12 h-12 object-cover rounded-lg" />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-navy-soft flex items-center justify-center">
              <Icon size={18} className="text-navy" strokeWidth={1.5} />
            </div>
          )}
          <p className="text-[11px] font-medium text-ink leading-tight">{item.name}</p>
          <p className="text-[10px] text-muted">{item.color} · {THICKNESS_LABELS[item.thickness]}</p>
        </>
      ) : (
        <>
          <div className="w-9 h-9 rounded-lg bg-ivory flex items-center justify-center">
            <Icon size={18} className="text-muted" strokeWidth={1} />
          </div>
          <p className="text-[10px] text-muted">{CATEGORY_LABELS[category]}なし</p>
        </>
      )}
    </div>
  );
}

const FEEDBACK_ROWS: FeedbackType[][] = [
  ['like', 'complimented', 'mood_up'],
  ['cold', 'hot', 'uncomfortable'],
];

export default function OutfitCard({ outfit, index, feedbacks, onFeedback }: Props) {
  return (
    <div className="bg-cream rounded-2xl p-4 border border-border-w shadow-[0_2px_12px_rgba(36,51,82,0.07)]">
      {/* ヘッダー */}
      <p className="text-[9px] font-medium text-muted mb-3 uppercase tracking-[0.16em]">
        Coordinate {String(index + 1).padStart(2, '0')}
      </p>

      {/* アイテムグリッド */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {outfit.dress ? (
          <div className="col-span-2">
            <ItemSlot item={outfit.dress} category="dress" />
          </div>
        ) : (
          <>
            <ItemSlot item={outfit.top}    category="top" />
            <ItemSlot item={outfit.bottom} category="bottom" />
          </>
        )}
        <ItemSlot item={outfit.outer} category="outer" />
        <ItemSlot item={outfit.shoes} category="shoes" />
        {outfit.accessory && (
          <div className="col-span-2">
            <ItemSlot item={outfit.accessory} category="accessory" />
          </div>
        )}
      </div>

      {/* フィードバック */}
      <div className="space-y-1 pt-1 border-t border-border-w">
        {FEEDBACK_ROWS.map((row, ri) => (
          <div key={ri} className="grid grid-cols-3 gap-1 mt-1">
            {row.map((type) => {
              const { label, activeClass } = FEEDBACK_CONFIG[type];
              const active = feedbacks.includes(type);
              const FbIcon = FEEDBACK_ICON[type];
              return (
                <button
                  key={type}
                  onClick={() => onFeedback(type)}
                  className={[
                    'text-[10px] py-1.5 rounded-lg border transition-colors leading-tight',
                    'flex items-center justify-center gap-1',
                    active ? activeClass : 'border-border-w text-secondary hover:bg-ivory-dark',
                  ].join(' ')}
                >
                  <FbIcon size={10} strokeWidth={1.5} />
                  {label}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

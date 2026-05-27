'use client';
import {
  ClothingItem, Category, FeedbackType, Outfit,
  CATEGORY_EMOJI, CATEGORY_LABELS, THICKNESS_LABELS, FEEDBACK_CONFIG,
} from '@/types';

interface Props {
  outfit: Outfit;
  index: number;
  feedbacks: FeedbackType[];
  onFeedback: (type: FeedbackType) => void;
}

function ItemSlot({ item, category }: { item?: ClothingItem; category: Category }) {
  return (
    <div className="border border-slate-100 rounded-xl p-2 flex flex-col items-center justify-center text-center min-h-20 gap-1">
      {item ? (
        <>
          {item.photoUrl ? (
            <img src={item.photoUrl} alt={item.name} className="w-12 h-12 object-cover rounded-lg" />
          ) : (
            <span className="text-2xl">{CATEGORY_EMOJI[category]}</span>
          )}
          <p className="text-xs font-medium text-slate-700 leading-tight">{item.name}</p>
          <p className="text-xs text-slate-400">{item.color} / {THICKNESS_LABELS[item.thickness]}</p>
          {item.purposeTags?.length > 0 && (
            <p className="text-xs text-slate-300 truncate max-w-full">{item.purposeTags.join(' ')}</p>
          )}
        </>
      ) : (
        <>
          <span className="text-2xl opacity-20">{CATEGORY_EMOJI[category]}</span>
          <p className="text-xs text-slate-300">{CATEGORY_LABELS[category]}なし</p>
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
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <p className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wide">
        コーデ {index + 1}
      </p>

      {/* アイテムグリッド */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {outfit.dress ? (
          <div className="col-span-2">
            <ItemSlot item={outfit.dress} category="dress" />
          </div>
        ) : (
          <>
            <ItemSlot item={outfit.top} category="top" />
            <ItemSlot item={outfit.bottom} category="bottom" />
          </>
        )}
        <ItemSlot item={outfit.outer} category="outer" />
        <ItemSlot item={outfit.shoes} category="shoes" />
      </div>

      {/* フィードバック 2×3 */}
      <div className="space-y-1">
        {FEEDBACK_ROWS.map((row, ri) => (
          <div key={ri} className="grid grid-cols-3 gap-1">
            {row.map((type) => {
              const { label, activeClass } = FEEDBACK_CONFIG[type];
              const active = feedbacks.includes(type);
              return (
                <button
                  key={type}
                  onClick={() => onFeedback(type)}
                  className={[
                    'text-xs py-1.5 rounded-lg border font-medium transition-colors leading-tight',
                    active ? activeClass : 'border-slate-200 text-slate-500 hover:bg-slate-50',
                  ].join(' ')}
                >
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

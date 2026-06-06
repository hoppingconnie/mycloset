'use client';
import {
  Shirt, AlignJustify, Layers, Wind, Footprints, Gem,
  Heart, Check, LucideIcon,
} from 'lucide-react';
import {
  ClothingItem, Category, Outfit,
  CATEGORY_LABELS, THICKNESS_LABELS,
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

interface Props {
  outfit: Outfit;
  index: number;
  liked: boolean;
  adopted: boolean;
  onLike: () => void;
  onAdopt: () => void;
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

export default function OutfitCard({ outfit, index, liked, adopted, onLike, onAdopt }: Props) {
  return (
    <div className={[
      'bg-cream rounded-2xl p-4 border shadow-[0_2px_12px_rgba(36,51,82,0.07)] transition-colors',
      adopted ? 'border-navy/40' : 'border-border-w',
    ].join(' ')}>
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

      {/* アクションボタン */}
      <div className="flex gap-2 pt-2 border-t border-border-w">
        {/* 好き */}
        <button
          onClick={onLike}
          className={[
            'flex items-center gap-1 px-3 py-1.5 rounded-lg border text-[11px] transition-colors',
            liked
              ? 'bg-navy-soft text-navy border-navy/30'
              : 'border-border-w text-muted hover:bg-ivory-dark',
          ].join(' ')}
        >
          <Heart
            size={11}
            strokeWidth={liked ? 2 : 1.5}
            fill={liked ? 'currentColor' : 'none'}
          />
          好き
        </button>

        {/* 採用する */}
        <button
          onClick={onAdopt}
          className={[
            'flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg border text-[11px] font-medium transition-colors',
            adopted
              ? 'bg-navy text-white border-navy'
              : 'border-border-mid text-secondary hover:bg-ivory-dark',
          ].join(' ')}
        >
          <Check size={11} strokeWidth={2} />
          {adopted ? '採用中' : '採用する'}
        </button>
      </div>
    </div>
  );
}

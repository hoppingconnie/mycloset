'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Shirt, AlignJustify, Layers, Wind, Footprints, Gem, LucideIcon } from 'lucide-react';
import {
  ClothingItem, Category,
  CATEGORY_LABELS, THICKNESS_LABELS, SEASON_LABELS, FORMALITY_LABELS,
} from '@/types';
import { storage } from '@/lib/clientStorage';
import { photoStore } from '@/lib/photoStore';

const CATEGORY_ICON: Record<Category, LucideIcon> = {
  top:       Shirt,
  bottom:    AlignJustify,
  dress:     Shirt,
  jacket:    Layers,
  outer:     Wind,
  shoes:     Footprints,
  accessory: Gem,
};

const CATS: { value: Category | 'all'; label: string }[] = [
  { value: 'all',       label: 'すべて' },
  { value: 'top',       label: 'トップス' },
  { value: 'bottom',    label: 'ボトムス' },
  { value: 'dress',     label: 'ワンピース' },
  { value: 'jacket',    label: 'ジャケット' },
  { value: 'outer',     label: 'アウター' },
  { value: 'shoes',     label: '靴' },
  { value: 'accessory', label: 'アクセサリー' },
];

export default function ClothesPage() {
  const [clothes, setClothes] = useState<ClothingItem[]>([]);
  const [photos, setPhotos]   = useState<Map<string, string>>(new Map());
  const [cat, setCat]         = useState<Category | 'all'>('all');
  const [search, setSearch]   = useState('');

  useEffect(() => {
    setClothes(storage.clothes.getAll());
    photoStore.getAll().then(setPhotos);
  }, []);

  function handleDelete(id: string, name: string) {
    if (!confirm(`「${name}」を削除しますか？`)) return;
    storage.clothes.delete(id);
    photoStore.delete(id);
    setClothes((prev) => prev.filter((c) => c.id !== id));
  }

  const filtered = clothes
    .filter((c) => cat === 'all' || c.category === cat)
    .filter((c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.color.toLowerCase().includes(search.toLowerCase())
    );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-medium text-ink tracking-wide">服の管理</h1>
        <Link href="/clothes/new"
          className="bg-navy hover:bg-navy-dim text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          + 追加
        </Link>
      </div>

      <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="名前・色で検索..."
        className="w-full border border-border-mid rounded-lg px-3 py-2 text-sm mb-4 bg-ivory focus:outline-none focus:ring-2 focus:ring-navy/40" />

      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {CATS.map(({ value, label }) => (
          <button key={value} onClick={() => setCat(value)}
            className={[
              'flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
              cat === value
                ? 'bg-navy text-white'
                : 'bg-ivory text-secondary border border-border-w hover:bg-ivory-dark',
            ].join(' ')}>
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted">
          {clothes.length === 0 ? (
            <>
              <p className="text-lg mb-2">まだ服が登録されていません</p>
              <Link href="/clothes/new" className="text-navy hover:underline text-sm">
                最初の一着を登録する →
              </Link>
            </>
          ) : (
            <p>該当する服が見つかりません</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {filtered.map((item) => {
            const Icon = CATEGORY_ICON[item.category];
            return (
              <div key={item.id} className="bg-cream rounded-2xl overflow-hidden border border-border-w shadow-[0_2px_12px_rgba(36,51,82,0.07)]">
                <div className="aspect-square bg-ivory flex items-center justify-center">
                  {(item.photoUrl || photos.get(item.id)) ? (
                    <img src={item.photoUrl || photos.get(item.id)} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-navy-soft flex items-center justify-center">
                      <Icon size={28} className="text-navy" strokeWidth={1.5} />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <span className="inline-block text-xs bg-ivory-dark text-secondary px-2 py-0.5 rounded-full mb-1">
                    {CATEGORY_LABELS[item.category]}
                  </span>
                  <p className="font-medium text-ink text-sm">{item.name}</p>
                  <p className="text-xs text-secondary mt-0.5">
                    {item.color} · {THICKNESS_LABELS[item.thickness]}
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    {item.seasons.map((s) => SEASON_LABELS[s]).join(' ')} · {FORMALITY_LABELS[item.formality]}
                  </p>
                  {item.notes && (
                    <p className="text-xs text-muted mt-1 truncate">{item.notes}</p>
                  )}
                  <div className="flex gap-2 mt-3">
                    <Link href={`/clothes/${item.id}`}
                      className="flex-1 text-center text-xs py-1.5 border border-border-w rounded-lg text-secondary hover:bg-ivory-dark">
                      編集
                    </Link>
                    <button onClick={() => handleDelete(item.id, item.name)}
                      className="flex-1 text-xs py-1.5 border border-red-200 rounded-lg text-red-500 hover:bg-red-50">
                      削除
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

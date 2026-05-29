'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ClothingItem, Category,
  CATEGORY_LABELS, CATEGORY_EMOJI, THICKNESS_LABELS, SEASON_LABELS, FORMALITY_LABELS,
} from '@/types';
import { storage } from '@/lib/clientStorage';
import { photoStore } from '@/lib/photoStore';

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
        <h1 className="text-2xl font-bold text-slate-900">服の管理</h1>
        <Link href="/clothes/new"
          className="bg-rose-500 hover:bg-rose-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          + 追加
        </Link>
      </div>

      <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="名前・色で検索..."
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-rose-500" />

      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {CATS.map(({ value, label }) => (
          <button key={value} onClick={() => setCat(value)}
            className={[
              'flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
              cat === value
                ? 'bg-rose-500 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50',
            ].join(' ')}>
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          {clothes.length === 0 ? (
            <>
              <p className="text-lg mb-2">まだ服が登録されていません</p>
              <Link href="/clothes/new" className="text-rose-500 hover:underline text-sm">
                最初の一着を登録する →
              </Link>
            </>
          ) : (
            <p>該当する服が見つかりません</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {filtered.map((item) => (
            <div key={item.id} className="bg-white rounded-2xl overflow-hidden shadow-sm">
              <div className="aspect-square bg-slate-50 flex items-center justify-center">
                {(item.photoUrl || photos.get(item.id)) ? (
                  <img src={item.photoUrl || photos.get(item.id)} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-5xl">{CATEGORY_EMOJI[item.category]}</span>
                )}
              </div>
              <div className="p-3">
                <span className="inline-block text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full mb-1">
                  {CATEGORY_LABELS[item.category]}
                </span>
                <p className="font-medium text-slate-900 text-sm">{item.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {item.color} · {THICKNESS_LABELS[item.thickness]}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {item.seasons.map((s) => SEASON_LABELS[s]).join(' ')} · {FORMALITY_LABELS[item.formality]}
                </p>
                {item.notes && (
                  <p className="text-xs text-slate-400 mt-1 truncate">{item.notes}</p>
                )}
                <div className="flex gap-2 mt-3">
                  <Link href={`/clothes/${item.id}`}
                    className="flex-1 text-center text-xs py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
                    編集
                  </Link>
                  <button onClick={() => handleDelete(item.id, item.name)}
                    className="flex-1 text-xs py-1.5 border border-red-200 rounded-lg text-red-500 hover:bg-red-50">
                    削除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

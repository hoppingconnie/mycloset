'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ClothingItem } from '@/types';
import { storage } from '@/lib/clientStorage';
import ClothingForm, { ClothingFormData } from '../ClothingForm';

export default function EditClothesPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const [item, setItem] = useState<ClothingItem | null | undefined>(undefined);

  useEffect(() => {
    const found = storage.clothes.getById(id);
    setItem(found ?? null);
    if (!found) router.push('/clothes');
  }, [id, router]);

  function handleSubmit(form: ClothingFormData) {
    storage.clothes.update(id, {
      category:    form.category,
      name:        form.name,
      color:       form.color,
      thickness:   form.thickness,
      seasons:     form.seasons,
      formality:   form.formality,
      purposeTags: form.purposeTags,
      photoUrl:    form.photoUrl || undefined,
      notes:       form.notes   || undefined,
    });
    router.push('/clothes');
    return Promise.resolve();
  }

  function handleDelete() {
    if (!confirm('削除しますか？')) return;
    storage.clothes.delete(id);
    router.push('/clothes');
  }

  if (item === undefined) return <div className="text-center py-16 text-slate-400">読み込み中...</div>;
  if (item === null) return null;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/clothes" className="text-slate-400 hover:text-slate-600 text-sm">← 戻る</Link>
        <h1 className="text-2xl font-bold text-slate-900">服を編集</h1>
      </div>
      <div className="bg-white rounded-2xl p-6 shadow-sm max-w-lg">
        <ClothingForm
          initial={{
            category:    item.category,
            name:        item.name,
            color:       item.color,
            thickness:   item.thickness,
            seasons:     item.seasons,
            formality:   item.formality,
            purposeTags: item.purposeTags ?? [],
            photoUrl:    item.photoUrl ?? '',
            notes:       item.notes    ?? '',
          }}
          onSubmit={handleSubmit}
          submitLabel="保存する"
          onDelete={handleDelete}
        />
      </div>
    </div>
  );
}

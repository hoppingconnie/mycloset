'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ClothingItem } from '@/types';
import { storage } from '@/lib/clientStorage';
import { photoStore } from '@/lib/photoStore';
import ClothingForm, { ClothingFormData } from '../ClothingForm';

export default function EditClothesPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const [item, setItem] = useState<ClothingItem | null | undefined>(undefined);

  useEffect(() => {
    const found = storage.clothes.getById(id);
    if (!found) { setItem(null); router.push('/clothes'); return; }
    // 写真は IndexedDB から非同期で読み込む
    photoStore.get(id).then((photoUrl) => {
      setItem({ ...found, photoUrl });
    });
  }, [id, router]);

  async function handleSubmit(form: ClothingFormData) {
    storage.clothes.update(id, {
      category:    form.category,
      name:        form.name,
      color:       form.color,
      thickness:   form.thickness,
      seasons:     form.seasons,
      formality:   form.formality,
      purposeTags: form.purposeTags,
      notes:       form.notes || undefined,
    });
    // 写真の更新・削除を IndexedDB に反映
    if (form.photoUrl?.startsWith('data:')) {
      await photoStore.set(id, form.photoUrl);
    } else if (!form.photoUrl) {
      await photoStore.delete(id);
    }
    router.push('/clothes');
  }

  async function handleDelete() {
    if (!confirm('削除しますか？')) return;
    storage.clothes.delete(id);
    await photoStore.delete(id);
    router.push('/clothes');
  }

  if (item === undefined) return <div className="text-center py-16 text-muted">読み込み中...</div>;
  if (item === null) return null;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/clothes" className="text-muted hover:text-secondary text-sm">← 戻る</Link>
        <h1 className="text-xl font-medium text-ink tracking-wide">服を編集</h1>
      </div>
      <div className="bg-cream rounded-2xl p-6 border border-border-w shadow-[0_2px_12px_rgba(36,51,82,0.07)] max-w-lg">
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

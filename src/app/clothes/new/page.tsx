'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ClothingItem } from '@/types';
import { storage } from '@/lib/clientStorage';
import { photoStore } from '@/lib/photoStore';
import { logEvent } from '@/lib/analytics';
import ClothingForm, { ClothingFormData } from '../ClothingForm';

export default function NewClothesPage() {
  const router = useRouter();

  async function handleSubmit(form: ClothingFormData) {
    const now = new Date().toISOString();
    const id  = crypto.randomUUID();
    const item: ClothingItem = {
      id,
      category:    form.category,
      name:        form.name,
      color:       form.color,
      thickness:   form.thickness,
      seasons:     form.seasons,
      formality:   form.formality,
      purposeTags: form.purposeTags,
      notes:       form.notes || undefined,
      createdAt:   now,
      updatedAt:   now,
    };
    storage.clothes.create(item);                          // localStorage（写真なし）
    if (form.photoUrl) await photoStore.set(id, form.photoUrl); // IndexedDB（写真）

    // Analytics
    logEvent('clothes_added', { category: form.category });
    const total = storage.clothes.getAll().length;
    if (total === 30) logEvent('clothes_count_30');

    router.push('/clothes');
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/clothes" className="text-muted hover:text-secondary text-sm">← 戻る</Link>
        <h1 className="text-xl font-medium text-ink tracking-wide">服を追加</h1>
      </div>
      <div className="bg-cream rounded-2xl p-6 border border-border-w shadow-[0_2px_12px_rgba(36,51,82,0.07)] max-w-lg">
        <ClothingForm onSubmit={handleSubmit} submitLabel="追加する" />
      </div>
    </div>
  );
}

'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ClothingItem } from '@/types';
import { storage } from '@/lib/clientStorage';
import { photoStore } from '@/lib/photoStore';
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
    router.push('/clothes');
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/clothes" className="text-slate-400 hover:text-slate-600 text-sm">← 戻る</Link>
        <h1 className="text-2xl font-bold text-slate-900">服を追加</h1>
      </div>
      <div className="bg-white rounded-2xl p-6 shadow-sm max-w-lg">
        <ClothingForm onSubmit={handleSubmit} submitLabel="追加する" />
      </div>
    </div>
  );
}

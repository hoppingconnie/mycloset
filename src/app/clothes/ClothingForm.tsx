'use client';
import { useState } from 'react';
import { Category, Thickness, Season, Formality, DEFAULT_PURPOSES } from '@/types';

export interface ClothingFormData {
  category: Category;
  name: string;
  color: string;
  thickness: Thickness;
  seasons: Season[];
  formality: Formality;
  purposeTags: string[];
  photoUrl: string;
  notes: string;
}

interface Props {
  initial?: Partial<ClothingFormData>;
  onSubmit: (data: ClothingFormData) => void | Promise<void>;
  submitLabel: string;
  onDelete?: () => void;
}

const defaults: ClothingFormData = {
  category: 'top',
  name: '',
  color: '',
  thickness: 'medium',
  seasons: [],
  formality: 'casual',
  purposeTags: [],
  photoUrl: '',
  notes: '',
};

const SEASONS: { value: Season; label: string }[] = [
  { value: 'spring', label: '春' },
  { value: 'summer', label: '夏' },
  { value: 'autumn', label: '秋' },
  { value: 'winter', label: '冬' },
];

const inp =
  'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500';
const lbl = 'block text-sm font-medium text-slate-700 mb-1';

function chipCls(active: boolean) {
  return [
    'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
    active
      ? 'bg-rose-500 text-white border-rose-500'
      : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50',
  ].join(' ');
}

export default function ClothingForm({ initial, onSubmit, submitLabel, onDelete }: Props) {
  const [form, setForm] = useState<ClothingFormData>({ ...defaults, ...initial });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [photoMode, setPhotoMode] = useState<'url' | 'file'>(
    initial?.photoUrl?.startsWith('data:') ? 'file' : 'url'
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [customTag, setCustomTag] = useState('');

  function set<K extends keyof ClothingFormData>(k: K, v: ClothingFormData[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  function toggleSeason(s: Season) {
    set('seasons', form.seasons.includes(s) ? form.seasons.filter((x) => x !== s) : [...form.seasons, s]);
  }

  function togglePurpose(tag: string) {
    set(
      'purposeTags',
      form.purposeTags.includes(tag)
        ? form.purposeTags.filter((t) => t !== tag)
        : [...form.purposeTags, tag]
    );
  }

  function addCustomTag() {
    const t = customTag.trim();
    if (t && !form.purposeTags.includes(t)) {
      set('purposeTags', [...form.purposeTags, t]);
    }
    setCustomTag('');
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      // FileReader で読み込んだあと Canvas でリサイズ・圧縮する
      // iPhone Safari の localStorage 上限（約5MB）対策
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('読み込みに失敗しました'));
        reader.onload  = () => {
          const img = new Image();
          img.onerror = () => reject(new Error('画像の処理に失敗しました'));
          img.onload  = () => {
            // 長辺を最大 600px に縮小（iPhone 5MB 上限対策・800px から変更）
            const MAX = 600;
            const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
            const canvas = document.createElement('canvas');
            canvas.width  = Math.round(img.width  * ratio);
            canvas.height = Math.round(img.height * ratio);
            canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
            // JPEG 品質 60%（75% から変更）→ 典型的な服の写真で 30〜80KB 程度
            resolve(canvas.toDataURL('image/jpeg', 0.60));
          };
          img.src = reader.result as string;
        };
        reader.readAsDataURL(file);
      });
      set('photoUrl', dataUrl);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : '読み込みに失敗しました');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.seasons.length === 0) { setError('季節を1つ以上選択してください'); return; }
    setLoading(true);
    setError('');
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました');
      setLoading(false);
    }
  }

  const customTags = form.purposeTags.filter((t) => !DEFAULT_PURPOSES.includes(t));

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">{error}</p>}

      {/* カテゴリ */}
      <div>
        <label className={lbl}>カテゴリ *</label>
        <select value={form.category} onChange={(e) => set('category', e.target.value as Category)} className={inp} required>
          <option value="top">トップス</option>
          <option value="bottom">ボトムス</option>
          <option value="dress">ワンピース</option>
          <option value="jacket">ジャケット</option>
          <option value="outer">アウター</option>
          <option value="shoes">靴</option>
          <option value="accessory">アクセサリー</option>
        </select>
      </div>

      {/* 名前 */}
      <div>
        <label className={lbl}>名前 *</label>
        <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="例: 白Tシャツ" required className={inp} />
      </div>

      {/* 色 */}
      <div>
        <label className={lbl}>色 *</label>
        <input type="text" value={form.color} onChange={(e) => set('color', e.target.value)} placeholder="例: 白、ネイビー" required className={inp} />
      </div>

      {/* 厚さ */}
      <div>
        <label className={lbl}>厚さ *</label>
        <select value={form.thickness} onChange={(e) => set('thickness', e.target.value as Thickness)} className={inp}>
          <option value="thin">薄手</option>
          <option value="medium">中厚</option>
          <option value="thick">厚手</option>
        </select>
      </div>

      {/* 季節 */}
      <div>
        <label className={lbl}>季節 *</label>
        <div className="flex gap-2 flex-wrap mt-1">
          {SEASONS.map(({ value, label: l }) => (
            <button key={value} type="button" onClick={() => toggleSeason(value)} className={chipCls(form.seasons.includes(value))}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* 用途タグ */}
      <div>
        <label className={lbl}>用途タグ</label>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {DEFAULT_PURPOSES.map((tag) => (
            <button key={tag} type="button" onClick={() => togglePurpose(tag)} className={chipCls(form.purposeTags.includes(tag))}>
              {tag}
            </button>
          ))}
        </div>
        {customTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {customTags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-slate-100 text-slate-700 border border-slate-200">
                {tag}
                <button type="button" onClick={() => togglePurpose(tag)} className="text-slate-400 hover:text-red-500 leading-none">×</button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2 mt-2">
          <input
            type="text"
            value={customTag}
            onChange={(e) => setCustomTag(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomTag(); } }}
            placeholder="カスタムタグを追加..."
            className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
          <button type="button" onClick={addCustomTag} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
            追加
          </button>
        </div>
      </div>

      {/* フォーマル度 */}
      <div>
        <label className={lbl}>フォーマル度</label>
        <select value={form.formality} onChange={(e) => set('formality', e.target.value as Formality)} className={inp}>
          <option value="casual">カジュアル</option>
          <option value="smart-casual">スマートカジュアル</option>
          <option value="formal">フォーマル</option>
        </select>
      </div>

      {/* 写真 */}
      <div>
        <label className={lbl}>写真</label>
        <div className="flex gap-1.5 mb-2">
          {(['url', 'file'] as const).map((m) => (
            <button key={m} type="button" onClick={() => setPhotoMode(m)}
              className={['text-xs px-3 py-1 rounded-full border transition-colors', photoMode === m ? 'bg-rose-500 text-white border-rose-500' : 'border-slate-300 text-slate-600 hover:bg-slate-50'].join(' ')}>
              {m === 'url' ? 'URLを入力' : 'ファイルを選択'}
            </button>
          ))}
        </div>
        {photoMode === 'url' ? (
          <input type="text" value={form.photoUrl.startsWith('data:') ? '' : form.photoUrl} onChange={(e) => set('photoUrl', e.target.value)} placeholder="https://example.com/photo.jpg" className={inp} />
        ) : (
          <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleFileSelect} disabled={uploading}
              className="text-sm text-slate-600 file:mr-3 file:text-xs file:py-1 file:px-3 file:rounded-full file:border-0 file:bg-rose-50 file:text-rose-600 hover:file:bg-rose-100 file:cursor-pointer disabled:opacity-50" />
            {uploading && <p className="text-xs text-slate-400 mt-2">アップロード中...</p>}
            {uploadError && <p className="text-xs text-red-500 mt-2">{uploadError}</p>}
          </div>
        )}
        {form.photoUrl && (
          <div className="mt-2 flex items-center gap-3">
            <img src={form.photoUrl} alt="プレビュー" className="w-20 h-20 object-cover rounded-lg border border-slate-200" />
            <button type="button" onClick={() => set('photoUrl', '')} className="text-xs text-red-400 hover:text-red-600">削除</button>
          </div>
        )}
      </div>

      {/* メモ */}
      <div>
        <label className={lbl}>メモ</label>
        <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="お気に入りポイント、購入場所など..." rows={3} className={inp} />
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={loading}
          className="flex-1 bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300 text-white font-medium py-2.5 rounded-lg text-sm transition-colors">
          {loading ? '保存中...' : submitLabel}
        </button>
        {onDelete && (
          <button type="button" onClick={onDelete}
            className="px-4 py-2.5 border border-red-300 text-red-500 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors">
            削除
          </button>
        )}
      </div>
    </form>
  );
}

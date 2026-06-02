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

// ── 色定数 ──────────────────────────────────────────────────────────────────────

const STANDARD_COLORS = [
  '白', '黒', 'グレー', 'ネイビー', 'ブルー', 'ベージュ', 'ブラウン',
  'カーキ', 'グリーン', 'ピンク', 'レッド', 'オレンジ', 'イエロー',
  'パープル', 'シルバー', 'ゴールド',
] as const;

type StandardColor = (typeof STANDARD_COLORS)[number];

const COLOR_SWATCHES: Record<string, string> = {
  '白':      '#f1f5f9',
  '黒':      '#1e293b',
  'グレー':   '#94a3b8',
  'ネイビー': '#1e3a5f',
  'ブルー':   '#3b82f6',
  'ベージュ': '#d4b896',
  'ブラウン': '#7c5230',
  'カーキ':   '#7c7256',
  'グリーン': '#22c55e',
  'ピンク':   '#f472b6',
  'レッド':   '#ef4444',
  'オレンジ': '#f97316',
  'イエロー': '#eab308',
  'パープル': '#a855f7',
  'シルバー': '#cbd5e1',
  'ゴールド': '#d4a017',
};

/** よく使われる別名 → 標準カラー名 */
const COLOR_ALIASES: Record<string, string> = {
  'ホワイト': '白', 'しろ': '白',
  'ブラック': '黒', 'くろ': '黒',
  'チャコール': 'グレー', 'ライトグレー': 'グレー', 'ダークグレー': 'グレー',
  'スレート': 'グレー', 'グレージュ': 'グレー',
  'インディゴ': 'ネイビー', 'ダークブルー': 'ネイビー', 'デニムブルー': 'ネイビー',
  '紺': 'ネイビー', 'マリンブルー': 'ネイビー',
  '水色': 'ブルー', 'スカイブルー': 'ブルー', 'ライトブルー': 'ブルー',
  '青': 'ブルー', 'セルリアン': 'ブルー',
  'アイボリー': 'ベージュ', 'クリーム': 'ベージュ', '生成り': 'ベージュ',
  'エクリュ': 'ベージュ', 'オフホワイト': 'ベージュ', 'タン': 'ベージュ',
  'サンド': 'ベージュ',
  'マロン': 'ブラウン', 'チョコレート': 'ブラウン', 'テラコッタ': 'ブラウン',
  'キャメル': 'ブラウン', 'コニャック': 'ブラウン',
  'オリーブ': 'カーキ', 'カーキグリーン': 'カーキ', 'オリーブグリーン': 'カーキ',
  'ミリタリー': 'カーキ',
  '緑': 'グリーン', 'ミント': 'グリーン', 'セージ': 'グリーン',
  'エメラルド': 'グリーン', 'フォレスト': 'グリーン',
  'サーモン': 'ピンク', 'コーラル': 'ピンク', 'ローズ': 'ピンク',
  'ベビーピンク': 'ピンク', 'フューシャ': 'ピンク',
  'ボルドー': 'レッド', 'バーガンディ': 'レッド', 'ワインレッド': 'レッド',
  '赤': 'レッド', 'ワイン': 'レッド',
  'マスタード': 'イエロー', '黄': 'イエロー', 'レモン': 'イエロー',
  'ラベンダー': 'パープル', 'バイオレット': 'パープル', '紫': 'パープル',
  'ライラック': 'パープル', 'プラム': 'パープル',
};

function resolveColor(text: string): string {
  const t = text.trim();
  if (!t) return '';
  if (STANDARD_COLORS.includes(t as StandardColor)) return t;
  if (COLOR_ALIASES[t]) return COLOR_ALIASES[t];
  // 部分一致（例: "ネイビーブルー" → "ネイビー"）
  for (const c of STANDARD_COLORS) {
    if (t.includes(c)) return c;
  }
  return 'その他';
}

function parseColorStr(colorStr: string): {
  main: string;
  sub: string;
  mainNote: string;
  subNote: string;
} {
  if (!colorStr) return { main: '', sub: '', mainNote: '', subNote: '' };
  // ・/ × ＋ 、, (全角スペース含む) で分割
  const parts = colorStr.split(/[・\/×＋、,　]+/).map((s) => s.trim()).filter(Boolean);
  const mainRaw = parts[0] ?? '';
  const subRaw  = parts[1] ?? '';
  const main = resolveColor(mainRaw);
  const sub  = subRaw ? resolveColor(subRaw) : '';
  return {
    main,
    sub,
    mainNote: main === 'その他' ? mainRaw : '',
    subNote:  sub  === 'その他' ? subRaw  : '',
  };
}

function serializeColor(
  main: string,
  sub: string,
  mainNote: string,
  subNote: string,
): string {
  const mainStr = main === 'その他' ? (mainNote.trim() || 'その他') : main;
  if (!sub) return mainStr;
  const subStr  = sub  === 'その他' ? (subNote.trim()  || 'その他') : sub;
  return `${mainStr}・${subStr}`;
}

// ── スタイル定数 ─────────────────────────────────────────────────────────────────

const SEASONS: { value: Season; label: string }[] = [
  { value: 'spring', label: '春' },
  { value: 'summer', label: '夏' },
  { value: 'autumn', label: '秋' },
  { value: 'winter', label: '冬' },
];

const inp =
  'w-full border border-border-mid rounded-lg px-3 py-2 text-sm bg-ivory focus:outline-none focus:ring-2 focus:ring-navy/40';
const lbl = 'block text-sm font-medium text-secondary mb-1';

function chipCls(active: boolean) {
  return [
    'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
    active
      ? 'bg-navy text-white border-navy'
      : 'bg-ivory text-secondary border-border-w hover:bg-ivory-dark',
  ].join(' ');
}

/** 色ドット＋ラベルのチップボタン */
function ColorChip({
  color,
  selected,
  onClick,
}: {
  color: string;
  selected: boolean;
  onClick: () => void;
}) {
  const swatch = COLOR_SWATCHES[color];
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-colors',
        selected
          ? 'bg-navy text-white border-navy'
          : 'bg-ivory text-ink border-border-w hover:bg-ivory-dark',
      ].join(' ')}
    >
      {swatch && (
        <span
          className="w-3 h-3 rounded-full border border-black/10 shrink-0"
          style={{ backgroundColor: swatch }}
        />
      )}
      {color}
    </button>
  );
}

// ── フォーム本体 ─────────────────────────────────────────────────────────────────

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

  // 色の選択状態（form.color とは独立して管理し、送信時に合成する）
  const initColor = parseColorStr(initial?.color ?? '');
  const [mainColor, setMainColor] = useState(initColor.main);
  const [subColor,  setSubColor]  = useState(initColor.sub);
  const [mainNote,  setMainNote]  = useState(initColor.mainNote);
  const [subNote,   setSubNote]   = useState(initColor.subNote);

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
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('読み込みに失敗しました'));
        reader.onload  = () => {
          const img = new Image();
          img.onerror = () => reject(new Error('画像の処理に失敗しました'));
          img.onload  = () => {
            const MAX = 600;
            const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
            const canvas = document.createElement('canvas');
            canvas.width  = Math.round(img.width  * ratio);
            canvas.height = Math.round(img.height * ratio);
            canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
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
    if (!mainColor) { setError('メインカラーを選択してください'); return; }
    if (mainColor === 'その他' && !mainNote.trim()) {
      setError('「その他」の場合は色名を入力してください');
      return;
    }
    if (subColor === 'その他' && !subNote.trim()) {
      setError('サブカラー「その他」の場合は色名を入力してください');
      return;
    }

    const color = serializeColor(mainColor, subColor, mainNote, subNote);

    setLoading(true);
    setError('');
    try {
      await onSubmit({ ...form, color });
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

      {/* メインカラー */}
      <div>
        <label className={lbl}>メインカラー *</label>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {STANDARD_COLORS.map((c) => (
            <ColorChip
              key={c}
              color={c}
              selected={mainColor === c}
              onClick={() => { setMainColor(c); setMainNote(''); }}
            />
          ))}
          <button
            type="button"
            onClick={() => setMainColor('その他')}
            className={chipCls(mainColor === 'その他')}
          >
            その他
          </button>
        </div>
        {mainColor === 'その他' && (
          <input
            type="text"
            value={mainNote}
            onChange={(e) => setMainNote(e.target.value)}
            placeholder="色を入力（例: 水色、テラコッタ）"
            className={`mt-2 ${inp}`}
          />
        )}
      </div>

      {/* サブカラー（任意） */}
      {mainColor && (
        <div>
          <label className={lbl}>
            サブカラー
            <span className="font-normal text-muted ml-1">（任意）</span>
          </label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            <button
              type="button"
              onClick={() => { setSubColor(''); setSubNote(''); }}
              className={chipCls(!subColor)}
            >
              なし
            </button>
            {STANDARD_COLORS.map((c) => (
              <ColorChip
                key={c}
                color={c}
                selected={subColor === c}
                onClick={() => { setSubColor(c); setSubNote(''); }}
              />
            ))}
            <button
              type="button"
              onClick={() => setSubColor('その他')}
              className={chipCls(subColor === 'その他')}
            >
              その他
            </button>
          </div>
          {subColor === 'その他' && (
            <input
              type="text"
              value={subNote}
              onChange={(e) => setSubNote(e.target.value)}
              placeholder="色を入力（例: テラコッタ）"
              className={`mt-2 ${inp}`}
            />
          )}
        </div>
      )}

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
              <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-ivory-dark text-secondary border border-border-w">
                {tag}
                <button type="button" onClick={() => togglePurpose(tag)} className="text-muted hover:text-red-500 leading-none">×</button>
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
            className="flex-1 border border-border-mid rounded-lg px-3 py-1.5 text-sm bg-ivory focus:outline-none focus:ring-2 focus:ring-navy/40"
          />
          <button type="button" onClick={addCustomTag} className="px-3 py-1.5 border border-border-mid rounded-lg text-sm text-secondary hover:bg-ivory-dark">
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
              className={['text-xs px-3 py-1 rounded-full border transition-colors', photoMode === m ? 'bg-navy text-white border-navy' : 'border-border-w text-secondary hover:bg-ivory-dark'].join(' ')}>
              {m === 'url' ? 'URLを入力' : 'ファイルを選択'}
            </button>
          ))}
        </div>
        {photoMode === 'url' ? (
          <input type="text" value={form.photoUrl.startsWith('data:') ? '' : form.photoUrl} onChange={(e) => set('photoUrl', e.target.value)} placeholder="https://example.com/photo.jpg" className={inp} />
        ) : (
          <div className="border border-border-w rounded-lg p-3 bg-ivory">
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleFileSelect} disabled={uploading}
              className="text-sm text-secondary file:mr-3 file:text-xs file:py-1 file:px-3 file:rounded-full file:border-0 file:bg-navy-soft file:text-navy hover:file:bg-ivory-dark file:cursor-pointer disabled:opacity-50" />
            {uploading && <p className="text-xs text-muted mt-2">アップロード中...</p>}
            {uploadError && <p className="text-xs text-red-500 mt-2">{uploadError}</p>}
          </div>
        )}
        {form.photoUrl && (
          <div className="mt-2 flex items-center gap-3">
            <img src={form.photoUrl} alt="プレビュー" className="w-20 h-20 object-cover rounded-lg border border-border-w" />
            <button type="button" onClick={() => set('photoUrl', '')} className="text-xs text-muted hover:text-red-500">削除</button>
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
          className="flex-1 bg-navy hover:bg-navy-dim disabled:opacity-40 text-white font-medium py-2.5 rounded-lg text-sm transition-colors">
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

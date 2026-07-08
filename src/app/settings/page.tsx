'use client';
import { useEffect, useRef, useState } from 'react';
import { ClothingItem, ColorRule, OutfitRecord, PURPOSE_TAG_MIGRATION } from '@/types';
import { storage } from '@/lib/clientStorage';
import { photoStore } from '@/lib/photoStore';

interface BackupData {
  version: number;
  exportedAt: string;
  clothes: ClothingItem[];
  colorRules: ColorRule[];
  suggestions: OutfitRecord[];
}

interface Stats {
  clothes: number;
  colorRules: number;
  suggestions: number;
}

export default function SettingsPage() {
  const [stats, setStats]           = useState<Stats>({ clothes: 0, colorRules: 0, suggestions: 0 });
  const [importMsg, setImportMsg]   = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef                     = useRef<HTMLInputElement>(null);

  function refreshStats() {
    setStats({
      clothes:     storage.clothes.getAll().length,
      colorRules:  storage.colorRules.getAll().length,
      suggestions: storage.suggestions.getAll().length,
    });
  }

  useEffect(() => { refreshStats(); }, []);

  // ── エクスポート ────────────────────────────────────────────────────────────
  async function handleExport() {
    // 写真を IndexedDB から読み込み、clothes に付与してからエクスポートする
    const photoMap = await photoStore.getAll();
    const clothesWithPhotos = storage.clothes.getAll().map((item) => {
      const photoUrl = photoMap.get(item.id);
      return photoUrl ? { ...item, photoUrl } : item;
    });
    const backup: BackupData = {
      version:    1,
      exportedAt: new Date().toISOString(),
      clothes:    clothesWithPhotos,
      colorRules: storage.colorRules.getAll(),
      suggestions: storage.suggestions.getAll(),
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), {
      href:     url,
      download: `mycloset-backup-${new Date().toISOString().slice(0, 10)}.json`,
    });
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── インポート ──────────────────────────────────────────────────────────────
  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportMsg(null);

    try {
      const raw  = await file.text();
      const data = JSON.parse(raw);

      let addedClothes     = 0;
      let addedColorRules  = 0;
      let addedSuggestions = 0;

      const migrateItem = (item: ClothingItem): ClothingItem => ({
        ...item,
        purposeTags: (item.purposeTags ?? []).map(
          (t: string) => PURPOSE_TAG_MIGRATION[t] ?? t
        ),
      });

      // ① このアプリのバックアップ形式（version + clothes + colorRules）
      if (data && typeof data === 'object' && !Array.isArray(data) && data.clothes) {
        const existClothes    = new Set(storage.clothes.getAll().map((c) => c.id));
        const existColorRules = new Set(storage.colorRules.getAll().map((r) => r.id));

        for (const item of (data.clothes ?? []) as ClothingItem[]) {
          if (!existClothes.has(item.id)) {
            // 写真は IndexedDB に保存し、localStorage には写真なしで保存する
            if (item.photoUrl) await photoStore.set(item.id, item.photoUrl);
            storage.clothes.create(migrateItem(item));
            addedClothes++;
          }
        }
        for (const rule of (data.colorRules ?? []) as ColorRule[]) {
          if (!existColorRules.has(rule.id)) {
            storage.colorRules.create(rule);
            addedColorRules++;
          }
        }
        addedSuggestions = storage.suggestions.restoreMany(
          (data.suggestions ?? []) as OutfitRecord[]
        );
      }
      // ② 旧サーバーの data/clothes.json 形式（ClothingItem の配列）
      else if (Array.isArray(data)) {
        const existClothes = new Set(storage.clothes.getAll().map((c) => c.id));
        for (const item of data as ClothingItem[]) {
          if (item.id && item.name && item.category) {
            if (!existClothes.has(item.id)) {
              if (item.photoUrl) await photoStore.set(item.id, item.photoUrl);
              storage.clothes.create(migrateItem(item));
              addedClothes++;
            }
          }
        }
      } else {
        throw new Error('形式不明');
      }

      refreshStats();
      setImportMsg({
        ok:   true,
        text: `インポート完了 — 服 ${addedClothes} 件・色ルール ${addedColorRules} 件・提案履歴 ${addedSuggestions} 件を追加しました`,
      });
    } catch {
      setImportMsg({ ok: false, text: 'エラー: ファイルの形式が正しくありません' });
    }

    e.target.value = '';
  }

  // ── 全削除 ─────────────────────────────────────────────────────────────────
  async function handleClear() {
    if (!confirm('すべてのデータ（服・色ルール・提案履歴）を削除しますか？\nこの操作は元に戻せません。')) return;
    localStorage.removeItem('wardrobe:clothes');
    localStorage.removeItem('wardrobe:colorRules');
    localStorage.removeItem('wardrobe:suggestions');
    await photoStore.clearAll();
    refreshStats();
    setImportMsg({ ok: true, text: 'データをすべて削除しました' });
  }

  const card = 'bg-cream rounded-2xl p-5 border border-border-w shadow-[0_2px_12px_rgba(36,51,82,0.07)] space-y-3';
  const btn  = (color: string) =>
    `w-full py-2.5 rounded-lg text-sm font-medium transition-colors ${color}`;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-medium text-ink tracking-wide">データ管理</h1>

      {/* 現在の件数 */}
      <div className={card}>
        <h2 className="text-sm font-medium text-secondary">このデバイスの保存データ</h2>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: '服', value: stats.clothes },
            { label: '色ルール', value: stats.colorRules },
            { label: '提案履歴', value: stats.suggestions },
          ].map(({ label, value }) => (
            <div key={label} className="bg-navy-soft rounded-xl py-3">
              <p className="text-2xl font-medium text-navy">{value}</p>
              <p className="text-xs text-secondary mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* エクスポート */}
      <div className={card}>
        <h2 className="text-base font-medium text-ink">バックアップ（エクスポート）</h2>
        <p className="text-xs text-muted">
          服・色ルール・提案履歴をJSONファイルに保存します。
          別のデバイスへの引っ越しやバックアップに使えます。
        </p>
        <button onClick={handleExport}
          className={btn('bg-navy hover:bg-navy-dim text-white')}>
          JSONをダウンロード
        </button>
      </div>

      {/* インポート */}
      <div className={card}>
        <h2 className="text-base font-medium text-ink">データの復元（インポート）</h2>
        <p className="text-xs text-muted">
          以下のファイルを読み込めます：
        </p>
        <ul className="text-xs text-muted list-disc list-inside space-y-0.5">
          <li>このアプリのバックアップJSON（エクスポートしたファイル）</li>
          <li>旧サーバーの <code className="bg-ivory-dark px-1 rounded">data/clothes.json</code>
            <span className="ml-1 text-muted">（以前の服データ）</span>
          </li>
        </ul>
        <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 border border-amber-200">
          すでに同じIDのデータがある場合はスキップされます（重複しません）
        </p>

        {importMsg && (
          <p className={`text-sm px-3 py-2 rounded-lg ${
            importMsg.ok
              ? 'bg-green-50 text-green-700'
              : 'bg-red-50 text-red-600'
          }`}>
            {importMsg.text}
          </p>
        )}

        <button onClick={() => fileRef.current?.click()}
          className={btn('bg-navy hover:bg-navy-dim text-white')}>
          JSONファイルを選択
        </button>
        <input ref={fileRef} type="file" accept=".json" className="hidden"
          onChange={handleImport} />
      </div>

      {/* 全削除 */}
      <div className={card}>
        <h2 className="text-base font-medium text-ink">データをすべて削除</h2>
        <p className="text-xs text-muted">
          このデバイスに保存されているすべてのデータを消去します。
          削除前にエクスポートしておくことをおすすめします。
        </p>
        <button onClick={handleClear}
          className={btn('border border-red-300 text-red-500 hover:bg-red-50')}>
          すべて削除する
        </button>
      </div>
    </div>
  );
}

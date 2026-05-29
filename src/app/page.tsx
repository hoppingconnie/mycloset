'use client';
import { useEffect, useState } from 'react';
import { ClothingItem, FeedbackType, OutfitRecord, DEFAULT_PURPOSES } from '@/types';
import { tempMessage, suggestOutfits, Diagnostics } from '@/lib/suggest';
import { storage } from '@/lib/clientStorage';
import { photoStore } from '@/lib/photoStore';
import OutfitCard from './OutfitCard';

function NoOutfitMessage({ diagnostics }: { diagnostics: Diagnostics | null }) {
  if (!diagnostics || diagnostics.totalClothes === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <p className="text-lg mb-1">服が登録されていません</p>
        <p className="text-sm">「服管理」タブから服を追加してください</p>
      </div>
    );
  }

  const reasons: string[] = [];
  const topsOk    = diagnostics.topsAll > 0;
  const dressesOk = diagnostics.dressesAll > 0;
  const hasTop    = topsOk || dressesOk;

  if (!hasTop) {
    reasons.push('トップスまたはワンピースが1点も登録されていません');
  }
  if (diagnostics.bottoms === 0 && !dressesOk) {
    reasons.push('ボトムスが登録されていません');
  }
  if (diagnostics.outersNeeded && diagnostics.outersAvailable === 0) {
    reasons.push('この気温にはアウターが必要ですが、登録がありません');
  }

  if (reasons.length === 0) {
    reasons.push('登録している服の組み合わせで提案できるコーデがありません');
  }

  return (
    <div className="py-10 px-4 bg-amber-50 rounded-2xl border border-amber-200">
      <p className="text-base font-semibold text-amber-800 mb-3">コーデを提案できませんでした</p>
      <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside mb-4">
        {reasons.map((r) => <li key={r}>{r}</li>)}
      </ul>
      <div className="text-xs text-slate-500 space-y-0.5 bg-white rounded-lg px-4 py-3 border border-slate-100">
        <p className="font-medium text-slate-600 mb-1">登録状況</p>
        <p>トップス: {diagnostics.topsAll}点（気温対応: {diagnostics.topsInTemp}点）</p>
        <p>ワンピース: {diagnostics.dressesAll}点（気温対応: {diagnostics.dressesInTemp}点）</p>
        <p>ボトムス: {diagnostics.bottoms}点</p>
        {diagnostics.outersNeeded && <p>アウター: {diagnostics.outersAvailable}点</p>}
        <p>靴: {diagnostics.shoes}点</p>
      </div>
    </div>
  );
}

export default function Home() {
  const [maxTemp, setMaxTemp] = useState('');
  const [minTemp, setMinTemp] = useState('');
  const [selectedPurposes, setSelectedPurposes] = useState<string[]>([]);
  const [allPurposes, setAllPurposes] = useState<string[]>(DEFAULT_PURPOSES);
  const [record, setRecord] = useState<OutfitRecord | null>(null);
  const [fallbackLevel, setFallbackLevel] = useState<0 | 1 | 2>(0);
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // 案内パネル：初回は開いた状態、一度閉じると次回から閉じたまま
  const [infoOpen, setInfoOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('wardrobe:infoSeen') !== '1';
  });

  function toggleInfo() {
    const next = !infoOpen;
    setInfoOpen(next);
    if (!next) localStorage.setItem('wardrobe:infoSeen', '1');
  }

  useEffect(() => {
    const clothes: ClothingItem[] = storage.clothes.getAll();
    const custom = clothes.flatMap((c) => c.purposeTags ?? []);
    const merged = [...new Set([...DEFAULT_PURPOSES, ...custom])];
    setAllPurposes(merged);
  }, []);

  function togglePurpose(p: string) {
    setSelectedPurposes((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const clothes     = storage.clothes.getAll();
      const colorRules  = storage.colorRules.getAll();
      const pastRecords = storage.suggestions.getAll();

      const result = suggestOutfits({
        clothes,
        maxTemp:  Number(maxTemp),
        minTemp:  Number(minTemp),
        purposes: selectedPurposes,
        colorRules,
        pastRecords,
      });

      setFallbackLevel(result.fallbackLevel);
      setDiagnostics(result.diagnostics);

      // 写真を IndexedDB から読み込み、outfit に付与してから表示・保存する
      const photoMap = await photoStore.getAll();
      const addPhoto = (item: ClothingItem | undefined): ClothingItem | undefined => {
        if (!item) return undefined;
        const photoUrl = photoMap.get(item.id);
        return photoUrl ? { ...item, photoUrl } : item;
      };
      const outfitsWithPhotos = result.outfits.map((outfit) => ({
        ...outfit,
        top:       addPhoto(outfit.top),
        bottom:    addPhoto(outfit.bottom),
        dress:     addPhoto(outfit.dress),
        outer:     addPhoto(outfit.outer),
        shoes:     addPhoto(outfit.shoes),
        accessory: addPhoto(outfit.accessory),
      }));

      const newRecord: OutfitRecord = {
        id:        crypto.randomUUID(),
        date:      new Date().toISOString().slice(0, 10),
        maxTemp:   Number(maxTemp),
        minTemp:   Number(minTemp),
        purposes:  selectedPurposes,
        outfits:   outfitsWithPhotos,
        feedbacks: [],
        relaxed:   result.relaxed,
        createdAt: new Date().toISOString(),
      };

      storage.suggestions.create(newRecord);
      setRecord(newRecord);
    } catch {
      setError('提案の生成に失敗しました。服が登録されているか確認してください。');
    } finally {
      setLoading(false);
    }
  }

  function handleFeedback(outfitIndex: number, type: FeedbackType) {
    if (!record) return;
    const updated = storage.suggestions.toggleFeedback(record.id, outfitIndex, type);
    // storage から返るレコードは写真なし。feedbacks だけ更新し、
    // outfits（写真つき）は in-memory の record を維持して表示を壊さない。
    if (updated) setRecord({ ...record, feedbacks: updated.feedbacks });
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-4">今日のコーデを探す</h1>

      {/* 案内パネル */}
      <div className="bg-rose-50 border border-rose-100 rounded-2xl mb-6 overflow-hidden">
        <button
          type="button"
          onClick={toggleInfo}
          className="w-full flex items-center justify-between px-5 py-3.5 text-left"
        >
          <span className="text-sm font-semibold text-rose-700">💡 このアプリについて</span>
          <span className="text-rose-400 text-xs">{infoOpen ? '▲ 閉じる' : '▼ 開く'}</span>
        </button>
        {infoOpen && (
          <div className="px-5 pb-5 space-y-3 text-xs text-rose-900">
            <p className="leading-relaxed">
              このアプリは、AIが提案したコーディネートを参考に、楽しく時間をかけずに服選びをすることを目的としています。<br />
              「こんな組み合わせもあるんだ」「今日はこれをベースに考えてみよう」という
              <strong>アイディアやヒント</strong>として活用いただくことを想定しています。<br />
              また、AIの提案を参考にすることで、コーディネートのバリエーションとヘビロテ服を増やすことで、手持ちの服をより活用することを目指しています。
            </p>
            <div className="bg-white bg-opacity-60 rounded-xl px-4 py-3 space-y-2">
              <p className="font-semibold text-rose-800">おすすめの使い方</p>
              <ul className="space-y-1.5 text-rose-800">
                <li className="flex gap-2">
                  <span className="shrink-0">•</span>
                  <span>AIの提案をそのまま着る必要はありません。アイディアやヒントとしてお楽しみください。</span>
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0">•</span>
                  <span>最初はトップス・ボトムス・羽織りなど<strong>30着程度</strong>登録すると提案の幅が広がります。まずはよく着る服から登録し、隙間時間に少しずつ追加するのがおすすめです。</span>
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0">•</span>
                  <span><strong>100着以上</strong>登録すると提案の幅がぐっと広がります。</span>
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0">•</span>
                  <span>「こんな服持っていたんだ」「意外とこの組み合わせもありかも」と、新しい発見があるかもしれません。</span>
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-sm mb-6 space-y-4">
        {/* 気温 */}
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">最高気温 (°C)</label>
            <input type="number" value={maxTemp} onChange={(e) => setMaxTemp(e.target.value)}
              placeholder="例: 25" required
              className="w-28 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">最低気温 (°C)</label>
            <input type="number" value={minTemp} onChange={(e) => setMinTemp(e.target.value)}
              placeholder="例: 15" required
              className="w-28 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500" />
          </div>
        </div>

        {/* 用途タグ */}
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">
            今日はどんなシーン？
            <span className="text-slate-400 font-normal ml-1">（任意）</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {allPurposes.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => togglePurpose(p)}
                className={[
                  'px-3 py-1.5 rounded-full text-sm border transition-colors',
                  selectedPurposes.includes(p)
                    ? 'bg-rose-500 text-white border-rose-500'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                ].join(' ')}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <button type="submit" disabled={loading}
          className="bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300 text-white font-medium px-5 py-2 rounded-lg text-sm transition-colors">
          {loading ? '生成中...' : 'コーデを提案する'}
        </button>
      </form>

      {/* アンケート */}
      <p className="text-xs text-slate-400 text-center mt-3 mb-2">
        さらに役立つアプリにするため、
        <a
          href="https://forms.gle/aGWyWiP4eZL5bMTW7"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-slate-600"
        >
          アンケート
        </a>
        へのご協力をお願いします
      </p>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm p-4 rounded-lg mb-6">{error}</div>
      )}

      {record && (
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <p className="text-sm text-slate-500">{tempMessage(record.maxTemp, record.minTemp)}</p>
            {record.relaxed && (
              <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full">
                ⚠️ 色ルールの条件を少し緩めました
              </span>
            )}
            {fallbackLevel === 1 && (
              <span className="inline-flex items-center gap-1 text-xs bg-sky-50 text-sky-700 border border-sky-200 px-2.5 py-1 rounded-full">
                ℹ️ 気温の厚さ条件を緩めて提案しました
              </span>
            )}
            {fallbackLevel === 2 && (
              <span className="inline-flex items-center gap-1 text-xs bg-sky-50 text-sky-700 border border-sky-200 px-2.5 py-1 rounded-full">
                ℹ️ 厚さ・アウター条件を緩めて提案しました
              </span>
            )}
            {record.purposes.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {record.purposes.map((p) => (
                  <span key={p} className="text-xs bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full border border-rose-100">
                    {p}
                  </span>
                ))}
              </div>
            )}
          </div>

          {record.outfits.length === 0 ? (
            <NoOutfitMessage diagnostics={diagnostics} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {record.outfits.map((outfit, i) => (
                <OutfitCard
                  key={i}
                  outfit={outfit}
                  index={i}
                  feedbacks={record.feedbacks.filter((f) => f.outfitIndex === i).map((f) => f.type)}
                  onFeedback={(type) => handleFeedback(i, type)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

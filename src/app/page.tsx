'use client';
import { useEffect, useState } from 'react';
import { Sun, CalendarDays } from 'lucide-react';
import { ClothingItem, FeedbackType, OutfitRecord, DEFAULT_PURPOSES } from '@/types';
import { tempMessage, suggestOutfits, Diagnostics } from '@/lib/suggest';
import { storage } from '@/lib/clientStorage';
import { photoStore } from '@/lib/photoStore';
import OutfitCard from './OutfitCard';

function NoOutfitMessage({ diagnostics }: { diagnostics: Diagnostics | null }) {
  if (!diagnostics || diagnostics.totalClothes === 0) {
    return (
      <div className="text-center py-16 text-muted">
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
  // 天気取得
  const [weatherDay, setWeatherDay]   = useState<0 | 1 | null>(null); // null=非取得中
  const [weatherMsg, setWeatherMsg]   = useState('');
  const [weatherErr, setWeatherErr]   = useState('');
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

  // ── 天気取得 ─────────────────────────────────────────────────────────────────
  // Open-Meteo は無料・キーなし。位置情報はリクエスト後に保持しない。
  async function fetchWeather(dayOffset: 0 | 1) {
    setWeatherDay(dayOffset);
    setWeatherMsg('');
    setWeatherErr('');
    try {
      // 1. ブラウザの位置情報取得（ボタン押下時のみ求める）
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('このブラウザは位置情報に対応していません'));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, (err) => {
          reject(
            err.code === err.PERMISSION_DENIED
              ? new Error('位置情報の利用が拒否されました。ブラウザの設定をご確認ください。')
              : new Error('位置情報を取得できませんでした')
          );
        }, { timeout: 10000 });
      });

      // 2. Open-Meteo で今日・明日の最高/最低気温を取得
      const { latitude, longitude } = position.coords;
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${latitude.toFixed(4)}&longitude=${longitude.toFixed(4)}` +
        `&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=2`
      );
      if (!res.ok) throw new Error('天気データの取得に失敗しました');

      const data = await res.json() as {
        daily: { temperature_2m_max: number[]; temperature_2m_min: number[] };
      };
      const max = Math.round(data.daily.temperature_2m_max[dayOffset]);
      const min = Math.round(data.daily.temperature_2m_min[dayOffset]);

      // 3. 気温欄に自動入力（ユーザーは後から修正可能）
      setMaxTemp(String(max));
      setMinTemp(String(min));
      setWeatherMsg(
        `現在地の${dayOffset === 0 ? '今日' : '明日'}の気温を入力しました（最高 ${max}°C・最低 ${min}°C）`
      );
    } catch (err) {
      setWeatherErr(
        err instanceof Error
          ? err.message
          : '気温の取得に失敗しました。手動で入力してください。'
      );
    } finally {
      setWeatherDay(null);
    }
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
      <h1 className="text-xl font-medium text-ink mb-4 tracking-wide">今日のコーデを探す</h1>

      {/* 案内パネル */}
      <div className="bg-navy-soft border border-[#D6DCE8] rounded-2xl mb-6 overflow-hidden">
        <button
          type="button"
          onClick={toggleInfo}
          className="w-full flex items-center justify-between px-5 py-3.5 text-left"
        >
          <span className="text-sm font-medium text-navy tracking-wide">このアプリについて</span>
          <span className="text-muted text-xs">{infoOpen ? '▲ 閉じる' : '▼ 開く'}</span>
        </button>
        {infoOpen && (
          <div className="px-5 pb-5 space-y-3 text-xs text-navy">
            <p className="leading-relaxed text-secondary">
              AIが提案するコーディネートを参考に、楽しく時間をかけずに服選びを。<br />
              「こんな組み合わせもあるんだ」「今日はこれをベースに」という
              <strong className="text-navy">アイディアやヒント</strong>としてご活用ください。
            </p>
            <div className="bg-cream rounded-xl px-4 py-3 space-y-2 border border-border-w">
              <p className="font-medium text-navy text-[11px] tracking-wide">おすすめの使い方</p>
              <ul className="space-y-1.5 text-secondary">
                <li className="flex gap-2">
                  <span className="shrink-0 text-greige">—</span>
                  <span>AIの提案をそのまま着る必要はありません。ヒントとしてお楽しみください。</span>
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0 text-greige">—</span>
                  <span>最初は<strong className="text-ink">30着程度</strong>登録すると提案の幅が広がります。</span>
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0 text-greige">—</span>
                  <span><strong className="text-ink">100着以上</strong>登録すると提案の幅がぐっと広がります。</span>
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="bg-cream rounded-2xl p-6 border border-border-w shadow-[0_2px_12px_rgba(36,51,82,0.07)] mb-6 space-y-4">
        {/* 気温 */}
        <div className="space-y-2">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">最高気温 (°C)</label>
              <input type="number" value={maxTemp}
                onChange={(e) => { setMaxTemp(e.target.value); setWeatherMsg(''); }}
                placeholder="例: 25" required
                className="w-28 border border-border-mid rounded-lg px-3 py-2 text-sm bg-ivory focus:outline-none focus:ring-2 focus:ring-navy/40" />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">最低気温 (°C)</label>
              <input type="number" value={minTemp}
                onChange={(e) => { setMinTemp(e.target.value); setWeatherMsg(''); }}
                placeholder="例: 15" required
                className="w-28 border border-border-mid rounded-lg px-3 py-2 text-sm bg-ivory focus:outline-none focus:ring-2 focus:ring-navy/40" />
            </div>
          </div>
          {/* 天気取得ボタン */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted">天気から自動入力:</span>
            {([0, 1] as const).map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => fetchWeather(day)}
                disabled={weatherDay !== null}
                className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border border-border-mid text-navy hover:bg-ivory-dark disabled:opacity-40 transition-colors"
              >
                {day === 0
                  ? <Sun size={11} strokeWidth={1.5} />
                  : <CalendarDays size={11} strokeWidth={1.5} />}
                {weatherDay === day ? '取得中…' : day === 0 ? '今日' : '明日'}
              </button>
            ))}
          </div>
          {weatherErr && <p className="text-xs text-red-500">{weatherErr}</p>}
          {weatherMsg && <p className="text-xs text-emerald-600">✓ {weatherMsg}</p>}
        </div>

        {/* 用途タグ */}
        <div>
          <p className="text-sm font-medium text-secondary mb-2">
            今日はどんなシーン？
            <span className="text-muted font-normal ml-1">（任意）</span>
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
                    ? 'bg-navy text-white border-navy'
                    : 'border-border-w text-secondary hover:bg-ivory-dark',
                ].join(' ')}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <button type="submit" disabled={loading}
          className="bg-navy hover:bg-navy-dim disabled:opacity-40 text-white font-medium px-5 py-2 rounded-lg text-sm transition-colors">
          {loading ? '生成中...' : 'コーデを提案する'}
        </button>
      </form>

      {/* アンケート */}
      <p className="text-xs text-muted text-center mt-3 mb-2">
        さらに役立つアプリにするため、
        <a
          href="https://forms.gle/aGWyWiP4eZL5bMTW7"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-secondary"
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
            <p className="text-sm text-secondary">{tempMessage(record.maxTemp, record.minTemp)}</p>
            {record.relaxed && (
              <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full">
                色ルールの条件を少し緩めました
              </span>
            )}
            {fallbackLevel === 1 && (
              <span className="inline-flex items-center gap-1 text-xs bg-navy-soft text-navy border border-[#D6DCE8] px-2.5 py-1 rounded-full">
                気温の厚さ条件を緩めて提案しました
              </span>
            )}
            {fallbackLevel === 2 && (
              <span className="inline-flex items-center gap-1 text-xs bg-navy-soft text-navy border border-[#D6DCE8] px-2.5 py-1 rounded-full">
                厚さ・アウター条件を緩めて提案しました
              </span>
            )}
            {record.purposes.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {record.purposes.map((p) => (
                  <span key={p} className="text-xs bg-navy-soft text-navy px-2 py-0.5 rounded-full border border-[#D6DCE8]">
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

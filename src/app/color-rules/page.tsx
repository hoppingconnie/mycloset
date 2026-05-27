'use client';
import { useEffect, useState } from 'react';
import { ColorRule, ColorRuleType, COLOR_RULE_LABELS } from '@/types';
import { storage } from '@/lib/clientStorage';

const TYPE_OPTIONS: { value: ColorRuleType; label: string; icon: string; example: string }[] = [
  { value: 'avoid_pair',    label: '避けたい組み合わせ', icon: '🚫', example: '例: 黒 × 紺' },
  { value: 'like_pair',     label: '好きな組み合わせ',   icon: '♡',  example: '例: 白 × ベージュ' },
  { value: 'avoid_overall', label: '避けたい全体印象',   icon: '⚠️', example: '例: 全身黒 → 「黒」だけ登録' },
];

const RULE_CONNECTOR: Record<ColorRuleType, string> = {
  avoid_pair:    '×',
  like_pair:     '♡',
  avoid_overall: '+',
};

export default function ColorRulesPage() {
  const [rules, setRules]               = useState<ColorRule[]>([]);
  const [ruleType, setRuleType]         = useState<ColorRuleType>('avoid_pair');
  const [pairColors, setPairColors]     = useState(['', '']);
  const [overallColors, setOverallColors] = useState<string[]>([]);
  const [overallInput, setOverallInput] = useState('');
  const [note, setNote]                 = useState('');
  const [submitting, setSubmitting]     = useState(false);
  const [formError, setFormError]       = useState('');

  useEffect(() => {
    setRules(storage.colorRules.getAll());
  }, []);

  function handleTypeChange(t: ColorRuleType) {
    setRuleType(t);
    setFormError('');
    if (t !== 'avoid_overall') {
      setPairColors(['', '']);
    } else {
      setOverallColors([]);
      setOverallInput('');
    }
  }

  function addOverallColor() {
    const v = overallInput.trim();
    if (v && !overallColors.includes(v)) setOverallColors((p) => [...p, v]);
    setOverallInput('');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    const isPair  = ruleType !== 'avoid_overall';
    const colors  = isPair ? pairColors.map((c) => c.trim()).filter(Boolean) : overallColors;

    if (isPair  && colors.length < 2) { setFormError('色を2つ入力してください'); return; }
    if (!isPair && colors.length < 1) { setFormError('色を1つ以上追加してください'); return; }

    setSubmitting(true);
    try {
      const rule: ColorRule = {
        id:        crypto.randomUUID(),
        type:      ruleType,
        colors,
        note:      note.trim() || undefined,
        createdAt: new Date().toISOString(),
      };
      storage.colorRules.create(rule);
      setRules(storage.colorRules.getAll());
      setPairColors(['', '']);
      setOverallColors([]);
      setOverallInput('');
      setNote('');
    } catch {
      setFormError('保存に失敗しました');
    } finally {
      setSubmitting(false);
    }
  }

  function handleDelete(id: string) {
    if (!confirm('このルールを削除しますか？')) return;
    storage.colorRules.delete(id);
    setRules((prev) => prev.filter((r) => r.id !== id));
  }

  const rulesByType = (type: ColorRuleType) => rules.filter((r) => r.type === type);
  const inp = 'border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500';

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">色の相性ルール</h1>

      <div className="bg-white rounded-2xl p-6 shadow-sm mb-8">
        <h2 className="text-base font-semibold text-slate-800 mb-4">ルールを追加</h2>

        <div className="flex flex-wrap gap-2 mb-4">
          {TYPE_OPTIONS.map(({ value, label, icon }) => (
            <button key={value} type="button" onClick={() => handleTypeChange(value)}
              className={[
                'px-3 py-1.5 rounded-full text-sm border transition-colors font-medium',
                ruleType === value
                  ? 'bg-rose-500 text-white border-rose-500'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50',
              ].join(' ')}>
              {icon} {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {formError && <p className="text-sm text-red-500">{formError}</p>}

          {ruleType !== 'avoid_overall' ? (
            <div className="flex items-center gap-2">
              <input value={pairColors[0]} onChange={(e) => setPairColors([e.target.value, pairColors[1]])}
                placeholder="色1 (例: 黒)" className={`${inp} flex-1`} />
              <span className="text-slate-400 font-bold">{RULE_CONNECTOR[ruleType]}</span>
              <input value={pairColors[1]} onChange={(e) => setPairColors([pairColors[0], e.target.value])}
                placeholder="色2 (例: 紺)" className={`${inp} flex-1`} />
            </div>
          ) : (
            <div>
              <div className="flex gap-2 mb-2">
                <input value={overallInput} onChange={(e) => setOverallInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOverallColor(); } }}
                  placeholder="色を追加 (例: 黒)" className={`${inp} flex-1`} />
                <button type="button" onClick={addOverallColor}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                  追加
                </button>
              </div>
              {overallColors.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {overallColors.map((c) => (
                    <span key={c} className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-xs border border-slate-200">
                      {c}
                      <button type="button" onClick={() => setOverallColors((p) => p.filter((x) => x !== c))}
                        className="text-slate-400 hover:text-red-500">×</button>
                    </span>
                  ))}
                </div>
              )}
              <p className="text-xs text-slate-400 mt-1">
                {TYPE_OPTIONS.find((o) => o.value === ruleType)?.example}
              </p>
            </div>
          )}

          <input value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="メモ (任意)" className={`${inp} w-full`} />

          <button type="submit" disabled={submitting}
            className="bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors">
            {submitting ? '保存中...' : '追加する'}
          </button>
        </form>
      </div>

      {rules.length === 0 ? (
        <p className="text-center text-slate-400 py-8 text-sm">ルールはまだ登録されていません</p>
      ) : (
        <div className="space-y-6">
          {TYPE_OPTIONS.map(({ value, label, icon }) => {
            const group = rulesByType(value);
            if (group.length === 0) return null;
            return (
              <div key={value}>
                <h3 className="text-sm font-semibold text-slate-500 mb-2">{icon} {label} ({group.length}件)</h3>
                <div className="space-y-2">
                  {group.map((rule) => (
                    <div key={rule.id} className="bg-white rounded-xl px-4 py-3 shadow-sm flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        {rule.type !== 'avoid_overall' ? (
                          <>
                            <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full text-sm font-medium">{rule.colors[0]}</span>
                            <span className="text-slate-400 font-bold text-sm">{RULE_CONNECTOR[rule.type]}</span>
                            <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full text-sm font-medium">{rule.colors[1]}</span>
                          </>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {rule.colors.map((c, i) => (
                              <span key={i} className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full text-sm font-medium">{c}</span>
                            ))}
                          </div>
                        )}
                        {rule.note && <span className="text-xs text-slate-400 ml-1">{rule.note}</span>}
                      </div>
                      <button onClick={() => handleDelete(rule.id)}
                        className="flex-shrink-0 text-xs text-red-400 hover:text-red-600 border border-red-200 hover:bg-red-50 px-2.5 py-1 rounded-lg transition-colors">
                        削除
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

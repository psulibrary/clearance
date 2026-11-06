'use client';

import { useEffect, useState } from 'react';
import ChartCard from '@/components/ChartCard';
import ApiChart, { toRows, type Dataset } from '@/components/ApiChart';
import HeatmapGrid from '@/components/HeatmapGrid';

/** Library attendance statistics from stat.palawansulibrary.com, through /api/stat/* (which holds the key). */
type Meta = { source?: 'cache'; asOf?: string; error?: string };
interface Summary extends Meta {
  totals?: { today: number; this_week: number; this_month: number; all_time: number };
  in_period?: { visits: number; unique_visitors: number; avg_visits_per_visitor: number; busiest_day: string | null; busiest_hour: string | null };
}
interface Heatmap extends Meta { days?: string[]; hours?: number[]; matrix?: number[][]; max?: number; title?: string; note?: string }
interface Options extends Meta { colleges?: string[] }
type Chart = Dataset & Meta;

type RangeId = '30d' | '90d' | '12m' | 'year' | 'all';
const RANGES: { id: RangeId; label: string }[] = [
  { id: '30d', label: '30 days' }, { id: '90d', label: '90 days' }, { id: '12m', label: '12 months' }, { id: 'year', label: 'This year' }, { id: 'all', label: 'All time' },
];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function rangeParams(id: RangeId): string {
  const to = new Date(); const from = new Date();
  if (id === '30d') from.setDate(from.getDate() - 29);
  else if (id === '90d') from.setDate(from.getDate() - 89);
  else if (id === '12m') from.setFullYear(from.getFullYear() - 1);
  else if (id === 'year') from.setMonth(0, 1);
  else from.setFullYear(2025, 0, 1); // attendance records start in January 2025
  return `from=${iso(from)}&to=${iso(to)}`;
}

async function load<T>(path: string): Promise<T> {
  const res = await fetch(path);
  return (await res.json().catch(() => ({ error: `Unexpected answer (${res.status})` }))) as T;
}

function Card({ ds, filename }: { ds: Chart; filename: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <h3 className="text-sm font-semibold text-gray-700">{ds.title}</h3>
      {ds.note && <p className="text-xs text-gray-400 mb-3">{ds.note}</p>}
      <ChartCard filename={filename} data={toRows(ds)}><ApiChart ds={ds} /></ChartCard>
    </div>
  );
}

const BREAKDOWNS: { group: string; file: string }[] = [
  { group: 'college', file: 'college' }, { group: 'program', file: 'program' }, { group: 'facility', file: 'facility' }, { group: 'purpose', file: 'purpose' },
];

export default function AttendanceTab({ active }: { active: boolean }) {
  const [range, setRange] = useState<RangeId>('90d');
  const [college, setCollege] = useState('');
  const [options, setOptions] = useState<Options | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [trend, setTrend] = useState<Chart | null>(null);
  const [yearly, setYearly] = useState<Chart | null>(null);
  const [heatmap, setHeatmap] = useState<Heatmap | null>(null);
  const [breakdowns, setBreakdowns] = useState<Record<string, Chart>>({});

  useEffect(() => {
    if (!active || options) return;
    let stop = false;
    load<Options>('/api/stat/options').then(d => { if (!stop) setOptions(d); });
    return () => { stop = true; };
  }, [active, options]);

  useEffect(() => {
    if (!active) return;
    let stop = false;
    const q = `${rangeParams(range)}${college ? `&college=${encodeURIComponent(college)}` : ''}`;
    load<Summary>(`/api/stat/summary?${q}`).then(d => { if (!stop) setSummary(d); });
    load<Chart>(`/api/stat/trend?${q}`).then(d => { if (!stop) setTrend(d); });
    load<Heatmap>(`/api/stat/heatmap?${q}`).then(d => { if (!stop) setHeatmap(d); });
    load<Chart>(`/api/stat/yearly?years=2${college ? `&college=${encodeURIComponent(college)}` : ''}`).then(d => { if (!stop) setYearly(d); });
    for (const b of BREAKDOWNS) {
      // a college breakdown is pointless once a college is chosen
      if (b.group === 'college' && college) continue;
      load<Chart>(`/api/stat/breakdown?${q}&group_by=${b.group}&limit=15`).then(d => { if (!stop) setBreakdowns(prev => ({ ...prev, [b.group]: d })); });
    }
    return () => { stop = true; };
  }, [active, range, college]);

  const all = [summary, trend, yearly, heatmap, ...Object.values(breakdowns)];
  const error = all.find(d => d?.error)?.error;
  const stale = all.find(d => d?.source === 'cache');
  const t = summary?.totals, p = summary?.in_period;
  const kpis: [string, string][] = t && p ? [
    ['Visits today', t.today.toLocaleString()], ['Visits this week', t.this_week.toLocaleString()], ['Visits this month', t.this_month.toLocaleString()], ['All-time visits', t.all_time.toLocaleString()],
    ['Visits in period', p.visits.toLocaleString()], ['Unique visitors', p.unique_visitors.toLocaleString()], ['Visits per visitor', String(p.avg_visits_per_visitor)], ['Busiest', [p.busiest_day, p.busiest_hour].filter(Boolean).join(' · ') || '—'],
  ] : [];

  function pick(id: RangeId) { if (id !== range) { setSummary(null); setTrend(null); setHeatmap(null); setBreakdowns({}); setRange(id); } }
  function pickCollege(c: string) { if (c !== college) { setSummary(null); setTrend(null); setHeatmap(null); setYearly(null); setBreakdowns({}); setCollege(c); } }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-800 mb-1">Library Attendance</h2>
          <p className="text-sm text-gray-500">Visits recorded by the library attendance system at stat.palawansulibrary.com. Totals only, never visitor names or ID numbers.</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 print:hidden">
          <select value={college} onChange={e => pickCollege(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600">
            <option value="">All colleges</option>
            {(options?.colleges ?? []).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {RANGES.map(r => (
            <button key={r.id} type="button" onClick={() => pick(r.id)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${range === r.id ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>{r.label}</button>
          ))}
        </div>
      </div>

      {error && <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm"><strong>Could not load attendance data.</strong> {error}</div>}
      {stale && <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-800 text-xs">The stats site is unreachable, showing the last saved data{stale.asOf ? ` from ${new Date(stale.asOf).toLocaleString()}` : ''}.</div>}
      {!summary && !error && <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-6 text-blue-800 text-sm">Loading…</div>}

      {kpis.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {kpis.map(([label, value]) => (
            <div key={label} className="bg-white rounded-xl shadow-sm p-5">
              <div className="text-xs text-gray-500">{label}</div>
              <div className="text-xl font-bold text-gray-800">{value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
        {trend && !trend.error && <div className="xl:col-span-2"><Card ds={trend} filename="attendance-visits-over-time" /></div>}
        {yearly && !yearly.error && <Card ds={yearly} filename="attendance-yearly-visits" />}
        {heatmap && !heatmap.error && (
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700">{heatmap.title}</h3>
            {heatmap.note && <p className="text-xs text-gray-400 mb-3">{heatmap.note}</p>}
            <HeatmapGrid days={heatmap.days ?? []} hours={heatmap.hours ?? []} matrix={heatmap.matrix ?? []} max={heatmap.max ?? 1} noun="visits" />
          </div>
        )}
        {BREAKDOWNS.map(b => breakdowns[b.group] && !breakdowns[b.group].error && <Card key={b.group} ds={breakdowns[b.group]} filename={`attendance-by-${b.file}`} />)}
      </div>
    </div>
  );
}

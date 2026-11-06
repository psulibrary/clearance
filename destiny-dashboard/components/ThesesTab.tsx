'use client';

import { useEffect, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import ChartCard from '@/components/ChartCard';

/** One chart as the ThesesVault API describes it: the page only has to draw it. */
interface Dataset {
  title: string;
  note?: string;
  type: 'bar' | 'hbar' | 'line' | 'doughnut' | 'stacked';
  labels: string[];
  series: { name: string; data: number[] }[];
}
type Range = '30d' | '90d' | '12m' | 'all';
type Meta = { source?: 'cache'; asOf?: string; error?: string };
interface Insights extends Meta { range?: { from: string; to: string }; kpis?: Record<string, number>; datasets?: Record<string, Dataset | null> }
interface DemandRow { id: number; filename: string; n?: number; privacy?: string; callno?: string; program?: string; adviser?: string; campus?: string; college_name?: string; date_published?: string }
interface Demand extends Meta { demand?: { requested: DemandRow[]; bookmarked: DemandRow[]; neverViewed: { count: number; rows: DemandRow[] } } }
interface Collection extends Meta {
  total_theses?: number;
  programs_by_college?: { columns: string[]; rows: Record<string, Record<string, number>>; totals: Record<string, number> };
  data_health?: { key: string; label: string; count: number }[];
}

const COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#ea580c', '#475569', '#0d9488', '#9333ea'];
const RANGES: { id: Range; label: string }[] = [
  { id: '30d', label: '30 days' }, { id: '90d', label: '90 days' }, { id: '12m', label: '12 months' }, { id: 'all', label: 'All time' },
];

const short = (s: string, n = 34) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function toRows(ds: Dataset): Record<string, unknown>[] {
  return ds.labels.map((label, i) => {
    const row: Record<string, unknown> = { label };
    for (const s of ds.series) row[s.name] = s.data[i] ?? 0;
    return row;
  });
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'chart';
}

/** Draws any dataset of the ThesesVault API (bar, horizontal bar, line, doughnut or stacked bars). */
function ThesesChart({ ds }: { ds: Dataset }) {
  const rows = toRows(ds);
  const names = ds.series.map(s => s.name);
  if (rows.length === 0) return <p className="text-sm text-gray-400 py-10 text-center">No data for this period.</p>;

  if (ds.type === 'doughnut') {
    const first = names[0];
    return (
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie data={rows} dataKey={first} nameKey="label" innerRadius={60} outerRadius={105} paddingAngle={1}>
            {rows.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }
  if (ds.type === 'line') {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip />
          {names.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
          {names.map((n, i) => <Line key={n} type="monotone" dataKey={n} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 2 }} />)}
        </LineChart>
      </ResponsiveContainer>
    );
  }
  if (ds.type === 'hbar') {
    return (
      <ResponsiveContainer width="100%" height={Math.max(240, rows.length * 32 + 40)}>
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
          <YAxis type="category" dataKey="label" width={230} tick={{ fontSize: 11 }} tickFormatter={(v: string) => short(String(v), 36)} interval={0} />
          <Tooltip />
          {names.map((n, i) => <Bar key={n} dataKey={n} fill={COLORS[i % COLORS.length]} radius={[0, 4, 4, 0]} />)}
        </BarChart>
      </ResponsiveContainer>
    );
  }
  // 'bar' and 'stacked'
  const stacked = ds.type === 'stacked';
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={rows.length > 14 ? 1 : 0} tickFormatter={(v: string) => short(String(v), 14)} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip />
        {(stacked || names.length > 1) && <Legend wrapperStyle={{ fontSize: 11 }} />}
        {names.map((n, i) => <Bar key={n} dataKey={n} stackId={stacked ? 'a' : undefined} fill={COLORS[i % COLORS.length]} radius={stacked ? 0 : [4, 4, 0, 0]} />)}
      </BarChart>
    </ResponsiveContainer>
  );
}

function Card({ ds, filename }: { ds: Dataset; filename: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <h3 className="text-sm font-semibold text-gray-700">{ds.title}</h3>
      {ds.note && <p className="text-xs text-gray-400 mb-3">{ds.note}</p>}
      <ChartCard filename={filename} data={toRows(ds)}><ThesesChart ds={ds} /></ChartCard>
    </div>
  );
}

function TitleList({ title, note, rows, unit }: { title: string; note: string; rows: DemandRow[]; unit: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      <p className="text-xs text-gray-400 mb-3">{note}</p>
      {rows.length === 0 ? <p className="text-sm text-gray-400">Nothing yet for this period.</p> : (
        <ol className="space-y-1.5 text-sm">
          {rows.map((r, i) => (
            <li key={`${r.id}-${i}`} className="flex gap-3 items-baseline">
              <span className="text-gray-400 w-5 text-right shrink-0">{i + 1}</span>
              <span className="flex-1 text-gray-700">{r.filename}</span>
              {r.n != null && <span className="text-xs font-semibold text-blue-700 whitespace-nowrap">{r.n} {unit}</span>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

async function load<T>(path: string): Promise<T> {
  const res = await fetch(path);
  const body = await res.json().catch(() => ({ error: `Unexpected answer (${res.status})` }));
  return body as T;
}

/** The "Theses" tab: charts and lists built from the ThesesVault API (through /api/theses/*, which holds the key). */
export default function ThesesTab({ active }: { active: boolean }) {
  const [range, setRange] = useState<Range>('90d');
  const [insights, setInsights] = useState<Insights | null>(null);
  const [demand, setDemand] = useState<Demand | null>(null);
  const [collection, setCollection] = useState<Collection | null>(null);

  useEffect(() => {
    if (!active) return;
    let stop = false;
    load<Insights>(`/api/theses/insights?range=${range}`).then(d => { if (!stop) setInsights(d); });
    load<Demand>(`/api/theses/demand?range=${range}`).then(d => { if (!stop) setDemand(d); });
    return () => { stop = true; };
  }, [active, range]);

  useEffect(() => {
    if (!active || collection) return;
    let stop = false;
    load<Collection>('/api/theses/collection').then(d => { if (!stop) setCollection(d); });
    return () => { stop = true; };
  }, [active, collection]);

  const error = insights?.error || demand?.error || collection?.error;
  const stale = [insights, demand, collection].find(d => d?.source === 'cache');
  const sets = Object.entries(insights?.datasets ?? {}).filter((e): e is [string, Dataset] => !!e[1]);
  const matrix = collection?.programs_by_college;
  const maxHealth = Math.max(1, ...(collection?.data_health ?? []).map(h => h.count));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-800 mb-1">ThesesVault</h2>
          <p className="text-sm text-gray-500">Thesis and dissertation collection figures, live from the ThesesVault API.</p>
        </div>
        <div className="flex gap-1.5 print:hidden">
          {RANGES.map(r => (
            <button key={r.id} type="button" onClick={() => { if (r.id !== range) { setInsights(null); setDemand(null); setRange(r.id); } }}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${range === r.id ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm"><strong>Could not load ThesesVault data.</strong> {error}</div>}
      {stale && <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-800 text-xs">ThesesVault is unreachable, showing the last saved data{stale.asOf ? ` from ${new Date(stale.asOf).toLocaleString()}` : ''}.</div>}
      {!insights && !error && <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-6 text-blue-800 text-sm">Loading…</div>}

      {insights?.kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {Object.entries(insights.kpis).map(([label, value]) => (
            <div key={label} className="bg-white rounded-xl shadow-sm p-5">
              <div className="text-xs text-gray-500">{label}</div>
              <div className="text-2xl font-bold text-gray-800">{Number(value ?? 0).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}

      {sets.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
          {sets.map(([key, ds]) => (
            <div key={key} className={ds.type === 'stacked' || ds.labels.length > 24 ? 'xl:col-span-2' : ''}>
              <Card ds={ds} filename={`thesesvault-${slug(key)}`} />
            </div>
          ))}
        </div>
      )}

      {demand?.demand && (
        <div className="mb-8">
          <h3 className="text-base font-bold text-gray-800 mb-3">Demand</h3>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <TitleList title="Most requested" note="Requests in the selected period" rows={demand.demand.requested} unit="requests" />
            <TitleList title="Most bookmarked" note="Bookmarks in the selected period" rows={demand.demand.bookmarked} unit="bookmarks" />
          </div>
          <div className="bg-white rounded-xl shadow-sm p-5 mt-6">
            <h3 className="text-sm font-semibold text-gray-700">Never viewed</h3>
            <p className="text-xs text-gray-400 mb-3">{demand.demand.neverViewed.count.toLocaleString()} theses have never been opened. Newest {demand.demand.neverViewed.rows.length}:</p>
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-100"><th className="py-1.5 pr-3">Title</th><th className="pr-3">College</th><th className="pr-3">Program</th><th>Year</th></tr></thead>
              <tbody>{demand.demand.neverViewed.rows.map(r => (
                <tr key={r.id} className="border-b border-gray-50"><td className="py-1.5 pr-3">{r.filename}</td><td className="pr-3 text-xs">{r.college_name}</td><td className="pr-3 text-xs">{r.program}</td><td className="text-xs">{r.date_published?.slice(0, 4)}</td></tr>
              ))}</tbody>
            </table></div>
          </div>
        </div>
      )}

      {collection && !collection.error && (
        <div className="mb-8">
          <h3 className="text-base font-bold text-gray-800 mb-3">Collection <span className="text-sm font-normal text-gray-500">· {collection.total_theses?.toLocaleString()} theses</span></h3>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {matrix && (
              <div className="bg-white rounded-xl shadow-sm p-5 xl:col-span-2">
                <h3 className="text-sm font-semibold text-gray-700">Theses per program</h3>
                <p className="text-xs text-gray-400 mb-3">Split by college or campus</p>
                <ChartCard filename="thesesvault-theses-per-program"
                  data={Object.entries(matrix.rows).map(([program, cells]) => ({ program, ...cells }))}>
                  <ResponsiveContainer width="100%" height={Math.max(300, Object.keys(matrix.rows).length * 26 + 60)}>
                    <BarChart layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}
                      data={Object.entries(matrix.rows).map(([program, cells]) => ({ program, ...cells }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <YAxis type="category" dataKey="program" width={230} tick={{ fontSize: 11 }} tickFormatter={(v: string) => short(String(v), 36)} interval={0} />
                      <Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />
                      {matrix.columns.map((c, i) => <Bar key={c} dataKey={c} stackId="a" fill={COLORS[i % COLORS.length]} />)}
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            )}
            {collection.data_health && (
              <div className="bg-white rounded-xl shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-700">Data health</h3>
                <p className="text-xs text-gray-400 mb-3">Theses with a missing or inconsistent detail</p>
                <ul className="space-y-2 text-sm">
                  {collection.data_health.map(h => (
                    <li key={h.key}>
                      <div className="flex justify-between"><span className="text-gray-700">{h.label}</span><span className={`font-semibold ${h.count ? 'text-amber-700' : 'text-emerald-600'}`}>{h.count.toLocaleString()}</span></div>
                      <div className="h-1.5 bg-gray-100 rounded"><div className={`h-1.5 rounded ${h.count ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${(h.count / maxHealth) * 100}%` }} /></div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

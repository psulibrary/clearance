'use client';

import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

/** One chart as the ThesesVault and attendance APIs describe it: the page only has to draw it. */
export interface Dataset {
  title: string;
  note?: string;
  type: 'bar' | 'hbar' | 'line' | 'doughnut' | 'stacked';
  labels: string[];
  series: { name: string; data: (number | null)[] }[];
}

export const COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#ea580c', '#475569', '#0d9488', '#9333ea'];

export const short = (s: string, n = 34) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function toRows(ds: Dataset): Record<string, unknown>[] {
  return ds.labels.map((label, i) => {
    const row: Record<string, unknown> = { label };
    for (const s of ds.series) row[s.name] = s.data[i] ?? (ds.type === 'line' ? null : 0);
    return row;
  });
}

export function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'chart';
}

/** Draws any chart dataset of the ThesesVault / library attendance APIs (bar, horizontal bar, line, doughnut or stacked bars). */
export default function ApiChart({ ds }: { ds: Dataset }) {
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


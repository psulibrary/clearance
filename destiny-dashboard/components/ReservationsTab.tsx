'use client';

import { useEffect, useState } from 'react';
import ChartCard from '@/components/ChartCard';
import ApiChart, { toRows, type Dataset } from '@/components/ApiChart';
import HeatmapGrid from '@/components/HeatmapGrid';

/** Room and equipment reservations: usage, demand and recommendations from the reservation site, through /api/reservations/* (which holds the key). */
type Meta = { source?: 'cache'; asOf?: string; error?: string };
interface Finding { level: 'warning' | 'info' | 'good'; title: string; detail: string; action: string }
interface Room { name: string; bookings: number; hours: number; utilization: number; seats: number; median_attendees: number | null }
interface Charts extends Meta {
  kpis?: Record<string, number>;
  datasets?: Record<string, Dataset>;
  heatmap?: { title: string; note?: string; days: string[]; hours: number[]; matrix: number[][]; max: number };
  rooms?: Room[];
  pending?: { count: number; stale: number; past_start: number; future: number };
  cancellations?: { count: number; late: number; early: number };
  insights?: Finding[];
}
interface Info extends Meta { resources?: { id: number; name: string }[] }

type RangeId = '30d' | '90d' | '12m' | 'ytd' | 'all';
const RANGES: { id: RangeId; label: string }[] = [
  { id: '30d', label: '30 days' }, { id: '90d', label: '90 days' }, { id: '12m', label: '12 months' }, { id: 'ytd', label: 'This year' }, { id: 'all', label: 'All time' },
];
const ORDER = ['monthly_bookings', 'monthly_hours', 'room_utilization', 'requesting_units', 'weekday', 'booking_length', 'lead_time', 'equipment'];
const WIDE = new Set(['monthly_bookings']);
const SHOWN_KPIS = ['Bookings', 'Booked hours', 'Utilization (%)', 'Average booking (hours)', 'Booking accounts', 'Median lead time (days)', 'Cancellation rate (%)', 'Waiting for approval'];
const BORDER = { warning: 'border-amber-400 bg-amber-50', info: 'border-blue-300 bg-blue-50', good: 'border-emerald-400 bg-emerald-50' } as const;

async function load<T>(path: string): Promise<T> {
  const res = await fetch(path);
  return (await res.json().catch(() => ({ error: `Unexpected answer (${res.status})` }))) as T;
}

export default function ReservationsTab({ active }: { active: boolean }) {
  const [range, setRange] = useState<RangeId>('12m');
  const [room, setRoom] = useState('');
  const [info, setInfo] = useState<Info | null>(null);
  const [data, setData] = useState<Charts | null>(null);

  useEffect(() => {
    if (!active || info) return;
    let stop = false;
    load<Info>('/api/reservations/meta').then(d => { if (!stop) setInfo(d); });
    return () => { stop = true; };
  }, [active, info]);

  useEffect(() => {
    if (!active) return;
    let stop = false;
    load<Charts>(`/api/reservations/charts?range=${range}${room ? `&resource=${room}` : ''}`).then(d => { if (!stop) setData(d); });
    return () => { stop = true; };
  }, [active, range, room]);

  const error = data?.error || info?.error;
  const stale = [data, info].find(d => d?.source === 'cache');
  const sets = ORDER.map(k => [k, data?.datasets?.[k]] as const).filter((e): e is [string, Dataset] => !!e[1]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-800 mb-1">Room Reservations</h2>
          <p className="text-sm text-gray-500">Bookings of the function room, discussion room and American Corner, from the library reservation system. Totals only, never names.</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 print:hidden">
          <select value={room} onChange={e => { setData(null); setRoom(e.target.value); }} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600">
            <option value="">All rooms</option>
            {(info?.resources ?? []).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          {RANGES.map(r => (
            <button key={r.id} type="button" onClick={() => { if (r.id !== range) { setData(null); setRange(r.id); } }}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${range === r.id ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>{r.label}</button>
          ))}
        </div>
      </div>

      {error && <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm"><strong>Could not load reservation data.</strong> {error}</div>}
      {stale && <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-800 text-xs">The reservation site is unreachable, showing the last saved data{stale.asOf ? ` from ${new Date(stale.asOf).toLocaleString()}` : ''}.</div>}
      {!data && !error && <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-6 text-blue-800 text-sm">Loading…</div>}

      {data?.kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {SHOWN_KPIS.filter(k => k in data.kpis!).map(k => (
            <div key={k} className={`bg-white rounded-xl shadow-sm p-5 ${k === 'Waiting for approval' && (data.kpis![k] ?? 0) > 0 ? 'ring-1 ring-red-200' : ''}`}>
              <div className="text-xs text-gray-500">{k}</div>
              <div className="text-xl font-bold text-gray-800">{Number(data.kpis![k]).toLocaleString()}</div>
              {k === 'Waiting for approval' && data.pending && <div className="text-[11px] text-gray-400">{data.pending.past_start} for dates already passed, {data.pending.future} for future events</div>}
            </div>
          ))}
        </div>
      )}

      {data?.insights && data.insights.length > 0 && (
        <div className="mb-8">
          <h3 className="text-base font-bold text-gray-800 mb-3">What the data suggests</h3>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {data.insights.map((f, i) => (
              <div key={i} className={`rounded-xl border-l-4 p-4 text-sm ${BORDER[f.level] ?? BORDER.info}`}>
                <div className="font-semibold text-gray-800">{f.title}</div>
                <div className="text-xs text-gray-500 mb-1.5">{f.detail}</div>
                <div className="text-gray-700"><span className="font-semibold">Suggested action:</span> {f.action}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(sets.length > 0 || data?.heatmap) && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
          {sets.slice(0, 1).map(([key, ds]) => (
            <div key={key} className="xl:col-span-2">
              <div className="bg-white rounded-xl shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-700">{ds.title}</h3>
                {ds.note && <p className="text-xs text-gray-400 mb-3">{ds.note}</p>}
                <ChartCard filename={`reservations-${key}`} data={toRows(ds)}><ApiChart ds={ds} /></ChartCard>
              </div>
            </div>
          ))}
          {sets.slice(1).map(([key, ds]) => (
            <div key={key} className={WIDE.has(key) ? 'xl:col-span-2' : ''}>
              <div className="bg-white rounded-xl shadow-sm p-5 h-full">
                <h3 className="text-sm font-semibold text-gray-700">{ds.title}</h3>
                {ds.note && <p className="text-xs text-gray-400 mb-3">{ds.note}</p>}
                <ChartCard filename={`reservations-${key}`} data={toRows(ds)}><ApiChart ds={ds} /></ChartCard>
              </div>
            </div>
          ))}
          {data?.heatmap && (
            <div className="bg-white rounded-xl shadow-sm p-5 xl:col-span-2">
              <h3 className="text-sm font-semibold text-gray-700">{data.heatmap.title}</h3>
              {data.heatmap.note && <p className="text-xs text-gray-400 mb-3">{data.heatmap.note}. Darker means busier.</p>}
              <HeatmapGrid days={data.heatmap.days} hours={data.heatmap.hours} matrix={data.heatmap.matrix} max={data.heatmap.max} noun="sessions" />
            </div>
          )}
        </div>
      )}

      {data?.rooms && data.rooms.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-5 mb-8">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Rooms in numbers</h3>
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-100"><th className="py-1.5 pr-3">Room</th><th className="pr-3 text-right">Bookings</th><th className="pr-3 text-right">Hours</th><th className="pr-3 text-right">Use of bookable time</th><th className="pr-3 text-right">Seats</th><th className="text-right">Typical guests</th></tr></thead>
            <tbody>{data.rooms.map(r => (
              <tr key={r.name} className="border-b border-gray-50"><td className="py-1.5 pr-3">{r.name}</td><td className="pr-3 text-right">{r.bookings}</td><td className="pr-3 text-right">{r.hours}</td><td className="pr-3 text-right">{r.utilization}%</td><td className="pr-3 text-right">{r.seats}</td><td className="text-right">{r.median_attendees ?? '—'}</td></tr>
            ))}</tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}

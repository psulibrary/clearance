'use client';

import { useEffect, useState } from 'react';

type Row = Record<string, unknown>;

interface ApiResponse {
  items?: Row[];
  message?: string;
  error?: string;
}

function fmt(v: unknown): string {
  if (v == null) return '—';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v))
    return new Date(v).toLocaleDateString();
  return String(v);
}

export default function CirculationTable() {
  const [data, setData] = useState<ApiResponse | null>(null);

  useEffect(() => {
    fetch('/api/circulation').then(r => r.json()).then(setData);
  }, []);

  if (!data) return <div className="text-center py-12 text-gray-400">Loading checkouts…</div>;
  if (data.error) return <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">{data.error}</div>;
  if (data.message) return <div className="p-4 bg-yellow-50 text-yellow-700 rounded-lg text-sm">{data.message}</div>;

  const items = data.items ?? [];
  if (!items.length) return <div className="text-center py-12 text-gray-400">No active checkouts found.</div>;

  // Prefer known friendly columns, fall back to raw
  const hasFriendly = 'LastName' in items[0] || 'Title' in items[0];
  const rawKeys = hasFriendly
    ? null
    : Object.keys(items[0]).filter(k => k !== '_placeholder').slice(0, 8);

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
        <span className="font-semibold text-gray-700">Active Checkouts</span>
        <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-1 rounded-full">{items.length} records</span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              {hasFriendly ? (
                <>
                  <th className="px-4 py-3 text-left">Patron</th>
                  <th className="px-4 py-3 text-left">Title</th>
                  <th className="px-4 py-3 text-left">Item Barcode</th>
                  <th className="px-4 py-3 text-left">Checkout Date</th>
                  <th className="px-4 py-3 text-left">Due Date</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </>
              ) : rawKeys!.map(k => <th key={k} className="px-4 py-3 text-left">{k}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {items.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50">
                {hasFriendly ? (
                  <>
                    <td className="px-4 py-3 font-medium">
                      {[row.LastName, row.FirstName].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3 max-w-xs truncate" title={String(row.Title ?? '')}>{fmt(row.Title)}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{fmt(row.ItemBarcode)}</td>
                    <td className="px-4 py-3 text-gray-500">{fmt(row.CheckoutDate)}</td>
                    <td className={`px-4 py-3 ${row.IsOverdue ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                      {fmt(row.DueDate)}
                    </td>
                    <td className="px-4 py-3">
                      {row.IsOverdue
                        ? <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">Overdue</span>
                        : <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">Active</span>}
                    </td>
                  </>
                ) : rawKeys!.map(k => (
                  <td key={k} className="px-4 py-3 text-gray-700">{fmt(row[k])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

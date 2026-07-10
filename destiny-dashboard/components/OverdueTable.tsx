'use client';

import { useEffect, useState } from 'react';

interface OverdueItem {
  LastName: string;
  FirstName: string;
  PatronBarcode: string;
  Email: string;
  Title: string;
  ItemBarcode: string;
  DueDate: string;
  DaysOverdue: number;
}

interface ApiResponse {
  items?: OverdueItem[];
  message?: string;
  error?: string;
}

export default function OverdueTable() {
  const [data, setData] = useState<ApiResponse | null>(null);

  useEffect(() => {
    fetch('/api/overdue').then(r => r.json()).then(setData);
  }, []);

  if (!data) return <div className="text-center py-12 text-gray-400">Loading overdue items…</div>;
  if (data.error) return <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">{data.error}</div>;
  if (data.message) return <div className="p-4 bg-yellow-50 text-yellow-700 rounded-lg text-sm">{data.message}</div>;

  const items = data.items || [];

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
        <span className="font-semibold text-gray-700">Overdue Items</span>
        <span className="bg-red-100 text-red-700 text-xs font-medium px-2 py-1 rounded-full">{items.length} records</span>
      </div>
      {items.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No overdue items found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Patron</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Title</th>
                <th className="px-4 py-3 text-left">Due Date</th>
                <th className="px-4 py-3 text-left">Days Overdue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map((row, i) => (
                <tr key={i} className="hover:bg-red-50">
                  <td className="px-4 py-3 font-medium">{row.LastName}, {row.FirstName}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{row.Email || '—'}</td>
                  <td className="px-4 py-3 max-w-xs truncate" title={row.Title}>{row.Title}</td>
                  <td className="px-4 py-3 text-red-600">{row.DueDate ? new Date(row.DueDate).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`font-bold ${row.DaysOverdue > 30 ? 'text-red-700' : row.DaysOverdue > 7 ? 'text-orange-600' : 'text-yellow-600'}`}>
                      {row.DaysOverdue} days
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';

interface FineRow {
  FineID: number;
  LastName: string;
  FirstName: string;
  Email: string;
  PatronBarcode: string;
  Title: string;
  Amount: number;
  AmountPaid: number;
  AmountWaived: number;
  Balance: number;
  Created: string;
  SiteName: string;
  Note: string;
}

interface ApiResponse {
  items?: FineRow[];
  totalBalance?: string;
  error?: string;
}

export default function FinesTable() {
  const [data, setData] = useState<ApiResponse | null>(null);

  useEffect(() => {
    fetch('/api/fines').then(r => r.json()).then(setData);
  }, []);

  if (!data) return <div className="text-center py-12 text-gray-400">Loading fines…</div>;
  if (data.error) return <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">{data.error}</div>;

  const items = data.items ?? [];

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
        <span className="font-semibold text-gray-700">Outstanding Fines</span>
        <div className="flex gap-2 items-center">
          <span className="bg-orange-100 text-orange-700 text-xs font-medium px-2 py-1 rounded-full">{items.length} patrons</span>
          {data.totalBalance && (
            <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded-full">
              Total: ${Number(data.totalBalance).toFixed(2)}
            </span>
          )}
        </div>
      </div>
      {items.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No outstanding fines.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Patron</th>
                <th className="px-4 py-3 text-left">Title</th>
                <th className="px-4 py-3 text-left">Site</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Paid</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3 text-left">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map((row, i) => (
                <tr key={i} className="hover:bg-orange-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{row.LastName}, {row.FirstName}</div>
                    <div className="text-xs text-gray-400">{row.Email || row.PatronBarcode || ''}</div>
                  </td>
                  <td className="px-4 py-3 max-w-xs truncate text-gray-600" title={row.Title}>{row.Title || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{row.SiteName || '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-600">${Number(row.Amount).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-green-600">${Number(row.AmountPaid).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-bold text-red-600">${Number(row.Balance).toFixed(2)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {row.Created ? new Date(row.Created).toLocaleDateString() : '—'}
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

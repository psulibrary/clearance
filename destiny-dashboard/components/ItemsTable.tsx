'use client';

import { useEffect, useState, useCallback } from 'react';

interface CatalogItem {
  TitleID: number;
  Title: string;
  Author: string;
  ISBN: string;
  CallNumber: string;
  TotalCopies: number;
  CheckedOut: number;
}

interface ApiResponse {
  items?: CatalogItem[];
  message?: string;
  error?: string;
}

export default function ItemsTable() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [search, setSearch] = useState('');
  const [inputValue, setInputValue] = useState('');

  const load = useCallback((q: string) => {
    setData(null);
    fetch(`/api/items?search=${encodeURIComponent(q)}`).then(r => r.json()).then(setData);
  }, []);

  useEffect(() => { load(''); }, [load]);

  const items = data?.items || [];

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { setSearch(inputValue); load(inputValue); } }}
            placeholder="Search by title or author…"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => { setSearch(inputValue); load(inputValue); }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors"
          >
            Search
          </button>
        </div>
      </div>
      {!data ? (
        <div className="text-center py-12 text-gray-400">Loading catalog…</div>
      ) : data.error ? (
        <div className="p-4 text-red-700 text-sm">{data.error}</div>
      ) : data.message ? (
        <div className="p-4 text-yellow-700 text-sm">{data.message}</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No items found{search ? ` for "${search}"` : ''}.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Title</th>
                <th className="px-4 py-3 text-left">Author</th>
                <th className="px-4 py-3 text-left">Call Number</th>
                <th className="px-4 py-3 text-center">Copies</th>
                <th className="px-4 py-3 text-center">Checked Out</th>
                <th className="px-4 py-3 text-center">Available</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium max-w-xs truncate" title={row.Title}>{row.Title}</td>
                  <td className="px-4 py-3 text-gray-600">{row.Author || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{row.CallNumber || '—'}</td>
                  <td className="px-4 py-3 text-center">{row.TotalCopies}</td>
                  <td className="px-4 py-3 text-center text-amber-600">{row.CheckedOut}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-semibold ${(row.TotalCopies - row.CheckedOut) > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {row.TotalCopies - row.CheckedOut}
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

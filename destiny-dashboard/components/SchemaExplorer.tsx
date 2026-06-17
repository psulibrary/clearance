'use client';

import { useEffect, useState } from 'react';

interface TableRow {
  TABLE_NAME: string;
}

export default function SchemaExplorer() {
  const [tables, setTables] = useState<TableRow[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/tables')
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setTables(d.tables);
      });
  }, []);

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <span className="font-semibold text-gray-700">Database Tables in <code className="bg-gray-100 px-1.5 py-0.5 rounded text-blue-700">destiny</code></span>
      </div>
      {!tables && !error && <div className="text-center py-12 text-gray-400">Loading schema…</div>}
      {error && <div className="p-4 text-red-700 text-sm bg-red-50">{error}</div>}
      {tables && (
        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {tables.map((t, i) => (
            <div key={i} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-gray-700 hover:bg-blue-50 hover:border-blue-200 transition-colors">
              {t.TABLE_NAME}
            </div>
          ))}
          {tables.length === 0 && (
            <div className="col-span-4 text-center text-gray-400 py-8">No tables found or insufficient permissions.</div>
          )}
        </div>
      )}
    </div>
  );
}

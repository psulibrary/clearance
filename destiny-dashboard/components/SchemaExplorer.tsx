'use client';

import { useEffect, useState } from 'react';

interface SchemaResponse {
  tables?: string[];
  columns?: Record<string, string[]>;
  error?: string;
}

export default function SchemaExplorer() {
  const [data, setData] = useState<SchemaResponse | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/tables').then(r => r.json()).then(setData);
  }, []);

  if (!data) return <div className="text-center py-12 text-gray-400">Loading schema…</div>;
  if (data.error) return <div className="p-4 text-red-700 text-sm bg-red-50 rounded-lg">{data.error}</div>;

  const tables = data.tables ?? [];
  const columns = data.columns ?? {};

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
        <span className="font-semibold text-gray-700">
          Database Tables in <code className="bg-gray-100 px-1.5 py-0.5 rounded text-blue-700">destiny</code>
        </span>
        <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-1 rounded-full">{tables.length} tables</span>
      </div>
      <div className="p-4 space-y-1">
        {tables.map(t => (
          <div key={t} className="border border-gray-100 rounded-lg overflow-hidden">
            <button
              onClick={() => setExpanded(expanded === t ? null : t)}
              className="w-full text-left px-3 py-2 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <span className="font-mono text-sm text-gray-800">{t}</span>
              <span className="text-gray-400 text-xs">
                {columns[t]?.length ?? 0} cols {expanded === t ? '▲' : '▼'}
              </span>
            </button>
            {expanded === t && columns[t] && (
              <div className="px-3 pb-3 flex flex-wrap gap-1.5 bg-gray-50 border-t border-gray-100">
                {columns[t].map(c => (
                  <span key={c} className="bg-white border border-gray-200 text-gray-600 font-mono text-xs px-2 py-0.5 rounded">
                    {c}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {tables.length === 0 && (
          <div className="text-center text-gray-400 py-8">No tables found or insufficient permissions.</div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import StatsCard from '@/components/StatsCard';
import CirculationTable from '@/components/CirculationTable';
import OverdueTable from '@/components/OverdueTable';
import ItemsTable from '@/components/ItemsTable';
import SchemaExplorer from '@/components/SchemaExplorer';
import FinesTable from '@/components/FinesTable';

type Tab = 'circulation' | 'overdue' | 'items' | 'fines' | 'schema';

interface Stats {
  totalItems: number;
  checkedOut: number;
  overdue: number;
  patrons: number;
  error?: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('circulation');

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(setStats)
      .catch(() => setStats({ totalItems: -1, checkedOut: -1, overdue: -1, patrons: -1, error: 'Failed to connect' }));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-800 text-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-xl font-bold">Destiny Library Dashboard</h1>
              <p className="text-blue-200 text-xs">PSU Library System · Read-only Reporter View</p>
            </div>
          </div>
          <div className="text-right text-xs text-blue-200">
            <div>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
            <div className="mt-0.5">
              {stats?.error
                ? <span className="text-red-300">⚠ Connection error</span>
                : stats
                ? <span className="text-green-300">● Connected</span>
                : <span className="text-yellow-300">Connecting…</span>}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatsCard label="Total Items" value={stats?.totalItems} color="blue" icon="📚" />
          <StatsCard label="Checked Out" value={stats?.checkedOut} color="amber" icon="📤" />
          <StatsCard label="Overdue" value={stats?.overdue} color="red" icon="⚠️" />
          <StatsCard label="Patrons" value={stats?.patrons} color="green" icon="👥" />
        </div>

        {stats?.error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <strong>Database connection issue:</strong> {stats.error}. Check your environment variables and SQL Server connectivity.
          </div>
        )}

        <div className="border-b border-gray-200 mb-4">
          <nav className="flex gap-1">
            {([
              { id: 'circulation', label: 'Active Checkouts', icon: '📤' },
              { id: 'overdue', label: 'Overdue', icon: '⚠️' },
              { id: 'items', label: 'Catalog', icon: '📚' },
              { id: 'fines', label: 'Fines', icon: '💰' },
              { id: 'schema', label: 'Schema Explorer', icon: '🔍' },
            ] as { id: Tab; label: string; icon: string }[]).map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === t.id
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </nav>
        </div>

        {activeTab === 'circulation' && <CirculationTable />}
        {activeTab === 'overdue' && <OverdueTable />}
        {activeTab === 'items' && <ItemsTable />}
        {activeTab === 'fines' && <FinesTable />}
        {activeTab === 'schema' && <SchemaExplorer />}
      </main>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';

interface Stats {
  // collection
  totalItems: number;
  checkedOut: number;
  overdue: number;
  overdueOver30Days: number;
  available: number;
  newItemsThisYear: number;
  newItemsThisMonth: number;
  uniqueTitles: number;
  withdrawnItems: number;
  neverCheckedOut: number;
  // circulation
  checkoutsLast7Days: number;
  checkoutsLast30Days: number;
  checkoutsThisYear: number;
  checkinsLast7Days: number;
  checkinsLast30Days: number;
  avgLoanDaysThisYear: number;
  // holds
  pendingHolds: number;
  readyHolds: number;
  holdsPlacedThisYear: number;
  // patrons
  totalPatrons: number;
  patronsWithCheckouts: number;
  patronsWithOverdue: number;
  newPatronsThisYear: number;
  activePatronsThisYear: number;
  activePatronsLast30Days: number;
  // fines
  activeFines: number;
  totalFinesBalance: number;
  finesCollectedThisYear: number;
  finesCollectedThisMonth: number;
  error?: string;
}

function fmt(n: number | undefined): string {
  if (n === undefined || n === null) return '—';
  return Number(n).toLocaleString();
}

function money(n: number | undefined): string {
  if (n === undefined || n === null) return '—';
  return '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(a: number, b: number): string {
  if (!b) return '—';
  return (a / b * 100).toFixed(1) + '%';
}

function days(n: number | undefined): string {
  if (n === undefined || n === null) return '—';
  return Number(n).toFixed(1) + ' days';
}

interface CardProps {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}

function Card({ label, value, sub, color = 'text-gray-800' }: CardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 flex flex-col gap-1">
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      <div className="text-sm font-medium text-gray-600">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
        <span>{icon}</span>{title}
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {children}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = () => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(d => { setStats(d); setLastUpdated(new Date()); })
      .catch(() => setStats({ error: 'Connection failed' } as Stats));
  };

  useEffect(() => { load(); }, []);

  const s = stats;

  // Derived KPIs
  const turnoverRate = s?.checkoutsThisYear && s?.totalItems
    ? (s.checkoutsThisYear / s.totalItems).toFixed(2) + 'x'
    : '—';
  const holdFillRate = s ? pct(s.readyHolds, (s.pendingHolds + s.readyHolds) || 0) : '—';
  const collectionDeadStock = s?.neverCheckedOut && s?.totalItems
    ? pct(s.neverCheckedOut, s.totalItems)
    : '—';

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-800 text-white shadow">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Destiny Library Dashboard</h1>
            <p className="text-blue-200 text-xs">PSU Library System · Read-only Reporter View</p>
          </div>
          <div className="text-right text-xs text-blue-200 flex flex-col items-end gap-1">
            <div>{new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
            <div className="flex items-center gap-2">
              {s?.error
                ? <span className="text-red-300">⚠ {s.error}</span>
                : s
                ? <span className="text-green-300">● Connected</span>
                : <span className="text-yellow-300 animate-pulse">Connecting…</span>}
              {lastUpdated && (
                <button onClick={load} className="border border-blue-400 text-blue-200 hover:bg-blue-700 text-xs px-2 py-0.5 rounded transition-colors">
                  ↻ Refresh
                </button>
              )}
            </div>
            {lastUpdated && <div className="text-blue-300">Updated {lastUpdated.toLocaleTimeString()}</div>}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {s?.error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <strong>Connection error:</strong> {s.error}
          </div>
        )}

        {/* Hero row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-blue-700 text-white rounded-xl p-5 flex flex-col gap-1">
            <div className="text-4xl font-bold">{fmt(s?.totalItems)}</div>
            <div className="text-sm font-medium text-blue-100">Total Items</div>
            <div className="text-xs text-blue-300">{fmt(s?.uniqueTitles)} unique titles</div>
          </div>
          <div className="bg-amber-500 text-white rounded-xl p-5 flex flex-col gap-1">
            <div className="text-4xl font-bold">{fmt(s?.checkedOut)}</div>
            <div className="text-sm font-medium text-amber-100">Checked Out</div>
            <div className="text-xs text-amber-200">{pct(s?.checkedOut ?? 0, s?.totalItems ?? 0)} utilization</div>
          </div>
          <div className="bg-red-600 text-white rounded-xl p-5 flex flex-col gap-1">
            <div className="text-4xl font-bold">{fmt(s?.overdue)}</div>
            <div className="text-sm font-medium text-red-100">Overdue</div>
            <div className="text-xs text-red-200">{fmt(s?.overdueOver30Days)} over 30 days</div>
          </div>
          <div className="bg-green-600 text-white rounded-xl p-5 flex flex-col gap-1">
            <div className="text-4xl font-bold">{fmt(s?.totalPatrons)}</div>
            <div className="text-sm font-medium text-green-100">Total Patrons</div>
            <div className="text-xs text-green-200">{fmt(s?.newPatronsThisYear)} new this year</div>
          </div>
        </div>

        <Section title="Collection Health" icon="📚">
          <Card label="Available Now"          value={fmt(s?.available)}           color="text-green-700" />
          <Card label="Unique Titles"          value={fmt(s?.uniqueTitles)}        />
          <Card label="New Items This Month"   value={fmt(s?.newItemsThisMonth)}   sub="added to catalog" />
          <Card label="New Items This Year"    value={fmt(s?.newItemsThisYear)}    sub="added to catalog" />
          <Card label="Withdrawn Items"        value={fmt(s?.withdrawnItems)}      sub="removed from collection" color="text-gray-500" />
          <Card label="Never Checked Out"      value={fmt(s?.neverCheckedOut)}     sub={`${collectionDeadStock} of collection — weeding candidates`} color="text-orange-600" />
        </Section>

        <Section title="Circulation Activity" icon="📤">
          <Card label="Checkouts (Last 7 Days)"  value={fmt(s?.checkoutsLast7Days)}   color="text-blue-700" />
          <Card label="Checkouts (Last 30 Days)" value={fmt(s?.checkoutsLast30Days)}  color="text-blue-700" />
          <Card label="Checkouts This Year"      value={fmt(s?.checkoutsThisYear)}    color="text-blue-700" />
          <Card label="Collection Turnover"      value={turnoverRate}                  sub="checkouts ÷ total items this year" color="text-indigo-700" />
          <Card label="Check-ins (Last 7 Days)"  value={fmt(s?.checkinsLast7Days)}    />
          <Card label="Check-ins (Last 30 Days)" value={fmt(s?.checkinsLast30Days)}   />
          <Card label="Avg Loan Duration"        value={days(s?.avgLoanDaysThisYear)} sub="average days per checkout this year" color="text-purple-700" />
          <Card label="Utilization Rate"         value={pct(s?.checkedOut ?? 0, s?.totalItems ?? 0)} sub="items checked out vs total" color="text-amber-700" />
        </Section>

        <Section title="Holds & Reservations" icon="🔖">
          <Card label="Pending Holds"          value={fmt(s?.pendingHolds)}        sub="waiting for a copy" />
          <Card label="Ready for Pickup"       value={fmt(s?.readyHolds)}          sub="holds ready now" color="text-green-700" />
          <Card label="Holds Placed This Year" value={fmt(s?.holdsPlacedThisYear)} sub="total reservations made" color="text-blue-700" />
          <Card label="Hold Fill Rate"         value={holdFillRate}                 sub="ready vs total active holds" color="text-indigo-700" />
        </Section>

        <Section title="Patron Engagement & Impact" icon="👥">
          <Card label="Active Borrowers Now"     value={fmt(s?.patronsWithCheckouts)}     sub="currently have items out" color="text-blue-700" />
          <Card label="Active Patrons (30 Days)" value={fmt(s?.activePatronsLast30Days)}  sub="borrowed in last 30 days" color="text-blue-700" />
          <Card label="Active Patrons This Year" value={fmt(s?.activePatronsThisYear)}    sub="borrowed at least once" color="text-green-700" />
          <Card label="New Patrons This Year"    value={fmt(s?.newPatronsThisYear)}        color="text-green-700" />
          <Card label="Patron Reach Rate"        value={pct(s?.activePatronsThisYear ?? 0, s?.totalPatrons ?? 0)} sub="% of patrons who borrowed this year" color="text-indigo-700" />
          <Card label="Patron Activation Rate"   value={pct(s?.patronsWithCheckouts ?? 0, s?.totalPatrons ?? 0)} sub="% currently borrowing" color="text-amber-700" />
          <Card label="Patrons with Overdue"     value={fmt(s?.patronsWithOverdue)}        sub="need follow-up" color="text-red-700" />
          <Card label="Overdue Rate"             value={pct(s?.overdue ?? 0, s?.checkedOut ?? 0)} sub="% of checkouts overdue" color="text-red-600" />
        </Section>

        <Section title="Fines & Revenue" icon="💰">
          <Card label="Outstanding Fines"          value={fmt(s?.activeFines)}               sub="open fine records" color="text-red-700" />
          <Card label="Total Fines Balance"         value={money(s?.totalFinesBalance)}       sub="total amount owed" color="text-red-700" />
          <Card label="Collected This Year"         value={money(s?.finesCollectedThisYear)}  sub="fines paid in" color="text-green-700" />
          <Card label="Collected This Month"          value={money(s?.finesCollectedThisMonth)}  sub="fines paid this month" color="text-green-700" />
          <Card label="Avg Balance per Fine"        value={s?.activeFines && s.totalFinesBalance ? money(s.totalFinesBalance / s.activeFines) : '—'} sub="average open fine amount" />
        </Section>
      </main>
    </div>
  );
}

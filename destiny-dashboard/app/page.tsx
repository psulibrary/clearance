'use client';

import { useEffect, useState, useCallback } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Stats {
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
  checkoutsLast7Days: number;
  checkoutsLast30Days: number;
  checkoutsThisYear: number;
  checkinsLast7Days: number;
  checkinsLast30Days: number;
  avgLoanDays: number;
  pendingHolds: number;
  readyHolds: number;
  holdsPlacedThisYear: number;
  totalPatrons: number;
  patronsWithCheckouts: number;
  patronsWithOverdue: number;
  activePatronsThisYear: number;
  activePatronsLast30Days: number;
  newPatronsThisYear: number;
  gender: string;
  patronTypeID: number;
  activeFines: number;
  totalFinesBalance: number;
  totalFinesEverCollected: number;
  year: number;
  month: number;
  error?: string;
}

const MONTHS = [
  'All Months','January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

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

interface CardProps { label: string; value: string; sub?: string; color?: string; }
function Card({ label, value, sub, color = 'text-gray-800' }: CardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 flex flex-col gap-1 print:shadow-none print:border print:border-gray-200">
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

function exportCsv(s: Stats, yearLabel: string, monthLabel: string, genderLabel: string, patronTypeLabel: string) {
  const rows: [string, string][] = [
    ['Filter: Year', yearLabel],
    ['Filter: Month', monthLabel],
    ['Filter: Gender', genderLabel || 'All'],
    ['Filter: Patron Type', patronTypeLabel || 'All'],
    ['', ''],
    ['COLLECTION', ''],
    ['Total Items', String(s.totalItems)],
    ['Checked Out', String(s.checkedOut)],
    ['Available Now', String(s.available)],
    ['Overdue', String(s.overdue)],
    ['Overdue > 30 Days', String(s.overdueOver30Days)],
    ['Unique Titles', String(s.uniqueTitles)],
    ['New Items This Month', String(s.newItemsThisMonth)],
    ['New Items This Year', String(s.newItemsThisYear)],
    ['Never Checked Out', String(s.neverCheckedOut)],
    ['Withdrawn Items', String(s.withdrawnItems)],
    ['', ''],
    ['CIRCULATION', ''],
    ['Checkouts Last 7 Days', String(s.checkoutsLast7Days)],
    ['Checkouts Last 30 Days', String(s.checkoutsLast30Days)],
    ['Checkouts (Filtered Period)', String(s.checkoutsThisYear)],
    ['Check-ins Last 7 Days', String(s.checkinsLast7Days)],
    ['Check-ins Last 30 Days', String(s.checkinsLast30Days)],
    ['Avg Loan Duration (days)', Number(s.avgLoanDays).toFixed(1)],
    ['Utilization Rate', pct(s.checkedOut, s.totalItems)],
    ['Collection Turnover', s.totalItems ? (s.checkoutsThisYear / s.totalItems).toFixed(2) + 'x' : '—'],
    ['', ''],
    ['HOLDS', ''],
    ['Pending Holds', String(s.pendingHolds)],
    ['Ready for Pickup', String(s.readyHolds)],
    ['', ''],
    ['PATRONS', ''],
    ['Total Patrons', String(s.totalPatrons)],
    ['Active Borrowers Now', String(s.patronsWithCheckouts)],
    ['Active Patrons Last 30 Days', String(s.activePatronsLast30Days)],
    ['Holds Placed (Filtered Period)', String(s.holdsPlacedThisYear)],
    ['Active Patrons (Filtered Period)', String(s.activePatronsThisYear)],
    ['New Patrons (Filtered Period)', String(s.newPatronsThisYear)],
    ['Patron Reach Rate', pct(s.activePatronsThisYear, s.totalPatrons)],
    ['Patrons with Overdue', String(s.patronsWithOverdue)],
    ['', ''],
    ['FINES & REVENUE', ''],
    ['Outstanding Fines (count)', String(s.activeFines)],
    ['Total Fines Balance', money(s.totalFinesBalance)],
    ['Total Fines Ever Collected', money(s.totalFinesEverCollected)],
  ];

  const csv = rows.map(([a, b]) => `"${a}","${b}"`).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `library-stats-${yearLabel}-${monthLabel.replace(/\s/g, '')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Dashboard() {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2015 + 1 }, (_, i) => currentYear - i);
  const CHART_COLORS = ['#3b82f6','#ef4444','#10b981','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#84cc16'];

  const [stats, setStats] = useState<Stats | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [genders, setGenders]       = useState<string[]>([]);
  const [patronTypes, setPatronTypes] = useState<{ PatronTypeID: number; PatronTypeDescription: string }[]>([]);
  const [genderData, setGenderData] = useState<{name:string;value:number}[]>([]);
  const [patronTypeData, setPatronTypeData] = useState<{name:string;value:number}[]>([]);
  const [sublocData, setSublocData] = useState<{name:string;total:number;checkedOut:number;available:number}[]>([]);
  const [catData, setCatData] = useState<{name:string;total:number;checkedOut:number}[]>([]);

  const [year, setYear]               = useState(currentYear);
  const [month, setMonth]             = useState(0);
  const [gender, setGender]           = useState('');
  const [patronTypeID, setPatronTypeID] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ year: String(year), month: String(month), gender, patronTypeID: String(patronTypeID) });
    fetch(`/api/stats?${params}`)
      .then(r => r.json())
      .then(d => { setStats(d); setLastUpdated(new Date()); })
      .catch(() => setStats({ error: 'Connection failed' } as Stats))
      .finally(() => setLoading(false));
  }, [year, month, gender, patronTypeID]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch('/api/genders')
      .then(r => r.json())
      .then(d => { if (d.genders) setGenders(d.genders); })
      .catch(() => {});
    fetch('/api/patron-types')
      .then(r => r.json())
      .then(d => { if (d.types) setPatronTypes(d.types); })
      .catch(() => {});
    fetch('/api/charts/gender').then(r => r.json()).then(d => { if (d.data) setGenderData(d.data); }).catch(() => {});
    fetch('/api/charts/patron-type').then(r => r.json()).then(d => { if (d.data) setPatronTypeData(d.data); }).catch(() => {});
    fetch('/api/charts/collection-by-sublocation').then(r=>r.json()).then(d=>{ if(d.data) setSublocData(d.data); });
    fetch('/api/charts/collection-by-category').then(r=>r.json()).then(d=>{ if(d.data) setCatData(d.data); });
  }, []);

  const s = stats;
  const turnoverRate = s?.checkoutsThisYear && s?.totalItems ? (s.checkoutsThisYear / s.totalItems).toFixed(2) + 'x' : '—';
  const holdFillRate = s ? pct(s.readyHolds, (s.pendingHolds + s.readyHolds) || 0) : '—';
  const deadStockPct = s?.neverCheckedOut && s?.totalItems ? pct(s.neverCheckedOut, s.totalItems) : '—';
  const yearLabel    = String(year);
  const monthLabel   = MONTHS[month];
  const periodLabel  = month ? `${MONTHS[month]} ${year}` : `Year ${year}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-800 text-white shadow print:hidden">
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
                : loading
                ? <span className="text-yellow-300 animate-pulse">Loading…</span>
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

      {/* Print header — only visible when printing */}
      <div className="hidden print:block px-6 py-4 border-b border-gray-300 mb-4">
        <h1 className="text-2xl font-bold">PSU Library — Stats Report</h1>
        <p className="text-sm text-gray-500">
          Period: {periodLabel}
          {gender ? ` · Gender: ${gender}` : ''}
          {patronTypeID ? ` · Type: ${patronTypes.find(pt => pt.PatronTypeID === patronTypeID)?.PatronTypeDescription ?? patronTypeID}` : ''}
          {' · '}Printed {new Date().toLocaleString('en-PH')}
        </p>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {s?.error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <strong>Connection error:</strong> {s.error}
          </div>
        )}

        {/* Filter bar */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6 flex flex-wrap gap-3 items-end print:hidden">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Year</label>
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Month</label>
            <select
              value={month}
              onChange={e => setMonth(Number(e.target.value))}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
          </div>

          {genders.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Gender</label>
              <select
                value={gender}
                onChange={e => setGender(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Genders</option>
                {genders.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          )}
          {patronTypes.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Patron Type</label>
              <select
                value={patronTypeID}
                onChange={e => setPatronTypeID(Number(e.target.value))}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={0}>All Types</option>
                {patronTypes.map(pt => <option key={pt.PatronTypeID} value={pt.PatronTypeID}>{pt.PatronTypeDescription}</option>)}
              </select>
            </div>
          )}
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => s && exportCsv(s, yearLabel, monthLabel, gender, patronTypes.find(pt => pt.PatronTypeID === patronTypeID)?.PatronTypeDescription ?? '')}
              disabled={!s || !!s.error}
              className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              ↓ Export CSV
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              ⎙ Print / PDF
            </button>
          </div>
        </div>

        {/* Period context banner */}
        <div className="text-xs text-gray-400 mb-4 print:hidden">
          Showing period-based stats for: <strong className="text-gray-600">{periodLabel}</strong>
          {gender && <> · Gender: <strong className="text-gray-600">{gender}</strong></>}
          {patronTypeID > 0 && <> · Type: <strong className="text-gray-600">{patronTypes.find(pt => pt.PatronTypeID === patronTypeID)?.PatronTypeDescription}</strong></>}
          </div>

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
            <div className="text-xs text-green-200">{fmt(s?.newPatronsThisYear)} new in {year}</div>
          </div>
        </div>

        <Section title="Collection Health" icon="📚">
          <Card label="Available Now"        value={fmt(s?.available)}         color="text-green-700" />
          <Card label="Unique Titles"        value={fmt(s?.uniqueTitles)}      />
          <Card label="New Items This Month" value={fmt(s?.newItemsThisMonth)} sub="added to catalog" />
          <Card label={`New Items in ${year}`} value={fmt(s?.newItemsThisYear)} sub="added to catalog" />
          <Card label="Withdrawn Items"      value={fmt(s?.withdrawnItems)}    sub="removed from collection" color="text-gray-500" />
          <Card label="Never Checked Out"    value={fmt(s?.neverCheckedOut)}   sub={`${deadStockPct} of collection — weeding candidates`} color="text-orange-600" />
        </Section>

        <Section title={`Circulation Activity — ${periodLabel}`} icon="📤">
          <Card label="Checkouts (Last 7 Days)"  value={fmt(s?.checkoutsLast7Days)}  color="text-blue-700" />
          <Card label="Checkouts (Last 30 Days)" value={fmt(s?.checkoutsLast30Days)} color="text-blue-700" />
          <Card label={`Checkouts — ${periodLabel}`} value={fmt(s?.checkoutsThisYear)} color="text-blue-700" />
          <Card label="Collection Turnover"      value={turnoverRate}                  sub={`checkouts ÷ total items (${periodLabel})`} color="text-indigo-700" />
          <Card label="Check-ins (Last 7 Days)"  value={fmt(s?.checkinsLast7Days)}    />
          <Card label="Check-ins (Last 30 Days)" value={fmt(s?.checkinsLast30Days)}   />
          <Card label="Avg Loan Duration"        value={days(s?.avgLoanDays)}          sub={`average days per loan (${periodLabel})`} color="text-purple-700" />
          <Card label="Utilization Rate"         value={pct(s?.checkedOut ?? 0, s?.totalItems ?? 0)} sub="items checked out vs total right now" color="text-amber-700" />
        </Section>

        <Section title="Holds & Reservations" icon="🔖">
          <Card label="Pending Holds"                value={fmt(s?.pendingHolds)}        sub="waiting for a copy" />
          <Card label="Ready for Pickup"             value={fmt(s?.readyHolds)}          sub="holds ready now" color="text-green-700" />
          <Card label={`Holds Placed — ${periodLabel}`} value={fmt(s?.holdsPlacedThisYear)} sub="total reservations made" color="text-blue-700" />
          <Card label="Hold Fill Rate"               value={holdFillRate}                 sub="ready vs total active holds" color="text-indigo-700" />
        </Section>

        <Section title={`Patron Engagement & Impact — ${periodLabel}`} icon="👥">
          <Card label="Active Borrowers Now"          value={fmt(s?.patronsWithCheckouts)}    sub="currently have items out" color="text-blue-700" />
          <Card label="Active Patrons (Last 30 Days)" value={fmt(s?.activePatronsLast30Days)} sub="borrowed in last 30 days" color="text-blue-700" />
          <Card label={`Active Patrons — ${periodLabel}`} value={fmt(s?.activePatronsThisYear)} sub="borrowed at least once" color="text-green-700" />
          <Card label={`New Patrons — ${periodLabel}`} value={fmt(s?.newPatronsThisYear)} color="text-green-700" />
          <Card label="Patron Reach Rate"           value={pct(s?.activePatronsThisYear ?? 0, s?.totalPatrons ?? 0)} sub={`% of patrons who borrowed (${periodLabel})`} color="text-indigo-700" />
          <Card label="Patron Activation Rate"      value={pct(s?.patronsWithCheckouts ?? 0, s?.totalPatrons ?? 0)} sub="% currently borrowing" color="text-amber-700" />
          <Card label="Patrons with Overdue"        value={fmt(s?.patronsWithOverdue)}       sub="need follow-up" color="text-red-700" />
          <Card label="Overdue Rate"                value={pct(s?.overdue ?? 0, s?.checkedOut ?? 0)} sub="% of checkouts overdue" color="text-red-600" />
        </Section>

        {/* Demographics & Distribution */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2 print:hidden">
            <span>📊</span>Demographics & Distribution
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:hidden">
            {/* Gender Pie Chart */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-600 mb-3">Patrons by Gender</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={genderData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({name, percent}: {name?: string;percent?: number}) => `${name ?? ''} ${((percent ?? 0)*100).toFixed(1)}%`}>
                    {genderData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: unknown) => typeof v === 'number' ? v.toLocaleString() : String(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Patron Type Bar Chart */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-600 mb-3">Top Patron Types</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={patronTypeData} layout="vertical" margin={{left:80}}>
                  <XAxis type="number" tick={{fontSize:11}} />
                  <YAxis type="category" dataKey="name" tick={{fontSize:10}} width={80} />
                  <Tooltip formatter={(v: unknown) => typeof v === 'number' ? v.toLocaleString() : String(v)} />
                  <Bar dataKey="value" fill="#3b82f6" radius={[0,4,4,0]}>
                    {patronTypeData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <Section title="Collection Breakdown" icon="📚">
          <div className="col-span-full print:hidden">
            <p className="text-sm font-semibold text-gray-700 mb-2">By Sublocation</p>
            <ResponsiveContainer width="100%" height={Math.max(200, sublocData.length * 36)}>
              <BarChart data={sublocData} layout="vertical" margin={{left:120,right:40,top:4,bottom:4}}>
                <XAxis type="number" tick={{fontSize:11}} />
                <YAxis type="category" dataKey="name" tick={{fontSize:11}} width={115} />
                <Tooltip />
                <Legend />
                <Bar dataKey="total" name="Total" fill="#3b82f6" />
                <Bar dataKey="checkedOut" name="Checked Out" fill="#f59e0b" />
                <Bar dataKey="available" name="Available" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="col-span-full print:hidden mt-4">
            <p className="text-sm font-semibold text-gray-700 mb-2">By Copy Category (Dewey)</p>
            <ResponsiveContainer width="100%" height={Math.max(200, catData.length * 36)}>
              <BarChart data={catData} layout="vertical" margin={{left:160,right:40,top:4,bottom:4}}>
                <XAxis type="number" tick={{fontSize:11}} />
                <YAxis type="category" dataKey="name" tick={{fontSize:11}} width={155} />
                <Tooltip />
                <Legend />
                <Bar dataKey="total" name="Total" fill="#8b5cf6" />
                <Bar dataKey="checkedOut" name="Checked Out" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>

        <Section title="ISO 2789 Performance Indicators" icon="📐">
          <Card label="Loans per Registered User" value={s?.totalPatrons ? (s.checkoutsThisYear / s.totalPatrons).toFixed(2) : '—'} sub={`ISO 2789 §6.2.3 — ${periodLabel}`} color="text-indigo-700" />
          <Card label="Items per Registered User" value={s?.totalPatrons ? (s.totalItems / s.totalPatrons).toFixed(2) : '—'} sub="ISO 2789 §6.3.2 collection density" color="text-indigo-700" />
          <Card label="Active Borrower Rate" value={pct(s?.activePatronsThisYear ?? 0, s?.totalPatrons ?? 0)} sub={`ISO 2789 §2.2.2 — ${periodLabel}`} color="text-blue-700" />
          <Card label="Reservation Rate" value={s?.checkoutsThisYear ? pct(s.holdsPlacedThisYear, s.checkoutsThisYear) : '—'} sub="ISO 2789 §6.2.3.6 holds vs loans" color="text-purple-700" />
          <Card label="Overdue Borrower Rate" value={pct(s?.patronsWithOverdue ?? 0, s?.patronsWithCheckouts ?? 0)} sub="% of active borrowers with overdue items" color="text-red-600" />
          <Card label="Collection Turnover Rate" value={s?.totalItems ? (s.checkoutsThisYear / s.totalItems).toFixed(2) + 'x' : '—'} sub={`ISO 2789 §6.2.3 loans per item — ${periodLabel}`} color="text-green-700" />
        </Section>

        <Section title="ISO 16439 Impact Indicators" icon="📊">
          <Card label="Library Use Rate" value={pct(s?.activePatronsThisYear ?? 0, s?.totalPatrons ?? 0)} sub={`ISO 16439 §5.2 — active users / registered × 100 — ${periodLabel}`} color="text-rose-700" />
          <Card label="Borrower Penetration Rate" value={pct(s?.patronsWithCheckouts ?? 0, s?.totalPatrons ?? 0)} sub="ISO 16439 §5.2 — patrons with active loans / total" color="text-rose-700" />
          <Card label="Repeat Use Index" value={s?.activePatronsThisYear ? (s.checkoutsThisYear / s.activePatronsThisYear).toFixed(2) : '—'} sub={`ISO 16439 §5.3 — loans per active user — ${periodLabel}`} color="text-orange-700" />
          <Card label="Collection Use Ratio" value={s?.totalItems ? (s.checkoutsThisYear / s.totalItems).toFixed(2) : '—'} sub={`ISO 16439 §5.3 — loans per item — ${periodLabel}`} color="text-orange-700" />
          <Card label="Hold Fulfillment Rate" value={((s?.pendingHolds ?? 0) + (s?.readyHolds ?? 0)) > 0 ? pct(s?.readyHolds ?? 0, (s?.pendingHolds ?? 0) + (s?.readyHolds ?? 0)) : '—'} sub="ISO 16439 §5.3 — ready holds / total holds" color="text-teal-700" />
          <Card label="Overdue Rate" value={s?.checkedOut ? pct(s.overdue, s.checkedOut) : '—'} sub="ISO 16439 §5.3 — overdue / checked-out items" color="text-red-700" />
          <Card label="New User Growth Rate" value={pct(s?.newPatronsThisYear ?? 0, s?.totalPatrons ?? 0)} sub={`ISO 16439 §5.2 — new patrons / total — ${s?.year}`} color="text-green-700" />
          <Card label="Collection Refresh Rate" value={pct(s?.newItemsThisYear ?? 0, s?.totalItems ?? 0)} sub={`ISO 16439 §5.3 — new items / total — ${s?.year}`} color="text-green-700" />
        </Section>

        <Section title="Fines & Revenue" icon="💰">
          <Card label="Outstanding Fines"         value={fmt(s?.activeFines)}              sub="open fine records" color="text-red-700" />
          <Card label="Total Fines Balance"        value={money(s?.totalFinesBalance)}      sub="total amount owed" color="text-red-700" />
          <Card label="Total Fines Ever Collected" value={money(s?.totalFinesEverCollected)} sub="all-time AmountPaid" color="text-green-700" />
          <Card label="Avg Balance per Fine"       value={s?.activeFines && s.totalFinesBalance ? money(s.totalFinesBalance / s.activeFines) : '—'} sub="average open fine amount" />
        </Section>
      </main>
    </div>
  );
}

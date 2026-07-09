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

interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  category: string;
  title: string;
  detail: string;
  metric?: string;
}

function buildRecommendations(s: Stats, chedStats: Record<string,number> | null, year: number): Recommendation[] {
  const recs: Recommendation[] = [];
  const totalItems = s.totalItems || 1;
  const totalPatrons = s.totalPatrons || 1;
  const checkedOut = s.checkedOut || 0;

  // ── Overdue & Compliance ──
  const overdueRate = checkedOut ? s.overdue / checkedOut : 0;
  if (overdueRate > 0.25)
    recs.push({ priority: 'high', category: 'Overdue Management', title: 'High overdue rate — send follow-up notices', detail: `${(overdueRate*100).toFixed(1)}% of checked-out items are overdue. Send automated reminders and review fine policies to encourage returns.`, metric: `${s.overdue.toLocaleString()} overdue of ${checkedOut.toLocaleString()} checked out` });
  else if (overdueRate > 0.1)
    recs.push({ priority: 'medium', category: 'Overdue Management', title: 'Overdue rate above 10% — monitor closely', detail: 'Consider sending reminder notices to patrons with upcoming due dates. Review loan periods for high-demand items.', metric: `${(overdueRate*100).toFixed(1)}% overdue rate` });

  const severeOverduePct = s.overdue ? s.overdueOver30Days / s.overdue : 0;
  if (s.overdueOver30Days > 10 && severeOverduePct > 0.2)
    recs.push({ priority: 'high', category: 'Overdue Management', title: 'Significant long-term overdue items (>30 days)', detail: 'Items overdue by more than 30 days may never be returned. Escalate to personal contact, consider marking as lost and billing replacement cost.', metric: `${s.overdueOver30Days.toLocaleString()} items overdue >30 days` });

  // ── Collection Health ──
  const deadStockPct = s.neverCheckedOut / totalItems;
  if (deadStockPct > 0.4)
    recs.push({ priority: 'high', category: 'Collection Development', title: 'Large dead stock — conduct weeding campaign', detail: `${(deadStockPct*100).toFixed(1)}% of items have never been borrowed. Run a systematic weeding review using MUSTIE criteria (Misleading, Ugly, Superseded, Trivial, Irrelevant, Elsewhere available). Remove or relocate items to free shelving space.`, metric: `${s.neverCheckedOut.toLocaleString()} of ${totalItems.toLocaleString()} items never borrowed` });
  else if (deadStockPct > 0.25)
    recs.push({ priority: 'medium', category: 'Collection Development', title: 'High proportion of unused items', detail: 'Review items that have never circulated. Consider relocating low-use items to storage and promoting underused subjects via displays or bibliographies.', metric: `${(deadStockPct*100).toFixed(1)}% of collection never borrowed` });

  const refreshRate = s.newItemsThisYear / totalItems;
  if (refreshRate < 0.03)
    recs.push({ priority: 'high', category: 'Collection Development', title: `Collection refresh rate critically low in ${year}`, detail: 'Less than 3% of the collection is new this year. Accreditation standards (CHED CMO 22 §4.b.4) require regular acquisition. Submit budget request for new titles targeting high-demand subjects.', metric: `${(refreshRate*100).toFixed(1)}% refresh rate (target ≥ 5%)` });
  else if (refreshRate < 0.05)
    recs.push({ priority: 'medium', category: 'Collection Development', title: 'Collection refresh rate below 5% target', detail: 'Plan acquisitions focusing on subjects with high circulation turnover and on materials less than 5 years old to improve collection currency scores.', metric: `${(refreshRate*100).toFixed(1)}% refresh rate` });

  const turnover = s.checkoutsThisYear / totalItems;
  if (turnover < 0.5)
    recs.push({ priority: 'medium', category: 'Circulation', title: 'Low collection turnover — promote underused materials', detail: 'Less than half an item per item was borrowed this year. Run book displays, subject guides, and faculty reading list integrations to drive discovery of the collection.', metric: `${turnover.toFixed(2)}x turnover (checkouts ÷ items)` });

  // ── Patron Engagement ──
  const activeRate = s.activePatronsThisYear / totalPatrons;
  if (activeRate < 0.2)
    recs.push({ priority: 'high', category: 'Patron Engagement', title: 'Low patron reach — library is underused', detail: `Only ${(activeRate*100).toFixed(1)}% of registered patrons borrowed at least once this year. Run orientation sessions, literacy programs, and coordinate with faculty to integrate library use into coursework.`, metric: `${s.activePatronsThisYear.toLocaleString()} of ${totalPatrons.toLocaleString()} patrons active` });
  else if (activeRate < 0.4)
    recs.push({ priority: 'medium', category: 'Patron Engagement', title: 'Patron reach below 40% — expand outreach', detail: 'Strengthen faculty liaison programs, create subject-specific reading lists, and promote new acquisitions to relevant departments.', metric: `${(activeRate*100).toFixed(1)}% patron reach rate` });

  const loansPerPatron = s.checkoutsThisYear / totalPatrons;
  if (loansPerPatron < 2)
    recs.push({ priority: 'medium', category: 'Patron Engagement', title: 'Low borrowing frequency per patron', detail: 'Average patron borrowed fewer than 2 items this year. Explore extended loan periods, reading challenges, or class-integrated library assignments to increase repeat use.', metric: `${loansPerPatron.toFixed(2)} loans per registered patron` });

  // ── Holds ──
  if (s.pendingHolds > 50 && s.pendingHolds > s.readyHolds * 2)
    recs.push({ priority: 'medium', category: 'Circulation', title: 'Many unfilled holds — consider additional copies', detail: 'A large backlog of pending holds indicates demand exceeding supply. Identify high-hold titles and request additional copies or e-book licenses.', metric: `${s.pendingHolds.toLocaleString()} pending holds vs ${s.readyHolds.toLocaleString()} ready` });

  // ── Fines ──
  if (s.totalFinesBalance > 0 && s.activeFines > 100)
    recs.push({ priority: 'medium', category: 'Revenue', title: 'Outstanding fines balance — review collection process', detail: 'A significant fines balance is outstanding. Review fine notification workflows, consider amnesty programs to recover materials, and ensure fines are linked to patron accounts actively.', metric: `₱${s.totalFinesBalance.toLocaleString('en-PH', {minimumFractionDigits:2})} across ${s.activeFines.toLocaleString()} records` });

  // ── CHED Requirements ──
  if (chedStats && !chedStats.error) {
    if ((chedStats.totalTitles ?? 0) < 5000)
      recs.push({ priority: 'high', category: 'CHED Compliance', title: 'Below CHED minimum title requirement (§4.b.1)', detail: `CHED CMO 22 §4.b.1 requires at least 5,000 titles. Current count is ${Number(chedStats.totalTitles ?? 0).toLocaleString()}. Prioritize acquisitions of unique titles — avoid duplicate copies until the threshold is met.`, metric: `${Number(chedStats.totalTitles ?? 0).toLocaleString()} titles (need 5,000)` });

    const filPct = chedStats.totalItems ? (chedStats.filipianianaItems ?? 0) / chedStats.totalItems : 0;
    if (filPct < 0.10)
      recs.push({ priority: 'medium', category: 'CHED Compliance', title: 'Filipiniana collection below 10% (§4.b.2)', detail: `CHED CMO 22 §4.b.2 requires at least 10% Filipiniana materials. Current: ${(filPct*100).toFixed(1)}%. Acquire more Philippine-authored and Philippine-subject titles. Ensure Filipiniana items are correctly tagged in the Sublocation field in Destiny.`, metric: `${(filPct*100).toFixed(1)}% Filipiniana (target ≥ 10%)` });

    if ((chedStats.withdrawnThisYear ?? 0) === 0)
      recs.push({ priority: 'low', category: 'CHED Compliance', title: 'No weeding recorded this year (§4.a.6)', detail: 'CHED CMO 22 §4.a.6 expects an active weeding program. Document and record withdrawals in Destiny. Even a small, systematic weeding effort satisfies this requirement and demonstrates good collection management.', metric: '0 items withdrawn this year' });
  }

  // ── ISO Targets ──
  const itemsPerPatron = totalItems / totalPatrons;
  if (itemsPerPatron < 3)
    recs.push({ priority: 'medium', category: 'ISO Standards', title: 'Low items-per-patron ratio (ISO 2789 §6.3.2)', detail: 'ISO 2789 benchmarks suggest at least 3–5 items per registered user for academic libraries. Increase acquisitions or review if patron registration is inflated by inactive records.', metric: `${itemsPerPatron.toFixed(2)} items per patron` });

  if (activeRate > 0.6 && turnover > 2)
    recs.push({ priority: 'low', category: 'ISO Standards', title: 'Strong performance — document for accreditation', detail: 'High patron reach and collection turnover are excellent accreditation evidence. Prepare an annual library report citing ISO 16439 impact indicators and ISO 11620 performance metrics for submission to AACCUP/PACUCOA.', metric: `${(activeRate*100).toFixed(1)}% reach, ${turnover.toFixed(2)}x turnover` });

  // Sort: high → medium → low
  const order = { high: 0, medium: 1, low: 2 };
  return recs.sort((a, b) => order[a.priority] - order[b.priority]);
}

const PRIORITY_STYLE: Record<string, { badge: string; border: string; icon: string }> = {
  high:   { badge: 'bg-red-100 text-red-700',    border: 'border-l-4 border-red-500',    icon: '🔴' },
  medium: { badge: 'bg-amber-100 text-amber-700', border: 'border-l-4 border-amber-400', icon: '🟡' },
  low:    { badge: 'bg-blue-100 text-blue-700',   border: 'border-l-4 border-blue-400',  icon: '🔵' },
};

function RecommendedActions({ stats, chedStats, year }: { stats: Stats; chedStats: Record<string,number> | null; year: number }) {
  const recs = buildRecommendations(stats, chedStats, year);
  const high   = recs.filter(r => r.priority === 'high');
  const medium = recs.filter(r => r.priority === 'medium');
  const low    = recs.filter(r => r.priority === 'low');

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-2">
        <span>🎯</span>Recommended Actions
      </h2>
      <p className="text-xs text-gray-400 mb-4">Auto-generated from current stats. Prioritized by urgency.</p>

      {recs.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center text-green-700">
          <div className="text-2xl mb-2">✅</div>
          <div className="font-semibold">All indicators look healthy!</div>
          <div className="text-sm mt-1">No urgent actions detected based on current data.</div>
        </div>
      )}

      <div className="flex gap-3 mb-4 text-xs">
        {high.length > 0   && <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">{high.length} High Priority</span>}
        {medium.length > 0 && <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">{medium.length} Medium</span>}
        {low.length > 0    && <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">{low.length} Low / Positive</span>}
      </div>

      <div className="flex flex-col gap-3">
        {recs.map((r, i) => {
          const style = PRIORITY_STYLE[r.priority];
          return (
            <div key={i} className={`bg-white rounded-xl shadow-sm p-4 ${style.border}`}>
              <div className="flex items-start justify-between gap-3 mb-1">
                <div className="flex items-center gap-2">
                  <span>{style.icon}</span>
                  <span className="font-semibold text-gray-800 text-sm">{r.title}</span>
                </div>
                <div className="flex gap-2 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${style.badge}`}>{r.priority.toUpperCase()}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{r.category}</span>
                </div>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed mb-1">{r.detail}</p>
              {r.metric && <p className="text-xs text-gray-400 font-mono">📌 {r.metric}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
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
  const [fundingData, setFundingData] = useState<{name:string;total:number;checkedOut:number;totalValue:number}[]>([]);
  const [circTypeData, setCircTypeData] = useState<{name:string;total:number;checkedOut:number;available:number}[]>([]);
  const [materialTypeData, setMaterialTypeData] = useState<{name:string;titles:number;items:number;checkedOut:number;available:number;utilRate:number}[]>([]);
  const [acqYearData, setAcqYearData] = useState<{year:number;items:number;titles:number}[]>([]);
  const [pubYearData, setPubYearData] = useState<{name:string;titles:number;items:number}[]>([]);
  const [publisherData, setPublisherData] = useState<{name:string;titles:number;items:number}[]>([]);

  const [year, setYear]               = useState(currentYear);
  const [month, setMonth]             = useState(0);
  const [gender, setGender]           = useState('');
  const [patronTypeID, setPatronTypeID] = useState(0);

  type ActivityRow = { name:string; totalPatrons:number; activePatrons:number; totalCheckouts:number; overdueItems:number; activeRate:number; checkoutsPerPatron:number };
  const [genderActivity, setGenderActivity]       = useState<ActivityRow[]>([]);
  const [patronTypeActivity, setPatronTypeActivity] = useState<ActivityRow[]>([]);

  const [activeTab, setActiveTab] = useState<'overview'|'patrons'|'collection'|'iso'|'ched'|'insights'|'green'>('overview');
  const [chartsLoaded, setChartsLoaded] = useState({ patrons: false, collection: false, insights: false });
  const [chedStats, setChedStats] = useState<Record<string,number> | null>(null);
  const [acqData, setAcqData] = useState<{year:number;items:number;titles:number;spend:number}[]>([]);
  const [chedLoaded, setChedLoaded] = useState(false);

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

  // Fetch filter dropdown data on mount (small queries, needed for filters)
  useEffect(() => {
    fetch('/api/genders')
      .then(r => r.json())
      .then(d => { if (d.genders) setGenders(d.genders); })
      .catch(() => {});
    fetch('/api/patron-types')
      .then(r => r.json())
      .then(d => { if (d.types) setPatronTypes(d.types); })
      .catch(() => {});
  }, []);

  // Lazy-load chart data when the relevant tab is first clicked
  useEffect(() => {
    if (activeTab === 'patrons' && !chartsLoaded.patrons) {
      fetch('/api/charts/gender').then(r => r.json()).then(d => { if (d.data) setGenderData(d.data); }).catch(() => {});
      fetch('/api/charts/patron-type').then(r => r.json()).then(d => { if (d.data) setPatronTypeData(d.data); }).catch(() => {});
      setChartsLoaded(p => ({ ...p, patrons: true }));
    }
    if (activeTab === 'insights' && !chartsLoaded.insights) {
      fetch('/api/charts/activity-by-gender').then(r=>r.json()).then(d=>{ if(d.data) setGenderActivity(d.data); }).catch(() => {});
      fetch('/api/charts/activity-by-patrontype').then(r=>r.json()).then(d=>{ if(d.data) setPatronTypeActivity(d.data); }).catch(() => {});
      setChartsLoaded(p => ({ ...p, insights: true }));
    }
    if (activeTab === 'collection' && !chartsLoaded.collection) {
      fetch('/api/charts/collection-by-sublocation').then(r=>r.json()).then(d=>{ if(d.data) setSublocData(d.data); }).catch(() => {});
      fetch('/api/charts/collection-by-category').then(r=>r.json()).then(d=>{ if(d.data) setCatData(d.data); }).catch(() => {});
      fetch('/api/charts/collection-by-funding').then(r=>r.json()).then(d=>{ if(d.data) setFundingData(d.data); }).catch(() => {});
      fetch('/api/charts/collection-by-circtype').then(r=>r.json()).then(d=>{ if(d.data) setCircTypeData(d.data); }).catch(() => {});
      fetch('/api/charts/collection-by-materialtype').then(r=>r.json()).then(d=>{ if(d.data) setMaterialTypeData(d.data); }).catch(() => {});
      fetch('/api/charts/collection-by-year').then(r=>r.json()).then(d=>{ if(d.data) setAcqYearData(d.data); }).catch(() => {});
      fetch('/api/charts/collection-by-pubYear').then(r=>r.json()).then(d=>{ if(d.data) setPubYearData(d.data); }).catch(() => {});
      fetch('/api/charts/collection-by-publisher').then(r=>r.json()).then(d=>{ if(d.data) setPublisherData(d.data); }).catch(() => {});
      setChartsLoaded(p => ({ ...p, collection: true }));
    }
    if (activeTab === 'ched' && !chedLoaded) {
      setChedLoaded(true);
      fetch('/api/ched/stats').then(r=>r.json()).then(d=>{ setChedStats(d); }).catch(() => {});
      fetch('/api/ched/acquisition-by-year').then(r=>r.json()).then(d=>{ if(d.data) setAcqData(d.data); }).catch(() => {});
    }
  }, [activeTab, chartsLoaded, chedLoaded]);

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

        {/* Tab bar */}
        <div className="flex gap-2 mb-6 border-b border-gray-200 print:hidden">
          {(['overview','patrons','collection','iso','ched','insights','green'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'iso' ? 'ISO Standards' : tab === 'ched' ? 'CHED CMO 22' : tab === 'insights' ? '💡 Insights' : tab === 'green' ? '🌿 Green Library' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab: Overview */}
        <div className={activeTab === 'overview' ? 'block' : 'hidden print:block'}>
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

          <Section title="Fines & Revenue" icon="💰">
            <Card label="Outstanding Fines"         value={fmt(s?.activeFines)}              sub="open fine records" color="text-red-700" />
            <Card label="Total Fines Balance"        value={money(s?.totalFinesBalance)}      sub="total amount owed" color="text-red-700" />
            <Card label="Total Fines Ever Collected" value={money(s?.totalFinesEverCollected)} sub="all-time AmountPaid" color="text-green-700" />
            <Card label="Avg Balance per Fine"       value={s?.activeFines && s.totalFinesBalance ? money(s.totalFinesBalance / s.activeFines) : '—'} sub="average open fine amount" />
          </Section>
        </div>

        {/* Tab: Patrons */}
        <div className={activeTab === 'patrons' ? 'block' : 'hidden print:block'}>
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
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span>📊</span>Demographics & Distribution
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
        </div>

        {/* Tab: Collection */}
        <div className={activeTab === 'collection' ? 'block' : 'hidden print:block'}>

          {/* ── Section 1: Collection Health KPIs ── */}
          <Section title="Collection Health KPIs" icon="🏥">
            <Card label="Collection Refresh Rate"   value={pct(s?.newItemsThisYear ?? 0, s?.totalItems ?? 0)}    sub={`new items ÷ total items — ${year} (target ≥ 5%)`}       color={(s?.newItemsThisYear ?? 0) / (s?.totalItems || 1) >= 0.05 ? 'text-green-700' : 'text-amber-600'} />
            <Card label="Utilization Rate"          value={pct(s?.checkedOut ?? 0, s?.totalItems ?? 0)}          sub="items checked out ÷ total items right now"                color="text-blue-700" />
            <Card label="Dead Stock Rate"           value={pct(s?.neverCheckedOut ?? 0, s?.totalItems ?? 0)}     sub="items never borrowed — weeding candidates"               color={(s?.neverCheckedOut ?? 0) / (s?.totalItems || 1) > 0.3 ? 'text-red-600' : 'text-amber-600'} />
            <Card label="Weeding Intensity"         value={pct(s?.withdrawnItems ?? 0, s?.totalItems ?? 0)}      sub="withdrawn ÷ active collection — collection maintenance"   color="text-gray-600" />
            <Card label="Collection Turnover"       value={s?.totalItems ? (s.checkoutsThisYear / s.totalItems).toFixed(2) + 'x' : '—'} sub={`loans ÷ total items — ${periodLabel}`} color="text-indigo-700" />
            <Card label="Overdue Rate"              value={s?.checkedOut ? pct(s.overdue, s.checkedOut) : '—'}   sub="overdue ÷ all checked-out items"                         color="text-red-600" />
            <Card label="Severe Overdue Ratio"      value={s?.overdue ? pct(s.overdueOver30Days, s.overdue) : '—'} sub=">30 days overdue ÷ all overdue — non-return risk"      color="text-red-700" />
            <Card label="Hold Fill Rate"            value={((s?.pendingHolds ?? 0) + (s?.readyHolds ?? 0)) > 0 ? pct(s?.readyHolds ?? 0, (s?.pendingHolds ?? 0) + (s?.readyHolds ?? 0)) : '—'} sub="ready holds ÷ total active holds" color="text-teal-700" />
          </Section>

          {/* ── Section 2: Composition Charts ── */}
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <span>📊</span>Collection Composition
            </h2>
            <div className="grid grid-cols-1 gap-6">

              {/* Material Type */}
              {materialTypeData.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm p-5">
                  <p className="text-sm font-semibold text-gray-700 mb-1">By Material Type</p>
                  <p className="text-xs text-gray-400 mb-3">What the collection contains — Book, Periodical, Thesis, AV, e-Resource, etc.</p>
                  <ResponsiveContainer width="100%" height={Math.max(200, materialTypeData.length * 40)}>
                    <BarChart data={materialTypeData} layout="vertical" margin={{left:160,right:60,top:4,bottom:4}}>
                      <XAxis type="number" tick={{fontSize:11}} />
                      <YAxis type="category" dataKey="name" tick={{fontSize:11}} width={155} />
                      <Tooltip formatter={(v:unknown) => Number(v).toLocaleString()} />
                      <Legend />
                      <Bar dataKey="items" name="Items" fill="#7c3aed" />
                      <Bar dataKey="titles" name="Titles" fill="#a78bfa" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Dewey Category */}
              <div className="bg-white rounded-xl shadow-sm p-5">
                <p className="text-sm font-semibold text-gray-700 mb-1">By Dewey Decimal Category</p>
                <p className="text-xs text-gray-400 mb-3">Subject distribution of the collection</p>
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

              {/* Sublocation */}
              <div className="bg-white rounded-xl shadow-sm p-5">
                <p className="text-sm font-semibold text-gray-700 mb-1">By Sublocation / Section</p>
                <p className="text-xs text-gray-400 mb-3">Physical placement within the library</p>
                <ResponsiveContainer width="100%" height={Math.max(200, sublocData.length * 36)}>
                  <BarChart data={sublocData} layout="vertical" margin={{left:140,right:40,top:4,bottom:4}}>
                    <XAxis type="number" tick={{fontSize:11}} />
                    <YAxis type="category" dataKey="name" tick={{fontSize:11}} width={135} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="total" name="Total" fill="#3b82f6" />
                    <Bar dataKey="checkedOut" name="Checked Out" fill="#f59e0b" />
                    <Bar dataKey="available" name="Available" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Circulation Policy Type */}
              {circTypeData.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm p-5">
                  <p className="text-sm font-semibold text-gray-700 mb-1">By Circulation Policy Type</p>
                  <p className="text-xs text-gray-400 mb-3">Loan rules — Reserve Room (short loan), Regular, Non-circulating, etc.</p>
                  <ResponsiveContainer width="100%" height={Math.max(200, circTypeData.length * 36)}>
                    <BarChart data={circTypeData} layout="vertical" margin={{left:160,right:40,top:4,bottom:4}}>
                      <XAxis type="number" tick={{fontSize:11}} />
                      <YAxis type="category" dataKey="name" tick={{fontSize:11}} width={155} />
                      <Tooltip formatter={(v:unknown) => Number(v).toLocaleString()} />
                      <Legend />
                      <Bar dataKey="total" name="Total" fill="#6366f1" />
                      <Bar dataKey="checkedOut" name="Checked Out" fill="#ec4899" />
                      <Bar dataKey="available" name="Available" fill="#22c55e" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

            </div>
          </div>

          {/* ── Section 3: Collection Currency & Growth ── */}
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <span>📈</span>Collection Currency &amp; Growth
            </h2>
            <div className="grid grid-cols-1 gap-6">

              {acqYearData.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm p-5">
                  <p className="text-sm font-semibold text-gray-700 mb-1">By Year of Acquisition</p>
                  <p className="text-xs text-gray-400 mb-3">Annual additions to the collection since 2010</p>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={acqYearData} margin={{left:10,right:20,top:4,bottom:4}}>
                      <XAxis dataKey="year" tick={{fontSize:11}} />
                      <YAxis tick={{fontSize:11}} />
                      <Tooltip formatter={(v:unknown) => Number(v).toLocaleString()} />
                      <Legend />
                      <Bar dataKey="items" name="Items Added" fill="#3b82f6" />
                      <Bar dataKey="titles" name="Titles Added" fill="#10b981" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {pubYearData.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm p-5">
                  <p className="text-sm font-semibold text-gray-700 mb-1">By Publication Decade</p>
                  <p className="text-xs text-gray-400 mb-3">Age profile of the collection — shows currency of holdings</p>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={pubYearData} margin={{left:10,right:20,top:4,bottom:4}}>
                      <XAxis dataKey="name" tick={{fontSize:11}} />
                      <YAxis tick={{fontSize:11}} />
                      <Tooltip formatter={(v:unknown) => Number(v).toLocaleString()} />
                      <Legend />
                      <Bar dataKey="items" name="Items" fill="#8b5cf6" />
                      <Bar dataKey="titles" name="Titles" fill="#f59e0b" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

            </div>
          </div>

          {/* ── Section 4: Funding & Publisher ── */}
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <span>💰</span>Funding &amp; Publisher Analysis
            </h2>
            <div className="grid grid-cols-1 gap-6">

              {fundingData.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm p-5">
                  <p className="text-sm font-semibold text-gray-700 mb-1">By Funding Source</p>
                  <p className="text-xs text-gray-400 mb-3">Where the collection came from — budget allocation, donations, grants, etc.</p>
                  <ResponsiveContainer width="100%" height={Math.max(200, fundingData.length * 36)}>
                    <BarChart data={fundingData} layout="vertical" margin={{left:140,right:40,top:4,bottom:4}}>
                      <XAxis type="number" tick={{fontSize:11}} />
                      <YAxis type="category" dataKey="name" tick={{fontSize:11}} width={135} />
                      <Tooltip formatter={(v:unknown) => Number(v).toLocaleString()} />
                      <Legend />
                      <Bar dataKey="total" name="Total" fill="#0ea5e9" />
                      <Bar dataKey="checkedOut" name="Checked Out" fill="#f97316" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {publisherData.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm p-5">
                  <p className="text-sm font-semibold text-gray-700 mb-1">Top 20 Publishers by Titles</p>
                  <p className="text-xs text-gray-400 mb-3">Publisher diversity — important for accreditation collection variety requirements</p>
                  <ResponsiveContainer width="100%" height={Math.max(300, publisherData.length * 28)}>
                    <BarChart data={publisherData} layout="vertical" margin={{left:160,right:60,top:4,bottom:4}}>
                      <XAxis type="number" tick={{fontSize:11}} />
                      <YAxis type="category" dataKey="name" tick={{fontSize:10}} width={155} />
                      <Tooltip formatter={(v:unknown) => Number(v).toLocaleString()} />
                      <Legend />
                      <Bar dataKey="titles" name="Titles" fill="#06b6d4" />
                      <Bar dataKey="items" name="Items" fill="#84cc16" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

            </div>
          </div>

          {/* ── Section 5: Collection Activity Cross-Analysis ── */}
          {(materialTypeData.length > 0 || sublocData.length > 0 || catData.length > 0 || circTypeData.length > 0) && (
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-2">
                <span>🔥</span>Collection Activity — Utilization by Category
              </h2>
              <p className="text-xs text-gray-400 mb-4">What is actually being used — checked-out items as a % of total per category. Higher % = higher demand.</p>
              <div className="grid grid-cols-1 gap-6">

                {/* Utilization rate by Material Type */}
                {(() => {
                  const sorted = [...materialTypeData].filter(r => r.items > 0).sort((a,b) => b.utilRate - a.utilRate);
                  if (sorted.length === 0) return null;
                  return (
                    <div className="bg-white rounded-xl shadow-sm p-5">
                      <p className="text-sm font-semibold text-gray-700 mb-1">Utilization Rate by Material Type</p>
                      <p className="text-xs text-gray-400 mb-3">Which material formats are in highest demand right now</p>
                      <ResponsiveContainer width="100%" height={Math.max(200, sorted.length * 40)}>
                        <BarChart data={sorted} layout="vertical" margin={{left:160,right:60,top:4,bottom:4}}>
                          <XAxis type="number" tick={{fontSize:11}} unit="%" domain={[0,100]} />
                          <YAxis type="category" dataKey="name" tick={{fontSize:11}} width={155} />
                          <Tooltip formatter={(v:unknown) => Number(v).toFixed(1) + '%'} />
                          <Bar dataKey="utilRate" name="Utilization %" radius={[0,4,4,0]}>
                            {sorted.map((r, i) => (
                              <Cell key={i} fill={r.utilRate > 50 ? '#ef4444' : r.utilRate > 20 ? '#f59e0b' : '#10b981'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="overflow-x-auto mt-4">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="bg-gray-100 text-gray-700 uppercase tracking-wide">
                              <th className="text-left p-2 border border-gray-200">Material Type</th>
                              <th className="text-right p-2 border border-gray-200">Total Items</th>
                              <th className="text-right p-2 border border-gray-200">Checked Out</th>
                              <th className="text-right p-2 border border-gray-200">Available</th>
                              <th className="text-right p-2 border border-gray-200">Utilization %</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sorted.map((r, i) => (
                              <tr key={i} className={i%2===0?'bg-white':'bg-gray-50'}>
                                <td className="p-2 border border-gray-200 font-semibold text-gray-900">{r.name}</td>
                                <td className="p-2 border border-gray-200 text-right text-gray-800">{r.items.toLocaleString()}</td>
                                <td className="p-2 border border-gray-200 text-right text-amber-700 font-semibold">{r.checkedOut.toLocaleString()}</td>
                                <td className="p-2 border border-gray-200 text-right text-green-700">{r.available.toLocaleString()}</td>
                                <td className="p-2 border border-gray-200 text-right">
                                  <span className={`font-bold ${r.utilRate > 50 ? 'text-red-600' : r.utilRate > 20 ? 'text-amber-600' : 'text-green-600'}`}>{r.utilRate}%</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}

                {/* Utilization rate by Sublocation */}
                {sublocData.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm p-5">
                    <p className="text-sm font-semibold text-gray-700 mb-1">Utilization Rate by Sublocation</p>
                    <p className="text-xs text-gray-400 mb-3">Which library sections have highest demand — guides shelving, staffing, and signage decisions</p>
                    <ResponsiveContainer width="100%" height={Math.max(200, sublocData.length * 36)}>
                      <BarChart
                        data={[...sublocData].map(r => ({ ...r, utilRate: r.total ? parseFloat((r.checkedOut/r.total*100).toFixed(1)) : 0 })).sort((a,b) => b.utilRate - a.utilRate)}
                        layout="vertical"
                        margin={{left:140,right:60,top:4,bottom:4}}
                      >
                        <XAxis type="number" tick={{fontSize:11}} unit="%" domain={[0,100]} />
                        <YAxis type="category" dataKey="name" tick={{fontSize:11}} width={135} />
                        <Tooltip formatter={(v:unknown) => Number(v).toFixed(1)+'%'} />
                        <Bar dataKey="utilRate" name="Utilization %" fill="#3b82f6" radius={[0,4,4,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Utilization rate by Dewey category */}
                {catData.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm p-5">
                    <p className="text-sm font-semibold text-gray-700 mb-1">Utilization Rate by Dewey Category</p>
                    <p className="text-xs text-gray-400 mb-3">Which subjects are most in demand — informs targeted acquisition spending</p>
                    <ResponsiveContainer width="100%" height={Math.max(200, catData.length * 36)}>
                      <BarChart
                        data={[...catData].map(r => ({ ...r, utilRate: r.total ? parseFloat((r.checkedOut/r.total*100).toFixed(1)) : 0 })).sort((a,b) => b.utilRate - a.utilRate)}
                        layout="vertical"
                        margin={{left:160,right:60,top:4,bottom:4}}
                      >
                        <XAxis type="number" tick={{fontSize:11}} unit="%" domain={[0,100]} />
                        <YAxis type="category" dataKey="name" tick={{fontSize:11}} width={155} />
                        <Tooltip formatter={(v:unknown) => Number(v).toFixed(1)+'%'} />
                        <Bar dataKey="utilRate" name="Utilization %" fill="#8b5cf6" radius={[0,4,4,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Utilization rate by Circulation Type */}
                {circTypeData.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm p-5">
                    <p className="text-sm font-semibold text-gray-700 mb-1">Utilization Rate by Circulation Policy</p>
                    <p className="text-xs text-gray-400 mb-3">Loan policy types that are most actively borrowed — supports review of loan period rules</p>
                    <ResponsiveContainer width="100%" height={Math.max(200, circTypeData.length * 36)}>
                      <BarChart
                        data={[...circTypeData].map(r => ({ ...r, utilRate: r.total ? parseFloat((r.checkedOut/r.total*100).toFixed(1)) : 0 })).sort((a,b) => b.utilRate - a.utilRate)}
                        layout="vertical"
                        margin={{left:160,right:60,top:4,bottom:4}}
                      >
                        <XAxis type="number" tick={{fontSize:11}} unit="%" domain={[0,100]} />
                        <YAxis type="category" dataKey="name" tick={{fontSize:11}} width={155} />
                        <Tooltip formatter={(v:unknown) => Number(v).toFixed(1)+'%'} />
                        <Bar dataKey="utilRate" name="Utilization %" fill="#6366f1" radius={[0,4,4,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

              </div>
            </div>
          )}

        </div>

        {/* Tab: ISO Standards */}
        <div className={activeTab === 'iso' ? 'block' : 'hidden print:block'}>
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

          <Section title="ISO 11620:2014 Performance Indicators" icon="📋">
            <Card label="% of Stock Not Used" value={pct(s?.neverCheckedOut ?? 0, s?.totalItems ?? 0)} sub="ISO 11620 B.2.1.3 — items never borrowed / total items" color="text-amber-700" />
            <Card label="Loans per Capita" value={s?.totalPatrons ? (s.checkoutsThisYear / s.totalPatrons).toFixed(2) : '—'} sub={`ISO 11620 B.2.1.2 — loans / registered users — ${periodLabel}`} color="text-indigo-700" />
            <Card label="Collection Turnover" value={s?.totalItems ? (s.checkoutsThisYear / s.totalItems).toFixed(3) : '—'} sub={`ISO 11620 B.2.1.1 — loans / total items — ${periodLabel}`} color="text-indigo-700" />
            <Card label="% Target Population Reached" value={pct(s?.activePatronsThisYear ?? 0, s?.totalPatrons ?? 0)} sub={`ISO 11620 B.2.4.1 — active borrowers / registered users — ${periodLabel}`} color="text-blue-700" />
            <Card label="Hold Request Rate" value={s?.checkoutsThisYear ? pct(s.holdsPlacedThisYear, s.checkoutsThisYear) : '—'} sub="ISO 11620 B.1.1 — holds placed vs loans (demand proxy)" color="text-purple-700" />
            <Card label="Avg Loan Duration" value={s?.avgLoanDays !== undefined ? s.avgLoanDays.toFixed(1) + ' days' : '—'} sub={`ISO 11620 B.2.1 — avg days per loan — ${periodLabel}`} color="text-cyan-700" />
          </Section>

          <Section title="ISO 21001:2018 Educational Support Indicators" icon="🎓">
            <Card label="Learning Resource Availability" value={pct(s?.available ?? 0, s?.totalItems ?? 0)} sub="ISO 21001 §8.3 — shelf-ready items / total collection" color="text-emerald-700" />
            <Card label="Learner Support Rate" value={pct(s?.patronsWithCheckouts ?? 0, s?.totalPatrons ?? 0)} sub="ISO 21001 §8.3 — learners currently borrowing / registered" color="text-emerald-700" />
            <Card label="Titles per Learner" value={s?.totalPatrons ? (s.uniqueTitles / s.totalPatrons).toFixed(2) : '—'} sub="ISO 21001 §8.3 — unique titles / registered users (breadth)" color="text-teal-700" />
            <Card label="Severe Overdue Ratio" value={s?.overdue ? pct(s.overdueOver30Days, s.overdue) : '—'} sub="ISO 21001 §8.3 — items overdue &gt;30 days / all overdue (non-return risk)" color="text-red-700" />
            <Card label="New Items per Learner" value={s?.totalPatrons ? (s.newItemsThisYear / s.totalPatrons).toFixed(2) : '—'} sub={`ISO 21001 §8.3 — new acquisitions / learners — ${s?.year}`} color="text-blue-700" />
            <Card label="Active Borrower Growth" value={s?.totalPatrons ? pct(s.activePatronsLast30Days, s.totalPatrons) : '—'} sub="ISO 21001 §9.1 — patrons active last 30 days / total (recent engagement)" color="text-violet-700" />
          </Section>
        </div>

        {/* Tab: CHED CMO 22 */}
        <div className={activeTab === 'ched' ? 'block' : 'hidden print:block'}>
          {activeTab === 'ched' && !chedStats && (
            <div className="text-center py-12 text-gray-400 text-sm">Loading CHED metrics…</div>
          )}
          {chedStats?.error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <strong>Error:</strong> {String(chedStats.error)}
            </div>
          )}
          {chedStats && !chedStats.error && (
            <>
              <Section title="§4.b.1 — Minimum Title Requirement" icon="📖">
                <div className="bg-white rounded-xl shadow-sm p-5 flex flex-col gap-1 print:shadow-none print:border print:border-gray-200">
                  <div className={`text-3xl font-bold ${(chedStats.totalTitles ?? 0) >= 5000 ? 'text-green-700' : 'text-red-600'}`}>
                    {Number(chedStats.totalTitles ?? 0).toLocaleString()}
                  </div>
                  <div className="text-sm font-medium text-gray-600">Total Book Titles</div>
                  <div className={`text-xs mt-0.5 font-semibold ${(chedStats.totalTitles ?? 0) >= 5000 ? 'text-green-600' : 'text-red-500'}`}>
                    {(chedStats.totalTitles ?? 0) >= 5000 ? '✓ Meets' : '✗ Below'} CHED minimum of 5,000 titles
                  </div>
                </div>
                <Card label="Total Volumes (Items)" value={Number(chedStats.totalItems ?? 0).toLocaleString()} sub="§4.b — total physical copies in active collection" />
                <Card label="Items Acquired ≤ 5 Years" value={Number(chedStats.itemsLast5Years ?? 0).toLocaleString()} sub={`§4.b.4 — ${pct(chedStats.itemsLast5Years, chedStats.totalItems)} of collection current`} color="text-indigo-700" />
                <Card label="Items Acquired ≤ 10 Years" value={Number(chedStats.itemsLast10Years ?? 0).toLocaleString()} sub={`§4.b — ${pct(chedStats.itemsLast10Years, chedStats.totalItems)} of collection within 10 years`} color="text-indigo-700" />
              </Section>

              <Section title="§4.b.2 — Filipiniana Collection (≥ 10%)" icon="🇵🇭">
                <div className="bg-white rounded-xl shadow-sm p-5 flex flex-col gap-1 print:shadow-none print:border print:border-gray-200">
                  <div className={`text-3xl font-bold ${parseFloat(pct(chedStats.filipianianaItems, chedStats.totalItems)) >= 10 ? 'text-green-700' : 'text-amber-600'}`}>
                    {pct(chedStats.filipianianaItems ?? 0, chedStats.totalItems ?? 0)}
                  </div>
                  <div className="text-sm font-medium text-gray-600">Filipiniana Share</div>
                  <div className={`text-xs mt-0.5 font-semibold ${parseFloat(pct(chedStats.filipianianaItems, chedStats.totalItems)) >= 10 ? 'text-green-600' : 'text-amber-600'}`}>
                    {parseFloat(pct(chedStats.filipianianaItems ?? 0, chedStats.totalItems ?? 0)) >= 10 ? '✓ Meets' : '✗ Below'} 10% requirement
                  </div>
                </div>
                <Card label="Filipiniana Titles" value={Number(chedStats.filipianaTitles ?? 0).toLocaleString()} sub="§4.b.2 — distinct Filipiniana titles" color="text-blue-700" />
                <Card label="Filipiniana Items" value={Number(chedStats.filipianianaItems ?? 0).toLocaleString()} sub="§4.b.2 — Filipiniana sublocation copies" color="text-blue-700" />
              </Section>

              <Section title="§4.a.6 — Weeding Program" icon="✂️">
                <Card label="Total Withdrawn Items" value={Number(chedStats.withdrawnItems ?? 0).toLocaleString()} sub="§4.a.6 — cumulative weeded items" color="text-gray-600" />
                <Card label="Withdrawn This Year" value={Number(chedStats.withdrawnThisYear ?? 0).toLocaleString()} sub={`§4.a.6 — weeded in ${currentYear}`} color="text-gray-600" />
              </Section>

              <Section title="§5.a.iii — Interlibrary Loans" icon="🔄">
                <Card label="Total ILL Transactions" value={Number(chedStats.totalILL ?? 0).toLocaleString()} sub="§5.a.iii — all-time interlibrary loan records" color="text-purple-700" />
                <Card label="ILL This Year" value={Number(chedStats.illThisYear ?? 0).toLocaleString()} sub={`§5.a.iii — interlibrary loans in ${currentYear}`} color="text-purple-700" />
              </Section>

              <Section title="§8 — Financial Resources & Acquisition" icon="💰">
                <Card label="Total Collection Value" value={money(chedStats.totalCollectionValue)} sub="§8 — sum of acquisition prices (active items)" color="text-green-700" />
                <Card label={`Acquisition Spend ${currentYear}`} value={money(chedStats.acquisitionSpendThisYear)} sub="§8 — amount spent on new items this year" color="text-blue-700" />
                <Card label={`Acquisition Spend ${currentYear - 1}`} value={money(chedStats.acquisitionSpendLastYear)} sub="§8 — previous year acquisition spend" color="text-blue-600" />
                <Card label={`Acquisition Spend ${currentYear - 2}`} value={money(chedStats.acquisitionSpendYear2)} sub="§8 — two years prior acquisition spend" color="text-blue-500" />
              </Section>

              {acqData.length > 0 && (
                <div className="mb-8 print:hidden">
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span>📈</span>Annual Acquisitions Trend (2015–{currentYear})
                  </h2>
                  <div className="bg-white rounded-xl shadow-sm p-5">
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={acqData} margin={{left:20,right:20,top:8,bottom:8}}>
                        <XAxis dataKey="year" tick={{fontSize:11}} />
                        <YAxis tick={{fontSize:11}} />
                        <Tooltip formatter={(v:unknown) => Number(v).toLocaleString()} />
                        <Legend />
                        <Bar dataKey="items" name="Items Added" fill="#3b82f6" />
                        <Bar dataKey="titles" name="Titles Added" fill="#10b981" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                <strong>Requires manual documentation (not in library system):</strong> VMGO (§1), Administration qualifications &amp; org structure (§2), Staff ratios &amp; HR data (§3), Collection development policy documents (§4.a, §4.c, §4.d), Physical facilities (§6), IT infrastructure (§7), and Linkages &amp; networking (§9).
              </div>
            </>
          )}
        </div>

        {/* Tab: Insights */}
        <div className={activeTab === 'insights' ? 'block' : 'hidden print:block'}>

          {/* ── Cross-Activity Analysis ── */}
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-2">
              <span>📊</span>Who Uses the Library Most?
            </h2>
            <p className="text-xs text-gray-400 mb-4">
              Cross-tabulation of patron demographics vs. actual borrowing activity — not filtered by the selections above, shows the full population comparison.
            </p>

            {genderActivity.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
                <p className="text-sm font-semibold text-gray-700 mb-1">Activity by Gender</p>
                <p className="text-xs text-gray-400 mb-4">Compares registration count, active borrowers, total checkouts, and overdue items per gender group</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Patron Count &amp; Active Borrowers</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={genderActivity} margin={{left:10,right:10,top:4,bottom:4}}>
                        <XAxis dataKey="name" tick={{fontSize:11}} />
                        <YAxis tick={{fontSize:11}} />
                        <Tooltip formatter={(v:unknown) => Number(v).toLocaleString()} />
                        <Legend />
                        <Bar dataKey="totalPatrons"  name="Registered" fill="#3b82f6" />
                        <Bar dataKey="activePatrons" name="Active Borrowers" fill="#10b981" />
                        <Bar dataKey="overdueItems"  name="Overdue Items" fill="#ef4444" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Engagement Rates (%)</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={genderActivity} margin={{left:10,right:10,top:4,bottom:4}}>
                        <XAxis dataKey="name" tick={{fontSize:11}} />
                        <YAxis tick={{fontSize:11}} unit="%" />
                        <Tooltip formatter={(v:unknown) => Number(v).toFixed(1) + '%'} />
                        <Legend />
                        <Bar dataKey="activeRate"         name="Active Rate %" fill="#8b5cf6" />
                        <Bar dataKey="checkoutsPerPatron" name="Checkouts / Patron" fill="#f59e0b" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-100 text-gray-700 uppercase tracking-wide">
                        <th className="text-left p-2 border border-gray-200">Gender</th>
                        <th className="text-right p-2 border border-gray-200">Registered</th>
                        <th className="text-right p-2 border border-gray-200">Active Borrowers</th>
                        <th className="text-right p-2 border border-gray-200">Active Rate</th>
                        <th className="text-right p-2 border border-gray-200">Total Checkouts</th>
                        <th className="text-right p-2 border border-gray-200">Checkouts / Patron</th>
                        <th className="text-right p-2 border border-gray-200">Overdue Items</th>
                      </tr>
                    </thead>
                    <tbody>
                      {genderActivity.map((r, i) => (
                        <tr key={i} className="hover:bg-blue-50">
                          <td className="p-2 border border-gray-200 font-semibold text-gray-900">{r.name}</td>
                          <td className="p-2 border border-gray-200 text-right text-gray-800">{r.totalPatrons.toLocaleString()}</td>
                          <td className="p-2 border border-gray-200 text-right text-green-700 font-semibold">{r.activePatrons.toLocaleString()}</td>
                          <td className="p-2 border border-gray-200 text-right text-gray-800">{r.activeRate}%</td>
                          <td className="p-2 border border-gray-200 text-right text-blue-700">{r.totalCheckouts.toLocaleString()}</td>
                          <td className="p-2 border border-gray-200 text-right text-indigo-700 font-semibold">{r.checkoutsPerPatron}</td>
                          <td className="p-2 border border-gray-200 text-right text-red-600">{r.overdueItems.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {patronTypeActivity.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
                <p className="text-sm font-semibold text-gray-700 mb-1">Activity by Patron Type</p>
                <p className="text-xs text-gray-400 mb-4">Which patron groups borrow the most — useful for collection development and service prioritization</p>
                <ResponsiveContainer width="100%" height={Math.max(240, patronTypeActivity.length * 36)}>
                  <BarChart data={patronTypeActivity} layout="vertical" margin={{left:140,right:80,top:4,bottom:4}}>
                    <XAxis type="number" tick={{fontSize:11}} />
                    <YAxis type="category" dataKey="name" tick={{fontSize:10}} width={135} />
                    <Tooltip formatter={(v:unknown) => Number(v).toLocaleString()} />
                    <Legend />
                    <Bar dataKey="totalPatrons"  name="Registered" fill="#3b82f6" />
                    <Bar dataKey="activePatrons" name="Active Borrowers" fill="#10b981" />
                    <Bar dataKey="overdueItems"  name="Overdue Items" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-100 text-gray-700 uppercase tracking-wide">
                        <th className="text-left p-2 border border-gray-200">Patron Type</th>
                        <th className="text-right p-2 border border-gray-200">Registered</th>
                        <th className="text-right p-2 border border-gray-200">Active</th>
                        <th className="text-right p-2 border border-gray-200">Active Rate</th>
                        <th className="text-right p-2 border border-gray-200">Total Checkouts</th>
                        <th className="text-right p-2 border border-gray-200">Per Patron</th>
                        <th className="text-right p-2 border border-gray-200">Overdue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {patronTypeActivity.map((r, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="p-2 border border-gray-200 font-semibold text-gray-900">{r.name}</td>
                          <td className="p-2 border border-gray-200 text-right text-gray-800">{r.totalPatrons.toLocaleString()}</td>
                          <td className="p-2 border border-gray-200 text-right text-green-700 font-semibold">{r.activePatrons.toLocaleString()}</td>
                          <td className="p-2 border border-gray-200 text-right text-gray-800">{r.activeRate}%</td>
                          <td className="p-2 border border-gray-200 text-right text-blue-700">{r.totalCheckouts.toLocaleString()}</td>
                          <td className="p-2 border border-gray-200 text-right text-indigo-700 font-semibold">{r.checkoutsPerPatron}</td>
                          <td className="p-2 border border-gray-200 text-right text-red-600">{r.overdueItems.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* ── Green Library Tab ── */}
          <div className={activeTab === 'green' ? 'block' : 'hidden print:block'}>
            {(() => {
              const reuseRate = (s && s.totalItems && s.checkoutsThisYear)
                ? parseFloat((s.checkoutsThisYear / s.totalItems).toFixed(2))
                : null;

              type GreenMetric = {
                id: string; name: string; description: string; unit: string;
                source: string; frequency: string; baseline: number; goal: number;
                computed?: number | null; computedLabel?: string;
              };

              const categories: { name: string; icon: string; color: string; metrics: GreenMetric[] }[] = [
                {
                  name: 'Sustainable Facilities', icon: '🏢', color: 'emerald',
                  metrics: [
                    { id:'LIB-ENV-001', name:'Energy Use Intensity (EUI)', description:'Total annual energy consumption (electricity + natural gas) divided by library square footage.', unit:'kBtu/sq ft/year', source:'Utility Bills & Building Floor Plan', frequency:'Monthly', baseline:55, goal:40 },
                    { id:'LIB-ENV-002', name:'Waste Diversion Rate', description:'Percentage of total library waste diverted from landfills via recycling, composting, or book-donation pipelines.', unit:'%', source:'Waste Management Invoices / Waste Audits', frequency:'Quarterly', baseline:35, goal:75 },
                    { id:'LIB-ENV-003', name:'Water Consumption Intensity', description:'Total water consumed indoors and for facility landscaping per square foot.', unit:'Gallons/sq ft/year', source:'Water Utility Bills', frequency:'Monthly', baseline:12, goal:8.5 },
                  ],
                },
                {
                  name: 'Circulation & Circular Economy', icon: '♻️', color: 'blue',
                  metrics: [
                    { id:'LIB-CIRC-001', name:'Collection Reuse Factor', description:'Average annual checkouts per physical item in the active collection (Turnover Rate).', unit:'Circulations/Item/Year', source:'ILS — computed from dashboard data', frequency:'Annually', baseline:2.1, goal:3.5, computed: reuseRate, computedLabel: reuseRate !== null ? `${reuseRate} checkouts/item` : undefined },
                    { id:'LIB-CIRC-002', name:'Paperless Administration Index', description:'Ratio of digital-only receipts, notices, and registrations versus total processed paper administration.', unit:'%', source:'ILS Notification Logs & Receipts Printer Logs', frequency:'Monthly', baseline:60, goal:95 },
                    { id:'LIB-CIRC-003', name:'Sustainable Procurement %', description:'Percentage of operational, office, and cleaning supplies sourced with eco-labels (EcoLogo, Green Seal, FSC).', unit:'% of Total Spend', source:'Financial Procurement & Invoice Audits', frequency:'Quarterly', baseline:20, goal:60 },
                  ],
                },
                {
                  name: 'Digital Infrastructure', icon: '💻', color: 'violet',
                  metrics: [
                    { id:'LIB-IT-001', name:'E-Waste Recycling Compliance', description:'Percentage of decommissioned IT hardware responsibly recycled via certified e-waste partners.', unit:'%', source:'IT Asset Management / Disposal Receipts', frequency:'Annually', baseline:80, goal:100 },
                    { id:'LIB-IT-002', name:'Public Workstation Power Efficiency', description:'Percentage of active public and staff terminals utilizing automated power-down/sleep schedules outside operating hours.', unit:'%', source:'IT Central Management Console (MDM)', frequency:'Monthly', baseline:50, goal:100 },
                  ],
                },
                {
                  name: 'Community & Literacy', icon: '🌱', color: 'teal',
                  metrics: [
                    { id:'LIB-COM-001', name:'Eco-Programming Density', description:'Percentage of library programs dedicated to sustainability and climate literacy.', unit:'%', source:'Library Events Calendar & Room Booking System', frequency:'Quarterly', baseline:3, goal:10 },
                    { id:'LIB-COM-002', name:'Sustainability Program Engagement', description:'Total annual attendance at environmental/sustainability programs.', unit:'Patrons/Year', source:'Program Gate/Head Counts', frequency:'Monthly', baseline:450, goal:1200 },
                  ],
                },
              ];

              const colorMap: Record<string, { bg: string; border: string; badge: string; bar: string; text: string; head: string }> = {
                emerald: { bg:'bg-emerald-50', border:'border-emerald-200', badge:'bg-emerald-100 text-emerald-700', bar:'bg-emerald-500', text:'text-emerald-700', head:'bg-emerald-600' },
                blue:    { bg:'bg-blue-50',    border:'border-blue-200',    badge:'bg-blue-100 text-blue-700',    bar:'bg-blue-500',    text:'text-blue-700',    head:'bg-blue-600'    },
                violet:  { bg:'bg-violet-50',  border:'border-violet-200',  badge:'bg-violet-100 text-violet-700',bar:'bg-violet-500',  text:'text-violet-700',  head:'bg-violet-600'  },
                teal:    { bg:'bg-teal-50',    border:'border-teal-200',    badge:'bg-teal-100 text-teal-700',    bar:'bg-teal-500',    text:'text-teal-700',    head:'bg-teal-600'    },
              };

              return (
                <div>
                  <div className="mb-6 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl p-5 text-white">
                    <h2 className="text-lg font-bold mb-1">🌿 Green Library KPI Dashboard</h2>
                    <p className="text-sm text-emerald-100">Tracks environmental sustainability metrics aligned with globally recognized green library frameworks. Metrics in blue are computed from ILS data; others require manual tracking from operational records.</p>
                  </div>

                  {categories.map(cat => {
                    const c = colorMap[cat.color];
                    return (
                      <div key={cat.name} className="mb-8">
                        <div className={`flex items-center gap-2 mb-4 px-4 py-2 rounded-lg ${c.head} text-white`}>
                          <span className="text-xl">{cat.icon}</span>
                          <span className="font-bold text-sm">{cat.name}</span>
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                          {cat.metrics.map(m => {
                            const isComputed = m.computed !== undefined && m.computed !== null;
                            const val = isComputed ? m.computed! : null;
                            // For percentage metrics, goal is "higher is better" unless it's a usage metric
                            const lowerIsBetter = m.unit.includes('kBtu') || m.unit.includes('Gallons');
                            const pctToGoal = val !== null
                              ? lowerIsBetter
                                ? Math.min(100, Math.max(0, ((m.baseline - val) / (m.baseline - m.goal)) * 100))
                                : Math.min(100, Math.max(0, ((val - m.baseline) / (m.goal - m.baseline)) * 100))
                              : null;

                            return (
                              <div key={m.id} className={`rounded-xl border ${c.border} ${c.bg} p-5`}>
                                <div className="flex items-start justify-between gap-4 mb-2">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs font-mono text-gray-400">{m.id}</span>
                                      <span className="font-semibold text-gray-900 text-sm">{m.name}</span>
                                      {isComputed
                                        ? <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">ILS computed</span>
                                        : <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Manual tracking</span>
                                      }
                                      <span className={`text-xs px-2 py-0.5 rounded-full ${c.badge}`}>{m.frequency}</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">{m.description}</p>
                                    <p className="text-xs text-gray-400 mt-0.5">Source: {m.source}</p>
                                  </div>
                                  <div className="text-right shrink-0">
                                    {isComputed && val !== null ? (
                                      <>
                                        <div className={`text-2xl font-bold ${c.text}`}>{val}</div>
                                        <div className="text-xs text-gray-400">{m.unit}</div>
                                      </>
                                    ) : (
                                      <div className="text-sm text-gray-400 italic">Not yet measured</div>
                                    )}
                                  </div>
                                </div>

                                {/* Progress bar: baseline → current → goal */}
                                <div className="mt-3">
                                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                                    <span>Baseline: {m.baseline} {m.unit}</span>
                                    <span className={`font-semibold ${c.text}`}>Goal: {m.goal} {m.unit}</span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                    {pctToGoal !== null ? (
                                      <div
                                        className={`h-2 rounded-full transition-all ${c.bar} ${pctToGoal >= 100 ? 'opacity-100' : 'opacity-80'}`}
                                        style={{ width: `${Math.max(4, pctToGoal)}%` }}
                                      />
                                    ) : (
                                      <div className="h-2 rounded-full bg-gray-300 w-1/6 opacity-40" />
                                    )}
                                  </div>
                                  {pctToGoal !== null && (
                                    <div className="text-xs text-gray-500 mt-1">
                                      {pctToGoal >= 100
                                        ? <span className="text-emerald-600 font-semibold">✓ Goal achieved</span>
                                        : <span>{pctToGoal.toFixed(0)}% of the way from baseline to green goal</span>
                                      }
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                    <strong>Note:</strong> &quot;Manual tracking&quot; metrics are not stored in Follett Destiny. Record current values in a separate spreadsheet or tracking system and compare against the targets above. Only the <em>Collection Reuse Factor</em> (LIB-CIRC-001) is automatically computed from your ILS circulation data.
                  </div>
                </div>
              );
            })()}
          </div>

          {/* ── Recommended Actions ── */}
          {s && !s.error && <RecommendedActions stats={s} chedStats={chedStats} year={year} />}
        </div>
      </main>
    </div>
  );
}

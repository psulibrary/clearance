'use client';

import { useEffect, useState, useCallback, Component } from 'react';
import type { ReactNode } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="p-6 bg-red-50 border border-red-300 rounded-xl text-red-800 text-sm">
          <strong>⚠️ Tab crashed:</strong> {this.state.error}
          <br /><span className="text-xs mt-1 block">Please copy this error and report it.</span>
        </div>
      );
    }
    return this.props.children;
  }
}

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
      {sub && <div className="text-xs text-gray-600 mt-0.5">{sub}</div>}
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
      <p className="text-xs text-gray-600 mb-4">Auto-generated from current stats. Prioritized by urgency.</p>

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
              {r.metric && <p className="text-xs text-gray-600 font-mono">📌 {r.metric}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Strategic Planning Tab ───────────────────────────────────────────────────

type StrategicStored = { enrolledStudents: number | null; annualBudget: number | null };

function StrategicTab({
  stats,
  mainStats,
  year,
  unlocked,
}: {
  stats: Record<string, number> | null;
  mainStats: Stats | null;
  year: number;
  unlocked: boolean;
}) {
  const [stored, setStored]           = useState<StrategicStored>({ enrolledStudents: null, annualBudget: null });
  const [sbLoading, setSbLoading]     = useState(false);
  const [sbError, setSbError]         = useState<string | null>(null);
  const [editing, setEditing]         = useState<'enrolledStudents' | 'annualBudget' | null>(null);
  const [draft, setDraft]             = useState('');
  const [saving, setSaving]           = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const { supabase } = await import('@/lib/supabase');
        const { data, error } = await supabase
          .from('green_metrics')
          .select('metric_id, value')
          .in('metric_id', ['STRAT-ENROLLED', 'STRAT-BUDGET'])
          .order('recorded_on', { ascending: false });
        if (error) { setSbError(error.message); return; }
        const map: StrategicStored = { enrolledStudents: null, annualBudget: null };
        for (const row of data ?? []) {
          if (row.metric_id === 'STRAT-ENROLLED' && map.enrolledStudents === null)
            map.enrolledStudents = Number(row.value);
          if (row.metric_id === 'STRAT-BUDGET' && map.annualBudget === null)
            map.annualBudget = Number(row.value);
        }
        setStored(map);
      } catch (err: unknown) {
        setSbError(err instanceof Error ? err.message : String(err));
      } finally {
        setSbLoading(false);
      }
    }
    load();
  }, []);

  async function saveManual(key: 'enrolledStudents' | 'annualBudget') {
    const num = parseFloat(draft);
    if (isNaN(num) || num <= 0) { setEditing(null); return; }
    setSaving(true);
    try {
      const { supabase } = await import('@/lib/supabase');
      const metricId = key === 'enrolledStudents' ? 'STRAT-ENROLLED' : 'STRAT-BUDGET';
      const today = new Date().toISOString().slice(0, 10);
      await supabase.from('green_metrics').upsert(
        { metric_id: metricId, recorded_on: today, value: num, notes: null },
        { onConflict: 'metric_id,recorded_on' },
      );
      setStored(prev => ({ ...prev, [key]: num }));
    } catch {
      // ignore save errors silently
    } finally {
      setSaving(false);
      setEditing(null);
    }
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <svg className="animate-spin w-6 h-6 mr-3" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        Loading strategic metrics…
      </div>
    );
  }

  if ((stats as Record<string,unknown>).error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-700 text-sm">
        <strong>Strategic KPI data error:</strong> {String((stats as Record<string,unknown>).error)}
      </div>
    );
  }

  const enrolled = stored.enrolledStudents;
  const budget   = stored.annualBudget;

  const totalItems        = stats.totalItems ?? 0;
  const totalTitles       = stats.totalTitles ?? 0;
  const totalPatrons      = stats.totalPatrons ?? 0;
  const activeBorrowers   = stats.activeBorrowersThisYear ?? 0;
  const checkoutsThisYear = stats.checkoutsThisYear ?? 0;
  const itemsLast10Years  = stats.itemsLast10Years ?? 0;
  const overdueCount      = stats.overdueCount ?? 0;
  const newPatrons        = stats.newPatronsThisYear ?? 0;

  // KPI computations
  const activeBorrowerRate   = totalPatrons > 0 ? (activeBorrowers / totalPatrons) * 100 : null;
  const perCapitaCirc        = enrolled && enrolled > 0 ? checkoutsThisYear / enrolled : null;
  const collectionCurrency   = totalItems > 0 ? (itemsLast10Years / totalItems) * 100 : null;
  const costPerCirculation   = budget && checkoutsThisYear > 0 ? budget / checkoutsThisYear : null;
  const duplicateRatio       = totalTitles > 0 ? totalItems / totalTitles : null;
  const overdueRate          = checkoutsThisYear > 0 ? (overdueCount / checkoutsThisYear) * 100 : null;

  type KPI = {
    id: string;
    name: string;
    icon: string;
    value: number | null;
    unit: string;
    baseline: number;
    goal: number;
    lowerIsBetter: boolean;
    source: string;
    desc: string;
    note?: string;
  };

  const kpis: KPI[] = [
    {
      id: 'active-borrower-rate',
      name: 'Active Borrower Rate',
      icon: '👥',
      value: activeBorrowerRate,
      unit: '%',
      baseline: 30,
      goal: 65,
      lowerIsBetter: false,
      source: 'ILS — auto-computed',
      desc: 'Percentage of registered patrons who borrowed at least one item this year. A low rate signals untapped patronage.',
      note: `${fmt(activeBorrowers)} active of ${fmt(totalPatrons)} total patrons`,
    },
    {
      id: 'per-capita-circ',
      name: 'Per-Capita Circulation',
      icon: '📖',
      value: perCapitaCirc,
      unit: 'checkouts/student',
      baseline: 2,
      goal: 6,
      lowerIsBetter: false,
      source: enrolled ? 'ILS ÷ enrolled students (manual)' : 'Needs enrolled student count ↓',
      desc: 'Annual checkouts ÷ enrolled student headcount. UNESCO/ISO benchmarks suggest ≥5 for academic libraries.',
      note: enrolled ? `${fmt(checkoutsThisYear)} checkouts ÷ ${fmt(enrolled)} students` : undefined,
    },
    {
      id: 'collection-currency',
      name: 'Collection Currency Rate',
      icon: '🆕',
      value: collectionCurrency,
      unit: '% items ≤10 yrs old',
      baseline: 35,
      goal: 60,
      lowerIsBetter: false,
      source: 'ILS — auto-computed',
      desc: 'Percentage of the active collection acquired in the last 10 years. Outdated collections fail accreditation reviews.',
      note: `${fmt(itemsLast10Years)} of ${fmt(totalItems)} items acquired since ${year - 10}`,
    },
    {
      id: 'cost-per-circ',
      name: 'Cost per Circulation',
      icon: '💰',
      value: costPerCirculation,
      unit: '₱ / checkout',
      baseline: 500,
      goal: 200,
      lowerIsBetter: true,
      source: budget ? 'ILS ÷ annual budget (manual)' : 'Needs annual library budget ↓',
      desc: 'Annual library budget ÷ total checkouts. Measures ROI of library spend. Lower means each item borrowed costs less.',
      note: budget ? `₱${budget.toLocaleString()} budget ÷ ${fmt(checkoutsThisYear)} checkouts` : undefined,
    },
    {
      id: 'duplicate-ratio',
      name: 'Duplicate Ratio',
      icon: '📚',
      value: duplicateRatio,
      unit: 'items / title',
      baseline: 1.5,
      goal: 2.5,
      lowerIsBetter: false,
      source: 'ILS — auto-computed',
      desc: 'Total items ÷ unique titles. A ratio below 1.5 means too few copies; above 4 may indicate redundant purchasing.',
      note: `${fmt(totalItems)} items across ${fmt(totalTitles)} titles`,
    },
    {
      id: 'overdue-rate',
      name: 'Overdue Rate',
      icon: '⏰',
      value: overdueRate,
      unit: '% of active loans',
      baseline: 20,
      goal: 5,
      lowerIsBetter: true,
      source: 'ILS — auto-computed',
      desc: 'Overdue items as a percentage of total checkouts this year. High rates signal poor return compliance or overly long loan periods.',
      note: `${fmt(overdueCount)} overdue items`,
    },
  ];

  function ManualInput({ fieldKey, label, placeholder, prefix }: { fieldKey: 'enrolledStudents' | 'annualBudget'; label: string; placeholder: string; prefix?: string }) {
    const val = stored[fieldKey];
    const isEdit = editing === fieldKey;
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-gray-700">{label}</div>
          {val !== null
            ? <div className="text-xl font-bold text-indigo-700 mt-0.5">{prefix ?? ''}{val.toLocaleString()}</div>
            : <div className="text-sm text-gray-400 italic mt-0.5">Not set</div>
          }
        </div>
        {isEdit ? (
          <div className="flex items-center gap-2">
            <input
              type="number" step="1" min="1"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              className="w-32 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder={placeholder}
              autoFocus
            />
            <button onClick={() => saveManual(fieldKey)} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setEditing(null)} className="text-xs text-gray-500 hover:text-gray-700 px-2">Cancel</button>
          </div>
        ) : (
          <button onClick={() => { setDraft(val !== null ? String(val) : ''); setEditing(fieldKey); }}
            className="text-xs font-semibold border border-gray-300 hover:border-indigo-400 hover:text-indigo-700 text-gray-600 px-3 py-1.5 rounded-lg transition-colors">
            {val !== null ? '✏️ Update' : '+ Enter'}
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl p-5 text-white">
        <h2 className="text-lg font-bold mb-1">📊 Strategic Planning Dashboard</h2>
        <p className="text-sm text-indigo-100">
          Key Performance Indicators for institutional planning, accreditation, and budget justification.
          Auto-computed metrics come directly from your ILS. Enter your enrolled student count and annual budget to unlock per-capita and cost metrics.
        </p>
      </div>

      {/* Manual inputs — gated behind password */}
      {unlocked && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">📝 Manual Inputs (stored in Supabase)</h3>
          {sbError && (
            <div className="mb-3 p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-800">
              ⚠️ Could not load saved values from Supabase ({sbError}). You can still enter values below — create the <code>green_metrics</code> table in Supabase first to enable saving.
            </div>
          )}
          {sbLoading ? null : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ManualInput fieldKey="enrolledStudents" label="Total Enrolled Students" placeholder="e.g. 3500" />
              <ManualInput fieldKey="annualBudget" label="Annual Library Budget (₱)" placeholder="e.g. 500000" prefix="₱" />
            </div>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">📈 KPI Metrics ({year})</h3>
      <div className="grid grid-cols-1 gap-4 mb-8">
        {kpis.map(kpi => {
          const lob = kpi.lowerIsBetter;
          const pct = kpi.value !== null
            ? lob
              ? Math.min(100, Math.max(0, ((kpi.baseline - kpi.value) / (kpi.baseline - kpi.goal)) * 100))
              : Math.min(100, Math.max(0, ((kpi.value - kpi.baseline) / (kpi.goal - kpi.baseline)) * 100))
            : null;
          const achieved = pct !== null && pct >= 100;
          const needsInput = kpi.value === null && (kpi.id === 'per-capita-circ' || kpi.id === 'cost-per-circ');

          return (
            <div key={kpi.id} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-lg">{kpi.icon}</span>
                    <span className="font-semibold text-gray-900 text-sm">{kpi.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${kpi.source.includes('manual') || kpi.source.includes('Needs') ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                      {kpi.source.includes('ILS') ? 'ILS auto' : 'Manual input'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{kpi.desc}</p>
                  {kpi.note && <p className="text-xs text-gray-600 mt-0.5 font-mono">📌 {kpi.note}</p>}
                </div>
                <div className="text-right shrink-0 min-w-[110px]">
                  {kpi.value !== null ? (
                    <>
                      <div className={`text-2xl font-bold ${achieved ? 'text-emerald-600' : 'text-indigo-700'}`}>
                        {kpi.id === 'cost-per-circ' ? `₱${kpi.value.toFixed(0)}` : kpi.value.toFixed(kpi.value < 10 ? 2 : 1)}
                      </div>
                      <div className="text-xs text-gray-600">{kpi.unit}</div>
                    </>
                  ) : needsInput ? (
                    <div className="text-xs text-amber-600 italic text-right">Enter value above</div>
                  ) : (
                    <div className="text-sm text-gray-600 italic">No data</div>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Baseline: <strong>{kpi.id === 'cost-per-circ' ? `₱${kpi.baseline}` : kpi.baseline}</strong></span>
                  <span className="font-semibold text-indigo-700">Goal: {kpi.id === 'cost-per-circ' ? `₱${kpi.goal}` : kpi.goal} {kpi.id !== 'cost-per-circ' ? kpi.unit : ''}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                  {pct !== null
                    ? <div className={`h-2.5 rounded-full transition-all ${achieved ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${Math.max(3, pct)}%` }} />
                    : <div className="h-2.5 w-8 rounded-full bg-gray-200 opacity-60" />
                  }
                </div>
                {pct !== null && (
                  <p className="text-xs mt-1">
                    {achieved
                      ? <span className="text-emerald-600 font-semibold">✓ Goal achieved!</span>
                      : <span className="text-gray-500">{pct.toFixed(0)}% progress toward goal</span>
                    }
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary scorecard */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 mb-4">
        <h3 className="text-sm font-bold text-indigo-800 mb-3">📋 Summary Scorecard</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-white rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-gray-800">{fmt(totalItems)}</div>
            <div className="text-xs text-gray-500">Total Active Items</div>
          </div>
          <div className="bg-white rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-gray-800">{fmt(totalTitles)}</div>
            <div className="text-xs text-gray-500">Unique Titles</div>
          </div>
          <div className="bg-white rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-gray-800">{fmt(totalPatrons)}</div>
            <div className="text-xs text-gray-500">Registered Patrons</div>
          </div>
          <div className="bg-white rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-indigo-700">{fmt(activeBorrowers)}</div>
            <div className="text-xs text-gray-500">Active Borrowers {year}</div>
          </div>
          <div className="bg-white rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-indigo-700">{fmt(checkoutsThisYear)}</div>
            <div className="text-xs text-gray-500">Checkouts {year}</div>
          </div>
          <div className="bg-white rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-indigo-700">{fmt(newPatrons)}</div>
            <div className="text-xs text-gray-500">New Patrons {year}</div>
          </div>
        </div>
      </div>

      <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-500">
        <strong>Data source:</strong> All auto-computed metrics query your Destiny ILS database in real-time. Manual inputs (enrolled students, annual budget) are saved to Supabase and persist across sessions. Use the main dashboard&apos;s Export CSV for full operational data.
      </div>
    </div>
  );
}

// ── Green Library KPI Tab ────────────────────────────────────────────────────

const GREEN_METRICS = [
  { id:'LIB-ENV-001', cat:'Sustainable Facilities',      icon:'🏢', color:'emerald', name:'Energy Use Intensity (EUI)',          unit:'kBtu/sq ft/yr',   baseline:55,  goal:40,   lowerIsBetter:true,  freq:'Monthly',   desc:'Total annual energy (electricity + gas) ÷ library sq footage.',          source:'Utility Bills & Building Floor Plan' },
  { id:'LIB-ENV-002', cat:'Sustainable Facilities',      icon:'🏢', color:'emerald', name:'Waste Diversion Rate',               unit:'%',               baseline:35,  goal:75,   lowerIsBetter:false, freq:'Quarterly', desc:'% of waste diverted from landfills via recycling, composting, or book donation.', source:'Waste Management Invoices / Waste Audits' },
  { id:'LIB-ENV-003', cat:'Sustainable Facilities',      icon:'🏢', color:'emerald', name:'Water Consumption Intensity',        unit:'Gal/sq ft/yr',    baseline:12,  goal:8.5,  lowerIsBetter:true,  freq:'Monthly',   desc:'Total water consumed (indoor + landscaping) per square foot.',            source:'Water Utility Bills' },
  { id:'LIB-CIRC-001',cat:'Circulation & Circular Economy', icon:'♻️', color:'blue', name:'Collection Reuse Factor',           unit:'Circ/item/yr',    baseline:2.1, goal:3.5,  lowerIsBetter:false, freq:'Annually',  desc:'Average annual checkouts per physical item (Turnover Rate).',             source:'ILS — auto-computed' },
  { id:'LIB-CIRC-002',cat:'Circulation & Circular Economy', icon:'♻️', color:'blue', name:'Paperless Administration Index',    unit:'%',               baseline:60,  goal:95,   lowerIsBetter:false, freq:'Monthly',   desc:'% of receipts, notices, and registrations that are digital-only.',        source:'ILS Notification Logs & Printer Logs' },
  { id:'LIB-CIRC-003',cat:'Circulation & Circular Economy', icon:'♻️', color:'blue', name:'Sustainable Procurement %',         unit:'% of spend',      baseline:20,  goal:60,   lowerIsBetter:false, freq:'Quarterly', desc:'% of supplies sourced with eco-labels (EcoLogo, Green Seal, FSC).',      source:'Financial Procurement & Invoice Audits' },
  { id:'LIB-IT-001',  cat:'Digital Infrastructure',      icon:'💻', color:'violet', name:'E-Waste Recycling Compliance',       unit:'%',               baseline:80,  goal:100,  lowerIsBetter:false, freq:'Annually',  desc:'% of decommissioned IT hardware sent to certified e-waste recyclers.',    source:'IT Asset Management / Disposal Receipts' },
  { id:'LIB-IT-002',  cat:'Digital Infrastructure',      icon:'💻', color:'violet', name:'Workstation Power Efficiency',       unit:'%',               baseline:50,  goal:100,  lowerIsBetter:false, freq:'Monthly',   desc:'% of terminals with automated sleep/power-down outside operating hours.', source:'IT Management Console (MDM)' },
  { id:'LIB-COM-001', cat:'Community & Literacy',        icon:'🌱', color:'teal',   name:'Eco-Programming Density',            unit:'%',               baseline:3,   goal:10,   lowerIsBetter:false, freq:'Quarterly', desc:'% of library programs dedicated to sustainability and climate literacy.', source:'Events Calendar & Room Booking System' },
  { id:'LIB-COM-002', cat:'Community & Literacy',        icon:'🌱', color:'teal',   name:'Sustainability Program Engagement',  unit:'patrons/yr',      baseline:450, goal:1200, lowerIsBetter:false, freq:'Monthly',   desc:'Total annual attendance at environmental/sustainability programs.',       source:'Program Gate/Head Counts' },
] as const;

type MetricID = typeof GREEN_METRICS[number]['id'];

const COLOR = {
  emerald: { bg:'bg-emerald-50', border:'border-emerald-200', head:'bg-emerald-600', bar:'bg-emerald-500', text:'text-emerald-700', badge:'bg-emerald-100 text-emerald-800' },
  blue:    { bg:'bg-blue-50',    border:'border-blue-200',    head:'bg-blue-600',    bar:'bg-blue-500',    text:'text-blue-700',    badge:'bg-blue-100 text-blue-800'       },
  violet:  { bg:'bg-violet-50',  border:'border-violet-200',  head:'bg-violet-600',  bar:'bg-violet-500',  text:'text-violet-700',  badge:'bg-violet-100 text-violet-800'   },
  teal:    { bg:'bg-teal-50',    border:'border-teal-200',    head:'bg-teal-600',    bar:'bg-teal-500',    text:'text-teal-700',    badge:'bg-teal-100 text-teal-800'       },
} as const;

type StoredValues = Record<string, { value: number; notes: string; date: string }>;

function GreenLibraryTab({ reuseRate, unlocked }: { reuseRate: number | null; unlocked: boolean }) {
  const [stored, setStored]       = useState<StoredValues>({});
  const [loading, setLoading]     = useState(false);
  const [supabaseError, setSupabaseError] = useState<string | null>(null);
  const [saving, setSaving]       = useState<MetricID | null>(null);
  const [editing, setEditing]     = useState<MetricID | null>(null);
  const [draft, setDraft]         = useState({ value: '', notes: '' });

  useEffect(() => {
    async function load() {
      try {
        const { supabase } = await import('@/lib/supabase');
        const { data, error } = await supabase
          .from('green_metrics')
          .select('metric_id, value, notes, recorded_on')
          .order('recorded_on', { ascending: false });
        if (error) {
          console.error('Supabase fetch error:', error);
          setSupabaseError(error.message);
        }
        if (data) {
          const map: StoredValues = {};
          for (const row of data) {
            if (!map[row.metric_id]) {
              map[row.metric_id] = { value: Number(row.value), notes: row.notes ?? '', date: row.recorded_on };
            }
          }
          setStored(map);
        }
      } catch (err: unknown) {
        console.error('Supabase error:', err);
        setSupabaseError(err instanceof Error ? err.message : 'Supabase is not configured — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function startEdit(id: MetricID) {
    const cur = stored[id];
    setDraft({ value: cur ? String(cur.value) : '', notes: cur?.notes ?? '' });
    setEditing(id);
  }

  async function saveEdit(id: MetricID) {
    const num = parseFloat(draft.value);
    if (isNaN(num)) { setEditing(null); return; }
    const today = new Date().toISOString().slice(0, 10);
    setSaving(id);
    const { supabase } = await import('@/lib/supabase');
    await supabase.from('green_metrics').upsert({
      metric_id: id, recorded_on: today, value: num, notes: draft.notes || null,
    }, { onConflict: 'metric_id,recorded_on' });
    setStored(prev => ({ ...prev, [id]: { value: num, notes: draft.notes, date: today } }));
    setSaving(null);
    setEditing(null);
  }

  async function clearValue(id: MetricID) {
    const entry = stored[id];
    if (!entry) return;
    const { supabase } = await import('@/lib/supabase');
    await supabase.from('green_metrics').delete().eq('metric_id', id).eq('recorded_on', entry.date);
    setStored(prev => { const n = { ...prev }; delete n[id]; return n; });
  }

  function exportCSV() {
    const rows = ['Metric ID,Name,Unit,Baseline,Green Goal,Current Value,Date Recorded,Notes'];
    for (const m of GREEN_METRICS) {
      const sv = m.id === 'LIB-CIRC-001' ? { value: reuseRate, date: new Date().toISOString().slice(0,10), notes:'Auto from ILS' } : stored[m.id];
      rows.push(`"${m.id}","${m.name}","${m.unit}",${m.baseline},${m.goal},${sv ? sv.value : ''},"${sv?.date ?? ''}","${sv?.notes ?? ''}"`);
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `green-library-kpis-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  }

  const categories = [...new Set(GREEN_METRICS.map(m => m.cat))];



  return (
    <div>
      <div className="mb-6 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl p-5 text-white flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold mb-1">🌿 Green Library KPI Dashboard</h2>
          <p className="text-sm text-emerald-100">Track environmental sustainability metrics. <strong>LIB-CIRC-001</strong> is auto-computed from your ILS. Enter current values for the rest by clicking <em>Update</em> — saved to Supabase and available on any device.</p>
        </div>
        <button onClick={exportCSV} className="shrink-0 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors">
          ↓ Export CSV
        </button>
      </div>

      {supabaseError && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded-xl text-sm text-amber-800">
          <strong>⚠️ Supabase not connected:</strong> {supabaseError}
          <br /><span className="text-xs">Values cannot be saved until Supabase is configured. Make sure <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> are set in your Vercel environment variables and the app has been redeployed.</span>
        </div>
      )}

      {categories.map(cat => {
        const catMetrics = GREEN_METRICS.filter(m => m.cat === cat);
        const c = COLOR[catMetrics[0].color];
        return (
          <div key={cat} className="mb-8">
            <div className={`flex items-center gap-2 mb-4 px-4 py-2 rounded-lg ${c.head} text-white`}>
              <span className="text-xl">{catMetrics[0].icon}</span>
              <span className="font-bold text-sm">{cat}</span>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {catMetrics.map(m => {
                const isAuto  = m.id === 'LIB-CIRC-001';
                const sv      = isAuto ? (reuseRate !== null ? { value: reuseRate, date: new Date().toISOString().slice(0,10), notes: 'Auto-computed from ILS' } : null) : (stored[m.id] ?? null);
                const val     = sv?.value ?? null;
                const lob     = m.lowerIsBetter;
                const pct     = val !== null
                  ? lob
                    ? Math.min(100, Math.max(0, ((m.baseline - val) / (m.baseline - m.goal)) * 100))
                    : Math.min(100, Math.max(0, ((val - m.baseline) / (m.goal - m.baseline)) * 100))
                  : null;
                const isEdit  = editing === m.id;

                return (
                  <div key={m.id} className={`rounded-xl border ${c.border} ${c.bg} p-5`}>
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs font-mono text-gray-600">{m.id}</span>
                          <span className="font-semibold text-gray-900 text-sm">{m.name}</span>
                          {isAuto
                            ? <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">ILS auto</span>
                            : <span className={`text-xs px-2 py-0.5 rounded-full ${c.badge}`}>Manual</span>
                          }
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{m.freq}</span>
                        </div>
                        <p className="text-xs text-gray-500">{m.desc}</p>
                        <p className="text-xs text-gray-600 mt-0.5">Source: {m.source}</p>
                        {sv?.date && <p className="text-xs text-gray-600 mt-0.5">Last recorded: {sv.date}{sv.notes ? ` — ${sv.notes}` : ''}</p>}
                      </div>

                      {/* Current value display */}
                      <div className="text-right shrink-0 min-w-[100px]">
                        {val !== null ? (
                          <>
                            <div className={`text-2xl font-bold ${pct !== null && pct >= 100 ? 'text-emerald-600' : c.text}`}>{val}</div>
                            <div className="text-xs text-gray-600">{m.unit}</div>
                          </>
                        ) : (
                          <div className="text-sm text-gray-600 italic">Not measured</div>
                        )}
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Baseline: <strong>{m.baseline}</strong> {m.unit}</span>
                        <span className={`font-semibold ${c.text}`}>Goal: {m.goal} {m.unit}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                        {pct !== null
                          ? <div className={`h-2.5 rounded-full transition-all ${c.bar}`} style={{ width: `${Math.max(3, pct)}%` }} />
                          : <div className="h-2.5 w-8 rounded-full bg-gray-300 opacity-40" />
                        }
                      </div>
                      {pct !== null && (
                        <p className="text-xs mt-1">
                          {pct >= 100
                            ? <span className="text-emerald-600 font-semibold">✓ Green goal achieved!</span>
                            : <span className="text-gray-500">{pct.toFixed(0)}% progress toward green goal</span>
                          }
                        </p>
                      )}
                    </div>

                    {/* Edit form (manual metrics only, unlocked) */}
                    {!isAuto && unlocked && (
                      isEdit ? (
                        <div className="border-t border-gray-200 pt-3 mt-1 flex flex-wrap gap-2 items-end">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Current value ({m.unit})</label>
                            <input
                              type="number" step="any"
                              value={draft.value}
                              onChange={e => setDraft(d => ({ ...d, value: e.target.value }))}
                              className="w-32 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                              placeholder={`e.g. ${m.baseline}`}
                              autoFocus
                            />
                          </div>
                          <div className="flex-1 min-w-[160px]">
                            <label className="block text-xs text-gray-500 mb-1">Notes (optional)</label>
                            <input
                              type="text"
                              value={draft.notes}
                              onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
                              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                              placeholder="e.g. From July utility bill"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => saveEdit(m.id as MetricID)} disabled={saving === m.id} className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1">
                            {saving === m.id ? <><svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Saving…</> : 'Save'}
                          </button>
                            <button onClick={() => setEditing(null)} className="bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-semibold px-3 py-1.5 rounded-lg">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2 mt-1">
                          <button onClick={() => startEdit(m.id as MetricID)} className="bg-white border border-gray-300 hover:border-emerald-400 hover:text-emerald-700 text-gray-600 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                            {val !== null ? '✏️ Update' : '+ Enter value'}
                          </button>
                          {val !== null && (
                            <button onClick={() => clearValue(m.id as MetricID)} className="text-xs text-gray-400 hover:text-red-500 px-2 py-1.5">✕ Clear</button>
                          )}
                        </div>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="mt-2 p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800">
        <strong>How values are stored:</strong> Entered values are saved to <strong>Supabase</strong> and available on any device or browser. Use <em>Export CSV</em> to download a backup spreadsheet.
      </div>
    </div>
  );
}

// ── International Standards Manual Metrics (IFLA / ALA) ─────────────────────

const ISO_MANUAL_METRICS = [
  // Financial & Management
  { id: 'ISO-FIN-TOTAL-BUDGET',        group: 'Financial & Management', label: 'Total Library Operating Expenditure (₱)',           unit: '₱',         hint: 'Annual operating budget from financial ledger' },
  { id: 'ISO-FIN-COST-PER-USER',       group: 'Financial & Management', label: 'Cost per User (₱)',                                 unit: '₱',         hint: 'Total expenditure ÷ active registered users' },
  { id: 'ISO-FIN-COST-PER-VISIT',      group: 'Financial & Management', label: 'Annual Physical Gate Count (visits)',               unit: 'visits',    hint: 'Annual physical door count for Cost per Visit calculation' },
  { id: 'ISO-FIN-STAFF-COST-PCT',      group: 'Financial & Management', label: 'Staff Costs as % of Operating Expenditures',        unit: '%',         hint: '(Staff compensation ÷ Total budget) × 100' },
  { id: 'ISO-FIN-DIGITAL-BUDGET-PCT',  group: 'Financial & Management', label: '% of Expenditures on Electronic Resources',         unit: '%',         hint: '(Digital content budget ÷ Total collection budget) × 100' },
  // User Perspective — Survey
  { id: 'ISO-UX-SATISFACTION',         group: 'User Perspective (Surveys)', label: 'User Satisfaction Index (avg score)',            unit: 'score 1–5', hint: 'Average Likert score from LibQUAL+ or annual user survey' },
  { id: 'ISO-UX-TITLE-AVAIL',          group: 'User Perspective (Surveys)', label: 'Title / Subject Availability Rate (%)',           unit: '%',         hint: '(Titles found ÷ Titles sought) × 100 — from shelf-availability study' },
  { id: 'ISO-UX-FACILITY-SAT',         group: 'User Perspective (Surveys)', label: 'Facilities Satisfaction Rate (%)',                unit: '%',         hint: '% of surveyed users rating study spaces as satisfactory' },
  { id: 'ISO-UX-DOWNTIME-RATE',        group: 'User Perspective (Surveys)', label: 'Workstation / Wi-Fi Downtime Rate (%)',           unit: '%',         hint: '(Offline hours ÷ Total open hours) × 100 — from IT logs' },
  { id: 'ISO-UX-ILL-DAYS',             group: 'User Perspective (Surveys)', label: 'Median Days to Fulfill ILL / Document Delivery',  unit: 'days',      hint: 'Median calendar days from ILL request to notification' },
  { id: 'ISO-UX-CORRECT-ANSWER',       group: 'User Perspective (Surveys)', label: 'Correct Answer Rate for Reference Queries (%)',   unit: '%',         hint: '(Accurate answers ÷ Sampled queries) × 100 — from reference audit' },
  { id: 'ISO-UX-GATE-COUNT',           group: 'User Perspective (Surveys)', label: 'Annual Library Visits (Gate Count)',              unit: 'visits',    hint: 'Physical door count for the year' },
  // Internal Processes
  { id: 'ISO-INT-PROC-DAYS',           group: 'Internal Processes', label: 'Median Processing Days for New Acquisitions',            unit: 'days',      hint: 'Median days from receipt to live catalog entry' },
  { id: 'ISO-INT-CAT-ACCURACY',        group: 'Internal Processes', label: 'Cataloging Accuracy Rate (%)',                           unit: '%',         hint: '(Correct MARC/RDA records ÷ Audited records) × 100' },
  { id: 'ISO-INT-MTTR-HOURS',          group: 'Internal Processes', label: 'Mean Time to Resolve System Failures (hours)',           unit: 'hours',     hint: 'Mean time to repair critical software/network issues' },
  { id: 'ISO-INT-CONSERV-RATE',        group: 'Internal Processes', label: 'Conservation Stabilization Rate (%)',                    unit: '%',         hint: '(Items stabilized or digitized ÷ Items flagged as vulnerable) × 100' },
  // Learning & Growth
  { id: 'ISO-LG-TRAINING-HRS',         group: 'Learning & Growth', label: 'Staff Training Hours per FTE',                           unit: 'hours',     hint: 'Total professional development hours ÷ FTE staff count' },
  { id: 'ISO-LG-IT-CERT-PCT',          group: 'Learning & Growth', label: '% Staff with Specialized IT / Data Certifications',      unit: '%',         hint: '(Staff with current IT certs ÷ Total FTE) × 100' },
  // ALA Project Outcome
  { id: 'ISO-ALA-KNOWLEDGE',           group: 'ALA Project Outcome', label: 'Knowledge Acquisition Rate (%)',                        unit: '%',         hint: 'Post-program survey: % who learned something new' },
  { id: 'ISO-ALA-CONFIDENCE',          group: 'ALA Project Outcome', label: 'Confidence Building Rate (%)',                          unit: '%',         hint: 'Post-program survey: % reporting increased confidence' },
  { id: 'ISO-ALA-BEHAVIOR',            group: 'ALA Project Outcome', label: 'Behavioral Change Intention Rate (%)',                  unit: '%',         hint: 'Post-program survey: % who plan to change a behavior' },
  { id: 'ISO-ALA-AWARENESS',           group: 'ALA Project Outcome', label: 'Resource Awareness Rate (%)',                           unit: '%',         hint: 'Post-program survey: % with expanded library resource awareness' },
  { id: 'ISO-ALA-SESSIONS',            group: 'ALA Project Outcome', label: 'Program / Instruction Sessions Conducted This Year',    unit: 'sessions',  hint: 'Total library programs, orientations, and instruction events' },
  { id: 'ISO-ALA-PARTICIPANTS',        group: 'ALA Project Outcome', label: 'Total Program Participants This Year',                  unit: 'persons',   hint: 'Aggregate headcount across all library programs' },
] as const;

type IsoMetricID = typeof ISO_MANUAL_METRICS[number]['id'];
type IsoStored = Record<string, { value: number; notes: string; date: string }>;

function IsoManualSection({ unlocked }: { unlocked: boolean }) {
  const [stored, setStored]   = useState<IsoStored>({});
  const [loading, setLoading] = useState(true);
  const [sbError, setSbError] = useState<string | null>(null);
  const [saving, setSaving]   = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft]     = useState({ value: '', notes: '' });

  const allIds = ISO_MANUAL_METRICS.map(m => m.id);

  useEffect(() => {
    (async () => {
      const { supabase } = await import('@/lib/supabase');
      const { data, error } = await supabase
        .from('green_metrics')
        .select('metric_id, value, notes, updated_at')
        .in('metric_id', allIds);
      if (error) { setSbError(error.message); } else {
        const map: IsoStored = {};
        (data ?? []).forEach((r: { metric_id: string; value: number; notes: string; updated_at: string }) => {
          map[r.metric_id] = { value: r.value, notes: r.notes ?? '', date: r.updated_at?.slice(0, 10) ?? '' };
        });
        setStored(map);
      }
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(id: IsoMetricID) {
    const val = parseFloat(draft.value);
    if (isNaN(val)) return;
    setSaving(id);
    const { supabase } = await import('@/lib/supabase');
    const { error } = await supabase.from('green_metrics').upsert(
      { metric_id: id, value: val, notes: draft.notes, updated_at: new Date().toISOString() },
      { onConflict: 'metric_id' }
    );
    if (!error) {
      setStored(prev => ({ ...prev, [id]: { value: val, notes: draft.notes, date: new Date().toISOString().slice(0, 10) } }));
      setEditing(null);
      setDraft({ value: '', notes: '' });
    }
    setSaving(null);
  }

  const groups = [...new Set(ISO_MANUAL_METRICS.map(m => m.group))];
  const filled = ISO_MANUAL_METRICS.filter(m => stored[m.id] !== undefined).length;

  if (loading) return <div className="text-center py-8 text-gray-400 text-sm">Loading saved metrics…</div>;

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
          <span>📝</span>Manual Data Entry — IFLA / ALA Reference Metrics
        </h2>
        <span className="ml-auto text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
          {filled}/{ISO_MANUAL_METRICS.length} metrics entered
        </span>
      </div>
      {sbError && <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">{sbError}</div>}
      {!unlocked && (
        <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
          🔒 Unlock the dashboard with the editor password (CHED CMO 22 tab) to enter or edit values.
        </div>
      )}
      {groups.map(group => {
        const metrics = ISO_MANUAL_METRICS.filter(m => m.group === group);
        const groupFilled = metrics.filter(m => stored[m.id]).length;
        return (
          <div key={group} className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{group}</h3>
              <span className="text-xs text-gray-400">{groupFilled}/{metrics.length} filled</span>
            </div>
            <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
              {metrics.map(m => {
                const rec = stored[m.id];
                const isEdit = editing === m.id;
                return (
                  <div key={m.id} className="p-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-gray-800">{m.label}</span>
                        <span className="text-xs text-gray-400 font-mono">{m.unit}</span>
                        {rec && !isEdit && (
                          <span className="text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded font-bold">
                            {Number(rec.value).toLocaleString()} {m.unit}
                          </span>
                        )}
                        {rec?.date && !isEdit && <span className="text-xs text-gray-400">· {rec.date}</span>}
                      </div>
                      <div className="text-xs text-gray-400">{m.hint}</div>
                      {rec?.notes && !isEdit && <div className="text-xs text-indigo-600 mt-0.5 italic">{rec.notes}</div>}
                      {isEdit && unlocked && (
                        <div className="mt-2 flex flex-wrap gap-2 items-center">
                          <input type="number" value={draft.value} onChange={e => setDraft(d => ({ ...d, value: e.target.value }))}
                            placeholder="Value" className="border border-gray-300 rounded px-2 py-1 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                          <input type="text" value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
                            placeholder="Notes (optional)" className="border border-gray-300 rounded px-2 py-1 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                          <button onClick={() => save(m.id as IsoMetricID)} disabled={saving === m.id}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded-lg disabled:opacity-50">
                            {saving === m.id ? 'Saving…' : 'Save'}
                          </button>
                          <button onClick={() => { setEditing(null); setDraft({ value: '', notes: '' }); }}
                            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5 border border-gray-200 rounded-lg">
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                    {unlocked && !isEdit && (
                      <button onClick={() => { setEditing(m.id); setDraft({ value: rec ? String(rec.value) : '', notes: rec?.notes ?? '' }); }}
                        className="text-xs text-blue-500 hover:text-blue-700 shrink-0 border border-blue-100 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors">
                        {rec ? 'Edit' : 'Enter'}
                      </button>
                    )}
                    {!unlocked && !rec && (
                      <span className="text-xs text-gray-300 shrink-0">—</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {filled === 0 && !unlocked && (
        <div className="text-center py-6 text-gray-400 text-sm">
          No data entered yet. Unlock with the editor password to begin entering IFLA / ALA metric values.
        </div>
      )}
    </div>
  );
}

// ── CHED CMO 22 Manual Metrics ──────────────────────────────────────────────

const CHED_MANUAL_SECTIONS = [
  // ── §1 VMGO ────────────────────────────────────────────────────────────────
  {
    section: '§1 — Vision, Mission, Goals & Objectives (VMGO)',
    icon: '🎯',
    note: 'Library VMGO must align with the institution, be visibly posted, and published on the library website.',
    metrics: [
      { id: 'CHED-S1-VMGO-APPROVED',    label: 'VMGO Document Formally Approved by Administration', unit: '1=Yes / 0=No', hint: 'Enter 1 for Yes, 0 for No', comply: (v:number) => v === 1 },
      { id: 'CHED-S1-VMGO-POSTED',      label: 'VMGO Visibly Posted Inside Library Premises',       unit: '1=Yes / 0=No', hint: 'Enter 1 for Yes',            comply: (v:number) => v === 1 },
      { id: 'CHED-S1-VMGO-WEBSITE',     label: 'VMGO Published on Library Website',                 unit: '1=Yes / 0=No', hint: 'Enter 1 for Yes',            comply: (v:number) => v === 1 },
      { id: 'CHED-S1-VMGO-REVIEW-YEAR', label: 'Year VMGO Last Reviewed / Updated',                 unit: 'year',          hint: 'e.g. 2024',                 comply: (v:number) => v >= new Date().getFullYear() - 3 },
      { id: 'CHED-S1-LIB-ALIGNMENT',    label: 'Library Mission Aligned with Institutional VMGO',   unit: '1=Yes / 0=No', hint: 'Enter 1 for Yes',            comply: (v:number) => v === 1 },
    ],
  },
  // ── §2 Administration ─────────────────────────────────────────────────────
  {
    section: '§2 — Administration & Organization',
    icon: '🏛️',
    note: 'Head librarian must be PRC-licensed, hold a Master\'s in LIS, be a member of an accredited professional org, and have ≥2 years supervisory experience.',
    metrics: [
      { id: 'CHED-S2-LICENSED-LIBRARIANS',  label: 'Licensed Professional Librarians (PRC-licensed)',          unit: 'persons',      hint: 'Staff with valid active PRC license' },
      { id: 'CHED-S2-DIRECTOR-EDUC',        label: "Head Librarian's Highest Degree (1=BS 2=MA 3=PhD)",        unit: 'level',        hint: '1=BS/AB, 2=Masters in LIS or related, 3=Doctorate', comply: (v:number) => v >= 2 },
      { id: 'CHED-S2-DIR-PROF-ORG',         label: 'Head Librarian Member of Accredited Professional Org',     unit: '1=Yes / 0=No', hint: 'e.g. PAARL, PLAI',                                 comply: (v:number) => v === 1 },
      { id: 'CHED-S2-DIR-SUPERVISORY-YRS',  label: 'Head Librarian Supervisory Experience (years)',            unit: 'years',        hint: 'Minimum 2 years required (§2.b.3)',                 comply: (v:number) => v >= 2 },
      { id: 'CHED-S2-ORG-CHART',            label: 'Organizational Chart Documented & Filed',                  unit: '1=Yes / 0=No', hint: 'Library clearly defined in institutional org chart', comply: (v:number) => v === 1 },
      { id: 'CHED-S2-ADVISORY-COMMITTEE',   label: 'Library Advisory Committee Constituted (§2.d)',            unit: '1=Yes / 0=No', hint: 'With faculty reps from each college + student council', comply: (v:number) => v === 1 },
      { id: 'CHED-S2-STRATEGIC-PLAN',       label: 'Library Development / Strategic Plan Exists (§2.e)',       unit: '1=Yes / 0=No', hint: 'Formal written plan approved by administration',    comply: (v:number) => v === 1 },
      { id: 'CHED-S2-RESEARCH-PROG',        label: 'Library Research Program Institutionalized (§2.f)',        unit: '1=Yes / 0=No', hint: 'Formal research program to improve LIS operations',  comply: (v:number) => v === 1 },
      { id: 'CHED-S2-POLICY-MANUAL',        label: 'Updated Manual of Policies & Procedures Exists (§2.g)',   unit: '1=Yes / 0=No', hint: 'Covers both face-to-face and online services',       comply: (v:number) => v === 1 },
      { id: 'CHED-S2-ANNUAL-EVAL',          label: 'Annual In-House Evaluation Conducted This Year (§2.h)',    unit: '1=Yes / 0=No', hint: 'e.g. library surveys, customer satisfaction surveys', comply: (v:number) => v === 1 },
    ],
  },
  // ── §3 Human Resources ────────────────────────────────────────────────────
  {
    section: '§3 — Human Resources & Staffing Ratios',
    icon: '👥',
    note: 'For ≤1,000 users: at least 1 full-time librarian + 1 support staff. For every additional 3,000 users: +1 librarian +3 support staff.',
    metrics: [
      { id: 'CHED-S3-TOTAL-USERS',        label: 'Total User Population (Students + Faculty + Staff)',  unit: 'persons',            hint: 'Combined headcount used for ratio calculations' },
      { id: 'CHED-S3-FULL-TIME-STAFF',    label: 'Total Full-Time Library Staff',                       unit: 'persons',            hint: 'Librarians + assistants + clerks combined' },
      { id: 'CHED-S3-LIBRARIANS',         label: 'Professional Librarians (PRC-licensed)',               unit: 'persons',            hint: 'PRC-licensed librarians only' },
      { id: 'CHED-S3-ASSISTANTS',         label: 'Library Assistants / Support Staff (non-licensed)',   unit: 'persons',            hint: 'Paraprofessionals: bachelor\'s degree holders or Grade 12 grads' },
      { id: 'CHED-S3-STUDENT-ASST',       label: 'Student Assistants (augmentation)',                   unit: 'persons',            hint: 'Hours equivalent to required support staff; not substitutes' },
      { id: 'CHED-S3-STUDENTS-PER-LIB',  label: 'Students per Professional Librarian',                  unit: 'students/librarian', hint: 'Enrollment ÷ licensed librarian count; ≤3,000 per §3.a.2', comply: (v:number) => v <= 3000 },
      { id: 'CHED-S3-DEV-TRAININGS',      label: 'Staff Development Trainings Attended This Year',      unit: 'trainings',          hint: 'Sum across all library staff; supports §3.c' },
      { id: 'CHED-S3-DEV-PROGRAM',        label: 'Continuous Personnel Development Program Exists',      unit: '1=Yes / 0=No',       hint: 'Formal program for career progression (§3.c)',            comply: (v:number) => v === 1 },
    ],
  },
  // ── §4.a Collection Development Policy ────────────────────────────────────
  {
    section: '§4.a — Selection, Acquisition & Collection Policy',
    icon: '📋',
    note: 'Selection is faculty-led with librarians; acquisition is librarians\' responsibility. A written policy is required.',
    metrics: [
      { id: 'CHED-S4A-POLICY-EXISTS',      label: 'Written Collection Development Policy Exists (§4.a.4)',  unit: '1=Yes / 0=No', hint: 'Approved by administration, prepared with Advisory Committee', comply: (v:number) => v === 1 },
      { id: 'CHED-S4A-POLICY-YEAR',        label: 'Year Collection Development Policy Last Reviewed',       unit: 'year',          hint: 'e.g. 2023; policy should be reviewed at least every 5 years', comply: (v:number) => v >= new Date().getFullYear() - 5 },
      { id: 'CHED-S4A-EVAL-CONDUCTED',     label: 'Periodic Collection Evaluation Conducted This Year (§4.a.5)', unit: '1=Yes / 0=No', hint: 'Various approaches/tools used to assess existing collection', comply: (v:number) => v === 1 },
      { id: 'CHED-S4A-WEEDING-CONDUCTED',  label: 'Weeding / Deselection Program Active This Year (§4.a.6)', unit: '1=Yes / 0=No', hint: 'Regular withdrawal of outdated/irrelevant print and electronic', comply: (v:number) => v === 1 },
    ],
  },
  // ── §4.b Holdings ─────────────────────────────────────────────────────────
  {
    section: '§4.b — Holdings: Programs, Journals & Special Materials',
    icon: '📚',
    note: 'Per program: 5 relevant titles per major subject (last 5 years); ≥3 journal titles per undergrad program; ≥2 additional peer-reviewed journals per grad program.',
    metrics: [
      { id: 'CHED-S4B-UG-PROGRAMS',         label: 'Number of Undergraduate Programs Offered',                 unit: 'programs',  hint: 'Total undergrad degree programs in institution' },
      { id: 'CHED-S4B-GRAD-PROGRAMS',       label: 'Number of Graduate Programs Offered (Masters/PhD)',        unit: 'programs',  hint: 'Total graduate programs (Masters + Doctorate)' },
      { id: 'CHED-S4B-RESERVE-COPIES',      label: 'Reserve / High-Use Copy System in Place (§4.b.6)',        unit: '1=Yes / 0=No', hint: 'At least 1 copy reserved for frequently used books', comply: (v:number) => v === 1 },
      { id: 'CHED-S4B-THESIS-DISS',         label: 'Theses & Dissertations in Collection (§4.b.11)',          unit: 'items',     hint: 'Print and/or electronic theses and dissertations held' },
      { id: 'CHED-S4B-TOTAL-PERIODICALS',   label: 'Total Periodical Titles (print + electronic) (§4.b.7)',   unit: 'titles',    hint: 'Minimum 50 required; combination of print and e-format', comply: (v:number) => v >= 50 },
      { id: 'CHED-S4B-UG-JOURNAL-TITLES',   label: 'Professional Journal Titles per Undergrad Program (§4.b.8)', unit: 'titles/program', hint: 'Min 3 per undergrad program; local + foreign, print/e', comply: (v:number) => v >= 3 },
      { id: 'CHED-S4B-GRAD-JOURNAL-TITLES', label: 'Additional Peer-Reviewed Journals per Grad Program (§4.b.9)', unit: 'titles/program', hint: 'Min 2 additional peer-reviewed/internationally-refereed', comply: (v:number) => v >= 2 },
      { id: 'CHED-S4B-OER-RESOURCES',       label: 'Open Educational Resources (OER) Listed/Cataloged (§4.b.1)', unit: 'items',    hint: 'OER resources listed in discovery tool/OPAC' },
    ],
  },
  // ── §4.c Organization ─────────────────────────────────────────────────────
  {
    section: '§4.c — Cataloging, Classification & Organization',
    icon: '🗂️',
    note: 'Collection must be organized per international standards (MARC21 or Dublin Core). An OPAC/discovery tool must be available.',
    metrics: [
      { id: 'CHED-S4C-MARC-COMPLIANT',     label: 'Bibliographic Records in MARC21 / Dublin Core (§4.c.3)',   unit: '1=Yes / 0=No', hint: 'Records conform to international metadata standards', comply: (v:number) => v === 1 },
      { id: 'CHED-S4C-DISCOVERY-TOOL',     label: 'Online Catalog / Discovery Tool Available (§4.c.2)',       unit: '1=Yes / 0=No', hint: 'OPAC or library management system accessible by users',  comply: (v:number) => v === 1 },
      { id: 'CHED-S4C-STAMPING',           label: 'All Print Items Property-Stamped (§4.c.4)',                 unit: '1=Yes / 0=No', hint: 'Items stamped with HEI name and campus identifier' },
    ],
  },
  // ── §4.c Serials (kept from original) ─────────────────────────────────────
  {
    section: '§4.c — Serials & Periodical Subscriptions',
    icon: '📰',
    note: 'At least 50 periodical titles required (§4.b.7). Include local and foreign titles in print and/or electronic formats.',
    metrics: [
      { id: 'CHED-S4C-PRINT-SUBS',         label: 'Current Print Serial / Magazine Subscriptions',            unit: 'titles',          hint: 'Print journals/magazines actively subscribed this year' },
      { id: 'CHED-S4C-EJOURNALS',          label: 'E-Journal / Online Database Subscriptions or Access',      unit: 'titles/packages', hint: 'Include consortium packages; count individual titles if possible' },
      { id: 'CHED-S4C-DB-SUBSCRIPTIONS',   label: 'Electronic Database Packages Subscribed (§4.b.9)',         unit: 'databases',       hint: 'e.g. JSTOR, ProQuest, ScienceDirect, EBSCO, HERDIN' },
    ],
  },
  // ── §4.d Non-Print & Special Collections ──────────────────────────────────
  {
    section: '§4.d — Non-Print, AV & Special Collections',
    icon: '💿',
    note: 'Non-print/AV and electronic/digital resources shall be made available (§4.b.10). Special collections include theses, dissertations, multimedia.',
    metrics: [
      { id: 'CHED-S4D-AV-MATERIALS',       label: 'Audiovisual Materials (DVDs, CDs, Blu-rays, etc.)',        unit: 'items', hint: 'Physical AV materials in active collection' },
      { id: 'CHED-S4D-MAPS',               label: 'Maps, Atlases & Geographic Materials',                     unit: 'items', hint: 'Physical maps, atlases, globes, charts' },
      { id: 'CHED-S4D-MULTIMEDIA',         label: 'Multimedia / Digital Learning Objects Available',          unit: 'items', hint: 'Locally produced or licensed digital multimedia content' },
      { id: 'CHED-S4D-DIGITAL-ARCHIVE',    label: 'Archival / Special Collections Digitized',                 unit: 'items', hint: 'Theses, dissertations, rare items digitized and available electronically' },
    ],
  },
  // ── §4.d Preservation ─────────────────────────────────────────────────────
  {
    section: '§4.d — Preservation, Conservation & Disaster Preparedness',
    icon: '🛡️',
    note: 'Library must have security/control policies, a disaster preparedness/recovery plan, proper environmental conditions, and first-aid conservation procedures.',
    metrics: [
      { id: 'CHED-S4P-SECURITY-POLICY',    label: 'Collection Security & Loss-Prevention Policy Exists (§4.d.1.1)', unit: '1=Yes / 0=No', hint: 'Written policy on safeguards from damage, loss, mutilation, theft', comply: (v:number) => v === 1 },
      { id: 'CHED-S4P-DISASTER-PLAN',      label: 'Disaster Preparedness, Response & Recovery Plan (§4.d.1.2)',     unit: '1=Yes / 0=No', hint: 'Includes microfilming/digitization of special/archival collections',  comply: (v:number) => v === 1 },
      { id: 'CHED-S4P-ENVIRONMENT',        label: 'Proper Environmental Conditions Maintained (§4.d.1.3)',          unit: '1=Yes / 0=No', hint: 'Temperature, humidity, lighting, housekeeping practices in place' },
      { id: 'CHED-S4P-CONSERVATION-TRNG',  label: 'Preservation/Conservation Training Attended (staff, this year)', unit: 'staff',         hint: 'Number of staff who attended preservation or disaster preparedness training' },
    ],
  },
  // ── §5 Services ───────────────────────────────────────────────────────────
  {
    section: '§5 — Services & Utilization',
    icon: '🛎️',
    note: 'Library must offer reference, instruction, ILL, document delivery, SDI, remote e-resource access, and plagiarism detection. Innovative virtual/online services are required.',
    metrics: [
      { id: 'CHED-S5-REFERENCE',           label: 'Reference & Information Services Offered (§5.a.i)',         unit: '1=Yes / 0=No', hint: 'Face-to-face and/or online reference service active',    comply: (v:number) => v === 1 },
      { id: 'CHED-S5-INSTRUCTION',         label: 'Library Instruction / Orientation Program (§5.a.ii)',       unit: '1=Yes / 0=No', hint: 'Regular library instruction or information literacy sessions', comply: (v:number) => v === 1 },
      { id: 'CHED-S5-ILL',                 label: 'Inter/Intra-Library Loan Service Offered (§5.a.iii)',       unit: '1=Yes / 0=No', hint: 'Resource sharing with partner libraries active',          comply: (v:number) => v === 1 },
      { id: 'CHED-S5-DOC-DELIVERY',        label: 'Document Delivery Service Offered (§5.a.iv)',               unit: '1=Yes / 0=No', hint: 'Physical or digital delivery of materials to users' },
      { id: 'CHED-S5-SDI',                 label: 'Selective Dissemination of Information (SDI) (§5.a.v)',     unit: '1=Yes / 0=No', hint: 'Proactive notification of new resources to specific users' },
      { id: 'CHED-S5-REMOTE-ACCESS',       label: 'Remote Access to Electronic Resources (§5.a.vi)',           unit: '1=Yes / 0=No', hint: 'Users can access e-resources from outside library',       comply: (v:number) => v === 1 },
      { id: 'CHED-S5-PLAGCHECK',           label: 'Plagiarism Detection Software Available (§5.a.vii)',        unit: '1=Yes / 0=No', hint: 'e.g. Turnitin, iThenticate, Unicheck',                  comply: (v:number) => v === 1 },
      { id: 'CHED-S5-CITATION-TOOL',       label: 'Reference Management / Citation Tool Available (§5.a.vii)', unit: '1=Yes / 0=No', hint: 'e.g. Mendeley, Zotero, EndNote, RefWorks' },
      { id: 'CHED-S5-ONLINE-CIRC',         label: 'Online / Virtual Circulation Service (§5.b.ii)',            unit: '1=Yes / 0=No', hint: 'Book padala, pick-up/drop-off, scanning/digitization on request' },
      { id: 'CHED-S5-INSTRUCTION-SESSIONS', label: 'Library Instruction Sessions Conducted This Year',         unit: 'sessions',      hint: 'Include orientation, database training, information literacy classes' },
      { id: 'CHED-S5-REF-QUERIES',         label: 'Reference Queries Handled This Year',                       unit: 'queries',       hint: 'In-person and virtual reference transactions' },
      { id: 'CHED-S5-ILL-TRANSACTIONS',    label: 'Interlibrary Loan Transactions This Year',                  unit: 'transactions',  hint: 'Borrowed + lent combined across all partner libraries' },
    ],
  },
  // ── §6 Physical Facilities ────────────────────────────────────────────────
  {
    section: '§6 — Physical Facilities',
    icon: '🏢',
    note: 'Library must accommodate ≥5% of on-site users. Dedicated learning, discussion, and creation spaces are required. PWD access is mandatory.',
    metrics: [
      { id: 'CHED-S6-FLOOR-AREA',          label: 'Total Library Floor Area',                                  unit: 'sq meters',  hint: 'Total usable library space in square meters' },
      { id: 'CHED-S6-SEATING',             label: 'Reader Seating Capacity',                                   unit: 'seats',      hint: 'CHED §6.a requires ≥5% of total on-site users' },
      { id: 'CHED-S6-COMPUTERS',           label: 'Public-Access Computer Terminals (§7.b)',                   unit: 'units',      hint: 'All user-accessible desktops/laptops/tablets combined' },
      { id: 'CHED-S6-ANNUAL-VISITS',       label: 'Annual In-Person Library Visits',                           unit: 'visits/yr',  hint: 'Gate counter, sign-in log, or headcount for the full year' },
      { id: 'CHED-S6-DISCUSSION-ROOMS',    label: 'Dedicated Discussion / Group Study Spaces (§6.b)',          unit: 'rooms',      hint: 'Enclosed or semi-enclosed spaces for group work and collaboration' },
      { id: 'CHED-S6-CREATION-SPACES',     label: 'Dedicated Creation / Innovation Spaces (§6.b)',             unit: 'spaces',     hint: 'Makerspace, recording booth, multimedia creation area, etc.' },
      { id: 'CHED-S6-PWD-FACILITIES',      label: 'PWD-Accessible Facilities Available (§6.f)',                unit: '1=Yes / 0=No', hint: 'Ramps, railings, accessible restrooms, etc. per RA 9442',    comply: (v:number) => v === 1 },
      { id: 'CHED-S6-EMERGENCY-EQUIPMENT', label: 'Emergency Exits, Fire Extinguishers & Emergency Lights (§6.g)', unit: '1=Yes / 0=No', hint: 'Required per National Building Code of the Philippines', comply: (v:number) => v === 1 },
    ],
  },
  // ── §7 IT Infrastructure ──────────────────────────────────────────────────
  {
    section: '§7 — Information Technology Infrastructure & Services',
    icon: '💻',
    note: 'Library must have internet-connected computers, Wi-Fi, printers/scanners, an ILS, and an official website.',
    metrics: [
      { id: 'CHED-S7-OPAC-TERMINALS',      label: 'OPAC / Catalog Search Terminals for Users',                unit: 'units',        hint: 'Dedicated catalog search terminals (may overlap with public computers)' },
      { id: 'CHED-S7-TOTAL-DEVICES',       label: 'Total Computing Devices for Users (§7.b)',                 unit: 'units',        hint: 'Desktops + laptops + tablets accessible to library users' },
      { id: 'CHED-S7-BANDWIDTH-MBPS',      label: 'Internet Bandwidth Dedicated to Library',                  unit: 'Mbps',         hint: 'Dedicated internet speed; include Wi-Fi capacity' },
      { id: 'CHED-S7-ONLINE-CATALOG',      label: 'Online OPAC Web-Accessible Outside Library (§7.c)',        unit: '1=Yes / 0=No', hint: 'Users can search catalog from outside library network',   comply: (v:number) => v === 1 },
      { id: 'CHED-S7-WIFI',                label: 'Wi-Fi Access Points Available to Library Users (§7.a)',    unit: '1=Yes / 0=No', hint: 'Enter 1 for Yes',                                       comply: (v:number) => v === 1 },
      { id: 'CHED-S7-ILS-MODULES',         label: 'ILS Modules Operational (§7.c)',                           unit: 'modules',      hint: 'Count: acquisitions, cataloging, circ, OPAC, serials; max 5',  comply: (v:number) => v >= 3 },
      { id: 'CHED-S7-WEBSITE',             label: 'Official Library Website Exists (§7.d)',                   unit: '1=Yes / 0=No', hint: 'Gateway to OPAC, e-resources, and online services',      comply: (v:number) => v === 1 },
      { id: 'CHED-S7-PRINTERS-SCANNERS',   label: 'Printers & Scanners Available to Users (§7.a)',            unit: 'units',        hint: 'Combined count of printers and scanners accessible to users' },
    ],
  },
  // ── §8 Financial Resources ────────────────────────────────────────────────
  {
    section: '§8 — Financial Resources',
    icon: '💰',
    note: 'Head librarian prepares an annual budget. A library fee shall be set and reviewed periodically. Alternative funding sources should be explored.',
    metrics: [
      { id: 'CHED-S8-ANNUAL-BUDGET',       label: 'Annual Library Budget (₱)',                                unit: '₱',            hint: 'Total approved library operating budget for this fiscal year' },
      { id: 'CHED-S8-ACQUISITION-BUDGET',  label: 'Acquisition / Materials Budget (₱)',                      unit: '₱',            hint: 'Portion of budget allocated for new books, journals, e-resources' },
      { id: 'CHED-S8-BUDGET-PER-STUDENT',  label: 'Library Budget per Enrolled Student (₱)',                 unit: '₱/student',    hint: 'Annual budget ÷ enrolled students; higher = better resource per user' },
      { id: 'CHED-S8-LIBRARY-FEE',         label: 'Library Fee per Student per Semester (₱)',                unit: '₱/sem',        hint: 'Collected from students for library development' },
      { id: 'CHED-S8-OTHER-FUNDING',       label: 'Other / External Funding Sources (grants, donations)',    unit: '1=Yes / 0=No', hint: 'Enter 1 if library receives any non-institutional funding' },
    ],
  },
  // ── §9 Linkages & Networking ──────────────────────────────────────────────
  {
    section: '§9 — Linkages & Networking',
    icon: '🤝',
    note: 'Librarians must engage in local, regional, and international networking. Community service (e.g., supporting public-school reading) is expected.',
    metrics: [
      { id: 'CHED-S9-MOA-COUNT',           label: 'Active MOAs / Formal Linkage Agreements',                  unit: 'agreements',   hint: 'Signed and currently active memoranda of agreement' },
      { id: 'CHED-S9-CONSORTIUM',          label: 'Library Consortium Memberships',                           unit: 'consortia',    hint: 'e.g. PAARL, PLAI, EUSEBI, ERDT, DepEd consortium' },
      { id: 'CHED-S9-ILL-PARTNERS',        label: 'Interlibrary Loan Partner Libraries',                      unit: 'libraries',    hint: 'Libraries with active resource-sharing / ILL agreements' },
      { id: 'CHED-S9-LOCAL-LINKAGES',      label: 'Local / City / Provincial Library Linkages (§9.a)',        unit: 'agreements',   hint: 'Formal ties with city/provincial/public libraries; LUC resource sharing' },
      { id: 'CHED-S9-INTL-LINKAGES',       label: 'International Linkages / Partnerships (§9.a)',             unit: 'agreements',   hint: 'Formal links with foreign HEIs, international library orgs, consortia' },
      { id: 'CHED-S9-COMMUNITY-ACTIVITIES', label: 'Community Service / Outreach Activities This Year (§9.b)', unit: 'activities',  hint: 'e.g. reading programs for public schools, community library literacy' },
    ],
  },
] as const;

type ChedMetricID = typeof CHED_MANUAL_SECTIONS[number]['metrics'][number]['id'];
type ChedStored = Record<string, { value: number; notes: string; date: string }>;

// ── CHED Compliance Summary — cross-references ILS data against CMO thresholds ──
function ChedComplianceSummary({ chedStats }: { chedStats: Record<string,number> | null }) {
  if (!chedStats || chedStats.error) return null;

  type Check = { label: string; section: string; value: string; pass: boolean | null; note: string };
  const checks: Check[] = [
    {
      label: 'Minimum Book Titles ≥ 5,000',
      section: '§4.b.1',
      value: `${Number(chedStats.totalTitles ?? 0).toLocaleString()} titles`,
      pass: (chedStats.totalTitles ?? 0) >= 5000,
      note: (chedStats.totalTitles ?? 0) >= 5000 ? 'Meets requirement' : `Deficit: ${(5000 - (chedStats.totalTitles ?? 0)).toLocaleString()} titles needed`,
    },
    {
      label: 'Filipiniana ≥ 10% of collection',
      section: '§4.b.2',
      value: chedStats.totalItems > 0 ? `${((chedStats.filipianianaItems ?? 0) / chedStats.totalItems * 100).toFixed(1)}%` : '—',
      pass: chedStats.totalItems > 0 ? (chedStats.filipianianaItems ?? 0) / chedStats.totalItems >= 0.10 : null,
      note: 'Items tagged as Filipiniana in Sublocation field',
    },
    {
      label: 'Active Weeding Program (withdrawals recorded)',
      section: '§4.a.6',
      value: `${Number(chedStats.withdrawnThisYear ?? 0).toLocaleString()} withdrawn this year`,
      pass: (chedStats.withdrawnThisYear ?? 0) > 0,
      note: (chedStats.withdrawnThisYear ?? 0) > 0 ? 'Deselection activity recorded in Destiny' : 'No withdrawals recorded this year — document weeding activities',
    },
    {
      label: 'Items Acquired Within Last 5 Years ≥ 20% of collection',
      section: '§4.b.4',
      value: chedStats.totalItems > 0 ? `${((chedStats.itemsLast5Years ?? 0) / chedStats.totalItems * 100).toFixed(1)}%` : '—',
      pass: chedStats.totalItems > 0 ? (chedStats.itemsLast5Years ?? 0) / chedStats.totalItems >= 0.20 : null,
      note: 'Supports requirement of 5 titles per major subject published within last 5 years',
    },
    {
      label: 'Collection Currency (items ≤ 10 years) ≥ 35%',
      section: '§4.b',
      value: chedStats.totalItems > 0 ? `${((chedStats.itemsLast10Years ?? 0) / chedStats.totalItems * 100).toFixed(1)}%` : '—',
      pass: chedStats.totalItems > 0 ? (chedStats.itemsLast10Years ?? 0) / chedStats.totalItems >= 0.35 : null,
      note: 'Adequate, relevant, and current resources are required for all programs',
    },
    {
      label: 'ILL Service Has Transactions on Record',
      section: '§5.a.iii',
      value: `${Number(chedStats.totalILL ?? 0).toLocaleString()} ILL records`,
      pass: (chedStats.totalILL ?? 0) > 0,
      note: (chedStats.totalILL ?? 0) > 0 ? 'ILL transactions found in Destiny CrossDistrictLoan table' : 'No Destiny ILL record found — if ILL is done manually, enter count in §5 manual fields below',
    },
  ];

  const passed  = checks.filter(c => c.pass === true).length;
  const failed  = checks.filter(c => c.pass === false).length;
  const unknown = checks.filter(c => c.pass === null).length;

  return (
    <div className="mb-8">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-2">
        <span>✅</span>ILS-Computed Compliance Checks
      </h2>
      <p className="text-xs text-gray-600 mb-4">Auto-verified from Destiny ILS data. Green = meets CMO threshold, Red = below requirement.</p>
      <div className="flex gap-3 mb-3 text-xs">
        <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">{passed} Pass</span>
        <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">{failed} Fail</span>
        {unknown > 0 && <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-medium">{unknown} No data</span>}
      </div>
      <div className="flex flex-col gap-2">
        {checks.map((c, i) => (
          <div key={i} className={`bg-white rounded-xl shadow-sm p-4 border-l-4 ${c.pass === true ? 'border-green-500' : c.pass === false ? 'border-red-500' : 'border-gray-300'}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-base ${c.pass === true ? 'text-green-600' : c.pass === false ? 'text-red-600' : 'text-gray-400'}`}>
                    {c.pass === true ? '✓' : c.pass === false ? '✗' : '—'}
                  </span>
                  <span className="font-semibold text-gray-800 text-sm">{c.label}</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{c.section}</span>
                </div>
                <p className="text-xs text-gray-500 ml-6">{c.note}</p>
              </div>
              <div className={`shrink-0 text-sm font-bold ${c.pass === true ? 'text-green-700' : c.pass === false ? 'text-red-600' : 'text-gray-400'}`}>
                {c.value}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// AACCUP Area VII — Library Self-Survey Instrument
// ══════════════════════════════════════════════════════════════════
const AACCUP_SECTIONS = [
  {
    section: 'A — Administration',
    icon: '🏛️',
    note: 'Library must be administered by a full-time, licensed librarian with a Master\'s in LIS. An organisational chart, policy manual, and Library Board/Committee are required.',
    metrics: [
      { id: 'AACCUP-A1-ORG-STRUCTURE',    label: 'A.1 Organizational Structure of Library Well-Defined',              unit: '1=Yes / 0=No', hint: 'Clearly drawn org chart filed and disseminated',               comply: (v:number) => v === 1 },
      { id: 'AACCUP-A2-LICENSED-LIB',     label: 'A.2 Library Managed by Licensed & Educationally Qualified Librarian', unit: '1=Yes / 0=No', hint: 'PRC-licensed, with Master\'s in LIS',                        comply: (v:number) => v === 1 },
      { id: 'AACCUP-A3-HEAD-SUPERVISES',  label: 'A.3 Head Librarian Directs & Supervises Total Library Operation',  unit: '1=Yes / 0=No', hint: 'Responsible for administration of all resources and services',  comply: (v:number) => v === 1 },
      { id: 'AACCUP-A4-ACADEMIC-RANK',    label: 'A.4 Head Librarian Has Academic Rank & Participates in Academic Activities', unit: '1=Yes / 0=No', hint: 'Academic non-teaching rank; participates in curriculum/research', comply: (v:number) => v === 1 },
      { id: 'AACCUP-A5-LIB-COMMITTEE',   label: 'A.5 Library Board / Committee Sets Policies & Periodically Reviews Them', unit: '1=Yes / 0=No', hint: 'Committee with board resolution, active and meeting regularly', comply: (v:number) => v === 1 },
      { id: 'AACCUP-A6-REPORTS',          label: 'A.6 Annual & Accomplishment Reports Promptly Submitted',             unit: '1=Yes / 0=No', hint: 'Reports submitted to relevant higher offices on schedule' },
      { id: 'AACCUP-A7-POLICY-MANUAL',    label: 'A.7 Approved & Disseminated Library Manual / Written Policies',      unit: '1=Yes / 0=No', hint: 'Covers internal admin, operations, and user services',          comply: (v:number) => v === 1 },
    ],
  },
  {
    section: 'B — Staff / Personnel',
    icon: '👥',
    note: 'Staffing must be sufficient for the school population, curricular offerings, collection size, and circulation rate. A staff development program is required.',
    metrics: [
      { id: 'AACCUP-B1-QUALIFIED-STAFF',  label: 'B.1 Library Staffed with Qualified Personnel',                      unit: '1=Yes / 0=No', hint: 'All staff meet educational and professional qualifications',     comply: (v:number) => v === 1 },
      { id: 'AACCUP-B2-STAFF-COUNT',      label: 'B.2 Library Meets Required Number of Librarians & Support Staff',   unit: '1=Yes / 0=No', hint: 'Ratio meets school population + collection + circ rate requirements', comply: (v:number) => v === 1 },
      { id: 'AACCUP-B2-LIBRARIANS',       label: 'B.2a Total Professional Librarians (PRC-licensed)',                  unit: 'persons',      hint: 'Full-time, licensed librarians in active service' },
      { id: 'AACCUP-B2-SUPPORT-STAFF',   label: 'B.2b Total Support / Para-professional Staff',                      unit: 'persons',      hint: 'Library assistants, clerks, encoders' },
      { id: 'AACCUP-B3-DEV-PROGRAM',     label: 'B.3 Sustainable & Functional Staff Development Program',             unit: '1=Yes / 0=No', hint: 'Formal program for continuing education, trainings, CPD',        comply: (v:number) => v === 1 },
      { id: 'AACCUP-B3-TRAININGS-YR',    label: 'B.3a Staff Development Trainings Attended This Year',                unit: 'events',       hint: 'Total training events attended by all library personnel combined' },
      { id: 'AACCUP-B4-BENEFITS',         label: 'B.4 Compensation, Retirement & Benefits Per Government Laws',       unit: '1=Yes / 0=No', hint: 'Personnel benefits comply with RA 7722, CSC, and institutional policies' },
    ],
  },
  {
    section: 'C — Collection Development, Organization & Preservation',
    icon: '📚',
    note: 'Core collection ≥ 5,000 titles (college) or ≥ 10,000 (university). At least 30% of holdings should be current editions (within last 10 years). An ILS is required.',
    metrics: [
      { id: 'AACCUP-C1-DEV-POLICY',       label: 'C.1 Written Collection Development Policy (reviewed regularly)',     unit: '1=Yes / 0=No', hint: 'Policy reviewed and evaluated by the Library Board/Committee',  comply: (v:number) => v === 1 },
      { id: 'AACCUP-C2-COMMITTEE-SELECTS',label: 'C.2 Library Committee & Officials Participate in Selection/Acquisition', unit: '1=Yes / 0=No', hint: 'Faculty, officials, and librarians involved in selection',  comply: (v:number) => v === 1 },
      { id: 'AACCUP-C3-SUPPORTS-MISSION', label: 'C.3 Collection Supports Institution\'s Mission, Goals & Programs',  unit: '1=Yes / 0=No', hint: 'Collection assessed against institutional curricular objectives', comply: (v:number) => v === 1 },
      { id: 'AACCUP-C4-CORE-TITLES',      label: 'C.4 Core Collection Titles (≥5,000 college / ≥10,000 university)',  unit: 'titles',       hint: 'Count unique bibliographic titles in ILS',                     comply: (v:number) => v >= 5000 },
      { id: 'AACCUP-C5-CURRENT-30PCT',    label: 'C.5 ≥30% of Holdings are Current Editions (copyright ≤10 years)',  unit: '% (0–100)',    hint: 'Items published within last 10 years as % of total collection', comply: (v:number) => v >= 30 },
      { id: 'AACCUP-C6-NONPRINT-DIGITAL', label: 'C.6 Non-Print, Digital & Electronic Resources Available',           unit: '1=Yes / 0=No', hint: 'With sufficient hardware/equipment to access them',             comply: (v:number) => v === 1 },
      { id: 'AACCUP-C7-RESEARCH-BOOKS',   label: 'C.7 Sufficient Research Books & Materials for Curricular Needs',    unit: '1=Yes / 0=No', hint: 'Research books adequately supplement clients\' academic programs' },
      { id: 'AACCUP-C8-FILIPINIANA',      label: 'C.8 Extensive Filipiniana Collection Maintained',                   unit: '1=Yes / 0=No', hint: 'Philippine-authored and Philippine-subject materials well-represented', comply: (v:number) => v === 1 },
      { id: 'AACCUP-C9-PROFESSIONAL-TTLS',label: 'C.9 Book / Journal Titles per Professional Subject Field',          unit: 'titles/field', hint: '3–5 titles per major field of specialization (per AACCUP)',     comply: (v:number) => v >= 3 },
      { id: 'AACCUP-C10-CATALOGUED',      label: 'C.10 Collection Organized per Accepted Classification & Cataloguing', unit: '1=Yes / 0=No', hint: 'Follows DDC or LC + AACR2/RDA standards',                   comply: (v:number) => v === 1 },
      { id: 'AACCUP-C11-ILS',             label: 'C.11 Integrated Library System Available',                           unit: '1=Yes / 0=No', hint: 'ILS facilitates organization of library resources',             comply: (v:number) => v === 1 },
      { id: 'AACCUP-C12-PRESERVATION',    label: 'C.12 Provisions for Preservation, General Care & Upkeep of Resources', unit: '1=Yes / 0=No', hint: 'Written preservation policy + environmental controls',       comply: (v:number) => v === 1 },
      { id: 'AACCUP-C13-WEEDING',         label: 'C.13 Regular Weeding-Out Program Conducted',                         unit: '1=Yes / 0=No', hint: 'Active, documented deselection program to maintain relevance',  comply: (v:number) => v === 1 },
      { id: 'AACCUP-C14-QUALITY-CONFORMS',label: 'C.14 Quality & Quantity of Materials Conform with Program Standards', unit: '1=Yes / 0=No', hint: 'Collection assessed against standards for each academic program' },
    ],
  },
  {
    section: 'D — Services and Utilization',
    icon: '🛎️',
    note: 'Library open ≥54 hrs/week (college) or ≥60 hrs/week (university). An ILS with OPAC, circulation, cataloguing, and statistical data on utilization are required.',
    metrics: [
      { id: 'AACCUP-D1-HOURS-WEEK',       label: 'D.1 Library Open Hours per Week',                                   unit: 'hours/week',   hint: 'College: ≥54 hours; University: ≥60 hours per week',           comply: (v:number) => v >= 54 },
      { id: 'AACCUP-D2-ACCESS-SYSTEM',    label: 'D.2 System Providing Faculty & Students Greater Access',            unit: '1=Yes / 0=No', hint: 'e.g. OPAC, borrower card, online reservation, extended loans',  comply: (v:number) => v === 1 },
      { id: 'AACCUP-D3-DISSEMINATION',    label: 'D.3 Library Promotes New Acquisitions, Resources & Services',       unit: '1=Yes / 0=No', hint: 'Regular announcements via bulletin board, website, social media' },
      { id: 'AACCUP-D4-STAFF-AVAILABLE',  label: 'D.4 Librarians / Staff Available During All Library Hours',        unit: '1=Yes / 0=No', hint: 'Desk service available for the entire open period',             comply: (v:number) => v === 1 },
      { id: 'AACCUP-D5-1-WEBPAGE',        label: 'D.5.1 Functional & Interactive Library Web Page',                   unit: '1=Yes / 0=No', hint: 'Active library website with current content and resources' },
      { id: 'AACCUP-D5-2-ILS',            label: 'D.5.2 Integrated Library System Available',                         unit: '1=Yes / 0=No', hint: 'Covers OPAC, circulation, cataloguing, inventory',              comply: (v:number) => v === 1 },
      { id: 'AACCUP-D5-OPAC',             label: 'D.5.2.1 OPAC (Online Public Access Catalog)',                       unit: '1=Yes / 0=No', hint: 'Users can search catalog online',                               comply: (v:number) => v === 1 },
      { id: 'AACCUP-D5-CIRC-ONLINE',      label: 'D.5.2.2 Online / Computerized Circulation',                         unit: '1=Yes / 0=No', hint: 'Borrowing and returning processed through the ILS' },
      { id: 'AACCUP-D5-CAT-COMPUTER',     label: 'D.5.2.3 Computerized Cataloguing',                                  unit: '1=Yes / 0=No', hint: 'Bibliographic records created/maintained in the ILS' },
      { id: 'AACCUP-D5-INVENTORY',        label: 'D.5.2.4 Inventory / Stock-Taking Reporting via ILS',                unit: '1=Yes / 0=No', hint: 'ILS used for annual or periodic inventory reporting' },
      { id: 'AACCUP-D5-SERIALS',          label: 'D.5.2.5 Serials Control Module',                                    unit: '1=Yes / 0=No', hint: 'Tracking receipt, routing, and claiming of serial titles' },
      { id: 'AACCUP-D5-INTERNET',         label: 'D.5.2.6 Internet Searching Available to Users',                     unit: '1=Yes / 0=No', hint: 'Library provides internet-connected terminals for users' },
      { id: 'AACCUP-D5-CDROM',            label: 'D.5.2.7 CD-ROM / Optical Media Services',                           unit: '1=Yes / 0=No', hint: 'CD-ROM databases or optical disc resources available' },
      { id: 'AACCUP-D5-ONLINE-DB',        label: 'D.5.2.8 Online Database Access',                                    unit: '1=Yes / 0=No', hint: 'Subscribed or free online databases accessible to users',        comply: (v:number) => v === 1 },
      { id: 'AACCUP-D5-PHOTOCOPYING',     label: 'D.5.2.9 Photocopying / Reproduction Services',                      unit: '1=Yes / 0=No', hint: 'Photocopier or scanner available for user reproduction needs' },
      { id: 'AACCUP-D5-BARCODING',        label: 'D.5.2.10 Bar Coding of Library Materials',                          unit: '1=Yes / 0=No', hint: 'Items and patron cards barcoded for ILS circulation' },
      { id: 'AACCUP-D6-STATISTICS',       label: 'D.6 Statistical Data on Resource/Service Utilization Compiled & Used', unit: '1=Yes / 0=No', hint: 'Regular statistical reports inform collection & operations decisions', comply: (v:number) => v === 1 },
    ],
  },
  {
    section: 'E — Physical Set-up and Facilities',
    icon: '🏢',
    note: 'Reading room must accommodate ≥10% of school enrollment. PWD ramps, fire safety equipment, security systems, and IT/multimedia provisions are required.',
    metrics: [
      { id: 'AACCUP-E1-1-LOCATION',       label: 'E.1.1 Library Strategically Located & Accessible to All Users',    unit: '1=Yes / 0=No', hint: 'Accessible to students, faculty, and other clientele',           comply: (v:number) => v === 1 },
      { id: 'AACCUP-E1-2-EXPANSION',      label: 'E.1.2 Library Planned & Structured to Allow Future Expansion',     unit: '1=Yes / 0=No', hint: 'Floor plan provides for rearrangement and future growth' },
      { id: 'AACCUP-E2-1-SIZE',           label: 'E.2.1 Library Size Meets Standard Requirements',                    unit: '1=Yes / 0=No', hint: 'Considering present enrollment and planned future expansion',    comply: (v:number) => v === 1 },
      { id: 'AACCUP-E2-1-FLOOR-AREA',     label: 'E.2.1a Total Library Floor Area (sq m)',                            unit: 'sq meters',    hint: 'Gross usable floor area in square metres' },
      { id: 'AACCUP-E2-2-READING-CAP',    label: 'E.2.2 Reading Room Accommodates ≥10% of School Enrollment',        unit: '% (0–100)',    hint: '(Reading room seats ÷ total enrollment) × 100; target ≥10%',    comply: (v:number) => v >= 10 },
      { id: 'AACCUP-E2-2-SEATS',          label: 'E.2.2a Reader Seating Capacity (seats)',                            unit: 'seats',        hint: 'Total chairs/carrels in main reading room(s)' },
      { id: 'AACCUP-E2-3-WORKSTATIONS',   label: 'E.2.3 Space Provided for Print Resources & Electronic Workstations', unit: '1=Yes / 0=No', hint: 'Dedicated areas for stacks and computer terminals' },
      { id: 'AACCUP-E2-4-ADMIN-SPACE',    label: 'E.2.4 Space for Librarians\' Office, Staff Room & Technical Room', unit: '1=Yes / 0=No', hint: 'Separate functional areas for staff and technical services' },
      { id: 'AACCUP-E2-5-PWD-RAMPS',      label: 'E.2.5 Ramps / Facilities for Physically Disabled (PWD) Provided', unit: '1=Yes / 0=No', hint: 'Where feasible; required under RA 7277 / RA 9442',               comply: (v:number) => v === 1 },
      { id: 'AACCUP-E3-1-FURNITURE',      label: 'E.3.1 Library Meets Required Standard-Sized Furniture & Equipment', unit: '1=Yes / 0=No', hint: 'Tables, chairs, shelves, etc. meet standard dimensions and count' },
      { id: 'AACCUP-E3-SHELVES',          label: 'E.3.2 Adjustable / Movable Shelves (units)',                        unit: 'units',        hint: 'Count of adjustable shelving units in active use' },
      { id: 'AACCUP-E3-COMPUTERS',        label: 'E.3.2 Computers with Printers (units)',                             unit: 'units',        hint: 'Desktops/laptops with printers for staff and public use' },
      { id: 'AACCUP-E3-CARRELS',          label: 'E.3.2 Individual Study Carrels (units)',                            unit: 'units',        hint: 'Enclosed or semi-enclosed individual study stations' },
      { id: 'AACCUP-E4-1-LIGHTING',       label: 'E.4.1 Library is Well Lighted',                                    unit: '1=Yes / 0=No', hint: 'Adequate natural and/or artificial lighting throughout',          comply: (v:number) => v === 1 },
      { id: 'AACCUP-E4-2-VENTILATION',    label: 'E.4.2 Library is Well-Ventilated',                                  unit: '1=Yes / 0=No', hint: 'Adequate air circulation, AC, or natural ventilation',           comply: (v:number) => v === 1 },
      { id: 'AACCUP-E4-3-ATMOSPHERE',     label: 'E.4.3 Atmosphere is Conducive to Learning',                        unit: '1=Yes / 0=No', hint: 'Quiet, orderly, comfortable environment for study',             comply: (v:number) => v === 1 },
      { id: 'AACCUP-E5-1-FIRE-SAFETY',    label: 'E.5.1 Fire Extinguishers & Local Fire Alarm System Available',     unit: '1=Yes / 0=No', hint: 'Fire safety equipment regularly inspected and operational',       comply: (v:number) => v === 1 },
      { id: 'AACCUP-E5-2-SECURITY',       label: 'E.5.2 System for Security & Control of Library Resources',         unit: '1=Yes / 0=No', hint: 'e.g. RFID, tattle-tape, CCTV, bag inspection',                  comply: (v:number) => v === 1 },
      { id: 'AACCUP-E6-IT-MULTIMEDIA',    label: 'E.6 Provision for Latest IT Software & Multimedia Equipment',      unit: '1=Yes / 0=No', hint: 'Budget and plan for acquiring and updating IT and AV equipment' },
    ],
  },
  {
    section: 'F — Financial Support',
    icon: '💰',
    note: 'The library must have a separate, realistic, and adequate budget. The head librarian leads budget preparation in coordination with the Library Committee.',
    metrics: [
      { id: 'AACCUP-F1-REG-BUDGET',       label: 'F.1 Institution Allocates Regular & Realistic Library Budget',     unit: '1=Yes / 0=No', hint: 'Separate line item in institutional budget for library',          comply: (v:number) => v === 1 },
      { id: 'AACCUP-F1-ANNUAL-BUDGET',    label: 'F.1a Annual Library Budget (₱)',                                   unit: '₱',            hint: 'Total approved library operating budget for the fiscal year' },
      { id: 'AACCUP-F2-BUDGET-PROCESS',   label: 'F.2 Head Librarian & Staff Prepare & Manage Annual Budget',       unit: '1=Yes / 0=No', hint: 'Budget prepared in coordination with institutional administration' },
      { id: 'AACCUP-F3-AUDITED-PROPERLY', label: 'F.3 Library Funds Utilized Solely for Library Purposes & Audited', unit: '1=Yes / 0=No', hint: 'All fees and allocated funds properly accounted and audited',     comply: (v:number) => v === 1 },
      { id: 'AACCUP-F4-OTHER-SOURCES',    label: 'F.4 Other Sources of Financial Assistance Sought',                 unit: '1=Yes / 0=No', hint: 'e.g. grants, donations, alumni, foundation funding' },
      { id: 'AACCUP-F4-EXTERNAL-AMT',     label: 'F.4a External / Additional Funding Received This Year (₱)',        unit: '₱',            hint: 'Total from grants, donations, and external sources combined' },
    ],
  },
  {
    section: 'G — Linkages',
    icon: '🤝',
    note: 'Library must explore and establish linkages with other institutions and funding agencies, participate in consortia, and engage in resource sharing.',
    metrics: [
      { id: 'AACCUP-G1-LINKAGES',         label: 'G.1 Linkages with Other Institutions & Funding Agencies Established', unit: '1=Yes / 0=No', hint: 'MOAs or formal agreements with partner institutions or funders',  comply: (v:number) => v === 1 },
      { id: 'AACCUP-G1-MOA-COUNT',        label: 'G.1a Number of Active MOAs / Formal Linkage Agreements',            unit: 'agreements',   hint: 'Count of signed and currently active MOAs' },
      { id: 'AACCUP-G2-MAILING-LIST',     label: 'G.2 Library on Mailing List of Agencies for Exchange / Donations',  unit: '1=Yes / 0=No', hint: 'Subscribed to agency mailing lists for book exchange or donations' },
      { id: 'AACCUP-G3-CONSORTIA',        label: 'G.3 Consortia, Networking & Resource Sharing Practiced',            unit: '1=Yes / 0=No', hint: 'Active participation in library consortium or cooperative programs', comply: (v:number) => v === 1 },
      { id: 'AACCUP-G3-PARTNERS',         label: 'G.3a Number of Resource-Sharing Partner Libraries',                  unit: 'libraries',    hint: 'Libraries with active ILL, consortium, or cooperative agreements' },
    ],
  },
] as const;

type AaccupMetricID = typeof AACCUP_SECTIONS[number]['metrics'][number]['id'];
type AaccupStored = Record<string, { value: number; notes: string; date: string }>;

function AaccupAutoVerified({ chedStats }: { chedStats: Record<string,number> | null }) {
  if (!chedStats || chedStats.error) return null;

  const totalTitles      = chedStats.totalTitles ?? 0;
  const totalItems       = chedStats.totalItems ?? 0;
  const filipiniana      = chedStats.filipianianaItems ?? 0;
  const last10Years      = chedStats.itemsLast10Years ?? 0;
  const withdrawnThisYr  = chedStats.withdrawnThisYear ?? 0;
  const totalILL         = chedStats.totalILL ?? 0;

  const currencyPct = totalItems > 0 ? (last10Years / totalItems) * 100 : 0;
  const filPct      = totalItems > 0 ? (filipiniana / totalItems) * 100 : 0;

  const items: { id: string; label: string; value: string; pass: boolean; note: string }[] = [
    {
      id: 'C4',
      label: 'C.4 Core Collection Titles',
      value: `${totalTitles.toLocaleString()} titles`,
      pass: totalTitles >= 5000,
      note: totalTitles >= 5000 ? 'Meets ≥5,000 title requirement' : `Deficit: ${(5000 - totalTitles).toLocaleString()} titles to go`,
    },
    {
      id: 'C5',
      label: 'C.5 ≥30% Holdings are Current (≤10 yrs)',
      value: `${currencyPct.toFixed(1)}% (${last10Years.toLocaleString()} of ${totalItems.toLocaleString()})`,
      pass: currencyPct >= 30,
      note: currencyPct >= 30 ? 'Collection currency meets 30% threshold' : `Gap: ${(30 - currencyPct).toFixed(1)} pp below threshold`,
    },
    {
      id: 'C8',
      label: 'C.8 Filipiniana Collection Maintained',
      value: `${filipiniana.toLocaleString()} items (${filPct.toFixed(1)}%)`,
      pass: filipiniana > 0,
      note: filipiniana > 0 ? 'Filipiniana sublocation present in catalog' : 'No Filipiniana items found — check sublocation tag',
    },
    {
      id: 'C11',
      label: 'C.11 Integrated Library System (ILS)',
      value: 'Destiny ILS — Active',
      pass: true,
      note: 'Dashboard is connected to a live Destiny ILS instance',
    },
    {
      id: 'C13',
      label: 'C.13 Regular Weeding Program',
      value: `${withdrawnThisYr.toLocaleString()} items withdrawn this year`,
      pass: withdrawnThisYr > 0,
      note: withdrawnThisYr > 0 ? 'Deselection activity confirmed in Destiny' : 'No withdrawals recorded this year',
    },
    {
      id: 'D5.2',
      label: 'D.5.2 Integrated Library System Available',
      value: 'Destiny ILS — Active',
      pass: true,
      note: 'Confirmed: ILS is running and serving this dashboard',
    },
    {
      id: 'D5.2.1',
      label: 'D.5.2.1 OPAC Available',
      value: 'Destiny OPAC — Available',
      pass: true,
      note: 'Destiny provides an OPAC for patron catalog searching',
    },
    {
      id: 'D5.2.2',
      label: 'D.5.2.2 Computerized Circulation',
      value: 'Destiny Circulation — Active',
      pass: true,
      note: 'Circulation data is live in this dashboard',
    },
    {
      id: 'D5.2.3',
      label: 'D.5.2.3 Computerized Cataloguing',
      value: 'Destiny Cataloguing — Active',
      pass: true,
      note: `${totalTitles.toLocaleString()} bibliographic records in ILS`,
    },
    {
      id: 'D5.2.10',
      label: 'D.5.2.10 Bar Coding of Library Materials',
      value: `${totalItems.toLocaleString()} barcoded items`,
      pass: totalItems > 0,
      note: 'Destiny uses barcodes for circulation; item count confirms active barcoding',
    },
    {
      id: 'D6',
      label: 'D.6 Statistical Data Compiled & Used',
      value: 'This Dashboard — Active',
      pass: true,
      note: 'Circulation, patron, and collection statistics generated from live ILS data',
    },
    {
      id: 'G.ILL',
      label: 'G.3 / CHED §5 — ILL / Resource Sharing',
      value: `${totalILL.toLocaleString()} total ILL records`,
      pass: totalILL > 0,
      note: totalILL > 0 ? 'ILL transactions found in Destiny — supports G.3 linkage claim' : 'No ILL records found in Destiny',
    },
  ];

  const passCount = items.filter(i => i.pass).length;

  return (
    <div className="mb-8">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
        <span>🤖</span>ILS Auto-Verified Indicators
        <span className="ml-auto text-xs font-normal bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
          {passCount}/{items.length} confirmed from Destiny
        </span>
      </h2>
      <div className="bg-white rounded-xl shadow-sm p-4 text-sm divide-y divide-gray-100">
        {items.map(item => (
          <div key={item.id} className="flex items-start gap-3 py-2.5">
            <span className={`mt-0.5 text-base flex-shrink-0 ${item.pass ? 'text-green-500' : 'text-red-400'}`}>
              {item.pass ? '✓' : '✗'}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-gray-800">{item.label}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${item.pass ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                  {item.value}
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-0.5">{item.note}</div>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-1.5">
        These indicators are computed automatically from live Destiny ILS data. To record the verified values into your AACCUP self-survey below, enter them in the corresponding manual fields.
      </p>
    </div>
  );
}

function AaccupManualSection({ unlocked }: { unlocked: boolean }) {
  const [stored, setStored]   = useState<AaccupStored>({});
  const [loading, setLoading] = useState(true);
  const [sbError, setSbError] = useState<string | null>(null);
  const [saving, setSaving]   = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft]     = useState({ value: '', notes: '' });

  const allIds = AACCUP_SECTIONS.flatMap(s => s.metrics.map(m => m.id));

  useEffect(() => {
    async function load() {
      try {
        const { supabase } = await import('@/lib/supabase');
        const { data, error } = await supabase
          .from('green_metrics')
          .select('metric_id, value, notes, recorded_on')
          .in('metric_id', allIds)
          .order('recorded_on', { ascending: false });
        if (error) { setSbError(error.message); return; }
        const map: AaccupStored = {};
        for (const row of data ?? []) {
          if (!map[row.metric_id]) {
            map[row.metric_id] = { value: Number(row.value), notes: row.notes ?? '', date: row.recorded_on };
          }
        }
        setStored(map);
      } catch (err) {
        setSbError(err instanceof Error ? err.message : 'Supabase not configured');
      } finally {
        setLoading(false);
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveEntry(id: string) {
    const num = parseFloat(draft.value);
    if (isNaN(num)) { setEditing(null); return; }
    setSaving(id);
    try {
      const { supabase } = await import('@/lib/supabase');
      const today = new Date().toISOString().slice(0, 10);
      await supabase.from('green_metrics').upsert(
        { metric_id: id, recorded_on: today, value: num, notes: draft.notes || null },
        { onConflict: 'metric_id,recorded_on' },
      );
      setStored(prev => ({ ...prev, [id]: { value: num, notes: draft.notes, date: today } }));
      setEditing(null);
    } catch { /* ignore */ } finally { setSaving(null); }
  }

  function startEdit(id: string) {
    const sv = stored[id];
    setDraft({ value: sv ? String(sv.value) : '', notes: sv?.notes ?? '' });
    setEditing(id);
  }

  function fmtValue(v: number, unit: string) {
    if (unit === '1=Yes / 0=No') return v === 1 ? '✓ Yes' : v === 0 ? '✗ No' : String(v);
    if (unit === '% (0–100)') return v.toFixed(1) + '%';
    return v % 1 === 0 ? v.toLocaleString() : v.toFixed(1);
  }

  const recordedCount = Object.keys(stored).length;
  const totalCount = allIds.length;

  // compliance summary
  const sections = AACCUP_SECTIONS.map(sec => {
    let pass = 0, fail = 0, na = 0;
    for (const m of sec.metrics) {
      const sv = stored[m.id];
      const val = sv?.value ?? null;
      const complyFn = 'comply' in m ? (m as {comply?: (v:number)=>boolean}).comply : undefined;
      if (!complyFn) { na++; continue; }
      if (val === null) { na++; continue; }
      complyFn(val) ? pass++ : fail++;
    }
    return { section: sec.section, icon: sec.icon, pass, fail, na, total: sec.metrics.length };
  });
  const totalPass = sections.reduce((a, s) => a + s.pass, 0);
  const totalFail = sections.reduce((a, s) => a + s.fail, 0);
  const scored = totalPass + totalFail;

  return (
    <div className="mt-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-2">
          📝 AACCUP Area VII — Manual Documentation Metrics
        </h2>
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
          {recordedCount}/{totalCount} fields recorded
        </span>
      </div>

      {/* quick compliance summary grid */}
      {scored > 0 && (
        <div className="mb-6 bg-white rounded-xl shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Compliance at a Glance</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
            {sections.map(s => (
              <div key={s.section} className="border rounded-lg p-3 text-xs">
                <div className="font-semibold text-gray-700 mb-1">{s.icon} {s.section.split(' — ')[0]}</div>
                <div className="flex gap-2">
                  <span className="text-green-700 font-bold">{s.pass} ✓</span>
                  <span className="text-red-600 font-bold">{s.fail} ✗</span>
                  {s.na > 0 && <span className="text-gray-400">{s.na} —</span>}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-green-700 font-semibold">{totalPass} compliant</span>
            <span className="text-red-600 font-semibold">{totalFail} non-compliant</span>
            <span className="text-gray-500">of {scored} rated indicators</span>
            <div className="flex-1 bg-gray-100 rounded-full h-2 ml-2">
              <div className="bg-green-500 h-2 rounded-full" style={{ width: `${scored ? (totalPass/scored*100) : 0}%` }} />
            </div>
            <span className="text-gray-700 font-bold">{scored ? (totalPass/scored*100).toFixed(0) : 0}%</span>
          </div>
        </div>
      )}

      {sbError && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          ⚠️ {sbError} — values cannot be saved until Supabase is configured.
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-gray-400 text-sm">Loading saved values…</div>
      ) : (
        <div className="space-y-6">
          {AACCUP_SECTIONS.map(sec => (
            <div key={sec.section} className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-green-800 text-white">
                <span>{sec.icon}</span>
                <span className="text-sm font-semibold">{sec.section}</span>
              </div>
              {'note' in sec && sec.note && (
                <div className="px-4 py-2 bg-green-50 border-b border-green-100 text-xs text-green-800">
                  {sec.note as string}
                </div>
              )}
              <div className="divide-y divide-gray-100">
                {sec.metrics.map(m => {
                  const sv    = stored[m.id];
                  const val   = sv?.value ?? null;
                  const isEd  = editing === m.id;
                  const isSav = saving === m.id;
                  const complyFn = 'comply' in m ? (m as {comply?: (v:number)=>boolean}).comply : undefined;
                  const comply = complyFn && val !== null ? complyFn(val) : null;

                  return (
                    <div key={m.id} className="px-4 py-3 flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-mono text-gray-400 mb-0.5">{m.id}</div>
                        <div className="text-sm font-medium text-gray-800">{m.label}</div>
                        {sv?.notes && <div className="text-xs text-gray-500 mt-0.5 italic">Note: {sv.notes}</div>}
                        {sv?.date  && <div className="text-xs text-gray-400 mt-0.5">Updated: {sv.date}</div>}
                      </div>

                      {isEd ? (
                        <div className="flex flex-col gap-2 shrink-0 min-w-[220px]">
                          <div className="flex gap-2">
                            <input
                              type="number" step="any"
                              value={draft.value}
                              onChange={e => setDraft(d => ({ ...d, value: e.target.value }))}
                              placeholder={m.hint}
                              className="w-28 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                              autoFocus
                            />
                            <input
                              type="text"
                              value={draft.notes}
                              onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
                              placeholder="Notes (optional)"
                              className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => saveEntry(m.id)} disabled={isSav} className="bg-green-700 hover:bg-green-800 disabled:opacity-60 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">
                              {isSav ? 'Saving…' : 'Save'}
                            </button>
                            <button onClick={() => setEditing(null)} className="text-xs text-gray-500 hover:text-gray-700 px-2">Cancel</button>
                          </div>
                          <div className="text-xs text-gray-400">{m.hint}</div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            {val !== null ? (
                              <>
                                <div className={`text-lg font-bold ${comply === true ? 'text-green-700' : comply === false ? 'text-red-600' : 'text-gray-800'}`}>
                                  {fmtValue(val, m.unit)}
                                </div>
                                <div className="text-xs text-gray-500">{m.unit}</div>
                                {comply === true  && <div className="text-xs text-green-600 font-medium">✓ Compliant</div>}
                                {comply === false && <div className="text-xs text-red-500 font-medium">✗ Non-compliant</div>}
                              </>
                            ) : (
                              <div className="text-sm text-gray-400 italic">Not recorded</div>
                            )}
                          </div>
                          {unlocked && (
                            <button
                              onClick={() => startEdit(m.id as AaccupMetricID)}
                              className="bg-white border border-gray-300 hover:border-green-500 hover:text-green-700 text-gray-600 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                            >
                              {val !== null ? '✏️ Edit' : '+ Enter'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChedManualSection({ unlocked }: { unlocked: boolean }) {
  const [stored, setStored]   = useState<ChedStored>({});
  const [loading, setLoading] = useState(true);
  const [sbError, setSbError] = useState<string | null>(null);
  const [saving, setSaving]   = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft]     = useState({ value: '', notes: '' });

  const allIds = CHED_MANUAL_SECTIONS.flatMap(s => s.metrics.map(m => m.id));

  useEffect(() => {
    async function load() {
      try {
        const { supabase } = await import('@/lib/supabase');
        const { data, error } = await supabase
          .from('green_metrics')
          .select('metric_id, value, notes, recorded_on')
          .in('metric_id', allIds)
          .order('recorded_on', { ascending: false });
        if (error) { setSbError(error.message); return; }
        const map: ChedStored = {};
        for (const row of data ?? []) {
          if (!map[row.metric_id]) {
            map[row.metric_id] = { value: Number(row.value), notes: row.notes ?? '', date: row.recorded_on };
          }
        }
        setStored(map);
      } catch (err) {
        setSbError(err instanceof Error ? err.message : 'Supabase not configured');
      } finally {
        setLoading(false);
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveEntry(id: string) {
    const num = parseFloat(draft.value);
    if (isNaN(num)) { setEditing(null); return; }
    setSaving(id);
    try {
      const { supabase } = await import('@/lib/supabase');
      const today = new Date().toISOString().slice(0, 10);
      await supabase.from('green_metrics').upsert(
        { metric_id: id, recorded_on: today, value: num, notes: draft.notes || null },
        { onConflict: 'metric_id,recorded_on' },
      );
      setStored(prev => ({ ...prev, [id]: { value: num, notes: draft.notes, date: today } }));
      setEditing(null);
    } catch { /* ignore */ } finally {
      setSaving(null);
    }
  }

  function startEdit(id: string) {
    const sv = stored[id];
    setDraft({ value: sv ? String(sv.value) : '', notes: sv?.notes ?? '' });
    setEditing(id);
  }

  function fmtValue(id: string, v: number, unit: string) {
    if (unit === '1=Yes / 0=No') return v === 1 ? '✓ Yes' : v === 0 ? '✗ No' : String(v);
    if (unit === 'year') return String(Math.round(v));
    if (unit === 'level') return v === 3 ? 'PhD / Doctorate' : v === 2 ? 'Masters (MA/MS)' : 'Bachelor\'s (BS/AB)';
    return v % 1 === 0 ? v.toLocaleString() : v.toFixed(1);
  }

  const recordedCount = Object.keys(stored).length;
  const totalCount = allIds.length;

  return (
    <div className="mt-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-2">
          📝 Manual Documentation Metrics
        </h2>
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
          {recordedCount}/{totalCount} fields recorded
        </span>
      </div>

      {sbError && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          ⚠️ {sbError} — values cannot be saved until Supabase is configured.
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-gray-400 text-sm">Loading saved values…</div>
      ) : (
        <div className="space-y-6">
          {CHED_MANUAL_SECTIONS.map(sec => (
            <div key={sec.section} className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-gray-700 text-white">
                <span>{sec.icon}</span>
                <span className="text-sm font-semibold">{sec.section}</span>
              </div>
              {'note' in sec && sec.note && (
                <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-700">
                  {sec.note as string}
                </div>
              )}
              <div className="divide-y divide-gray-100">
                {sec.metrics.map(m => {
                  const sv    = stored[m.id];
                  const val   = sv?.value ?? null;
                  const isEd  = editing === m.id;
                  const isSav = saving === m.id;
                  const complyFn = 'comply' in m ? (m as {comply?: (v:number)=>boolean}).comply : undefined;
                  const comply = complyFn && val !== null ? complyFn(val) : null;

                  return (
                    <div key={m.id} className="px-4 py-3 flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-mono text-gray-500 mb-0.5">{m.id}</div>
                        <div className="text-sm font-medium text-gray-800">{m.label}</div>
                        {sv?.notes && <div className="text-xs text-gray-500 mt-0.5 italic">Note: {sv.notes}</div>}
                        {sv?.date  && <div className="text-xs text-gray-400 mt-0.5">Updated: {sv.date}</div>}
                      </div>

                      {isEd ? (
                        <div className="flex flex-col gap-2 shrink-0 min-w-[220px]">
                          <div className="flex gap-2">
                            <input
                              type="number" step="any"
                              value={draft.value}
                              onChange={e => setDraft(d => ({ ...d, value: e.target.value }))}
                              placeholder={m.hint}
                              className="w-28 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                              autoFocus
                            />
                            <input
                              type="text"
                              value={draft.notes}
                              onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
                              placeholder="Notes (optional)"
                              className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => saveEntry(m.id)} disabled={isSav} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">
                              {isSav ? 'Saving…' : 'Save'}
                            </button>
                            <button onClick={() => setEditing(null)} className="text-xs text-gray-500 hover:text-gray-700 px-2">Cancel</button>
                          </div>
                          <div className="text-xs text-gray-400">{m.hint}</div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            {val !== null ? (
                              <>
                                <div className={`text-lg font-bold ${comply === true ? 'text-green-700' : comply === false ? 'text-red-600' : 'text-gray-800'}`}>
                                  {fmtValue(m.id, val, m.unit)}
                                </div>
                                <div className="text-xs text-gray-500">{m.unit}</div>
                                {comply === true  && <div className="text-xs text-green-600 font-medium">✓ Compliant</div>}
                                {comply === false && <div className="text-xs text-red-500 font-medium">✗ Non-compliant</div>}
                              </>
                            ) : (
                              <div className="text-sm text-gray-400 italic">Not recorded</div>
                            )}
                          </div>
                          {unlocked && (
                            <button
                              onClick={() => startEdit(m.id as ChedMetricID)}
                              className="bg-white border border-gray-300 hover:border-blue-400 hover:text-blue-700 text-gray-600 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                            >
                              {val !== null ? '✏️ Edit' : '+ Enter'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
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
  const [showExtraFilters, setShowExtraFilters] = useState(false);
  const [insightsUnlocked, setInsightsUnlocked] = useState(false);
  const [pwDraft, setPwDraft] = useState('');
  const [pwError, setPwError] = useState(false);

  type ActivityRow = { name:string; totalPatrons:number; activePatrons:number; totalCheckouts:number; overdueItems:number; activeRate:number; checkoutsPerPatron:number };
  const [genderActivity, setGenderActivity]       = useState<ActivityRow[]>([]);
  const [patronTypeActivity, setPatronTypeActivity] = useState<ActivityRow[]>([]);

  const [activeTab, setActiveTab] = useState<'overview'|'patrons'|'collection'|'iso'|'ched'|'aaccup'|'insights'|'trends'>('overview');
  const [chartsLoaded, setChartsLoaded] = useState({ patrons: false, collection: false, insights: false });
  const [chedStats, setChedStats] = useState<Record<string,number> | null>(null);
  const [strategicStats, setStrategicStats] = useState<Record<string,number> | null>(null);
  const [strategicLoaded, setStrategicLoaded] = useState(false);
  const [acqData, setAcqData] = useState<{year:number;items:number;titles:number;spend:number}[]>([]);
  const [chedLoaded, setChedLoaded] = useState(false);

  type TopTitle       = { Title: string; Author: string; BibID: number; checkoutCount: number; currentlyOut: number };
  type CollAgeRow     = { acqYear: number; items: number; titles: number; everBorrowed: number };
  type PatronGrowthRow = { label: string; yr: number; mo: number; newPatrons: number };
  type RetentionStats = { activeLastYear: number; activeThisYear: number; retained: number; newBorrowers: number; retentionRate: number; year: number };
  type ActivePatron   = { PatronBarcode: string; LastName: string; FirstName: string; PatronType: string; totalCheckouts: number; checkoutsThisYear: number; overdueCount: number };
  type OverdueItem    = { CopyBarcode: string; Title: string; Author: string; PatronBarcode: string; PatronType: string; DateDue: string; DaysOverdue: number; ReplacementCost: number };
  type CallNumRow     = { range: string; firstDigit: string; items: number; titles: number; checkouts: number; utilRate: number };
  type PeakDayRow    = { day: string; checkouts: number };
  type LoanDurRow    = { patronType: string; currentlyOut: number; avgDaysOut: number; avgLoanPeriod: number; overdueCount: number };
  type WeedItem      = { Title: string; Author: string; CallNumber: string; CopyBarcode: string; Acquired: string; LastBorrowed: string; daysSinceActivity: number; Price: number };
  type NeverBorrowedRow = { firstDigit: string; neverBorrowedTitles: number; neverBorrowedItems: number };
  type LapsedRow     = { patronType: string; lapsedCount: number };
  type FineByTypeRow = { patronType: string; patronsWithFines: number; fineCount: number; totalFines: number; avgFine: number };
  type AvgAgeRow     = { range: string; firstDigit: string; avgAgeYears: number; itemCount: number; oldestYear: number; newestYear: number };

  const [topTitles, setTopTitles]         = useState<TopTitle[]>([]);
  const [collAge, setCollAge]             = useState<CollAgeRow[]>([]);
  const [patronGrowth, setPatronGrowth]   = useState<PatronGrowthRow[]>([]);
  const [retention, setRetention]         = useState<RetentionStats | null>(null);
  const [activePatrons, setActivePatrons] = useState<ActivePatron[]>([]);
  const [longestOverdue, setLongestOverdue] = useState<OverdueItem[]>([]);
  const [callNumData, setCallNumData]     = useState<CallNumRow[]>([]);
  const [extraLoaded, setExtraLoaded]     = useState({ collection: false, patrons: false });

  const [peakDays, setPeakDays]           = useState<PeakDayRow[]>([]);
  const [loanDur, setLoanDur]             = useState<{ byPatronType: LoanDurRow[]; overall: { avgDaysOut: number; avgLoanPeriod: number; currentlyOut: number; overdueCount: number }; note: string } | null>(null);
  const [weedData, setWeedData]           = useState<{ items: WeedItem[]; summary: { candidateCount: number; totalValue: number }; yearsThreshold: number } | null>(null);
  const [neverBorrowed, setNeverBorrowed] = useState<{ byDewey: NeverBorrowedRow[]; totals: { totalTitles: number; totalItems: number; neverBorrowedItems: number; neverBorrowedTitles: number } } | null>(null);
  const [lapsedData, setLapsedData]       = useState<{ activeLastYear: number; activeThisYear: number; lapsedCount: number; lapsedRate: number; year: number; byType: LapsedRow[] } | null>(null);
  const [finesByType, setFinesByType]     = useState<FineByTypeRow[]>([]);
  const [avgColAge, setAvgColAge]         = useState<AvgAgeRow[]>([]);
  const [extraLoaded2, setExtraLoaded2]   = useState({ collection: false, patrons: false });
  const [extra2Errors, setExtra2Errors]   = useState<Record<string, string>>({});
  const [extra2Loading, setExtra2Loading] = useState<Record<string, boolean>>({});
  const [yoyData, setYoyData]             = useState<{year:number;checkouts:number;newPatrons:number;newItems:number}[]>([]);
  const [patronTiers, setPatronTiers]     = useState<{totalPatrons:number;activeThisYear:number;lapsed:number;neverBorrowed:number;newThisYear:number;year:number}|null>(null);
  const [yoyLoaded, setYoyLoaded]         = useState(false);

  type MonthlyRow = { year: number; month: number; checkouts: number; checkins: number; active_patrons: number; new_patrons: number; new_items: number };
  type DailySnap  = { snapshot_date: string; total_items: number; checked_out: number; active_patrons_30d: number; checkouts_30d: number; total_patrons: number };
  const [trendsLoaded,    setTrendsLoaded]    = useState(false);
  const [monthlyData,     setMonthlyData]     = useState<MonthlyRow[]>([]);
  const [dailySnaps,      setDailySnaps]      = useState<DailySnap[]>([]);
  const [syncDailyStatus, setSyncDailyStatus] = useState<string | null>(null);
  const [syncMonthStatus, setSyncMonthStatus] = useState<string | null>(null);
  const [syncingDaily,    setSyncingDaily]    = useState(false);
  const [syncingMonthly,  setSyncingMonthly]  = useState(false);

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
    if (activeTab === 'collection' && !extraLoaded.collection) {
      setExtraLoaded(p => ({ ...p, collection: true }));
      fetch('/api/charts/top-titles').then(r=>r.json()).then(d=>{ if(Array.isArray(d)) setTopTitles(d); }).catch(() => {});
      fetch('/api/charts/collection-age').then(r=>r.json()).then(d=>{ if(Array.isArray(d)) setCollAge(d); }).catch(() => {});
      fetch('/api/charts/longest-overdue?limit=10').then(r=>r.json()).then(d=>{ if(Array.isArray(d)) setLongestOverdue(d); }).catch(() => {});
      fetch('/api/charts/by-callnumber').then(r=>r.json()).then(d=>{ if(Array.isArray(d)) setCallNumData(d); }).catch(() => {});
    }
    if (activeTab === 'patrons' && !extraLoaded.patrons) {
      setExtraLoaded(p => ({ ...p, patrons: true }));
      fetch('/api/charts/patron-growth?years=3').then(r=>r.json()).then(d=>{ if(Array.isArray(d)) setPatronGrowth(d); }).catch(() => {});
      fetch('/api/charts/patron-retention').then(r=>r.json()).then(d=>{ if(d && !d.error) setRetention(d); }).catch(() => {});
      fetch('/api/charts/top-active-patrons?limit=10').then(r=>r.json()).then(d=>{ if(Array.isArray(d)) setActivePatrons(d); }).catch(() => {});
    }
    if ((activeTab === 'collection' || activeTab === 'insights') && !extraLoaded2.collection) {
      setExtraLoaded2(p => ({ ...p, collection: true }));
      const mkLoad = (key: string) => setExtra2Loading(p => ({ ...p, [key]: true }));
      const mkDone = (key: string) => setExtra2Loading(p => ({ ...p, [key]: false }));
      const mkErr  = (key: string, msg: string) => { setExtra2Errors(p => ({ ...p, [key]: msg })); setExtra2Loading(p => ({ ...p, [key]: false })); };
      mkLoad('weed');
      fetch('/api/charts/weeding-candidates?years=3&limit=20').then(r=>r.json()).then(d=>{ if(d && !d.error) { setWeedData(d); mkDone('weed'); } else mkErr('weed', d?.error ?? 'No data'); }).catch(e=>mkErr('weed', String(e)));
      mkLoad('neverBorrowed');
      fetch('/api/charts/never-borrowed').then(r=>r.json()).then(d=>{ if(d && !d.error) { setNeverBorrowed(d); mkDone('neverBorrowed'); } else mkErr('neverBorrowed', d?.error ?? 'No data'); }).catch(e=>mkErr('neverBorrowed', String(e)));
      mkLoad('avgColAge');
      fetch('/api/charts/avg-collection-age').then(r=>r.json()).then(d=>{ if(Array.isArray(d) && d.length) { setAvgColAge(d); mkDone('avgColAge'); } else mkErr('avgColAge', d?.error ?? 'No data'); }).catch(e=>mkErr('avgColAge', String(e)));
    }
    if ((activeTab === 'patrons' || activeTab === 'insights') && !extraLoaded2.patrons) {
      setExtraLoaded2(p => ({ ...p, patrons: true }));
      const mkLoad = (key: string) => setExtra2Loading(p => ({ ...p, [key]: true }));
      const mkDone = (key: string) => setExtra2Loading(p => ({ ...p, [key]: false }));
      const mkErr  = (key: string, msg: string) => { setExtra2Errors(p => ({ ...p, [key]: msg })); setExtra2Loading(p => ({ ...p, [key]: false })); };
      mkLoad('peakDays');
      fetch('/api/charts/peak-checkout-days').then(r=>r.json()).then(d=>{ if(Array.isArray(d) && d.length) { setPeakDays(d); mkDone('peakDays'); } else mkErr('peakDays', d?.error ?? 'No data'); }).catch(e=>mkErr('peakDays', String(e)));
      mkLoad('loanDur');
      fetch('/api/charts/avg-loan-duration').then(r=>r.json()).then(d=>{ if(d && !d.error) { setLoanDur(d); mkDone('loanDur'); } else mkErr('loanDur', d?.error ?? 'No data'); }).catch(e=>mkErr('loanDur', String(e)));
      mkLoad('lapsed');
      fetch('/api/charts/lapsed-patrons').then(r=>r.json()).then(d=>{ if(d && !d.error) { setLapsedData(d); mkDone('lapsed'); } else mkErr('lapsed', d?.error ?? 'No data'); }).catch(e=>mkErr('lapsed', String(e)));
      mkLoad('fines');
      fetch('/api/charts/fines-by-patrontype').then(r=>r.json()).then(d=>{ if(Array.isArray(d) && d.length) { setFinesByType(d); mkDone('fines'); } else mkErr('fines', d?.error ?? 'No data'); }).catch(e=>mkErr('fines', String(e)));
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
    if ((activeTab === 'overview') && !yoyLoaded) {
      setYoyLoaded(true);
      fetch('/api/charts/yoy-circulation').then(r=>r.json()).then(d=>{ if(d.years) setYoyData(d.years); }).catch(() => {});
    }
    if (activeTab === 'patrons' && !extraLoaded.patrons && !patronTiers) {
      fetch(`/api/charts/patron-tiers?year=${year}`).then(r=>r.json()).then(d=>{ if(d && !d.error) setPatronTiers(d); }).catch(() => {});
    }
    if ((activeTab === 'insights' || activeTab === 'iso') && !strategicLoaded) {
      setStrategicLoaded(true);
      fetch('/api/strategic/stats').then(r => r.json()).then(setStrategicStats).catch(() => {});
    }
    if (activeTab === 'ched' && !chedLoaded) {
      setChedLoaded(true);
      fetch('/api/ched/stats').then(r=>r.json()).then(d=>{ setChedStats(d); }).catch(() => {});
      fetch('/api/ched/acquisition-by-year').then(r=>r.json()).then(d=>{ if(d.data) setAcqData(d.data); }).catch(() => {});
    }
    if (activeTab === 'trends' && !trendsLoaded) {
      setTrendsLoaded(true);
      (async () => {
        const { supabase } = await import('@/lib/supabase');
        supabase.from('monthly_circulation').select('*').order('year').order('month').then(({ data }) => {
          if (data) setMonthlyData(data as MonthlyRow[]);
        });
        supabase.from('daily_snapshots').select('snapshot_date,total_items,checked_out,active_patrons_30d,checkouts_30d,total_patrons').order('snapshot_date', { ascending: false }).limit(30).then(({ data }) => {
          if (data) setDailySnaps(data as DailySnap[]);
        });
      })();
    }
  }, [activeTab, chartsLoaded, chedLoaded, strategicLoaded, extraLoaded, extraLoaded2, yoyLoaded, year, patronTiers, trendsLoaded]);

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
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4 print:hidden">
          {/* Row 1: Year stepper + month pills + action buttons */}
          <div className="flex flex-wrap items-center gap-3 mb-3">
            {/* Year stepper */}
            <div className="flex items-center gap-1 border border-gray-200 rounded-lg overflow-hidden shrink-0">
              <button
                onClick={() => setYear(y => Math.max(2015, y - 1))}
                disabled={year <= 2015}
                className="px-2 py-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-30 text-sm font-bold transition-colors"
              >‹</button>
              <span className="px-3 py-1.5 text-sm font-semibold text-gray-800 border-x border-gray-200 min-w-[52px] text-center">{year}</span>
              <button
                onClick={() => setYear(y => Math.min(currentYear, y + 1))}
                disabled={year >= currentYear}
                className="px-2 py-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-30 text-sm font-bold transition-colors"
              >›</button>
            </div>

            {/* Month pills */}
            <div className="flex flex-wrap gap-1">
              {MONTHS.map((m, i) => (
                <button
                  key={i}
                  onClick={() => setMonth(month === i ? 0 : i)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    month === i
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {i === 0 ? 'All' : m.slice(0, 3)}
                </button>
              ))}
            </div>

            {/* Right side: extra filters toggle + export buttons */}
            <div className="ml-auto flex items-center gap-2 shrink-0">
              {(genders.length > 0 || patronTypes.length > 0) && (
                <button
                  onClick={() => setShowExtraFilters(f => !f)}
                  className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                    showExtraFilters || gender || patronTypeID
                      ? 'border-blue-400 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M7 8h10M11 12h2M9 16h6" /></svg>
                  Filters{(gender || patronTypeID > 0) ? ` (${[gender, patronTypeID > 0 ? '1' : ''].filter(Boolean).length})` : ''}
                </button>
              )}
              <button
                onClick={() => s && exportCsv(s, yearLabel, monthLabel, gender, patronTypes.find(pt => pt.PatronTypeID === patronTypeID)?.PatronTypeDescription ?? '')}
                disabled={!s || !!s.error}
                className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
              >↓ CSV</button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
              >⎙ PDF</button>
            </div>
          </div>

          {/* Row 2: expanded extra filters */}
          {showExtraFilters && (
            <div className="flex flex-wrap gap-3 pt-3 border-t border-gray-100">
              {genders.length > 0 && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Gender</label>
                  <div className="flex gap-1 flex-wrap">
                    <button onClick={() => setGender('')} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${!gender ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>All</button>
                    {genders.map(g => (
                      <button key={g} onClick={() => setGender(gender === g ? '' : g)} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${gender === g ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{g}</button>
                    ))}
                  </div>
                </div>
              )}
              {patronTypes.length > 0 && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Patron Type</label>
                  <div className="flex gap-1 flex-wrap">
                    <button onClick={() => setPatronTypeID(0)} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${patronTypeID === 0 ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>All</button>
                    {patronTypes.map(pt => (
                      <button key={pt.PatronTypeID} onClick={() => setPatronTypeID(patronTypeID === pt.PatronTypeID ? 0 : pt.PatronTypeID)} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${patronTypeID === pt.PatronTypeID ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{pt.PatronTypeDescription}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Active filter chips */}
          {(gender || patronTypeID > 0 || month > 0) && (
            <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-gray-100">
              <span className="text-xs text-gray-400 self-center">Active:</span>
              <span className="text-xs bg-blue-100 text-blue-800 font-medium px-2 py-0.5 rounded-full">{year}</span>
              {month > 0 && (
                <button onClick={() => setMonth(0)} className="flex items-center gap-1 text-xs bg-blue-100 text-blue-800 font-medium px-2 py-0.5 rounded-full hover:bg-blue-200">
                  {MONTHS[month]} <span className="text-blue-500">×</span>
                </button>
              )}
              {gender && (
                <button onClick={() => setGender('')} className="flex items-center gap-1 text-xs bg-indigo-100 text-indigo-800 font-medium px-2 py-0.5 rounded-full hover:bg-indigo-200">
                  {gender} <span className="text-indigo-500">×</span>
                </button>
              )}
              {patronTypeID > 0 && (
                <button onClick={() => setPatronTypeID(0)} className="flex items-center gap-1 text-xs bg-indigo-100 text-indigo-800 font-medium px-2 py-0.5 rounded-full hover:bg-indigo-200">
                  {patronTypes.find(pt => pt.PatronTypeID === patronTypeID)?.PatronTypeDescription} <span className="text-indigo-500">×</span>
                </button>
              )}
              {(gender || patronTypeID > 0 || month > 0) && (
                <button onClick={() => { setGender(''); setPatronTypeID(0); setMonth(0); }} className="text-xs text-gray-400 hover:text-red-500 px-1 py-0.5 transition-colors">Clear all</button>
              )}
            </div>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex gap-2 mb-6 border-b border-gray-200 print:hidden">
          {(['overview','patrons','collection','iso','ched','aaccup','insights','trends'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'iso' ? '🌐 Intl Standards' : tab === 'ched' ? 'CHED CMO 22' : tab === 'aaccup' ? 'AACCUP Area VII' : tab === 'insights' ? '💡 Insights' : tab === 'trends' ? '📈 Trends' : tab.charAt(0).toUpperCase() + tab.slice(1)}
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

          <Section title="Efficiency & Engagement Ratios" icon="📊">
            <Card label="Items per Patron"          value={s && s.totalPatrons ? (s.totalItems / s.totalPatrons).toFixed(2) : '—'} sub="ISO 2789 target: ≥ 3" color="text-indigo-700" />
            <Card label="Loans per Patron"          value={s && s.totalPatrons ? (s.checkoutsThisYear / s.totalPatrons).toFixed(2) : '—'} sub={`checkouts ÷ patrons (${periodLabel})`} color="text-blue-700" />
            <Card label="Holds Satisfaction Rate"   value={s ? pct(s.readyHolds, (s.pendingHolds + s.readyHolds) || 0) : '—'} sub="ready holds ÷ all active holds" color="text-green-700" />
            <Card label="Patron Reach Rate"         value={s && s.totalPatrons ? pct(s.activePatronsThisYear, s.totalPatrons) : '—'} sub={`active borrowers vs total (${periodLabel})`} color="text-teal-700" />
            <Card label="Hold-to-Checkout Rate"     value={s && s.checkoutsThisYear ? pct(s.holdsPlacedThisYear, s.checkoutsThisYear) : '—'} sub={`holds placed ÷ checkouts — demand signal (${periodLabel})`} color="text-purple-700" />
            <Card label="Dead Stock Rate"           value={s && s.totalItems ? pct(s.neverCheckedOut, s.totalItems) : '—'} sub="items never borrowed — weeding priority" color={s && s.neverCheckedOut/s.totalItems > 0.3 ? 'text-red-600' : 'text-amber-600'} />
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

          {/* ── Year-over-Year Circulation Trend ── */}
          {yoyData.length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-2">
                <span>📈</span>Year-over-Year Circulation Trend (Last 5 Years)
              </h2>
              <p className="text-xs text-gray-600 mb-4">Annual checkouts, new patron registrations, and new acquisitions — shows library growth trajectory.</p>
              <div className="bg-white rounded-xl shadow-sm p-5">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={yoyData} margin={{ left: 10, right: 20, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={n => n >= 1000 ? (n/1000).toFixed(0)+'k' : String(n)} />
                    <Tooltip formatter={(v: unknown) => typeof v === 'number' ? v.toLocaleString() : String(v)} />
                    <Legend />
                    <Bar dataKey="checkouts"  name="Checkouts"    fill="#3b82f6" radius={[3,3,0,0]} />
                    <Bar dataKey="newPatrons" name="New Patrons"  fill="#10b981" radius={[3,3,0,0]} />
                    <Bar dataKey="newItems"   name="New Items"    fill="#f59e0b" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-100 text-gray-700 uppercase tracking-wide">
                        <th className="text-left p-2 border border-gray-200">Year</th>
                        <th className="text-right p-2 border border-gray-200">Checkouts</th>
                        <th className="text-right p-2 border border-gray-200">YoY Change</th>
                        <th className="text-right p-2 border border-gray-200">New Patrons</th>
                        <th className="text-right p-2 border border-gray-200">New Items</th>
                      </tr>
                    </thead>
                    <tbody>
                      {yoyData.map((r, i) => {
                        const prev = yoyData[i - 1];
                        const change = prev && prev.checkouts > 0 ? ((r.checkouts - prev.checkouts) / prev.checkouts * 100) : null;
                        return (
                          <tr key={r.year} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="p-2 border border-gray-200 font-semibold text-gray-900">{r.year}</td>
                            <td className="p-2 border border-gray-200 text-right font-bold text-blue-700">{r.checkouts.toLocaleString()}</td>
                            <td className="p-2 border border-gray-200 text-right">
                              {change !== null
                                ? <span className={`font-semibold ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>{change >= 0 ? '+' : ''}{change.toFixed(1)}%</span>
                                : <span className="text-gray-400">—</span>}
                            </td>
                            <td className="p-2 border border-gray-200 text-right text-emerald-700">{r.newPatrons.toLocaleString()}</td>
                            <td className="p-2 border border-gray-200 text-right text-amber-700">{r.newItems.toLocaleString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
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

          {/* ── Patron Engagement Tiers ── */}
          {patronTiers && (
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-2">
                <span>🎯</span>Patron Engagement Tiers ({patronTiers.year})
              </h2>
              <p className="text-xs text-gray-600 mb-4">Breakdown of your patron base by engagement level — active borrowers, lapsed, and never-borrowed.</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-green-700">{patronTiers.activeThisYear.toLocaleString()}</div>
                  <div className="text-sm font-medium text-gray-600">Active {patronTiers.year}</div>
                  <div className="text-xs text-gray-600">{patronTiers.totalPatrons > 0 ? (patronTiers.activeThisYear/patronTiers.totalPatrons*100).toFixed(1) : '—'}% of total</div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-amber-700">{patronTiers.lapsed.toLocaleString()}</div>
                  <div className="text-sm font-medium text-gray-600">Lapsed / Dormant</div>
                  <div className="text-xs text-gray-600">{patronTiers.totalPatrons > 0 ? (patronTiers.lapsed/patronTiers.totalPatrons*100).toFixed(1) : '—'}% of total</div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-red-600">{patronTiers.neverBorrowed.toLocaleString()}</div>
                  <div className="text-sm font-medium text-gray-600">Never Borrowed</div>
                  <div className="text-xs text-gray-600">{patronTiers.totalPatrons > 0 ? (patronTiers.neverBorrowed/patronTiers.totalPatrons*100).toFixed(1) : '—'}% of total</div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-blue-700">{patronTiers.newThisYear.toLocaleString()}</div>
                  <div className="text-sm font-medium text-gray-600">New {patronTiers.year}</div>
                  <div className="text-xs text-gray-600">registered this year</div>
                </div>
              </div>
              {(() => {
                const tierData = [
                  { name: 'Active',        value: patronTiers.activeThisYear, color: '#10b981' },
                  { name: 'Lapsed',        value: patronTiers.lapsed,         color: '#f59e0b' },
                  { name: 'Never Borrowed',value: patronTiers.neverBorrowed,  color: '#ef4444' },
                ];
                return (
                  <div className="bg-white rounded-xl shadow-sm p-4">
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={tierData} margin={{ left: 10, right: 20, top: 4, bottom: 4 }}>
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v: unknown) => typeof v === 'number' ? v.toLocaleString() : String(v)} />
                        <Bar dataKey="value" name="Patrons" radius={[4,4,0,0]}>
                          {tierData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      Lapsed = registered patrons who borrowed before {patronTiers.year} but not this year. Never Borrowed = no borrowing history on record.
                    </p>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── Patron Growth Trend ── */}
          {patronGrowth.length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-2">
                <span>📈</span>New Patron Registrations — Last 3 Years
              </h2>
              <p className="text-xs text-gray-600 mb-4">Monthly new patron registrations. Spikes typically align with enrollment periods.</p>
              <div className="bg-white rounded-xl shadow-sm p-5">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={patronGrowth} margin={{ left: 10, right: 20, top: 4, bottom: 40 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: unknown) => [Number(v).toLocaleString(), 'New Patrons']} />
                    <Bar dataKey="newPatrons" name="New Patrons" fill="#3b82f6" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Object.entries(
                    patronGrowth.reduce((acc, r) => {
                      acc[r.yr] = (acc[r.yr] ?? 0) + r.newPatrons;
                      return acc;
                    }, {} as Record<number, number>)
                  ).map(([yr, total]) => (
                    <div key={yr} className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                      <div className="text-xl font-bold text-blue-700">{Number(total).toLocaleString()}</div>
                      <div className="text-xs text-gray-500">New Patrons {yr}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Patron Retention ── */}
          {retention && (
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-2">
                <span>🔁</span>Patron Retention & New vs. Returning Borrowers ({retention.year})
              </h2>
              <p className="text-xs text-gray-600 mb-4">Retention rate shows what % of last year&apos;s active borrowers borrowed again this year.</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                <div className="bg-white rounded-xl shadow-sm p-5 text-center">
                  <div className="text-3xl font-bold text-blue-700">{retention.activeLastYear.toLocaleString()}</div>
                  <div className="text-sm font-medium text-gray-600">Active {retention.year - 1}</div>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-5 text-center">
                  <div className="text-3xl font-bold text-indigo-700">{retention.retained.toLocaleString()}</div>
                  <div className="text-sm font-medium text-gray-600">Returned This Year</div>
                  <div className="text-xs text-gray-600">Retention Rate</div>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-5 text-center">
                  <div className="text-3xl font-bold text-emerald-600">{retention.newBorrowers.toLocaleString()}</div>
                  <div className="text-sm font-medium text-gray-600">First-Time Borrowers</div>
                  <div className="text-xs text-gray-600">{retention.year}</div>
                </div>
                <div className={`rounded-xl shadow-sm p-5 text-center ${retention.retentionRate >= 60 ? 'bg-emerald-50 border border-emerald-200' : retention.retentionRate >= 40 ? 'bg-amber-50 border border-amber-200' : 'bg-red-50 border border-red-200'}`}>
                  <div className={`text-3xl font-bold ${retention.retentionRate >= 60 ? 'text-emerald-700' : retention.retentionRate >= 40 ? 'text-amber-700' : 'text-red-700'}`}>{retention.retentionRate}%</div>
                  <div className="text-sm font-medium text-gray-600">Retention Rate</div>
                  <div className="text-xs text-gray-600">{retention.retentionRate >= 60 ? '✓ Healthy' : retention.retentionRate >= 40 ? '⚠ Moderate' : '✗ Low — improve outreach'}</div>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4">
                <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
                  <div className="h-4 bg-indigo-500 rounded-l-full transition-all" style={{ width: `${retention.retentionRate}%` }} />
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>0%</span><span className="font-semibold text-indigo-700">{retention.retentionRate}% retained</span><span>100%</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Top 10 Most Active Patrons ── */}
          {activePatrons.length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-2">
                <span>🥇</span>Top {activePatrons.length} Most Active Patrons (All-Time Checkouts)
              </h2>
              <p className="text-xs text-gray-600 mb-4">Patrons with the highest lifetime borrowing. Useful for identifying power users and loyal readers.</p>
              <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-indigo-700 text-white">
                      <th className="text-center p-2 w-8">#</th>
                      <th className="text-left p-2">Barcode</th>
                      <th className="text-left p-2">Name</th>
                      <th className="text-left p-2">Type</th>
                      <th className="text-right p-2">Total Checkouts</th>
                      <th className="text-right p-2">This Year</th>
                      <th className="text-right p-2">Overdue Now</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activePatrons.map((ap, i) => (
                      <tr key={ap.PatronBarcode} className={i % 2 === 0 ? 'bg-white hover:bg-indigo-50' : 'bg-gray-50 hover:bg-indigo-50'}>
                        <td className="p-2 border-b border-gray-100 text-center font-bold text-gray-700">{i + 1}</td>
                        <td className="p-2 border-b border-gray-100 font-mono text-gray-600">{ap.PatronBarcode}</td>
                        <td className="p-2 border-b border-gray-100 font-medium text-gray-900">{ap.LastName}, {ap.FirstName}</td>
                        <td className="p-2 border-b border-gray-100 text-gray-700">{ap.PatronType}</td>
                        <td className="p-2 border-b border-gray-100 text-right font-bold text-indigo-700">{ap.totalCheckouts.toLocaleString()}</td>
                        <td className="p-2 border-b border-gray-100 text-right text-blue-700">{ap.checkoutsThisYear.toLocaleString()}</td>
                        <td className="p-2 border-b border-gray-100 text-right">
                          {ap.overdueCount > 0
                            ? <span className="font-semibold text-red-600">{ap.overdueCount}</span>
                            : <span className="text-gray-500">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Peak Checkout Days ── */}
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-2">
              <span>📅</span>Peak Checkout Days (All-Time)
            </h2>
            <p className="text-xs text-gray-600 mb-4">Which days of the week see the most returns/checkouts — use this for staffing decisions.</p>
            {extra2Loading.peakDays ? (
              <div className="bg-white rounded-xl shadow-sm p-6 text-center text-gray-400 text-sm">Loading…</div>
            ) : extra2Errors.peakDays ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-600">Error: {extra2Errors.peakDays}</div>
            ) : peakDays.length > 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-4">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={peakDays} margin={{ left: 10, right: 20, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={n => n.toLocaleString()} />
                    <Tooltip formatter={(v) => typeof v === "number" ? v.toLocaleString() : String(v)} />
                    <Bar dataKey="checkouts" name="Checkouts" fill="#6366f1" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : extraLoaded2.patrons ? (
              <div className="bg-white rounded-xl shadow-sm p-6 text-center text-gray-400 text-sm">No data available</div>
            ) : null}
          </div>

          {/* ── Average Loan Duration ── */}
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-2">
              <span>⏱</span>Average Loan Duration by Patron Type
            </h2>
            <p className="text-xs text-gray-600 mb-4">How long current checkouts have been out vs. the scheduled loan period — based on items currently checked out.</p>
            {extra2Loading.loanDur ? (
              <div className="bg-white rounded-xl shadow-sm p-6 text-center text-gray-400 text-sm">Loading…</div>
            ) : extra2Errors.loanDur ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-600">Error: {extra2Errors.loanDur}</div>
            ) : loanDur ? (
              <>
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div className="bg-white rounded-xl shadow-sm p-4 text-center">
                    <div className="text-3xl font-bold text-blue-700">{loanDur.overall.avgDaysOut?.toFixed(1) ?? '—'}</div>
                    <div className="text-sm text-gray-500 mt-1">Avg Days Out (current)</div>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm p-4 text-center">
                    <div className="text-3xl font-bold text-indigo-700">{loanDur.overall.avgLoanPeriod != null && loanDur.overall.avgLoanPeriod > 0 ? loanDur.overall.avgLoanPeriod.toFixed(1) : '—'}</div>
                    <div className="text-sm text-gray-500 mt-1">Avg Loan Period (days)</div>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm p-4 text-center">
                    <div className="text-3xl font-bold text-gray-700">{loanDur.overall.currentlyOut?.toLocaleString() ?? '—'}</div>
                    <div className="text-sm text-gray-500 mt-1">Items Currently Out</div>
                  </div>
                  <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-red-600">{loanDur.overall.overdueCount?.toLocaleString() ?? '—'}</div>
                    <div className="text-sm text-red-500 mt-1">Overdue Now</div>
                  </div>
                </div>
                {loanDur.byPatronType.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-blue-700 text-white">
                          <th className="text-left p-2">Patron Type</th>
                          <th className="text-right p-2">Currently Out</th>
                          <th className="text-right p-2">Avg Days Out</th>
                          <th className="text-right p-2">Avg Loan Period</th>
                          <th className="text-right p-2">Overdue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loanDur.byPatronType.map((r, i) => (
                          <tr key={r.patronType} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="p-2 border-b border-gray-100 font-medium">{r.patronType}</td>
                            <td className="p-2 border-b border-gray-100 text-right">{r.currentlyOut?.toLocaleString()}</td>
                            <td className="p-2 border-b border-gray-100 text-right">{r.avgDaysOut?.toFixed(1)}</td>
                            <td className="p-2 border-b border-gray-100 text-right">{r.avgLoanPeriod != null && r.avgLoanPeriod > 0 ? r.avgLoanPeriod.toFixed(1) : '—'}</td>
                            <td className="p-2 border-b border-gray-100 text-right font-semibold text-red-600">{r.overdueCount?.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : extraLoaded2.patrons ? (
              <div className="bg-white rounded-xl shadow-sm p-6 text-center text-gray-400 text-sm">No data available</div>
            ) : null}
          </div>

          {/* ── Lapsed Patrons ── */}
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-2">
              <span>😴</span>Lapsed Patrons
            </h2>
            <p className="text-xs text-gray-600 mb-4">Patrons who borrowed last year but not this year — prime targets for re-engagement outreach.</p>
            {extra2Loading.lapsed ? (
              <div className="bg-white rounded-xl shadow-sm p-6 text-center text-gray-400 text-sm">Loading…</div>
            ) : extra2Errors.lapsed ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-600">Error: {extra2Errors.lapsed}</div>
            ) : lapsedData ? (
              <>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="bg-white rounded-xl shadow-sm p-4 text-center">
                    <div className="text-3xl font-bold text-gray-700">{lapsedData.activeLastYear.toLocaleString()}</div>
                    <div className="text-sm text-gray-500 mt-1">Active {lapsedData.year - 1}</div>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-red-600">{lapsedData.lapsedCount.toLocaleString()}</div>
                    <div className="text-sm text-red-500 mt-1">Lapsed ({lapsedData.lapsedRate}%)</div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-green-700">{lapsedData.activeThisYear.toLocaleString()}</div>
                    <div className="text-sm text-green-600 mt-1">Active {lapsedData.year}</div>
                  </div>
                </div>
                {lapsedData.byType.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead><tr className="bg-red-600 text-white"><th className="text-left p-2">Patron Type</th><th className="text-right p-2">Lapsed</th></tr></thead>
                      <tbody>
                        {lapsedData.byType.map((r, i) => (
                          <tr key={r.patronType} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="p-2 border-b border-gray-100 font-medium">{r.patronType}</td>
                            <td className="p-2 border-b border-gray-100 text-right text-red-600 font-semibold">{r.lapsedCount.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : extraLoaded2.patrons ? (
              <div className="bg-white rounded-xl shadow-sm p-6 text-center text-gray-400 text-sm">No data available</div>
            ) : null}
          </div>

          {/* ── Fines by Patron Type ── */}
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-2">
              <span>💰</span>Fine Revenue by Patron Type (This Year)
            </h2>
            <p className="text-xs text-gray-600 mb-4">Which patron groups generate the most fines — useful for policy review and targeted reminders.</p>
            {extra2Loading.fines ? (
              <div className="bg-white rounded-xl shadow-sm p-6 text-center text-gray-400 text-sm">Loading…</div>
            ) : extra2Errors.fines ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-600">Error: {extra2Errors.fines}</div>
            ) : finesByType.length > 0 ? (
              <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-amber-600 text-white">
                      <th className="text-left p-2">Patron Type</th>
                      <th className="text-right p-2">Patrons w/ Fines</th>
                      <th className="text-right p-2">Fine Count</th>
                      <th className="text-right p-2">Total (₱)</th>
                      <th className="text-right p-2">Avg Fine (₱)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {finesByType.map((r, i) => (
                      <tr key={r.patronType} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="p-2 border-b border-gray-100 font-medium">{r.patronType}</td>
                        <td className="p-2 border-b border-gray-100 text-right">{r.patronsWithFines.toLocaleString()}</td>
                        <td className="p-2 border-b border-gray-100 text-right">{r.fineCount.toLocaleString()}</td>
                        <td className="p-2 border-b border-gray-100 text-right font-semibold text-amber-700">₱{r.totalFines.toFixed(2)}</td>
                        <td className="p-2 border-b border-gray-100 text-right">₱{r.avgFine.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : extraLoaded2.patrons ? (
              <div className="bg-white rounded-xl shadow-sm p-6 text-center text-gray-400 text-sm">No data available</div>
            ) : null}
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
                  <p className="text-xs text-gray-600 mb-3">What the collection contains — Book, Periodical, Thesis, AV, e-Resource, etc.</p>
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
                <p className="text-xs text-gray-600 mb-3">Subject distribution of the collection</p>
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
                <p className="text-xs text-gray-600 mb-3">Physical placement within the library</p>
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
                  <p className="text-xs text-gray-600 mb-3">Loan rules — Reserve Room (short loan), Regular, Non-circulating, etc.</p>
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
                  <p className="text-xs text-gray-600 mb-3">Annual additions to the collection since 2010</p>
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
                  <p className="text-xs text-gray-600 mb-3">Age profile of the collection — shows currency of holdings</p>
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
                  <p className="text-xs text-gray-600 mb-3">Where the collection came from — budget allocation, donations, grants, etc.</p>
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
                  <p className="text-xs text-gray-600 mb-3">Publisher diversity — important for accreditation collection variety requirements</p>
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
              <p className="text-xs text-gray-600 mb-4">What is actually being used — checked-out items as a % of total per category. Higher % = higher demand.</p>
              <div className="grid grid-cols-1 gap-6">

                {/* Utilization rate by Material Type */}
                {(() => {
                  const sorted = [...materialTypeData].filter(r => r.items > 0).sort((a,b) => b.utilRate - a.utilRate);
                  if (sorted.length === 0) return null;
                  return (
                    <div className="bg-white rounded-xl shadow-sm p-5">
                      <p className="text-sm font-semibold text-gray-700 mb-1">Utilization Rate by Material Type</p>
                      <p className="text-xs text-gray-600 mb-3">Which material formats are in highest demand right now</p>
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
                    <p className="text-xs text-gray-600 mb-3">Which library sections have highest demand — guides shelving, staffing, and signage decisions</p>
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
                    <p className="text-xs text-gray-600 mb-3">Which subjects are most in demand — informs targeted acquisition spending</p>
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
                    <p className="text-xs text-gray-600 mb-3">Loan policy types that are most actively borrowed — supports review of loan period rules</p>
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

          {/* ── Items by Call Number / Dewey Range ── */}
          {callNumData.length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-2">
                <span>📂</span>Collection Coverage by Dewey Subject Range
              </h2>
              <p className="text-xs text-gray-600 mb-4">Items and checkout activity grouped by Dewey Decimal class. Identifies under-represented subjects relative to program needs.</p>
              <div className="bg-white rounded-xl shadow-sm p-5">
                <ResponsiveContainer width="100%" height={Math.max(240, callNumData.length * 40)}>
                  <BarChart data={callNumData} layout="vertical" margin={{ left: 280, right: 80, top: 4, bottom: 4 }}>
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="range" tick={{ fontSize: 11 }} width={275} />
                    <Tooltip formatter={(v: unknown) => Number(v).toLocaleString()} />
                    <Legend />
                    <Bar dataKey="items" name="Items" fill="#3b82f6" radius={[0,2,2,0]} />
                    <Bar dataKey="checkouts" name="Checkouts" fill="#10b981" radius={[0,2,2,0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-100 text-gray-700 uppercase tracking-wide">
                        <th className="text-left p-2 border border-gray-200">Dewey Range</th>
                        <th className="text-right p-2 border border-gray-200">Items</th>
                        <th className="text-right p-2 border border-gray-200">Titles</th>
                        <th className="text-right p-2 border border-gray-200">Checkouts</th>
                        <th className="text-right p-2 border border-gray-200">Usage %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {callNumData.map((r, i) => (
                        <tr key={r.firstDigit} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="p-2 border border-gray-200 font-medium text-gray-900">{r.range}</td>
                          <td className="p-2 border border-gray-200 text-right">{r.items.toLocaleString()}</td>
                          <td className="p-2 border border-gray-200 text-right">{r.titles.toLocaleString()}</td>
                          <td className="p-2 border border-gray-200 text-right text-emerald-700">{r.checkouts.toLocaleString()}</td>
                          <td className="p-2 border border-gray-200 text-right font-semibold" style={{ color: r.utilRate > 50 ? '#dc2626' : r.utilRate > 20 ? '#d97706' : '#059669' }}>
                            {r.utilRate}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── Subject Area Gap Analysis ── */}
          {callNumData.length > 0 && (() => {
            const total = callNumData.reduce((s, r) => s + r.items, 0);
            const gaps = callNumData.filter(r => r.items > 0).map(r => ({
              ...r,
              sharePct: total > 0 ? parseFloat((r.items / total * 100).toFixed(1)) : 0,
              isUnderused: r.utilRate < 10 && r.items >= 5,
            })).filter(r => r.isUnderused).sort((a,b) => a.utilRate - b.utilRate).slice(0, 6);
            if (!gaps.length) return null;
            return (
              <div className="mb-8">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-2">
                  <span>🔍</span>Subject Area Gap Analysis — Under-Utilised Sections
                </h2>
                <p className="text-xs text-gray-600 mb-4">Dewey ranges with low checkout rates relative to their size — candidates for targeted promotion or weeding.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {gaps.map(r => (
                    <div key={r.firstDigit} className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-amber-400">
                      <div className="font-semibold text-gray-800 text-sm truncate">{r.range}</div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-500">{r.items.toLocaleString()} items</span>
                        <span className="text-xs font-bold text-amber-700">{r.utilRate}% utilization</span>
                      </div>
                      <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
                        <div className="h-1.5 bg-amber-400 rounded-full" style={{ width: `${Math.min(r.utilRate, 100)}%` }} />
                      </div>
                      <p className="text-xs text-gray-500 mt-1.5">Only {r.checkouts.toLocaleString()} checkouts — consider display promotion or faculty liaison</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ── Longest Overdue Items ── */}
          {longestOverdue.length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-2">
                <span>⏰</span>Top {longestOverdue.length} Longest-Overdue Items
              </h2>
              <p className="text-xs text-gray-600 mb-4">Items overdue the longest. Consider escalating to replacement billing for items beyond 90 days.</p>
              <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-red-700 text-white">
                      <th className="text-left p-2">Item Barcode</th>
                      <th className="text-left p-2">Title</th>
                      <th className="text-left p-2">Author</th>
                      <th className="text-left p-2">Patron</th>
                      <th className="text-left p-2">Type</th>
                      <th className="text-right p-2">Due Date</th>
                      <th className="text-right p-2">Days Overdue</th>
                      <th className="text-right p-2">Replacement ₱</th>
                    </tr>
                  </thead>
                  <tbody>
                    {longestOverdue.map((item, i) => (
                      <tr key={item.CopyBarcode} className={i % 2 === 0 ? 'bg-white hover:bg-red-50' : 'bg-gray-50 hover:bg-red-50'}>
                        <td className="p-2 border-b border-gray-100 font-mono text-gray-600">{item.CopyBarcode}</td>
                        <td className="p-2 border-b border-gray-100 font-medium text-gray-900 max-w-[200px]"><div className="line-clamp-2">{item.Title}</div></td>
                        <td className="p-2 border-b border-gray-100 text-gray-600">{item.Author}</td>
                        <td className="p-2 border-b border-gray-100 font-mono text-gray-600">{item.PatronBarcode}</td>
                        <td className="p-2 border-b border-gray-100 text-gray-700">{item.PatronType}</td>
                        <td className="p-2 border-b border-gray-100 text-right text-gray-700">{item.DateDue}</td>
                        <td className="p-2 border-b border-gray-100 text-right">
                          <span className={`font-bold ${item.DaysOverdue > 90 ? 'text-red-700' : item.DaysOverdue > 30 ? 'text-amber-600' : 'text-yellow-600'}`}>
                            {item.DaysOverdue.toLocaleString()}
                          </span>
                        </td>
                        <td className="p-2 border-b border-gray-100 text-right text-gray-700">
                          {item.ReplacementCost > 0 ? `₱${item.ReplacementCost.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Collection Age Distribution ── */}
          {collAge.length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-2">
                <span>📅</span>Collection Age Distribution
              </h2>
              <p className="text-xs text-gray-600 mb-4">Number of active items and titles acquired each year since 1980. Bars in grey = older; teal = recent 10 years.</p>
              <div className="bg-white rounded-xl shadow-sm p-5">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={collAge.map(r => ({ ...r, name: String(r.acqYear) }))} margin={{ left: 10, right: 20, top: 4, bottom: 4 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={4} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: unknown) => Number(v).toLocaleString()} />
                    <Legend />
                    <Bar dataKey="items" name="Items" fill="#0ea5e9" radius={[2,2,0,0]} />
                    <Bar dataKey="titles" name="Titles" fill="#10b981" radius={[2,2,0,0]} />
                    <Bar dataKey="everBorrowed" name="Ever Borrowed" fill="#f59e0b" radius={[2,2,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-100 text-gray-700 uppercase tracking-wide">
                        <th className="text-left p-2 border border-gray-200">Year</th>
                        <th className="text-right p-2 border border-gray-200">Items</th>
                        <th className="text-right p-2 border border-gray-200">Titles</th>
                        <th className="text-right p-2 border border-gray-200">Ever Borrowed</th>
                        <th className="text-right p-2 border border-gray-200">Usage %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...collAge].reverse().map((r, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="p-2 border border-gray-200 font-semibold text-gray-900">{r.acqYear}</td>
                          <td className="p-2 border border-gray-200 text-right">{r.items.toLocaleString()}</td>
                          <td className="p-2 border border-gray-200 text-right">{r.titles.toLocaleString()}</td>
                          <td className="p-2 border border-gray-200 text-right text-amber-700">{r.everBorrowed.toLocaleString()}</td>
                          <td className="p-2 border border-gray-200 text-right font-semibold text-emerald-700">
                            {r.items > 0 ? (r.everBorrowed / r.items * 100).toFixed(1) + '%' : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── Top 20 Most Borrowed Titles ── */}
          {topTitles.length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-2">
                <span>🏆</span>Top {topTitles.length} Most Borrowed Titles
              </h2>
              <p className="text-xs text-gray-600 mb-4">Titles with the highest total checkout count. Use this to identify high-demand materials that may need additional copies.</p>
              <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-blue-700 text-white">
                      <th className="text-center p-2 w-8">#</th>
                      <th className="text-left p-2">Title</th>
                      <th className="text-left p-2">Author</th>
                      <th className="text-right p-2">Total Checkouts</th>
                      <th className="text-right p-2">Currently Out</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topTitles.map((t, i) => (
                      <tr key={t.BibID} className={i % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-gray-50 hover:bg-blue-50'}>
                        <td className="p-2 border-b border-gray-100 text-center font-bold text-gray-700">{i + 1}</td>
                        <td className="p-2 border-b border-gray-100 font-medium text-gray-900 max-w-xs">
                          <div className="line-clamp-2">{t.Title}</div>
                        </td>
                        <td className="p-2 border-b border-gray-100 text-gray-600">{t.Author}</td>
                        <td className="p-2 border-b border-gray-100 text-right">
                          <span className="font-bold text-blue-700">{t.checkoutCount.toLocaleString()}</span>
                        </td>
                        <td className="p-2 border-b border-gray-100 text-right">
                          {t.currentlyOut > 0
                            ? <span className="font-semibold text-amber-600">{t.currentlyOut}</span>
                            : <span className="text-gray-500">—</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Average Collection Age by Dewey ── */}
          {/* ── Average Collection Age by Dewey ── */}
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-2">
              <span>🕰</span>Average Collection Age by Dewey Range
            </h2>
            <p className="text-xs text-gray-600 mb-4">Which subject areas have the oldest collections — helps prioritize acquisition budgets for outdated sections.</p>
            {extra2Loading.avgColAge ? (
              <div className="bg-white rounded-xl shadow-sm p-6 text-center text-gray-400 text-sm">Loading…</div>
            ) : extra2Errors.avgColAge ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-600">Error: {extra2Errors.avgColAge}</div>
            ) : avgColAge.length > 0 ? (
              <>
                <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
                  <ResponsiveContainer width="100%" height={Math.max(220, avgColAge.length * 36)}>
                    <BarChart data={avgColAge} layout="vertical" margin={{ left: 200, right: 80, top: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={n => `${n}y`} />
                      <YAxis type="category" dataKey="range" tick={{ fontSize: 11 }} width={195} />
                      <Tooltip formatter={(v) => typeof v === "number" ? `${v} years` : String(v)} />
                      <Bar dataKey="avgAgeYears" name="Avg Age (years)" fill="#f59e0b" radius={[0,4,4,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-amber-600 text-white">
                        <th className="text-left p-2">Dewey Range</th>
                        <th className="text-right p-2">Avg Age (yrs)</th>
                        <th className="text-right p-2">Items</th>
                        <th className="text-right p-2">Oldest Year</th>
                        <th className="text-right p-2">Newest Year</th>
                      </tr>
                    </thead>
                    <tbody>
                      {avgColAge.map((r, i) => (
                        <tr key={r.firstDigit} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="p-2 border-b border-gray-100 font-medium">{r.range}</td>
                          <td className={`p-2 border-b border-gray-100 text-right font-bold ${r.avgAgeYears >= 15 ? 'text-red-600' : r.avgAgeYears >= 10 ? 'text-amber-600' : 'text-green-600'}`}>{r.avgAgeYears}</td>
                          <td className="p-2 border-b border-gray-100 text-right">{r.itemCount.toLocaleString()}</td>
                          <td className="p-2 border-b border-gray-100 text-right text-gray-600">{r.oldestYear}</td>
                          <td className="p-2 border-b border-gray-100 text-right">{r.newestYear}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : extraLoaded2.collection ? (
              <div className="bg-white rounded-xl shadow-sm p-6 text-center text-gray-400 text-sm">No data available (items may lack acquisition dates)</div>
            ) : null}
          </div>

          {/* ── Never-Borrowed Items ── */}
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-2">
              <span>📦</span>Items Never Borrowed
            </h2>
            <p className="text-xs text-gray-600 mb-4">Titles/items acquired but never checked out — signals poor acquisitions or poor discoverability.</p>
            {extra2Loading.neverBorrowed ? (
              <div className="bg-white rounded-xl shadow-sm p-6 text-center text-gray-400 text-sm">Loading…</div>
            ) : extra2Errors.neverBorrowed ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-600">Error: {extra2Errors.neverBorrowed}</div>
            ) : neverBorrowed ? (
              <>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-red-600">{neverBorrowed.totals.neverBorrowedItems.toLocaleString()}</div>
                    <div className="text-sm text-red-500 mt-1">Items Never Borrowed</div>
                    <div className="text-xs text-gray-600">{pct(neverBorrowed.totals.neverBorrowedItems, neverBorrowed.totals.totalItems)} of collection</div>
                  </div>
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-orange-600">{neverBorrowed.totals.neverBorrowedTitles.toLocaleString()}</div>
                    <div className="text-sm text-orange-500 mt-1">Titles Never Borrowed</div>
                    <div className="text-xs text-gray-600">{pct(neverBorrowed.totals.neverBorrowedTitles, neverBorrowed.totals.totalTitles)} of titles</div>
                  </div>
                </div>
                {neverBorrowed.byDewey.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead><tr className="bg-orange-600 text-white"><th className="text-left p-2">Dewey</th><th className="text-right p-2">Titles</th><th className="text-right p-2">Items</th></tr></thead>
                      <tbody>
                        {neverBorrowed.byDewey.map((r, i) => (
                          <tr key={r.firstDigit} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="p-2 border-b border-gray-100 font-medium">{r.firstDigit}00s</td>
                            <td className="p-2 border-b border-gray-100 text-right">{r.neverBorrowedTitles.toLocaleString()}</td>
                            <td className="p-2 border-b border-gray-100 text-right font-semibold text-orange-700">{r.neverBorrowedItems.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : extraLoaded2.collection ? (
              <div className="bg-white rounded-xl shadow-sm p-6 text-center text-gray-400 text-sm">No data available</div>
            ) : null}
          </div>

          {/* ── Weeding Candidates ── */}
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-2">
              <span>🌿</span>Weeding Candidates (Not Borrowed in 3+ Years)
            </h2>
            <p className="text-xs text-gray-600 mb-4">Items inactive for 3+ years — candidates for withdrawal to free shelf space.</p>
            {extra2Loading.weed ? (
              <div className="bg-white rounded-xl shadow-sm p-6 text-center text-gray-400 text-sm">Loading…</div>
            ) : extra2Errors.weed ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-600">Error: {extra2Errors.weed}</div>
            ) : weedData ? (
              <>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-yellow-700">{weedData.summary.candidateCount.toLocaleString()}</div>
                    <div className="text-sm text-yellow-600 mt-1">Total Weeding Candidates</div>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm p-4 text-center">
                    <div className="text-3xl font-bold text-gray-700">₱{weedData.summary.totalValue?.toFixed(2)}</div>
                    <div className="text-sm text-gray-500 mt-1">Estimated Value on Shelf</div>
                  </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-yellow-600 text-white">
                        <th className="text-left p-2">Title</th>
                        <th className="text-left p-2">Author</th>
                        <th className="text-left p-2">Call #</th>
                        <th className="text-right p-2">Acquired</th>
                        <th className="text-right p-2">Last Borrowed</th>
                        <th className="text-right p-2">Days Idle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weedData.items.map((w, i) => (
                        <tr key={w.CopyBarcode} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="p-2 border-b border-gray-100 font-medium max-w-xs truncate">{w.Title}</td>
                          <td className="p-2 border-b border-gray-100 text-gray-700">{w.Author}</td>
                          <td className="p-2 border-b border-gray-100 font-mono text-xs text-gray-700">{w.CallNumber}</td>
                          <td className="p-2 border-b border-gray-100 text-right text-gray-600">{w.Acquired}</td>
                          <td className="p-2 border-b border-gray-100 text-right text-gray-600">{w.LastBorrowed ?? '—'}</td>
                          <td className="p-2 border-b border-gray-100 text-right font-semibold text-yellow-700">{w.daysSinceActivity.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : extraLoaded2.collection ? (
              <div className="bg-white rounded-xl shadow-sm p-6 text-center text-gray-400 text-sm">No data available</div>
            ) : null}
          </div>

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

          {/* ── ISO 11620 Per-Capita Benchmarks (derived from ILS data) ── */}
          {s && (
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-2">
                <span>📏</span>ISO 11620 Key Performance Indicators — Detail View
              </h2>
              <p className="text-xs text-gray-600 mb-4">
                ISO 11620:2014 performance indicators computed from live ILS data. Enter enrolled student count in <strong>💡 Insights</strong> to unlock true per-capita metrics based on actual service population.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl shadow-sm p-4">
                  <div className="text-3xl font-bold text-purple-700">{s.totalPatrons ? (s.checkoutsThisYear / s.totalPatrons).toFixed(2) : '—'}</div>
                  <div className="text-sm font-medium text-gray-600">Loans per Registered User</div>
                  <div className="text-xs text-gray-500 mt-0.5">ISO 11620 B.2.1.1 · {periodLabel}</div>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4">
                  <div className="text-3xl font-bold text-teal-700">{s.totalItems ? (s.checkoutsThisYear / s.totalItems).toFixed(3) : '—'}</div>
                  <div className="text-sm font-medium text-gray-600">Collection Turnover Rate</div>
                  <div className="text-xs text-gray-500 mt-0.5">ISO 11620 B.2.1 · loans ÷ total items</div>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4">
                  <div className="text-3xl font-bold text-amber-700">{s.totalItems ? pct(s.neverCheckedOut, s.totalItems) : '—'}</div>
                  <div className="text-sm font-medium text-gray-600">% Stock Not Used</div>
                  <div className="text-xs text-gray-500 mt-0.5">ISO 11620 B.2.1.3 · never borrowed ÷ total (lower = better)</div>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4">
                  <div className="text-3xl font-bold text-indigo-700">{pct(s.activePatronsThisYear, s.totalPatrons)}</div>
                  <div className="text-sm font-medium text-gray-600">% Target Population Reached</div>
                  <div className="text-xs text-gray-500 mt-0.5">ISO 11620 B.2.4.1 · active borrowers ÷ registered users</div>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4">
                  <div className="text-3xl font-bold text-blue-700">{s.totalPatrons ? (s.totalItems / s.totalPatrons).toFixed(2) : '—'}</div>
                  <div className="text-sm font-medium text-gray-600">Collection Items per User</div>
                  <div className="text-xs text-gray-500 mt-0.5">ISO 11620 B.3.2.1 · target ≥ 3 for academic libraries</div>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4">
                  <div className="text-3xl font-bold text-green-700">{s.checkoutsThisYear ? pct(s.holdsPlacedThisYear, s.checkoutsThisYear) : '—'}</div>
                  <div className="text-sm font-medium text-gray-600">Hold Request Rate</div>
                  <div className="text-xs text-gray-500 mt-0.5">ISO 11620 B.1.1 · holds placed ÷ loans (demand signal)</div>
                </div>
              </div>
              <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
                💡 ISO 11620 also defines <strong>Visits per Capita</strong> and <strong>Staff per 1,000 Population</strong>. Go to <strong>💡 Insights → Strategic Planning KPIs</strong> and enter enrolled students, then use CHED CMO 22 tab to record staff headcount for full benchmark coverage.
              </div>
            </div>
          )}

          {/* ── ALA / ACRL Holdings (ILS auto-computable) ── */}
          {s && (
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span>🏛️</span>ALA / ACRL — Holdings &amp; Inventory (Auto from ILS)
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                <Card label="Physical Volumes Held" value={fmt(s.totalItems)} sub="ALA/ACRL — gross cataloged print items in active inventory" color="text-blue-700" />
                <Card label="Unique Titles" value={fmt(s.uniqueTitles)} sub="ALA/ACRL — unique bibliographic titles" color="text-blue-700" />
                <Card label="Items Withdrawn (All-Time)" value={fmt(s.withdrawnItems)} sub="ALA/ACRL — deselected / weeded items on record" color="text-gray-600" />
                <Card label="Items Never Borrowed" value={fmt(s.neverCheckedOut)} sub="ALA/ACRL — physical items with zero loan history" color="text-amber-700" />
                <Card label="New Items This Year" value={fmt(s.newItemsThisYear)} sub={`ALA/ACRL — acquisitions added in ${s.year}`} color="text-green-700" />
                <Card label="New Items This Month" value={fmt(s.newItemsThisMonth)} sub="ALA/ACRL — acquisitions added this calendar month" color="text-green-600" />
                <Card label="Total Checkouts This Period" value={fmt(s.checkoutsThisYear)} sub={`ALA/ACRL — total loans in ${periodLabel}`} color="text-indigo-700" />
                <Card label="Registered Users" value={fmt(s.totalPatrons)} sub="ALA/ACRL — total enrolled patron accounts" color="text-indigo-700" />
              </div>
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                ALA/ACRL also tracks <strong>Licensed Digital Databases</strong>, <strong>E-Books &amp; E-Serials</strong>, and <strong>Institutional Repository Holdings</strong> — enter these in the <strong>CHED CMO 22</strong> tab (§4.b / §7) and <strong>AACCUP Area VII</strong> tab (D.5.2.8) since they are not stored in Destiny.
              </div>
            </div>
          )}

          {/* ── IFLA Financial & Management — Reference Table ── */}
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-2">
              <span>💸</span>IFLA / ISO 11620 — Financial &amp; Management Metrics
            </h2>
            <p className="text-xs text-gray-600 mb-3">These require financial ledger data not stored in Destiny. Use the formulas below with your institutional budget records.</p>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-700 text-white uppercase tracking-wide">
                    <th className="text-left p-3">Metric</th>
                    <th className="text-left p-3 hidden sm:table-cell">Formula</th>
                    <th className="text-left p-3 hidden md:table-cell">Stakeholder</th>
                    {s && <th className="text-left p-3">ILS Input Available</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[
                    { name: 'Cost per User', formula: 'Total operating expenditure ÷ Active registered users', stake: 'Funding Bodies', ilsVal: s ? `÷ ${fmt(s.activePatronsThisYear)} active users` : null },
                    { name: 'Cost per Visit', formula: 'Total expenditure ÷ (Gate count + Website visits)', stake: 'Library Board', ilsVal: null },
                    { name: 'Cost per Resource Download', formula: 'Subscription cost ÷ Full-text downloads', stake: 'Collection Librarians', ilsVal: null },
                    { name: 'Library Expenditures as % of Institutional Budget', formula: '(Library budget ÷ Total institution budget) × 100', stake: 'Provost / Board', ilsVal: null },
                    { name: 'Staff Costs as % of Operating Expenditures', formula: '(Staff compensation ÷ Total annual budget) × 100', stake: 'Library Director', ilsVal: null },
                    { name: 'Total Library Expenditures per Capita', formula: 'Annual budget ÷ Total target census population', stake: 'Government / Taxpayers', ilsVal: null },
                  ].map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="p-3 font-semibold text-gray-800">{r.name}</td>
                      <td className="p-3 text-gray-600 hidden sm:table-cell font-mono">{r.formula}</td>
                      <td className="p-3 text-gray-500 hidden md:table-cell">{r.stake}</td>
                      {s && <td className="p-3">{r.ilsVal ? <span className="text-green-700 font-medium">{r.ilsVal}</span> : <span className="text-gray-400">Enter budget in Insights tab</span>}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── IFLA User Perspective (additional non-duplicate) ── */}
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-2">
              <span>👤</span>IFLA / ISO 11620 — User Perspective Metrics
            </h2>
            <p className="text-xs text-gray-600 mb-3">ILS-computable metrics are shown as cards. Survey-based metrics require separate data collection.</p>
            {s && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-4">
                <Card label="Circulation per Capita (Registered)" value={(s.totalPatrons ? s.checkoutsThisYear / s.totalPatrons : 0).toFixed(2)} sub={`ISO 11620 — loans ÷ registered users · ${periodLabel}`} color="text-indigo-700" />
                <Card label="Turnover Rate" value={s.totalItems ? (s.checkoutsThisYear / s.totalItems).toFixed(3) + 'x' : '—'} sub="ISO 11620 — loans ÷ total physical items" color="text-teal-700" />
                <Card label="% Target Population Reached" value={pct(s.activePatronsThisYear, s.totalPatrons)} sub="ISO 11620 B.2.4.1 — active borrowers ÷ registered users" color="text-blue-700" />
                <Card label="% Stock Not Used" value={pct(s.neverCheckedOut, s.totalItems)} sub="ISO 11620 B.2.1.3 — never-borrowed items ÷ total (lower = better)" color="text-amber-700" />
              </div>
            )}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-gray-700 uppercase tracking-wide">
                    <th className="text-left p-3">Metric</th>
                    <th className="text-left p-3 hidden sm:table-cell">Formula</th>
                    <th className="text-left p-3">Data Source Needed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[
                    { name: 'User Satisfaction Index', formula: 'Avg Likert score from LibQUAL+ / survey', source: 'Annual user satisfaction survey' },
                    { name: 'Title / Subject Availability Rate', formula: '(Titles found ÷ Titles sought) × 100', source: 'User sampling / shelf-availability study' },
                    { name: 'Facilities Satisfaction Rate', formula: '% users rating spaces as satisfactory', source: 'Facility satisfaction survey' },
                    { name: 'Public Workstation / Wi-Fi Downtime Rate', formula: '(Downtime hours ÷ Total open hours) × 100', source: 'IT syslog / ticket management' },
                    { name: 'Speed of ILL / Document Delivery', formula: 'Median days from ILL request to user notification', source: 'ILL management software log' },
                    { name: 'Correct Answer Rate (Reference)', formula: '(Accurately answered queries ÷ Sampled queries) × 100', source: 'Reference audit / mystery shopping' },
                    { name: 'Library Visits per Capita', formula: 'Annual gate count ÷ Target population', source: 'Physical gate counter + census data' },
                  ].map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="p-3 font-semibold text-gray-800">{r.name}</td>
                      <td className="p-3 font-mono text-gray-600 hidden sm:table-cell">{r.formula}</td>
                      <td className="p-3 text-amber-700">{r.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── IFLA Internal Processes & Learning/Growth — Reference ── */}
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-2">
              <span>⚙️</span>IFLA / ISO 11620 — Internal Processes &amp; Learning/Growth
            </h2>
            <p className="text-xs text-gray-600 mb-3">Operational efficiency and staff development metrics — require internal logs and HR records.</p>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-gray-700 uppercase tracking-wide">
                    <th className="text-left p-3">Metric</th>
                    <th className="text-left p-3 hidden sm:table-cell">Formula</th>
                    <th className="text-left p-3">Data Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[
                    { name: 'Median Processing Time for New Acquisitions', formula: 'Median days: receipt → live catalog entry', source: 'Acquisitions & cataloging logs' },
                    { name: 'Cataloging Accuracy Rate', formula: '(Correct MARC/RDA records ÷ Records audited) × 100', source: 'Peer cataloging audit' },
                    { name: 'Time to Resolve System Failures', formula: 'Mean time to repair (MTTR) critical systems', source: 'IT service desk platform' },
                    { name: 'Conservation Stabilization Rate', formula: '(Items stabilized or digitized ÷ Items flagged) × 100', source: 'Conservation database' },
                    { name: 'Cost per Cataloged Item', formula: 'Total technical services staff cost ÷ Titles processed', source: 'HR records + cataloging reports' },
                    { name: 'Staff Training Hours per FTE', formula: 'Total professional development hours ÷ FTE staff', source: 'HR / training records' },
                    { name: '% Electronic Library Expenditures', formula: '(Digital content budget ÷ Total collection budget) × 100', source: 'Financial ledger + ERM system' },
                    { name: '% Staff with Specialized IT / Data Certifications', formula: '(Staff with IT certs ÷ Total FTE) × 100', source: 'HR credentials database' },
                  ].map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="p-3 font-semibold text-gray-800">{r.name}</td>
                      <td className="p-3 font-mono text-gray-600 hidden sm:table-cell">{r.formula}</td>
                      <td className="p-3 text-amber-700">{r.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── ALA Project Outcome ── */}
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-2">
              <span>🎯</span>ALA / PLA — Project Outcome (Impact) Metrics
            </h2>
            <p className="text-xs text-gray-600 mb-3">Survey-based outcome metrics from ALA Project Outcome standard. Require post-program participant surveys.</p>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-gray-700 uppercase tracking-wide">
                    <th className="text-left p-3">Outcome Metric</th>
                    <th className="text-left p-3 hidden sm:table-cell">Formula</th>
                    <th className="text-left p-3">Target Stakeholder</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[
                    { name: 'Knowledge Acquisition Rate', formula: '(Attendees who learned something new ÷ Survey respondents) × 100', stake: 'Grant agencies / Donors' },
                    { name: 'Confidence Building Rate', formula: '(Attendees reporting increased confidence ÷ Respondents) × 100', stake: 'Educational boards' },
                    { name: 'Behavioral Change Intention Rate', formula: '(Attendees who plan behavior change ÷ Respondents) × 100', stake: 'City councils' },
                    { name: 'Resource Awareness Rate', formula: '(Attendees with expanded library resource awareness ÷ Respondents) × 100', stake: 'Marketing & PR' },
                  ].map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="p-3 font-semibold text-gray-800">{r.name}</td>
                      <td className="p-3 font-mono text-gray-600 hidden sm:table-cell">{r.formula}</td>
                      <td className="p-3 text-gray-500">{r.stake}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-4 py-3 bg-blue-50 text-xs text-blue-700 border-t border-blue-100">
                Use <a href="https://www.ala.org/pla/initiatives/performancemeasurement" target="_blank" rel="noopener noreferrer" className="underline">ALA Project Outcome</a> standard survey forms to collect these after each library program or instruction session. Results can be recorded in the CHED CMO 22 tab (§5 — Instruction Sessions).
              </div>
            </div>
          </div>

          {/* ── Manual entry for all non-ILS metrics ── */}
          <div className="mt-4 mb-3 bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-xs text-indigo-800">
            <strong>📝 Enter Actual Values Below</strong> — The reference tables above show formulas and data sources. Use the fields below to record your collected figures so the dashboard can display a summary.
            {!insightsUnlocked && (
              <span className="ml-2 text-indigo-500">Unlock editing in the <strong>CHED CMO 22</strong> tab.</span>
            )}
          </div>
          <IsoManualSection unlocked={insightsUnlocked} />
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
              {/* ── Compliance Summary at a Glance ── */}
              <ChedComplianceSummary chedStats={chedStats} />

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

              {/* Manual documentation sections */}
              <div className="mb-6 flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl print:hidden">
                {insightsUnlocked ? (
                  <>
                    <span className="text-emerald-600 text-sm font-semibold">🔓 Edit mode active</span>
                    <button onClick={() => { setInsightsUnlocked(false); setPwDraft(''); setPwError(false); }} className="text-xs text-gray-500 hover:text-red-500 border border-gray-200 px-3 py-1 rounded-lg transition-colors">Lock</button>
                  </>
                ) : (
                  <>
                    <span className="text-sm text-gray-600 font-medium">🔒 Enter editor password to update manual metrics</span>
                    <form onSubmit={e => { e.preventDefault(); if (pwDraft === 'palstateu') { setInsightsUnlocked(true); setPwError(false); setPwDraft(''); } else { setPwError(true); } }} className="flex items-center gap-2 ml-auto">
                      <input type="password" value={pwDraft} onChange={e => { setPwDraft(e.target.value); setPwError(false); }} placeholder="Password" className={`border rounded-lg px-3 py-1.5 text-sm w-36 focus:outline-none focus:ring-2 ${pwError ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-blue-400'}`} />
                      <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">Unlock</button>
                      {pwError && <span className="text-xs text-red-500">Incorrect</span>}
                    </form>
                  </>
                )}
              </div>
              <ChedManualSection unlocked={insightsUnlocked} />
            </>
          )}
        </div>

        {/* Tab: AACCUP Area VII */}
        <div className={activeTab === 'aaccup' ? 'block' : 'hidden print:block'}>
          <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4 text-green-900 text-sm">
            <strong>AACCUP Area VII — Library Self-Survey Instrument</strong>
            <p className="mt-1 text-xs text-green-800">
              Covers sections A (Administration) through G (Linkages). Enter values for each indicator using the fields below. Items marked <strong>✓ Compliant / ✗ Non-compliant</strong> have defined thresholds per the AACCUP instrument. Unlock editing with the dashboard password.
            </p>
          </div>

          {/* Password gate — reuses same insightsUnlocked state */}
          {!insightsUnlocked && (
            <div className="mb-6 bg-white rounded-xl shadow-sm p-5">
              <p className="text-sm text-gray-600 mb-3">Enter the dashboard password to record or edit AACCUP metrics.</p>
              <form onSubmit={(e) => { e.target; }} className="flex gap-2 items-center">
                <input
                  type="password"
                  placeholder="Password"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const v = (e.target as HTMLInputElement).value;
                      if (v === 'palstateu') setInsightsUnlocked(true);
                    }
                  }}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-green-400"
                />
                <span className="text-xs text-gray-400">Press Enter to unlock</span>
              </form>
            </div>
          )}

          <AaccupAutoVerified chedStats={chedStats} />
          <AaccupManualSection unlocked={insightsUnlocked} />
        </div>

        {/* Tab: Insights */}
        <div className={activeTab === 'insights' ? 'block' : 'hidden print:block'}>

          {/* ── Cross-Activity Analysis ── */}
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-2">
              <span>📊</span>Who Uses the Library Most?
            </h2>
            <p className="text-xs text-gray-600 mb-4">
              Cross-tabulation of patron demographics vs. actual borrowing activity — not filtered by the selections above, shows the full population comparison.
            </p>

            {genderActivity.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
                <p className="text-sm font-semibold text-gray-700 mb-1">Activity by Gender</p>
                <p className="text-xs text-gray-600 mb-4">Compares registration count, active borrowers, total checkouts, and overdue items per gender group</p>
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
                <p className="text-xs text-gray-600 mb-4">Which patron groups borrow the most — useful for collection development and service prioritization</p>
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

          {/* ── Metric Spotlights ── */}
          <div className="mb-8 grid grid-cols-1 gap-6">

            {/* Peak Checkout Days */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-2">
                <span>📅</span>Peak Checkout Days
              </h2>
              <p className="text-xs text-gray-600 mb-3">All-time checkout volume by weekday — use to guide staffing and program scheduling.</p>
              {extra2Loading.peakDays ? (
                <div className="text-xs text-gray-500 py-4 text-center">Loading…</div>
              ) : extra2Errors.peakDays ? (
                <div className="text-xs text-red-600 bg-red-50 rounded-lg p-3">Error: {extra2Errors.peakDays}</div>
              ) : peakDays.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={peakDays} margin={{left:10,right:10,top:4,bottom:4}}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" tick={{fontSize:11}} />
                      <YAxis tick={{fontSize:11}} />
                      <Tooltip formatter={(v:unknown) => [Number(v).toLocaleString(), 'Checkouts']} />
                      <Bar dataKey="checkouts" fill="#3b82f6" radius={[3,3,0,0]}>
                        {peakDays.map((_,i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  {(() => {
                    const peak = peakDays.reduce((a,b) => b.checkouts > a.checkouts ? b : a, peakDays[0]);
                    const quiet = peakDays.reduce((a,b) => b.checkouts < a.checkouts ? b : a, peakDays[0]);
                    return (
                      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                        <div className="bg-blue-50 rounded-lg p-3"><span className="text-gray-600">Busiest day:</span> <strong className="text-blue-700">{peak.day}</strong> <span className="text-gray-600">({peak.checkouts.toLocaleString()} checkouts)</span></div>
                        <div className="bg-gray-50 rounded-lg p-3"><span className="text-gray-600">Quietest day:</span> <strong className="text-gray-700">{quiet.day}</strong> <span className="text-gray-600">({quiet.checkouts.toLocaleString()} checkouts)</span></div>
                      </div>
                    );
                  })()}
                </>
              ) : <div className="text-xs text-gray-500 py-4 text-center">No data available</div>}
            </div>

            {/* Loan Duration */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-2">
                <span>⏱</span>Current Loan Duration by Patron Type
              </h2>
              <p className="text-xs text-gray-600 mb-3">Based on currently checked-out items. Shows how long patrons actually keep materials vs. the loan period allowed.</p>
              {extra2Loading.loanDur ? (
                <div className="text-xs text-gray-500 py-4 text-center">Loading…</div>
              ) : extra2Errors.loanDur ? (
                <div className="text-xs text-red-600 bg-red-50 rounded-lg p-3">Error: {extra2Errors.loanDur}</div>
              ) : loanDur ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    <div className="bg-indigo-50 rounded-lg p-3 text-center">
                      <div className="text-xl font-bold text-indigo-700">{loanDur.overall.currentlyOut.toLocaleString()}</div>
                      <div className="text-xs text-gray-600">Currently Out</div>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-3 text-center">
                      <div className="text-xl font-bold text-amber-700">{loanDur.overall.avgDaysOut?.toFixed(1) ?? '—'}</div>
                      <div className="text-xs text-gray-600">Avg Days Kept</div>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3 text-center">
                      <div className="text-xl font-bold text-blue-700">{loanDur.overall.avgLoanPeriod != null && loanDur.overall.avgLoanPeriod > 0 ? loanDur.overall.avgLoanPeriod.toFixed(1) : '—'}</div>
                      <div className="text-xs text-gray-600">Avg Loan Period</div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-3 text-center">
                      <div className="text-xl font-bold text-red-700">{loanDur.overall.overdueCount?.toLocaleString()}</div>
                      <div className="text-xs text-gray-600">Overdue Now</div>
                    </div>
                  </div>
                  {loanDur.byPatronType.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-gray-100 text-gray-700 uppercase tracking-wide">
                            <th className="text-left p-2 border border-gray-200">Patron Type</th>
                            <th className="text-right p-2 border border-gray-200">Out Now</th>
                            <th className="text-right p-2 border border-gray-200">Avg Days Kept</th>
                            <th className="text-right p-2 border border-gray-200">Avg Loan Period</th>
                            <th className="text-right p-2 border border-gray-200">Overdue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loanDur.byPatronType.map((r,i) => (
                            <tr key={i} className={i%2===0?'bg-white':'bg-gray-50'}>
                              <td className="p-2 border border-gray-200 font-semibold text-gray-900">{r.patronType}</td>
                              <td className="p-2 border border-gray-200 text-right text-gray-800">{r.currentlyOut.toLocaleString()}</td>
                              <td className="p-2 border border-gray-200 text-right text-amber-700 font-semibold">{r.avgDaysOut?.toFixed(1) ?? '—'}</td>
                              <td className="p-2 border border-gray-200 text-right text-blue-700">{r.avgLoanPeriod?.toFixed(1) ?? '—'}</td>
                              <td className="p-2 border border-gray-200 text-right text-red-600">{r.overdueCount?.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : <div className="text-xs text-gray-500 py-4 text-center">No data available</div>}
            </div>

            {/* Collection Health Summary */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-2">
                <span>📦</span>Collection Health at a Glance
              </h2>
              <p className="text-xs text-gray-600 mb-3">Items that have never circulated and long-idle items are weeding candidates that free shelf space and improve accreditation scores.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Never Borrowed */}
                {extra2Loading.neverBorrowed ? (
                  <div className="bg-orange-50 rounded-lg p-4 text-xs text-gray-500 text-center">Loading never-borrowed data…</div>
                ) : extra2Errors.neverBorrowed ? (
                  <div className="bg-red-50 rounded-lg p-4 text-xs text-red-600">Never-borrowed error: {extra2Errors.neverBorrowed}</div>
                ) : neverBorrowed ? (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <div className="text-xs font-semibold text-orange-800 uppercase tracking-wide mb-2">Items Never Borrowed</div>
                    <div className="text-3xl font-bold text-orange-700 mb-1">{neverBorrowed.totals.neverBorrowedItems.toLocaleString()}</div>
                    <div className="text-xs text-gray-700">of {neverBorrowed.totals.totalItems.toLocaleString()} total items ({neverBorrowed.totals.totalItems ? ((neverBorrowed.totals.neverBorrowedItems/neverBorrowed.totals.totalItems)*100).toFixed(1) : '—'}%)</div>
                    <div className="text-xs text-gray-700 mt-1">{neverBorrowed.totals.neverBorrowedTitles.toLocaleString()} unique titles never borrowed</div>
                  </div>
                ) : null}
                {/* Weeding Candidates */}
                {extra2Loading.weed ? (
                  <div className="bg-yellow-50 rounded-lg p-4 text-xs text-gray-500 text-center">Loading weeding data…</div>
                ) : extra2Errors.weed ? (
                  <div className="bg-red-50 rounded-lg p-4 text-xs text-red-600">Weeding error: {extra2Errors.weed}</div>
                ) : weedData ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="text-xs font-semibold text-yellow-800 uppercase tracking-wide mb-2">Weeding Candidates (3+ Yrs Idle)</div>
                    <div className="text-3xl font-bold text-yellow-700 mb-1">{weedData.summary.candidateCount.toLocaleString()}</div>
                    <div className="text-xs text-gray-700">items not borrowed in 3+ years</div>
                    <div className="text-xs text-gray-700 mt-1">Estimated replacement value: <span className="font-semibold">₱{weedData.summary.totalValue?.toLocaleString('en-PH',{minimumFractionDigits:2})}</span></div>
                  </div>
                ) : null}
              </div>
              {/* Avg Collection Age */}
              {avgColAge.length > 0 && (
                <div className="mt-4 overflow-x-auto">
                  <div className="text-xs font-medium text-gray-700 mb-2">Average Collection Age by Dewey Range</div>
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-100 text-gray-700 uppercase tracking-wide">
                        <th className="text-left p-2 border border-gray-200">Range</th>
                        <th className="text-right p-2 border border-gray-200">Avg Age (yrs)</th>
                        <th className="text-right p-2 border border-gray-200">Items</th>
                        <th className="text-right p-2 border border-gray-200">Oldest</th>
                        <th className="text-right p-2 border border-gray-200">Newest</th>
                      </tr>
                    </thead>
                    <tbody>
                      {avgColAge.map((r,i) => (
                        <tr key={i} className={i%2===0?'bg-white':'bg-gray-50'}>
                          <td className="p-2 border border-gray-200 font-semibold text-gray-900">{r.range}</td>
                          <td className={`p-2 border border-gray-200 text-right font-semibold ${r.avgAgeYears > 15 ? 'text-red-600' : r.avgAgeYears > 10 ? 'text-amber-600' : 'text-green-700'}`}>{r.avgAgeYears?.toFixed(1)}</td>
                          <td className="p-2 border border-gray-200 text-right text-gray-800">{r.itemCount?.toLocaleString()}</td>
                          <td className="p-2 border border-gray-200 text-right text-gray-700">{r.oldestYear}</td>
                          <td className="p-2 border border-gray-200 text-right text-gray-700">{r.newestYear}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Patron Engagement Deep Dive */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-2">
                <span>👋</span>Patron Engagement Deep Dive
              </h2>
              <p className="text-xs text-gray-600 mb-3">Lapsed patrons and fine distribution by patron type — key for outreach targeting and fine policy review.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Lapsed Patrons */}
                {extra2Loading.lapsed ? (
                  <div className="bg-purple-50 rounded-lg p-4 text-xs text-gray-500 text-center">Loading lapsed patron data…</div>
                ) : extra2Errors.lapsed ? (
                  <div className="bg-red-50 rounded-lg p-4 text-xs text-red-600">Lapsed error: {extra2Errors.lapsed}</div>
                ) : lapsedData ? (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <div className="text-xs font-semibold text-purple-800 uppercase tracking-wide mb-2">Lapsed Patrons ({lapsedData.year})</div>
                    <div className="text-3xl font-bold text-purple-700 mb-1">{lapsedData.lapsedCount.toLocaleString()}</div>
                    <div className="text-xs text-gray-700">borrowed last year but not this year ({lapsedData.lapsedRate?.toFixed(1)}% of last year&apos;s borrowers)</div>
                    {lapsedData.byType.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {lapsedData.byType.slice(0,4).map((r,i) => (
                          <div key={i} className="flex justify-between text-xs text-gray-700">
                            <span>{r.patronType}</span><span className="font-semibold">{r.lapsedCount.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
                {/* Fines by Patron Type */}
                {extra2Loading.fines ? (
                  <div className="bg-red-50 rounded-lg p-4 text-xs text-gray-500 text-center">Loading fines data…</div>
                ) : extra2Errors.fines ? (
                  <div className="bg-red-50 rounded-lg p-4 text-xs text-red-600">Fines error: {extra2Errors.fines}</div>
                ) : finesByType.length > 0 ? (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="text-xs font-semibold text-red-800 uppercase tracking-wide mb-2">Active Fines by Patron Type</div>
                    <div className="space-y-1.5">
                      {finesByType.slice(0,5).map((r,i) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span className="text-gray-800 font-medium">{r.patronType}</span>
                          <span className="text-red-700 font-semibold">₱{r.totalFines?.toLocaleString('en-PH',{minimumFractionDigits:2})}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 pt-2 border-t border-red-200 text-xs text-gray-700">
                      Total: <span className="font-bold text-red-700">₱{finesByType.reduce((a,r)=>a+(r.totalFines??0),0).toLocaleString('en-PH',{minimumFractionDigits:2})}</span>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* ── Editor unlock widget ── */}
          <div className="mb-6 flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl print:hidden">
            {insightsUnlocked ? (
              <>
                <span className="text-emerald-600 text-sm font-semibold">🔓 Edit mode active</span>
                <button
                  onClick={() => { setInsightsUnlocked(false); setPwDraft(''); setPwError(false); }}
                  className="text-xs text-gray-500 hover:text-red-500 border border-gray-200 px-3 py-1 rounded-lg transition-colors"
                >Lock</button>
              </>
            ) : (
              <>
                <span className="text-sm text-gray-600 font-medium">🔒 Enter editor password to update manual metrics</span>
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    if (pwDraft === 'palstateu') {
                      setInsightsUnlocked(true);
                      setPwError(false);
                      setPwDraft('');
                    } else {
                      setPwError(true);
                    }
                  }}
                  className="flex items-center gap-2 ml-auto"
                >
                  <input
                    type="password"
                    value={pwDraft}
                    onChange={e => { setPwDraft(e.target.value); setPwError(false); }}
                    placeholder="Password"
                    className={`border rounded-lg px-3 py-1.5 text-sm w-36 focus:outline-none focus:ring-2 ${pwError ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-blue-400'}`}
                  />
                  <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">Unlock</button>
                  {pwError && <span className="text-xs text-red-500">Incorrect password</span>}
                </form>
              </>
            )}
          </div>

          {/* ── Strategic Planning KPIs ── */}
          <div className="mb-8">
            <ErrorBoundary>
              <StrategicTab stats={strategicStats} mainStats={s} year={year} unlocked={insightsUnlocked} />
            </ErrorBoundary>
          </div>

          {/* ── Green Library KPIs ── */}
          <div className="mb-8">
            <ErrorBoundary>
              <GreenLibraryTab reuseRate={strategicStats && !strategicStats.error && strategicStats.totalItems > 0 ? parseFloat((strategicStats.checkoutsThisYear / strategicStats.totalItems).toFixed(2)) : null} unlocked={insightsUnlocked} />
            </ErrorBoundary>
          </div>

          {/* ── Recommended Actions ── */}
          {s && !s.error && <RecommendedActions stats={s} chedStats={chedStats} year={year} />}
        </div>

        {/* Tab: Trends */}
        <div className={activeTab === 'trends' ? 'block' : 'hidden print:block'}>
          {/* ── Sync Controls ── */}
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span>🔄</span>Sync Destiny → Supabase
            </h2>
            <div className="bg-white rounded-xl shadow-sm p-5">
              <p className="text-xs text-gray-600 mb-4">
                Push a fresh snapshot from your Destiny ILS into Supabase so historical trend charts update. Run the daily sync once per day and the monthly sync after each month closes (or use a cron job to automate).
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  disabled={syncingDaily}
                  onClick={async () => {
                    setSyncingDaily(true);
                    setSyncDailyStatus(null);
                    try {
                      const res = await fetch('/api/sync/daily', { method: 'POST' });
                      const d = await res.json();
                      setSyncDailyStatus(d.ok ? `✅ Saved snapshot for ${d.snapshot_date}` : `❌ ${d.error}`);
                      if (d.ok) {
                        const { supabase } = await import('@/lib/supabase');
                        const { data } = await supabase.from('daily_snapshots').select('snapshot_date,total_items,checked_out,active_patrons_30d,checkouts_30d,total_patrons').order('snapshot_date', { ascending: false }).limit(30);
                        if (data) setDailySnaps(data as DailySnap[]);
                      }
                    } catch { setSyncDailyStatus('❌ Network error'); }
                    setSyncingDaily(false);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                >
                  {syncingDaily ? 'Syncing…' : '📅 Sync Today\'s Snapshot'}
                </button>
                <button
                  disabled={syncingMonthly}
                  onClick={async () => {
                    setSyncingMonthly(true);
                    setSyncMonthStatus(null);
                    try {
                      const res = await fetch('/api/sync/monthly', { method: 'POST' });
                      const d = await res.json();
                      setSyncMonthStatus(d.ok ? `✅ Upserted ${d.rows} month rows` : `❌ ${d.error}`);
                      if (d.ok) {
                        const { supabase } = await import('@/lib/supabase');
                        const { data } = await supabase.from('monthly_circulation').select('*').order('year').order('month');
                        if (data) setMonthlyData(data as MonthlyRow[]);
                      }
                    } catch { setSyncMonthStatus('❌ Network error'); }
                    setSyncingMonthly(false);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                >
                  {syncingMonthly ? 'Syncing…' : '📆 Sync Monthly Data (24 mo)'}
                </button>
                <button
                  disabled={syncingMonthly}
                  onClick={async () => {
                    setSyncingMonthly(true);
                    setSyncMonthStatus(null);
                    try {
                      const res = await fetch('/api/sync/monthly?months=60', { method: 'POST' });
                      const d = await res.json();
                      setSyncMonthStatus(d.ok ? `✅ Backfilled ${d.rows} month rows (5 years)` : `❌ ${d.error}`);
                      if (d.ok) {
                        const { supabase } = await import('@/lib/supabase');
                        const { data } = await supabase.from('monthly_circulation').select('*').order('year').order('month');
                        if (data) setMonthlyData(data as MonthlyRow[]);
                      }
                    } catch { setSyncMonthStatus('❌ Network error'); }
                    setSyncingMonthly(false);
                  }}
                  className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                >
                  {syncingMonthly ? 'Syncing…' : '🗃️ Backfill 5 Years'}
                </button>
              </div>
              {syncDailyStatus && <p className="mt-3 text-sm">{syncDailyStatus}</p>}
              {syncMonthStatus && <p className="mt-2 text-sm">{syncMonthStatus}</p>}
            </div>
          </div>

          {/* ── Monthly Circulation Chart ── */}
          {monthlyData.length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span>📊</span>Monthly Circulation Trend
              </h2>
              <div className="bg-white rounded-xl shadow-sm p-5">
                <p className="text-xs text-gray-600 mb-4">Checkouts, check-ins, new patrons, and new items per calendar month stored in Supabase.</p>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={monthlyData.map(r => ({ ...r, label: `${r.year}-${String(r.month).padStart(2,'0')}` }))} margin={{ left: 10, right: 10, top: 4, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: unknown) => Number(v).toLocaleString()} />
                    <Legend />
                    <Bar dataKey="checkouts"  name="Checkouts"   fill="#3b82f6" />
                    <Bar dataKey="checkins"   name="Check-ins"   fill="#10b981" />
                    <Bar dataKey="new_patrons" name="New Patrons" fill="#f59e0b" />
                    <Bar dataKey="new_items"  name="New Items"   fill="#8b5cf6" />
                  </BarChart>
                </ResponsiveContainer>

                {/* Annual totals table */}
                <div className="mt-6 overflow-x-auto">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Annual Totals</p>
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-100 text-gray-700 uppercase tracking-wide">
                        <th className="text-left p-2 border border-gray-200">Year</th>
                        <th className="text-right p-2 border border-gray-200">Checkouts</th>
                        <th className="text-right p-2 border border-gray-200">Check-ins</th>
                        <th className="text-right p-2 border border-gray-200">New Patrons</th>
                        <th className="text-right p-2 border border-gray-200">New Items</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const byYear: Record<number, { checkouts: number; checkins: number; new_patrons: number; new_items: number }> = {};
                        for (const r of monthlyData) {
                          if (!byYear[r.year]) byYear[r.year] = { checkouts: 0, checkins: 0, new_patrons: 0, new_items: 0 };
                          byYear[r.year].checkouts  += r.checkouts;
                          byYear[r.year].checkins   += r.checkins;
                          byYear[r.year].new_patrons += r.new_patrons;
                          byYear[r.year].new_items  += r.new_items;
                        }
                        return Object.entries(byYear).sort(([a],[b]) => Number(a)-Number(b)).map(([yr, t]) => (
                          <tr key={yr} className="hover:bg-blue-50">
                            <td className="p-2 border border-gray-200 font-semibold text-gray-900">{yr}</td>
                            <td className="p-2 border border-gray-200 text-right text-blue-700 font-semibold">{t.checkouts.toLocaleString()}</td>
                            <td className="p-2 border border-gray-200 text-right text-green-700">{t.checkins.toLocaleString()}</td>
                            <td className="p-2 border border-gray-200 text-right text-amber-700">{t.new_patrons.toLocaleString()}</td>
                            <td className="p-2 border border-gray-200 text-right text-purple-700">{t.new_items.toLocaleString()}</td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {monthlyData.length === 0 && (
            <div className="mb-8 bg-amber-50 border border-amber-200 rounded-xl p-6 text-amber-800 text-sm">
              <strong>No monthly data yet.</strong> Click <em>Sync Monthly Data</em> above to pull circulation history from Destiny into Supabase. Run <em>Backfill 5 Years</em> once to populate historical data.
            </div>
          )}

          {/* ── Daily Snapshots ── */}
          {dailySnaps.length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span>📅</span>Daily Snapshots (last 30 days)
              </h2>
              <div className="bg-white rounded-xl shadow-sm p-5">
                <p className="text-xs text-gray-600 mb-4">Each row is a point-in-time capture pushed by the daily sync. Use these to spot sudden spikes or drops in collection availability.</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={[...dailySnaps].reverse()} margin={{ left: 10, right: 10, top: 4, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="snapshot_date" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: unknown) => Number(v).toLocaleString()} />
                    <Legend />
                    <Bar dataKey="checked_out"       name="Checked Out"       fill="#f59e0b" />
                    <Bar dataKey="active_patrons_30d" name="Active (30d)"     fill="#10b981" />
                    <Bar dataKey="checkouts_30d"     name="Checkouts (30d)"  fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>

                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-100 text-gray-700 uppercase tracking-wide">
                        <th className="text-left p-2 border border-gray-200">Date</th>
                        <th className="text-right p-2 border border-gray-200">Total Items</th>
                        <th className="text-right p-2 border border-gray-200">Checked Out</th>
                        <th className="text-right p-2 border border-gray-200">Total Patrons</th>
                        <th className="text-right p-2 border border-gray-200">Active (30d)</th>
                        <th className="text-right p-2 border border-gray-200">Checkouts (30d)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailySnaps.map((r, i) => (
                        <tr key={i} className="hover:bg-blue-50">
                          <td className="p-2 border border-gray-200 font-mono text-gray-800">{r.snapshot_date}</td>
                          <td className="p-2 border border-gray-200 text-right text-gray-800">{r.total_items.toLocaleString()}</td>
                          <td className="p-2 border border-gray-200 text-right text-amber-700 font-semibold">{r.checked_out.toLocaleString()}</td>
                          <td className="p-2 border border-gray-200 text-right text-gray-800">{r.total_patrons.toLocaleString()}</td>
                          <td className="p-2 border border-gray-200 text-right text-green-700">{r.active_patrons_30d.toLocaleString()}</td>
                          <td className="p-2 border border-gray-200 text-right text-blue-700 font-semibold">{r.checkouts_30d.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {dailySnaps.length === 0 && trendsLoaded && (
            <div className="mb-8 bg-blue-50 border border-blue-200 rounded-xl p-6 text-blue-800 text-sm">
              <strong>No daily snapshots yet.</strong> Click <em>Sync Today&apos;s Snapshot</em> above to capture today&apos;s stats. Schedule this to run daily (e.g. via a cron job hitting <code className="bg-blue-100 px-1 rounded">/api/sync/daily</code>) to build a historical trend.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

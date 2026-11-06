'use client';

interface Props {
  days: string[];
  hours: number[];
  /** matrix[dayIndex][hour] = count */
  matrix: number[][];
  max: number;
  /** what is counted, for the tooltip ("visits", "sessions") */
  noun: string;
}

/** Weekday x hour grid; darker cells are busier. Only the hours that have any activity are shown. */
export default function HeatmapGrid({ days, hours, matrix, max, noun }: Props) {
  const top = Math.max(1, max);
  const used = hours.filter(hr => matrix.some(row => (row[hr] ?? 0) > 0));
  if (used.length === 0) return <p className="text-sm text-gray-400 py-10 text-center">Nothing in this period.</p>;
  const shown = Array.from({ length: used[used.length - 1] - used[0] + 1 }, (_, i) => used[0] + i);
  const label = (hr: number) => `${hr % 12 === 0 ? 12 : hr % 12}${hr < 12 ? 'a' : 'p'}`;
  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-separate" style={{ borderSpacing: 2 }}>
        <thead><tr><th></th>{shown.map(hr => <th key={hr} className="font-normal text-gray-500 px-1">{label(hr)}</th>)}</tr></thead>
        <tbody>
          {days.map((day, d) => (
            <tr key={day}>
              <th className="text-left font-medium text-gray-600 pr-2 whitespace-nowrap">{day.slice(0, 3)}</th>
              {shown.map(hr => {
                const v = matrix[d]?.[hr] ?? 0;
                return <td key={hr} title={`${day} ${label(hr)}: ${v.toLocaleString()} ${noun}`} className="w-9 h-7 text-center rounded"
                  style={{ background: v ? `rgba(37,99,235,${0.12 + 0.88 * (v / top)})` : '#f3f4f6', color: v / top > 0.55 ? '#fff' : '#374151' }}>{v || ''}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

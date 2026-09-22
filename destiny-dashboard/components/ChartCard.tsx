'use client';

import { useRef, useState } from 'react';

type Row = Record<string, unknown>;

interface Props {
  /** Base filename (no extension) for the PNG/CSV downloads. */
  filename: string;
  /** The chart's underlying rows, used for the CSV/Excel download. */
  data: Row[] | undefined | null;
  children: React.ReactNode;
  className?: string;
}

function csvField(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : `"${s}"`;
}

function rowsToCsv(rows: Row[]): string {
  const header = Object.keys(rows[0]);
  const lines = [header.map(csvField).join(',')];
  for (const row of rows) lines.push(header.map(h => csvField(row[h])).join(','));
  return lines.join('\n');
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Wraps a chart with a small toolbar to download it as a PNG image (for reports/slides) or a CSV (opens in Excel). */
export default function ChartCard({ filename, data, children, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [exportingPng, setExportingPng] = useState(false);

  async function downloadPng() {
    if (!ref.current || exportingPng) return;
    setExportingPng(true);
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(ref.current, { backgroundColor: '#ffffff', pixelRatio: 2 });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${filename}.png`;
      a.click();
    } catch {
      // best-effort export — leave the chart usable either way
    } finally {
      setExportingPng(false);
    }
  }

  function downloadCsv() {
    if (!data || data.length === 0) return;
    downloadBlob(rowsToCsv(data), `${filename}.csv`, 'text/csv');
  }

  return (
    <div className={className}>
      <div className="flex justify-end gap-1.5 mb-1.5 print:hidden">
        <button
          type="button"
          onClick={downloadPng}
          disabled={exportingPng}
          title="Download chart as image (PNG) — for reports and slides"
          className="text-[11px] font-semibold px-2 py-1 rounded-md border border-gray-200 text-gray-500 hover:text-gray-800 hover:border-gray-300 transition-colors disabled:opacity-50"
        >
          {exportingPng ? '…' : '🖼️ PNG'}
        </button>
        {data && data.length > 0 && (
          <button
            type="button"
            onClick={downloadCsv}
            title="Download chart data as a spreadsheet (opens in Excel)"
            className="text-[11px] font-semibold px-2 py-1 rounded-md border border-gray-200 text-gray-500 hover:text-gray-800 hover:border-gray-300 transition-colors"
          >
            📊 Excel
          </button>
        )}
      </div>
      <div ref={ref} className="bg-white">{children}</div>
    </div>
  );
}

import { supabaseServer } from '@/lib/supabase-server';

export const maxDuration = 60;

const PAGE_SIZE = 1000;

function csvField(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// GET /api/catalog/export — full library_catalog as a CSV download.
// Reads from Supabase (the mirror), not Destiny, so it works even if
// MS SQL Server is offline.
export async function GET() {
  const header = ['Barcode', 'CallNumber', 'Title', 'Author', 'Publisher', 'PublicationYear', 'Sublocation'];
  const lines = [header.join(',')];

  let from = 0;
  while (true) {
    const { data, error } = await supabaseServer
      .from('library_catalog')
      .select('barcode, call_number, title, author, publisher, publication_year, sublocation')
      .order('title')
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      return new Response(`error,${csvField(error.message)}`, {
        status: 500,
        headers: { 'Content-Type': 'text/csv; charset=utf-8' },
      });
    }
    if (!data || data.length === 0) break;

    for (const r of data) {
      lines.push([
        csvField(r.barcode),
        csvField(r.call_number),
        csvField(r.title),
        csvField(r.author),
        csvField(r.publisher),
        csvField(r.publication_year),
        csvField(r.sublocation),
      ].join(','));
    }

    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="library-catalog-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

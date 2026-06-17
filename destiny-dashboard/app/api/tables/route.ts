import { NextResponse } from 'next/server';
import { getSchema } from '@/lib/schema';

export async function GET() {
  try {
    const schema = await getSchema();
    return NextResponse.json(schema);
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

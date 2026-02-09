import { NextResponse } from 'next/server';
import { getAISummaries } from '@/lib/sheets';

export const dynamic = 'force-dynamic';
export const revalidate = 300; // Cache for 5 minutes

export async function GET() {
  try {
    const summaries = await getAISummaries();

    // Sort by date descending (most recent first)
    summaries.sort((a, b) => b.Date.localeCompare(a.Date));

    return NextResponse.json({ summaries });
  } catch (error) {
    console.error('API /insights error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch AI summaries', summaries: [] },
      { status: 500 }
    );
  }
}

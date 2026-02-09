import { NextRequest, NextResponse } from 'next/server';
import { getDailyLogs, getWeeklySummaries } from '@/lib/sheets';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start') || '2020-01-01';
    const end = searchParams.get('end') || '2099-12-31';

    const [dailyLogs, weeklySummaries] = await Promise.all([
      getDailyLogs(),
      getWeeklySummaries(),
    ]);

    // Filter by date range
    const filteredLogs = dailyLogs.filter(
      (d) => d.Date >= start && d.Date <= end
    );
    const filteredSummaries = weeklySummaries.filter(
      (s) => s.Week_Start >= start || s.Week_End <= end
    );

    return NextResponse.json({
      dailyLogs: filteredLogs,
      weeklySummaries: filteredSummaries,
    });
  } catch (error) {
    console.error('API /data error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data', dailyLogs: [], weeklySummaries: [] },
      { status: 500 }
    );
  }
}

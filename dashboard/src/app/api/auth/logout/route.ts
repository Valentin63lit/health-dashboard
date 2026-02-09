import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cookieStore = await cookies();
  cookieStore.delete('health_session');

  return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'));
}

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete('health_session');

  return NextResponse.json({ success: true });
}

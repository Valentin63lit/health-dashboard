import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body as { password?: string };

    if (!password) {
      return NextResponse.json({ error: 'Password required' }, { status: 400 });
    }

    const correctPassword = process.env.DASHBOARD_PASSWORD;
    if (!correctPassword) {
      console.error('DASHBOARD_PASSWORD environment variable is not set');
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    if (password !== correctPassword) {
      return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
    }

    // Password correct — set session cookie with a simple static token
    const cookieStore = await cookies();
    cookieStore.set('health_session', 'authenticated', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

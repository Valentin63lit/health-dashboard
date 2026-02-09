import { NextRequest, NextResponse } from 'next/server';

/** Static token value set by /api/auth/login when password is correct */
const SESSION_TOKEN = 'authenticated';

/** Paths that don't require authentication */
const PUBLIC_PATHS = [
  '/login',
  '/api/auth',
  '/_next',
  '/favicon.ico',
  '/logo.png',
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths through
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Check for session cookie
  const session = request.cookies.get('health_session')?.value;
  const dashboardPassword = process.env.DASHBOARD_PASSWORD;

  if (!dashboardPassword) {
    // No password configured — allow access (dev mode / misconfigured)
    return NextResponse.next();
  }

  if (session !== SESSION_TOKEN) {
    // No valid session — redirect to login
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except static files and internal Next.js paths.
     * This runs middleware on pages and API routes.
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

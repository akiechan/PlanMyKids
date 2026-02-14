import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Admin emails stored server-side only
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(email => email.trim().toLowerCase())
  .filter(Boolean);

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  // Refresh session if expired - this will update the cookies
  const { data: { session } } = await supabase.auth.getSession();

  const pathname = request.nextUrl.pathname;

  // Define protected routes
  const isAdminRoute = pathname.startsWith('/admin');
  const isAdminLoginPage = pathname === '/admin/login';
  const isFamilyPlanningLogin = pathname === '/familyplanning/login';

  // Admin routes require login + admin email
  if (isAdminRoute && !isAdminLoginPage) {
    if (!session) {
      const loginUrl = new URL('/admin/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
    const userEmail = session.user.email?.toLowerCase();
    const isAdmin = userEmail && ADMIN_EMAILS.includes(userEmail);
    if (!isAdmin) {
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('error', 'not_authorized');
      return NextResponse.redirect(loginUrl);
    }
  }

  // Redirect away from login pages if already authenticated
  if (isFamilyPlanningLogin && session) {
    const redirectUrl = new URL('/familyplanning/dashboard', request.url);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    // Match all routes except static files, api routes, and auth callback
    '/((?!_next/static|_next/image|favicon.ico|api/|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Handle error from Supabase
  if (error) {
    console.error('Auth error:', error, errorDescription);
    return NextResponse.redirect(`${origin}/featured/login?error=auth_failed`);
  }

  if (code) {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.delete({ name, ...options });
          },
        },
      }
    );

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error('Code exchange error:', exchangeError);
      return NextResponse.redirect(`${origin}/featured/login?error=auth_failed`);
    }

    // Successful authentication - redirect to the next page
    return NextResponse.redirect(`${origin}${next}`);
  }

  // No code present - check for hash-based tokens (handled by client)
  // Redirect to the client-side callback page to handle hash tokens
  return NextResponse.redirect(`${origin}/auth/callback/client${searchParams.toString() ? '?' + searchParams.toString() : ''}`);
}

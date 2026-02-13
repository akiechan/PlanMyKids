import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Admin emails are stored server-side only - not exposed to client
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(email => email.trim().toLowerCase())
  .filter(Boolean);

export async function GET(request: NextRequest) {
  // Create server-side Supabase client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );

  // Get the current session
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error || !session) {
    return NextResponse.json({ isAdmin: false, error: 'Not authenticated' }, { status: 401 });
  }

  const userEmail = session.user.email?.toLowerCase();

  if (!userEmail) {
    return NextResponse.json({ isAdmin: false, error: 'No email found' }, { status: 401 });
  }

  // Check if user's email is in the admin allowlist
  const isAdmin = ADMIN_EMAILS.includes(userEmail);

  if (!isAdmin) {
    // Sign out the user if they're not an admin
    await supabase.auth.signOut();
    return NextResponse.json({ isAdmin: false, error: 'Not authorized' }, { status: 403 });
  }

  return NextResponse.json({ isAdmin: true, email: userEmail });
}

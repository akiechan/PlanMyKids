// Shared auth helper for admin API routes
// Pattern matches lib/planner-auth.ts — returns { error: NextResponse } on failure

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(email => email.trim().toLowerCase())
  .filter(Boolean);

const REAUTH_WINDOW_SECONDS = 15 * 60; // 15 minutes

/**
 * Verify the request comes from an authenticated admin.
 * Returns { user, email, session } on success, or { error: NextResponse } on failure.
 */
export async function verifyAdmin(request: NextRequest) {
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

  const { data: { session }, error } = await supabase.auth.getSession();

  if (error || !session) {
    return {
      error: NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      ),
    };
  }

  const userEmail = session.user.email?.toLowerCase();
  if (!userEmail || !ADMIN_EMAILS.includes(userEmail)) {
    return {
      error: NextResponse.json(
        { error: 'Forbidden: not an admin' },
        { status: 403 }
      ),
    };
  }

  return { user: session.user, email: userEmail, session };
}

/**
 * Verify admin + session freshness for critical/destructive operations.
 * Session must have been created within the last 15 minutes.
 */
export async function verifyCriticalAdmin(request: NextRequest) {
  const result = await verifyAdmin(request);
  if ('error' in result) return result;

  const { session } = result;
  const accessToken = session.access_token;

  try {
    // Decode JWT payload (base64url) — already validated by getSession()
    const payloadBase64 = accessToken.split('.')[1];
    const payload = JSON.parse(
      Buffer.from(payloadBase64, 'base64url').toString()
    );
    const iat = payload.iat;

    if (!iat) {
      return {
        error: NextResponse.json(
          { error: 'reauthentication_required', message: 'Unable to verify session age. Please sign in again.' },
          { status: 403 }
        ),
      };
    }

    const ageSeconds = Math.floor(Date.now() / 1000) - iat;
    if (ageSeconds > REAUTH_WINDOW_SECONDS) {
      return {
        error: NextResponse.json(
          {
            error: 'reauthentication_required',
            message: `Session is ${Math.floor(ageSeconds / 60)} minutes old. Critical actions require a fresh sign-in (within 15 minutes).`,
          },
          { status: 403 }
        ),
      };
    }
  } catch {
    return {
      error: NextResponse.json(
        { error: 'reauthentication_required', message: 'Unable to verify session. Please sign in again.' },
        { status: 403 }
      ),
    };
  }

  return result;
}

import { NextRequest, NextResponse } from 'next/server';

// This endpoint calls the Supabase Edge Function to send magic link via Resend

export async function POST(request: NextRequest) {
  try {
    const { email, redirectTo } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Supabase configuration missing' },
        { status: 500 }
      );
    }

    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const finalRedirectTo = redirectTo || `${origin}/auth/callback?next=/featured/setup`;

    // Call the Edge Function
    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/send-magic-link`;
    console.log('Calling Edge Function:', edgeFunctionUrl);
    console.log('Email:', email);
    console.log('Redirect URL:', finalRedirectTo);

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        email,
        redirectTo: finalRedirectTo,
      }),
    });

    const data = await response.json();
    console.log('Edge Function response:', response.status, data);

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'Failed to send magic link' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Send magic link error:', error);
    return NextResponse.json(
      { error: 'Failed to send magic link' },
      { status: 500 }
    );
  }
}

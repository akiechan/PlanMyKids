import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// This endpoint is for TESTING ONLY - generates magic link without sending email
// Uses admin/service role to generate the link directly

export async function POST(request: NextRequest) {
  try {
    const { email, redirectTo } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Create admin client with service role key
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Generate magic link using admin API
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo: redirectTo || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback?next=/featured/setup`,
      },
    });

    if (error) {
      console.error('Generate link error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // The link contains the token - we need to construct the full URL
    // data.properties.action_link contains the full magic link
    const magicLink = data.properties?.action_link;

    if (!magicLink) {
      return NextResponse.json({ error: 'Failed to generate link' }, { status: 500 });
    }

    return NextResponse.json({
      magicLink,
      message: 'Magic link generated for testing'
    });

  } catch (error) {
    console.error('Error generating magic link:', error);
    return NextResponse.json(
      { error: 'Failed to generate magic link' },
      { status: 500 }
    );
  }
}

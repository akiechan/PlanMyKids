import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendMagicLinkRequest {
  email: string;
  redirectTo?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email, redirectTo }: SendMagicLinkRequest = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const elasticEmailApiKey = Deno.env.get('ELASTICEMAIL_API_KEY');
    const appUrl = Deno.env.get('APP_URL') || 'http://localhost:3000';

    // Create Supabase admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Generate magic link using Supabase Admin API
    const { data, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo: redirectTo || `${appUrl}/auth/callback?next=/featured/setup`,
      },
    });

    if (linkError) {
      console.error('Generate link error:', linkError);
      return new Response(
        JSON.stringify({ error: linkError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const magicLink = data.properties?.action_link;

    if (!magicLink) {
      return new Response(
        JSON.stringify({ error: 'Failed to generate magic link' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If no API key, return the link for testing
    if (!elasticEmailApiKey) {
      console.log('No ELASTICEMAIL_API_KEY - returning link for testing');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Magic link generated (no email sent - testing mode)',
          magicLink,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send email via Elastic Email
    const htmlBody = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Sign in to PlanMyKids</title></head>
<body style="margin:0;padding:0;background-color:#f0f4ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f4ff;padding:48px 16px;">
<tr><td align="center">

<!-- Logo area -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:500px;margin-bottom:24px;">
<tr><td align="center">
  <div style="display:inline-block;font-size:28px;font-weight:800;color:#2563eb;letter-spacing:-0.5px;">PlanMyKids</div>
</td></tr>
</table>

<!-- Main card -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:500px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(37,99,235,0.08),0 1px 3px rgba(0,0,0,0.04);">

  <!-- Illustration header -->
  <tr><td style="background:linear-gradient(135deg,#eff6ff 0%,#e0e7ff 100%);padding:40px 32px 32px;text-align:center;">
    <div style="font-size:48px;margin-bottom:16px;">&#128274;</div>
    <h1 style="margin:0;font-size:24px;font-weight:700;color:#1e293b;letter-spacing:-0.3px;">Sign in to your account</h1>
    <p style="margin:8px 0 0;font-size:15px;color:#64748b;line-height:1.5;">Tap the button below to securely access your Family Planner. No password needed.</p>
  </td></tr>

  <!-- CTA section -->
  <tr><td style="padding:36px 32px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <a href="${magicLink}" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#4f46e5);color:#ffffff;text-decoration:none;padding:16px 48px;border-radius:12px;font-size:16px;font-weight:700;letter-spacing:0.2px;box-shadow:0 4px 12px rgba(37,99,235,0.3);mso-padding-alt:0;">Sign In to PlanMyKids</a>
      </td></tr>
    </table>

    <!-- Divider -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0;">
      <tr><td style="border-top:1px solid #e2e8f0;"></td></tr>
    </table>

    <!-- Security info -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;padding:0;">
      <tr><td style="padding:16px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="width:32px;vertical-align:top;padding-top:2px;font-size:16px;">&#9200;</td>
            <td style="font-size:13px;color:#64748b;line-height:1.5;padding-bottom:8px;">This link expires in <strong style="color:#334155;">1 hour</strong></td>
          </tr>
          <tr>
            <td style="width:32px;vertical-align:top;padding-top:2px;font-size:16px;">&#128272;</td>
            <td style="font-size:13px;color:#64748b;line-height:1.5;padding-bottom:8px;">Only works once for your security</td>
          </tr>
          <tr>
            <td style="width:32px;vertical-align:top;padding-top:2px;font-size:16px;">&#128233;</td>
            <td style="font-size:13px;color:#64748b;line-height:1.5;">Sent to <strong style="color:#334155;">${email}</strong></td>
          </tr>
        </table>
      </td></tr>
    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:20px 32px 24px;border-top:1px solid #f1f5f9;text-align:center;">
    <p style="margin:0 0 4px;font-size:12px;color:#94a3b8;">Didn't request this? You can safely ignore this email.</p>
    <p style="margin:0;font-size:11px;color:#cbd5e1;">PlanMyKids &middot; Helping SF families find amazing programs</p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;

    const emailResponse = await fetch('https://api.elasticemail.com/v2/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        apikey: elasticEmailApiKey,
        from: 'noreply@planmykids.org',
        fromName: 'PlanMyKids',
        to: email,
        subject: 'Sign in to PlanMyKids',
        bodyHtml: htmlBody,
        isTransactional: 'true',
      }),
    });

    const emailResult = await emailResponse.json();

    if (!emailResult.success) {
      console.error('Elastic Email error:', emailResult.error);
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: emailResult.error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Magic link sent to your email',
        emailId: emailResult.data?.messageid,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

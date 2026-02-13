// Email sending helper (Elastic Email)

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.ELASTICEMAIL_API_KEY;

  if (!apiKey) {
    console.log('No ELASTICEMAIL_API_KEY - skipping email');
    return { success: false, error: 'Elastic Email API key not configured' };
  }

  try {
    const response = await fetch('https://api.elasticemail.com/v2/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        apikey: apiKey,
        from: 'noreply@planmykids.org',
        fromName: 'PlanMyKids',
        to,
        subject,
        bodyHtml: html,
        isTransactional: 'true',
      }),
    });

    const result = await response.json();

    if (!result.success) {
      console.error('Elastic Email error:', result.error);
      return { success: false, error: result.error || 'Failed to send email' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: String(error) };
  }
}

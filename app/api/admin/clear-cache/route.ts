import { NextRequest, NextResponse } from 'next/server';
import { clearCampsCache } from '@/lib/api-cache';
import { verifyAdmin } from '@/lib/admin-auth';

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if ('error' in auth) return auth.error;

  clearCampsCache();
  return NextResponse.json({ success: true });
}

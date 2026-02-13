import { NextResponse } from 'next/server';
import { clearCampsCache } from '@/lib/api-cache';

export async function POST() {
  clearCampsCache();
  return NextResponse.json({ success: true });
}

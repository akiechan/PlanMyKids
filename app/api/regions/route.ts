import { NextResponse } from 'next/server';
import { getActiveRegions } from '@/lib/regions';

export async function GET() {
  try {
    const regions = await getActiveRegions();
    return NextResponse.json({ regions });
  } catch (error) {
    console.error('Error fetching regions:', error);
    return NextResponse.json({ regions: [] }, { status: 500 });
  }
}

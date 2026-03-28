import { NextRequest, NextResponse } from 'next/server';
import { calculateQualityScore } from '@/lib/ai/bugAnalyzer';
import { requireAuth } from '@/lib/auth/requireAuth';

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();

    if (!body.title || !body.description) {
      return NextResponse.json({ error: 'Bug report data is required' }, { status: 400 });
    }

    const score = await calculateQualityScore(body);

    return NextResponse.json(score);
  } catch (error) {
    console.error('Quality score error:', error);
    return NextResponse.json({ error: 'Failed to calculate quality score' }, { status: 500 });
  }
}

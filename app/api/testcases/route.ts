import { NextRequest, NextResponse } from 'next/server';
import { generateTestCases } from '@/lib/ai/bugAnalyzer';
import { requireAuth } from '@/lib/auth/requireAuth';

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { title, description, stepsToReproduce } = body;

    if (!title || !description) {
      return NextResponse.json({ error: 'title and description are required' }, { status: 400 });
    }

    const testCases = await generateTestCases({
      title,
      description,
      stepsToReproduce: stepsToReproduce || [],
    });

    return NextResponse.json({ testCases });
  } catch (error) {
    console.error('Test case generation error:', error);
    return NextResponse.json({ error: 'Failed to generate test cases' }, { status: 500 });
  }
}

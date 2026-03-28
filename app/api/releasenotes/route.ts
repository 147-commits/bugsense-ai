import { NextRequest, NextResponse } from 'next/server';
import { generateReleaseNotes } from '@/lib/ai/bugAnalyzer';
import { requireAuth } from '@/lib/auth/requireAuth';
import { prisma } from '@/lib/database/prisma';

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { input, format = 'standard', projectId } = body;
    if (!input) return NextResponse.json({ error: 'input is required' }, { status: 400 });

    const result = await generateReleaseNotes(input, format);

    if (projectId) {
      await prisma.generatedContent.create({
        data: { projectId, type: 'releasenotes', input, output: result },
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Release notes error:', error);
    return NextResponse.json({ error: 'Failed to generate release notes' }, { status: 500 });
  }
}

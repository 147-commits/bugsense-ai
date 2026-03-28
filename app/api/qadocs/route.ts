import { NextRequest, NextResponse } from 'next/server';
import { generateQADocumentation } from '@/lib/ai/bugAnalyzer';
import { requireAuth } from '@/lib/auth/requireAuth';
import { prisma } from '@/lib/database/prisma';

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { input, docType = 'test_strategy', projectId } = body;
    if (!input) return NextResponse.json({ error: 'input is required' }, { status: 400 });

    const result = await generateQADocumentation(input, docType);

    if (projectId) {
      await prisma.generatedContent.create({
        data: { projectId, type: 'qadocs', input, output: result as Record<string, unknown> as Parameters<typeof prisma.generatedContent.create>[0]['data']['output'] },
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('QA docs error:', error);
    return NextResponse.json({ error: 'Failed to generate documentation' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { generateAPITests } from '@/lib/ai/bugAnalyzer';
import { requireAuth } from '@/lib/auth/requireAuth';
import { prisma } from '@/lib/database/prisma';

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { apiDescription, format = 'playwright', projectId } = body;
    if (!apiDescription) return NextResponse.json({ error: 'apiDescription is required' }, { status: 400 });

    const result = await generateAPITests(apiDescription, format);

    if (projectId) {
      await prisma.generatedContent.create({
        data: { projectId, type: 'apitests', input: apiDescription, output: result as unknown as Parameters<typeof prisma.generatedContent.create>[0]['data']['output'], framework: format },
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('API test gen error:', error);
    return NextResponse.json({ error: 'Failed to generate API tests' }, { status: 500 });
  }
}

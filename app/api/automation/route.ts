import { NextRequest, NextResponse } from 'next/server';
import { generateAutomationScript } from '@/lib/ai/bugAnalyzer';
import { requireAuth } from '@/lib/auth/requireAuth';
import { prisma } from '@/lib/database/prisma';

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { scenario, framework = 'playwright', options = {}, projectId } = body;
    if (!scenario) return NextResponse.json({ error: 'scenario is required' }, { status: 400 });

    const result = await generateAutomationScript(scenario, framework, {
      language: options.language || 'typescript',
      includePageObject: options.includePageObject ?? true,
      includeHelpers: options.includeHelpers ?? true,
      includeCIConfig: options.includeCIConfig ?? false,
    });

    if (projectId) {
      await prisma.generatedContent.create({
        data: { projectId, type: 'automation', input: scenario, output: result, framework, language: options.language || 'typescript' },
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Automation error:', error);
    return NextResponse.json({ error: 'Failed to generate automation script' }, { status: 500 });
  }
}

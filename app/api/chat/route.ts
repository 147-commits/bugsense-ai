import { NextRequest, NextResponse } from 'next/server';
import { chatAboutBug } from '@/lib/ai/bugAnalyzer';
import { requireAuth } from '@/lib/auth/requireAuth';
import { prisma } from '@/lib/database/prisma';

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { bugReportId, message, history = [], projectId } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    // Look up bug from DB if bugReportId provided
    let bugContext = 'No specific bug context available.';
    if (bugReportId) {
      const bug = await prisma.bugReport.findUnique({
        where: { id: bugReportId },
        select: { title: true, description: true, severity: true, stepsToReproduce: true, affectedModules: true },
      });
      if (bug) {
        bugContext = `Title: ${bug.title}\nDescription: ${bug.description}\nSeverity: ${bug.severity}\nSteps: ${bug.stepsToReproduce.join(', ')}\nModules: ${bug.affectedModules.join(', ')}`;
      }
    }

    const response = await chatAboutBug(bugContext, history, message);

    // Persist chat messages if bugReportId provided
    if (bugReportId) {
      await prisma.chatMessage.createMany({
        data: [
          { bugReportId, role: 'user', content: message },
          { bugReportId, role: 'assistant', content: response },
        ],
      });
    }

    return NextResponse.json({ response, projectId });
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json({ error: 'Failed to generate response' }, { status: 500 });
  }
}

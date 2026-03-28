import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    services: {
      ai: process.env.AI_API_KEY ? 'configured' : 'demo_mode',
      database: process.env.DATABASE_URL ? 'configured' : 'mock_data',
    },
  });
}

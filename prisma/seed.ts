import { PrismaClient, Severity, Priority, BugStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create bug clusters
  const authCluster = await prisma.bugCluster.create({
    data: {
      name: 'Authentication Issues',
      description: 'Bugs related to login, SSO, session management, and OAuth flows',
      bugCount: 3,
    },
  });

  const paymentCluster = await prisma.bugCluster.create({
    data: {
      name: 'Payment Processing',
      description: 'Bugs related to billing, currency, checkout, and payment forms',
      bugCount: 2,
    },
  });

  // Create bug reports
  await prisma.bugReport.create({
    data: {
      rawInput: 'Login page crashes when using SSO with corporate account',
      title: 'SSO Login Crash on OAuth Callback',
      description: 'Users experience an unhandled exception when signing in via SSO after OAuth redirect.',
      severity: Severity.CRITICAL,
      priority: Priority.P0,
      status: BugStatus.OPEN,
      stepsToReproduce: [
        'Navigate to /auth/login',
        'Click "Sign in with SSO"',
        'Complete IdP authentication',
        'Observe crash on redirect',
      ],
      expectedResult: 'User authenticated and redirected to dashboard',
      actualResult: 'White screen with TypeError in console',
      environment: { os: 'Windows 11', browser: 'Chrome 120', version: 'v2.4.1' },
      rootCauseHypotheses: [
        'OAuth token schema change',
        'Race condition in token storage',
        'Missing null check on response',
      ],
      affectedModules: ['Authentication', 'Session Management'],
      qualityScore: 87,
      tags: ['sso', 'crash', 'authentication', 'blocker'],
      clusterId: authCluster.id,
    },
  });

  await prisma.bugReport.create({
    data: {
      rawInput: 'Payment form shows wrong currency symbol after switching regions',
      title: 'Currency Symbol Not Updating on Region Change',
      description: 'The payment form retains the previous region currency symbol when users switch billing region.',
      severity: Severity.HIGH,
      priority: Priority.P1,
      status: BugStatus.OPEN,
      stepsToReproduce: [
        'Go to Settings > Billing',
        'Change region from US to EU',
        'Navigate to payment form',
        'Observe $ symbol instead of €',
      ],
      expectedResult: 'Currency symbol updates to match selected region',
      actualResult: 'Previous region currency symbol persists',
      environment: { os: 'macOS 14', browser: 'Safari 17', version: 'v2.4.1' },
      rootCauseHypotheses: ['Stale state in currency context', 'Locale not propagating'],
      affectedModules: ['Billing', 'Localization'],
      qualityScore: 92,
      tags: ['billing', 'localization', 'currency'],
      clusterId: paymentCluster.id,
    },
  });

  await prisma.bugReport.create({
    data: {
      rawInput: 'Dashboard charts show no data after midnight UTC',
      title: 'Dashboard Data Gap at UTC Midnight Rollover',
      description: 'Real-time dashboard charts display empty state between 00:00-00:05 UTC.',
      severity: Severity.MEDIUM,
      priority: Priority.P2,
      status: BugStatus.IN_PROGRESS,
      stepsToReproduce: [
        'Open dashboard before 23:59 UTC',
        'Wait for midnight rollover',
        'Observe charts losing data',
        'Manual refresh restores after ~5 min',
      ],
      expectedResult: 'Continuous data display during rollover',
      actualResult: '5-minute data gap in charts',
      environment: { os: 'Any', browser: 'Any', version: 'v2.4.0+' },
      rootCauseHypotheses: ['Aggregation job blocks reads', 'Cache invalidation timing'],
      affectedModules: ['Dashboard', 'Analytics', 'Data Pipeline'],
      qualityScore: 74,
      tags: ['dashboard', 'analytics', 'timezone'],
      clusterId: null,
    },
  });

  // Create analytics snapshot
  await prisma.analyticsSnapshot.create({
    data: {
      totalBugs: 147,
      criticalBugs: 12,
      highBugs: 34,
      mediumBugs: 52,
      lowBugs: 38,
      resolvedBugs: 89,
      duplicateBugs: 15,
      avgQualityScore: 76.4,
      topModules: [
        { module: 'Authentication', count: 28 },
        { module: 'Payment Processing', count: 22 },
        { module: 'Dashboard', count: 18 },
      ],
    },
  });

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

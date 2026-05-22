import * as Sentry from '@sentry/nextjs';
import { beforeSendFilter } from '@/lib/observability/sentry';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    beforeSend: beforeSendFilter,
  });
}

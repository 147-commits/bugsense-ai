import * as Sentry from '@sentry/nextjs';
import { beforeSendFilter } from '@/lib/observability/sentry';

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    beforeSend: beforeSendFilter,
  });
}

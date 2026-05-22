'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';

/**
 * Trigger a JWT refresh after the user verifies their email so that
 * `session.user.emailVerified` becomes non-null without requiring a
 * sign-out / sign-in cycle. The authOptions jwt callback reads the
 * fresh value from the database on `trigger === 'update'`.
 */
export default function RefreshSessionOnVerify() {
  const { update } = useSession();
  useEffect(() => {
    void update();
  }, [update]);
  return null;
}

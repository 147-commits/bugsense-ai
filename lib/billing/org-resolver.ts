import { eq } from 'drizzle-orm';
import { db } from '@/lib/database/db';
import { organizationMembers, projects } from '@/lib/database/schema';

/**
 * Resolve the organization that the current request should be billed to.
 *
 * If a projectId is in play (e.g., the analyze pipeline), the project's
 * organization wins. Otherwise fall back to the user's primary org
 * membership (oldest joined).
 */
export async function resolveOrganizationId(opts: {
  userId: string;
  projectId?: string | null;
}): Promise<string | null> {
  if (!db) return null;
  if (opts.projectId) {
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, opts.projectId),
      columns: { organizationId: true },
    });
    if (project?.organizationId) return project.organizationId;
  }
  const member = await db.query.organizationMembers.findFirst({
    where: eq(organizationMembers.userId, opts.userId),
    orderBy: organizationMembers.joinedAt,
    columns: { organizationId: true },
  });
  return member?.organizationId ?? null;
}

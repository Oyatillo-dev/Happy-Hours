import type { Prisma } from '@prisma/client';
import { prisma, type Tx } from '../db.js';

/** FR-A08: every admin/support action and automatic sanction is logged. */
export function audit(
  action: string,
  entity: string,
  entityId: string,
  actorId: string | null,
  data?: Prisma.InputJsonValue,
  tx: Tx = prisma,
) {
  return tx.auditLog.create({ data: { action, entity, entityId, actorId, data } });
}

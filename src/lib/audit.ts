import { prisma } from "@/lib/db";

export type AuditInput = {
  actorId?: string | null;
  actorName: string;
  action: string;
  target?: string | null;
  detail?: unknown;
  ip?: string | null;
};

export async function audit(input: AuditInput) {
  await prisma.auditLog
    .create({
      data: {
        actorId: input.actorId ?? null,
        actorName: input.actorName,
        action: input.action,
        target: input.target ?? null,
        detail: input.detail === undefined ? null : JSON.stringify(input.detail),
        ip: input.ip ?? null,
      },
    })
    .catch(() => undefined); // auditing must never break the request path
}

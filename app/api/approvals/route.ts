import { NextRequest } from 'next/server';
import { z } from 'zod';
import { mintApprovalToken } from '@/lib/approvals/token';
import { evaluatePolicy } from '@/lib/policy/approvalPolicy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MintRequest = z.object({
  batchId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  approverId: z.string().min(1).describe('Placeholder identity until real auth lands.'),
  secondApproverId: z.string().min(1).optional(),
  stake: z.enum(['read-only', 'single-record-edit', 'bulk-update', 'mass-action']),
});

/**
 * POST /api/approvals — mints a server-signed ApprovalToken.
 *
 * phase-a: staged-batch lookup is gone; the request supplies the
 * idempotency key directly. Phase B reintroduces a domain-appropriate
 * staging store.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }
  const parsed = MintRequest.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: 'schema',
        issues: parsed.error.issues.map(i => ({ path: i.path, message: i.message })),
      },
      { status: 400 },
    );
  }
  const data = parsed.data;
  const evalResult = evaluatePolicy({ stake: data.stake });
  if (evalResult.policy === 'requires-dual-control' && !data.secondApproverId) {
    return Response.json(
      {
        ok: false,
        error: 'dual_control_required',
        policy: evalResult.policy,
        reasons: evalResult.reasons,
      },
      { status: 409 },
    );
  }
  try {
    const token = await mintApprovalToken({
      batchId: data.batchId,
      idempotencyKey: data.idempotencyKey,
      approverId: data.approverId,
      secondApproverId: data.secondApproverId,
      policyAtIssue: evalResult.policy,
    });
    return Response.json({
      ok: true,
      token,
      policy: evalResult.policy,
      reasons: evalResult.reasons,
    });
  } catch (e: any) {
    return Response.json(
      { ok: false, error: 'mint_failed', message: e?.message ?? 'unknown' },
      { status: 500 },
    );
  }
}

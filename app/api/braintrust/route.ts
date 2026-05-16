import { NextRequest } from 'next/server';
import { readSecrets } from '@/lib/secrets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BT_BASE = 'https://api.braintrust.dev/v1';

async function btFetch(path: string, apiKey: string, options?: RequestInit) {
  return fetch(`${BT_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  });
}

// GET /api/braintrust?action=test → validate key + return project list
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') ?? 'test';

  if (action === 'test') {
    const secrets = await readSecrets();
    const apiKey = secrets.braintrustApiKey;
    if (!apiKey) return Response.json({ ok: false, error: 'No BrainTrust API key configured' });

    try {
      const res = await btFetch('/project?limit=50', apiKey);
      if (!res.ok) {
        const text = await res.text();
        return Response.json({ ok: false, error: `BrainTrust returned ${res.status}: ${text.slice(0, 200)}` });
      }
      const data = await res.json();
      const projects: { id: string; name: string }[] = (data.objects ?? []).map((p: any) => ({
        id: p.id,
        name: p.name,
      }));
      return Response.json({ ok: true, projects });
    } catch (e: any) {
      return Response.json({ ok: false, error: e?.message ?? 'Network error' });
    }
  }

  return Response.json({ error: 'unknown action' }, { status: 400 });
}

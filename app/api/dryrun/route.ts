import { NextRequest, NextResponse } from 'next/server';
import { runTool, type ToolContext } from '@/lib/tools';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      tool: string;
      input?: Record<string, unknown>;
      allowInternal?: boolean;
    };
    const ctx: ToolContext = {
      mode: 'testing',
    };
    const result = await runTool(body.tool, body.input ?? {}, ctx, {
      allowInternal: body.allowInternal === true,
    });
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, summary: e?.message ?? 'unknown error', data: null },
      { status: 500 }
    );
  }
}

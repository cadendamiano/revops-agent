import { NextRequest } from 'next/server';
import type { DatasetKey } from '@/lib/data';
import type { ArtifactKind } from '@/lib/flows';
import { sseEncode, type Event, type ChatHistoryTurn } from '@/lib/chatRouteHelpers';
import { runAgentOnce } from '@/lib/agent/runAgentOnce';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    model: string;
    userMessage: string;
    mode?: 'demo' | 'testing';
    billEnvId?: string;
    billProduct?: 'ap' | 'se';
    demoDataset?: DatasetKey;
    forcedKind?: ArtifactKind;
    requirements?: string[];
    commandName?: string;
    shortcutAllowedTools?: string[];
    shortcutSystemPrompt?: string;
    history?: ChatHistoryTurn[];
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (ev: Event) => controller.enqueue(encoder.encode(sseEncode(ev)));
      try {
        await runAgentOnce({ ...body, onEvent: send });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  });
}

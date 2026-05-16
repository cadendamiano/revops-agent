import { matchFlow, type ArtifactKind } from './flows';
import type { SlashCommand } from './slashCommands';
import type { ForcedArtifact } from './runtime';
import { isShortcut, expandPrompt, buildShortcutSystemPrompt, type Shortcut } from './shortcuts';

export type ComposerSubmitState = {
  body: string;
  streaming: boolean;
  forcedCmd: SlashCommand | Shortcut | null;
  mode: 'demo' | 'testing';
  variableValues?: Record<string, string>;
  /** Active thread's modality-picker selection. Used in testing mode when no
   *  slash command is present. Slash commands always win for the submit they
   *  appear on. Ignored in demo mode (scripted flows take over). */
  desiredArtifactKind?: ArtifactKind;
};

export type ComposerSubmitAction =
  | { kind: 'ignore' }
  | { kind: 'flow'; flowId: string }
  | { kind: 'llm'; body: string; opts?: ForcedArtifact };

const CUSTOM_CHART_HINTS = [
  'line', 'treemap', 'tree map', 'heatmap', 'heat map', 'sunburst',
  'sankey', 'scatter', 'radar', 'area', 'candlestick', 'funnel',
  'gauge', 'waterfall', 'histogram', 'stacked', 'combo', 'dashboard',
  'kpi', 'timeline', 'time series', 'over time',
];

function wantsCustomViz(body: string): boolean {
  const low = body.toLowerCase();
  return CUSTOM_CHART_HINTS.some(h => low.includes(h));
}

export function resolveComposerSubmit(s: ComposerSubmitState): ComposerSubmitAction {
  if (s.streaming) return { kind: 'ignore' };

  const body = s.body.trim();

  if (s.forcedCmd && isShortcut(s.forcedCmd)) {
    const sc = s.forcedCmd;
    const expanded = expandPrompt(sc.prompt, s.variableValues ?? {});
    const sysPrompt = buildShortcutSystemPrompt(sc, expanded);
    return {
      kind: 'llm',
      body: body || expanded,
      opts: {
        commandName: sc.name,
        shortcutAllowedTools: sc.allowedTools.length > 0 ? sc.allowedTools : undefined,
        shortcutSystemPrompt: sysPrompt,
      },
    };
  }

  if (s.forcedCmd) {
    const cmd = s.forcedCmd as SlashCommand;
    const forceLlm =
      (cmd.name === 'dataviz' && wantsCustomViz(body)) ||
      // /slides always runs the questionnaire conversation through the LLM
      // — there is no useful canned demo flow for it.
      cmd.name === 'slides';
    if (s.mode === 'demo' && !forceLlm) {
      return { kind: 'flow', flowId: cmd.demoFlowId };
    }
    return {
      kind: 'llm',
      body,
      opts: {
        forcedKind: cmd.kind,
        requirements: cmd.requirements,
        commandName: cmd.name,
      },
    };
  }

  if (!body) return { kind: 'ignore' };

  if (s.mode === 'testing') {
    if (s.desiredArtifactKind) {
      return { kind: 'llm', body, opts: { forcedKind: s.desiredArtifactKind } };
    }
    return { kind: 'llm', body };
  }

  // In demo mode, custom-viz asks should reach the LLM even without a slash command.
  if (wantsCustomViz(body)) {
    return { kind: 'llm', body };
  }

  const matched = matchFlow(body);
  if (matched) return { kind: 'flow', flowId: matched };
  return { kind: 'llm', body };
}

import type { ArtifactKind } from './flows';
import type { SlashCommand } from './slashCommands';
import type { ForcedArtifact } from './runtime';
import { isShortcut, expandPrompt, buildShortcutSystemPrompt, type Shortcut } from './shortcuts';

export type ComposerSubmitState = {
  body: string;
  streaming: boolean;
  forcedCmd: SlashCommand | Shortcut | null;
  variableValues?: Record<string, string>;
  /** Active thread's modality-picker selection. Slash commands always win. */
  desiredArtifactKind?: ArtifactKind;
};

export type ComposerSubmitAction =
  | { kind: 'ignore' }
  | { kind: 'llm'; body: string; opts?: ForcedArtifact };

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

  if (s.desiredArtifactKind) {
    return { kind: 'llm', body, opts: { forcedKind: s.desiredArtifactKind } };
  }
  return { kind: 'llm', body };
}

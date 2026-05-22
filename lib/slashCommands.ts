// phase-a: neutral stub. Phase B replaces with SF slash commands.
import type { ArtifactKind } from './flows';
import type { Shortcut } from './shortcuts';

export type SlashCommand = {
  name: string;
  aliases: string[];
  kind: ArtifactKind;
  label: string;
  hint: string;
  requirements: string[];
};

export const SLASH_COMMANDS: readonly SlashCommand[] = [
  {
    name: 'doc',
    aliases: ['report', 'onepager'],
    kind: 'document',
    label: 'doc',
    hint: 'Generate a structured document',
    requirements: [
      'Report title and target audience',
      'Time period covered',
      'Key metrics to surface',
      'Sections to include',
      'Tone: narrative prose vs. bullet-heavy',
    ],
  },
  {
    name: 'slides',
    aliases: ['deck', 'presentation', 'slidedeck'],
    kind: 'slides',
    label: 'slides',
    hint: 'Build a slide deck',
    requirements: [
      'Audience and purpose',
      'Core message / narrative arc',
      'Slide count target',
      'Tone',
    ],
  },
  {
    name: 'sheet',
    aliases: ['spreadsheet', 'table'],
    kind: 'spreadsheet',
    label: 'sheet',
    hint: 'Open a spreadsheet artifact',
    requirements: [
      'What rows / columns to render',
      'Source dataset (if any)',
      'Sort order',
    ],
  },
] as const;

const SLASH_REGEX = /^\/([a-z0-9-]+)(?:\s+([\s\S]*))?$/i;

function findByNameOrAlias(token: string): SlashCommand | undefined {
  const low = token.toLowerCase();
  return SLASH_COMMANDS.find(
    c => c.name === low || c.aliases.includes(low)
  );
}

export function parseSlash(text: string): { cmd: SlashCommand; body: string } | null {
  if (!text) return null;
  const match = SLASH_REGEX.exec(text);
  if (!match) return null;
  const cmd = findByNameOrAlias(match[1]);
  if (!cmd) return null;
  const body = (match[2] ?? '').trim();
  return { cmd, body };
}

export function matchSlashPrefix(token: string): SlashCommand[] {
  const low = token.toLowerCase();
  if (!low) return [...SLASH_COMMANDS];
  return SLASH_COMMANDS.filter(
    c =>
      c.name.startsWith(low) ||
      c.aliases.some(a => a.startsWith(low))
  );
}

export function parseSlashWithShortcuts(
  text: string,
  shortcuts: Shortcut[]
): { cmd: SlashCommand | Shortcut; body: string } | null {
  if (!text) return null;
  const match = SLASH_REGEX.exec(text);
  if (!match) return null;
  const low = match[1].toLowerCase();
  const builtin = findByNameOrAlias(low);
  const body = (match[2] ?? '').trim();
  if (builtin) return { cmd: builtin, body };
  const sc = shortcuts.find(s => s.name === low);
  if (sc) return { cmd: sc, body };
  return null;
}

export function matchSlashPrefixWithShortcuts(
  token: string,
  shortcuts: Shortcut[]
): (SlashCommand | Shortcut)[] {
  const builtin = matchSlashPrefix(token);
  const low = token.toLowerCase();
  const scMatches = !low
    ? [...shortcuts]
    : shortcuts.filter(s => s.name.startsWith(low));
  return [...builtin, ...scMatches];
}

export function requirementsPrompt(cmd: SlashCommand): string {
  const lines = cmd.requirements.map(r => `- ${r}`).join('\n');
  return `The user invoked /${cmd.name}. You MUST call render_artifact exactly once this turn with kind="${cmd.kind}". Cover every requirement below.

Requirements:
${lines}`;
}

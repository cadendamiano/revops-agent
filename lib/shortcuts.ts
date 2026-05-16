import { SLASH_COMMANDS, type SlashCommand } from './slashCommands';

export type ShortcutVariable = {
  name: string;
  label: string;
  placeholder?: string;
};

export type Shortcut = {
  id: string;
  name: string;
  label: string;
  description: string;
  prompt: string;
  variables: ShortcutVariable[];
  allowedTools: string[];
  createdAt: number;
  updatedAt: number;
};

export type MenuItem = SlashCommand | Shortcut;

export function isShortcut(item: MenuItem): item is Shortcut {
  return 'prompt' in item && 'id' in item;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function validateShortcutName(
  name: string,
  shortcuts: Shortcut[],
  editingId?: string
): string | null {
  const slug = slugify(name);
  if (!slug) return 'Name is required';

  for (const cmd of SLASH_COMMANDS) {
    if (cmd.name === slug) return `"${slug}" collides with built-in /${cmd.name}`;
    if (cmd.aliases.includes(slug)) {
      return `"${slug}" collides with built-in alias for /${cmd.name}`;
    }
  }

  for (const sc of shortcuts) {
    if (sc.id === editingId) continue;
    if (sc.name === slug) return `"${slug}" is already in use by another shortcut`;
  }

  return null;
}

export function extractVariables(prompt: string): string[] {
  const re = /\{\{(\w[\w-]*)\}\}/g;
  const seen = new Set<string>();
  const out: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(prompt)) !== null) {
    const v = match[1];
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

export function syncVariables(
  prompt: string,
  existing: ShortcutVariable[]
): ShortcutVariable[] {
  const detected = extractVariables(prompt);
  const byName = new Map(existing.map(v => [v.name, v]));
  return detected.map(name =>
    byName.get(name) ?? { name, label: name }
  );
}

export function expandPrompt(
  template: string,
  values: Record<string, string>
): string {
  return template.replace(/\{\{(\w[\w-]*)\}\}/g, (full, key) => {
    const v = values[key];
    return v != null && v !== '' ? v : full;
  });
}

export function buildShortcutSystemPrompt(
  shortcut: Shortcut,
  expandedPrompt: string
): string {
  return `The user invoked the custom shortcut /${shortcut.name}${shortcut.description ? ` (${shortcut.description})` : ''}. Follow the instructions below precisely. Use the available tools as needed.

Shortcut instructions:
${expandedPrompt}`;
}

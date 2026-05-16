import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Source-level regression guards for CanvasPane: canvas-only filtering, the
// canvasOpen drive of the .open class, and the rename from ArtifactPane.
const SRC = readFileSync(
  join(__dirname, '..', '..', 'components', 'CanvasPane.tsx'),
  'utf8',
);

describe('CanvasPane.tsx', () => {
  it('exports CanvasPane (renamed from ArtifactPane)', () => {
    expect(SRC).toMatch(/export function CanvasPane/);
  });

  it('filters the tab strip to canvas artifact kinds only', () => {
    expect(SRC).toMatch(/isCanvasArtifactKind/);
    expect(SRC).toMatch(/allArtifacts\.filter\(a => isCanvasArtifactKind\(a\.kind\)\)/);
  });

  it('drives drawer visibility off canvasOpen, not activeArtifact', () => {
    expect(SRC).toMatch(/const canvasOpen = useStore/);
    expect(SRC).toMatch(/const isOpen = canvasOpen/);
    expect(SRC).toMatch(/\(isOpen \? ' open' : ''\)/);
  });

  it('Esc and the close button call setCanvasOpen(false)', () => {
    expect(SRC).toMatch(/setCanvasOpen\(false\)/);
  });

  it('uses ArtifactRenderer for the logic view rather than a kind switch', () => {
    expect(SRC).toMatch(/<ArtifactRenderer artifact=\{cur\} \/>/);
    // No leftover inline kind checks in the logic switch.
    expect(SRC).not.toMatch(/cur\.kind === 'opp-health'/);
    expect(SRC).not.toMatch(/cur\.kind === 'pipeline-forecast'/);
    expect(SRC).not.toMatch(/cur\.kind === 'bulk-update-preview'/);
  });
});

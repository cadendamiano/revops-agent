import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Source-level regression guards for the new inline-artifact branch in Turn.tsx.
const SRC = readFileSync(
  join(__dirname, '..', '..', 'components', 'Turn.tsx'),
  'utf8',
);

describe('Turn.tsx inline-artifact branch', () => {
  it('routes inline-artifact turns to InlineArtifactTurn', () => {
    expect(SRC).toMatch(/turn\.kind === 'inline-artifact'/);
    expect(SRC).toMatch(/<InlineArtifactTurn artifactId=\{turn\.artifactId\}/);
  });

  it('InlineArtifactTurn looks up the live artifact from the active thread', () => {
    expect(SRC).toMatch(/function InlineArtifactTurn/);
    expect(SRC).toMatch(/th\?\.artifacts\.find\(a => a\.id === artifactId\)/);
  });

  it('renders nothing when the referenced artifact is missing', () => {
    expect(SRC).toMatch(/if \(!artifact\) return null/);
  });

  it('mounts ArtifactRenderer for the inline body', () => {
    expect(SRC).toMatch(/<ArtifactRenderer artifact=\{artifact\} \/>/);
  });

  it('exposes an open-in-canvas affordance that sets activeArtifact and opens the drawer', () => {
    expect(SRC).toMatch(/setActiveArtifact\(artifact\.id\)/);
    expect(SRC).toMatch(/setCanvasOpen\(true\)/);
  });

  it('uses the .inline-artifact bounded container', () => {
    expect(SRC).toMatch(/className="inline-artifact"/);
  });
});

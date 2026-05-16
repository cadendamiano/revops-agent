import { describe, it, expect } from 'vitest';
import {
  CANVAS_ARTIFACT_KINDS,
  INLINE_ARTIFACT_KINDS,
  isCanvasArtifactKind,
  isInlineArtifactKind,
  type ArtifactKind,
} from '@/lib/flows';

// Listing every kind here is intentional — if a new kind is added to the union
// the type-check below fails until it's also placed in one of the two arrays.
const ALL_KINDS: ArtifactKind[] = [
  'spreadsheet',
  'document',
  'slides',
  'custom-dashboard',
  'opp-health',
  'pipeline-forecast',
  'bulk-update-preview',
];

describe('artifact family helpers', () => {
  it('inline and canvas families partition the ArtifactKind union', () => {
    const all = new Set<ArtifactKind>([
      ...INLINE_ARTIFACT_KINDS,
      ...CANVAS_ARTIFACT_KINDS,
    ]);
    expect([...all].sort()).toEqual([...ALL_KINDS].sort());

    for (const k of INLINE_ARTIFACT_KINDS) {
      expect(CANVAS_ARTIFACT_KINDS).not.toContain(k);
    }
  });

  it('isInlineArtifactKind / isCanvasArtifactKind return exclusive results', () => {
    for (const k of ALL_KINDS) {
      expect(isInlineArtifactKind(k) || isCanvasArtifactKind(k)).toBe(true);
      expect(isInlineArtifactKind(k) && isCanvasArtifactKind(k)).toBe(false);
    }
  });

  it('classifies the three scripted-flow kinds as inline', () => {
    expect(isInlineArtifactKind('opp-health')).toBe(true);
    expect(isInlineArtifactKind('pipeline-forecast')).toBe(true);
    expect(isInlineArtifactKind('bulk-update-preview')).toBe(true);
  });

  it('classifies long-form kinds as canvas', () => {
    expect(isCanvasArtifactKind('document')).toBe(true);
    expect(isCanvasArtifactKind('spreadsheet')).toBe(true);
    expect(isCanvasArtifactKind('slides')).toBe(true);
    expect(isCanvasArtifactKind('custom-dashboard')).toBe(true);
  });
});

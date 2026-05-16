// phase-a: neutral stub. Phase B replaces with SF artifact schemas.
import type { ArtifactKind } from './flows';

export const ARTIFACT_DATA_EXAMPLES = {} as const;

export const SELF_RENDERING_KINDS: ArtifactKind[] = [
  'spreadsheet',
  'document',
  'slides',
  'custom-dashboard',
];

export type SchemaedArtifactKind = keyof typeof ARTIFACT_DATA_EXAMPLES;

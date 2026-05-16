import { describe, it, expect, beforeEach } from 'vitest';
import { useStore, type Artifact } from '@/lib/store';
import type { Turn } from '@/lib/turns';

function resetStore() {
  // Re-seed the store to a deterministic starting point and create one
  // workspace/thread that can hold artifacts.
  useStore.setState({
    activeArtifact: null,
    canvasOpen: false,
    mode: 'demo',
    workspaces: [],
    activeWorkspaceId: null,
    activeWorkspaceThreadId: null,
  });
  const wsId = useStore.getState().newWorkspace('test ws');
  const thId = useStore.getState().newWorkspaceThread(wsId, 'thread');
  useStore.getState().setActiveWorkspace(wsId);
  useStore.getState().setActiveWorkspaceThread(wsId, thId);
}

function buildArtifact(kind: Artifact['kind'], id: string): Artifact {
  return {
    id,
    kind,
    label: `${kind} fixture`,
    status: 'draft',
    version: 1,
    createdBy: 'Coworker',
  };
}

function buildCardTurn(artifactId: string): Turn {
  return {
    id: 'turn_card',
    kind: 'artifact-card',
    artifactId,
    title: 'Card',
    sub: 'SUB',
    meta: '',
  };
}

function buildInlineTurn(artifactId: string): Turn {
  return { id: 'turn_inline', kind: 'inline-artifact', artifactId };
}

describe('createArtifactFromEvent — mode-gated canvas auto-open', () => {
  beforeEach(() => {
    resetStore();
  });

  it('demo mode + canvas kind: sets activeArtifact and opens canvas', () => {
    useStore.getState().setMode('demo');
    useStore.getState().createArtifactFromEvent(
      'art_doc_1',
      buildArtifact('document', 'art_doc_1'),
      buildCardTurn('art_doc_1'),
    );
    const s = useStore.getState();
    expect(s.activeArtifact).toBe('art_doc_1');
    expect(s.canvasOpen).toBe(true);
  });

  it('testing mode + canvas kind: sets activeArtifact but leaves canvas closed', () => {
    useStore.getState().setMode('testing');
    useStore.getState().createArtifactFromEvent(
      'art_ss_1',
      buildArtifact('spreadsheet', 'art_ss_1'),
      buildCardTurn('art_ss_1'),
    );
    const s = useStore.getState();
    expect(s.activeArtifact).toBe('art_ss_1');
    expect(s.canvasOpen).toBe(false);
  });

  it('inline kind never opens canvas and never steals selection', () => {
    useStore.getState().setMode('demo');
    // Pre-set an active canvas selection to make sure inline doesn't clobber it.
    useStore.getState().setActiveArtifact('art_doc_1');
    useStore.getState().createArtifactFromEvent(
      'art_oh_1',
      buildArtifact('opp-health', 'art_oh_1'),
      buildInlineTurn('art_oh_1'),
    );
    const s = useStore.getState();
    expect(s.activeArtifact).toBe('art_doc_1');
    expect(s.canvasOpen).toBe(false);
  });

  it('appends the supplied turn to the active thread', () => {
    useStore.getState().setMode('demo');
    useStore.getState().createArtifactFromEvent(
      'art_oh_2',
      buildArtifact('opp-health', 'art_oh_2'),
      buildInlineTurn('art_oh_2'),
    );
    const s = useStore.getState();
    const th = s.workspaces[0]?.threads[0];
    expect(th?.artifacts.some(a => a.id === 'art_oh_2')).toBe(true);
    expect(th?.turns.some(t => t.kind === 'inline-artifact' && t.artifactId === 'art_oh_2')).toBe(true);
  });

  it('openWorkspaceArtifact sets canvasOpen to true', () => {
    const s = useStore.getState();
    const wsId = s.activeWorkspaceId!;
    const thId = s.activeWorkspaceThreadId!;
    s.setArtifactsInActiveWorkspaceThread(prev => [
      ...prev,
      buildArtifact('document', 'art_doc_open'),
    ]);
    useStore.getState().openWorkspaceArtifact(wsId, thId, 'art_doc_open');
    const next = useStore.getState();
    expect(next.activeArtifact).toBe('art_doc_open');
    expect(next.canvasOpen).toBe(true);
  });
});

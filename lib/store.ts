'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Turn } from './turns';
import type { ArtifactKind, FlowStep } from './flows';
import { SEED_WORKSPACES } from './data';
import type { Shortcut } from './shortcuts';
import {
  DEFAULT_MODEL_ID,
  MODELS,
  firstModelForProvider,
  providerOf,
  type ModelId,
  type Provider,
} from './models';

export type Mode = 'demo' | 'testing';
export type WorkspaceView = 'workspaces' | 'history';

export type WorkspaceFile = {
  id: string;
  name: string;
  kind: 'spreadsheet' | 'document' | 'report' | 'analysis';
  createdAt: number;
  artifactId?: string;
};

export type Workspace = {
  id: string;
  name: string;
  icon: string;
  color: string;
  createdAt: number;
  threads: Thread[];
  files: WorkspaceFile[];
};

// Shared approval state union. `undefined`/missing-key = no entry yet (pre-stage).
// `'pending'` is set explicitly on rollback from `'submitting'`.
export type ApprovalState = 'pending' | 'submitting' | 'approved' | 'rejected';

export type ApprovalPayload = Extract<FlowStep, { kind: 'approval' }>['payload'];

export type Tweaks = {
  accentHue: number;
  density: 'comfortable' | 'compact';
  streamSpeed: 'fast' | 'normal' | 'slow';
  showConnectors: boolean;
  modelId: ModelId;
  showCodeView: boolean;
  darkMode: boolean;
};

export type SettingsStatus = { anthropic: boolean; gemini: boolean; llmgateway: boolean };

export type ArtifactStatus = 'draft' | 'active' | 'paused';

export type Artifact = {
  id: string;
  kind: ArtifactKind;
  label: string;
  filter?: string;
  status: ArtifactStatus;
  version: number;
  createdBy: string;
  editedBy?: string;
  editedAt?: number;
  dryRunAcknowledged?: boolean;
  html?: string;
  css?: string;
  script?: string;
  dataJson?: string;
  title?: string;
};

export type Thread = {
  id: string;
  title: string;
  createdAt: number;
  turns: Turn[];
  artifacts: Artifact[];
  approvalStates: Record<string, ApprovalState>;
  approvalPayloads: Record<string, ApprovalPayload>;
  /** User's preferred artifact kind for the next submit, set via the composer modality picker.
   *  Only consulted in testing mode; demo mode runs scripted flows. Undefined = Auto. */
  desiredArtifactKind?: ArtifactKind;
};

export type UsageSample = {
  ts: number;
  model: ModelId;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
};

type State = {
  tweaks: Tweaks;
  activeArtifact: string | null;
  streaming: boolean;
  composer: string;
  settingsStatus: SettingsStatus | null;
  tokenHistory: UsageSample[];
  recordUsage: (sample: UsageSample) => void;
  clearTokenHistory: () => void;

  mode: Mode;

  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  activeWorkspaceThreadId: string | null;
  workspaceView: WorkspaceView;
  expandedWorkspaceIds: string[];

  shortcuts: Shortcut[];
  addShortcut: (shortcut: Shortcut) => void;
  updateShortcut: (id: string, patch: Partial<Omit<Shortcut, 'id' | 'createdAt'>>) => void;
  deleteShortcut: (id: string) => void;

  setTweak: <K extends keyof Tweaks>(k: K, v: Tweaks[K]) => void;
  setSettingsStatus: (status: SettingsStatus | null) => void;
  setComposer: (s: string) => void;
  setStreaming: (b: boolean) => void;
  setActiveArtifact: (id: string | null) => void;

  setMode: (m: Mode) => void;
  activateArtifact: (id: string) => void;
  acknowledgeArtifactDryRun: (id: string) => void;

  setWorkspaceView: (v: WorkspaceView) => void;
  newWorkspace: (name?: string) => string;
  setActiveWorkspace: (id: string | null) => void;
  deleteWorkspace: (id: string) => void;
  renameWorkspace: (id: string, name: string) => void;
  toggleWorkspaceExpanded: (id: string) => void;
  newWorkspaceThread: (workspaceId: string, title?: string) => string;
  setActiveWorkspaceThread: (workspaceId: string, threadId: string) => void;
  addTurnToActiveWorkspaceThread: (t: Turn) => void;
  updateTurnInActiveWorkspaceThread: (id: string, patch: Partial<Turn>) => void;
  removeTurnsByKindInActiveWorkspaceThread: (kind: Turn['kind']) => void;
  setArtifactsInActiveWorkspaceThread: (fn: (prev: Artifact[]) => Artifact[]) => void;
  createArtifactFromEvent: (artId: string, artifact: Artifact, cardTurn: Turn) => void;
  setApprovalInActiveWorkspaceThread: (batchId: string, state: ApprovalState) => void;
  setApprovalPayloadInActiveWorkspaceThread: (batchId: string, payload: ApprovalPayload) => void;
  deleteWorkspaceThread: (workspaceId: string, threadId: string) => void;
  renameWorkspaceThread: (workspaceId: string, threadId: string, title: string) => void;
  openWorkspaceArtifact: (workspaceId: string, threadId: string, artifactId: string) => void;
  addWorkspaceFile: (workspaceId: string, file: WorkspaceFile) => void;
  setActiveWorkspaceThreadDesiredArtifactKind: (kind: ArtifactKind | undefined) => void;
};

const DEFAULT_TWEAKS: Tweaks = {
  accentHue: 215,
  density: 'comfortable',
  streamSpeed: 'normal',
  showConnectors: true,
  modelId: DEFAULT_MODEL_ID,
  showCodeView: false,
  darkMode: false,
};

const DEFAULT_THREAD_TITLES = new Set(['New task', 'New thread', 'Untitled thread', 'Untitled task']);

function deriveTaskTitle(text: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  const max = 50;
  return cleaned.length <= max ? cleaned : cleaned.slice(0, max).trimEnd() + '…';
}

function createThread(title?: string): Thread {
  return {
    id: `thr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    title: title ?? 'New task',
    createdAt: Date.now(),
    turns: [],
    artifacts: [],
    approvalStates: {},
    approvalPayloads: {},
  };
}

export const useStore = create<State>()(
  persist(
    (set) => ({
      tweaks: DEFAULT_TWEAKS,
      activeArtifact: null,
      streaming: false,
      composer: '',
      settingsStatus: null,
      tokenHistory: [],
      recordUsage: (sample) =>
        set(s => {
          const next = [...s.tokenHistory, sample];
          if (next.length > 100) next.splice(0, next.length - 100);
          return { tokenHistory: next };
        }),
      clearTokenHistory: () => set({ tokenHistory: [] }),

      mode: 'demo',

      workspaces: SEED_WORKSPACES,
      activeWorkspaceId: null,
      activeWorkspaceThreadId: null,
      workspaceView: 'workspaces',
      expandedWorkspaceIds: [],

      shortcuts: [],
      addShortcut: (shortcut) =>
        set(s => ({ shortcuts: [...s.shortcuts, shortcut] })),
      updateShortcut: (id, patch) =>
        set(s => ({
          shortcuts: s.shortcuts.map(sc =>
            sc.id === id ? { ...sc, ...patch, updatedAt: Date.now() } : sc
          ),
        })),
      deleteShortcut: (id) =>
        set(s => ({ shortcuts: s.shortcuts.filter(sc => sc.id !== id) })),

      setTweak: (k, v) => set(s => ({ tweaks: { ...s.tweaks, [k]: v } })),
      setSettingsStatus: (settingsStatus) =>
        set(s => {
          if (!settingsStatus) return { settingsStatus };
          const current = providerOf(s.tweaks.modelId);
          if (settingsStatus[current]) return { settingsStatus };
          const order: Provider[] = ['anthropic', 'gemini', 'llmgateway'];
          const fallbackProvider = order.find(p => p !== current && settingsStatus[p]);
          if (!fallbackProvider) return { settingsStatus };
          const fallback = firstModelForProvider(fallbackProvider);
          if (!fallback) return { settingsStatus };
          return {
            settingsStatus,
            tweaks: { ...s.tweaks, modelId: fallback },
          };
        }),
      setComposer: (composer) => set({ composer }),
      setStreaming: (streaming) => set({ streaming }),
      setActiveArtifact: (id) => set({ activeArtifact: id }),

      setMode: (mode) =>
        set({ mode, streaming: false, composer: '', activeArtifact: null }),

      activateArtifact: (id) =>
        set(s => {
          const patch = (a: Artifact) =>
            a.id === id ? { ...a, status: 'active' as ArtifactStatus, version: (a.version || 1) + 1 } : a;
          if (!s.activeWorkspaceId || !s.activeWorkspaceThreadId) return s;
          return {
            workspaces: s.workspaces.map(w =>
              w.id === s.activeWorkspaceId
                ? { ...w, threads: w.threads.map(th =>
                    th.id === s.activeWorkspaceThreadId
                      ? { ...th, artifacts: th.artifacts.map(patch) }
                      : th
                  ) }
                : w
            ),
          };
        }),

      acknowledgeArtifactDryRun: (id) =>
        set(s => {
          const patch = (a: Artifact) =>
            a.id === id ? { ...a, dryRunAcknowledged: true } : a;
          if (!s.activeWorkspaceId || !s.activeWorkspaceThreadId) return s;
          return {
            workspaces: s.workspaces.map(w =>
              w.id === s.activeWorkspaceId
                ? { ...w, threads: w.threads.map(th =>
                    th.id === s.activeWorkspaceThreadId
                      ? { ...th, artifacts: th.artifacts.map(patch) }
                      : th
                  ) }
                : w
            ),
          };
        }),

      setWorkspaceView: (workspaceView) => set({ workspaceView }),

      newWorkspace: (name) => {
        const id = `ws_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
        const ws: Workspace = {
          id,
          name: name?.trim() || 'New workspace',
          icon: '📁',
          color: 'oklch(0.78 0.06 195)',
          createdAt: Date.now(),
          threads: [],
          files: [],
        };
        set(s => ({
          workspaces: [...s.workspaces, ws],
          activeWorkspaceId: id,
          expandedWorkspaceIds: [...s.expandedWorkspaceIds, id],
        }));
        return id;
      },

      setActiveWorkspace: (id) =>
        set({ activeWorkspaceId: id, activeWorkspaceThreadId: null, activeArtifact: null }),

      deleteWorkspace: (id) =>
        set(s => ({
          workspaces: s.workspaces.filter(w => w.id !== id),
          activeWorkspaceId: s.activeWorkspaceId === id ? null : s.activeWorkspaceId,
          activeWorkspaceThreadId:
            s.activeWorkspaceId === id ? null : s.activeWorkspaceThreadId,
          expandedWorkspaceIds: s.expandedWorkspaceIds.filter(x => x !== id),
        })),

      renameWorkspace: (id, name) =>
        set(s => ({
          workspaces: s.workspaces.map(w =>
            w.id === id ? { ...w, name: name.trim() || 'Untitled workspace' } : w
          ),
        })),

      toggleWorkspaceExpanded: (id) =>
        set(s => {
          const has = s.expandedWorkspaceIds.includes(id);
          return {
            expandedWorkspaceIds: has
              ? s.expandedWorkspaceIds.filter(x => x !== id)
              : [...s.expandedWorkspaceIds, id],
          };
        }),

      newWorkspaceThread: (workspaceId, title) => {
        let threadId = '';
        set(s => {
          const thread = createThread(title);
          threadId = thread.id;
          return {
            workspaces: s.workspaces.map(w =>
              w.id === workspaceId ? { ...w, threads: [...w.threads, thread] } : w
            ),
            activeWorkspaceId: workspaceId,
            activeWorkspaceThreadId: thread.id,
            expandedWorkspaceIds: s.expandedWorkspaceIds.includes(workspaceId)
              ? s.expandedWorkspaceIds
              : [...s.expandedWorkspaceIds, workspaceId],
          };
        });
        return threadId;
      },

      setActiveWorkspaceThread: (workspaceId, threadId) =>
        set({
          activeWorkspaceId: workspaceId,
          activeWorkspaceThreadId: threadId,
          activeArtifact: null,
        }),

      addTurnToActiveWorkspaceThread: (t) =>
        set(s => {
          if (!s.activeWorkspaceId || !s.activeWorkspaceThreadId) return s;
          return {
            workspaces: s.workspaces.map(w =>
              w.id === s.activeWorkspaceId
                ? {
                    ...w,
                    threads: w.threads.map(th => {
                      if (th.id !== s.activeWorkspaceThreadId) return th;
                      const isFirstUserTurn = t.kind === 'user' && !th.turns.some(x => x.kind === 'user');
                      const shouldRename =
                        isFirstUserTurn &&
                        DEFAULT_THREAD_TITLES.has(th.title) &&
                        t.kind === 'user' &&
                        !!t.text?.trim();
                      return {
                        ...th,
                        turns: [...th.turns, t],
                        title: shouldRename && t.kind === 'user' ? deriveTaskTitle(t.text) : th.title,
                      };
                    }),
                  }
                : w
            ),
          };
        }),

      updateTurnInActiveWorkspaceThread: (id, patch) =>
        set(s => {
          if (!s.activeWorkspaceId || !s.activeWorkspaceThreadId) return s;
          return {
            workspaces: s.workspaces.map(w =>
              w.id === s.activeWorkspaceId
                ? {
                    ...w,
                    threads: w.threads.map(th =>
                      th.id === s.activeWorkspaceThreadId
                        ? {
                            ...th,
                            turns: th.turns.map(t =>
                              t.id === id ? ({ ...t, ...patch } as Turn) : t
                            ),
                          }
                        : th
                    ),
                  }
                : w
            ),
          };
        }),

      removeTurnsByKindInActiveWorkspaceThread: (kind) =>
        set(s => {
          if (!s.activeWorkspaceId || !s.activeWorkspaceThreadId) return s;
          return {
            workspaces: s.workspaces.map(w =>
              w.id === s.activeWorkspaceId
                ? {
                    ...w,
                    threads: w.threads.map(th =>
                      th.id === s.activeWorkspaceThreadId
                        ? { ...th, turns: th.turns.filter(t => t.kind !== kind) }
                        : th
                    ),
                  }
                : w
            ),
          };
        }),

      setArtifactsInActiveWorkspaceThread: (fn) =>
        set(s => {
          if (!s.activeWorkspaceId || !s.activeWorkspaceThreadId) return s;
          return {
            workspaces: s.workspaces.map(w =>
              w.id === s.activeWorkspaceId
                ? {
                    ...w,
                    threads: w.threads.map(th =>
                      th.id === s.activeWorkspaceThreadId
                        ? { ...th, artifacts: fn(th.artifacts) }
                        : th
                    ),
                  }
                : w
            ),
          };
        }),

      createArtifactFromEvent: (artId, artifact, cardTurn) =>
        set(s => {
          if (!s.activeWorkspaceId || !s.activeWorkspaceThreadId) return s;
          const CONTENT_FIELDS = ['label', 'title', 'html', 'css', 'script', 'dataJson', 'filter'] as const;
          return {
            activeArtifact: artId,
            workspaces: s.workspaces.map(w =>
              w.id === s.activeWorkspaceId
                ? {
                    ...w,
                    threads: w.threads.map(th => {
                      if (th.id !== s.activeWorkspaceThreadId) return th;
                      const exists = th.artifacts.some(p => p.id === artId);
                      return {
                        ...th,
                        artifacts: exists
                          ? th.artifacts.map(p => {
                              if (p.id !== artId) return p;
                              const patch = Object.fromEntries(
                                CONTENT_FIELDS.flatMap(k =>
                                  k in artifact ? [[k, (artifact as Record<string, unknown>)[k]]] : []
                                )
                              );
                              return { ...p, ...patch };
                            })
                          : [...th.artifacts, artifact],
                        turns: exists ? th.turns : [...th.turns, cardTurn],
                      };
                    }),
                  }
                : w
            ),
          };
        }),

      setApprovalInActiveWorkspaceThread: (batchId, state) =>
        set(s => {
          if (!s.activeWorkspaceId || !s.activeWorkspaceThreadId) return s;
          return {
            workspaces: s.workspaces.map(w =>
              w.id === s.activeWorkspaceId
                ? {
                    ...w,
                    threads: w.threads.map(th =>
                      th.id === s.activeWorkspaceThreadId
                        ? { ...th, approvalStates: { ...(th.approvalStates ?? {}), [batchId]: state } }
                        : th
                    ),
                  }
                : w
            ),
          };
        }),

      setApprovalPayloadInActiveWorkspaceThread: (batchId, payload) =>
        set(s => {
          if (!s.activeWorkspaceId || !s.activeWorkspaceThreadId) return s;
          return {
            workspaces: s.workspaces.map(w =>
              w.id === s.activeWorkspaceId
                ? {
                    ...w,
                    threads: w.threads.map(th =>
                      th.id === s.activeWorkspaceThreadId
                        ? { ...th, approvalPayloads: { ...(th.approvalPayloads ?? {}), [batchId]: payload } }
                        : th
                    ),
                  }
                : w
            ),
          };
        }),

      deleteWorkspaceThread: (workspaceId, threadId) =>
        set(s => ({
          workspaces: s.workspaces.map(w =>
            w.id === workspaceId
              ? { ...w, threads: w.threads.filter(t => t.id !== threadId) }
              : w
          ),
          activeWorkspaceThreadId:
            s.activeWorkspaceId === workspaceId && s.activeWorkspaceThreadId === threadId
              ? null
              : s.activeWorkspaceThreadId,
          activeArtifact:
            s.activeWorkspaceId === workspaceId && s.activeWorkspaceThreadId === threadId
              ? null
              : s.activeArtifact,
        })),

      renameWorkspaceThread: (workspaceId, threadId, title) =>
        set(s => ({
          workspaces: s.workspaces.map(w =>
            w.id === workspaceId
              ? {
                  ...w,
                  threads: w.threads.map(t =>
                    t.id === threadId ? { ...t, title: title.trim() || 'Untitled task' } : t
                  ),
                }
              : w
          ),
        })),

      openWorkspaceArtifact: (workspaceId, threadId, artifactId) =>
        set({ activeWorkspaceId: workspaceId, activeWorkspaceThreadId: threadId, activeArtifact: artifactId }),

      addWorkspaceFile: (workspaceId, file) =>
        set(s => ({
          workspaces: s.workspaces.map(w =>
            w.id === workspaceId ? { ...w, files: [...w.files, file] } : w
          ),
        })),

      setActiveWorkspaceThreadDesiredArtifactKind: (kind) =>
        set(s => {
          if (!s.activeWorkspaceId || !s.activeWorkspaceThreadId) return s;
          return {
            workspaces: s.workspaces.map(w =>
              w.id === s.activeWorkspaceId
                ? {
                    ...w,
                    threads: w.threads.map(th =>
                      th.id === s.activeWorkspaceThreadId
                        ? { ...th, desiredArtifactKind: kind }
                        : th
                    ),
                  }
                : w
            ),
          };
        }),
    }),
    {
      name: 'bcw:state',
      storage: createJSONStorage(() => localStorage),
      version: 9,
      migrate: (persisted: any, fromVersion: number) => {
        if (persisted && fromVersion < 2) {
          persisted.tweaks = { ...DEFAULT_TWEAKS, ...(persisted.tweaks ?? {}) };
        }
        if (persisted?.tweaks && fromVersion < 4) {
          const legacy = persisted.tweaks.provider as Provider | undefined;
          const firstGemini = MODELS.find(m => m.provider === 'gemini')?.id;
          persisted.tweaks.modelId =
            legacy === 'gemini' ? (firstGemini ?? DEFAULT_MODEL_ID) : DEFAULT_MODEL_ID;
          delete persisted.tweaks.provider;
        }
        if (persisted && fromVersion < 5) {
          persisted.workspaces = persisted.workspaces ?? [];
          persisted.activeWorkspaceId = null;
          persisted.activeWorkspaceThreadId = null;
          persisted.workspaceView = 'workspaces';
          persisted.expandedWorkspaceIds = [];
        }
        if (persisted && fromVersion < 6) {
          if (persisted.mode === 'workspace') persisted.mode = 'demo';
          if (persisted.mode !== 'demo' && persisted.mode !== 'testing') {
            persisted.mode = 'demo';
          }
          delete persisted.turns;
          delete persisted.artifacts;
          delete persisted.approvalStates;
          delete persisted.approvalPayloads;
          delete persisted.testingThreads;
          delete persisted.activeTestingThreadId;
          persisted.shortcuts = persisted.shortcuts ?? [];
        }
        if (persisted && fromVersion < 8) {
          for (const w of persisted.workspaces ?? []) {
            for (const t of w.threads ?? []) {
              t.artifacts = (t.artifacts ?? []).filter(
                (a: any) => !(a?.kind === 'document' && !a?.dataJson)
              );
            }
          }
        }
        if (persisted && fromVersion < 9) {
          // phase-a: drop BILL-coupled fields from persisted state.
          if (persisted.tweaks) {
            delete persisted.tweaks.demoDataset;
            delete persisted.tweaks.defaultBillEnvId;
            delete persisted.tweaks.defaultBillProduct;
          }
          delete persisted.selectedBills;
          for (const w of persisted.workspaces ?? []) {
            for (const t of w.threads ?? []) {
              delete t.selectedBills;
              delete t.billEnvId;
              delete t.billProduct;
            }
          }
        }
        return persisted;
      },
      partialize: (s) => ({
        tweaks: s.tweaks,
        activeArtifact: s.activeArtifact,
        mode: s.mode,
        workspaces: s.workspaces.map(w => ({
          ...w,
          threads: w.threads.map(t => {
            const { approvalPayloads: _strip, ...rest } = t;
            return rest;
          }),
        })),
        activeWorkspaceId: s.activeWorkspaceId,
        activeWorkspaceThreadId: s.activeWorkspaceThreadId,
        workspaceView: s.workspaceView,
        expandedWorkspaceIds: s.expandedWorkspaceIds,
        shortcuts: s.shortcuts,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const workspaces = (state.workspaces ?? []).map((w: any) => ({
          ...w,
          files: w.files ?? [],
          threads: (w.threads ?? []).map((t: any) => ({
            ...t,
            approvalPayloads: t.approvalPayloads ?? {},
            approvalStates: t.approvalStates ?? {},
          })),
        }));
        state.workspaces = workspaces.length > 0 ? workspaces : SEED_WORKSPACES;
        state.expandedWorkspaceIds = state.expandedWorkspaceIds ?? [];
        state.workspaceView = state.workspaceView ?? 'workspaces';
        state.shortcuts = state.shortcuts ?? [];
      },
    }
  )
);

export function getActiveWorkspace(): Workspace | undefined {
  const s = useStore.getState();
  if (!s.activeWorkspaceId) return undefined;
  return s.workspaces.find(w => w.id === s.activeWorkspaceId);
}

export function getActiveWorkspaceThread(): Thread | undefined {
  const s = useStore.getState();
  if (!s.activeWorkspaceId || !s.activeWorkspaceThreadId) return undefined;
  const ws = s.workspaces.find(w => w.id === s.activeWorkspaceId);
  return ws?.threads.find(t => t.id === s.activeWorkspaceThreadId);
}

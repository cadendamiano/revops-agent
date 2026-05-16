import { afterEach } from 'vitest';

function makeStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() { return store.size; },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => {
      store.clear();
    },
  };
}

// Node 24+ ships a stub `localStorage` that is enabled only when started with
// `--localstorage-file=<path>`. Without the flag, its methods are absent and
// jsdom won't replace the existing global. Install our own in-memory Storage
// so Zustand's persist middleware works under jsdom.
const needsPolyfill =
  typeof (globalThis as any).localStorage?.setItem !== 'function';
if (needsPolyfill) {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: makeStorage(),
  });
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: makeStorage(),
  });
}

afterEach(() => {
  localStorage.clear();
});

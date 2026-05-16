import { initLogger, traced, currentSpan, type Span } from 'braintrust';
import { readSecrets } from './secrets';

let initialized: boolean | null = null;
let initPromise: Promise<boolean> | null = null;

async function tryInit(): Promise<boolean> {
  const s = await readSecrets();
  if (!s.braintrustEnabled || !s.braintrustApiKey || !s.braintrustProjectName) {
    return false;
  }
  initLogger({
    apiKey: s.braintrustApiKey,
    projectName: s.braintrustProjectName,
  });
  return true;
}

export async function ensureBraintrustLogger(): Promise<boolean> {
  if (initialized !== null) return initialized;
  if (!initPromise) {
    initPromise = tryInit().catch(() => false);
  }
  initialized = await initPromise;
  return initialized;
}

export { traced, currentSpan };
export type { Span };

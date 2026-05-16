import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

type Role = 'admin' | 'editor' | 'viewer';
type User = { id: string; name: string; role: Role };
type AuthState = { loggedIn: boolean; user: User | null };
type Credentials = { password: string; email?: string };

const api = {
  getAuthState(): Promise<AuthState> {
    return ipcRenderer.invoke('get-auth-state');
  },
  login(credentials: Credentials): Promise<{ ok: boolean; user?: User; error?: string }> {
    return ipcRenderer.invoke('login', credentials);
  },
  logout(): Promise<void> {
    return ipcRenderer.invoke('logout');
  },
  onAuthChanged(cb: (state: AuthState) => void): () => void {
    const listener = (_evt: IpcRendererEvent, state: AuthState) => cb(state);
    ipcRenderer.on('auth-changed', listener);
    return () => ipcRenderer.removeListener('auth-changed', listener);
  },
  onFullScreenChanged(cb: (isFullScreen: boolean) => void): () => void {
    const listener = (_evt: IpcRendererEvent, val: boolean) => cb(val);
    ipcRenderer.on('fullscreen-changed', listener);
    return () => ipcRenderer.removeListener('fullscreen-changed', listener);
  },
  exportTemplate(data: object): Promise<{ ok: boolean; path?: string }> {
    return ipcRenderer.invoke('export-template', data);
  },
  importTemplate(): Promise<{ ok: boolean; data?: object }> {
    return ipcRenderer.invoke('import-template');
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);

export type ElectronAPI = typeof api;

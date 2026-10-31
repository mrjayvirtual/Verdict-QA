import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_SETTINGS, emptyState, type AppState } from './types';

export const STORAGE_KEY = 'verdict-qa:v2';

export function isState(p: unknown): p is AppState {
  if (typeof p !== 'object' || p === null) return false;
  const o = p as Record<string, unknown>;
  return o.version === 2 && ['projects', 'rubrics', 'evaluations', 'issues', 'testCases'].every((k) => Array.isArray(o[k]));
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed: unknown = JSON.parse(raw);
    if (isState(parsed)) return { ...emptyState(), ...parsed, settings: { ...DEFAULT_SETTINGS, ...parsed.settings } };
  } catch {
    /* corrupted or blocked storage falls back to an empty workspace */
  }
  return emptyState();
}

interface Store {
  state: AppState;
  update: (fn: (s: AppState) => AppState) => void;
  replace: (s: AppState) => void;
  saveError: string | null;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setSaveError(null);
    } catch {
      setSaveError('Could not save to this browser (storage full or blocked). Export your data from Settings now.');
    }
  }, [state]);

  const update = useCallback((fn: (s: AppState) => AppState) => setState(fn), []);
  const replace = useCallback((s: AppState) => setState(s), []);
  const value = useMemo(() => ({ state, update, replace, saveError }), [state, update, replace, saveError]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore must be used inside StoreProvider');
  return v;
}

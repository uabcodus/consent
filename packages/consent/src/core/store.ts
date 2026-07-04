export type Listener<T> = (state: Readonly<T>) => void;

export interface Store<T extends object> {
  get: () => Readonly<T>;
  set: (updater: Partial<T> | ((current: T) => T)) => void;
  subscribe: (listener: Listener<T>) => () => void;
  destroy: () => void;
}

export function createStore<T extends object>(initial: T): Store<T> {
  let state = { ...initial } as T;
  const listeners = new Set<Listener<T>>();

  return {
    get: (): Readonly<T> => state,

    set(updater: Partial<T> | ((current: T) => T)): void {
      const next =
        typeof updater === "function"
          ? (updater as (current: T) => T)(state)
          : ({ ...state, ...updater } as T);
      if (next === state) return;
      state = next;
      for (const listener of listeners) {
        listener(state);
      }
    },

    subscribe(listener: Listener<T>): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    destroy(): void {
      listeners.clear();
    },
  };
}

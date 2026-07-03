export type Listener<T> = (state: Readonly<T>) => void;

export function createStore<T extends object>(initial: T) {
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

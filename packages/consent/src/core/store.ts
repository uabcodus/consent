export type Listener<T> = (state: Readonly<T>) => void;

export interface Store<T extends object> {
  get: () => Readonly<T>;
  set: (updater: Partial<T> | ((current: T) => T)) => void;
  subscribe: (listener: Listener<T>) => () => void;
  destroy: () => void;
}

function shallowEqual(a: object, b: object): boolean {
  const keysA = Object.keys(a) as Array<keyof typeof a>;
  const keysB = Object.keys(b) as Array<keyof typeof b>;
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if ((a as Record<string, unknown>)[key] !== (b as Record<string, unknown>)[key]) return false;
  }
  return true;
}

export function createStore<T extends object>(initial: T): Store<T> {
  let state = { ...initial } as T;
  const listeners = new Set<Listener<T>>();

  return {
    get: (): Readonly<T> => state,

    set(updater: Partial<T> | ((current: T) => T)): void {
      let next: T;
      if (typeof updater === "function") {
        next = (updater as (current: T) => T)(state);
      } else {
        next = { ...state, ...updater } as T;
      }

      if (shallowEqual(state, next)) return;
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

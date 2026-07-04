import { describe, it, expect, beforeEach, vi } from "vitest";

import { createStore } from "../../src/core/store";

describe("createStore", () => {
	it("creates a store with initial state", () => {
		const store = createStore({ count: 0, name: "test" });
		expect(store.get()).toEqual({ count: 0, name: "test" });
	});

	it("updates state with partial object", () => {
		const store = createStore({ count: 0, name: "test" });
		store.set({ count: 1 });
		expect(store.get()).toEqual({ count: 1, name: "test" });
	});

	it("updates state with updater function", () => {
		const store = createStore({ count: 0, name: "test" });
		store.set((prev) => ({ count: prev.count + 1, name: prev.name }));
		expect(store.get().count).toBe(1);
	});

	it("notifies subscribers on state change", () => {
		const store = createStore({ count: 0 });
		const listener = vi.fn();

		store.subscribe(listener);
		store.set({ count: 1 });
		store.set({ count: 2 });

		expect(listener).toHaveBeenCalledTimes(2);
		expect(listener).toHaveBeenLastCalledWith({ count: 2 });
	});

	it("returns unsubscribe function", () => {
		const store = createStore({ count: 0 });
		const listener = vi.fn();

		const unsub = store.subscribe(listener);
		store.set({ count: 1 });
		expect(listener).toHaveBeenCalledTimes(1);

		unsub();
		store.set({ count: 2 });
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it("does not notify if state is unchanged by identity", () => {
		const store = createStore({ count: 0 });
		const listener = vi.fn();

		store.subscribe(listener);
		store.set((prev) => prev);

		expect(listener).toHaveBeenCalledTimes(0);
	});

	it("destroys all listeners", () => {
		const store = createStore({ count: 0 });
		const listener = vi.fn();

		store.subscribe(listener);
		store.destroy();
		store.set({ count: 1 });

		expect(listener).not.toHaveBeenCalled();
	});

	it("get returns readonly snapshot", () => {
		const store = createStore({ count: 0 });
		const state = store.get();
		expect(state.count).toBe(0);
	});
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { ConsentProvider, useConsent } from "../../src/react/index";
import type { CategoryConfig, ConsentConfig } from "../../src/core/types";

function makeWrapper(config: ConsentConfig<Record<string, CategoryConfig>>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <ConsentProvider options={config}>{children}</ConsentProvider>;
  };
}

const basicConfig: ConsentConfig<Record<string, CategoryConfig>> = {
  categories: {
    necessary: { readOnly: true },
    analytics: {},
    marketing: {},
  },
};

const basicWrapper = makeWrapper(basicConfig);

describe("React adapter", () => {
  beforeEach(() => {
    Object.defineProperty(document, "cookie", {
      writable: true,
      value: "",
    });
  });

  describe("useConsent", () => {
    it("returns consent instance when used inside ConsentProvider", () => {
      const { result } = renderHook(() => useConsent(), {
        wrapper: basicWrapper,
      });

      expect(result.current).toBeDefined();
      expect(result.current.state).toBeDefined();
      expect(result.current.state.valid).toBe(false);
    });

    it("throws when used outside ConsentProvider", () => {
      expect(() => renderHook(() => useConsent())).toThrow(
        "useConsent must be used within a ConsentProvider",
      );
    });

    it("accesses state reactively", () => {
      const { result } = renderHook(() => useConsent(), {
        wrapper: basicWrapper,
      });

      expect(result.current.state.categories.analytics.accepted).toBe(false);

      act(() => {
        result.current.accept("analytics");
      });

      expect(result.current.state.categories.analytics.accepted).toBe(true);
      expect(result.current.state.valid).toBe(true);
    });

    it("accepts all categories", () => {
      const { result } = renderHook(() => useConsent(), {
        wrapper: basicWrapper,
      });

      act(() => {
        result.current.accept("all");
      });

      expect(result.current.state.categories.analytics.accepted).toBe(true);
      expect(result.current.state.categories.marketing.accepted).toBe(true);
      expect(result.current.state.acceptType).toBe("all");
    });

    it("accepts necessary only", () => {
      const { result } = renderHook(() => useConsent(), {
        wrapper: basicWrapper,
      });

      act(() => {
        result.current.accept("necessary");
      });

      expect(result.current.state.acceptType).toBe("necessary");
      expect(result.current.state.categories.analytics.accepted).toBe(false);
    });

    it("rejects categories", () => {
      const { result } = renderHook(() => useConsent(), {
        wrapper: basicWrapper,
      });

      act(() => {
        result.current.accept("all");
      });

      expect(result.current.state.categories.marketing.accepted).toBe(true);

      act(() => {
        result.current.reject("marketing");
      });

      expect(result.current.state.categories.marketing.accepted).toBe(false);
    });

    it("fires callbacks on accept", () => {
      const onFirstConsent = vi.fn();

      const wrapper = makeWrapper({
        categories: {
          necessary: { readOnly: true } as const,
          analytics: {} as const,
        },
        callbacks: { onFirstConsent },
      });

      const { result } = renderHook(() => useConsent(), { wrapper });

      act(() => {
        result.current.accept("all");
      });

      expect(onFirstConsent).toHaveBeenCalledTimes(1);
    });

    it("subscribes to state changes for React re-renders", () => {
      const { result, rerender } = renderHook(() => useConsent(), {
        wrapper: basicWrapper,
      });

      const stateBefore = result.current.state;

      act(() => {
        result.current.accept("all");
      });

      rerender();

      const stateAfter = result.current.state;

      expect(stateBefore.valid).toBe(false);
      expect(stateAfter.valid).toBe(true);
    });

    it("reset works", () => {
      const { result } = renderHook(() => useConsent(), {
        wrapper: basicWrapper,
      });

      act(() => {
        result.current.accept("all");
      });

      expect(result.current.state.valid).toBe(true);

      act(() => {
        result.current.reset();
      });

      expect(result.current.state.valid).toBe(false);
    });

    it("validConsent returns correct value", () => {
      const { result } = renderHook(() => useConsent(), {
        wrapper: basicWrapper,
      });

      expect(result.current.validConsent()).toBe(false);

      act(() => {
        result.current.accept("all");
      });

      expect(result.current.validConsent()).toBe(true);
    });

    it("handles services in React", () => {
      const wrapper = makeWrapper({
        categories: {
          analytics: {
            services: {
              ga: {} as const,
              mixpanel: {} as const,
            },
          },
        },
      });

      const { result } = renderHook(() => useConsent(), { wrapper });

      act(() => {
        result.current.acceptService("ga", "analytics");
      });

      expect(result.current.state.services.analytics.ga).toBe(true);
      expect(result.current.state.services.analytics.mixpanel).toBe(false);
      expect(result.current.acceptedService("ga", "analytics")).toBe(true);
    });
  });

  describe("ConsentProvider", () => {
    it("provides consent instance through context", () => {
      const { result } = renderHook(() => useConsent(), {
        wrapper: basicWrapper,
      });

      expect(result.current.state.mode).toBe("opt-in");
      expect(result.current.state.categories).toBeDefined();
    });

    it("preserves instance across renders", () => {
      const { result, rerender } = renderHook(() => useConsent(), {
        wrapper: basicWrapper,
      });

      const instance1 = result.current;

      rerender();

      const instance2 = result.current;

      expect(instance1).toBe(instance2);
    });

    it("starts valid when initialCookie is provided", () => {
      const cookieValue = {
        categories: ["necessary", "analytics"],
        services: {},
        revision: 0,
        data: null,
        consentId: "test-id",
        consentTimestamp: new Date().toISOString(),
        lastConsentTimestamp: new Date().toISOString(),
      };

      const wrapper = makeWrapper({
        categories: {
          necessary: { readOnly: true } as const,
          analytics: {} as const,
        },
        initialCookie: cookieValue,
      });

      const { result } = renderHook(() => useConsent(), { wrapper });

      expect(result.current.state.valid).toBe(true);
    });
  });
});

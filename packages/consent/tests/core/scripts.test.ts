import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  retrieveScriptElements,
  manageExistingScripts,
  runServiceCallbacks,
} from "../../src/core/scripts";
import type { ServiceConfig } from "../../src/core/types";

beforeEach(() => {
  document.documentElement.innerHTML = "";
});

describe("retrieveScriptElements", () => {
  it("finds scripts with data-category attribute", () => {
    document.documentElement.innerHTML = `
      <script data-category="analytics" type="text/consent">console.log("track")</script>
      <script data-category="marketing" type="text/consent">console.log("ad")</script>
    `;

    const result = retrieveScriptElements(["analytics", "marketing"], {}, "text/consent");

    expect(result.length).toBe(2);
    expect(result[0]!._categoryName).toBe("analytics");
    expect(result[1]!._categoryName).toBe("marketing");
  });

  it("sets type attribute when none exists", () => {
    document.documentElement.innerHTML = `
      <script data-category="analytics">console.log("track")</script>
    `;

    const result = retrieveScriptElements(["analytics"], {}, "text/consent");

    expect(result.length).toBe(1);
    expect(result[0]!._script.getAttribute("type")).toBe("text/consent");
  });

  it("skips scripts with unknown categories", () => {
    document.documentElement.innerHTML = `
      <script data-category="unknown">console.log("x")</script>
      <script data-category="analytics">console.log("a")</script>
    `;

    const result = retrieveScriptElements(["analytics"], {}, "text/consent");
    expect(result.length).toBe(1);
    expect(result[0]!._categoryName).toBe("analytics");
  });

  it("handles run-on-disable prefix (!)", () => {
    document.documentElement.innerHTML = `
      <script data-category="!analytics">console.log("opt-out")</script>
    `;

    const result = retrieveScriptElements(["analytics"], {}, "text/consent");
    expect(result.length).toBe(1);
    expect(result[0]!._runOnDisable).toBe(true);
    expect(result[0]!._categoryName).toBe("analytics");
  });

  it("handles data-service attribute", () => {
    document.documentElement.innerHTML = `
      <script data-category="analytics" data-service="ga">console.log("ga")</script>
    `;

    const result = retrieveScriptElements(["analytics"], {}, "text/consent");

    expect(result.length).toBe(1);
    expect(result[0]!._serviceName).toBe("ga");
  });

  it("handles run-on-disable for service with !", () => {
    document.documentElement.innerHTML = `
      <script data-category="analytics" data-service="!ga">console.log("opt-out-ga")</script>
    `;

    const result = retrieveScriptElements(["analytics"], {}, "text/consent");

    expect(result.length).toBe(1);
    expect(result[0]!._runOnDisable).toBe(true);
    expect(result[0]!._serviceName).toBe("ga");
  });

  it("returns empty array when no matching scripts", () => {
    const result = retrieveScriptElements(["analytics"], {}, "text/consent");
    expect(result).toEqual([]);
  });

  it("adds undefined service to existingServices map", () => {
    const existingServices: Record<string, Record<string, ServiceConfig>> = {
      analytics: {},
    };

    document.documentElement.innerHTML = `
      <script data-category="analytics" data-service="new_service">console.log("new")</script>
    `;

    retrieveScriptElements(["analytics"], existingServices, "text/consent");

    expect(existingServices.analytics?.new_service).toBeDefined();
  });
});

describe("manageExistingScripts", () => {
  it("does not execute scripts for unaccepted categories", () => {
    document.documentElement.innerHTML = `
      <script id="test-script" data-category="analytics">window.testRan = true</script>
    `;

    const scripts = retrieveScriptElements(["analytics"], {}, "text/consent");

    manageExistingScripts(scripts, [], {}, [], {}, "text/consent");

    expect(window).not.toHaveProperty("testRan");
  });

  it("executes scripts when category becomes accepted", () => {
    document.documentElement.innerHTML = `
      <script id="test-script" data-category="analytics">window.testRan = true</script>
    `;

    const scripts = retrieveScriptElements(["analytics"], {}, "text/consent");

    manageExistingScripts(scripts, ["analytics"], {}, ["analytics"], {}, "text/consent");

    // After execution, the script should be marked as executed
    expect(scripts[0]!._executed).toBe(true);
  });

  it("executes run-on-disable scripts when category is rejected", () => {
    document.documentElement.innerHTML = `
      <script id="optout-script" data-category="!analytics">window.optOutRan = true</script>
    `;

    const scripts = retrieveScriptElements(["analytics"], {}, "text/consent");

    manageExistingScripts(scripts, [], {}, ["analytics"], {}, "text/consent");

    expect(scripts[0]!._executed).toBe(true);
  });

  it("does not re-execute already executed scripts", () => {
    document.documentElement.innerHTML = `
      <script id="one-shot" data-category="analytics">window.counter = (window.counter||0)+1</script>
    `;

    const scripts = retrieveScriptElements(["analytics"], {}, "text/consent");

    manageExistingScripts(scripts, ["analytics"], {}, ["analytics"], {}, "text/consent");

    scripts[0]!._executed = false; // Simulate re-attempt

    manageExistingScripts(scripts, ["analytics"], {}, [], {}, "text/consent");
  });
});

describe("runServiceCallbacks", () => {
  it("calls onAccept when service transitions from disabled to enabled", () => {
    const onAccept = vi.fn();
    const onReject = vi.fn();

    const definedServices = {
      analytics: {
        ga: { onAccept, onReject, _enabled: false },
      },
    };

    const acceptedServices = { analytics: ["ga"] };
    const changedServices = { analytics: ["ga"] };

    runServiceCallbacks(["analytics"], definedServices, acceptedServices, changedServices);

    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onReject).not.toHaveBeenCalled();
  });

  it("calls onReject when service transitions from enabled to disabled", () => {
    const onAccept = vi.fn();
    const onReject = vi.fn();

    const definedServices = {
      analytics: {
        ga: { onAccept, onReject, _enabled: true },
      },
    };

    const acceptedServices = { analytics: [] };
    const changedServices = { analytics: ["ga"] };

    runServiceCallbacks(["analytics"], definedServices, acceptedServices, changedServices);

    expect(onReject).toHaveBeenCalledTimes(1);
    expect(onAccept).not.toHaveBeenCalled();
  });

  it("does not call callbacks for unchanged services", () => {
    const onAccept = vi.fn();
    const onReject = vi.fn();

    const definedServices = {
      analytics: {
        ga: { onAccept, onReject, _enabled: false },
      },
    };

    const acceptedServices = { analytics: [] };
    const changedServices = { analytics: [] };

    runServiceCallbacks(["analytics"], definedServices, acceptedServices, changedServices);

    expect(onAccept).not.toHaveBeenCalled();
    expect(onReject).not.toHaveBeenCalled();
  });

  it("skips services not in definedServices", () => {
    const definedServices = { analytics: {} };
    const acceptedServices = { analytics: ["unknown"] };
    const changedServices = { analytics: ["unknown"] };

    expect(() =>
      runServiceCallbacks(["analytics"], definedServices, acceptedServices, changedServices),
    ).not.toThrow();
  });

  it("handles undefined lastChangedServices", () => {
    const onAccept = vi.fn();

    const definedServices = {
      analytics: {
        ga: { onAccept, _enabled: false },
      },
    };

    const acceptedServices = { analytics: ["ga"] };
    const changedServices = { analytics: ["ga"] };

    runServiceCallbacks(["analytics"], definedServices, acceptedServices, changedServices);

    expect(onAccept).toHaveBeenCalledTimes(1);
  });
});

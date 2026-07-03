import { useState } from "react";
import { ConsentProvider, useConsent } from "@uabcodus/consent/react";

function Banner() {
  const consent = useConsent();
  const { valid, skipped } = consent.state;

  if (skipped || valid) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-[420px] -translate-x-1/2 rounded-xl bg-white p-4 shadow-lg ring-1 ring-black/10">
      <h3 className="mb-2 text-base font-medium">Cookie Consent</h3>
      <p className="mb-4 text-sm text-gray-500">
        We use cookies to improve your browsing experience, serve personalized content, and analyze
        our traffic.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => consent.accept("all")}
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-2.5 text-sm font-medium text-white transition-all hover:bg-blue-600/80"
        >
          Accept All
        </button>
        <button
          onClick={() => consent.accept("necessary")}
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50"
        >
          Necessary Only
        </button>
        <button
          onClick={() => document.getElementById("react-preferences")?.click()}
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50"
        >
          Preferences
        </button>
      </div>
    </div>
  );
}

function Preferences({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const consent = useConsent();
  const { categories } = consent.state;
  const [localCategories, setLocalCategories] = useState(() =>
    Object.fromEntries(Object.entries(categories).map(([k, v]) => [k, v.accepted])),
  );

  if (!open) return null;

  function handleSave() {
    for (const [cat, checked] of Object.entries(localCategories)) {
      if (checked) consent.accept(cat);
      else consent.reject(cat);
    }
    onOpenChange(false);
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/10" onClick={() => onOpenChange(false)} />
      <div className="fixed top-1/2 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-4 shadow-lg ring-1 ring-black/10">
        <h3 className="mb-4 text-base font-medium">Cookie Preferences</h3>
        <div className="flex flex-col gap-3">
          {Object.entries(categories).map(([name, info]) => (
            <div key={name} className="flex items-center justify-between">
              <span className={`text-sm capitalize ${info.readOnly ? "opacity-50" : ""}`}>
                {name}
              </span>
              <label
                className={`relative inline-flex cursor-pointer items-center ${info.readOnly ? "opacity-50 cursor-default" : ""}`}
              >
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={localCategories[name] ?? false}
                  disabled={info.readOnly}
                  onChange={(e) =>
                    setLocalCategories((prev) => ({
                      ...prev,
                      [name]: e.target.checked,
                    }))
                  }
                />
                <div className="h-[18px] w-[32px] rounded-full bg-gray-200 transition-all peer-checked:bg-blue-600 peer-disabled:cursor-not-allowed peer-disabled:opacity-50" />
                <div className="absolute left-0.5 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-[calc(100%-2px)]" />
              </label>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            onClick={handleSave}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50"
          >
            Save Preferences
          </button>
          <button
            onClick={() => {
              consent.accept("all");
              onOpenChange(false);
            }}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-2.5 text-sm font-medium text-white transition-all hover:bg-blue-600/80"
          >
            Accept All
          </button>
        </div>
      </div>
    </>
  );
}

function StateDebug() {
  const consent = useConsent();
  const { valid, acceptType, categories, services } = consent.state;

  return (
    <div className="mx-auto max-w-xl p-4">
      <h3 className="mb-2 text-sm font-medium">Consent State</h3>
      <pre className="rounded-lg bg-gray-100 p-3 text-xs text-gray-700 overflow-x-auto">
        {JSON.stringify(
          {
            valid,
            acceptType,
            categories: Object.fromEntries(
              Object.entries(categories).map(([k, v]) => [
                k,
                { accepted: v.accepted, readOnly: v.readOnly },
              ]),
            ),
            services,
          },
          null,
          2,
        )}
      </pre>
    </div>
  );
}

function DemoInner() {
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  return (
    <div>
      <button
        id="react-preferences"
        onClick={() => setPreferencesOpen(true)}
        style={{ display: "none" }}
      />
      <Banner />
      <Preferences open={preferencesOpen} onOpenChange={setPreferencesOpen} />
      <StateDebug />
    </div>
  );
}

export default function ReactDemo() {
  return (
    <ConsentProvider
      options={{
        cookie: { name: "cc_cookie_react" },
        categories: {
          necessary: { readOnly: true },
          analytics: {
            services: {
              "Google Analytics": {
                cookies: [{ name: /_ga/ }, { name: "_gid" }],
              },
            },
          },
          marketing: {
            services: {
              "Facebook Pixel": { cookies: [{ name: "_fbp" }] },
            },
          },
        },
      }}
    >
      <DemoInner />
    </ConsentProvider>
  );
}

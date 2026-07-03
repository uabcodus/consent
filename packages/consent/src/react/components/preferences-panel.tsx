"use client";

import { useState, type ReactElement } from "react";
import { useConsent } from "../index";
import { Toggle } from "./toggle";

function Button({
  onClick,
  variant = "default",
  children,
}: {
  onClick: () => void;
  variant?: "default" | "outline";
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 16px",
        borderRadius: "6px",
        border: variant === "outline" ? "1px solid #d1d5db" : "none",
        background: variant === "outline" ? "transparent" : "#111827",
        color: variant === "outline" ? "#111827" : "#fff",
        fontWeight: 500,
        fontSize: "14px",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

export function PreferencesPanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): ReactElement | null {
  const consent = useConsent();
  const [localCategories, setLocalCategories] = useState(() =>
    Object.fromEntries(Object.entries(consent.state.categories).map(([k, v]) => [k, v.accepted])),
  );

  if (!open) return null;

  const categories = consent.state.categories;
  const services = consent.state.services;

  function handleSave() {
    for (const [cat, checked] of Object.entries(localCategories)) {
      if (checked) {
        consent.accept(cat as any);
      } else {
        consent.reject(cat as any);
      }
    }
    onOpenChange(false);
  }

  function handleAcceptAll() {
    consent.accept("all");
    onOpenChange(false);
  }

  function handleAcceptNecessary() {
    consent.accept("necessary");
    onOpenChange(false);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={() => onOpenChange(false)}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
        }}
      />
      <div
        style={{
          position: "relative",
          maxWidth: "480px",
          width: "calc(100% - 32px)",
          maxHeight: "80vh",
          background: "#fff",
          borderRadius: "12px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.16)",
          overflow: "auto",
          padding: "24px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
          }}
        >
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>Cookie Preferences</h2>
          <button
            onClick={() => onOpenChange(false)}
            style={{
              background: "none",
              border: "none",
              fontSize: "20px",
              cursor: "pointer",
              padding: "4px 8px",
              lineHeight: 1,
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {Object.entries(categories).map(([name, info]) => (
            <div
              key={name}
              style={{
                borderBottom: "1px solid #f3f4f6",
                paddingBottom: "12px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: "14px",
                      fontWeight: 500,
                      textTransform: "capitalize",
                    }}
                  >
                    {name}
                  </h3>
                </div>
                <Toggle
                  id={`cat-${name}`}
                  label=""
                  checked={localCategories[name] ?? false}
                  readOnly={info.readOnly}
                  onCheckedChange={(checked) => {
                    setLocalCategories((prev) => ({
                      ...prev,
                      [name]: checked,
                    }));
                  }}
                />
              </div>

              {services[name] && Object.keys(services[name]!).length > 0 && (
                <div
                  style={{
                    marginTop: "8px",
                    paddingLeft: "16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  {Object.entries(services[name]!).map(([svc, svcAccepted]) => (
                    <Toggle
                      key={svc}
                      id={`svc-${name}-${svc}`}
                      label={svc}
                      checked={svcAccepted}
                      readOnly={info.readOnly}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          consent.acceptService(svc as any, name as any);
                        } else {
                          consent.rejectService(svc as any, name as any);
                        }
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            gap: "8px",
            marginTop: "20px",
            justifyContent: "flex-end",
          }}
        >
          <Button variant="outline" onClick={handleAcceptNecessary}>
            Necessary Only
          </Button>
          <Button variant="outline" onClick={handleSave}>
            Save Preferences
          </Button>
          <Button onClick={handleAcceptAll}>Accept All</Button>
        </div>
      </div>
    </div>
  );
}

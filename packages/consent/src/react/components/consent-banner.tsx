"use client";

import { useState, type ReactNode, type ReactElement } from "react";
import { useConsent } from "../index";

function Button({
  onClick,
  variant = "default",
  children,
}: {
  onClick: () => void;
  variant?: "default" | "outline";
  children: ReactNode;
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

export function ConsentBanner(): ReactElement | null {
  const consent = useConsent();
  const [open, setOpen] = useState(true);

  if (consent.state.skipped || consent.state.valid) return null;
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "16px",
        left: "50%",
        transform: "translateX(-50%)",
        maxWidth: "420px",
        width: "calc(100% - 32px)",
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: "12px",
        padding: "24px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
        zIndex: 9999,
      }}
    >
      <h2 style={{ margin: "0 0 8px", fontSize: "16px", fontWeight: 600 }}>Cookie Consent</h2>
      <p
        style={{
          margin: "0 0 16px",
          fontSize: "14px",
          color: "#6b7280",
          lineHeight: 1.5,
        }}
      >
        We use cookies to improve your browsing experience, serve personalized content, and analyze
        our traffic.
      </p>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <Button
          onClick={() => {
            consent.accept("all");
            setOpen(false);
          }}
        >
          Accept All
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            consent.accept("necessary");
            setOpen(false);
          }}
        >
          Necessary Only
        </Button>
        <Button variant="outline" onClick={() => setOpen(false)}>
          Close
        </Button>
      </div>
    </div>
  );
}

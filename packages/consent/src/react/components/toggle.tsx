"use client";

import { type ReactElement } from "react";

interface ToggleProps {
  id: string;
  label: string;
  checked: boolean;
  readOnly: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function Toggle({
  id,
  label,
  checked,
  readOnly,
  onCheckedChange,
}: ToggleProps): ReactElement {
  return (
    <label
      htmlFor={id}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        cursor: readOnly ? "default" : "pointer",
        opacity: readOnly ? 0.5 : 1,
      }}
    >
      <div
        style={{
          position: "relative",
          width: "40px",
          height: "24px",
          borderRadius: "12px",
          background: checked ? "#111827" : "#d1d5db",
          transition: "background 0.15s",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "2px",
            left: checked ? "18px" : "2px",
            width: "20px",
            height: "20px",
            borderRadius: "50%",
            background: "#fff",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            transition: "left 0.15s",
          }}
        />
      </div>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={readOnly}
        onChange={(e) => onCheckedChange(e.target.checked)}
        style={{
          position: "absolute",
          opacity: 0,
          pointerEvents: "none",
        }}
      />
      <span style={{ fontSize: "14px" }}>{label}</span>
    </label>
  );
}

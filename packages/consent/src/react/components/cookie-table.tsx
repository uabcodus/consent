"use client";

import type { ReactElement } from "react";
import type { CookieItem } from "../../core/types";

interface CookieTableProps {
  caption?: string;
  headers: Record<string, string>;
  cookies: Array<CookieItem>;
}

export function CookieTable({ caption, headers, cookies }: CookieTableProps): ReactElement | null {
  if (cookies.length === 0) return null;

  const headerKeys = Object.keys(headers);

  return (
    <div style={{ marginTop: "8px" }}>
      {caption && (
        <p
          style={{
            margin: "0 0 8px",
            fontSize: "12px",
            color: "#6b7280",
            fontWeight: 500,
          }}
        >
          {caption}
        </p>
      )}
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "12px",
        }}
      >
        <thead>
          <tr>
            {headerKeys.map((key) => (
              <th
                key={key}
                style={{
                  padding: "6px 8px",
                  borderBottom: "1px solid #e5e7eb",
                  textAlign: "left",
                  fontWeight: 500,
                  color: "#6b7280",
                }}
              >
                {headers[key]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cookies.map((cookie, i) => (
            <tr key={String(cookie.name ?? i)}>
              {headerKeys.map((key) => (
                <td
                  key={key}
                  style={{
                    padding: "6px 8px",
                    borderBottom: "1px solid #f3f4f6",
                  }}
                >
                  {String(cookie[key as keyof Pick<CookieItem, "name" | "path" | "domain">] ?? "–")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

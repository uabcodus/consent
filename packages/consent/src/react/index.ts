"use client";

import { createContext, useContext, useEffect, useRef, createElement, useState } from "react";
import type { ReactNode, ReactElement } from "react";

import { createConsent } from "../core/consent";
import type { CategoryConfig, ConsentConfig, ConsentInstance } from "../core/types";

const ConsentContext = createContext<ConsentInstance<Record<string, CategoryConfig>> | null>(null);

export interface ConsentProviderProps<TCategories extends Record<string, CategoryConfig>> {
  options: ConsentConfig<TCategories>;
  children: ReactNode;
}

export function ConsentProvider<TCategories extends Record<string, CategoryConfig>>({
  options,
  children
}: ConsentProviderProps<TCategories>): ReactElement {
  const consentRef = useRef<ConsentInstance<TCategories> | null>(null);

  if (!consentRef.current) {
    consentRef.current = createConsent<TCategories>(options);
  }

  return createElement(
    ConsentContext.Provider,
    {
      value: consentRef.current as ConsentInstance<Record<string, CategoryConfig>>
    },
    children
  );
}

function useConsentContext(): ConsentInstance<Record<string, CategoryConfig>> {
  const ctx = useContext(ConsentContext);
  if (!ctx) {
    throw new Error("useConsent must be used within a ConsentProvider");
  }
  return ctx;
}

export function useConsent(): ConsentInstance<Record<string, CategoryConfig>> {
  const consent = useConsentContext();
  const [, forceRender] = useState(0);

  useEffect(() => {
    const unsub = consent.subscribe(() => {
      forceRender((n) => n + 1);
    });
    return unsub;
  }, [consent]);

  return consent;
}

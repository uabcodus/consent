"use client";

import { useConsent } from "@uabcodus/consent/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export function ConsentBanner() {
  const consent = useConsent();
  const [open, setOpen] = useState(true);

  if (consent.state.skipped || consent.state.valid) return null;
  if (!open) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-[420px] -translate-x-1/2">
      <Card>
        <CardHeader>
          <CardTitle>Cookie Consent</CardTitle>
          <CardDescription>
            We use cookies to improve your browsing experience, serve personalized content, and
            analyze our traffic.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-wrap gap-2">
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
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Close
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

"use client";

import type { CookieItem } from "@uabcodus/consent/core";
import { useConsent } from "@uabcodus/consent/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

function ConsentToggle({
  id,
  label,
  checked,
  readOnly,
  onCheckedChange
}: {
  id: string;
  label: string;
  checked: boolean;
  readOnly: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className={cn("flex items-center gap-2", readOnly && "opacity-50")}>
      <Switch id={id} checked={checked} disabled={readOnly} onCheckedChange={onCheckedChange} />
      {label && (
        <Label htmlFor={id} className={cn(readOnly && "cursor-default")}>
          {label}
        </Label>
      )}
    </div>
  );
}

function CookieTable({
  caption,
  headers,
  cookies
}: {
  caption?: string;
  headers: Record<string, string>;
  cookies: CookieItem[];
}) {
  if (cookies.length === 0) return null;
  const headerKeys = Object.keys(headers);

  return (
    <div className="mt-2">
      {caption && <p className="text-muted-foreground mb-2 text-xs font-medium">{caption}</p>}
      <Table>
        <TableHeader>
          <TableRow>
            {headerKeys.map((key) => (
              <TableHead key={key}>{headers[key]}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {cookies.map((cookie, i) => (
            <TableRow key={String(cookie.name ?? i)}>
              {headerKeys.map((key) => (
                <TableCell key={key}>
                  {String(
                    cookie[key as keyof Pick<CookieItem, "name" | "path" | "domain">] ?? "\u2013"
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

interface ConsentPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConsentPanel({ open, onOpenChange }: ConsentPanelProps) {
  const consent = useConsent();
  const [localCategories, setLocalCategories] = useState(() =>
    Object.fromEntries(Object.entries(consent.state.categories).map(([k, v]) => [k, v.accepted]))
  );

  const categories = consent.state.categories;
  const services = consent.state.services;

  function handleSave() {
    for (const [cat, checked] of Object.entries(localCategories)) {
      if (checked) {
        consent.accept(cat as never);
      } else {
        consent.reject(cat as never);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cookie Preferences</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {Object.entries(categories).map(([name, info]) => (
            <div key={name}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium capitalize">{name}</h3>
                </div>
                <ConsentToggle
                  id={`cat-${name}`}
                  label=""
                  checked={localCategories[name] ?? false}
                  readOnly={info.readOnly}
                  onCheckedChange={(checked) =>
                    setLocalCategories((prev) => ({
                      ...prev,
                      [name]: checked
                    }))
                  }
                />
              </div>

              {services[name] && Object.keys(services[name]!).length > 0 && (
                <div className="mt-2 ml-4 flex flex-col gap-1">
                  {Object.entries(services[name]!).map(([svc, svcAccepted]) => (
                    <ConsentToggle
                      key={svc}
                      id={`svc-${name}-${svc}`}
                      label={svc}
                      checked={svcAccepted}
                      readOnly={info.readOnly}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          consent.acceptService(svc as never, name as never);
                        } else {
                          consent.rejectService(svc as never, name as never);
                        }
                      }}
                    />
                  ))}
                </div>
              )}

              <Separator className="mt-3" />
            </div>
          ))}
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={handleAcceptNecessary}>
            Necessary Only
          </Button>
          <Button variant="outline" onClick={handleSave}>
            Save Preferences
          </Button>
          <Button onClick={handleAcceptAll}>Accept All</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

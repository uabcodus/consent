"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface ConsentToggleProps {
  id: string;
  label: string;
  checked: boolean;
  readOnly: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function ConsentToggle({
  id,
  label,
  checked,
  readOnly,
  onCheckedChange
}: ConsentToggleProps) {
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

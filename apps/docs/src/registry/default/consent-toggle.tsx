"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface ConsentToggleProps {
	id: string;
	label: string;
	description?: string;
	checked: boolean;
	readOnly: boolean;
	size?: "sm" | "default";
	onCheckedChange: (checked: boolean) => void;
}

export function ConsentToggle({
	id,
	label,
	description,
	checked,
	readOnly,
	size = "default",
	onCheckedChange
}: ConsentToggleProps) {
	return (
		<div className={cn("flex items-start gap-2", readOnly && "opacity-50")}>
			<Switch
				id={id}
				size={size}
				checked={checked}
				disabled={readOnly}
				onCheckedChange={onCheckedChange}
				className="mt-0.5"
			/>
			<div className="flex flex-col gap-0.5">
				<Label htmlFor={id} className={cn(readOnly && "cursor-default")}>
					{label}
				</Label>
				{description && <p className="text-muted-foreground text-xs">{description}</p>}
			</div>
		</div>
	);
}

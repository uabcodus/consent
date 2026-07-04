import { ConsentProvider, useConsent } from "@uabcodus/consent/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

function ConsentBanner({ onOpenPreferences }: { onOpenPreferences: () => void }) {
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
					<Button
						variant="outline"
						onClick={() => {
							onOpenPreferences();
							setOpen(false);
						}}
					>
						Preferences
					</Button>
					<Button variant="ghost" onClick={() => setOpen(false)}>
						Close
					</Button>
				</CardFooter>
			</Card>
		</div>
	);
}

function ConsentPanel({
	open,
	onOpenChange
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const consent = useConsent();
	const [localCategories, setLocalCategories] = useState(() =>
		Object.fromEntries(Object.entries(consent.state.categories).map(([k, v]) => [k, v.accepted]))
	);

	const categories = consent.state.categories;

	function handleSave() {
		for (const [cat, checked] of Object.entries(localCategories)) {
			if (checked) consent.accept(cat);
			else consent.reject(cat);
		}
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
								<div className={cn("flex items-center gap-2", info.readOnly && "opacity-50")}>
									<Switch
										id={`cat-${name}`}
										checked={localCategories[name] ?? false}
										disabled={info.readOnly}
										onCheckedChange={(checked) =>
											setLocalCategories((prev) => ({
												...prev,
												[name]: checked
											}))
										}
									/>
									{info.readOnly && (
										<Label htmlFor={`cat-${name}`} className="cursor-default">
											{name}
										</Label>
									)}
								</div>
							</div>
							<Separator className="mt-3" />
						</div>
					))}
				</div>

				<div className="flex flex-wrap justify-end gap-2">
					<Button
						variant="outline"
						onClick={() => {
							consent.accept("necessary");
							onOpenChange(false);
						}}
					>
						Necessary Only
					</Button>
					<Button variant="outline" onClick={handleSave}>
						Save Preferences
					</Button>
					<Button
						onClick={() => {
							consent.accept("all");
							onOpenChange(false);
						}}
					>
						Accept All
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function StateDebug() {
	const consent = useConsent();
	const { valid, acceptType, categories, services } = consent.state;

	return (
		<div className="mx-auto max-w-xl p-4">
			<h3 className="mb-2 text-sm font-medium">Consent State</h3>
			<pre className="overflow-x-auto rounded-lg bg-gray-100 p-3 text-xs text-gray-700">
				{JSON.stringify(
					{
						valid,
						acceptType,
						categories: Object.fromEntries(
							Object.entries(categories).map(([k, v]) => [
								k,
								{ accepted: v.accepted, readOnly: v.readOnly }
							])
						),
						services
					},
					null,
					2
				)}
			</pre>
		</div>
	);
}

function DemoInner() {
	const [preferencesOpen, setPreferencesOpen] = useState(false);

	return (
		<div>
			<ConsentBanner onOpenPreferences={() => setPreferencesOpen(true)} />
			<ConsentPanel open={preferencesOpen} onOpenChange={setPreferencesOpen} />
			<StateDebug />
		</div>
	);
}

export default function ShadcnDemo() {
	return (
		<ConsentProvider
			options={{
				categories: {
					necessary: { readOnly: true },
					analytics: {
						services: {
							"Google Analytics": {
								cookies: [{ name: /_ga/ }, { name: "_gid" }]
							}
						}
					},
					marketing: {
						services: {
							"Facebook Pixel": { cookies: [{ name: "_fbp" }] }
						}
					}
				}
			}}
		>
			<DemoInner />
		</ConsentProvider>
	);
}

"use client";

import type { CookieItem, ServiceConfig } from "@uabcodus/consent/core";
import { useConsent } from "@uabcodus/consent/react";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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
	description,
	checked,
	readOnly,
	size = "default",
	onCheckedChange
}: {
	id: string;
	label: string;
	description?: string;
	checked: boolean;
	readOnly: boolean;
	size?: "sm" | "default";
	onCheckedChange: (checked: boolean) => void;
}) {
	return (
		<div className={cn("flex items-start gap-2", readOnly && "opacity-50")}>
			<Switch
				id={id}
				size={size}
				checked={checked}
				disabled={readOnly}
				onCheckedChange={onCheckedChange}
				className={cn(size === "sm" ? "mt-0.5" : "mt-0.5")}
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
							<TableHead key={key} className="h-auto py-1.5 text-xs">
								{headers[key]}
							</TableHead>
						))}
					</TableRow>
				</TableHeader>
				<TableBody>
					{cookies.map((cookie, i) => (
						<TableRow key={String(cookie.name ?? i)}>
							{headerKeys.map((key) => (
								<TableCell key={key} className="py-1.5 text-xs">
									{String(
										cookie[
											key as keyof Pick<CookieItem, "name" | "path" | "domain" | "description">
										] ?? "\u2013"
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

function ServiceBullet() {
	return <span className="bg-muted-foreground/40 block h-2 w-2 shrink-0 rounded-full" />;
}

interface ConsentPanelProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	intro?: {
		title?: string;
		description?: string;
	};
	moreInfo?: {
		title?: string;
		description?: string;
	};
	categoryDescriptions?: Record<string, string>;
}

export function ConsentPanel({
	open,
	onOpenChange,
	intro,
	moreInfo,
	categoryDescriptions
}: ConsentPanelProps) {
	const consent = useConsent();
	const [localCategories, setLocalCategories] = useState(() =>
		Object.fromEntries(Object.entries(consent.state.categories).map(([k, v]) => [k, v.accepted]))
	);
	const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

	const categories = consent.state.categories;
	const services = consent.state.services;
	const config = consent.getConfig() as {
		services: Record<string, Record<string, ServiceConfig>>;
		categories: Record<string, { services?: Record<string, ServiceConfig> }>;
	};
	const servicesConfig = config.services ?? {};

	function toggleSection(name: string) {
		setExpandedSections((prev) => ({ ...prev, [name]: !prev[name] }));
	}

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

	function handleRejectAll() {
		consent.accept("necessary");
		onOpenChange(false);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto" showCloseButton={false}>
				<DialogHeader>
					<DialogTitle>Cookie Preferences</DialogTitle>
					<DialogDescription className="sr-only">
						Manage your cookie consent preferences by category.
					</DialogDescription>
				</DialogHeader>

				<div className="-mx-4 -mt-2 space-y-4">
					{intro && (
						<div className="px-4">
							{intro.title && <h3 className="text-sm font-medium">{intro.title}</h3>}
							{intro.description && (
								<p className="text-muted-foreground mt-1 text-xs leading-relaxed">
									{intro.description}
								</p>
							)}
						</div>
					)}

					<div className="space-y-3 px-4">
						{Object.entries(categories).map(([name, info]) => {
							const categoryServices = services[name];
							const hasServices = categoryServices && Object.keys(categoryServices).length > 0;
							const description = categoryDescriptions?.[name];
							const hasExpandableContent = !!(description || hasServices);
							const isExpanded = expandedSections[name] ?? false;
							const serviceCount = hasServices ? Object.keys(categoryServices).length : 0;

							return (
								<div
									key={name}
									className={cn(
										"rounded-xl border bg-card p-4",
										!info.readOnly && "hover:bg-accent/50 transition-colors"
									)}
								>
									<div className="flex items-center justify-between gap-3">
										<button
											type="button"
											className={cn(
												"flex min-w-0 flex-1 items-center gap-2 text-left",
												!hasExpandableContent && "cursor-default"
											)}
											onClick={hasExpandableContent ? () => toggleSection(name) : undefined}
											aria-expanded={hasExpandableContent ? isExpanded : undefined}
										>
											{hasExpandableContent && (
												<ChevronDown
													className={cn(
														"h-4 w-4 shrink-0 text-muted-foreground transition-transform",
														isExpanded && "rotate-180"
													)}
												/>
											)}
											<span
												className={cn(
													"text-sm font-medium capitalize",
													info.readOnly && "text-muted-foreground"
												)}
											>
												{name}
											</span>
											{serviceCount > 0 && (
												<span className="bg-muted inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-medium tabular-nums">
													{serviceCount}
												</span>
											)}
										</button>
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

									{isExpanded && hasExpandableContent && (
										<div className="mt-3 space-y-3 border-t pt-3">
											{description && (
												<p className="text-muted-foreground text-xs leading-relaxed">
													{description}
												</p>
											)}

											{hasServices &&
												Object.entries(categoryServices!).map(([svc]) => {
													const svcConfig = servicesConfig[name]?.[svc];
													const svcCookies = svcConfig?.cookies ?? [];

													return (
														<div key={svc} className="space-y-2">
															<div className="flex items-center justify-between gap-3">
																<div className="flex min-w-0 items-center gap-2">
																	<ServiceBullet />
																	<span className="truncate text-sm">{svc}</span>
																</div>
																<ConsentToggle
																	id={`svc-${name}-${svc}`}
																	label=""
																	checked={categoryServices![svc] ?? false}
																	readOnly={info.readOnly}
																	size="sm"
																	onCheckedChange={(checked) => {
																		if (checked) {
																			consent.acceptService(svc as never, name as never);
																		} else {
																			consent.rejectService(svc as never, name as never);
																		}
																	}}
																/>
															</div>
															{svcCookies.length > 0 && (
																<CookieTable
																	caption="Cookies"
																	headers={{
																		name: "Name",
																		description: "Description",
																		domain: "Domain"
																	}}
																	cookies={svcCookies}
																/>
															)}
														</div>
													);
												})}
										</div>
									)}
								</div>
							);
						})}
					</div>

					{moreInfo && (
						<div className="px-4">
							{moreInfo.title && <h3 className="text-sm font-medium">{moreInfo.title}</h3>}
							{moreInfo.description && (
								<p className="text-muted-foreground mt-1 text-xs leading-relaxed">
									{moreInfo.description}
								</p>
							)}
						</div>
					)}
				</div>

				<DialogFooter className="flex-col gap-2 sm:flex-row-reverse sm:justify-start">
					<Button onClick={handleAcceptAll}>Accept All</Button>
					<Button variant="outline" onClick={handleSave}>
						Save Preferences
					</Button>
					<Button variant="outline" onClick={handleRejectAll}>
						Reject All
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

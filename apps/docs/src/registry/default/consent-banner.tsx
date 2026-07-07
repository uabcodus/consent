"use client";

import { useConsent } from "@uabcodus/consent/react";
import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

interface ConsentBannerProps {
	onOpenPreferences?: () => void;
	onClose?: () => void;
	title?: string;
	description?: string;
	footerLinks?: Array<{
		text: string;
		href: string;
	}>;
}

export function ConsentBanner({
	onOpenPreferences,
	onClose,
	title = "Cookie Consent",
	description = "We use cookies to improve your browsing experience, serve personalized content, and analyze our traffic.",
	footerLinks
}: ConsentBannerProps) {
	const consent = useConsent();

	if (consent.state.skipped) return null;

	if (consent.state.valid && onOpenPreferences) {
		return (
			<div className="fixed bottom-4 left-4 z-50">
				<Button
					variant="outline"
					size="sm"
					className="rounded-full shadow-lg"
					onClick={onOpenPreferences}
				>
					Cookie Settings
				</Button>
			</div>
		);
	}

	if (consent.state.valid) return null;

	return (
		<div className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-[420px] -translate-x-1/2">
			<Card className="shadow-lg">
				<CardHeader>
					<div className="flex items-start justify-between gap-2">
						<CardTitle>{title}</CardTitle>
						{onClose && (
							<Button
								variant="ghost"
								size="icon-sm"
								className="-mt-0.5 -mr-1 shrink-0"
								onClick={onClose}
								aria-label="Close and accept necessary cookies only"
							>
								<XIcon className="h-4 w-4" />
							</Button>
						)}
					</div>
					<CardDescription>{description}</CardDescription>
				</CardHeader>
				<CardFooter className="flex-col items-stretch gap-3">
					<div className="flex flex-wrap gap-2">
						<Button onClick={() => consent.accept("all")}>Accept All</Button>
						<Button variant="outline" onClick={() => consent.accept("necessary")}>
							Reject All
						</Button>
						{onOpenPreferences && (
							<Button variant="outline" onClick={onOpenPreferences}>
								Preferences
							</Button>
						)}
					</div>
					{footerLinks && footerLinks.length > 0 && (
						<div className="flex flex-wrap gap-x-3 gap-y-1">
							{footerLinks.map((link) => (
								<a
									key={link.href}
									href={link.href}
									className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-2 transition-colors"
								>
									{link.text}
								</a>
							))}
						</div>
					)}
				</CardFooter>
			</Card>
		</div>
	);
}

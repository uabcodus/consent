"use client";

import { useConsent } from "@uabcodus/consent/react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export function ConsentBanner({ onOpenPreferences }: { onOpenPreferences?: () => void }) {
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
			<Card>
				<CardHeader>
					<CardTitle>Cookie Consent</CardTitle>
					<CardDescription>
						We use cookies to improve your browsing experience, serve personalized content, and
						analyze our traffic.
					</CardDescription>
				</CardHeader>
				<CardFooter className="flex flex-wrap gap-2">
					<Button onClick={() => consent.accept("all")}>Accept All</Button>
					<Button onClick={() => consent.accept("necessary")}>Reject All</Button>
					{onOpenPreferences && (
						<Button variant="outline" onClick={onOpenPreferences}>
							Preferences
						</Button>
					)}
				</CardFooter>
			</Card>
		</div>
	);
}

import { ConsentProvider, useConsent } from "@uabcodus/consent/react";
import { useState } from "react";

import { ConsentBanner } from "@/registry/default/consent-banner";
import { ConsentPanel } from "@/registry/default/consent-panel";

function StateDebug() {
	const consent = useConsent();
	const { valid, acceptType, categories, services } = consent.state;

	return (
		<div className="mx-auto max-w-xl space-y-2 p-4">
			<div className="flex items-center gap-2">
				<div className={`h-2 w-2 rounded-full ${valid ? "bg-green-500" : "bg-yellow-500"}`} />
				<span className="text-sm font-medium">{valid ? "Consent given" : "No consent yet"}</span>
				{acceptType && (
					<span className="bg-muted rounded-full px-2 py-0.5 text-[10px] font-medium uppercase">
						{acceptType}
					</span>
				)}
			</div>
			<pre className="bg-muted overflow-x-auto rounded-lg p-3 text-xs">
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
	const consent = useConsent();
	const [preferencesOpen, setPreferencesOpen] = useState(false);

	return (
		<div>
			<ConsentBanner
				onOpenPreferences={() => setPreferencesOpen(true)}
				onClose={() => consent.accept("necessary")}
				title="This website uses cookies"
				description="We use cookies to improve your experience, analyze site usage, and deliver personalized content. You can accept all, reject non-essential, or customize your preferences."
				footerLinks={[
					{ text: "Privacy Policy", href: "#" },
					{ text: "Terms of Service", href: "#" }
				]}
			/>

			<ConsentPanel
				open={preferencesOpen}
				onOpenChange={setPreferencesOpen}
				intro={{
					title: "Cookie Usage",
					description:
						"We use cookies and similar tracking technologies to track the activity on our website and store certain information."
				}}
				moreInfo={{
					title: "More Information",
					description:
						"For any queries regarding our cookie policy, please contact us or review our Privacy Policy."
				}}
				categoryDescriptions={{
					necessary:
						"These cookies are essential for the website to function properly and cannot be disabled.",
					analytics:
						"These cookies help us understand how visitors interact with the website, providing information about metrics such as visitor count, bounce rate, and traffic sources.",
					marketing:
						"These cookies are used to deliver advertisements that are more relevant to you and your interests."
				}}
			/>

			<div className="mx-auto max-w-xl p-4">
				<div className="flex flex-wrap gap-2">
					<button
						onClick={() => setPreferencesOpen(true)}
						className="hover:bg-muted inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border px-2.5 text-sm font-medium transition-all"
					>
						Open Preferences Panel
					</button>
					<button
						onClick={() => consent.reset()}
						className="text-destructive hover:bg-destructive/10 inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border px-2.5 text-sm font-medium transition-all"
					>
						Reset Consent
					</button>
				</div>
			</div>

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
								cookies: [
									{ name: /_ga/, description: "Used to distinguish users." },
									{ name: "_gid", description: "Used to distinguish users." }
								]
							}
						}
					},
					marketing: {
						services: {
							"Facebook Pixel": {
								cookies: [
									{
										name: "_fbp",
										description: "Used to store and track visits across websites."
									}
								]
							}
						}
					}
				}
			}}
		>
			<DemoInner />
		</ConsentProvider>
	);
}

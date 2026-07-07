import { ConsentProvider, useConsent } from "@uabcodus/consent/react";
import { useState } from "react";

import { ConsentBanner } from "@/registry/default/consent-banner";
import { ConsentPanel } from "@/registry/default/consent-panel";

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

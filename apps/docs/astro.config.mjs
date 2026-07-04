import react from "@astrojs/react";
import starlight from "@astrojs/starlight";
import tailwindcss from "@tailwindcss/vite";
// @ts-check
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: "codus/consent",
			social: [
				{
					icon: "github",
					label: "GitHub",
					href: "https://github.com/uabcodus/consent"
				}
			],
			sidebar: [
				{
					label: "Getting Started",
					items: [
						{ label: "Installation", slug: "guides/installation" },
						{ label: "Quick Start", slug: "guides/quick-start" }
					]
				},
				{
					label: "Core Concepts",
					items: [
						{ label: "How It Works", slug: "guides/how-it-works" },
						{ label: "React Integration", slug: "guides/react" },
						{
							label: "Managing Scripts",
							slug: "guides/script-management"
						},
						{
							label: "Callbacks & Events",
							slug: "guides/callbacks-events"
						}
					]
				},
				{
					label: "Advanced",
					items: [
						{
							label: "Cookie & Storage",
							slug: "guides/cookie-storage"
						},
						{
							label: "Revision Management",
							slug: "guides/revision-management"
						},
						{ label: "Presets", slug: "guides/presets" },
						{
							label: "Google Consent Mode",
							slug: "guides/google-consent-mode"
						}
					]
				},
				{
					label: "UI Components",
					items: [
						{
							label: "Registry Components",
							slug: "guides/ui-components"
						}
					]
				},
				{
					label: "Examples",
					items: [{ label: "Playground", slug: "guides/playground" }]
				},
				{
					label: "API Reference",
					items: [{ autogenerate: { directory: "reference" } }]
				}
			]
		}),
		react()
	],
	vite: {
		plugins: [tailwindcss()]
	}
});

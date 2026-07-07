"use client";

import type { CookieItem } from "@uabcodus/consent/core";

import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface ConsentTableProps {
	caption?: string;
	headers: Record<string, string>;
	cookies: Array<CookieItem>;
	className?: string;
}

const COOKIE_KEY_MAP: Record<string, keyof CookieItem> = {
	name: "name",
	path: "path",
	domain: "domain",
	description: "description"
};

export function ConsentTable({ caption, headers, cookies, className }: ConsentTableProps) {
	if (cookies.length === 0) return null;
	const headerKeys = Object.keys(headers);

	return (
		<div className={cn("mt-2", className)}>
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
							{headerKeys.map((key) => {
								const cookieKey = COOKIE_KEY_MAP[key] ?? key;
								return (
									<TableCell key={key} className="py-1.5 text-xs">
										{String(
											cookie[
												cookieKey as keyof Pick<
													CookieItem,
													"name" | "path" | "domain" | "description"
												>
											] ?? "\u2013"
										)}
									</TableCell>
								);
							})}
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}

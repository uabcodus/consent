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

interface ConsentTableProps {
	caption?: string;
	headers: Record<string, string>;
	cookies: Array<CookieItem>;
}

export function ConsentTable({ caption, headers, cookies }: ConsentTableProps) {
	if (cookies.length === 0) return null;
	const headerKeys = Object.keys(headers);

	return (
		<div className="mt-2">
			{caption && <p className="text-muted-foreground mb-2 text-xs font-medium">{caption}</p>}
			<Table>
				<TableHeader>
					<TableRow>
						{headerKeys.map((key) => (
							<TableHead key={key}>{headers[key]}</TableHead>
						))}
					</TableRow>
				</TableHeader>
				<TableBody>
					{cookies.map((cookie, i) => (
						<TableRow key={String(cookie.name ?? i)}>
							{headerKeys.map((key) => (
								<TableCell key={key}>
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

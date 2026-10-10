// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).

/** Joins class list parts, dropping falsy values. Port of upstream `cn` (without tailwind-merge). */
export function cn(...parts: Array<string | false | null | undefined>): string {
	return parts.filter(Boolean).join(' ');
}

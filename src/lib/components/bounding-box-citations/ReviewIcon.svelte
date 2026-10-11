<!--
	MIT License — Svelte 5 port of Extend UI bounding-box-citations. Upstream: extend-hq/ui (MIT).
	Inline Lucide glyphs standing in for upstream's IconPlaceholder icons.
-->
<script module lang="ts">
	export type ReviewIconName =
		| 'hash'
		| 'text-cursor-input'
		| 'brackets'
		| 'square-code'
		| 'captions'
		| 'undo'
		| 'circle-x'
		| 'chevron-left';
</script>

<script lang="ts">
	let { name, size = 16 }: { name: ReviewIconName; size?: number } = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="2"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	focusable="false"
>
	{#if name === 'hash'}
		<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" />
	{:else if name === 'text-cursor-input'}
		<path d="M5 4h1a3 3 0 0 1 3 3 3 3 0 0 1 3-3h1" />
		<path d="M13 20h-1a3 3 0 0 1-3-3 3 3 0 0 1-3 3H5" />
		<path d="M5 16H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h1" />
		<path d="M13 8h7a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-7" />
		<path d="M9 7v10" />
	{:else if name === 'brackets'}
		<path d="M16 3h3v18h-3M8 21H5V3h3" />
	{:else if name === 'square-code'}
		<path d="m10 9-3 3 3 3M14 15l3-3-3-3" />
		<rect x="3" y="3" width="18" height="18" rx="2" />
	{:else if name === 'captions'}
		<rect x="3" y="5" width="18" height="14" rx="2" />
		<path d="M7 15h4M15 15h2M7 11h2M13 11h4" />
	{:else if name === 'undo'}
		<path d="M9 14 4 9l5-5" />
		<path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
	{:else if name === 'circle-x'}
		<circle cx="12" cy="12" r="10" />
		<path d="m15 9-6 6M9 9l6 6" />
	{:else}
		<path d="m15 18-6-6 6-6" />
	{/if}
</svg>

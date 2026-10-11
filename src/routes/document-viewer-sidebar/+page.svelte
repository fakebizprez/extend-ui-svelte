<!--
	MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
	Docs preview for document-viewer-sidebar. Mirrors upstream
	apps/v4/components/document-viewer-sidebar-docs.tsx (DocumentViewerSidebarPreview),
	including its placeholder thumbnail and page cards.
-->
<script lang="ts">
	import { docsTheme } from '../_shell/theme.svelte.js';
	import {
		DocumentViewerSidebarSkeleton,
		DocumentViewerThumbnailSidebar,
		useElementWidth,
		useInlineThumbnailSidebar
	} from '#lib/components/document-viewer-sidebar/index.js';

	const demoPages = [
		{ id: 1, label: 'Invoice summary' },
		{ id: 2, label: 'Line items' },
		{ id: 3, label: 'Approval trail' },
		{ id: 4, label: 'Exception notes' }
	] as const;

	const viewerShell = useElementWidth<HTMLDivElement>();
	const sidebarInline = $derived(useInlineThumbnailSidebar(viewerShell.width));
	let sidebarOpen = $state(true);
	let activePageId = $state(1);
	let isDark = $derived(docsTheme.isDark);
	const activePage = $derived(demoPages.find((page) => page.id === activePageId) ?? demoPages[0]);
</script>

<h1>Document Viewer Sidebar</h1>
<p>
	Shared responsive thumbnail sidebar for document viewers: inline beside the page when the viewer is
	at least 768px wide, an overlay on narrower viewers.
</p>

<!-- The theme toggle lives on the page; the components only reflect isDark. -->
<p>
	<button type="button" aria-pressed={isDark} onclick={() => (isDark = !isDark)}>Dark mode</button>
</p>

<div class="preview" class:dark={isDark}>
	<div class="shell">
		<div class="toolbar">
			<div class="toolbar-start">
				<button
					type="button"
					class="icon-button"
					aria-label="Toggle thumbnails"
					data-pressed={sidebarOpen ? '' : undefined}
					onclick={() => (sidebarOpen = !sidebarOpen)}
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
						<rect x="2.5" y="3.5" width="19" height="17" rx="3.5" />
						<path d="M9 3.5v17M5.5 7.5h1M5.5 10.5h1" stroke-linecap="round" />
					</svg>
				</button>
				<div class="page-count">Page {activePage.id} of {demoPages.length}</div>
			</div>
			<div class="mode-label">{sidebarInline ? 'Inline thumbnails' : 'Overlay thumbnails'}</div>
		</div>
		<div class="viewer" {@attach viewerShell.ref}>
			{#if !sidebarOpen}
				<DocumentViewerSidebarSkeleton inline={sidebarInline} {isDark} />
			{/if}
			<DocumentViewerThumbnailSidebar inline={sidebarInline} open={sidebarOpen} {isDark}>
				<div class="thumbnail-scroll">
					<div class="thumbnail-list">
						{#each demoPages as page (page.id)}
							<button
								type="button"
								class="thumbnail-button"
								class:active={page.id === activePageId}
								onclick={() => (activePageId = page.id)}
							>
								<div class="thumbnail" class:active={page.id === activePageId}>
									<div class="bar title"></div>
									<div class="lines">
										<div class="bar line"></div>
										<div class="bar line short"></div>
										<div class="bar line"></div>
									</div>
									<div class="cells">
										<div></div>
										<div></div>
										<div></div>
										<div></div>
									</div>
								</div>
								{page.id}
							</button>
						{/each}
					</div>
				</div>
			</DocumentViewerThumbnailSidebar>
			<!-- svelte-ignore a11y_no_noninteractive_tabindex (the document scroll area needs keyboard scrolling) -->
			<div class="content" data-testid="viewer-content" tabindex="0">
				<div class="document">
					<div class="page">
						<div class="bar page-kicker"></div>
						<div class="bar page-title"></div>
						<div class="page-lines">
							<div class="bar page-line"></div>
							<div class="bar page-line"></div>
							<div class="bar page-line short"></div>
						</div>
						<div class="page-cells">
							<div></div>
							<div></div>
							<div></div>
							<div></div>
						</div>
						<div class="page-caption">Page {activePage.id}: {activePage.label}</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

<h2>Differences from upstream</h2>
<ul>
	<li>
		<code>useElementWidth()</code> returns <code>{'{ ref, width }'}</code>, where <code>ref</code> is a
		Svelte attachment (<code>{'{@attach shell.ref}'}</code>) and <code>width</code> is reactive, instead
		of a React <code>[ref, width]</code> tuple.
	</li>
	<li><code>class</code> is accepted alongside <code>className</code>; both are merged.</li>
	<li><code>children</code> is a Svelte snippet instead of ReactNode.</li>
	<li>
		The undocumented Tailwind class props <code>widthClassName</code> and
		<code>closedInlineClassName</code> are not ported; the sidebar is fixed at upstream's default 10rem.
	</li>
	<li>
		Each component takes <code>isDark</code> from the parent instead of inheriting a
		<code>.dark</code> ancestor class; <code>onIsDarkChange</code> is accepted and never called.
	</li>
	<li>The demo's sidebar icon is an inline SVG instead of Hugeicons.</li>
	<li>Port-only export: <code>INLINE_THUMBNAIL_SIDEBAR_MIN_WIDTH</code>, the shell width at which the sidebar switches from overlay to inline (upstream keeps it private).</li>
</ul>

<p><a href="/">Back to overview</a></p>

<style>
	.preview {
		--background: oklch(1 0 0);
		--foreground: oklch(0.269 0 0);
		--muted: rgb(0 0 0 / 4%);
		--muted-foreground: color-mix(in srgb, oklch(0.556 0 0) 90%, black);
		--border: rgb(0 0 0 / 8%);
		--ring: oklch(0.708 0 0);
		--sidebar-accent: rgb(0 0 0 / 4%);
		background: var(--background);
		color: var(--foreground);
		padding: 1rem;
		border: 1px solid var(--border);
		border-radius: 0.75rem;
	}

	.preview.dark {
		--background: oklch(0.145 0 0);
		--foreground: oklch(0.97 0 0);
		--muted: rgb(255 255 255 / 4%);
		--muted-foreground: color-mix(in srgb, oklch(0.556 0 0) 90%, white);
		--border: rgb(255 255 255 / 6%);
		--ring: oklch(0.556 0 0);
		--sidebar-accent: rgb(255 255 255 / 4%);
	}

	.shell {
		margin-inline: auto;
		display: flex;
		flex-direction: column;
		height: 460px;
		max-width: 56rem;
		overflow: hidden;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		background: var(--background);
	}

	.toolbar {
		display: flex;
		min-height: 3rem;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		border-bottom: 1px solid var(--border);
		padding-inline: 0.75rem;
	}

	.toolbar-start {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.icon-button {
		display: inline-grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		border: 0;
		border-radius: 0.5rem;
		background: transparent;
		color: inherit;
		cursor: pointer;
	}

	.icon-button:hover,
	.icon-button[data-pressed] {
		background: var(--muted);
	}

	.icon-button svg {
		width: 1rem;
		height: 1rem;
	}

	.page-count {
		font-size: 0.875rem;
		white-space: nowrap;
	}

	.mode-label {
		display: none;
		font-size: 0.75rem;
		color: var(--muted-foreground);
	}

	.viewer {
		position: relative;
		display: flex;
		min-height: 0;
		flex: 1;
		overflow: hidden;
		background: color-mix(in srgb, var(--muted) 30%, transparent);
	}

	.thumbnail-scroll {
		height: 100%;
		box-sizing: border-box;
		overflow: auto;
		padding: 1rem;
	}

	.thumbnail-list {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
	}

	.thumbnail-button {
		display: flex;
		width: 100%;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		border: 0;
		border-radius: 0.5rem;
		background: transparent;
		color: var(--muted-foreground);
		font: inherit;
		font-size: 0.75rem;
		cursor: pointer;
	}

	.thumbnail-button:hover,
	.thumbnail-button.active {
		background: var(--sidebar-accent);
	}

	.thumbnail-button.active {
		color: var(--foreground);
	}

	.thumbnail {
		box-sizing: border-box;
		height: 7rem;
		width: 5rem;
		overflow: hidden;
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		background: var(--background);
		padding: 0.5rem;
		box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
		transition: box-shadow 150ms;
	}

	.thumbnail.active {
		box-shadow:
			0 0 0 2px color-mix(in srgb, var(--ring) 32%, transparent),
			0 1px 3px 0 rgb(0 0 0 / 0.1);
	}

	.bar {
		border-radius: 9999px;
	}

	.title {
		margin-bottom: 0.5rem;
		height: 0.5rem;
		width: 2rem;
		background: color-mix(in srgb, var(--muted-foreground) 24%, transparent);
	}

	.lines {
		display: grid;
		gap: 0.375rem;
	}

	.line {
		height: 0.375rem;
		background: color-mix(in srgb, var(--muted-foreground) 20%, transparent);
	}

	.line.short {
		width: 2.5rem;
	}

	.cells {
		margin-top: 1rem;
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.25rem;
	}

	.cells > div {
		height: 1.25rem;
		border-radius: 0.25rem;
		background: var(--muted);
	}

	.content {
		min-width: 0;
		flex: 1;
		overflow: auto;
	}

	.document {
		margin-inline: auto;
		display: flex;
		min-height: 100%;
		box-sizing: border-box;
		width: 100%;
		max-width: 520px;
		align-items: flex-start;
		justify-content: center;
		padding: 1.5rem;
	}

	.page {
		box-sizing: border-box;
		width: 100%;
		border: 1px solid var(--border);
		border-radius: 0.125rem;
		background: var(--background);
		padding: 2rem;
		box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
	}

	.page-kicker {
		height: 0.5rem;
		width: 5rem;
		background: color-mix(in srgb, var(--muted-foreground) 24%, transparent);
	}

	.page-title {
		margin-top: 1.25rem;
		height: 1.25rem;
		width: 66.666%;
		background: color-mix(in srgb, var(--foreground) 12%, transparent);
	}

	.page-lines {
		margin-top: 1.5rem;
		display: grid;
		gap: 0.5rem;
	}

	.page-line {
		height: 0.5rem;
		background: color-mix(in srgb, var(--muted-foreground) 16%, transparent);
	}

	.page-line.short {
		width: 80%;
	}

	.page-cells {
		margin-top: 2rem;
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.75rem;
	}

	.page-cells > div {
		height: 5rem;
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		background: color-mix(in srgb, var(--muted) 40%, transparent);
	}

	.page-caption {
		margin-top: 1.5rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--muted-foreground);
	}

	@media (min-width: 640px) {
		.preview {
			padding: 1.5rem;
		}

		.mode-label {
			display: block;
		}
	}
</style>

<script lang="ts">
	import { NAV_GROUPS, type NavGroup } from './_shell/nav';

	const GROUP_META: Record<string, { tagline: string }> = {
		files: {
			tagline: 'Upload, file preview tiles, and file tree navigation.'
		},
		viewers: {
			tagline: 'Zero-install virtualized document readers with zoom & search.'
		},
		editors: {
			tagline: 'In-browser document editing, annotation, and digital signatures.'
		},
		data: {
			tagline: 'Document segmentation, schemas, block layout, and citations.'
		},
		primitives: {
			tagline: 'Foundational controls and theme building blocks.'
		}
	};

	const COMPONENT_TAGS: Record<string, string> = {
		'file-upload': 'upload',
		'file-thumbnail': 'preview',
		'file-system': 'tree',
		'document-viewer-sidebar': 'shell',
		'pdf-viewer': 'pdf',
		'docx-viewer': 'docx',
		'xlsx-viewer': 'xlsx',
		'pptx-viewer': 'pptx',
		'csv-tsv-viewer': 'csv',
		'pdf-editor': 'pdf',
		'docx-editor': 'docx',
		'xlsx-editor': 'xlsx',
		'e-signature': 'canvas',
		'document-splits': 'ranges',
		'schema-builder': 'schema',
		'layout-blocks': 'blocks',
		'bounding-box-citations': 'bounds',
		group: 'layout',
		'color-picker': 'picker',
		toggle: 'button'
	};

	// Column 1: Files (3) + Viewers (6) = 9 items (Document intake & reading)
	// Column 2: Editors (4) + Data & layout (4) + Primitives (3) = 11 items (Editing, data & primitives)
	const col1Groups = NAV_GROUPS.filter((g) => ['files', 'viewers'].includes(g.id));
	const col2Groups = NAV_GROUPS.filter((g) => ['editors', 'data', 'primitives'].includes(g.id));
</script>

{#snippet groupCard(group: NavGroup)}
	<section class="home-card" data-group={group.id}>
		<header class="card-header">
			<div class="header-top">
				<div class="title-wrap">
					<span class="group-icon" aria-hidden="true">
						{#if group.id === 'files'}
							<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
								<path d="M2 10h20" />
							</svg>
						{:else if group.id === 'viewers'}
							<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
								<circle cx="12" cy="12" r="3" />
							</svg>
						{:else if group.id === 'editors'}
							<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
								<path d="m15 5 4 4" />
							</svg>
						{:else if group.id === 'data'}
							<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<rect width="18" height="18" x="3" y="3" rx="0" />
								<path d="M3 9h18" />
								<path d="M9 21V9" />
							</svg>
						{:else}
							<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<rect width="7" height="7" x="3" y="3" rx="0" />
								<rect width="7" height="7" x="14" y="3" rx="0" />
								<rect width="7" height="7" x="14" y="14" rx="0" />
								<rect width="7" height="7" x="3" y="14" rx="0" />
							</svg>
						{/if}
					</span>
					<h3 id={group.id}>{group.title}</h3>
				</div>
				<span class="group-count">{group.items.length.toString().padStart(2, '0')}</span>
			</div>
			{#if GROUP_META[group.id]?.tagline}
				<p class="group-tagline">{GROUP_META[group.id].tagline}</p>
			{/if}
		</header>

		<ul class="component-list">
			{#each group.items as item (item.slug)}
				<li class="component-list-item">
					<a href="/{item.slug}" class="component-row" aria-label={item.title}>
						<div class="row-header">
							<span class="row-title">{item.title}</span>
							<div class="row-badges">
								{#if COMPONENT_TAGS[item.slug]}
									<span class="row-tag" aria-hidden="true">{COMPONENT_TAGS[item.slug]}</span>
								{/if}
								<span class="row-arrow" aria-hidden="true">→</span>
							</div>
						</div>
						<p class="row-desc" aria-hidden="true">{item.description}</p>
					</a>
				</li>
			{/each}
		</ul>
	</section>
{/snippet}

<article class="docs-prose">
	<h1>Extend UI <span class="accent">Svelte</span></h1>
	<p>
		A Svelte 5 port of <a href="https://github.com/extend-hq/ui">extend-hq/ui</a>: viewers and
		editors for PDF, DOCX, XLSX, PPTX and CSV, plus file upload, thumbnails, a file system, document
		splits, a schema builder, layout blocks, bounding-box citations, e-signature and primitives.
	</p>

	<h2 id="install">Install</h2>
	<ol>
		<li>
			Most components are a copy-in registry in the shadcn-svelte style: add one with
			<code>npx shadcn-svelte add</code> and the component's registry URL, then edit the source in
			your app.
		</li>
		<li>
			The heavy viewers and editors also ship as the <code>extend-ui-svelte</code> npm package:
			<code>bun add extend-ui-svelte</code>.
		</li>
		<li>
			Import a component from <code>extend-ui-svelte/components/&lt;name&gt;</code>. Dark mode is
			controlled by the parent through <code>isDark</code> and <code>onIsDarkChange</code>.
		</li>
	</ol>

	<div class="components-header">
		<h2 id="components">Components</h2>
		<p class="section-intro">
			20 document-heavy components across 5 functional categories. Built with Svelte 5 runes,
			virtualized rendering, and strict parent-controlled dark mode.
		</p>
	</div>

	<div class="home-grid">
		<div class="grid-col">
			{#each col1Groups as group (group.id)}
				{@render groupCard(group)}
			{/each}
		</div>
		<div class="grid-col">
			{#each col2Groups as group (group.id)}
				{@render groupCard(group)}
			{/each}
		</div>
	</div>

	<h2 id="license">License</h2>
	<p>
		MIT. Ported from <a href="https://github.com/extend-hq/ui">extend-hq/ui</a> (MIT); each ported
		component credits the upstream project in its header.
	</p>
</article>

<style>
	.components-header {
		margin-top: 3rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--lh-border);
	}
	.components-header h2 {
		margin: 0 0 0.5rem;
		padding-top: 0;
		border-top: none;
	}
	.section-intro {
		margin: 0 0 1.5rem;
		color: var(--lh-muted);
		max-width: 44rem;
		font-family: var(--lh-mono);
		font-size: 0.8125rem;
		line-height: 1.6;
	}

	.home-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1.5rem;
		align-items: start;
	}
	@media (min-width: 48rem) {
		.home-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	.grid-col {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		min-width: 0;
	}

	.home-card {
		min-width: 0;
		padding: 0;
		border: 1px solid var(--lh-border);
		border-radius: 0;
		background-color: var(--lh-surface);
		box-shadow: none;
		color: var(--lh-text);
		display: flex;
		flex-direction: column;
	}

	.card-header {
		padding: 1rem 1.125rem;
		border-bottom: 1px solid var(--lh-border);
		background-color: var(--lh-surface);
	}
	.header-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}
	.title-wrap {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}
	.group-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: var(--lh-blue);
		flex-shrink: 0;
	}
	.card-header :global(h3) {
		margin: 0;
		font-family: var(--lh-display);
		font-size: 1.0625rem;
		font-weight: 700;
		letter-spacing: -0.015em;
		color: var(--lh-text);
		line-height: 1.2;
	}
	.group-count {
		font-family: var(--lh-mono);
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		padding: 0.15rem 0.45rem;
		border: 1px solid var(--lh-border);
		background-color: var(--lh-bg);
		color: var(--lh-muted);
		flex-shrink: 0;
	}
	.group-tagline {
		margin: 0.375rem 0 0;
		font-family: var(--lh-mono);
		font-size: 0.6875rem;
		line-height: 1.45;
		color: var(--lh-muted);
	}

	.component-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		flex: 1;
	}
	.component-list-item {
		margin: 0;
		padding: 0;
		list-style: none;
		border-bottom: 1px solid var(--lh-border);
	}
	.component-list-item:last-child {
		border-bottom: none;
	}

	.component-row {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.75rem 1.125rem;
		color: var(--lh-text);
		text-decoration: none;
		background: transparent;
		transition: background-color 0.12s ease;
	}
	/* Override default .docs-prose a styling */
	.home-card :global(a) {
		text-decoration: none;
	}
	.home-card :global(a:hover) {
		background: var(--lh-hover);
		text-decoration: none;
	}

	.row-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.row-title {
		font-family: var(--lh-display);
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--lh-text);
		line-height: 1.3;
		transition: color 0.12s ease;
	}
	.row-badges {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		flex-shrink: 0;
		margin-top: 0.1rem;
	}
	.row-tag {
		font-family: var(--lh-mono);
		font-size: 0.5625rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		padding: 0.1rem 0.35rem;
		border: 1px solid var(--lh-border);
		background-color: var(--lh-bg);
		color: var(--lh-muted);
		text-transform: uppercase;
		line-height: 1.1;
		flex-shrink: 0;
		transition: border-color 0.12s ease, color 0.12s ease;
	}
	.row-arrow {
		font-family: var(--lh-mono);
		font-size: 0.8125rem;
		color: var(--lh-muted);
		flex-shrink: 0;
		transition: transform 0.15s ease, color 0.15s ease;
	}
	.row-desc {
		margin: 0;
		font-family: var(--lh-mono);
		font-size: 0.6875rem;
		line-height: 1.45;
		color: var(--lh-muted);
		max-width: none;
	}

	.component-row:hover .row-title {
		color: var(--lh-blue);
	}
	.component-row:hover .row-arrow {
		transform: translateX(4px);
		color: var(--lh-blue);
	}
	.component-row:hover .row-tag {
		border-color: var(--lh-blue);
		color: var(--lh-blue);
	}
	.component-row:focus-visible {
		outline: 2px solid var(--lh-blue);
		outline-offset: -2px;
	}
</style>

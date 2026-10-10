<!-- MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT). -->
<script lang="ts">
	import { onMount } from 'svelte';
	import type { DocxRenderResult, DocxSource } from '#lib/engines/docx/index.js';

	const FIXTURE_URL = '/fixtures/sample.docx';

	declare global {
		interface Window {
			__docxHarness?: { render: (bytes: number[]) => Promise<DocxRenderResult> };
		}
	}

	type EngineModule = typeof import('#lib/engines/docx/index.js');

	let engine = $state<EngineModule | null>(null);
	let containerEl = $state<HTMLDivElement | null>(null);
	let status = $state<'loading' | 'ready' | 'error'>('loading');
	let error = $state('');
	let showThumbnails = $state(false);

	async function renderSource(source: DocxSource): Promise<DocxRenderResult> {
		if (!engine || !containerEl) {
			throw new Error('DOCX harness is not ready yet.');
		}
		const result = await engine.renderDocx(source, containerEl, { showThumbnails });
		showThumbnails = result.showThumbnails;
		status = 'ready';
		return result;
	}

	onMount(async () => {
		try {
			// Client-only: the engine (and docx-preview inside it) loads via dynamic import.
			engine = await import('#lib/engines/docx/index.js');
			showThumbnails = new URLSearchParams(window.location.search).get('thumbnails') === '1';
			window.__docxHarness = {
				render: (bytes: number[]) => renderSource(new Uint8Array(bytes))
			};
			await renderSource(FIXTURE_URL);
		} catch (loadError) {
			error = loadError instanceof Error ? loadError.message : String(loadError);
			status = 'error';
		}
	});
</script>

<h1>DOCX Engine Harness</h1>
<p>Renders <code>{FIXTURE_URL}</code> through the docx engine wrapper.</p>

{#if status === 'loading'}
	<p>Loading document…</p>
{:else if status === 'error'}
	<p data-testid="docx-error">Failed to render document: {error}</p>
{/if}

<div class="viewer">
	{#if showThumbnails}
		<aside data-testid="docx-thumbnails">
			<h2>Thumbnails</h2>
			<p>Sidebar visible (showThumbnails flag on).</p>
		</aside>
	{/if}
	<div data-testid="docx-container" bind:this={containerEl}></div>
</div>

<p><a href="/">Back to all components</a></p>

<style>
	.viewer {
		display: flex;
		gap: 1rem;
	}
	aside {
		flex: 0 0 12rem;
		border: 1px solid currentColor;
		padding: 0.5rem 1rem;
	}
</style>

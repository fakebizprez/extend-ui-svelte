<!-- MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT). -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { DocumentSplits, createInitialSplits, type DocumentSplit } from '#lib/components/document-splits/index.js';

	const PDF_URL = '/fixtures/sample.pdf';

	let isDark = $state(false);
	let pageCount = $state(0);
	let loadError = $state<string | null>(null);
	let splits = $state<DocumentSplit[]>(createInitialSplits(0));
	let selectedPage = $state<number | null>(null);

	onMount(() => {
		let cancelled = false;

		async function loadPageCount(): Promise<void> {
			try {
				const { createPdfEngine } = await import('#lib/engines/pdf/index.js');
				const engine = createPdfEngine();
				try {
					const count = await engine.load(PDF_URL);
					if (!cancelled) {
						pageCount = count;
						splits = createInitialSplits(count);
					}
				} finally {
					await engine.destroy();
				}
			} catch (error) {
				if (!cancelled) {
					loadError = error instanceof Error ? error.message : String(error);
				}
			}
		}

		void loadPageCount();

		return () => {
			cancelled = true;
		};
	});
</script>

<h1>Document Splits</h1>
<p>
	Organize long documents into named splits. Drag pages between groups, reorder groups with
	the handles, or use the move, split, and remove controls. Dark mode is controlled by the
	parent through <code>isDark</code> plus <code>onIsDarkChange</code>.
</p>
<p>
	<label>
		<input type="checkbox" bind:checked={isDark} />
		Dark mode
	</label>
</p>

{#if loadError}
	<p role="alert">Could not load the sample PDF: {loadError}</p>
{:else if pageCount === 0}
	<p>Loading the sample PDF…</p>
{:else}
	<p>Sample PDF: {pageCount} pages</p>
{/if}

<div class="preview-frame">
	<DocumentSplits
		bind:splits
		activePage={selectedPage}
		pdfUrl={PDF_URL}
		{isDark}
		onIsDarkChange={(value: boolean) => (isDark = value)}
		onSelectPage={(pageNumber: number) => (selectedPage = pageNumber)}
		onSplitsChange={(next: DocumentSplit[]) => (splits = next)}
	/>
</div>

{#if selectedPage !== null}
	<p>Selected page: {selectedPage}</p>
{/if}

<p><a href="/">Back to all components</a></p>

<style>
	.preview-frame {
		height: 32rem;
		border: 1px solid #e4e4e7;
		border-radius: 0.5rem;
		overflow: hidden;
	}
</style>

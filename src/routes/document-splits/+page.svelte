<!-- MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT). -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { DocumentSplits, createInitialSplits, type DocumentSplit } from '#lib/components/document-splits/index.js';

	const PDF_URL = '/fixtures/sample.pdf';

	let isDark = $state(false);
	let pageCount = $state(0);
	let loadError = $state<string | null>(null);
	let splits = $state<DocumentSplit[]>(createInitialSplits(0));
	// 0 means no page is selected yet.
	let selectedPage = $state(0);

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
	parent through <code>isDark</code>; the checkbox below is the page's own control.
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
		onSelectPage={(pageNumber: number) => (selectedPage = pageNumber)}
		onSplitsChange={(next: DocumentSplit[]) => (splits = next)}
	/>
</div>

{#if selectedPage > 0}
	<p>Selected page: {selectedPage}</p>
{/if}

<section aria-labelledby="differences-from-upstream">
	<h2 id="differences-from-upstream">Differences from upstream</h2>
	<ul>
		<li>
			Same export name, <code>DocumentSplits</code>. <code>class</code> is accepted alongside the
			upstream <code>className</code>. <code>splits</code>, <code>activePage</code>,
			<code>onSelectPage</code>, and <code>onSplitsChange</code> are required, as in the upstream
			API table; <code>bind:splits</code> also works.
		</li>
		<li>
			Native HTML5 drag-and-drop replaces dnd-kit, and every drag has a button equivalent (move
			up/down/left/right, move to the previous/next split) for keyboard use.
		</li>
		<li>
			<code>activePage</code> highlights that page (<code>0</code> for none); the upstream
			component lists the prop but does not render it.
		</li>
		<li>
			Port additions: rename a split through its title input, split a group in two at the
			midpoint, remove a split, and <code>pdfUrl</code>, which renders each page lazily through
			FileThumbnail when <code>thumbnailImages</code> has no cached image for it.
		</li>
		<li>
			Dark mode is set by the parent through <code>isDark</code>; there is no theme switch inside
			the component.
		</li>
	</ul>
</section>

<p><a href="/">Back to all components</a></p>

<style>
	.preview-frame {
		height: 32rem;
		border: 1px solid #e4e4e7;
		border-radius: 0.5rem;
		overflow: hidden;
	}
</style>

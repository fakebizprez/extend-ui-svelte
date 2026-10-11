<!-- MIT License — Svelte 5 port of Extend UI pdf-viewer. Upstream: extend-hq/ui (MIT). -->
<!-- Test-only composition host for the pageOverlay snippet. Not exported from the barrel. -->
<script lang="ts">
	import PdfViewer, { type PdfViewerProps } from './PdfViewer.svelte';

	let { ...rest }: PdfViewerProps = $props();
</script>

<PdfViewer {...rest}>
	{#snippet pageOverlay(overlay)}
		<span data-testid="test-overlay"
			>Overlay page {overlay.pageNumber} @ {overlay.scale}x, {overlay.pageWidth}x{overlay.pageHeight} r{overlay.rotation}</span
		>
	{/snippet}
</PdfViewer>

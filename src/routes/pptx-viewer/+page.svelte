<!-- MIT License — Svelte 5 port of Extend UI pptx-viewer. Upstream: extend-hq/ui (MIT). -->
<script lang="ts">
	import PptxViewer from '../../lib/components/pptx-viewer/PptxViewer.svelte';
	import deckUrl from '../../../tests/fixtures/sample.pptx?url';

	let isDark = $state(false);
</script>

<h1>PPTX Viewer</h1>
<p>
	Svelte 5 port of the Extend UI pptx-viewer. Slides render on the client through the
	pptx-browser engine wrapper, virtualized with the shared virtual list.
</p>

<PptxViewer
	src={deckUrl}
	fileName="sample.pptx"
	isDark={isDark}
	onIsDarkChange={(value) => (isDark = value)}
/>

<p><a href="/">Back to all components</a></p>

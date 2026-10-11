<!-- MIT License — Svelte 5 port of Extend UI pptx-viewer. Upstream: extend-hq/ui (MIT). -->
<script lang="ts">
	import PptxViewer from '../../lib/components/pptx-viewer/PptxViewer.svelte';

	// Served from static/, like the other viewer fixtures.
	const deckUrl = '/fixtures/sample.pptx';

	let isDark = $state(false);
</script>

<h1>PPTX Viewer</h1>
<p>
	Svelte 5 port of the Extend UI pptx-viewer. Slides render on the client through the
	pptx-browser engine wrapper, virtualized with the shared virtual list.
</p>

<p>
	<label>
		<input type="checkbox" bind:checked={isDark} />
		Dark mode
	</label>
</p>

<PptxViewer src={deckUrl} fileName="sample.pptx" {isDark} />

<section aria-labelledby="differences-from-upstream">
	<h2 id="differences-from-upstream">Differences from upstream</h2>
	<ul>
		<li>Upstream exports <code>PptxViewerPreview</code> and <code>PptxViewerPreviewProps</code>; both are available here, plus <code>PptxViewer</code> and <code>PptxViewerProps</code>.</li>
		<li>
			Exported as both <code>PptxViewer</code> and the upstream name
			<code>PptxViewerPreview</code>; <code>className</code> and <code>class</code> are both
			accepted.
		</li>
		<li>
			Slides render with the pptx-browser engine instead of <code>@extend-ai/react-pptx</code>
			(React-only), as one virtualized list.
		</li>
		<li>
			Not ported: <code>defaultZoom</code> and the zoom controls, the thumbnail sidebar
			(<code>defaultThumbnailSidebarOpen</code>), and slide navigation
			(<code>initialSlide</code>, jump to slide, keyboard navigation).
		</li>
		<li>
			Upload accepts <code>.pptx</code> only; legacy <code>.ppt</code> files cannot be read by
			the engine.
		</li>
		<li><code>toolbarActions</code> is a Svelte snippet instead of a React node.</li>
		<li>
			Dark mode is set by the parent through <code>isDark</code> (upstream follows the app
			theme). The viewer has no theme switch of its own, so <code>onIsDarkChange</code> is never
			called.
		</li>
		<li>
			Port additions: <code>height</code>, <code>slideHeight</code>, <code>slideWidth</code>,
			and <code>overscan</code> size the fixed-row virtual list.
		</li>
	</ul>
</section>

<p><a href="/">Back to all components</a></p>

<!-- MIT License — Svelte 5 port of Extend UI docx-viewer. Upstream: extend-hq/ui (MIT). -->
<script lang="ts">
	import { docsTheme } from '../_shell/theme.svelte.js';
	import DocxViewer from '#lib/components/docx-viewer/DocxViewer.svelte';

	let isDark = $derived(docsTheme.isDark);
</script>

<h1>DOCX Viewer</h1>
<p>
	Svelte 5 port of the Extend UI docx-viewer. Rendering runs on the client through the docx
	engine wrapper (docx-preview); the thumbnail sidebar is virtualized.
</p>

<DocxViewer
	src="/fixtures/sample.docx"
	fileName="sample.docx"
	isDark={isDark}
	onIsDarkChange={(value) => (isDark = value)}
/>

<section aria-labelledby="differences-from-upstream">
	<h2 id="differences-from-upstream">Differences from upstream</h2>
	<ul>
		<li>Upstream exports only <code>DocxViewerPreview</code>; every upstream export is available here.</li>
		<li>
			Exported as both <code>DocxViewer</code> and the upstream name
			<code>DocxViewerPreview</code>; <code>className</code> and <code>class</code> are both
			accepted.
		</li>
		<li>
			Pages render with docx-preview instead of <code>@extend-ai/react-docx</code> (React-only):
			comments, tracked changes, and the outline/section anchors are not shown.
		</li>
		<li>
			The thumbnail sidebar lists page numbers with text excerpts instead of canvas page
			images, and stays inline instead of collapsing into an overlay on narrow widths.
		</li>
		<li>
			<code>defaultZoom</code> takes the same values (default 50). The fit modes are resolved
			from the first page; <code>"automatic"</code> fits the width but never enlarges past 100%.
		</li>
		<li>
			docx-preview builds the DOM for every page. Pages away from the viewport skip layout and
			paint through <code>content-visibility: auto</code>, instead of upstream's windowed page
			rendering.
		</li>
		<li>
			The page number is editable like upstream; the Previous and Next page buttons are a port
			addition.
		</li>
		<li>
			Hyperlinks keep only <code>http</code>, <code>https</code>, <code>mailto</code>,
			<code>tel</code>, and <code>#</code> targets; any other target is removed, so the link
			shows as plain text. Picture sources keep only embedded <code>data:image</code> and
			<code>blob:</code> URLs. Scripts, frames, embedded objects, and event-handler attributes
			in the rendered document are stripped.
		</li>
		<li><code>toolbarActions</code> is a Svelte snippet instead of a React node.</li>
		<li>
			Legacy <code>.doc</code> files are accepted by the upload input, but docx-preview cannot
			render them; convert them to DOCX.
		</li>
	</ul>
</section>

<p><a href="/">Back to overview</a></p>

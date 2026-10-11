<!-- MIT License — Svelte 5 port of Extend UI docx-editor. Upstream: extend-hq/ui (MIT). -->
<script lang="ts">
	import DocxEditor from '#lib/components/docx-editor/DocxEditor.svelte';

	let isDark = $state(false);
</script>

<h1>DOCX Editor</h1>
<p>
	Svelte 5 port of the Extend UI docx-editor: a native contenteditable surface with a
	word-style toolbar. The source document loads through the docx engine wrapper
	(docx-preview) and exports back to .docx bytes with jszip.
</p>

<DocxEditor
	src="/fixtures/sample.docx"
	fileName="sample.docx"
	isDark={isDark}
	onIsDarkChange={(value) => (isDark = value)}
/>

<section aria-labelledby="differences-from-upstream">
	<h2 id="differences-from-upstream">Differences from upstream</h2>
	<ul>
		<li>Upstream exports only <code>DocxEditorPreview</code>; every upstream export is available here.</li>
		<li>
			Exported as both <code>DocxEditor</code> and the upstream name
			<code>DocxEditorPreview</code>; <code>className</code> and <code>class</code> are both
			accepted.
		</li>
		<li>
			Editing is a native contenteditable surface instead of the
			<code>@extend-ai/react-docx</code> editor (React-only). The toolbar is reduced to bold,
			italic, headings, bulleted and numbered lists, zoom, upload, export, and the theme switch.
			Undo/redo buttons, fonts, color, highlight, links, alignment, borders, images, tables,
			tracked changes, comments, the read-only toggle, and the page thumbnail rail are not
			ported.
		</li>
		<li>
			The whole document is one editable surface: pages are not split out or virtualized, and
			there is no "Page N of M" indicator. Uploads accept <code>.docx</code> only, like
			upstream.
		</li>
		<li>
			Export is lossy: it rebuilds a minimal .docx from paragraphs, headings, lists, and
			bold/italic runs. Tables, images, styles, headers, and footers from the source are
			dropped.
		</li>
		<li>
			Port additions: <code>showToolbar</code>, <code>readOnly</code>, and
			<code>onExport</code> (called with the exported bytes).
		</li>
	</ul>
</section>

<p><a href="/">Back to all components</a></p>

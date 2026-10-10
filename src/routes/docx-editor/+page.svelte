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

<p><a href="/">Back to all components</a></p>

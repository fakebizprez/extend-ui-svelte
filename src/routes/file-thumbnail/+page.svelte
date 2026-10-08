<!-- MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT). -->
<script lang="ts">
	import { FileThumbnail } from '#lib/components/file-thumbnail/index.js';

	let isDark = $state(false);
	let pageNumber = $state(1);
</script>

<h1>File Thumbnail</h1>
<p>
	PDF page thumbnail rendered on a canvas through the shared PDF engine. Dark mode is
	controlled by the parent through <code>isDark</code> plus
	<code>onIsDarkChange</code>.
</p>
<p>
	<label>
		<input type="checkbox" bind:checked={isDark} />
		Dark mode
	</label>
	<label>
		Page number
		<input
			type="number"
			min="1"
			max="3"
			bind:value={pageNumber}
			data-testid="thumbnail-page-input"
		/>
	</label>
</p>

<div style:max-width="320px">
	<FileThumbnail
		file={{ name: 'sample.pdf', type: 'application/pdf' }}
		pdfUrl="/fixtures/sample.pdf"
		{pageNumber}
		width={240}
		{isDark}
		onIsDarkChange={(value: boolean) => (isDark = value)}
	/>
</div>

<p><a href="/">Back to all components</a></p>

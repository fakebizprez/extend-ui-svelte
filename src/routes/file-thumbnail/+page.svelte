<!-- MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT). -->
<script lang="ts">
	import { FileThumbnail } from '#lib/components/file-thumbnail/index.js';

	let isDark = $state(false);
	let pageNumber = $state(1);
</script>

<h1>File Thumbnail</h1>
<p>
	PDF page thumbnail rendered on a canvas through the shared PDF engine. Dark mode is
	controlled by the parent through <code>isDark</code>; the checkbox below is the page's own
	control.
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
	/>
</div>

<section aria-labelledby="differences-from-upstream">
	<h2 id="differences-from-upstream">Differences from upstream</h2>
	<ul>
		<li>
			Same export name, <code>FileThumbnail</code>. <code>class</code> is accepted alongside
			the upstream <code>className</code>. The loading overlay is built in rather than exported
			as <code>FileThumbnailLoadingOverlay</code>.
		</li>
		<li><code>previewContent</code> is a Svelte snippet instead of a React node.</li>
		<li>
			Port addition: built-in PDF page rendering. Pass <code>pdfUrl</code> (or
			<code>pdfFile</code>) with <code>pageNumber</code> and <code>width</code>, and only that
			page renders onto a canvas through PDF.js. Upstream expects the thumbnail image from your
			own pipeline.
		</li>
		<li>
			Dark mode is set by the parent through <code>isDark</code>. Like upstream there is no
			theme switch inside the thumbnail.
		</li>
	</ul>
</section>

<p><a href="/">Back to all components</a></p>

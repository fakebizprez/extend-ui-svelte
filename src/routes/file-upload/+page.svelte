<!-- MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT). -->
<script lang="ts">
	import FileUpload from '../../lib/components/file-upload/FileUpload.svelte';

	let isDark = $state(false);
	let lastAccepted = $state<string[]>([]);

	function handleFilesAccepted(files: File[]) {
		lastAccepted = files.map((file) => file.name);
	}
</script>

<h1>File Upload</h1>
<p>
	Drop zone and file input. Dark mode is controlled by the parent through
	<code>isDark</code>; the toggle below lives outside the component, which renders no theme
	control of its own.
</p>
<p>
	<label>
		<input type="checkbox" bind:checked={isDark} />
		Dark mode
	</label>
</p>

<FileUpload {isDark} onFilesAccepted={handleFilesAccepted} />

{#if lastAccepted.length > 0}
	<p>Last accepted: {lastAccepted.join(', ')}</p>
{/if}

<section aria-labelledby="differences-from-upstream">
	<h2 id="differences-from-upstream">Differences from upstream</h2>
	<ul>
		<li>
			Exported as <code>FileUpload</code>, like upstream. <code>className</code> and
			<code>class</code> are both accepted.
		</li>
		<li>
			Also exports helpers and types that upstream keeps private to the file:
			<code>DEFAULT_ACCEPT</code>, <code>DEFAULT_ACCEPTED_FILE_TYPES</code>,
			<code>formatBytes</code>, <code>matchesAccept</code>, <code>toUploadItems</code>,
			<code>FileUploadItem</code>, and <code>AcceptedFileType</code>.
		</li>
		<li>
			The animated border beam is a pure-CSS conic gradient instead of the
			<code>BorderBeam</code> component; <code>showBorderBeam</code> is kept.
			<code>borderBeamTheme</code> is replaced by the shared <code>isDark</code> flag.
		</li>
		<li>
			<code>acceptedFileTypes</code> entries take a text <code>glyph</code> instead of an
			<code>icon</code> component.
		</li>
		<li>
			Accepts <code>isDark</code> and <code>onIsDarkChange</code>; it reflects <code>isDark</code>
			(passing it to each row's <code>FileThumbnail</code>) and never calls
			<code>onIsDarkChange</code>.
		</li>
	</ul>
</section>

<p><a href="/">Back to all components</a></p>

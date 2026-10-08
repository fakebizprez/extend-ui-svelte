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
	<code>isDark</code> plus <code>onIsDarkChange</code>.
</p>
<p>
	<label>
		<input type="checkbox" bind:checked={isDark} />
		Dark mode
	</label>
</p>

<FileUpload {isDark} onIsDarkChange={(value: boolean) => (isDark = value)} onFilesAccepted={handleFilesAccepted} />

{#if lastAccepted.length > 0}
	<p>Last accepted: {lastAccepted.join(', ')}</p>
{/if}

<p><a href="/">Back to all components</a></p>

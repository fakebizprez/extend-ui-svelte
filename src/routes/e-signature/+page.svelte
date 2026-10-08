<!-- MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT). -->
<script lang="ts">
	import { ESignature } from '#lib/components/e-signature/index.js';

	let isDark = $state(false);
	let darkPreview = $state(true);
	let lastDownload = $state('');
</script>

<h1>E-Signature</h1>
<p>
	Svelte 5 port of the Extend UI e-signature. Draw on the pad with
	<code>signature_pad</code>, place the signature onto the PDF at a chosen
	position and scale with <code>pdf-lib</code>, then download the signed document.
	Coordinates are PDF points measured from the bottom-left page corner.
</p>

<h2>Fixture document</h2>
<ESignature
	src="/fixtures/sample.pdf"
	fileName="sample"
	isDark={isDark}
	onIsDarkChange={(value) => (isDark = value)}
	onSignedDownload={(name) => (lastDownload = name)}
/>
{#if lastDownload}
	<p data-testid="e-signature-last-download">Last download: {lastDownload}</p>
{/if}

<h2>Dark mode</h2>
<ESignature
	src="/fixtures/sample.pdf"
	fileName="sample"
	isDark={darkPreview}
	onIsDarkChange={(value) => (darkPreview = value)}
/>

<h2>Empty source</h2>
<ESignature />

<p><a href="/">Back to all components</a></p>

<style>
	h2 {
		margin-top: 2rem;
	}
</style>

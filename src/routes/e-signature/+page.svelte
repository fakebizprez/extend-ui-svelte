<!-- MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT). -->
<script lang="ts">
	import { ESignature } from '#lib/components/e-signature/index.js';

	let isDark = $state(false);
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
<p>
	<label>
		<input type="checkbox" bind:checked={isDark} />
		Dark mode
	</label>
</p>
<ESignature
	file="/fixtures/sample.pdf"
	fileName="sample"
	{isDark}
	onSignedDownload={(name) => (lastDownload = name)}
/>
{#if lastDownload}
	<p data-testid="e-signature-last-download">Last download: {lastDownload}</p>
{/if}

<h2>Dark mode</h2>
<ESignature file="/fixtures/sample.pdf" fileName="sample" isDark />

<h2>Empty source</h2>
<ESignature />

<section aria-labelledby="differences-from-upstream">
	<h2 id="differences-from-upstream">Differences from upstream</h2>
	<ul>
		<li>
			Exported as both <code>ESignature</code> and the upstream name
			<code>ESignatureBlock</code>. The upstream <code>file</code> prop is accepted;
			<code>src</code> is kept as an alias (<code>file</code> wins). <code>className</code> and
			<code>class</code> are both accepted.
		</li>
		<li>
			One signature, drawn on an inline pad and placed with numeric position, size, and scale
			controls, instead of the signature dialog and the draggable field overlay on the shared
			PDF viewer.
		</li>
		<li>
			Not ported: the resizable two-pane layout, the signature field list panel, initials,
			date, checkbox, and text fields, recipients and field ownership, required-field
			validation, and signed/pending/declined states.
		</li>
		<li>
			The signed download is named <code>&lt;name&gt;-signed.pdf</code> instead of upstream's
			fixed <code>signed-document.pdf</code>.
		</li>
		<li>
			Dark mode is set by the parent through <code>isDark</code>; the block has no theme switch,
			so <code>onIsDarkChange</code> is never called.
		</li>
		<li>
			Port additions: <code>fileName</code>, <code>page</code>, bindable
			<code>positionX</code>/<code>positionY</code>/<code>signatureWidth</code>/<code
				>signatureHeight</code
			>/<code>scale</code>, <code>penColor</code>, <code>backgroundColor</code>,
			<code>showDownload</code>, and event callbacks.
		</li>
	</ul>
</section>

<p><a href="/">Back to all components</a></p>

<style>
	h2 {
		margin-top: 2rem;
	}
</style>

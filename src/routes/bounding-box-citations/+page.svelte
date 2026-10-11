<!-- MIT License — Svelte 5 port of Extend UI bounding-box-citations. Upstream: extend-hq/ui (MIT). -->
<script lang="ts">
	import { docsTheme } from '../_shell/theme.svelte.js';
	import {
		BoundingBoxCitations,
		HumanReviewPanel
	} from '#lib/components/bounding-box-citations/index.js';
	import {
		BLOCK_REVIEW_FIELDS,
		BLOCK_REVIEW_METADATA,
		BLOCK_REVIEW_PDF_URL,
		resolveBlockReviewArrayItemMetadataPath
	} from './block-demo.js';

	let isDark = $derived(docsTheme.isDark);
	let activeFieldKey: string | null = $state(null);
</script>

<h1>Bounding Box Citations</h1>
<p class="lead">
	Review extracted values against source bounding box citations with form fields and JSON
	diffing.
</p>
<p>
	Bounding Box Citations provides field-level cards for comparing extracted values with source
	PDF bounding boxes. Use it when reviewers need to inspect citations, correct values, and
	optionally compare against expected output.
</p>

<!-- Theme state lives here, outside the components (parent-controlled dark mode). -->
<label class="theme-toggle">
	<input type="checkbox" bind:checked={isDark} />
	Dark mode
</label>

<section class={`preview${isDark ? ' dark' : ''}`} data-testid="human-review-demo">
	<HumanReviewPanel {isDark} onIsDarkChange={(value) => (isDark = value)} />
</section>

<h2>Bounding Box Citations block</h2>
<p>
	The panel composed with the PDF Viewer: focusing a field highlights its bounding box and
	scrolls the page there; hovering a transaction row highlights its line; clicking a box focuses
	its field. The sample bank statement and its citations are upstream's block demo data
	(extend-hq/ui, MIT).
</p>
<section class={`preview${isDark ? ' dark' : ''}`}>
	<BoundingBoxCitations
		src={BLOCK_REVIEW_PDF_URL}
		fileName="bank-statement"
		fields={BLOCK_REVIEW_FIELDS}
		metadata={BLOCK_REVIEW_METADATA}
		resolveArrayItemMetadataPath={resolveBlockReviewArrayItemMetadataPath}
		bind:activeFieldKey
		{isDark}
		onIsDarkChange={(value) => (isDark = value)}
	/>
</section>
<p data-testid="docs-active-citation">Active citation: {activeFieldKey ?? 'none'}</p>

<h2>Useful behaviors</h2>
<ul>
	<li>Actual and expected values displayed side by side for each schema field when <code>showExpected</code> is enabled.</li>
	<li>Array values rendered as grids, including drill-down for nested arrays and objects, with the Actual and Expected grids kept in sync.</li>
	<li>Input controls selected from the JSON schema property type.</li>
	<li>Object schema properties rendered as nested cards in the scrollable form.</li>
	<li>Per-field undo and Set to NULL actions when <code>showExpected</code> is enabled.</li>
	<li>Form and JSON diff views for the same reviewed output state when <code>showExpected</code> is enabled.</li>
</ul>

<h2>API Reference</h2>
<h3>HumanReviewPanel</h3>
<table>
	<thead><tr><th>Prop</th><th>Type</th><th>Default</th></tr></thead>
	<tbody>
		<tr><td><code>fields</code></td><td><code>ReviewField[]</code></td><td>sample fields</td></tr>
		<tr><td><code>bind:values</code></td><td><code>JsonObject</code></td><td>each field's <code>expected</code></td></tr>
		<tr><td><code>activeFieldKey</code></td><td><code>string</code></td><td>-</td></tr>
		<tr><td><code>class</code> / <code>className</code></td><td><code>string</code></td><td>-</td></tr>
		<tr><td><code>onFieldFocus</code></td><td><code>(field: ReviewField) =&gt; void</code></td><td>-</td></tr>
		<tr><td><code>onLocationHover</code></td><td><code>(location?: ReviewLocation) =&gt; void</code></td><td>-</td></tr>
		<tr><td><code>resolveLocation</code></td><td><code>(metadataPath: string) =&gt; ReviewLocation | undefined</code></td><td>-</td></tr>
		<tr><td><code>resolveArrayItemMetadataPath</code></td><td><code>(path, rowIndex, rowValue) =&gt; string | undefined</code></td><td>-</td></tr>
		<tr><td><code>showExpected</code></td><td><code>boolean</code></td><td><code>true</code></td></tr>
		<tr><td><code>isDark</code> / <code>onIsDarkChange</code></td><td><code>boolean</code> / <code>(isDark: boolean) =&gt; void</code></td><td><code>false</code></td></tr>
	</tbody>
</table>
<h3>ReviewField</h3>
<table>
	<thead><tr><th>Prop</th><th>Type</th><th>Required</th></tr></thead>
	<tbody>
		<tr><td><code>key</code></td><td><code>string</code></td><td>Yes</td></tr>
		<tr><td><code>schema</code></td><td><code>ReviewFieldSchema</code></td><td>Yes</td></tr>
		<tr><td><code>actual</code></td><td><code>JsonValue</code></td><td>Yes</td></tr>
		<tr><td><code>expected</code></td><td><code>JsonValue</code></td><td>Yes</td></tr>
		<tr><td><code>location</code></td><td><code>{'{ page: number; area: HighlightArea }'}</code></td><td>No</td></tr>
	</tbody>
</table>

<h2>Differences from upstream</h2>
<ul>
	<li><code>theme</code> is replaced by parent-controlled <code>isDark</code> + <code>onIsDarkChange</code>; neither component renders its own theme control.</li>
	<li><code>class</code> and <code>className</code> are both accepted and merged.</li>
	<li>Array grids are a Svelte DOM table instead of glide-data-grid: same columns, row numbers, double-click / Enter / typing to edit, drill-in and mirrored selection, but single-cell selection only (no range or drag selection). No <code>#portal</code> element is needed.</li>
	<li>The JSON diff is a built-in line diff instead of <code>@pierre/diffs</code>: split view with collapsed unchanged lines, no word-level highlights.</li>
	<li>Added <code>bind:values</code> on the panel to read the edited output (upstream keeps it internal although its usage sample passes <code>values</code>).</li>
	<li>Panel height comes from the <code>--human-review-panel-height</code> CSS variable (default 560px) instead of a <code>className</code> height utility.</li>
	<li>Block (<code>HumanReviewBlock</code>, exported also as <code>BoundingBoxCitations</code>): every located field gets a faint clickable box, so clicking a box focuses its field (upstream draws only the active box).</li>
	<li>Block: <code>src</code> is the primary PDF prop and upstream's <code>file</code> is an alias; added <code>bind:activeFieldKey</code>, <code>onActiveFieldChange</code>, <code>onFieldFocus</code>, <code>onLocationHover</code>, <code>bind:values</code>, <code>fileName</code>, and <code>height</code>.</li>
	<li>Block: the PDF renders on the shared PdfViewer; scroll-to-area is computed from the rendered page slots because PdfViewer has no <code>scrollToPageArea</code> handle.</li>
	<li>Block: the resizable split stacks vertically below 900px instead of switching to a vertical resizable layout.</li>
	<li>Port-only exports: the overlay helpers <code>boxesForPage</code>, <code>formatCitationValue</code>, <code>getCitationLocation</code>, plus the types <code>BoundingBoxCitationsProps</code>, <code>HumanReviewPanelProps</code>, <code>CitationBox</code>, <code>ArrayNestedView</code>, <code>ArrayReviewSide</code>. Upstream's <code>HumanReviewTheme</code> type is not exported because <code>theme</code> is replaced by <code>isDark</code>.</li>
</ul>

<p><a href="/">Back to overview</a></p>

<style>
	.lead {
		color: var(--lh-muted);
		font-size: 1.05rem;
	}

	.theme-toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0.5rem 0 1rem;
	}

	.preview {
		overflow: hidden;
		margin-bottom: 1rem;
		border: 1px solid #e5e5e5;
		border-radius: 0.75rem;
	}

	.preview.dark {
		border-color: #262626;
		background: #0a0a0a;
	}

	h2 {
		margin-top: 2rem;
	}

	table {
		border-collapse: collapse;
		font-size: 0.9rem;
	}

	th,
	td {
		border: 1px solid #e5e5e5;
		padding: 0.375rem 0.625rem;
		text-align: left;
	}
</style>

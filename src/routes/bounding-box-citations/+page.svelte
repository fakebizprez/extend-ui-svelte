<!-- MIT License — Svelte 5 port of Extend UI bounding-box-citations. Upstream: extend-hq/ui (MIT). -->
<script lang="ts">
	import { BoundingBoxCitations, type ReviewField } from '#lib/components/bounding-box-citations/index.js';

	let isDark = $state(false);
	let activeFieldKey: string | null = $state(null);

	const fields: ReviewField[] = [
		{
			key: 'statement_period',
			schema: { type: 'string', title: 'Statement period' },
			actual: 'Jan 1-31, 2026',
			expected: 'January 1-31, 2026',
			location: { page: 1, area: { left: 12, top: 8, width: 76, height: 6 } }
		},
		{
			key: 'page_number',
			schema: { type: 'string', title: 'Page number line' },
			actual: 'Page number: 1',
			expected: 'Page number: 1',
			location: { page: 1, area: { left: 12, top: 12, width: 40, height: 4 } }
		},
		{
			key: 'ending_balance',
			schema: { type: 'number', title: 'Ending balance' },
			actual: 12840.18,
			expected: 12858.18,
			location: { page: 2, area: { left: 12, top: 8, width: 76, height: 6 } }
		},
		{
			key: 'overdraft_protection_enabled',
			schema: { type: 'boolean', title: 'Overdraft protection enabled' },
			actual: false,
			expected: true,
			location: { page: 3, area: { left: 12, top: 8, width: 76, height: 6 } }
		}
	];
</script>

<h1>Bounding Box Citations</h1>
<p>
	Svelte 5 port of the Extend UI bounding-box-citations review block. Citation boxes overlay
	the PDF viewer; selecting a citation in the list highlights its box and scrolls to its page,
	and clicking a box highlights the matching list entry.
</p>

<h2>Fixture document with sample citations</h2>
<BoundingBoxCitations
	src="/fixtures/sample.pdf"
	fileName="sample"
	{fields}
	bind:activeFieldKey
	isDark={isDark}
	onIsDarkChange={(value) => (isDark = value)}
/>

<p data-testid="docs-active-citation">Active citation: {activeFieldKey ?? 'none'}</p>

<p><a href="/">Back to all components</a></p>

<style>
	h2 {
		margin-top: 2rem;
	}
</style>

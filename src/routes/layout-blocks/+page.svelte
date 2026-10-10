<!-- MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT). -->
<script lang="ts">
	import {
		getOcrBlocks,
		LayoutBlocks,
		type OcrBlock,
		type ParsedOcrOutput
	} from '#lib/components/layout-blocks/index.js';

	const LONG_DOCUMENT_BLOCK_COUNT = 200;

	let isDark = $state(false);
	let focusedBlockId = $state<string | undefined>(undefined);

	const sampleOutput: ParsedOcrOutput = {
		chunks: [
			{
				blocks: [
					{
						id: 'sample-header',
						type: 'header',
						content: 'arXiv:1706.03762v7 [cs.CL] 2 Aug 2023',
						metadata: {
							page: { number: 1, width: 1275, height: 1651 },
							layoutClass: 'Header',
							avgOcrConfidence: 0.98
						}
					},
					{
						id: 'sample-heading',
						type: 'heading',
						content: '# Attention Is All You Need',
						metadata: {
							page: { number: 1, width: 1275, height: 1651 },
							layoutClass: 'Heading',
							avgOcrConfidence: 0.994
						}
					},
					{
						id: 'sample-authors',
						type: 'text',
						content: 'Ashish Vaswani, Noam Shazeer, Niki Parmar, and colleagues.',
						metadata: {
							page: { number: 1, width: 1275, height: 1651 },
							layoutClass: 'Text',
							avgOcrConfidence: 0.992
						}
					},
					{
						id: 'sample-abstract',
						type: 'section_heading',
						content: '### Abstract',
						metadata: {
							page: { number: 1, width: 1275, height: 1651 },
							layoutClass: 'Subheading',
							avgOcrConfidence: 0.995
						}
					},
					{
						id: 'sample-paragraph',
						type: 'text',
						content:
							'The dominant sequence transduction models are based on complex recurrent networks. We propose the **Transformer**, based solely on *attention mechanisms*.',
						metadata: {
							page: { number: 1, width: 1275, height: 1651 },
							layoutClass: 'Text',
							avgOcrConfidence: 0.995
						}
					},
					{
						id: 'sample-list',
						type: 'text',
						content: '- dispenses with recurrence\n- dispenses with convolutions',
						metadata: {
							page: { number: 1, width: 1275, height: 1651 },
							layoutClass: 'List Item',
							avgOcrConfidence: 0.99
						}
					},
					{
						id: 'sample-table',
						type: 'table',
						content:
							'| Model | BLEU |\n|---|---|\n| Transformer (base) | 27.3 |\n| Transformer (big) | 28.4 |',
						metadata: {
							page: { number: 2, width: 1275, height: 1651 },
							layoutClass: 'Table',
							avgOcrConfidence: 0.97
						}
					},
					{
						id: 'sample-figure',
						type: 'figure',
						content:
							'<figure>Model architecture diagram<caption>Figure 1: The Transformer</caption></figure>',
						metadata: {
							page: { number: 3, width: 1275, height: 1651 },
							layoutClass: 'Figure',
							avgOcrConfidence: 0.96
						}
					},
					{
						id: 'sample-footer',
						type: 'footer',
						content: '31st Conference on Neural Information Processing Systems (NIPS 2017).',
						metadata: {
							page: { number: 1, width: 1275, height: 1651 },
							layoutClass: 'Footer',
							avgOcrConfidence: 0.993
						}
					},
					{
						id: 'sample-page-number',
						type: 'page_number',
						content: '1',
						metadata: {
							page: { number: 1, width: 1275, height: 1651 },
							avgOcrConfidence: 0.999
						}
					}
				]
			}
		]
	};

	const sampleBlocks: OcrBlock[] = getOcrBlocks(sampleOutput);

	const longDocumentBlocks: OcrBlock[] = Array.from(
		{ length: LONG_DOCUMENT_BLOCK_COUNT },
		(_, index) => ({
			id: `long-block-${index}`,
			type: index % 10 === 0 ? ('heading' as const) : ('paragraph' as const),
			text:
				index % 10 === 0
					? `## Section ${index / 10 + 1}`
					: `Long document paragraph ${index} with **bold** detail.`,
			page: Math.floor(index / 20) + 1,
			pageWidth: 1275,
			pageHeight: 1651,
			confidence: 0.9 + (index % 10) / 100
		})
	);
</script>

<h1>Layout Blocks</h1>
<p>
	Document layout blocks (headings, paragraphs, tables, figures) with virtualized
	scrolling and markdown rendering. Dark mode is controlled by the parent through
	<code>isDark</code> plus <code>onIsDarkChange</code>.
</p>
<p>
	<label>
		<input type="checkbox" bind:checked={isDark} />
		Dark mode
	</label>
</p>

<h2>Sample document</h2>
<p data-testid="focused-block">Focused block: {focusedBlockId ?? 'none'}</p>
<div data-testid="sample-panel" style:max-width="640px">
	<LayoutBlocks
		blocks={sampleBlocks}
		height={700}
		{isDark}
		onIsDarkChange={(value: boolean) => (isDark = value)}
		onBlockFocus={(block) => (focusedBlockId = block.id)}
	/>
</div>

<h2>Long document ({LONG_DOCUMENT_BLOCK_COUNT} blocks, virtualized)</h2>
<div data-testid="long-panel" style:max-width="640px">
	<LayoutBlocks blocks={longDocumentBlocks} {isDark} />
</div>

<p><a href="/">Back to all components</a></p>

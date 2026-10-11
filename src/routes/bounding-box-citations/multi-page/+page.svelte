<!--
	MIT License — Svelte 5 port of Extend UI bounding-box-citations. Upstream: extend-hq/ui (MIT).
	Test page: the block on the 3-page sample PDF, one cited field per page,
	so browser tests can check scroll-to-area across pages.
-->
<script lang="ts">
	import { docsTheme } from '../../_shell/theme.svelte.js';
	import { BoundingBoxCitations, type ReviewField } from '#lib/components/bounding-box-citations/index.js';

	const fields: ReviewField[] = [1, 2, 3].map((page) => ({
		key: `page_${page}`,
		schema: { type: 'string', title: `Page ${page} heading` },
		actual: `Page number: ${page}`,
		expected: `Page number: ${page}`,
		location: { page, area: { left: 12, top: 40, width: 40, height: 4 } }
	}));
</script>

<h1>Bounding Box Citations: multi-page test page</h1>
<BoundingBoxCitations isDark={docsTheme.isDark} src="/fixtures/sample.pdf" fileName="sample" {fields} />

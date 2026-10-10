<!--
	MIT License — Svelte 5 port of Extend UI bounding-box-citations. Upstream: extend-hq/ui (MIT).
	Port of upstream HumanReviewHighlight: the blue box drawn over a PDF page
	for the focused or hovered review location (percent coordinates).
-->
<script lang="ts">
	import type { ReviewLocation } from './citations.js';

	let { location }: { location: ReviewLocation } = $props();
</script>

<div
	class="hr-highlight"
	data-testid="citation-highlight"
	data-page={location.page}
	style={`left: ${location.area.left}%; top: ${location.area.top}%; width: ${location.area.width}%; height: ${location.area.height}%;`}
></div>

<style>
	.hr-highlight {
		position: absolute;
		z-index: 10;
		box-sizing: border-box;
		border: 1px solid rgb(59 130 246 / 0.7);
		background: rgb(59 130 246 / 0.12);
		box-shadow: 0 4px 16px rgb(59 130 246 / 0.1);
		pointer-events: none;
	}
</style>

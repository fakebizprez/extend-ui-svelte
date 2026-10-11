// MIT License — Svelte 5 port of Extend UI bounding-box-citations. Upstream: extend-hq/ui (MIT).
import { describe, expect, it } from 'vitest';
import * as entry from './index.js';
import BoundingBoxCitations from './BoundingBoxCitations.svelte';
import HumanReviewPanel from './HumanReviewPanel.svelte';

describe('bounding-box-citations entry', () => {
	it('exports the upstream component names alongside the port names', () => {
		expect(entry.HumanReviewPanel).toBe(HumanReviewPanel);
		expect(entry.HumanReviewBlock).toBe(BoundingBoxCitations);
		expect(entry.BoundingBoxCitations).toBe(BoundingBoxCitations);
		expect(entry.default).toBe(BoundingBoxCitations);
		expect(entry.HumanReviewHighlight).toBeTypeOf('function');
		expect(entry.JsonDiffView).toBeTypeOf('function');
		expect(entry.JsonCodeView).toBeTypeOf('function');
		expect(entry.REVIEW_FIELDS).toHaveLength(5);
	});
});

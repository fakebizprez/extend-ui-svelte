// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
// Regression: when pdfUrl changes while the previous PDF is still loading, the
// stale load finishing last must not draw its page over the newer one.
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import FileThumbnail from './FileThumbnail.svelte';

const engineState = vi.hoisted(() => ({
	pending: new Map<string, () => void>(),
	loaded: '',
	renders: [] as string[]
}));

// A plain engine that does not supersede loads, so the component's own guard is tested.
vi.mock('../../engines/pdf/index.js', () => ({
	createPdfEngine: () => ({
		load: (url: string) =>
			new Promise<number>((resolve) => {
				engineState.pending.set(url, () => {
					engineState.loaded = url;
					resolve(3);
				});
			}),
		renderPage: async (_page: number, _canvas: HTMLCanvasElement, options?: { scale?: number }) => {
			engineState.renders.push(engineState.loaded);
			return { width: 612 * (options?.scale ?? 1), height: 792 * (options?.scale ?? 1) };
		},
		destroy: async () => {}
	})
}));

describe('FileThumbnail PDF source changes', () => {
	it('never renders the older PDF after a newer one was requested', async () => {
		const file = { name: 'report.pdf', type: 'application/pdf' };
		const { rerender } = render(FileThumbnail, { file, pdfUrl: 'a.pdf' });
		await vi.waitFor(() => expect(engineState.pending.has('a.pdf')).toBe(true));

		await rerender({ file, pdfUrl: 'b.pdf' });
		await vi.waitFor(() => expect(engineState.pending.has('b.pdf')).toBe(true));
		engineState.pending.get('b.pdf')!();
		await vi.waitFor(() => expect(engineState.renders).toContain('b.pdf'));
		engineState.pending.get('a.pdf')!();
		await new Promise((resolve) => setTimeout(resolve, 20));

		expect(engineState.renders).not.toContain('a.pdf');
	});
});

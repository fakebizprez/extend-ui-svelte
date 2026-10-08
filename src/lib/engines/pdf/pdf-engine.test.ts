// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
import { describe, expect, it, vi } from 'vitest';
import { createPdfEngine, setPdfWorkerSrc } from './pdf-engine';

describe('pdf engine API shape', () => {
	it('exposes the engine factory and worker configuration', () => {
		expect(typeof createPdfEngine).toBe('function');
		expect(typeof setPdfWorkerSrc).toBe('function');
	});

	it('starts unloaded with zero pages and no current page', () => {
		const engine = createPdfEngine();

		expect(engine.pageCount).toBe(0);
		expect(engine.currentPage).toBe(0);
	});

	it('exposes load / render / navigation / destroy methods', () => {
		const engine = createPdfEngine();

		expect(typeof engine.load).toBe('function');
		expect(typeof engine.renderPage).toBe('function');
		expect(typeof engine.setCurrentPage).toBe('function');
		expect(typeof engine.onPageChange).toBe('function');
		expect(typeof engine.destroy).toBe('function');
	});

	it('setCurrentPage is a no-op with no listeners notified while unloaded', () => {
		const engine = createPdfEngine();
		const handler = vi.fn();
		engine.onPageChange(handler);

		engine.setCurrentPage(2);

		expect(engine.currentPage).toBe(0);
		expect(handler).not.toHaveBeenCalled();
	});

	it('onPageChange returns an unsubscribe function', () => {
		const engine = createPdfEngine();
		const handler = vi.fn();

		const unsubscribe = engine.onPageChange(handler);

		expect(typeof unsubscribe).toBe('function');
		unsubscribe();
		engine.setCurrentPage(1);
		expect(handler).not.toHaveBeenCalled();
	});

	it('renderPage rejects while no document is loaded', async () => {
		const engine = createPdfEngine();
		// Node env has no DOM; the guard must reject before touching the canvas.
		const canvas = {} as unknown as HTMLCanvasElement;

		await expect(engine.renderPage(1, canvas)).rejects.toThrow(/no document loaded/i);
	});

	it('load rejects invalid sources without touching PDF.js', async () => {
		const engine = createPdfEngine();

		// @ts-expect-error invalid source type on purpose
		await expect(engine.load(42)).rejects.toThrow(TypeError);
		// @ts-expect-error invalid source type on purpose
		await expect(engine.load(null)).rejects.toThrow(TypeError);
		expect(engine.pageCount).toBe(0);
	});

	it('destroy is safe while unloaded', async () => {
		const engine = createPdfEngine();

		await expect(engine.destroy()).resolves.toBeUndefined();
		expect(engine.pageCount).toBe(0);
	});

	it('setPdfWorkerSrc accepts an explicit worker URL', () => {
		expect(() => setPdfWorkerSrc('https://example.com/pdf.worker.mjs')).not.toThrow();
	});
});

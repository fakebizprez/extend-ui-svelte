// MIT License — Svelte 5 port of Extend UI bounding-box-citations. Upstream: extend-hq/ui (MIT).
// Component tests: run in the Vitest client (jsdom) project.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import BoundingBoxCitations from './BoundingBoxCitations.svelte';
import type { ReviewField } from './citations.js';
import { REVIEW_FIELDS } from './review.js';

vi.mock('#lib/engines/pdf/index.js', () => ({
	createPdfEngine: () => {
		const listeners = new Set<(page: number) => void>();
		const engine = {
			pageCount: 0,
			currentPage: 0,
			load: async () => {
				engine.pageCount = 3;
				engine.currentPage = 1;
				for (const listener of listeners) listener(engine.currentPage);
				return engine.pageCount;
			},
			renderPage: async () => ({ width: 612, height: 792 }),
			setCurrentPage: (page: number) => {
				const clamped = Math.min(Math.max(Math.floor(page), 1), engine.pageCount);
				if (engine.currentPage !== clamped) {
					engine.currentPage = clamped;
					for (const listener of listeners) listener(clamped);
				}
			},
			onPageChange: (handler: (page: number) => void) => {
				listeners.add(handler);
				return () => {
					listeners.delete(handler);
				};
			},
			destroy: async () => {
				engine.pageCount = 0;
				engine.currentPage = 0;
			}
		};
		return engine;
	}
}));

const SRC = 'https://example.com/files/statement.pdf';

function card(key: string): HTMLElement {
	const element = document.querySelector<HTMLElement>(`[data-review-field="${key}"]`);
	if (!element) throw new Error(`no card for ${key}`);
	return element;
}

async function highlight(): Promise<HTMLElement> {
	return screen.findByTestId('citation-highlight');
}

function areaOf(element: HTMLElement) {
	return [element.style.left, element.style.top, element.style.width, element.style.height];
}

describe('BoundingBoxCitations (HumanReviewBlock)', () => {
	it('pairs the PDF viewer with the review panel using the upstream sample fields', async () => {
		render(BoundingBoxCitations, { src: SRC });

		await screen.findByText('Page 1 of 3');
		expect(screen.getByTestId('citations-viewer-pane')).toBeInTheDocument();
		expect(screen.getByTestId('human-review-panel')).toBeInTheDocument();
		for (const field of REVIEW_FIELDS) expect(card(field.key)).toBeInTheDocument();
	});

	it('highlights the first field on its page by default', async () => {
		const { container } = render(BoundingBoxCitations, { src: SRC });

		await screen.findByText('Page 1 of 3');
		const box = await highlight();
		expect(container.querySelector('[data-page-number="1"]')?.contains(box)).toBe(true);
		expect(areaOf(box)).toEqual(['31%', '30%', '40%', '5.8%']);
		expect(card('statement_period')).toHaveAttribute('data-active', 'true');
	});

	it('preselects the field passed through activeFieldKey', async () => {
		const { container } = render(BoundingBoxCitations, {
			src: SRC,
			activeFieldKey: 'overdraft_protection_enabled'
		});

		await screen.findByText('Page 1 of 3');
		const box = await highlight();
		expect(container.querySelector('[data-page-number="2"]')?.contains(box)).toBe(true);
		expect(card('overdraft_protection_enabled')).toHaveAttribute('data-active', 'true');
		expect(card('statement_period')).toHaveAttribute('data-active', 'false');
	});

	it('focusing a field moves the highlight to its box and notifies the parent', async () => {
		const onFieldFocus = vi.fn();
		const onActiveFieldChange = vi.fn();
		const { container } = render(BoundingBoxCitations, {
			src: SRC,
			onFieldFocus,
			onActiveFieldChange
		});

		await screen.findByText('Page 1 of 3');
		await fireEvent.focusIn(card('overdraft_protection_enabled'));

		expect(onFieldFocus).toHaveBeenCalledWith(
			expect.objectContaining({ key: 'overdraft_protection_enabled' })
		);
		expect(onActiveFieldChange).toHaveBeenLastCalledWith('overdraft_protection_enabled');
		expect(card('overdraft_protection_enabled')).toHaveAttribute('data-active', 'true');
		const box = await highlight();
		expect(container.querySelector('[data-page-number="2"]')?.contains(box)).toBe(true);
		expect(
			container.querySelector('[data-testid="citation-box"][data-field-key="overdraft_protection_enabled"]')
		).toHaveAttribute('data-active', 'true');
	});

	it('clicking a citation box focuses its field in the panel', async () => {
		const onFieldFocus = vi.fn();
		const { container } = render(BoundingBoxCitations, { src: SRC, onFieldFocus });

		await screen.findByText('Page 1 of 3');
		const box = container.querySelector<HTMLElement>(
			'[data-testid="citation-box"][data-field-key="overdraft_protection_enabled"]'
		);
		expect(box).not.toBeNull();
		await fireEvent.click(box!);

		expect(onFieldFocus).toHaveBeenCalledWith(
			expect.objectContaining({ key: 'overdraft_protection_enabled' })
		);
		expect(card('overdraft_protection_enabled')).toHaveAttribute('data-active', 'true');
		expect(box).toHaveAttribute('data-active', 'true');
	});

	it('shows the hovered location and falls back to the active field on leave', async () => {
		const onLocationHover = vi.fn();
		render(BoundingBoxCitations, { src: SRC, onLocationHover });

		await screen.findByText('Page 1 of 3');
		await fireEvent.mouseEnter(card('ending_balance'));
		expect(areaOf(await highlight())).toEqual(['13.5%', '66%', '73.5%', '7.5%']);
		expect(onLocationHover).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }));

		await fireEvent.mouseLeave(card('ending_balance'));
		expect(onLocationHover).toHaveBeenLastCalledWith(undefined);
	});

	it('resolves locations from citation metadata', async () => {
		const fields: ReviewField[] = [
			{
				key: 'total',
				schema: { type: 'number', title: 'Total' },
				actual: 1,
				expected: 2
			}
		];
		render(BoundingBoxCitations, {
			src: SRC,
			fields,
			metadata: {
				total: {
					citations: [
						{
							page: 3,
							pageWidth: 200,
							pageHeight: 100,
							polygon: [
								{ x: 20, y: 10 },
								{ x: 60, y: 10 },
								{ x: 60, y: 30 },
								{ x: 20, y: 30 }
							]
						}
					]
				}
			}
		});

		await screen.findByText('Page 1 of 3');
		const box = await highlight();
		expect(box).toHaveAttribute('data-page', '3');
		expect(areaOf(box)).toEqual(['10%', '10%', '20%', '20%']);
	});

	it('accepts the upstream `file` prop and merges class with className', async () => {
		render(BoundingBoxCitations, { file: SRC, class: 'one', className: 'two' });

		await screen.findByText('Page 1 of 3');
		const root = screen.getByTestId('bounding-box-citations');
		expect(root).toHaveClass('one', 'two');
	});

	it('reflects the parent-controlled dark mode in the viewer and panel', async () => {
		render(BoundingBoxCitations, { src: SRC, isDark: true });

		const root = await screen.findByTestId('bounding-box-citations');
		expect(root).toHaveAttribute('data-dark', 'true');
		expect(root).toHaveClass('dark');
		expect(screen.getByTestId('human-review-panel')).toHaveClass('dark');
	});

	it('resizes the review pane from the keyboard and remembers the size', async () => {
		const store = new Map<string, string>();
		vi.stubGlobal('localStorage', {
			getItem: (key: string) => store.get(key) ?? null,
			setItem: (key: string, value: string) => store.set(key, value)
		});
		render(BoundingBoxCitations, { src: SRC });

		const handle = screen.getByRole('separator', { name: 'Resize review panel' });
		expect(handle).toHaveAttribute('aria-valuenow', '42');
		await fireEvent.keyDown(handle, { key: 'ArrowLeft' });
		expect(handle).toHaveAttribute('aria-valuenow', '44');
		expect(store.get('pdf-block-bounding-box-citations')).toBe('44');
		await fireEvent.keyDown(handle, { key: 'End' });
		expect(handle).toHaveAttribute('aria-valuenow', '60');
		vi.unstubAllGlobals();
	});

	it('restores a remembered pane size', async () => {
		vi.stubGlobal('localStorage', { getItem: () => '55', setItem: () => {} });
		render(BoundingBoxCitations, { src: SRC });
		const handle = screen.getByRole('separator', { name: 'Resize review panel' });
		await vi.waitFor(() => expect(handle).toHaveAttribute('aria-valuenow', '55'));
		vi.unstubAllGlobals();
	});
});

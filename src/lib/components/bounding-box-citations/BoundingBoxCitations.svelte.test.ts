// MIT License — Svelte 5 port of Extend UI bounding-box-citations. Upstream: extend-hq/ui (MIT).
// Component tests: run in the Vitest client (jsdom) project.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import BoundingBoxCitations from './BoundingBoxCitations.svelte';
import type { ReviewField } from './citations.js';

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

const FIELDS: ReviewField[] = [
	{
		key: 'statement_period',
		schema: { type: 'string', title: 'Statement period' },
		actual: 'Jan 1-31, 2026',
		expected: 'January 1-31, 2026',
		location: { page: 1, area: { left: 31, top: 30, width: 40, height: 5.8 } }
	},
	{
		key: 'ending_balance',
		schema: { type: 'number', title: 'Ending balance' },
		actual: 12840.18,
		expected: 12858.18,
		location: { page: 2, area: { left: 13.5, top: 66, width: 73.5, height: 7.5 } }
	},
	{
		key: 'account_details',
		schema: { type: 'object', title: 'Account details' },
		actual: { holder: 'Jordan Lee' },
		expected: { holder: 'Jordan Lee' }
	}
];

function boxes(container: HTMLElement): NodeListOf<HTMLElement> {
	return container.querySelectorAll('[data-testid="citation-box"]');
}

describe('BoundingBoxCitations', () => {
	it('renders the citation list with titles, values, and page badges', async () => {
		render(BoundingBoxCitations, { src: SRC, fields: FIELDS });

		const list = await screen.findByTestId('citation-list');
		expect(within(list).getByText('Statement period')).toBeVisible();
		expect(within(list).getByText('Ending balance')).toBeVisible();
		expect(within(list).getByText('Account details')).toBeVisible();
		expect(within(list).getByText('January 1-31, 2026')).toBeVisible();
		expect(within(list).getByText('p. 1')).toBeVisible();
		expect(within(list).getByText('p. 2')).toBeVisible();
	});

	it('renders overlay boxes on the matching page canvases', async () => {
		const { container } = render(BoundingBoxCitations, { src: SRC, fields: FIELDS });

		await screen.findByText('Page 1 of 3');
		const rendered = await screen.findAllByTestId('citation-box');
		expect(rendered.length).toBeGreaterThanOrEqual(1);

		const pageOne = container.querySelector('[data-page-number="1"]');
		const box = within(pageOne as HTMLElement).getByTestId('citation-box');
		expect(box).toHaveAttribute('data-field-key', 'statement_period');
		expect(box.style.left).toBe('31%');
		expect(box.style.top).toBe('30%');
		expect(box.style.width).toBe('40%');
		expect(box.style.height).toBe('5.8%');
		expect(boxes(container).length).toBeLessThanOrEqual(FIELDS.length);
	});

	it('preselects the field passed through activeFieldKey', async () => {
		const { container } = render(BoundingBoxCitations, {
			src: SRC,
			fields: FIELDS,
			activeFieldKey: 'ending_balance'
		});

		await screen.findByText('Page 1 of 3');
		const list = screen.getByTestId('citation-list');
		const active = within(list).getByRole('button', { name: /Ending balance/ });
		expect(active).toHaveAttribute('aria-current', 'true');
		const box = container.querySelector('[data-field-key="ending_balance"]');
		expect(box?.getAttribute('data-active')).toBe('true');
	});

	it('activates a citation from the list and notifies the parent', async () => {
		const onFieldFocus = vi.fn();
		const onActiveFieldChange = vi.fn();
		render(BoundingBoxCitations, {
			src: SRC,
			fields: FIELDS,
			onFieldFocus,
			onActiveFieldChange
		});

		const list = await screen.findByTestId('citation-list');
		await screen.findByText('Page 1 of 3');
		await fireEvent.click(within(list).getByRole('button', { name: /Ending balance/ }));

		expect(onFieldFocus).toHaveBeenCalledTimes(1);
		expect(onFieldFocus).toHaveBeenCalledWith(
			expect.objectContaining({ key: 'ending_balance' })
		);
		expect(onActiveFieldChange).toHaveBeenCalledTimes(1);
		expect(onActiveFieldChange).toHaveBeenCalledWith('ending_balance');
		expect(
			within(list).getByRole('button', { name: /Ending balance/ })
		).toHaveAttribute('aria-current', 'true');
	});

	it('activates a citation from the overlay box (both directions sync)', async () => {
		const onActiveFieldChange = vi.fn();
		const { container } = render(BoundingBoxCitations, {
			src: SRC,
			fields: FIELDS,
			onActiveFieldChange
		});

		await screen.findByText('Page 1 of 3');
		const rendered = await screen.findAllByTestId('citation-box');
		expect(rendered.length).toBeGreaterThan(0);

		const pageOne = container.querySelector('[data-page-number="1"]');
		await fireEvent.click(within(pageOne as HTMLElement).getByTestId('citation-box'));

		expect(onActiveFieldChange).toHaveBeenCalledWith('statement_period');
		const list = screen.getByTestId('citation-list');
		expect(
			within(list).getByRole('button', { name: /Statement period/ })
		).toHaveAttribute('aria-current', 'true');
	});

	it('notifies hover through onLocationHover', async () => {
		const onLocationHover = vi.fn();
		render(BoundingBoxCitations, {
			src: SRC,
			fields: FIELDS,
			onLocationHover
		});

		const list = await screen.findByTestId('citation-list');
		const item = within(list).getByRole('button', { name: /Statement period/ });
		await fireEvent.mouseEnter(item);
		expect(onLocationHover).toHaveBeenCalledWith(
			expect.objectContaining({ page: 1 })
		);
		await fireEvent.mouseLeave(item);
		expect(onLocationHover).toHaveBeenLastCalledWith(undefined);
	});

	it('selects fields without a location but renders no box for them', async () => {
		const onActiveFieldChange = vi.fn();
		const { container } = render(BoundingBoxCitations, {
			src: SRC,
			fields: FIELDS,
			onActiveFieldChange
		});

		const list = await screen.findByTestId('citation-list');
		await screen.findByText('Page 1 of 3');
		await fireEvent.click(
			within(list).getByRole('button', { name: /Account details/ })
		);

		expect(onActiveFieldChange).toHaveBeenCalledWith('account_details');
		expect(container.querySelector('[data-field-key="account_details"]')).toBeNull();
	});

	it('reflects the parent-controlled dark mode', async () => {
		const { unmount } = render(BoundingBoxCitations, {
			src: SRC,
			fields: FIELDS,
			isDark: false
		});

		const root = await screen.findByTestId('bounding-box-citations');
		expect(root).toHaveAttribute('data-dark', 'false');
		expect(root.classList.contains('dark')).toBe(false);
		unmount();

		render(BoundingBoxCitations, { src: SRC, fields: FIELDS, isDark: true });
		const darkRoot = await screen.findByTestId('bounding-box-citations');
		expect(darkRoot).toHaveAttribute('data-dark', 'true');
		expect(darkRoot.classList.contains('dark')).toBe(true);
	});

	it('forwards the viewer dark-mode toggle to the parent', async () => {
		const onIsDarkChange = vi.fn();
		render(BoundingBoxCitations, {
			src: SRC,
			fields: FIELDS,
			isDark: false,
			onIsDarkChange
		});

		const toggle = await screen.findByRole('switch', { name: 'Toggle dark mode' });
		await fireEvent.click(toggle);
		expect(onIsDarkChange).toHaveBeenCalledTimes(1);
		expect(onIsDarkChange).toHaveBeenCalledWith(true);
	});
});

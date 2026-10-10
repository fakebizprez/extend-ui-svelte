// MIT License — Svelte 5 port of Extend UI bounding-box-citations. Upstream: extend-hq/ui (MIT).
// Component tests: run in the Vitest client (jsdom) project.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import HumanReviewPanel from './HumanReviewPanel.svelte';
import { REVIEW_FIELDS } from './review.js';

function card(key: string): HTMLElement {
	const element = document.querySelector<HTMLElement>(`[data-review-field="${key}"]`);
	if (!element) throw new Error(`no card for ${key}`);
	return element;
}

function grid(fieldKey: string, label: 'Actual' | 'Expected'): HTMLElement {
	return within(card(fieldKey)).getAllByRole('grid', { name: label })[0];
}

function cell(gridElement: HTMLElement, row: number, column: string): HTMLElement {
	const element = gridElement.querySelector<HTMLElement>(
		`[data-row="${row}"][data-column="${column}"]`
	);
	if (!element) throw new Error(`no cell ${row}:${column}`);
	return element;
}

function tabPanel(name: 'Form' | 'JSON'): HTMLElement {
	const tab = screen.getByRole('tab', { name });
	return document.getElementById(tab.getAttribute('aria-controls') ?? '')!;
}

function jsonPanel(): HTMLElement {
	return tabPanel('JSON');
}

describe('HumanReviewPanel', () => {
	it('renders a card per sample field with title, key, and type badge', () => {
		render(HumanReviewPanel);

		for (const field of REVIEW_FIELDS) {
			const element = card(field.key);
			expect(within(element).getByText(field.schema.title!)).toBeInTheDocument();
			expect(within(element).getAllByText(field.schema.type)[0]).toBeInTheDocument();
		}
		expect(within(card('statement_period')).getByText('statement_period')).toBeInTheDocument();
	});

	it('shows actual and expected values side by side for primitives', () => {
		render(HumanReviewPanel);

		const period = card('statement_period');
		expect(within(period).getByText('Actual')).toBeInTheDocument();
		expect(within(period).getByText('Jan 1-31, 2026')).toBeInTheDocument();
		expect(within(period).getByText('Date range covered by the bank statement.')).toBeInTheDocument();
		expect(within(period).getByLabelText('Expected statement_period')).toHaveValue(
			'January 1-31, 2026'
		);
		expect(within(card('ending_balance')).getByLabelText('Expected ending_balance')).toHaveValue(
			12858.18
		);
	});

	it('marks an edited field modified and undo restores the expected value', async () => {
		render(HumanReviewPanel);

		const period = card('statement_period');
		expect(period).toHaveAttribute('data-modified', 'false');
		expect(within(period).queryByRole('button', { name: 'Undo statement_period' })).toBeNull();

		const input = within(period).getByLabelText('Expected statement_period');
		await fireEvent.input(input, { target: { value: 'Jan 2026' } });
		expect(period).toHaveAttribute('data-modified', 'true');

		await fireEvent.click(within(period).getByRole('button', { name: 'Undo statement_period' }));
		expect(input).toHaveValue('January 1-31, 2026');
		expect(period).toHaveAttribute('data-modified', 'false');
	});

	it('sets a field to NULL', async () => {
		render(HumanReviewPanel);

		const balance = card('ending_balance');
		await fireEvent.click(within(balance).getByRole('button', { name: 'Set ending_balance to null' }));
		expect(within(balance).getByLabelText('Expected ending_balance')).toHaveValue(null);
		expect(balance).toHaveAttribute('data-modified', 'true');
		expect(jsonPanel().textContent).toContain('"ending_balance": null');
	});

	it('edits numbers as numbers and booleans with True/False toggles', async () => {
		render(HumanReviewPanel);

		const balance = within(card('ending_balance')).getByLabelText('Expected ending_balance');
		await fireEvent.input(balance, { target: { value: '100.5' } });
		expect(jsonPanel().textContent).toContain('"ending_balance": 100.5');

		const overdraft = card('overdraft_protection_enabled');
		const trueButton = within(overdraft).getByRole('button', { name: 'True' });
		const falseButton = within(overdraft).getByRole('button', { name: 'False' });
		expect(trueButton).toHaveAttribute('aria-pressed', 'true');
		await fireEvent.click(falseButton);
		expect(falseButton).toHaveAttribute('aria-pressed', 'true');
		expect(overdraft).toHaveAttribute('data-modified', 'true');
	});

	it('switches between the Form and JSON tabs', async () => {
		render(HumanReviewPanel);

		const formTab = screen.getByRole('tab', { name: 'Form' });
		const jsonTab = screen.getByRole('tab', { name: 'JSON' });
		expect(formTab).toHaveAttribute('aria-selected', 'true');
		expect(jsonPanel()).not.toBeVisible();

		await fireEvent.click(jsonTab);
		expect(jsonTab).toHaveAttribute('aria-selected', 'true');
		expect(jsonPanel()).toBeVisible();
		expect(tabPanel('Form')).not.toBeVisible();

		await fireEvent.keyDown(jsonTab, { key: 'ArrowLeft' });
		expect(formTab).toHaveAttribute('aria-selected', 'true');
	});

	it('shows a split diff of actual against the edited expected output', async () => {
		render(HumanReviewPanel);

		const diff = within(jsonPanel()).getByTestId('json-diff');
		const removed = diff.querySelectorAll('[data-kind="removed"]');
		const added = diff.querySelectorAll('[data-kind="added"]');
		expect([...removed].map((line) => line.textContent).join('\n')).toContain('"Jan 1-31, 2026"');
		expect([...added].map((line) => line.textContent).join('\n')).toContain('"January 1-31, 2026"');

		await fireEvent.input(within(card('statement_period')).getByLabelText('Expected statement_period'), {
			target: { value: 'Jan 1-31, 2026' }
		});
		const addedAfter = [...diff.querySelectorAll('[data-kind="added"]')].map((line) => line.textContent);
		expect(addedAfter.join('\n')).not.toContain('statement_period');
	});

	it('expands collapsed unchanged lines in the diff', async () => {
		const fields = [
			{
				key: 'items',
				schema: { type: 'array' as const, items: { type: 'string' as const } },
				actual: Array.from({ length: 20 }, (_, index) => `v${index}`),
				expected: Array.from({ length: 20 }, (_, index) => (index === 19 ? 'changed' : `v${index}`))
			}
		];
		render(HumanReviewPanel, { fields });
		await fireEvent.click(screen.getByRole('tab', { name: 'JSON' }));

		const toggle = within(jsonPanel()).getByRole('button', { name: /unmodified lines/ });
		const v2Lines = () =>
			[...jsonPanel().querySelectorAll('[data-kind]')].filter((line) =>
				line.textContent?.includes('"v2",')
			);
		expect(v2Lines()).toHaveLength(0);
		await fireEvent.click(toggle);
		expect(v2Lines()).toHaveLength(2);
	});

	it('hides expected values, undo, Set to NULL, and the diff when showExpected is false', () => {
		render(HumanReviewPanel, { showExpected: false });

		const period = card('statement_period');
		expect(within(period).queryByText('Expected')).toBeNull();
		expect(within(period).queryByLabelText('Expected statement_period')).toBeNull();
		expect(within(period).queryByRole('button', { name: 'Set statement_period to null' })).toBeNull();
		expect(within(card('transactions')).queryByRole('grid', { name: 'Expected' })).toBeNull();
		expect(within(jsonPanel()).queryByTestId('json-diff')).toBeNull();
		expect(within(jsonPanel()).getByTestId('json-code').textContent).toContain('"Jan 1-31, 2026"');
	});

	it('renders array fields as Actual and Expected grids with row counts and headers', () => {
		render(HumanReviewPanel);

		const actual = grid('transactions', 'Actual');
		const expected = grid('transactions', 'Expected');
		expect(within(card('transactions')).getAllByText('2 rows')).toHaveLength(2);
		for (const title of ['Date', 'Description', 'Amount', 'Category', 'Merchant', 'Tags']) {
			expect(within(actual).getByRole('columnheader', { name: title })).toBeInTheDocument();
		}
		expect(cell(actual, 1, 'amount')).toHaveTextContent('-86.42');
		expect(cell(expected, 1, 'amount')).toHaveTextContent('-68.42');
		expect(cell(actual, 0, 'merchant')).toHaveTextContent('3 fields');
		expect(cell(actual, 0, 'tags')).toHaveTextContent('2 items');
	});

	it('edits an expected grid cell on double-click and commits with Enter', async () => {
		render(HumanReviewPanel);

		const expected = grid('transactions', 'Expected');
		await fireEvent.dblClick(cell(expected, 1, 'amount'));
		const editor = within(expected).getByRole('textbox', { name: 'Edit cell' });
		expect(editor).toHaveValue('-68.42');
		await fireEvent.input(editor, { target: { value: '-70' } });
		await fireEvent.keyDown(editor, { key: 'Enter' });

		expect(within(expected).queryByRole('textbox', { name: 'Edit cell' })).toBeNull();
		expect(cell(expected, 1, 'amount')).toHaveTextContent('-70');
		expect(card('transactions')).toHaveAttribute('data-modified', 'true');
		expect(cell(expected, 1, 'amount').closest('[role="row"]')).toBeTruthy();
	});

	it('cancels a grid edit with Escape', async () => {
		render(HumanReviewPanel);

		const expected = grid('transactions', 'Expected');
		await fireEvent.dblClick(cell(expected, 0, 'category'));
		const editor = within(expected).getByRole('textbox', { name: 'Edit cell' });
		await fireEvent.input(editor, { target: { value: 'Other' } });
		await fireEvent.keyDown(editor, { key: 'Escape' });
		expect(cell(expected, 0, 'category')).toHaveTextContent('Deposit');
		expect(card('transactions')).toHaveAttribute('data-modified', 'false');
	});

	it('keeps the actual grid read-only', async () => {
		render(HumanReviewPanel);

		const actual = grid('transactions', 'Actual');
		await fireEvent.dblClick(cell(actual, 0, 'category'));
		const editor = within(actual).getByRole('textbox', { name: 'Edit cell' });
		expect(editor).toHaveAttribute('readonly');
		await fireEvent.input(editor, { target: { value: 'Other' } });
		await fireEvent.keyDown(editor, { key: 'Enter' });
		expect(cell(actual, 0, 'category')).toHaveTextContent('Deposit');
	});

	it('mirrors a cell selection onto the other grid', async () => {
		render(HumanReviewPanel);

		const actual = grid('transactions', 'Actual');
		const expected = grid('transactions', 'Expected');
		await fireEvent.click(cell(actual, 1, 'amount'));
		expect(cell(actual, 1, 'amount')).toHaveAttribute('aria-selected', 'true');
		expect(cell(expected, 1, 'amount')).toHaveAttribute('data-mirrored', 'true');
	});

	it('drills into a nested object cell on both grids and edits it', async () => {
		render(HumanReviewPanel);

		await fireEvent.dblClick(cell(grid('transactions', 'Expected'), 1, 'merchant'));
		const views = within(card('transactions')).getAllByTestId('array-nested-view');
		expect(views).toHaveLength(2);
		for (const view of views) expect(view).toHaveTextContent('Merchant / row 2');

		const expectedView = views[1];
		const risk = within(expectedView).getByLabelText('Expected risk_level');
		expect(risk).toHaveValue('low');
		await fireEvent.input(risk, { target: { value: 'high' } });
		expect(jsonPanel().textContent).toContain('"risk_level": "high"');

		await fireEvent.click(within(views[0]).getByRole('button', { name: 'Back to parent array' }));
		expect(within(card('transactions')).queryAllByTestId('array-nested-view')).toHaveLength(0);
	});

	it('drills into a nested array cell with its own grid', async () => {
		render(HumanReviewPanel);

		await fireEvent.dblClick(cell(grid('transactions', 'Actual'), 1, 'tags'));
		const views = within(card('transactions')).getAllByTestId('array-nested-view');
		expect(views[0]).toHaveTextContent('Tags / row 2');
		const nestedExpected = within(views[1]).getByRole('grid', { name: 'Tags' });
		expect(within(views[1]).getByText('3 rows')).toBeInTheDocument();
		expect(cell(nestedExpected, 2, 'value')).toHaveTextContent('needs_review');

		await fireEvent.dblClick(cell(nestedExpected, 2, 'value'));
		const editor = within(nestedExpected).getByRole('textbox', { name: 'Edit cell' });
		await fireEvent.input(editor, { target: { value: 'flagged' } });
		await fireEvent.keyDown(editor, { key: 'Enter' });
		expect(jsonPanel().textContent).toContain('"flagged"');
	});

	it('opens a complex cell from the keyboard with Enter', async () => {
		render(HumanReviewPanel);

		const actual = grid('transactions', 'Actual');
		await fireEvent.click(cell(actual, 0, 'merchant'));
		await fireEvent.keyDown(actual, { key: 'Enter' });
		expect(within(card('transactions')).getAllByTestId('array-nested-view')).toHaveLength(2);
	});

	it('renders object fields as nested cards with their own undo', async () => {
		render(HumanReviewPanel);

		const account = card('account_details');
		expect(within(account).getAllByText('Properties')).toHaveLength(2);
		expect(within(account).getAllByText('5 fields').length).toBeGreaterThan(0);
		const address = card('account_details.mailing_address');
		const city = within(address).getByLabelText('Expected account_details.mailing_address.city');
		expect(city).toHaveValue('New York');
		expect(within(address).getByText('Brooklyn')).toBeInTheDocument();

		await fireEvent.input(city, { target: { value: 'Queens' } });
		expect(card('account_details.mailing_address.city')).toHaveAttribute('data-modified', 'true');
		expect(account).toHaveAttribute('data-modified', 'true');
		await fireEvent.click(
			within(card('account_details.mailing_address.city')).getByRole('button', {
				name: 'Undo account_details.mailing_address.city'
			})
		);
		expect(city).toHaveValue('New York');
		expect(account).toHaveAttribute('data-modified', 'false');
		expect(within(card('account_details')).getAllByRole('grid', { name: 'Expected' })).toHaveLength(1);
	});

	it('reports focus with the innermost field and highlights the active card', async () => {
		const onFieldFocus = vi.fn();
		const onLocationHover = vi.fn();
		const { rerender } = render(HumanReviewPanel, { onFieldFocus, onLocationHover });

		await fireEvent.focusIn(within(card('overdraft_protection_enabled')).getByRole('button', { name: 'True' }));
		expect(onFieldFocus).toHaveBeenLastCalledWith(
			expect.objectContaining({ key: 'overdraft_protection_enabled' })
		);
		expect(onLocationHover).toHaveBeenLastCalledWith({
			page: 2,
			area: { left: 9.5, top: 12, width: 81, height: 11.5 }
		});

		await fireEvent.focusIn(card('account_details.holder_name'));
		expect(onFieldFocus).toHaveBeenLastCalledWith(
			expect.objectContaining({ key: 'account_details.holder_name' })
		);

		await rerender({ activeFieldKey: 'account_details.holder_name' });
		expect(card('account_details.holder_name')).toHaveAttribute('data-active', 'true');
		expect(card('account_details')).toHaveAttribute('data-active', 'true');
		expect(card('statement_period')).toHaveAttribute('data-active', 'false');
	});

	it('reports hover locations for cards and array cells', async () => {
		const onLocationHover = vi.fn();
		const resolveLocation = vi.fn((path: string) =>
			path === 'transactions[1].amount' ? { page: 3, area: { left: 1, top: 2, width: 3, height: 4 } } : undefined
		);
		render(HumanReviewPanel, { onLocationHover, resolveLocation });

		await fireEvent.mouseEnter(card('statement_period'));
		expect(onLocationHover).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }));
		await fireEvent.mouseLeave(card('statement_period'));
		expect(onLocationHover).toHaveBeenLastCalledWith(undefined);

		await fireEvent.mouseEnter(cell(grid('transactions', 'Actual'), 1, 'amount'));
		expect(resolveLocation).toHaveBeenCalledWith('transactions[1].amount');
		expect(onLocationHover).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3 }));
	});

	it('resets edits when new fields arrive and honors initial values', async () => {
		const { rerender } = render(HumanReviewPanel, {
			values: { ...Object.fromEntries(REVIEW_FIELDS.map((field) => [field.key, field.expected])), statement_period: 'Seed' }
		});
		const input = () => within(card('statement_period')).getByLabelText('Expected statement_period');
		expect(input()).toHaveValue('Seed');

		await rerender({ fields: REVIEW_FIELDS.slice(0, 1) });
		expect(input()).toHaveValue('January 1-31, 2026');
	});

	it('reflects parent-controlled dark mode and merges class with className', () => {
		render(HumanReviewPanel, { isDark: true, class: 'one', className: 'two' });
		const root = screen.getByTestId('human-review-panel');
		expect(root).toHaveClass('dark', 'one', 'two');
		expect(root).toHaveAttribute('data-dark', 'true');
	});
});

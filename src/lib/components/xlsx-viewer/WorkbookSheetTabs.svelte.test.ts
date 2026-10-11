// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
// Component tests: run in the Vitest client (jsdom) project.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { WorkbookSheetTabs } from './index.js';

const SHEETS = ['Inventory', 'Summary', 'Notes'];

describe('WorkbookSheetTabs', () => {
	it('renders one tab per sheet with the active one selected', () => {
		render(WorkbookSheetTabs, {
			sheets: SHEETS,
			activeSheetIndex: 1,
			onActiveSheetIndexChange: () => {}
		});

		const tabs = screen.getAllByRole('tab');
		expect(screen.getByRole('tablist', { name: 'Sheets' })).toBeVisible();
		expect(tabs.map((tab) => tab.textContent?.trim())).toEqual(SHEETS);
		expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
		// Roving focus, like Base UI Tabs: only one tab is in the tab order.
		expect(tabs.map((tab) => tab.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);
	});

	it('reports the clicked sheet index', async () => {
		const onActiveSheetIndexChange = vi.fn();
		render(WorkbookSheetTabs, { sheets: SHEETS, activeSheetIndex: 0, onActiveSheetIndexChange });

		await fireEvent.click(screen.getByRole('tab', { name: 'Notes' }));
		expect(onActiveSheetIndexChange).toHaveBeenCalledWith(2);
	});

	it('moves focus only with the arrow, Home, and End keys, like upstream (no activateOnFocus)', async () => {
		const onActiveSheetIndexChange = vi.fn();
		render(WorkbookSheetTabs, { sheets: SHEETS, activeSheetIndex: 0, onActiveSheetIndexChange });
		const [inventory, summary, notes] = screen.getAllByRole('tab') as HTMLElement[];
		inventory?.focus();

		await fireEvent.keyDown(inventory as HTMLElement, { key: 'ArrowRight' });
		expect(summary).toHaveFocus();
		// The focused tab joins the tab order; the selection does not move.
		expect(summary).toHaveAttribute('tabindex', '0');
		expect(inventory).toHaveAttribute('tabindex', '-1');
		expect(inventory).toHaveAttribute('aria-selected', 'true');
		await fireEvent.keyDown(summary as HTMLElement, { key: 'ArrowRight' });
		expect(notes).toHaveFocus();
		// Focus loops at the ends.
		await fireEvent.keyDown(notes as HTMLElement, { key: 'ArrowRight' });
		expect(inventory).toHaveFocus();
		await fireEvent.keyDown(inventory as HTMLElement, { key: 'ArrowLeft' });
		expect(notes).toHaveFocus();
		await fireEvent.keyDown(notes as HTMLElement, { key: 'Home' });
		expect(inventory).toHaveFocus();
		await fireEvent.keyDown(inventory as HTMLElement, { key: 'End' });
		expect(notes).toHaveFocus();
		expect(onActiveSheetIndexChange).not.toHaveBeenCalled();

		// Enter/Space press the focused tab (a native button click) to activate it.
		await fireEvent.click(notes as HTMLElement);
		expect(onActiveSheetIndexChange).toHaveBeenCalledExactlyOnceWith(2);
	});

	it('returns the tab order to the active tab when focus leaves the list', async () => {
		render(WorkbookSheetTabs, {
			sheets: SHEETS,
			activeSheetIndex: 0,
			onActiveSheetIndexChange: () => {}
		});
		const [inventory, summary] = screen.getAllByRole('tab') as HTMLElement[];
		inventory?.focus();
		await fireEvent.keyDown(inventory as HTMLElement, { key: 'ArrowRight' });
		expect(summary).toHaveAttribute('tabindex', '0');

		await fireEvent.focusOut(summary as HTMLElement, { relatedTarget: document.body });
		expect(inventory).toHaveAttribute('tabindex', '0');
		expect(summary).toHaveAttribute('tabindex', '-1');
	});

	it('ignores a click on the tab that is already active, like upstream', async () => {
		const onActiveSheetIndexChange = vi.fn();
		render(WorkbookSheetTabs, { sheets: SHEETS, activeSheetIndex: 1, onActiveSheetIndexChange });

		await fireEvent.click(screen.getByRole('tab', { name: 'Summary' }));
		expect(onActiveSheetIndexChange).not.toHaveBeenCalled();
	});

	it('renders nothing for a single-sheet workbook, like upstream', () => {
		const { container } = render(WorkbookSheetTabs, {
			sheets: ['Only'],
			activeSheetIndex: 0,
			onActiveSheetIndexChange: () => {}
		});

		expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
		expect(container.textContent?.trim()).toBe('');
	});
});

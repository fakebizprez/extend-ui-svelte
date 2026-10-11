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
		// Roving focus, like Radix Tabs: only the active tab is in the tab order.
		expect(tabs.map((tab) => tab.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);
	});

	it('reports the clicked sheet index', async () => {
		const onActiveSheetIndexChange = vi.fn();
		render(WorkbookSheetTabs, { sheets: SHEETS, activeSheetIndex: 0, onActiveSheetIndexChange });

		await fireEvent.click(screen.getByRole('tab', { name: 'Notes' }));
		expect(onActiveSheetIndexChange).toHaveBeenCalledWith(2);
	});

	it('moves between sheets with the arrow, Home, and End keys', async () => {
		const onActiveSheetIndexChange = vi.fn();
		render(WorkbookSheetTabs, { sheets: SHEETS, activeSheetIndex: 0, onActiveSheetIndexChange });
		const first = screen.getByRole('tab', { name: 'Inventory' });

		await fireEvent.keyDown(first, { key: 'ArrowRight' });
		expect(onActiveSheetIndexChange).toHaveBeenLastCalledWith(1);
		expect(screen.getByRole('tab', { name: 'Summary' })).toHaveFocus();
		await fireEvent.keyDown(first, { key: 'ArrowLeft' });
		expect(onActiveSheetIndexChange).toHaveBeenLastCalledWith(2);
		await fireEvent.keyDown(first, { key: 'End' });
		expect(onActiveSheetIndexChange).toHaveBeenLastCalledWith(2);
		await fireEvent.keyDown(first, { key: 'Home' });
		expect(onActiveSheetIndexChange).toHaveBeenLastCalledWith(0);
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

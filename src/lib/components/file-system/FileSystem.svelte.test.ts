// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import FileSystem from './FileSystem.svelte';
import { FileSystem as FileSystemExport } from './index.js';
import type { FileSystemFileItem, FileSystemItem } from './types.js';

const ITEMS: FileSystemItem[] = [
	{ kind: 'folder', path: 'invoices/' },
	{ kind: 'folder', path: 'invoices/2026/' },
	{ kind: 'file', path: 'invoices/2026/jan.pdf', contentType: 'application/pdf' },
	{ kind: 'file', path: 'readme.txt', contentType: 'text/plain' }
];

/** The row's mouse-only disclosure chevron (hidden from assistive tech, like upstream). */
function chevron(name: string): HTMLElement {
	return within(treeitem(name)).getByTestId('file-system-toggle');
}

function treeitem(name: string): HTMLElement {
	return screen.getByRole('treeitem', { name: new RegExp(name) });
}

describe('FileSystem', () => {
	it('renders the title and root-level entries', () => {
		render(FileSystem, { items: ITEMS, title: 'Files' });

		expect(screen.getByText('Files')).toBeInTheDocument();
		expect(treeitem('invoices')).toBeInTheDocument();
		expect(treeitem('readme.txt')).toBeInTheDocument();
		expect(screen.queryByRole('treeitem', { name: /jan\.pdf/ })).not.toBeInTheDocument();
	});

	it('expands and collapses a folder, revealing its children', async () => {
		render(FileSystem, { items: ITEMS });

		const folder = treeitem('invoices');
		expect(folder).toHaveAttribute('aria-expanded', 'false');

		await fireEvent.click(chevron('invoices'));

		expect(treeitem('invoices')).toHaveAttribute('aria-expanded', 'true');
		expect(treeitem('2026')).toBeInTheDocument();

		await fireEvent.click(chevron('invoices'));

		expect(treeitem('invoices')).toHaveAttribute('aria-expanded', 'false');
		expect(screen.queryByRole('treeitem', { name: /2026/ })).not.toBeInTheDocument();
	});

	it('opens folders along defaultPath initially', () => {
		render(FileSystem, { items: ITEMS, defaultPath: 'invoices/2026/' });

		expect(treeitem('invoices')).toHaveAttribute('aria-expanded', 'true');
		expect(treeitem('2026')).toHaveAttribute('aria-expanded', 'true');
		expect(treeitem('jan.pdf')).toBeInTheDocument();
	});

	it('selects an entry on click and emits onSelectionChange', async () => {
		const onSelectionChange = vi.fn();
		render(FileSystem, { items: ITEMS, defaultPath: 'invoices/', onSelectionChange });

		await fireEvent.click(treeitem('2026'));

		expect(onSelectionChange).toHaveBeenCalledTimes(1);
		expect(onSelectionChange).toHaveBeenCalledWith(
			expect.objectContaining({ kind: 'folder', path: 'invoices/2026/' })
		);
		expect(treeitem('2026')).toHaveAttribute('aria-selected', 'true');
		expect(treeitem('invoices')).toHaveAttribute('aria-selected', 'false');
	});

	it('moves focus with ArrowDown and ArrowUp', async () => {
		render(FileSystem, { items: ITEMS });

		const first = treeitem('invoices');
		const second = treeitem('readme.txt');
		first.focus();

		await fireEvent.keyDown(first, { key: 'ArrowDown' });
		expect(document.activeElement).toBe(second);

		await fireEvent.keyDown(second, { key: 'ArrowUp' });
		expect(document.activeElement).toBe(first);
	});

	it('expands and collapses with ArrowRight and ArrowLeft', async () => {
		render(FileSystem, { items: ITEMS });

		const folder = treeitem('invoices');
		folder.focus();

		await fireEvent.keyDown(folder, { key: 'ArrowRight' });
		expect(treeitem('invoices')).toHaveAttribute('aria-expanded', 'true');

		await fireEvent.keyDown(treeitem('invoices'), { key: 'ArrowRight' });
		expect(document.activeElement).toBe(treeitem('2026'));

		await fireEvent.keyDown(treeitem('2026'), { key: 'ArrowLeft' });
		expect(document.activeElement).toBe(treeitem('invoices'));

		await fireEvent.keyDown(treeitem('invoices'), { key: 'ArrowLeft' });
		expect(treeitem('invoices')).toHaveAttribute('aria-expanded', 'false');
	});

	it('selects the focused entry with Enter and jumps with Home and End', async () => {
		const onSelectionChange = vi.fn();
		render(FileSystem, { items: ITEMS, onSelectionChange });

		const first = treeitem('invoices');
		const last = treeitem('readme.txt');

		await fireEvent.keyDown(first, { key: 'End' });
		expect(document.activeElement).toBe(last);

		await fireEvent.keyDown(last, { key: 'Enter' });
		expect(onSelectionChange).toHaveBeenCalledWith(
			expect.objectContaining({ kind: 'file', path: 'readme.txt' })
		);

		await fireEvent.keyDown(last, { key: 'Home' });
		expect(document.activeElement).toBe(treeitem('invoices'));
	});

	it('renames inline: F2 opens the editor, Enter commits and emits onRename', async () => {
		const onRename = vi.fn();
		render(FileSystem, { items: ITEMS, onRename });

		const row = treeitem('readme.txt');
		row.focus();
		await fireEvent.keyDown(row, { key: 'F2' });

		const input = screen.getByRole('textbox', { name: 'Rename readme.txt' });
		expect(input).toBeInTheDocument();
		expect(input).toHaveValue('readme.txt');

		await fireEvent.input(input, { target: { value: 'notes.txt' } });
		await fireEvent.keyDown(input, { key: 'Enter' });

		expect(onRename).toHaveBeenCalledTimes(1);
		expect(onRename).toHaveBeenCalledWith(
			expect.objectContaining({ kind: 'file', path: 'readme.txt' }),
			'notes.txt'
		);
		expect(treeitem('notes.txt')).toBeInTheDocument();
		expect(screen.queryByRole('textbox', { name: /Rename/ })).not.toBeInTheDocument();
	});

	it('cancels a rename with Escape without emitting onRename', async () => {
		const onRename = vi.fn();
		render(FileSystem, { items: ITEMS, onRename });

		const row = treeitem('readme.txt');
		row.focus();
		await fireEvent.keyDown(row, { key: 'F2' });

		const input = screen.getByRole('textbox', { name: 'Rename readme.txt' });
		await fireEvent.input(input, { target: { value: 'notes.txt' } });
		await fireEvent.keyDown(input, { key: 'Escape' });

		expect(onRename).not.toHaveBeenCalled();
		expect(treeitem('readme.txt')).toBeInTheDocument();
	});

	it('does not offer rename when renamable is false', async () => {
		render(FileSystem, { items: ITEMS, renamable: false });

		const row = treeitem('readme.txt');
		row.focus();
		await fireEvent.keyDown(row, { key: 'F2' });

		expect(screen.queryByRole('textbox', { name: /Rename/ })).not.toBeInTheDocument();
	});

	it('dark-mode contract: isDark sets the dark class', () => {
		render(FileSystem, { items: ITEMS, isDark: true });

		expect(screen.getByTestId('file-system')).toHaveClass('dark');
	});

	it('renders no theme toggle of its own, like upstream', () => {
		const onIsDarkChange = vi.fn();
		render(FileSystem, { items: ITEMS, isDark: false, onIsDarkChange });

		expect(screen.queryByRole('button', { name: /dark mode/i })).not.toBeInTheDocument();
		expect(onIsDarkChange).not.toHaveBeenCalled();
	});

	it('accepts class alongside the upstream className on the root', () => {
		render(FileSystem, { items: ITEMS, class: 'from-class', className: 'from-class-name' });

		expect(screen.getByTestId('file-system')).toHaveClass(
			'file-system',
			'from-class',
			'from-class-name'
		);
	});

	it('is exported under the upstream name FileSystem', () => {
		expect(FileSystemExport).toBe(FileSystem);
	});

	it('double-clicking a file calls upstream onFileOpen with its url', async () => {
		const onFileOpen = vi.fn();
		const items: FileSystemItem[] = [
			{ kind: 'file', path: 'contract.pdf', url: 'https://cdn.example.com/contract.pdf' }
		];
		render(FileSystem, { items, onFileOpen });

		await fireEvent.dblClick(treeitem('contract.pdf'));

		await vi.waitFor(() => expect(onFileOpen).toHaveBeenCalledTimes(1));
		const [file, url] = onFileOpen.mock.calls[0] as [FileSystemFileItem, string | null];
		expect(file.path).toBe('contract.pdf');
		expect(url).toBe('https://cdn.example.com/contract.pdf');
	});

	it('Enter on a file opens it through onFileOpen, like upstream', async () => {
		const onFileOpen = vi.fn();
		const items: FileSystemItem[] = [
			{ kind: 'file', path: 'contract.pdf', url: 'https://cdn.example.com/contract.pdf' }
		];
		render(FileSystem, { items, onFileOpen });

		await fireEvent.keyDown(treeitem('contract.pdf'), { key: 'Enter' });

		await vi.waitFor(() =>
			expect(onFileOpen).toHaveBeenCalledWith(
				expect.objectContaining({ path: 'contract.pdf' }),
				'https://cdn.example.com/contract.pdf'
			)
		);
	});

	it('Enter on a folder opens it like a double-click instead of opening a file', async () => {
		const onFileOpen = vi.fn();
		render(FileSystem, { items: ITEMS, onFileOpen });

		await fireEvent.keyDown(treeitem('invoices'), { key: 'Enter' });

		expect(treeitem('invoices')).toHaveAttribute('aria-expanded', 'true');
		expect(onFileOpen).not.toHaveBeenCalled();
	});

	it('reports a selection only when it changes, like upstream', async () => {
		const onSelectionChange = vi.fn();
		render(FileSystem, { items: ITEMS, onSelectionChange });

		await fireEvent.click(treeitem('readme.txt'));
		await fireEvent.click(treeitem('readme.txt'));
		await fireEvent.keyDown(treeitem('readme.txt'), { key: 'Enter' });

		expect(onSelectionChange).toHaveBeenCalledTimes(1);
	});

	it('keeps the selection quietly when the selected entry leaves the items, like upstream', async () => {
		// Upstream reports null only when search or a filter hides the entry;
		// the tree has neither, so a removed entry just shows nothing selected.
		const onSelectionChange = vi.fn();
		const { rerender } = render(FileSystem, { items: ITEMS, onSelectionChange });

		await fireEvent.click(treeitem('readme.txt'));
		await rerender({ items: ITEMS.filter((item) => item.path !== 'readme.txt') });

		expect(onSelectionChange).toHaveBeenCalledTimes(1);
		expect(screen.queryByRole('treeitem', { selected: true })).not.toBeInTheDocument();

		// Restoring the entry shows it selected again.
		await rerender({ items: ITEMS });
		expect(screen.getByRole('treeitem', { selected: true })).toHaveTextContent('readme.txt');
	});

	it('keeps a parent-set selection while items are still loading', async () => {
		const onSelectionChange = vi.fn();
		const { rerender } = render(FileSystem, {
			items: [],
			selectedPath: 'readme.txt',
			onSelectionChange
		});

		await rerender({ items: ITEMS, selectedPath: 'readme.txt' });

		expect(onSelectionChange).not.toHaveBeenCalled();
		expect(screen.getByRole('treeitem', { selected: true })).toHaveTextContent('readme.txt');
	});

	it('type-ahead focuses the next visible entry by name prefix, like upstream', async () => {
		vi.useFakeTimers();
		try {
			const items: FileSystemItem[] = [
				{ kind: 'folder', path: 'reports/' },
				{ kind: 'file', path: 'readme.txt' },
				{ kind: 'file', path: 'receipt.pdf' },
				{ kind: 'file', path: 'zeta.csv' }
			];
			render(FileSystem, { items });
			const start = treeitem('zeta.csv');
			start.focus();

			// Letters build a buffer that refines the match in place.
			await fireEvent.keyDown(start, { key: 'r' });
			expect(document.activeElement).toBe(treeitem('reports'));
			await fireEvent.keyDown(document.activeElement!, { key: 'e' });
			expect(document.activeElement).toBe(treeitem('reports'));
			await fireEvent.keyDown(document.activeElement!, { key: 'a' });
			expect(document.activeElement).toBe(treeitem('readme.txt'));

			// After the 700ms idle reset, a single letter advances past the focused row.
			vi.advanceTimersByTime(800);
			await fireEvent.keyDown(document.activeElement!, { key: 'r' });
			expect(document.activeElement).toBe(treeitem('receipt.pdf'));
			vi.advanceTimersByTime(800);
			await fireEvent.keyDown(document.activeElement!, { key: 'r' });
			expect(document.activeElement).toBe(treeitem('reports'));
		} finally {
			vi.useRealTimers();
		}
	});

	it('moves the Tab stop to the collapsed ancestor of the focused row', async () => {
		render(FileSystem, { items: ITEMS, defaultPath: 'invoices/2026/' });

		const folder = treeitem('2026');
		folder.focus();
		await fireEvent.focus(folder);
		await fireEvent.click(chevron('invoices'));

		const stops = screen.getAllByRole('treeitem').filter((row) => row.tabIndex === 0);
		expect(stops).toEqual([treeitem('invoices')]);
	});

	it('keeps the disclosure chevrons out of the Tab order and the accessibility tree, like upstream', () => {
		render(FileSystem, { items: ITEMS, defaultPath: 'invoices/' });

		expect(screen.queryAllByRole('button')).toHaveLength(0);
		const chevrons = screen.getAllByTestId('file-system-toggle');
		expect(chevrons.length).toBeGreaterThan(1);
		for (const toggle of chevrons) {
			expect(toggle).toHaveAttribute('aria-hidden', 'true');
			expect(toggle.tabIndex).toBe(-1);
		}
	});

	it('selection follows keyboard focus, like upstream', async () => {
		const onSelectionChange = vi.fn();
		render(FileSystem, { items: ITEMS, onSelectionChange });

		await fireEvent.keyDown(treeitem('invoices'), { key: 'ArrowDown' });
		expect(onSelectionChange).toHaveBeenLastCalledWith(
			expect.objectContaining({ path: 'readme.txt' })
		);
		expect(treeitem('readme.txt')).toHaveAttribute('aria-selected', 'true');

		await fireEvent.keyDown(treeitem('readme.txt'), { key: 'Home' });
		expect(onSelectionChange).toHaveBeenLastCalledWith(
			expect.objectContaining({ path: 'invoices/' })
		);

		await fireEvent.keyDown(treeitem('invoices'), { key: 'r' });
		expect(onSelectionChange).toHaveBeenLastCalledWith(
			expect.objectContaining({ path: 'readme.txt' })
		);
		expect(onSelectionChange).toHaveBeenCalledTimes(3);
	});

	it('names folder rows by their name only; aria-expanded carries the state, like upstream', () => {
		render(FileSystem, { items: ITEMS, defaultPath: 'invoices/' });

		const invoices = screen.getByRole('treeitem', { name: 'invoices' });
		expect(invoices).toHaveAttribute('aria-expanded', 'true');
		expect(screen.getByRole('treeitem', { name: '2026' })).toHaveAttribute('aria-expanded', 'false');
		expect(screen.getByRole('treeitem', { name: 'readme.txt' })).not.toHaveAttribute('aria-expanded');
	});

	it('resolves a missing file url through upstream getFileUrl before onFileOpen', async () => {
		const onFileOpen = vi.fn();
		const getFileUrl = vi.fn(async (file: FileSystemFileItem) => `https://signed/${file.path}`);
		render(FileSystem, { items: ITEMS, defaultPath: 'invoices/2026/', onFileOpen, getFileUrl });

		await fireEvent.dblClick(treeitem('jan.pdf'));

		await vi.waitFor(() =>
			expect(onFileOpen).toHaveBeenCalledWith(
				expect.objectContaining({ path: 'invoices/2026/jan.pdf' }),
				'https://signed/invoices/2026/jan.pdf'
			)
		);
	});
});

describe('file-system docs', () => {
	it('lists every port-only export under Differences from upstream', async () => {
		const exports = Object.keys(await import('./index.js'));
		const page = (await import('../../../routes/file-system/+page.svelte?raw')).default as string;
		const differences = page.slice(page.indexOf('Differences from upstream'));
		const upstream = new Set(['default', 'FileSystem']);
		const missing = exports.filter(
			(name) => !upstream.has(name) && !differences.includes(`<code>${name}</code>`)
		);
		expect(missing).toEqual([]);
	});
});

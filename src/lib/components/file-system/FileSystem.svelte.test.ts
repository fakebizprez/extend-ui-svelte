// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import FileSystem from './FileSystem.svelte';
import type { FileSystemItem } from './types.js';

const ITEMS: FileSystemItem[] = [
	{ kind: 'folder', path: 'invoices/' },
	{ kind: 'folder', path: 'invoices/2026/' },
	{ kind: 'file', path: 'invoices/2026/jan.pdf', contentType: 'application/pdf' },
	{ kind: 'file', path: 'readme.txt', contentType: 'text/plain' }
];

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

		await fireEvent.click(screen.getByRole('button', { name: 'Expand invoices' }));

		expect(treeitem('invoices')).toHaveAttribute('aria-expanded', 'true');
		expect(treeitem('2026')).toBeInTheDocument();

		await fireEvent.click(screen.getByRole('button', { name: 'Collapse invoices' }));

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

	it('dark-mode toggle notifies onIsDarkChange', async () => {
		const onIsDarkChange = vi.fn();
		render(FileSystem, { items: ITEMS, isDark: false, onIsDarkChange });

		await fireEvent.click(screen.getByRole('button', { name: 'Toggle dark mode' }));

		expect(onIsDarkChange).toHaveBeenCalledTimes(1);
		expect(onIsDarkChange).toHaveBeenCalledWith(true);
	});
});

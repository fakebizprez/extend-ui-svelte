<!--
	MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
	FileSystem: file/folder tree browser with expand/collapse, selection,
	keyboard navigation, and inline rename.
	Ported from apps/v4/components/extend/file-system.tsx (FileSystem).

	Deliberate changes vs the React version:
	- One tree view instead of the icons/list/columns/gallery views, so
	  defaultView/view/onViewChange, toolbar navigation (back/forward, search,
	  sort, filters), thumbnails and the preview pager (previewImageUrl(s),
	  loadPreviewImageUrl, renderFilePreview), lazy loadChildren, and the
	  built-in viewer dialog are not ported. onFileOpen is called on file
	  double-click or Enter (with the url from `url` or getFileUrl); without it
	  nothing opens. Double-click or Enter on a folder expands it in place
	  instead of navigating into it. `class` is accepted alongside the
	  upstream `className`.
	- Dark mode is parent-controlled (isDark). Like upstream there is no theme
	  switch, so onIsDarkChange is accepted and never called.
	- Port additions: bind:selectedPath, onRename, renamable (inline F2 rename).
	- Removing the selected entry from items clears the selection and reports
	  null; upstream reports null only when search, filters or navigation hide it.
-->
<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { resolveIsDark } from '#lib/dark-mode.js';
	import {
		ancestorFolderPaths,
		buildFileSystemIndex,
		flattenVisibleEntries
	} from './tree.js';
	import type { FileSystemEntry, FileSystemFileItem, FileSystemItem } from './types.js';

	interface Props {
		/** Flat manifest. Folders are optional; missing prefixes are inferred from file paths. */
		items: FileSystemItem[];
		className?: string;
		/** Alias of the upstream `className`. */
		class?: string;
		/** Label for the root folder. */
		title?: string;
		/** Folder prefix to open initially, e.g. `"invoices/"`. */
		defaultPath?: string;
		/** Path of the selected entry. Two-way bindable. */
		selectedPath?: string | null;
		onSelectionChange?: (item: FileSystemItem | null) => void;
		/** Called when a file is double-clicked, with its `url` or the getFileUrl result. */
		onFileOpen?: (file: FileSystemFileItem, url: string | null) => void;
		/** Resolve a URL (e.g. presigned) for a file without one. */
		getFileUrl?: (file: FileSystemFileItem) => string | Promise<string>;
		/** Called when an inline rename commits. The tree applies the new name locally. */
		onRename?: (item: FileSystemItem, name: string) => void;
		/** Whether inline rename (F2) is available. Defaults to `true`. */
		renamable?: boolean;
		isDark?: boolean;
		/** Accepted for contract parity; the tree renders no theme switch, so it is never called. */
		onIsDarkChange?: (isDark: boolean) => void;
	}

	let {
		items,
		className = '',
		class: classProp = '',
		title = 'Files',
		defaultPath = '',
		selectedPath = $bindable(null),
		onSelectionChange,
		onFileOpen,
		getFileUrl,
		onRename,
		renamable = true,
		isDark = false
	}: Props = $props();

	const expanded = new SvelteSet(ancestorFolderPaths(defaultPath));
	const renames = new SvelteMap<string, string>();
	let focusPath = $state<string | null>(null);
	let renamingPath = $state<string | null>(null);
	let draftName = $state('');
	let treeElement = $state<HTMLDivElement | null>(null);

	const dark = $derived(resolveIsDark(isDark));
	const index = $derived(buildFileSystemIndex(items));
	const rows = $derived(
		flattenVisibleEntries(index, expanded).map((row) => {
			const override = renames.get(row.entry.path);
			if (!override) return row;
			return { ...row, entry: { ...row.entry, name: override } };
		})
	);
	const tabbedPath = $derived(focusPath ?? rows[0]?.entry.path ?? null);

	function rowElements(): HTMLElement[] {
		if (!treeElement) return [];
		return Array.from(treeElement.querySelectorAll<HTMLElement>('[role="treeitem"]'));
	}

	function focusRow(path: string): void {
		focusPath = path;
		rowElements().find((row) => row.dataset.path === path)?.focus();
	}

	// Like upstream: re-selecting the same entry is a no-op.
	function select(entry: FileSystemEntry): void {
		if (selectedPath === entry.path) return;
		selectedPath = entry.path;
		onSelectionChange?.(entry);
	}

	// A selected entry removed from items clears the selection (upstream does this
	// only for entries hidden by search/filters). A parent-set path that has not
	// appeared yet (items still loading) is kept.
	let presentPath: string | null = null;
	$effect(() => {
		const path = selectedPath;
		if (path === null) return;
		if (index.files.has(path) || index.folders.has(path)) {
			presentPath = path;
			return;
		}
		if (presentPath !== path) return;
		presentPath = null;
		selectedPath = null;
		onSelectionChange?.(null);
	});

	// Upstream's Finder-style type-ahead: letters and digits build a buffer
	// that resets after 700ms idle; a single letter advances past the focused
	// row, a longer buffer refines the match in place.
	const TYPE_AHEAD_RESET_MS = 700;
	let typeAheadBuffer = '';
	let typeAheadTimer: ReturnType<typeof setTimeout> | undefined;
	onDestroy(() => clearTimeout(typeAheadTimer));

	function typeAhead(event: KeyboardEvent, at: number): void {
		if (event.key.length !== 1 || !/^[\p{L}\p{N}]$/u.test(event.key)) return;
		if (event.altKey || event.ctrlKey || event.metaKey) return;
		event.preventDefault();
		clearTimeout(typeAheadTimer);
		typeAheadTimer = setTimeout(() => (typeAheadBuffer = ''), TYPE_AHEAD_RESET_MS);
		typeAheadBuffer += event.key.toLowerCase();
		const start = at < 0 ? 0 : at + (typeAheadBuffer.length === 1 ? 1 : 0);
		for (let step = 0; step < rows.length; step += 1) {
			const row = rows[(start + step) % rows.length];
			if (row.entry.name.toLowerCase().startsWith(typeAheadBuffer)) {
				focusRow(row.entry.path);
				return;
			}
		}
	}

	function toggle(entry: FileSystemEntry): void {
		if (entry.kind !== 'folder') return;
		if (expanded.has(entry.path)) expanded.delete(entry.path);
		else expanded.add(entry.path);
	}

	async function openFile(entry: FileSystemEntry): Promise<void> {
		if (entry.kind !== 'file' || !onFileOpen) return;
		let url: string | null = entry.url ?? null;
		if (!url && getFileUrl) {
			try {
				url = await getFileUrl(entry);
			} catch {
				url = null;
			}
		}
		onFileOpen(entry, url);
	}

	function startRename(entry: FileSystemEntry): void {
		if (!renamable) return;
		renamingPath = entry.path;
		draftName = entry.name;
	}

	async function finishRename(commit: boolean): Promise<void> {
		const path = renamingPath;
		if (path === null) return;
		const row = rows.find((candidate) => candidate.entry.path === path);
		renamingPath = null;
		if (commit && row) {
			const next = draftName.trim();
			if (next && next !== row.entry.name) {
				renames.set(path, next);
				onRename?.(row.entry, next);
			}
		}
		await tick();
		focusRow(path);
	}

	function selectInput(node: HTMLInputElement): void {
		node.focus();
		node.select();
	}

	function onRenameKeyDown(event: KeyboardEvent): void {
		event.stopPropagation();
		if (event.key === 'Enter') {
			event.preventDefault();
			void finishRename(true);
		} else if (event.key === 'Escape') {
			event.preventDefault();
			void finishRename(false);
		}
	}

	function onRowKeyDown(event: KeyboardEvent, entry: FileSystemEntry): void {
		const at = rows.findIndex((row) => row.entry.path === entry.path);
		switch (event.key) {
			case 'ArrowDown': {
				event.preventDefault();
				const next = rows[at + 1];
				if (next) focusRow(next.entry.path);
				break;
			}
			case 'ArrowUp': {
				event.preventDefault();
				const previous = rows[at - 1];
				if (previous) focusRow(previous.entry.path);
				break;
			}
			case 'Home': {
				event.preventDefault();
				const first = rows[0];
				if (first) focusRow(first.entry.path);
				break;
			}
			case 'End': {
				event.preventDefault();
				const last = rows[rows.length - 1];
				if (last) focusRow(last.entry.path);
				break;
			}
			case 'ArrowRight': {
				if (entry.kind !== 'folder') break;
				event.preventDefault();
				if (!expanded.has(entry.path)) {
					expanded.add(entry.path);
				} else {
					const child = index.children.get(entry.path)?.[0];
					if (child) focusRow(child.path);
				}
				break;
			}
			case 'ArrowLeft': {
				event.preventDefault();
				if (entry.kind === 'folder' && expanded.has(entry.path)) {
					expanded.delete(entry.path);
				} else if (entry.parentPath) {
					focusRow(entry.parentPath);
				}
				break;
			}
			// Like upstream, Enter opens: files go to onFileOpen, folders toggle
			// (the tree's double-click action).
			case 'Enter': {
				event.preventDefault();
				select(entry);
				if (entry.kind === 'folder') toggle(entry);
				else void openFile(entry);
				break;
			}
			case 'F2': {
				event.preventDefault();
				startRename(entry);
				break;
			}
			default:
				typeAhead(event, at);
		}
	}
</script>

<div
	data-testid="file-system"
	class={['file-system', classProp, className].filter(Boolean).join(' ')}
	class:dark
	data-theme={dark ? 'dark' : 'light'}
>
	<div class="file-system-header">
		<h2>{title}</h2>
	</div>

	{#if rows.length === 0}
		<p class="file-system-empty">No files</p>
	{:else}
		<div bind:this={treeElement} role="tree" aria-label={title}>
			{#each rows as row (row.entry.path)}
				{@const entry = row.entry}
				{@const isExpanded = entry.kind === 'folder' && expanded.has(entry.path)}
				{@const isRenaming = renamingPath === entry.path}
				<div
					role="treeitem"
					data-path={entry.path}
					aria-selected={selectedPath === entry.path}
					aria-expanded={entry.kind === 'folder' ? isExpanded : undefined}
					aria-level={row.depth + 1}
					tabindex={tabbedPath === entry.path ? 0 : -1}
					class="file-system-row"
					class:selected={selectedPath === entry.path}
					style={`--fs-depth: ${row.depth}`}
					onclick={() => select(entry)}
					ondblclick={() => (entry.kind === 'folder' ? toggle(entry) : void openFile(entry))}
					onfocus={() => {
						focusPath = entry.path;
					}}
					onkeydown={(event) => onRowKeyDown(event, entry)}
				>
					{#if entry.kind === 'folder'}
						<button
							type="button"
							class="file-system-chevron"
							class:open={isExpanded}
							aria-label={isExpanded ? `Collapse ${entry.name}` : `Expand ${entry.name}`}
							onclick={(event) => {
								event.stopPropagation();
								toggle(entry);
							}}
						>
							<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
								<path
									d="m9 18 6-6-6-6"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
							</svg>
						</button>
						<svg
							class="file-system-icon"
							viewBox="0 0 24 24"
							width="16"
							height="16"
							aria-hidden="true"
						>
							<path
								d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
					{:else}
						<span class="file-system-spacer" aria-hidden="true"></span>
						<svg
							class="file-system-icon"
							viewBox="0 0 24 24"
							width="16"
							height="16"
							aria-hidden="true"
						>
							<path
								d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
							<path
								d="M14 2v4a2 2 0 0 0 2 2h4"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
					{/if}
					{#if isRenaming}
						<input
							type="text"
							aria-label={`Rename ${entry.name}`}
							value={draftName}
							oninput={(event) => {
								draftName = event.currentTarget.value;
							}}
							onkeydown={onRenameKeyDown}
							onblur={() => {
								if (renamingPath !== null) void finishRename(true);
							}}
							onclick={(event) => event.stopPropagation()}
							ondblclick={(event) => event.stopPropagation()}
							use:selectInput
						/>
					{:else}
						<span class="file-system-name">{entry.name}</span>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.file-system {
		border: 1px solid #d4d4d4;
		border-radius: 0.5rem;
		background: #ffffff;
		color: #171717;
		font-size: 0.875rem;
	}

	.file-system.dark {
		border-color: #404040;
		background: #171717;
		color: #e5e5e5;
	}

	.file-system-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid #d4d4d4;
	}

	.dark .file-system-header {
		border-bottom-color: #404040;
	}

	.file-system-header h2 {
		margin: 0;
		font-size: 0.875rem;
		font-weight: 600;
	}

	.file-system-empty {
		margin: 0;
		padding: 1rem 0.75rem;
		color: #737373;
	}

	.file-system-row {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.25rem 0.75rem 0.25rem calc(var(--fs-depth, 0) * 1.25rem + 0.5rem);
		cursor: default;
		border-radius: 0.25rem;
	}

	.file-system-row.selected {
		background: #e5e5e5;
	}

	.dark .file-system-row.selected {
		background: #404040;
	}

	.file-system-row:focus-visible {
		outline: 2px solid #2563eb;
		outline-offset: -2px;
	}

	.file-system-chevron {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.125rem;
		border: none;
		border-radius: 0.25rem;
		background: transparent;
		color: inherit;
		cursor: pointer;
	}

	.file-system-chevron svg {
		transform: rotate(0deg);
		transition: transform 0.1s ease-in-out;
	}

	.file-system-chevron.open svg {
		transform: rotate(90deg);
	}

	.file-system-spacer {
		display: inline-block;
		width: 22px;
	}

	.file-system-icon {
		flex: none;
	}

	.file-system-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>

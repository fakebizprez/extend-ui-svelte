<!-- MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT). -->
<script lang="ts">
	import FileSystem from '../../lib/components/file-system/FileSystem.svelte';
	import type {
		FileSystemFileItem,
		FileSystemItem
	} from '../../lib/components/file-system/types.js';

	const items: FileSystemItem[] = [
		{ kind: 'folder', path: 'invoices/' },
		{ kind: 'folder', path: 'invoices/2026/' },
		{ kind: 'file', path: 'invoices/2026/jan.pdf', contentType: 'application/pdf' },
		{ kind: 'file', path: 'invoices/2026/feb.pdf', contentType: 'application/pdf' },
		{ kind: 'file', path: 'readme.txt', contentType: 'text/plain' }
	];

	let isDark = $state(false);
	let selection = $state('none');
	let lastRename = $state('none');
	let lastOpen = $state('none');

	function handleSelectionChange(item: FileSystemItem | null): void {
		selection = item ? `${item.kind}: ${item.path}` : 'none';
	}

	function handleFileOpen(file: FileSystemFileItem, url: string | null): void {
		lastOpen = `${file.path} -> ${url ?? 'no url'}`;
	}

	function handleRename(item: FileSystemItem, name: string): void {
		lastRename = `${item.path} -> ${name}`;
	}
</script>

<h1>File System</h1>
<p>
	File and folder tree browser with expand/collapse, selection events, keyboard navigation
	(arrow keys, Home/End, Enter, F2 to rename), and inline rename. Dark mode is controlled by
	the parent through <code>isDark</code>; the checkbox below is the page's own control.
</p>
<p>
	<label>
		<input type="checkbox" bind:checked={isDark} />
		Dark mode
	</label>
</p>

<FileSystem
	{items}
	title="Sample files"
	{isDark}
	onSelectionChange={handleSelectionChange}
	onRename={handleRename}
	onFileOpen={handleFileOpen}
	getFileUrl={(file: FileSystemFileItem) => `/files/${file.path}`}
/>

<p data-testid="file-system-selection">Selected: {selection}</p>
<p data-testid="file-system-rename">Last rename: {lastRename}</p>
<p data-testid="file-system-open">Last opened: {lastOpen}</p>

<section aria-labelledby="differences-from-upstream">
	<h2 id="differences-from-upstream">Differences from upstream</h2>
	<ul>
		<li>
			Same export name, <code>FileSystem</code>. <code>class</code> is accepted alongside the
			upstream <code>className</code>.
		</li>
		<li>
			One tree view only. The icons, list, columns, and gallery views
			(<code>defaultView</code>, <code>view</code>, <code>onViewChange</code>) are not ported,
			nor are back/forward navigation, search, sort, filters, thumbnails and the page pager
			(<code>loadPreviewImageUrl</code>, <code>renderFilePreview</code>), lazy
			<code>loadChildren</code>, and the built-in viewer dialog.
		</li>
		<li>
			<code>onFileOpen</code> is called when a file is double-clicked or opened with Enter, with
			its <code>url</code> or the <code>getFileUrl</code> result. Without it, nothing opens
			(upstream falls back to its built-in viewer). Double-click or Enter on a folder expands it
			in place instead of navigating into it.
		</li>
		<li>
			Upstream preview fields on file items (<code>previewImageUrl</code>,
			<code>previewImageUrls</code>, <code>previewPageCount</code>,
			<code>previewAspectRatio</code>) are accepted but not shown.
		</li>
		<li>
			Dark mode is set by the parent through <code>isDark</code>; the tree has no theme switch.
		</li>
		<li>
			<code>defaultPath</code> expands the folders down to that path in the tree instead of
			opening a view inside that folder, since the tree has no inside-a-folder view.
		</li>
		<li>
			Types for unported features are not exported: <code>FileSystemView</code>,
			<code>FileSystemLoadChildrenArgs</code>, <code>FileSystemLoadChildrenResult</code>,
			<code>FileSystemViewerKind</code>, <code>FileSystemSortKey</code>, and
			<code>FileSystemFilterType</code>.
		</li>
		<li>
			Port additions: <code>bind:selectedPath</code>, <code>onRename</code>, and
			<code>renamable</code> (inline rename with F2).
		</li>
		<li>
			Port-only exports, the tree-building helpers and normalized entry types (upstream keeps them private): <code>ancestorFolderPaths</code>, <code>buildFileSystemIndex</code>, <code>flattenVisibleEntries</code>, <code>normalizeFolderPath</code>, <code>pathName</code>, <code>pathParent</code>, <code>FileSystemIndex</code>, <code>VisibleRow</code>, <code>FileEntry</code>, <code>FolderEntry</code>, and <code>FileSystemEntry</code>.
		</li>
	</ul>
</section>

<p><a href="/">Back to all components</a></p>

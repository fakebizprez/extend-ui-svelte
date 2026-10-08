<!-- MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT). -->
<script lang="ts">
	import FileSystem from '../../lib/components/file-system/FileSystem.svelte';
	import type { FileSystemItem } from '../../lib/components/file-system/types.js';

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

	function handleSelectionChange(item: FileSystemItem | null): void {
		selection = item ? `${item.kind}: ${item.path}` : 'none';
	}

	function handleRename(item: FileSystemItem, name: string): void {
		lastRename = `${item.path} -> ${name}`;
	}
</script>

<h1>File System</h1>
<p>
	File and folder tree browser with expand/collapse, selection events, keyboard navigation
	(arrow keys, Home/End, Enter, F2 to rename), and inline rename. Dark mode is controlled by
	the parent through <code>isDark</code> plus <code>onIsDarkChange</code>.
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
	onIsDarkChange={(value: boolean) => (isDark = value)}
	onSelectionChange={handleSelectionChange}
	onRename={handleRename}
/>

<p data-testid="file-system-selection">Selected: {selection}</p>
<p data-testid="file-system-rename">Last rename: {lastRename}</p>

<p><a href="/">Back to all components</a></p>

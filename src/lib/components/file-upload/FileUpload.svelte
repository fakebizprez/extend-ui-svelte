<!--
	MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
	Ported from apps/v4/components/extend/file-upload.tsx.

	Deliberate changes from the React version:
	- border-beam is replaced with a pure-CSS conic-gradient beam effect
	  (the showBorderBeam prop is kept); borderBeamTheme is replaced by the
	  repo-wide dark-mode contract (isDark + onIsDarkChange).
	- acceptedFileTypes icons are text glyphs ({ label, glyph }) instead of
	  React icon components; no icon set decision has been made yet.
	- File list rows render a native <img> preview for images instead of the
	  FileThumbnail component (wired up once file-thumbnail lands).
-->
<script module lang="ts">
	export interface FileUploadItem {
		id: string;
		name: string;
		type: string;
		size: number;
		url: string;
	}

	export interface AcceptedFileType {
		label: string;
		glyph?: string;
	}

	export const DEFAULT_ACCEPT = [
		'.pdf',
		'.doc',
		'.docx',
		'.xlsx',
		'.csv',
		'.png',
		'.jpg',
		'.jpeg',
		'application/pdf',
		'application/msword',
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		'text/csv',
		'image/png',
		'image/jpeg'
	].join(',');

	export const DEFAULT_ACCEPTED_FILE_TYPES: AcceptedFileType[] = [
		{ label: 'Image', glyph: 'IMG' },
		{ label: 'PDF', glyph: 'PDF' },
		{ label: 'Sheet', glyph: 'XLS' }
	];

	export function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';

		const units = ['B', 'KB', 'MB', 'GB'];
		const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);

		return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
	}

	export function matchesAccept(file: File, accept?: string): boolean {
		if (!accept) return true;

		return accept.split(',').some((rawToken) => {
			const token = rawToken.trim().toLowerCase();

			if (!token) return false;
			if (token.startsWith('.')) return file.name.toLowerCase().endsWith(token);
			if (token.endsWith('/*')) {
				return file.type.toLowerCase().startsWith(token.slice(0, -1));
			}

			return file.type.toLowerCase() === token;
		});
	}

	export function toUploadItems(files: FileList | File[]): FileUploadItem[] {
		return Array.from(files).map((file) => ({
			id: `${file.name}-${file.size}-${file.lastModified}`,
			name: file.name,
			type: file.type || 'Unknown type',
			size: file.size,
			url: URL.createObjectURL(file)
		}));
	}
</script>

<script lang="ts">
	interface Props {
		accept?: string;
		acceptedFileTypes?: AcceptedFileType[];
		browseLabel?: string;
		className?: string;
		description?: string;
		draggingLabel?: string;
		multiple?: boolean;
		showBorderBeam?: boolean;
		showFileList?: boolean;
		title?: string;
		isDark?: boolean;
		onIsDarkChange?: (isDark: boolean) => void;
		onFilesAccepted?: (files: File[]) => void;
		onFilesChange?: (files: FileUploadItem[]) => void;
	}

	let {
		accept = DEFAULT_ACCEPT,
		acceptedFileTypes = DEFAULT_ACCEPTED_FILE_TYPES,
		browseLabel = 'Browse files',
		className,
		description = 'PDF, DOC/DOCX, XLSX, CSV, PNG, or JPG',
		draggingLabel = 'Drop to add',
		multiple = true,
		showBorderBeam = true,
		showFileList = true,
		title = 'Click to upload or drop files',
		isDark = false,
		onIsDarkChange,
		onFilesAccepted,
		onFilesChange
	}: Props = $props();

	const ICON_TRANSFORMS = [
		{
			idle: 'translate(-78%, -50%) rotate(-8deg)',
			active: 'translate(-114%, -50%) rotate(-12deg) scale(1.08)'
		},
		{
			idle: 'translate(-50%, -50%) rotate(0deg)',
			active: 'translate(-50%, -50%) rotate(0deg) scale(1.18)'
		},
		{
			idle: 'translate(-22%, -50%) rotate(8deg)',
			active: 'translate(14%, -50%) rotate(12deg) scale(1.08)'
		}
	];

	let isDragging = $state(false);
	let files = $state<FileUploadItem[]>([]);
	let rejectionMessage = $state<string | null>(null);
	let inputRef: HTMLInputElement | null = $state(null);
	let dragDepth = 0;

	function iconTransform(index: number, singleIcon: boolean, dragging: boolean): string {
		if (singleIcon) return `translate(-50%, -50%) scale(${dragging ? 1.14 : 1})`;
		const entry = ICON_TRANSFORMS[index];
		if (!entry) return 'translate(-50%, -50%)';
		return dragging ? entry.active : entry.idle;
	}

	function commitFiles(nextFiles: FileList | File[]) {
		const acceptedFiles = Array.from(nextFiles)
			.filter((file) => matchesAccept(file, accept))
			.slice(0, multiple ? undefined : 1);

		if (acceptedFiles.length === 0) {
			rejectionMessage = 'This file type is not supported here.';
			return;
		}

		rejectionMessage = null;
		onFilesAccepted?.(acceptedFiles);

		const items = toUploadItems(acceptedFiles);
		for (const file of files) URL.revokeObjectURL(file.url);
		files = items;
		onFilesChange?.(items);
	}

	// Revoke object URLs when the list is replaced and on destroy.
	$effect(() => {
		const current = files;
		return () => {
			for (const file of current) URL.revokeObjectURL(file.url);
		};
	});

	function openFileDialog() {
		inputRef?.click();
	}

	function handleDragEnter(event: DragEvent) {
		event.preventDefault();
		dragDepth += 1;
		isDragging = true;
	}

	function handleDragLeave(event: DragEvent) {
		event.preventDefault();
		dragDepth = Math.max(0, dragDepth - 1);
		if (dragDepth === 0) isDragging = false;
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		dragDepth = 0;
		isDragging = false;
		if (event.dataTransfer && event.dataTransfer.files.length > 0) {
			commitFiles(event.dataTransfer.files);
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			openFileDialog();
		}
	}

	function handleInputChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		if (input.files) {
			commitFiles(input.files);
			input.value = '';
		}
	}
</script>

{#snippet dropzone()}
	<!-- eslint-disable-next-line svelte/no-noninteractive-element-interactions -->
	<div
		role="button"
		tabindex="0"
		class="dropzone"
		class:dragging={isDragging}
		onclick={openFileDialog}
		ondragenter={handleDragEnter}
		ondragleave={handleDragLeave}
		ondragover={(event) => event.preventDefault()}
		ondrop={handleDrop}
		onkeydown={handleKeyDown}
	>
		<div class="icon-cluster" aria-hidden="true">
			{#each acceptedFileTypes as item, index (item.label)}
				<div
					class="icon-card"
					class:middle={index === 1}
					class:active={isDragging}
					style:transform={iconTransform(index, acceptedFileTypes.length === 1, isDragging)}
				>
					<span class="icon-glyph">{item.glyph ?? item.label}</span>
				</div>
			{/each}
		</div>
		<div class="copy">
			<div class="title">{title}</div>
			<div class="description">{description}</div>
			{#if rejectionMessage}
				<div class="rejection">{rejectionMessage}</div>
			{/if}
		</div>
		<div class="browse-pill">
			<svg
				class="upload-icon"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
				<polyline points="17 8 12 3 7 8" />
				<line x1="12" x2="12" y1="3" y2="15" />
			</svg>
			<span>{isDragging ? draggingLabel : browseLabel}</span>
		</div>
		<input
			bind:this={inputRef}
			type="file"
			{accept}
			{multiple}
			class="hidden-input"
			tabindex="-1"
			onchange={handleInputChange}
		/>
	</div>
{/snippet}

<div class={['file-upload', className]} class:dark={isDark}>
	<button
		type="button"
		class="theme-toggle"
		aria-label="Toggle dark mode"
		aria-pressed={isDark}
		onclick={() => onIsDarkChange?.(!isDark)}
	>
		{isDark ? 'Light' : 'Dark'}
	</button>
	{#if showBorderBeam}
		<div class="beam" class:beam-active={isDragging}>
			{@render dropzone()}
		</div>
	{:else}
		{@render dropzone()}
	{/if}
	{#if showFileList && files.length > 0}
		<ul class="file-list">
			{#each files as file (file.id)}
				<li class="file-row">
					{#if file.type.startsWith('image/')}
						<img class="file-thumb" src={file.url} alt="" />
					{:else}
						<div class="file-thumb file-thumb-fallback" aria-hidden="true">
							{file.name.split('.').pop()?.toUpperCase().slice(0, 4) ?? 'FILE'}
						</div>
					{/if}
					<div class="file-meta">
						<div class="file-name">{file.name}</div>
						<div class="file-detail">{file.type} - {formatBytes(file.size)}</div>
					</div>
					<div class="file-badge">Ready</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.file-upload {
		--fu-bg: #ffffff;
		--fu-fg: #111827;
		--fu-muted: #6b7280;
		--fu-border: rgba(17, 24, 39, 0.2);
		--fu-border-hover: rgba(17, 24, 39, 0.35);
		--fu-accent: rgba(59, 130, 246, 0.12);
		--fu-card: #f3f4f6;
		--fu-danger: #dc2626;
		position: relative;
		display: grid;
		gap: 0.75rem;
		color: var(--fu-fg);
	}

	.file-upload.dark {
		--fu-bg: #111827;
		--fu-fg: #f3f4f6;
		--fu-muted: #9ca3af;
		--fu-border: rgba(243, 244, 246, 0.25);
		--fu-border-hover: rgba(243, 244, 246, 0.4);
		--fu-accent: rgba(59, 130, 246, 0.25);
		--fu-card: #1f2937;
		--fu-danger: #f87171;
	}

	.theme-toggle {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		z-index: 20;
		border: 1px solid var(--fu-border);
		border-radius: 999px;
		background: var(--fu-bg);
		color: var(--fu-muted);
		font-size: 0.75rem;
		padding: 0.15rem 0.6rem;
		cursor: pointer;
	}

	/* Pure-CSS replacement for the upstream border-beam effect. */
	.beam {
		--beam-angle: 0deg;
		padding: 2px;
		border-radius: 1.125rem;
		background: conic-gradient(
			from var(--beam-angle),
			var(--fu-border),
			#38bdf8,
			#818cf8,
			var(--fu-border)
		);
	}

	.beam-active {
		animation: beam-spin 2.4s linear infinite;
	}

	@property --beam-angle {
		syntax: '<angle>';
		inherits: false;
		initial-value: 0deg;
	}

	@keyframes beam-spin {
		to {
			--beam-angle: 360deg;
		}
	}

	.dropzone {
		position: relative;
		display: flex;
		min-height: 16rem;
		cursor: pointer;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1.25rem;
		overflow: hidden;
		border-radius: calc(1.125rem - 2px);
		border: 1px dashed var(--fu-border);
		background: var(--fu-bg);
		padding: 2.5rem 1.5rem;
		text-align: center;
		transition:
			border-color 200ms ease-out,
			background-color 200ms ease-out;
	}

	.beam .dropzone {
		border-color: transparent;
	}

	.dropzone:hover {
		border-color: var(--fu-border-hover);
	}

	.dropzone.dragging {
		border-color: var(--fu-border-hover);
		background: var(--fu-accent);
	}

	.icon-cluster {
		position: relative;
		height: 3.5rem;
		width: 9rem;
	}

	.icon-card {
		position: absolute;
		top: 50%;
		left: 50%;
		display: grid;
		place-items: center;
		width: 3rem;
		height: 3rem;
		border-radius: 0.75rem;
		border: 1px solid var(--fu-border);
		background: var(--fu-bg);
		color: var(--fu-muted);
		transition:
			transform 500ms cubic-bezier(0.22, 1, 0.36, 1),
			color 500ms,
			background-color 500ms;
	}

	.icon-card.middle {
		z-index: 10;
	}

	.icon-card.active {
		background: var(--fu-card);
		color: var(--fu-fg);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	.icon-glyph {
		font-size: 0.65rem;
		font-weight: 700;
		letter-spacing: 0.04em;
	}

	.copy {
		display: grid;
		gap: 0.25rem;
	}

	.title {
		font-size: 0.875rem;
		font-weight: 500;
	}

	.description {
		font-size: 0.75rem;
		color: var(--fu-muted);
	}

	.rejection {
		font-size: 0.75rem;
		color: var(--fu-danger);
	}

	.browse-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		border-radius: 999px;
		border: 1px solid var(--fu-border);
		background: var(--fu-bg);
		padding: 0.25rem 0.75rem;
		font-size: 0.75rem;
		color: var(--fu-muted);
	}

	.upload-icon {
		width: 0.875rem;
		height: 0.875rem;
	}

	.hidden-input {
		display: none;
	}

	.file-list {
		list-style: none;
		margin: 0;
		padding: 0;
		border-radius: 0.75rem;
		border: 1px solid var(--fu-border);
		background: var(--fu-bg);
	}

	.file-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.625rem 0.75rem;
		border-bottom: 1px solid var(--fu-border);
	}

	.file-row:last-child {
		border-bottom: 0;
	}

	.file-thumb {
		width: 2.5rem;
		height: 2.5rem;
		flex-shrink: 0;
		border-radius: 0.5rem;
		object-fit: cover;
	}

	.file-thumb-fallback {
		display: grid;
		place-items: center;
		background: var(--fu-card);
		color: var(--fu-muted);
		font-size: 0.6rem;
		font-weight: 700;
	}

	.file-meta {
		min-width: 0;
		flex: 1;
	}

	.file-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.875rem;
		font-weight: 500;
	}

	.file-detail {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.75rem;
		color: var(--fu-muted);
	}

	.file-badge {
		border-radius: 999px;
		background: var(--fu-card);
		color: var(--fu-muted);
		padding: 0.25rem 0.5rem;
		font-size: 0.75rem;
	}

	@media (prefers-reduced-motion: reduce) {
		.beam-active {
			animation: none;
		}

		.dropzone,
		.icon-card {
			transition: none;
		}
	}
</style>

<!--
	MIT License — Svelte 5 port of Extend UI docx-editor. Upstream: extend-hq/ui (MIT).
	Ported from apps/v4/components/extend/docx-editor.tsx (DocxEditorPreview).

	Deliberate changes vs the React version (rewrite, not a line port):
	- No @extend-ai/react-docx dependency (React-only). Editing is a native
	  contenteditable surface with document.execCommand formatting; the docx
	  engine wrapper (docx-preview) renders the source document offscreen and
	  its paragraphs are extracted into the editor.
	- Also exported as the upstream name DocxEditorPreview; `className` is an
	  alias of `class`. Port additions: showToolbar, readOnly, onExport.
	- The toolbar covers the rewrite scope: bold, italic, headings, bulleted
	  and numbered lists, zoom (upstream steps and defaultZoomScale), plus
	  import, export, and the theme switch. Undo/redo buttons, fonts, color,
	  highlight, links, alignment, borders, comments, tracked changes, tables,
	  images, and page thumbnails are out of scope for this port.
	- Export is lossy: it rebuilds a minimal .docx package from the editor
	  blocks with jszip (see ./export.js) instead of the react-docx controller
	  API, so source tables, images, styles, headers, and footers are dropped.
	- Dark mode stays parent-controlled (isDark + onIsDarkChange) per the
	  repo contract.
-->
<script module lang="ts">
	import { escapeXml } from './export.js';
	import type { DocxEditorBlock, DocxEditorBlockType, DocxEditorRun } from './export.js';

	export const DOCX_MIME_TYPE =
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

	export const DOCX_UPLOAD_ACCEPT = ['.doc', '.docx', 'application/msword', DOCX_MIME_TYPE].join(
		','
	);

	/** Zoom steps offered by the toolbar, in percent, matching upstream. */
	export const ZOOM_OPTIONS = [50, 75, 90, 100, 110, 125, 150, 175, 200] as const;

	/** Editor zoom when the parent passes no defaultZoomScale, matching upstream. */
	export const DEFAULT_ZOOM_SCALE = 100;

	/** Like upstream: only values on the zoom scale are honored. */
	export function normalizeZoomScale(value: number | undefined): number {
		return typeof value === 'number' && (ZOOM_OPTIONS as readonly number[]).includes(value)
			? value
			: DEFAULT_ZOOM_SCALE;
	}

	/** Prefers an explicit fileName, else the last URL path segment. */
	export function formatDocumentName(fileName: string | undefined, url: string): string {
		if (fileName?.trim()) return fileName;
		const rawName = url.split('?')[0]?.split('/').pop() ?? 'document.docx';
		if (!rawName) return 'document.docx';
		try {
			return decodeURIComponent(rawName);
		} catch {
			return rawName;
		}
	}

	/** Appends .docx unless the name already ends with it. */
	export function ensureDocxExtension(fileName: string): string {
		return fileName.toLowerCase().endsWith('.docx') ? fileName : `${fileName}.docx`;
	}

	const BLOCK_SELECTOR = 'h1,h2,h3,h4,h5,h6,p,li,div';

	/** True when the element is marked bold by tag or inline style. */
	function isBoldElement(element: Element): boolean {
		const tag = element.tagName.toLowerCase();
		if (tag === 'strong' || tag === 'b') return true;
		const weight = (element as HTMLElement).style?.fontWeight ?? '';
		return weight === 'bold' || (Number(weight) >= 600 && weight !== '');
	}

	/** True when the element is marked italic by tag or inline style. */
	function isItalicElement(element: Element): boolean {
		const tag = element.tagName.toLowerCase();
		if (tag === 'em' || tag === 'i') return true;
		const style = (element as HTMLElement).style?.fontStyle ?? '';
		return style === 'italic' || style === 'oblique';
	}

	/** Collects the styled runs of one block element in document order. */
	function collectRuns(block: Element): DocxEditorRun[] {
		const runs: DocxEditorRun[] = [];
		const walker = block.ownerDocument.createTreeWalker(block, NodeFilter.SHOW_TEXT);
		let node = walker.nextNode();
		while (node) {
			const text = node.textContent ?? '';
			if (text !== '') {
				let bold = false;
				let italic = false;
				let ancestor = node.parentElement;
				while (ancestor && ancestor !== block.parentElement) {
					if (!bold && isBoldElement(ancestor)) bold = true;
					if (!italic && isItalicElement(ancestor)) italic = true;
					if (ancestor === block) break;
					ancestor = ancestor.parentElement;
				}
				runs.push({ text, bold, italic });
			}
			node = walker.nextNode();
		}
		return runs;
	}

	/** Maps a block element to its editor block kind. */
	function blockTypeForElement(element: Element): DocxEditorBlockType {
		const tag = element.tagName.toLowerCase();
		if (tag === 'h1') return 'heading1';
		if (tag === 'h2') return 'heading2';
		if (tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6') return 'heading3';
		if (tag === 'li') return element.closest('ol') ? 'number' : 'bullet';
		return 'paragraph';
	}

	/**
	 * Extracts editor blocks from rendered HTML: either docx-preview output or
	 * the editor surface itself. Only leaf block elements become blocks, so
	 * wrapper divs are never duplicated as paragraphs.
	 */
	export function elementToBlocks(root: HTMLElement): DocxEditorBlock[] {
		const blocks: DocxEditorBlock[] = [];
		const candidates = Array.from(root.querySelectorAll(BLOCK_SELECTOR));
		for (const candidate of candidates) {
			// Skip containers: a block element with a block descendant would
			// duplicate the descendant's text.
			if (candidate.querySelector(BLOCK_SELECTOR)) continue;
			blocks.push({ type: blockTypeForElement(candidate), runs: collectRuns(candidate) });
		}
		return blocks;
	}

	/** Serializes one styled run to editor HTML. */
	function runToEditorHtml(run: DocxEditorRun): string {
		let html = escapeXml(run.text);
		if (run.italic) html = `<em>${html}</em>`;
		if (run.bold) html = `<strong>${html}</strong>`;
		return html;
	}

	/** Serializes blocks to editor HTML, grouping consecutive list items. */
	export function blocksToEditorHtml(blocks: DocxEditorBlock[]): string {
		let html = '';
		let openList: 'ul' | 'ol' | null = null;
		const closeList = (): void => {
			if (openList) {
				html += openList === 'ul' ? '</ul>' : '</ol>';
				openList = null;
			}
		};
		for (const block of blocks) {
			const inner = block.runs.map(runToEditorHtml).join('');
			if (block.type === 'bullet' || block.type === 'number') {
				const list = block.type === 'bullet' ? 'ul' : 'ol';
				if (openList !== list) {
					closeList();
					html += list === 'ul' ? '<ul>' : '<ol>';
					openList = list;
				}
				html += `<li>${inner}</li>`;
				continue;
			}
			closeList();
			if (block.type === 'heading1') html += `<h1>${inner}</h1>`;
			else if (block.type === 'heading2') html += `<h2>${inner}</h2>`;
			else if (block.type === 'heading3') html += `<h3>${inner}</h3>`;
			else html += `<p>${inner}</p>`;
		}
		closeList();
		return html;
	}
</script>

<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { toggleIsDark } from '#lib/dark-mode.js';
	import type { DocxSource } from '#lib/engines/docx/index.js';
	import { DOCX_MIME_TYPE as EXPORT_MIME_TYPE, exportDocxBytes } from './export.js';

	type EngineModule = typeof import('#lib/engines/docx/index.js');
	type Status = 'idle' | 'loading' | 'ready' | 'error';

	interface Props {
		/** DOCX URL to load. Matches the upstream `src` prop. */
		src?: string;
		/** Display name used for the toolbar and the export download. */
		fileName?: string;
		/** Parent-controlled dark mode flag. Required, like upstream. */
		isDark: boolean;
		/** Called when the user toggles dark mode in the toolbar. Required, like upstream. */
		onIsDarkChange: (isDark: boolean) => void;
		/** Initial zoom in percent; must be one of ZOOM_OPTIONS. Defaults to 100, like upstream. */
		defaultZoomScale?: number;
		/** Show the formatting toolbar. */
		showToolbar?: boolean;
		/** Read-only mode: editing and import are disabled, export still works. */
		readOnly?: boolean;
		class?: string;
		/** Alias of `class`, matching the upstream React prop. */
		className?: string;
		/** Called with the exported .docx bytes on every successful export. */
		onExport?: (bytes: Uint8Array) => void;
	}

	let {
		src,
		fileName,
		isDark = false,
		onIsDarkChange,
		showToolbar = true,
		readOnly = false,
		defaultZoomScale,
		class: classProp = '',
		className = '',
		onExport
	}: Props = $props();

	let engine = $state<EngineModule | null>(null);
	let engineError = $state('');
	let editorEl = $state<HTMLDivElement | null>(null);
	let hiddenEl = $state<HTMLDivElement | null>(null);
	let fileInputEl = $state<HTMLInputElement | null>(null);
	let status = $state<Status>('idle');
	let errorMessage = $state('');
	let exporting = $state(false);
	let uploadedFile = $state.raw<File | null>(null);
	let blockStyle = $state('p');
	let zoomScale = $state(untrack(() => normalizeZoomScale(defaultZoomScale)));
	const zoomIndex = $derived((ZOOM_OPTIONS as readonly number[]).indexOf(zoomScale));
	let generation = 0;

	const displayFileName = $derived(
		uploadedFile?.name ?? (src ? formatDocumentName(fileName, src) : (fileName ?? 'document.docx'))
	);

	// Client-only engine load: docx-preview touches canvas and layout, so the
	// wrapper is loaded with a dynamic import() inside onMount, never at the
	// top level. Importing this component stays DOM-free.
	onMount(() => {
		let cancelled = false;
		import('#lib/engines/docx/index.js').then(
			(loaded) => {
				if (!cancelled) engine = loaded;
			},
			(failure: unknown) => {
				if (cancelled) return;
				engineError = failure instanceof Error ? failure.message : String(failure);
			}
		);
		return () => {
			cancelled = true;
			generation += 1;
			const loaded = engine;
			for (const element of [hiddenEl, editorEl]) {
				if (loaded && element) {
					try {
						loaded.clearDocx(element);
					} catch {
						// Clearing is best-effort during teardown.
					}
				}
			}
		};
	});

	// Loads the document offscreen through the docx engine, then extracts the
	// rendered paragraphs into the editable surface. Editing never mutates the
	// engine output, so the editor owns its HTML after the initial load.
	$effect(() => {
		const loaded = engine;
		const loadError = engineError;
		const hidden = hiddenEl;
		const editor = editorEl;
		const source: DocxSource | undefined = uploadedFile ?? src;
		if (!source) {
			if (loaded) {
				if (hidden) loaded.clearDocx(hidden);
				if (editor) editor.innerHTML = '';
			}
			status = 'idle';
			errorMessage = '';
			return;
		}
		if (!loaded || !hidden || !editor) {
			if (loadError) {
				status = 'error';
				errorMessage = loadError;
			} else {
				status = 'loading';
			}
			return;
		}
		const id = (generation += 1);
		status = 'loading';
		errorMessage = '';
		loaded.renderDocx(source, hidden).then(
			() => {
				if (id !== generation) return;
				const blocks = elementToBlocks(hidden);
				editor.innerHTML = blocksToEditorHtml(blocks);
				status = 'ready';
			},
			(failure: unknown) => {
				if (id !== generation) return;
				status = 'error';
				errorMessage = failure instanceof Error ? failure.message : String(failure);
			}
		);
	});

	function applyFormat(command: string, value?: string): void {
		editorEl?.focus({ preventScroll: true });
		if (value === undefined) {
			document.execCommand(command);
		} else {
			document.execCommand(command, false, value);
		}
	}

	function handleBlockStyle(event: Event): void {
		const select = event.currentTarget as HTMLSelectElement;
		blockStyle = select.value;
		if (select.value === 'p') {
			applyFormat('formatBlock', 'p');
		} else {
			applyFormat('formatBlock', select.value);
		}
	}

	function handleUpload(event: Event): void {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0] ?? null;
		input.value = '';
		if (!file) return;
		uploadedFile = file;
	}

	function downloadBlob(blob: Blob, name: string): void {
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = name;
		anchor.rel = 'noopener';
		document.body.append(anchor);
		anchor.click();
		anchor.remove();
		window.setTimeout(() => URL.revokeObjectURL(url), 0);
	}

	async function handleExport(): Promise<void> {
		const editor = editorEl;
		if (!editor || exporting) return;
		exporting = true;
		try {
			const bytes = await exportDocxBytes(elementToBlocks(editor));
			onExport?.(bytes);
			const blob = new Blob([bytes as BlobPart], { type: EXPORT_MIME_TYPE });
			downloadBlob(blob, ensureDocxExtension(displayFileName));
		} catch (failure) {
			errorMessage = failure instanceof Error ? failure.message : String(failure);
			status = 'error';
		} finally {
			exporting = false;
		}
	}

	function handleToggleDark(): void {
		toggleIsDark(isDark, onIsDarkChange);
	}
</script>

<div
	data-testid="docx-editor"
	data-dark={isDark ? 'true' : 'false'}
	class={['docx-editor', isDark && 'dark', classProp, className].filter(Boolean).join(' ')}
>
	{#if showToolbar}
		<div class="docx-editor-toolbar" role="toolbar" aria-label="Document formatting">
			<button type="button" disabled={readOnly || status !== 'ready'} onclick={() => applyFormat('bold')}>
				Bold
			</button>
			<button
				type="button"
				disabled={readOnly || status !== 'ready'}
				onclick={() => applyFormat('italic')}
			>
				Italic
			</button>
			<label class="docx-editor-block-style">
				Block style
				<select
					aria-label="Block style"
					bind:value={blockStyle}
					disabled={readOnly || status !== 'ready'}
					onchange={handleBlockStyle}
				>
					<option value="p">Paragraph</option>
					<option value="h1">Heading 1</option>
					<option value="h2">Heading 2</option>
					<option value="h3">Heading 3</option>
				</select>
			</label>
			<button
				type="button"
				disabled={readOnly || status !== 'ready'}
				onclick={() => applyFormat('insertUnorderedList')}
			>
				Bulleted list
			</button>
			<button
				type="button"
				disabled={readOnly || status !== 'ready'}
				onclick={() => applyFormat('insertOrderedList')}
			>
				Numbered list
			</button>
			<button
				type="button"
				aria-label="Zoom out"
				disabled={zoomIndex <= 0}
				onclick={() => (zoomScale = ZOOM_OPTIONS[zoomIndex - 1])}
			>
				−
			</button>
			<select aria-label="Zoom level" bind:value={zoomScale}>
				{#each ZOOM_OPTIONS as value (value)}
					<option {value}>{value}%</option>
				{/each}
			</select>
			<button
				type="button"
				aria-label="Zoom in"
				disabled={zoomIndex >= ZOOM_OPTIONS.length - 1}
				onclick={() => (zoomScale = ZOOM_OPTIONS[zoomIndex + 1])}
			>
				+
			</button>
			<button type="button" disabled={readOnly} onclick={() => fileInputEl?.click()}>
				Upload
			</button>
			<button type="button" disabled={status !== 'ready' || exporting} onclick={handleExport}>
				{exporting ? 'Exporting…' : 'Export .docx'}
			</button>
			<button type="button" role="switch" aria-checked={isDark} onclick={handleToggleDark}>
				Toggle dark mode
			</button>
		</div>
	{/if}
	<input
		bind:this={fileInputEl}
		data-testid="docx-editor-upload-input"
		type="file"
		accept={DOCX_UPLOAD_ACCEPT}
		hidden
		onchange={handleUpload}
	/>
	{#if status === 'idle'}
		<div class="docx-editor-empty">
			<p>Upload a Word document to edit</p>
			<p class="docx-state-hint">
				Pass a DOCX URL with the <code>src</code> prop or upload a file.
			</p>
		</div>
	{:else if status === 'loading'}
		<div class="docx-editor-empty" data-testid="docx-editor-loading">
			<p>Loading document…</p>
		</div>
	{:else if status === 'error'}
		<div class="docx-editor-empty" data-testid="docx-editor-error" role="alert">
			<p>Could not load the document.</p>
			<p class="docx-state-hint">{errorMessage}</p>
		</div>
	{/if}
	{#if status !== 'idle'}
		<div
			bind:this={editorEl}
			data-testid="docx-editor-content"
			class="docx-editor-content"
			style={`zoom: ${zoomScale}%;`}
			contenteditable={readOnly ? 'false' : 'true'}
			spellcheck="false"
			role="textbox"
			aria-label="Document editor"
			aria-readonly={readOnly}
		></div>
	{/if}
	<div bind:this={hiddenEl} class="docx-editor-hidden" aria-hidden="true"></div>
</div>

<style>
	.docx-editor {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		color: #111827;
		background: #ffffff;
		border: 1px solid #e5e7eb;
		border-radius: 0.5rem;
		padding: 0.75rem;
	}
	.docx-editor.dark {
		color: #f3f4f6;
		background: #111827;
		border-color: #374151;
	}
	.docx-editor-toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}
	.docx-editor-toolbar button,
	.docx-editor-toolbar select {
		font: inherit;
		font-size: 0.875rem;
		padding: 0.25rem 0.625rem;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		background: #f9fafb;
		color: inherit;
	}
	.docx-editor.dark .docx-editor-toolbar button,
	.docx-editor.dark .docx-editor-toolbar select {
		background: #1f2937;
		border-color: #4b5563;
	}
	.docx-editor-toolbar button:disabled,
	.docx-editor-toolbar select:disabled {
		opacity: 0.5;
	}
	.docx-editor-block-style {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.875rem;
	}
	.docx-editor-empty {
		padding: 2rem 1rem;
		text-align: center;
	}
	.docx-state-hint {
		font-size: 0.875rem;
		opacity: 0.75;
	}
	.docx-editor-content {
		min-height: 16rem;
		padding: 1rem;
		border: 1px solid #e5e7eb;
		border-radius: 0.375rem;
		background: #ffffff;
		color: #111827;
	}
	.docx-editor-content:focus {
		outline: 2px solid #3b82f6;
		outline-offset: -1px;
	}
	.docx-editor.dark .docx-editor-content {
		background: #030712;
		color: #f3f4f6;
		border-color: #374151;
	}
	.docx-editor-hidden {
		position: absolute;
		left: -10000px;
		top: 0;
		width: 40rem;
		visibility: hidden;
		pointer-events: none;
	}
</style>

// MIT License — Svelte 5 port of Extend UI docx-viewer engine. Upstream: extend-hq/ui (MIT).
// Rendering is delegated to docx-preview (Apache-2.0) with jszip (MIT). Both are
// browser-only, so docx-preview is loaded through a dynamic import() inside
// renderDocx and never at module top level; importing this module is DOM-free.

/** A DOCX document source: raw bytes, a Blob/File, or a URL to fetch. */
export type DocxSource = Blob | ArrayBuffer | Uint8Array | string;

/** Small render API for the DOCX engine wrapper. */
export interface DocxRenderOptions {
	/**
	 * When true, the viewer shows a thumbnail sidebar next to the document.
	 * The engine reports the resolved flag back in the render result so the
	 * viewer and the engine never disagree. Defaults to `false`.
	 */
	showThumbnails?: boolean;
	/** CSS class applied to the docx-preview wrapper element. Defaults to `'docx'`. */
	className?: string;
	/** Break the document into page-like sections. Defaults to `true`. */
	breakPages?: boolean;
}

/** DocxRenderOptions with every field resolved to a concrete value. */
export interface ResolvedDocxRenderOptions {
	showThumbnails: boolean;
	className: string;
	breakPages: boolean;
}

/** Result of a successful renderDocx call. */
export interface DocxRenderResult {
	/** The container the document was rendered into. */
	container: HTMLElement;
	/** The resolved thumbnail sidebar flag the viewer should honor. */
	showThumbnails: boolean;
}

/** Error thrown for invalid input, missing DOM, fetch failures, and render failures. */
export class DocxRenderError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = 'DocxRenderError';
	}
}

/**
 * Rejection for a render that a newer renderDocx or clearDocx call on the same
 * container superseded. Its output never reaches the DOM; callers can ignore it.
 */
export class DocxRenderCancelledError extends DocxRenderError {
	constructor() {
		super('DOCX render superseded by a newer render of the same container.');
		this.name = 'DocxRenderCancelledError';
	}
}

// Latest render ticket per container: renders are last-call-wins down to the DOM.
const renderTickets = new WeakMap<object, number>();

function takeTicket(container: object): number {
	const ticket = (renderTickets.get(container) ?? 0) + 1;
	renderTickets.set(container, ticket);
	return ticket;
}

/** Default render options: no thumbnail sidebar, default wrapper class, paged output. */
export const DEFAULT_DOCX_OPTIONS: ResolvedDocxRenderOptions = {
	showThumbnails: false,
	className: 'docx',
	breakPages: true
};

/** Merges caller options over DEFAULT_DOCX_OPTIONS. Pure and DOM-free. */
export function resolveDocxOptions(options?: DocxRenderOptions): ResolvedDocxRenderOptions {
	return {
		showThumbnails: options?.showThumbnails ?? DEFAULT_DOCX_OPTIONS.showThumbnails,
		className: options?.className ?? DEFAULT_DOCX_OPTIONS.className,
		breakPages: options?.breakPages ?? DEFAULT_DOCX_OPTIONS.breakPages
	};
}

/** True only when a browser DOM is available. */
function isBrowser(): boolean {
	return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/** Rejects nullish and non-object containers before any DOM access. */
function assertContainer(container: HTMLElement): void {
	if (!container || (typeof container !== 'object' && typeof container !== 'function')) {
		throw new DocxRenderError('renderDocx requires a container element to render into.');
	}
}

/** Rejects source values that toBlob cannot convert. Runs before the DOM check. */
function assertSource(source: DocxSource): void {
	const valid =
		typeof source === 'string' ||
		(typeof Blob !== 'undefined' && source instanceof Blob) ||
		source instanceof ArrayBuffer ||
		source instanceof Uint8Array;

	if (!valid) {
		throw new DocxRenderError(
			'Unsupported DOCX source: expected a Blob, ArrayBuffer, Uint8Array, or URL string.'
		);
	}
}

/** Normalizes every DocxSource to a Blob docx-preview can render. */
async function toBlob(source: DocxSource): Promise<Blob> {
	if (typeof source === 'string') {
		const response = await fetch(source);
		if (!response.ok) {
			throw new DocxRenderError(`Failed to fetch DOCX from URL (status ${response.status}).`);
		}
		return await response.blob();
	}
	if (typeof Blob !== 'undefined' && source instanceof Blob) {
		return source;
	}
	if (source instanceof ArrayBuffer || source instanceof Uint8Array) {
		return new Blob([source as BlobPart], {
			type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
		});
	}
	throw new DocxRenderError(
		'Unsupported DOCX source: expected a Blob, ArrayBuffer, Uint8Array, or URL string.'
	);
}

/**
 * Renders a DOCX document into a container element. Browser-only: docx-preview
 * touches canvas and layout, so it is loaded with a dynamic import() here and
 * the call rejects when no browser DOM is available.
 */
export async function renderDocx(
	source: DocxSource,
	container: HTMLElement,
	options?: DocxRenderOptions
): Promise<DocxRenderResult> {
	assertContainer(container);
	assertSource(source);
	if (!isBrowser()) {
		throw new DocxRenderError('renderDocx requires a browser DOM (window/document are missing).');
	}
	const ticket = takeTicket(container);
	const isCurrent = () => renderTickets.get(container) === ticket;
	const resolved = resolveDocxOptions(options);
	let blob: Blob;
	try {
		blob = await toBlob(source);
	} catch (error) {
		if (!isCurrent()) throw new DocxRenderCancelledError();
		throw error;
	}
	const { parseAsync, renderDocument } = await import('docx-preview');
	const renderOptions = {
		className: resolved.className,
		breakPages: resolved.breakPages,
		useBase64URL: true
	};

	// renderAsync's steps, with a staleness check before the only DOM write, so
	// a slow older render can never overwrite a newer document.
	let nodes: Node[];
	try {
		nodes = await renderDocument(await parseAsync(blob, renderOptions), renderOptions);
	} catch (error) {
		if (!isCurrent()) throw new DocxRenderCancelledError();
		throw new DocxRenderError('Failed to render the DOCX document.', { cause: error });
	}
	if (!isCurrent()) throw new DocxRenderCancelledError();
	// docx-preview copies hyperlink targets from the file verbatim; sanitize
	// before anything reaches the page.
	const safeNodes = nodes.filter(sanitizeDocxNode);
	container.innerHTML = '';
	for (const node of safeNodes) container.appendChild(node);
	return { container, showThumbnails: resolved.showThumbnails };
}

const SAFE_LINK_SCHEMES = new Set(['http', 'https', 'mailto', 'tel']);
const BLOCKED_ELEMENTS = 'script, iframe, object, embed, frame, frameset';
const LINK_ATTRIBUTES = ['href', 'xlink:href'];

/**
 * True for link targets a rendered document may keep: http(s), mailto, tel,
 * and in-document #anchors. Everything else (javascript:, data:, vbscript:,
 * relative paths, ...) is unsafe. Browsers ignore ASCII whitespace and
 * control characters inside a URL scheme, so those are removed first.
 */
export function isSafeDocxLinkTarget(target: string): boolean {
	const normalized = target.replace(/[\u0000-\u0020\u007f]+/g, '');
	if (normalized.startsWith('#')) return true;
	const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(normalized)?.[1]?.toLowerCase();
	return scheme !== undefined && SAFE_LINK_SCHEMES.has(scheme);
}

/**
 * Defangs rendered DOCX markup in place: unsafe link targets lose their href,
 * every on* event-handler attribute is removed, and script, iframe, object,
 * embed, and frame elements are dropped. Returns false when the node itself
 * is one of those elements and must not be inserted.
 */
export function sanitizeDocxNode(node: Node): boolean {
	if (!(node instanceof Element)) return true;
	if (node.matches(BLOCKED_ELEMENTS)) return false;
	for (const blocked of Array.from(node.querySelectorAll(BLOCKED_ELEMENTS))) blocked.remove();
	for (const element of [node, ...Array.from(node.querySelectorAll('*'))]) {
		for (const name of element.getAttributeNames()) {
			const lower = name.toLowerCase();
			if (lower.startsWith('on')) {
				element.removeAttribute(name);
			} else if (
				LINK_ATTRIBUTES.includes(lower) &&
				!isSafeDocxLinkTarget(element.getAttribute(name) ?? '')
			) {
				element.removeAttribute(name);
			}
		}
	}
	return true;
}

/** Removes previously rendered DOCX output and cancels any render still in flight. */
export function clearDocx(container: Pick<HTMLElement, 'innerHTML'>): void {
	takeTicket(container);
	container.innerHTML = '';
}

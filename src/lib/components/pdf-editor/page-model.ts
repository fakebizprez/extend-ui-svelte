// MIT License — Svelte 5 port of Extend UI pdf-editor. Upstream: extend-hq/ui (MIT).
// Framework-free page-order model plus the pdf-lib export used by PdfEditor.

/** One page in the edited document: which source page it came from and its rotation. */
export interface EditedPdfPage {
	/** 1-based page number in the original document. */
	sourcePage: number;
	/** Clockwise rotation in degrees (0, 90, 180, or 270). */
	rotation: number;
}

/** The editor's page list: order, per-page rotations, and deletions (omitted pages). */
export interface PdfEditState {
	pages: EditedPdfPage[];
}

export type PdfRotateDirection = 'clockwise' | 'counter-clockwise';

/** Fresh state with every source page in order and unrotated. */
export function createEditState(pageCount: number): PdfEditState {
	const pages: EditedPdfPage[] = [];
	for (let page = 1; page <= Math.max(0, Math.floor(pageCount)); page += 1) {
		pages.push({ sourcePage: page, rotation: 0 });
	}
	return { pages };
}

/** Restore the original order, rotations, and deleted pages. */
export function resetEditState(pageCount: number): PdfEditState {
	return createEditState(pageCount);
}

/** Rotate the page at `index` a quarter turn. Out-of-range indexes return the state unchanged. */
export function rotateEditPage(
	state: PdfEditState,
	index: number,
	direction: PdfRotateDirection
): PdfEditState {
	if (!Number.isInteger(index) || index < 0 || index >= state.pages.length) return state;
	const delta = direction === 'clockwise' ? 90 : -90;
	return {
		pages: state.pages.map((page, i) =>
			i === index ? { ...page, rotation: (((page.rotation + delta) % 360) + 360) % 360 } : page
		)
	};
}

/** Remove the page at `index`. Out-of-range indexes return the state unchanged. */
export function deleteEditPage(state: PdfEditState, index: number): PdfEditState {
	if (!Number.isInteger(index) || index < 0 || index >= state.pages.length) return state;
	return { pages: state.pages.filter((_, i) => i !== index) };
}

/** Move the page at `fromIndex` to `toIndex` (clamped). Out-of-range sources are ignored. */
export function moveEditPage(state: PdfEditState, fromIndex: number, toIndex: number): PdfEditState {
	if (!Number.isInteger(fromIndex) || fromIndex < 0 || fromIndex >= state.pages.length) {
		return state;
	}
	const pages = [...state.pages];
	const [moved] = pages.splice(fromIndex, 1);
	const target = Math.min(Math.max(Math.floor(toIndex), 0), pages.length);
	pages.splice(target, 0, moved!);
	return { pages };
}

/**
 * Build the edited PDF bytes: source pages copied in the edited order with
 * per-page rotations applied on top of any rotation the source page already
 * has. Deleted pages are omitted. pdf-lib loads lazily so this module stays
 * safe to import during SSR; call it from client-only code paths.
 */
export async function exportEditedPdf(
	sourceBytes: Uint8Array,
	state: PdfEditState
): Promise<Uint8Array> {
	const { PDFDocument, degrees } = await import('pdf-lib');
	const source = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
	const output = await PDFDocument.create();
	const sourcePageCount = source.getPageCount();
	for (const page of state.pages) {
		if (page.sourcePage < 1 || page.sourcePage > sourcePageCount) continue;
		const [copied] = await output.copyPages(source, [page.sourcePage - 1]);
		if (!copied) continue;
		if (page.rotation !== 0) {
			const existing = copied.getRotation().angle;
			copied.setRotation(degrees((existing + page.rotation) % 360));
		}
		output.addPage(copied);
	}
	return await output.save();
}

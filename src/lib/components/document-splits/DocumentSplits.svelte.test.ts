// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import DocumentSplits from './DocumentSplits.svelte';
import { DocumentSplits as DocumentSplitsExport } from './index.js';
import type { DocumentSplit } from './splits.js';

const pdfMock = vi.hoisted(() => ({
	created: 0,
	loads: [] as unknown[],
	rendered: [] as number[]
}));

vi.mock('#lib/engines/pdf/index.js', () => ({
	createPdfEngine: () => {
		pdfMock.created += 1;
		return {
			load: async (source: unknown) => {
				pdfMock.loads.push(source);
				return 5;
			},
			renderPage: async (page: number, _canvas: HTMLCanvasElement, options?: { scale?: number }) => {
				pdfMock.rendered.push(page);
				const scale = options?.scale ?? 1;
				return { width: 612 * scale, height: 792 * scale };
			},
			destroy: async () => {}
		};
	}
}));

/** Props upstream marks required; activePage 0 means no page is active. */
const REQUIRED = { activePage: 0, onSelectPage: () => {}, onSplitsChange: () => {} };

const SPLITS: DocumentSplit[] = [
	{ id: 'split-1', title: 'Intro', pages: ['page-1', 'page-2'] },
	{ id: 'split-2', title: 'Body', pages: ['page-3', 'page-4', 'page-5'] }
];

function groupSection(splitId: string): HTMLElement {
	const groups = screen.getAllByTestId('split-group');
	const found = groups.find((group) => group.dataset.splitId === splitId);
	if (!found) throw new Error(`No split group with id ${splitId}`);
	return found;
}

function groupTitles(): string[] {
	return screen
		.getAllByTestId('split-group')
		.map((group) => (within(group).getByLabelText(/Split title/) as HTMLInputElement).value);
}

describe('DocumentSplits', () => {
	it('renders groups with titles, page badges, range labels, and counts', () => {
		render(DocumentSplits, { ...REQUIRED, splits: SPLITS });

		expect(screen.getByTestId('document-splits')).toBeInTheDocument();
		expect(screen.getAllByTestId('split-group')).toHaveLength(2);
		expect(screen.getByText('Pages 1, 2')).toBeInTheDocument();
		expect(screen.getByText('Pages 3, 4, 5')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Select page 1' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Select page 5' })).toBeInTheDocument();
	});

	it('renders an empty state with no groups', () => {
		render(DocumentSplits, { ...REQUIRED, splits: [] });

		expect(screen.queryAllByTestId('split-group')).toHaveLength(0);
		expect(screen.getByRole('button', { name: 'Add split' })).toBeInTheDocument();
	});

	it('selects a page through its thumbnail button', async () => {
		const onSelectPage = vi.fn();
		render(DocumentSplits, { ...REQUIRED, splits: SPLITS, onSelectPage });

		await fireEvent.click(screen.getByRole('button', { name: 'Select page 4' }));

		expect(onSelectPage).toHaveBeenCalledTimes(1);
		expect(onSelectPage).toHaveBeenCalledWith(4);
	});

	it('marks the active page with aria-current', () => {
		render(DocumentSplits, { ...REQUIRED, splits: SPLITS, activePage: 3 });

		expect(screen.getByRole('button', { name: 'Select page 3' })).toHaveAttribute(
			'aria-current',
			'true'
		);
		expect(screen.getByRole('button', { name: 'Select page 1' })).not.toHaveAttribute(
			'aria-current'
		);
	});

	it('adds an empty split and emits onSplitsChange', async () => {
		const onSplitsChange = vi.fn();
		render(DocumentSplits, { ...REQUIRED, splits: SPLITS, onSplitsChange });

		await fireEvent.click(screen.getByRole('button', { name: 'Add split' }));

		expect(onSplitsChange).toHaveBeenCalledTimes(1);
		expect(onSplitsChange).toHaveBeenCalledWith([
			...SPLITS,
			{ id: 'split-3', title: 'Split 3', pages: [] }
		]);
		expect(screen.getAllByTestId('split-group')).toHaveLength(3);
		expect(screen.getByText('Drop pages here')).toBeInTheDocument();
	});

	it('renames a split through its title input', async () => {
		const onSplitsChange = vi.fn();
		render(DocumentSplits, { ...REQUIRED, splits: SPLITS, onSplitsChange });

		const input = within(groupSection('split-1')).getByLabelText(/Split title/);
		await fireEvent.input(input, { target: { value: 'Abstract' } });

		expect(onSplitsChange).toHaveBeenCalledTimes(1);
		expect(onSplitsChange).toHaveBeenCalledWith([
			{ id: 'split-1', title: 'Abstract', pages: ['page-1', 'page-2'] },
			SPLITS[1]
		]);
	});

	it('splits a group in two at the midpoint', async () => {
		const onSplitsChange = vi.fn();
		render(DocumentSplits, { ...REQUIRED, splits: SPLITS, onSplitsChange });

		await fireEvent.click(
			within(groupSection('split-2')).getByRole('button', { name: 'Split Body in two' })
		);

		expect(onSplitsChange).toHaveBeenCalledTimes(1);
		const [next] = onSplitsChange.mock.calls[0] as [DocumentSplit[]];
		expect(next).toHaveLength(3);
		expect(next[1].pages).toEqual(['page-3', 'page-4']);
		expect(next[2].title).toBe('Body (2)');
		expect(next[2].pages).toEqual(['page-5']);
		expect(groupTitles()).toContain('Body (2)');
	});

	it('disables the split button for single-page groups', () => {
		render(DocumentSplits, {
			...REQUIRED,
			splits: [
				{ id: 'split-1', title: 'Solo', pages: ['page-1'] },
				{ id: 'split-2', title: 'Pair', pages: ['page-2', 'page-3'] }
			]
		});

		expect(
			within(groupSection('split-1')).getByRole('button', { name: 'Split Solo in two' })
		).toBeDisabled();
		expect(
			within(groupSection('split-2')).getByRole('button', { name: 'Split Pair in two' })
		).toBeEnabled();
	});

	it('moves groups up and down through the controls', async () => {
		const onSplitsChange = vi.fn();
		render(DocumentSplits, { ...REQUIRED, splits: SPLITS, onSplitsChange });

		expect(
			within(groupSection('split-1')).getByRole('button', { name: 'Move Intro up' })
		).toBeDisabled();
		expect(
			within(groupSection('split-2')).getByRole('button', { name: 'Move Body down' })
		).toBeDisabled();

		await fireEvent.click(
			within(groupSection('split-2')).getByRole('button', { name: 'Move Body up' })
		);

		expect(onSplitsChange).toHaveBeenCalledWith([SPLITS[1], SPLITS[0]]);
		expect(groupTitles()).toEqual(['Body', 'Intro']);
	});

	it('removes a group and keeps the last one', async () => {
		const onSplitsChange = vi.fn();
		render(DocumentSplits, { ...REQUIRED, splits: SPLITS, onSplitsChange });

		await fireEvent.click(
			within(groupSection('split-1')).getByRole('button', { name: 'Remove Intro' })
		);

		expect(onSplitsChange).toHaveBeenCalledWith([SPLITS[1]]);
		expect(screen.getAllByTestId('split-group')).toHaveLength(1);
		expect(screen.getByRole('button', { name: 'Remove Body' })).toBeDisabled();
	});

	it('moves a page within its group through the controls', async () => {
		const onSplitsChange = vi.fn();
		render(DocumentSplits, { ...REQUIRED, splits: SPLITS, onSplitsChange });

		expect(screen.getByRole('button', { name: 'Move page 3 left' })).toBeDisabled();

		await fireEvent.click(screen.getByRole('button', { name: 'Move page 3 right' }));

		expect(onSplitsChange).toHaveBeenCalledWith([
			SPLITS[0],
			{ id: 'split-2', title: 'Body', pages: ['page-4', 'page-3', 'page-5'] }
		]);
	});

	it('moves a page to the adjacent splits through the controls', async () => {
		const onSplitsChange = vi.fn();
		render(DocumentSplits, { ...REQUIRED, splits: SPLITS, onSplitsChange });

		expect(
			screen.getByRole('button', { name: 'Move page 1 to previous split' })
		).toBeDisabled();
		expect(screen.getByRole('button', { name: 'Move page 5 to next split' })).toBeDisabled();

		await fireEvent.click(screen.getByRole('button', { name: 'Move page 2 to next split' }));

		expect(onSplitsChange).toHaveBeenCalledWith([
			{ id: 'split-1', title: 'Intro', pages: ['page-1'] },
			{ id: 'split-2', title: 'Body', pages: ['page-3', 'page-4', 'page-5', 'page-2'] }
		]);
	});

	it('reorders groups with native drag-and-drop', async () => {
		const onSplitsChange = vi.fn();
		render(DocumentSplits, { ...REQUIRED, splits: SPLITS, onSplitsChange });

		const handle = within(groupSection('split-1')).getByRole('button', {
			name: 'Reorder Intro'
		});
		await fireEvent.dragStart(handle);
		await fireEvent.dragOver(groupSection('split-2'));
		await fireEvent.drop(groupSection('split-2'));

		expect(onSplitsChange).toHaveBeenCalledWith([SPLITS[1], SPLITS[0]]);
		expect(groupTitles()).toEqual(['Body', 'Intro']);
	});

	it('reorders groups when a split is dropped on another split\'s page thumbnail', async () => {
		const onSplitsChange = vi.fn();
		render(DocumentSplits, { ...REQUIRED, splits: SPLITS, onSplitsChange });

		await fireEvent.dragStart(
			within(groupSection('split-1')).getByRole('button', { name: 'Reorder Intro' })
		);
		const thumbnail = screen.getByTestId('split-page-page-4');
		await fireEvent.dragOver(thumbnail);
		await fireEvent.drop(thumbnail);

		expect(onSplitsChange).toHaveBeenCalledWith([SPLITS[1], SPLITS[0]]);
		expect(groupTitles()).toEqual(['Body', 'Intro']);
	});

	it('reorders groups when a split is dropped on another split\'s dropzone', async () => {
		const onSplitsChange = vi.fn();
		render(DocumentSplits, { ...REQUIRED, splits: SPLITS, onSplitsChange });

		await fireEvent.dragStart(
			within(groupSection('split-2')).getByRole('button', { name: 'Reorder Body' })
		);
		const dropzone = within(groupSection('split-1')).getByTestId('split-dropzone');
		await fireEvent.dragOver(dropzone);
		await fireEvent.drop(dropzone);

		expect(onSplitsChange).toHaveBeenCalledWith([SPLITS[1], SPLITS[0]]);
	});

	it('renders no split counter in the header, like upstream', () => {
		render(DocumentSplits, { ...REQUIRED, splits: SPLITS });

		expect(screen.queryByText(/^\s*\d+\s+splits?\s*$/)).not.toBeInTheDocument();
	});

	it('moves a page across groups with native drag-and-drop', async () => {
		const onSplitsChange = vi.fn();
		render(DocumentSplits, { ...REQUIRED, splits: SPLITS, onSplitsChange });

		const page = screen.getByTestId('split-page-page-2');
		const targetDropzone = within(groupSection('split-2')).getByTestId('split-dropzone');
		await fireEvent.dragStart(page);
		await fireEvent.dragOver(targetDropzone);
		await fireEvent.drop(targetDropzone);

		expect(onSplitsChange).toHaveBeenCalledWith([
			{ id: 'split-1', title: 'Intro', pages: ['page-1'] },
			{ id: 'split-2', title: 'Body', pages: ['page-3', 'page-4', 'page-5', 'page-2'] }
		]);
	});

	it('reorders a page within its group by dropping it on another page', async () => {
		const onSplitsChange = vi.fn();
		render(DocumentSplits, { ...REQUIRED, splits: SPLITS, onSplitsChange });

		await fireEvent.dragStart(screen.getByTestId('split-page-page-3'));
		await fireEvent.dragOver(screen.getByTestId('split-page-page-5'));
		await fireEvent.drop(screen.getByTestId('split-page-page-5'));

		expect(onSplitsChange).toHaveBeenCalledWith([
			SPLITS[0],
			{ id: 'split-2', title: 'Body', pages: ['page-4', 'page-5', 'page-3'] }
		]);
	});

	it('drops a page into an empty group', async () => {
		const onSplitsChange = vi.fn();
		const withEmpty: DocumentSplit[] = [...SPLITS, { id: 'split-3', title: 'Empty', pages: [] }];
		render(DocumentSplits, { ...REQUIRED, splits: withEmpty, onSplitsChange });

		await fireEvent.dragStart(screen.getByTestId('split-page-page-1'));
		const dropzone = within(groupSection('split-3')).getByTestId('split-dropzone');
		await fireEvent.dragOver(dropzone);
		await fireEvent.drop(dropzone);

		expect(onSplitsChange).toHaveBeenCalledWith([
			{ id: 'split-1', title: 'Intro', pages: ['page-2'] },
			withEmpty[1],
			{ id: 'split-3', title: 'Empty', pages: ['page-1'] }
		]);
	});

	it('ignores drops without an active drag payload', async () => {
		const onSplitsChange = vi.fn();
		render(DocumentSplits, { ...REQUIRED, splits: SPLITS, onSplitsChange });

		await fireEvent.drop(groupSection('split-2'));

		expect(onSplitsChange).not.toHaveBeenCalled();
	});

	it('reflects the dark-mode contract on the root element', () => {
		const { rerender } = render(DocumentSplits, { ...REQUIRED, splits: SPLITS, isDark: false });

		const root = screen.getByTestId('document-splits');
		expect(root).toHaveAttribute('data-dark', 'false');
		expect(root).not.toHaveClass('dark');

		rerender({ splits: SPLITS, isDark: true });

		expect(root).toHaveAttribute('data-dark', 'true');
		expect(root).toHaveClass('dark');
	});

	it('applies className and the frame divider flag', () => {
		const { rerender } = render(DocumentSplits, {
			...REQUIRED,
			splits: SPLITS,
			className: 'custom-frame',
			withFrameDivider: true
		});

		const root = screen.getByTestId('document-splits');
		expect(root).toHaveClass('custom-frame');
		expect(root).toHaveAttribute('data-frame-divider', 'true');

		rerender({ splits: SPLITS, withFrameDivider: false });

		expect(root).toHaveAttribute('data-frame-divider', 'false');
	});

	it('accepts class alongside the upstream className on the root', () => {
		render(DocumentSplits, {
			...REQUIRED,
			splits: SPLITS,
			class: 'from-class',
			className: 'from-class-name'
		});

		expect(screen.getByTestId('document-splits')).toHaveClass(
			'document-splits',
			'from-class',
			'from-class-name'
		);
	});

	it('is exported under the upstream name DocumentSplits', () => {
		expect(DocumentSplitsExport).toBe(DocumentSplits);
	});

	describe('lazy PDF page thumbnails', () => {
		class FakeIntersectionObserver {
			static instances: FakeIntersectionObserver[] = [];
			readonly targets = new Set<Element>();
			constructor(readonly callback: IntersectionObserverCallback) {
				FakeIntersectionObserver.instances.push(this);
			}
			observe(target: Element) {
				this.targets.add(target);
			}
			unobserve(target: Element) {
				this.targets.delete(target);
			}
			disconnect() {
				this.targets.clear();
			}
		}

		function scrollIntoView(...targets: Element[]) {
			for (const observer of FakeIntersectionObserver.instances) {
				const entries = targets
					.filter((target) => observer.targets.has(target))
					.map((target) => ({ target, isIntersecting: true }) as IntersectionObserverEntry);
				if (entries.length) {
					observer.callback(entries, observer as unknown as IntersectionObserver);
				}
			}
		}

		function setup() {
			pdfMock.created = 0;
			pdfMock.loads = [];
			pdfMock.rendered = [];
			FakeIntersectionObserver.instances = [];
			vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
			vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,AA==');
		}

		afterEach(() => {
			vi.unstubAllGlobals();
			vi.restoreAllMocks();
		});

		it('loads the PDF once for all pages and renders only pages that scroll into view', async () => {
			setup();
			render(DocumentSplits, { ...REQUIRED, splits: SPLITS, pdfUrl: '/fixtures/sample.pdf' });

			// Nothing is near the viewport yet: no page renders.
			await new Promise((resolve) => setTimeout(resolve, 20));
			expect(pdfMock.rendered).toEqual([]);

			scrollIntoView(screen.getByTestId('split-page-page-3'));
			await vi.waitFor(() => expect(pdfMock.rendered).toContain(3));
			expect(new Set(pdfMock.rendered)).toEqual(new Set([3]));

			scrollIntoView(screen.getByTestId('split-page-page-1'), screen.getByTestId('split-page-page-2'));
			await vi.waitFor(() => expect(new Set(pdfMock.rendered)).toEqual(new Set([1, 2, 3])));

			// Pages 4 and 5 stayed offscreen, and the document loaded exactly once.
			expect(pdfMock.created).toBe(1);
			expect(pdfMock.loads).toEqual(['/fixtures/sample.pdf']);

			await vi.waitFor(() => {
				const image = within(screen.getByTestId('split-page-page-3')).getByTestId(
					'file-thumbnail-image'
				);
				expect(image).toHaveAttribute('src', 'data:image/png;base64,AA==');
			});
			expect(
				within(screen.getByTestId('split-page-page-5')).queryByTestId('file-thumbnail-image')
			).not.toBeInTheDocument();
		});

		it('never renders pages that already have cached thumbnail images', async () => {
			setup();
			render(DocumentSplits, {
				...REQUIRED,
				splits: SPLITS,
				pdfUrl: '/fixtures/sample.pdf',
				thumbnailImages: { 'page-1': 'data:image/png;base64,CACHED' }
			});

			scrollIntoView(screen.getByTestId('split-page-page-1'), screen.getByTestId('split-page-page-2'));
			await vi.waitFor(() => expect(pdfMock.rendered).toContain(2));
			expect(pdfMock.rendered).not.toContain(1);
		});
	});
});

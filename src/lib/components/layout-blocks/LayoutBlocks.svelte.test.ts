// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
// Tests for LayoutBlocks, ported from apps/v4/components/extend/layout-blocks.tsx.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import LayoutBlocks from './LayoutBlocks.svelte';
import { OcrBlocksPanel } from './index.js';
import type { OcrBlock } from './layout-blocks.js';

function makeBlock(index: number, overrides: Partial<OcrBlock> = {}): OcrBlock {
	return {
		id: `block_${index}`,
		type: 'paragraph',
		text: `Paragraph ${index} with **bold** text.`,
		page: 1,
		pageWidth: 1275,
		pageHeight: 1651,
		confidence: 0.95,
		...overrides
	};
}

const sampleBlocks: OcrBlock[] = [
	makeBlock(0, { id: 'heading-1', type: 'heading', text: '# Attention Is All You Need' }),
	makeBlock(1, {
		id: 'para-1',
		type: 'paragraph',
		text: 'The **Transformer** dispenses with recurrence entirely.',
		confidence: 0.87
	}),
	makeBlock(2, {
		id: 'table-1',
		type: 'table',
		text: '| Model | BLEU |\n|---|---|\n| Transformer | 28.4 |',
		page: 2
	}),
	makeBlock(3, {
		id: 'figure-1',
		type: 'figure',
		text: '<figure>Architecture diagram<caption>Figure 1</caption></figure>'
	}),
	makeBlock(4, { id: 'list-1', type: 'list', text: '- first\n- second' })
];

describe('LayoutBlocks', () => {
	it('renders one row per block with type badges, confidence, and page pills', () => {
		render(LayoutBlocks, { blocks: sampleBlocks, height: 800 });

		expect(screen.getByTestId('layout-blocks')).toBeInTheDocument();
		const rows = screen.getAllByTestId('layout-block');
		expect(rows).toHaveLength(sampleBlocks.length);

		expect(screen.getByText('Heading')).toBeInTheDocument();
		expect(screen.getByText('Paragraph')).toBeInTheDocument();
		expect(screen.getByText('Table')).toBeInTheDocument();
		expect(screen.getByText('Figure')).toBeInTheDocument();
		expect(screen.getByText('List')).toBeInTheDocument();
		expect(screen.getByText('87%')).toBeInTheDocument();
		expect(screen.getByText('p. 2')).toBeInTheDocument();
	});

	it('renders block text as markdown', () => {
		render(LayoutBlocks, { blocks: sampleBlocks, height: 800 });

		expect(screen.getByRole('heading', { name: 'Attention Is All You Need' })).toBeInTheDocument();
		expect(screen.getByText('Transformer', { selector: 'strong' })).toBeInTheDocument();
		expect(screen.getByRole('table')).toBeInTheDocument();
	});

	it('shows an empty state when there are no blocks', () => {
		render(LayoutBlocks, { blocks: [] });

		expect(screen.getByTestId('layout-blocks-empty')).toHaveTextContent(
			'No layout blocks found.'
		);
		expect(screen.queryByTestId('layout-block')).not.toBeInTheDocument();
	});

	it('windows long documents so only the visible rows render', () => {
		const blocks = Array.from({ length: 100 }, (_, index) => makeBlock(index));
		render(LayoutBlocks, { blocks, height: 420, overscan: 2 });

		const rows = screen.getAllByTestId('layout-block');
		expect(rows.length).toBeGreaterThan(0);
		expect(rows.length).toBeLessThan(blocks.length);
		expect(screen.getByText(/Paragraph 0/)).toBeInTheDocument();
		expect(screen.queryByText(/Paragraph 99/)).not.toBeInTheDocument();
	});

	it('marks the first block active by default', () => {
		render(LayoutBlocks, { blocks: sampleBlocks, height: 800 });

		const rows = screen.getAllByTestId('layout-block');
		expect(rows[0]).toHaveAttribute('data-active', 'true');
		expect(rows[1]).toHaveAttribute('data-active', 'false');
	});

	it('honours a controlled activeBlockId', () => {
		render(LayoutBlocks, {
			blocks: sampleBlocks,
			height: 800,
			activeBlockId: 'table-1'
		});

		const rows = screen.getAllByTestId('layout-block');
		expect(rows[0]).toHaveAttribute('data-active', 'false');
		expect(rows[2]).toHaveAttribute('data-active', 'true');
	});

	it('focuses a block on hover, focus, and click', async () => {
		const onBlockFocus = vi.fn();
		render(LayoutBlocks, {
			blocks: sampleBlocks,
			height: 800,
			onBlockFocus
		});

		const rows = screen.getAllByTestId('layout-block');
		await fireEvent.mouseEnter(rows[1] as HTMLElement);
		expect(onBlockFocus).toHaveBeenLastCalledWith(sampleBlocks[1]);
		expect(rows[1]).toHaveAttribute('data-active', 'true');

		await fireEvent.click(rows[2] as HTMLElement);
		expect(onBlockFocus).toHaveBeenLastCalledWith(sampleBlocks[2]);

		await fireEvent.focus(rows[3] as HTMLElement);
		expect(onBlockFocus).toHaveBeenLastCalledWith(sampleBlocks[3]);
		expect(onBlockFocus).toHaveBeenCalledTimes(3);
	});

	it('reports a block once while a controlled parent has not caught up, like upstream', async () => {
		const onBlockFocus = vi.fn();
		render(LayoutBlocks, {
			blocks: sampleBlocks,
			activeBlockId: 'heading-1',
			onBlockFocus,
			height: 800
		});
		const para = screen.getAllByTestId('layout-block')[1]!;

		// Upstream's focusedBlockIdRef updates at once, so repeat events on the
		// same block are ignored even though the parent never moves activeBlockId.
		await fireEvent.mouseEnter(para);
		await fireEvent.focus(para);
		await fireEvent.click(para);
		await fireEvent.mouseEnter(para);
		expect(onBlockFocus).toHaveBeenCalledTimes(1);
		expect(onBlockFocus).toHaveBeenCalledWith(sampleBlocks[1]);
		expect(para).toHaveAttribute('data-active', 'false');

		// Going back to the controlled block reports it again, like upstream.
		await fireEvent.mouseEnter(screen.getAllByTestId('layout-block')[0]!);
		expect(onBlockFocus).toHaveBeenCalledTimes(2);
	});

	it('does not refocus the already active block', async () => {
		const onBlockFocus = vi.fn();
		render(LayoutBlocks, {
			blocks: sampleBlocks,
			height: 800,
			onBlockFocus
		});

		const rows = screen.getAllByTestId('layout-block');
		await fireEvent.mouseEnter(rows[0] as HTMLElement);
		expect(onBlockFocus).not.toHaveBeenCalled();
	});

	it('applies the dark class when isDark is true', async () => {
		const { rerender } = render(LayoutBlocks, { blocks: sampleBlocks, isDark: false });

		expect(screen.getByTestId('layout-blocks')).not.toHaveClass('dark');

		await rerender({ isDark: true });

		expect(screen.getByTestId('layout-blocks')).toHaveClass('dark');
	});

	it('applies a custom className to the root', () => {
		render(LayoutBlocks, { blocks: sampleBlocks, className: 'custom-panel' });

		expect(screen.getByTestId('layout-blocks')).toHaveClass('custom-panel');
	});

	it('sizes rows to their content instead of a fixed row height', () => {
		const { container } = render(LayoutBlocks, { blocks: sampleBlocks, height: 800 });

		const rows = container.querySelectorAll<HTMLElement>('[data-virtual-index]');
		expect(rows.length).toBe(sampleBlocks.length);
		for (const row of rows) expect(row.style.height).toBe('');
	});

	it('marks each row with its block type so the active ring uses the type color', () => {
		render(LayoutBlocks, { blocks: sampleBlocks, height: 800 });

		const rows = screen.getAllByTestId('layout-block');
		expect(rows[0]).toHaveAttribute('data-block-type', 'heading');
		expect(rows[2]).toHaveAttribute('data-block-type', 'table');
	});

	it('merges class and className onto the root', () => {
		render(LayoutBlocks, { blocks: sampleBlocks, class: 'from-class', className: 'from-classname' });

		expect(screen.getByTestId('layout-blocks')).toHaveClass('from-class');
		expect(screen.getByTestId('layout-blocks')).toHaveClass('from-classname');
	});

	it('never calls onIsDarkChange: the parent owns the theme', async () => {
		const onIsDarkChange = vi.fn();
		render(LayoutBlocks, { blocks: sampleBlocks, height: 800, isDark: true, onIsDarkChange });

		await fireEvent.click(screen.getAllByTestId('layout-block')[1] as HTMLElement);
		expect(onIsDarkChange).not.toHaveBeenCalled();
	});

	it('exports the upstream OcrBlocksPanel name', () => {
		expect(OcrBlocksPanel).toBe(LayoutBlocks);
	});

	it('renders no executable markup from hostile block text', () => {
		const payloads = [
			'<a href="&#106;avascript:alert(1)">a</a>',
			'<a href="java\tscript:alert(1)">b</a>',
			'[c](javascript:alert(1))',
			'<iframe srcdoc="&lt;script&gt;alert(1)&lt;/script&gt;"></iframe>',
			'<img src=x onerror=alert(1)>',
			'<details open ontoggle=alert(1)>d</details>',
			'<object data="javascript:alert(1)"></object>',
			'<embed src="javascript:alert(1)">',
			'<math><mtext><img src=x onerror=alert(1)></mtext></math>',
			'<form action="javascript:alert(1)"><button>e</button></form>',
			'<a href="x" style="position:fixed;inset:0">f</a>'
		];
		const blocks = payloads.map((text, index) => makeBlock(index, { id: `x-${index}`, text }));
		const { container } = render(LayoutBlocks, { blocks, height: 2000 });

		const body = container.querySelectorAll('.layout-block-body *');
		expect(body.length).toBeGreaterThan(0);
		for (const element of body) {
			expect(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'FORM', 'MATH', 'SVG']).not.toContain(
				element.tagName.toUpperCase()
			);
			for (const attribute of element.attributes) {
				expect(attribute.name).not.toMatch(/^on|^srcdoc$|^style$|^action$/i);
				if (['href', 'src'].includes(attribute.name)) {
					expect(attribute.value.replace(/[\s\u0000-\u001f]/g, '')).not.toMatch(
						/^(javascript|vbscript|data):/i
					);
				}
			}
		}
	});

	it('resets local focus to the new first block when blocks are replaced, like upstream', async () => {
		const onBlockFocus = vi.fn();
		const first = [makeBlock(0, { id: 'a-0' }), makeBlock(1, { id: 'a-1' })];
		const view = render(LayoutBlocks, { blocks: first, height: 800, onBlockFocus });
		await fireEvent.mouseEnter(screen.getAllByTestId('layout-block')[1] as HTMLElement);
		expect(onBlockFocus).toHaveBeenCalledTimes(1);

		const replaced = [makeBlock(0, { id: 'b-0' }), makeBlock(1, { id: 'b-1' })];
		await view.rerender({ blocks: replaced, height: 800, onBlockFocus });
		const rows = screen.getAllByTestId('layout-block');
		expect(rows[0]).toHaveAttribute('data-active', 'true');

		// The block already shown as active does not fire again.
		await fireEvent.mouseEnter(rows[0] as HTMLElement);
		expect(onBlockFocus).toHaveBeenCalledTimes(1);

		await fireEvent.mouseEnter(rows[1] as HTMLElement);
		expect(onBlockFocus).toHaveBeenCalledTimes(2);
		expect(onBlockFocus).toHaveBeenLastCalledWith(replaced[1]);
	});

	it('keeps the earlier controlled block active after the parent clears activeBlockId, like upstream', async () => {
		const onBlockFocus = vi.fn();
		const view = render(LayoutBlocks, {
			blocks: sampleBlocks,
			height: 800,
			activeBlockId: 'table-1',
			onBlockFocus
		});
		expect(screen.getAllByTestId('layout-block')[2]).toHaveAttribute('data-active', 'true');

		await view.rerender({ blocks: sampleBlocks, height: 800, activeBlockId: undefined, onBlockFocus });

		const rows = screen.getAllByTestId('layout-block');
		expect(rows[2]).toHaveAttribute('data-active', 'true');
		expect(rows[0]).toHaveAttribute('data-active', 'false');
		// Still focused locally, so hovering it again does not fire.
		await fireEvent.mouseEnter(rows[2] as HTMLElement);
		expect(onBlockFocus).not.toHaveBeenCalled();
	});
});

// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
// Tests for LayoutBlocks, ported from apps/v4/components/extend/layout-blocks.tsx.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import LayoutBlocks from './LayoutBlocks.svelte';
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
		render(LayoutBlocks, { blocks: sampleBlocks, height: 800, itemHeight: 140 });

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
		render(LayoutBlocks, { blocks: sampleBlocks, height: 800, itemHeight: 140 });

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
		render(LayoutBlocks, { blocks, height: 420, itemHeight: 140, overscan: 2 });

		const rows = screen.getAllByTestId('layout-block');
		expect(rows.length).toBeGreaterThan(0);
		expect(rows.length).toBeLessThan(blocks.length);
		expect(screen.getByText(/Paragraph 0/)).toBeInTheDocument();
		expect(screen.queryByText(/Paragraph 99/)).not.toBeInTheDocument();
	});

	it('marks the first block active by default', () => {
		render(LayoutBlocks, { blocks: sampleBlocks, height: 800, itemHeight: 140 });

		const rows = screen.getAllByTestId('layout-block');
		expect(rows[0]).toHaveAttribute('data-active', 'true');
		expect(rows[1]).toHaveAttribute('data-active', 'false');
	});

	it('honours a controlled activeBlockId', () => {
		render(LayoutBlocks, {
			blocks: sampleBlocks,
			height: 800,
			itemHeight: 140,
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
			itemHeight: 140,
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

	it('does not refocus the already active block', async () => {
		const onBlockFocus = vi.fn();
		render(LayoutBlocks, {
			blocks: sampleBlocks,
			height: 800,
			itemHeight: 140,
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
});

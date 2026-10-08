// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
import { describe, expect, it, vi } from 'vitest';
import { createRawSnippet } from 'svelte';
import { fireEvent, render, screen } from '@testing-library/svelte';
import Group from './Group.svelte';
import GroupSeparator from './GroupSeparator.svelte';
import GroupText from './GroupText.svelte';
import { ButtonGroup, ButtonGroupSeparator, ButtonGroupText, groupVariants } from './index.js';

function textChildren(html: string) {
	return createRawSnippet(() => ({ render: () => html }));
}

describe('Group', () => {
	it('renders children inside a group with the group data slot', () => {
		const children = textChildren('<button type="button">One</button>');
		render(Group, { children });

		const group = screen.getByRole('group');
		expect(group).toHaveAttribute('data-slot', 'group');
		expect(screen.getByRole('button', { name: 'One' })).toBeInTheDocument();
	});

	it('lays out horizontally by default and vertically on request', () => {
		const children = textChildren('<span>x</span>');
		const first = render(Group, { children });
		expect(first.container.firstElementChild?.className).toContain('flex');
		expect(first.container.firstElementChild).not.toHaveClass('flex-col');
		first.unmount();

		render(Group, { children, orientation: 'vertical' });
		const group = screen.getByRole('group');
		expect(group).toHaveAttribute('data-orientation', 'vertical');
		expect(group.className).toContain('flex-col');
	});

	it('merges a consumer class onto the root', () => {
		render(Group, { children: textChildren('<span>x</span>'), class: 'extra-class' });

		expect(screen.getByRole('group')).toHaveClass('extra-class');
	});

	it('spreads extra props onto the root element', () => {
		render(Group, { children: textChildren('<span>x</span>'), 'aria-label': 'actions', id: 'g1' });

		const group = screen.getByRole('group', { name: 'actions' });
		expect(group).toHaveAttribute('id', 'g1');
	});

	it('reflects the parent dark-mode flag with a dark class', async () => {
		const children = textChildren('<span>x</span>');
		const { container, rerender } = render(Group, { children, isDark: false });
		const root = () => container.firstElementChild as HTMLElement;

		expect(root()).not.toHaveClass('dark');

		await rerender({ children, isDark: true });
		expect(root()).toHaveClass('dark');

		await rerender({ children, isDark: false });
		expect(root()).not.toHaveClass('dark');
	});

	it('never fires onIsDarkChange itself: the parent owns the theme', async () => {
		const onIsDarkChange = vi.fn();
		render(Group, { children: textChildren('<span>x</span>'), isDark: true, onIsDarkChange });

		await fireEvent.click(screen.getByRole('group'));
		expect(onIsDarkChange).not.toHaveBeenCalled();
	});

	it('exposes the ButtonGroup alias and the variants helper', () => {
		expect(ButtonGroup).toBe(Group);
		expect(groupVariants()).toContain('flex');
		expect(groupVariants({ orientation: 'vertical' })).toContain('flex-col');
		expect(groupVariants({ class: 'merged' })).toContain('merged');
	});
});

describe('GroupText', () => {
	it('renders static text content with the group-text slot', () => {
		render(GroupText, { children: textChildren('<span>Filter</span>') });

		const text = screen.getByText('Filter');
		expect(text.parentElement).toHaveAttribute('data-slot', 'group-text');
	});

	it('merges class and dark mode onto the root', () => {
		const { container } = render(GroupText, {
			children: textChildren('<span>Filter</span>'),
			class: 'extra',
			isDark: true
		});

		expect(container.firstElementChild).toHaveClass('extra');
		expect(container.firstElementChild).toHaveClass('dark');
		expect(ButtonGroupText).toBe(GroupText);
	});
});

describe('GroupSeparator', () => {
	it('renders a vertical separator by default', () => {
		render(GroupSeparator);

		const separator = screen.getByRole('separator');
		expect(separator).toHaveAttribute('data-slot', 'separator');
		expect(separator).toHaveAttribute('data-orientation', 'vertical');
		expect(separator).toHaveAttribute('aria-orientation', 'vertical');
	});

	it('renders horizontally on request and merges class and dark mode', () => {
		render(GroupSeparator, { orientation: 'horizontal', class: 'extra', isDark: true });

		const separator = screen.getByRole('separator');
		expect(separator).toHaveAttribute('data-orientation', 'horizontal');
		expect(separator).toHaveClass('extra');
		expect(separator).toHaveClass('dark');
		expect(ButtonGroupSeparator).toBe(GroupSeparator);
	});
});

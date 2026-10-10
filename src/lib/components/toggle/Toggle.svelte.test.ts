// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
import { describe, expect, it, vi } from 'vitest';
import { createRawSnippet } from 'svelte';
import { fireEvent, render, screen } from '@testing-library/svelte';
import Toggle from './Toggle.svelte';
import ToggleGroup from './ToggleGroup.svelte';
import ToggleGroupItem from './ToggleGroupItem.svelte';
import ToggleGroupHarness from './ToggleGroupHarness.svelte';
import { toggleGroupVariants, toggleVariants } from './index.js';

function label(text: string) {
	return createRawSnippet(() => ({ render: () => `<span>${text}</span>` }));
}

describe('Toggle', () => {
	it('renders an unpressed toggle button by default', () => {
		render(Toggle, { children: label('Bold'), 'aria-label': 'Bold' });

		const button = screen.getByRole('button', { name: 'Bold' });
		expect(button).toHaveAttribute('data-slot', 'toggle');
		expect(button).toHaveAttribute('aria-pressed', 'false');
		expect(button).not.toHaveAttribute('data-pressed');
	});

	it('starts pressed from defaultPressed and toggles uncontrolled state on click', async () => {
		const onPressedChange = vi.fn();
		render(Toggle, {
			children: label('Bold'),
			'aria-label': 'Bold',
			defaultPressed: true,
			onPressedChange
		});

		const button = screen.getByRole('button', { name: 'Bold' });
		expect(button).toHaveAttribute('aria-pressed', 'true');
		expect(button).toHaveAttribute('data-pressed');

		await fireEvent.click(button);
		expect(onPressedChange).toHaveBeenCalledWith(false);
		expect(button).toHaveAttribute('aria-pressed', 'false');

		await fireEvent.click(button);
		expect(onPressedChange).toHaveBeenCalledWith(true);
		expect(button).toHaveAttribute('aria-pressed', 'true');
	});

	it('stays controlled by the pressed prop until the parent updates it', async () => {
		const onPressedChange = vi.fn();
		const view = render(Toggle, {
			children: label('Bold'),
			'aria-label': 'Bold',
			pressed: false,
			onPressedChange
		});

		const button = screen.getByRole('button', { name: 'Bold' });
		await fireEvent.click(button);
		expect(onPressedChange).toHaveBeenCalledWith(true);
		expect(button).toHaveAttribute('aria-pressed', 'false');

		await view.rerender({ children: label('Bold'), 'aria-label': 'Bold', pressed: true, onPressedChange });
		expect(button).toHaveAttribute('aria-pressed', 'true');
	});

	it('does nothing while disabled', async () => {
		const onPressedChange = vi.fn();
		render(Toggle, {
			children: label('Bold'),
			'aria-label': 'Bold',
			disabled: true,
			onPressedChange
		});

		const button = screen.getByRole('button', { name: 'Bold' });
		expect(button).toBeDisabled();
		await fireEvent.click(button);
		expect(onPressedChange).not.toHaveBeenCalled();
		expect(button).toHaveAttribute('aria-pressed', 'false');
	});

	it('applies variant, size, and consumer classes', () => {
		render(Toggle, {
			children: label('Bold'),
			'aria-label': 'Bold',
			variant: 'outline',
			size: 'sm',
			class: 'extra'
		});

		const button = screen.getByRole('button', { name: 'Bold' });
		expect(button.className).toContain('border-input');
		expect(button.className).toContain('extra');
		expect(toggleVariants({ variant: 'outline' })).toContain('border-input');
		expect(toggleVariants({ size: 'sm' })).toContain('h-8');
		expect(toggleVariants({ size: 'lg' })).toContain('h-10');
	});

	it('reflects the parent dark-mode flag and never fires onIsDarkChange itself', async () => {
		const onIsDarkChange = vi.fn();
		const { container, rerender } = render(Toggle, {
			children: label('Bold'),
			'aria-label': 'Bold',
			isDark: false,
			onIsDarkChange
		});

		expect(container.firstElementChild).not.toHaveClass('dark');
		await rerender({
			children: label('Bold'),
			'aria-label': 'Bold',
			isDark: true,
			onIsDarkChange
		});
		expect(container.firstElementChild).toHaveClass('dark');

		await fireEvent.click(screen.getByRole('button', { name: 'Bold' }));
		expect(onIsDarkChange).not.toHaveBeenCalled();
	});
});

describe('ToggleGroup', () => {
	it('renders a group with orientation and spacing metadata', () => {
		render(ToggleGroup, { children: label('<span>x</span>') });

		const group = screen.getByRole('group');
		expect(group).toHaveAttribute('data-slot', 'toggle-group');
		expect(group).toHaveAttribute('data-orientation', 'horizontal');
		expect(group).toHaveAttribute('data-spacing', 'default');
		expect(group.className).toContain('gap-1');
	});

	it('selects and deselects multiple items', async () => {
		const onValueChange = vi.fn();
		render(ToggleGroupHarness, { onValueChange });

		const bold = screen.getByRole('button', { name: 'Bold' });
		const italic = screen.getByRole('button', { name: 'Italic' });
		expect(bold).toHaveAttribute('data-slot', 'toggle-group-item');

		await fireEvent.click(bold);
		expect(onValueChange).toHaveBeenCalledWith(['bold']);
		expect(bold).toHaveAttribute('aria-pressed', 'true');

		await fireEvent.click(italic);
		expect(onValueChange).toHaveBeenCalledWith(['bold', 'italic']);
		expect(italic).toHaveAttribute('aria-pressed', 'true');

		await fireEvent.click(bold);
		expect(onValueChange).toHaveBeenCalledWith(['italic']);
		expect(bold).toHaveAttribute('aria-pressed', 'false');
	});

	it('replaces the selection when multiple is false', async () => {
		const onValueChange = vi.fn();
		render(ToggleGroupHarness, { multiple: false, onValueChange });

		const bold = screen.getByRole('button', { name: 'Bold' });
		const italic = screen.getByRole('button', { name: 'Italic' });

		await fireEvent.click(bold);
		expect(onValueChange).toHaveBeenCalledWith(['bold']);

		await fireEvent.click(italic);
		expect(onValueChange).toHaveBeenCalledWith(['italic']);
		expect(bold).toHaveAttribute('aria-pressed', 'false');
		expect(italic).toHaveAttribute('aria-pressed', 'true');

		await fireEvent.click(italic);
		expect(onValueChange).toHaveBeenCalledWith([]);
		expect(italic).toHaveAttribute('aria-pressed', 'false');
	});

	it('starts from defaultValue and stays controlled by value', async () => {
		const onValueChange = vi.fn();
		const view = render(ToggleGroupHarness, { defaultValue: ['bold'], onValueChange });
		expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true');
		view.unmount();

		const controlled = render(ToggleGroupHarness, { value: [], onValueChange });
		const bold = screen.getByRole('button', { name: 'Bold' });
		await fireEvent.click(bold);
		expect(onValueChange).toHaveBeenCalledWith(['bold']);
		expect(bold).toHaveAttribute('aria-pressed', 'false');

		await controlled.rerender({ value: ['bold'], onValueChange });
		expect(bold).toHaveAttribute('aria-pressed', 'true');
	});

	it('disables every item when the group is disabled', async () => {
		const onValueChange = vi.fn();
		render(ToggleGroupHarness, { disabled: true, onValueChange });

		const bold = screen.getByRole('button', { name: 'Bold' });
		expect(bold).toBeDisabled();
		await fireEvent.click(bold);
		expect(onValueChange).not.toHaveBeenCalled();
	});

	it('supports vertical orientation, joined spacing, class, and dark mode', () => {
		render(ToggleGroupHarness, {
			orientation: 'vertical',
			spacing: 'none',
			class: 'extra',
			isDark: true
		});

		const group = screen.getByRole('group');
		expect(group).toHaveAttribute('data-orientation', 'vertical');
		expect(group).toHaveAttribute('data-spacing', 'none');
		expect(group.className).toContain('flex-col');
		expect(group).toHaveClass('extra');
		expect(group).toHaveClass('dark');
		expect(toggleGroupVariants({ spacing: 'none' })).not.toContain('gap-1');
	});

	it('re-exports the item component from the barrel', () => {
		expect(ToggleGroupItem).toBeDefined();
		expect(ToggleGroup).toBeDefined();
	});
});

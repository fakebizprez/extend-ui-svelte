// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
import { describe, expect, it, vi } from 'vitest';
import { createRawSnippet, tick } from 'svelte';
import { fireEvent, render, screen } from '@testing-library/svelte';
import ColorPicker from './ColorPicker.svelte';
import { ColorPickerPanel } from './index.js';

// jsdom has no canvas: keep color parsing and the picker plane on their guarded paths.
vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null as never);

function iconSnippet() {
	return createRawSnippet(() => ({ render: () => '<span data-testid="icon">icon</span>' }));
}

describe('ColorPicker', () => {
	it('renders the input variant by default with the formatted value', () => {
		render(ColorPicker, { value: '#FF0000' });

		expect(screen.getByRole('button', { name: 'Choose color' })).toBeInTheDocument();
		expect(screen.getByLabelText('Choose color value')).toHaveValue('FF0000');
	});

	it('falls back to the upstream default color when uncontrolled', () => {
		render(ColorPicker);

		expect(screen.getByLabelText('Choose color value')).toHaveValue('111827');
	});

	it('honors a custom label and default format', () => {
		render(ColorPicker, { value: '#111827', label: 'Accent', defaultFormat: 'rgb' });

		expect(screen.getByRole('button', { name: 'Accent' })).toBeInTheDocument();
		expect(screen.getByLabelText('Accent value')).toHaveValue('17 24 39');
	});

	it('uses the swatch variant when the color prop is set', () => {
		render(ColorPicker, { color: '#FF0000' });

		expect(screen.getByRole('button', { name: 'Choose color' })).toBeInTheDocument();
		expect(screen.queryByLabelText('Choose color value')).not.toBeInTheDocument();
	});

	it('opens and closes the panel from the trigger', async () => {
		render(ColorPicker, { value: '#FF0000', variant: 'swatch' });
		const trigger = screen.getByRole('button', { name: 'Choose color' });

		expect(screen.queryByLabelText('Color value')).not.toBeInTheDocument();
		await fireEvent.click(trigger);
		expect(screen.getByLabelText('Color value')).toBeInTheDocument();
		await fireEvent.click(trigger);
		expect(screen.queryByLabelText('Color value')).not.toBeInTheDocument();
	});

	it('closes the panel on Escape', async () => {
		render(ColorPicker, { value: '#FF0000', variant: 'swatch' });

		await fireEvent.click(screen.getByRole('button', { name: 'Choose color' }));
		expect(screen.getByLabelText('Color value')).toBeInTheDocument();
		await fireEvent.keyDown(screen.getByLabelText('Color value'), { key: 'Escape' });
		expect(screen.queryByLabelText('Color value')).not.toBeInTheDocument();
	});

	it('behaves like the upstream Popover: expanded state, focus in, Escape, focus back', async () => {
		render(ColorPicker, { value: '#FF0000', variant: 'swatch' });
		const trigger = screen.getByRole('button', { name: 'Choose color' });
		expect(trigger).toHaveAttribute('aria-expanded', 'false');
		expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
		expect(trigger).not.toHaveAttribute('aria-controls');

		trigger.focus();
		await fireEvent.click(trigger);
		await tick();
		const dialog = screen.getByRole('dialog', { name: 'Choose color panel' });
		expect(trigger).toHaveAttribute('aria-expanded', 'true');
		expect(trigger).toHaveAttribute('aria-controls', dialog.id);
		// Focus moves to the first tabbable element in the panel.
		expect(screen.getByRole('button', { name: 'Chroma and lightness' })).toHaveFocus();

		await fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(trigger).toHaveAttribute('aria-expanded', 'false');
		expect(trigger).toHaveFocus();
	});

	it('closes on Escape even while focus is on the trigger', async () => {
		render(ColorPicker, { value: '#FF0000' });
		const trigger = screen.getByRole('button', { name: 'Choose color' });

		await fireEvent.click(trigger);
		await tick();
		trigger.focus();
		await fireEvent.keyDown(trigger, { key: 'Escape' });
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
	});

	it('closes on an outside press, stays open for presses inside, and returns focus', async () => {
		render(ColorPicker, { value: '#FF0000', variant: 'swatch' });
		const trigger = screen.getByRole('button', { name: 'Choose color' });

		await fireEvent.click(trigger);
		await tick();
		await fireEvent.pointerDown(screen.getByLabelText('Color format'));
		expect(screen.getByRole('dialog')).toBeInTheDocument();

		await fireEvent.pointerDown(document.body);
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		await new Promise((resolve) => setTimeout(resolve));
		expect(trigger).toHaveFocus();
	});

	it('leaves focus on the element an outside press focused', async () => {
		const outside = document.createElement('button');
		document.body.append(outside);
		render(ColorPicker, { value: '#FF0000', variant: 'swatch' });

		await fireEvent.click(screen.getByRole('button', { name: 'Choose color' }));
		await tick();
		await fireEvent.pointerDown(outside);
		outside.focus();
		await new Promise((resolve) => setTimeout(resolve));
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(outside).toHaveFocus();
		outside.remove();
	});

	it('closes when focus tabs out of the panel, like a non-modal Popover', async () => {
		const outside = document.createElement('button');
		document.body.append(outside);
		render(ColorPicker, { value: '#FF0000', variant: 'swatch' });

		await fireEvent.click(screen.getByRole('button', { name: 'Choose color' }));
		await tick();
		const plane = screen.getByRole('button', { name: 'Chroma and lightness' });
		await fireEvent.focusOut(plane, { relatedTarget: screen.getByLabelText('Color format') });
		expect(screen.getByRole('dialog')).toBeInTheDocument();
		await fireEvent.focusOut(plane, { relatedTarget: outside });
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		outside.remove();
	});

	it('commits typed colors as uppercase hex through onChange', async () => {
		const onChange = vi.fn();
		render(ColorPicker, { value: '#FF0000', onChange });

		const field = screen.getByLabelText('Choose color value');
		await fireEvent.input(field, { target: { value: '#00ff00' } });
		await fireEvent.blur(field);
		expect(onChange).toHaveBeenCalledWith('#00FF00');
	});

	it('ignores invalid typed colors', async () => {
		const onChange = vi.fn();
		render(ColorPicker, { value: '#FF0000', onChange });

		const field = screen.getByLabelText('Choose color value');
		await fireEvent.input(field, { target: { value: 'zzz' } });
		await fireEvent.blur(field);
		expect(onChange).not.toHaveBeenCalled();
		expect(field).toHaveValue('FF0000');
	});

	it('follows the controlled value when the parent updates it', async () => {
		const view = render(ColorPicker, { value: '#FF0000' });
		expect(screen.getByLabelText('Choose color value')).toHaveValue('FF0000');

		await view.rerender({ value: '#00FF00' });
		expect(screen.getByLabelText('Choose color value')).toHaveValue('00FF00');
	});

	it('switches the displayed format from the panel select', async () => {
		render(ColorPicker, { value: '#111827', variant: 'panel' });

		await fireEvent.change(screen.getByLabelText('Color format'), { target: { value: 'rgb' } });
		expect(screen.getByLabelText('Color value')).toHaveValue('17 24 39');

		await fireEvent.change(screen.getByLabelText('Color format'), { target: { value: 'hex' } });
		expect(screen.getByLabelText('Color value')).toHaveValue('111827');
	});

	it('commits channel edits per color model', async () => {
		const onChange = vi.fn();
		render(ColorPicker, { value: '#000000', variant: 'panel', onChange });

		const red = screen.getByLabelText('Red');
		expect(red).toHaveValue('0');
		await fireEvent.input(red, { target: { value: '255' } });
		await fireEvent.blur(red);
		expect(onChange).toHaveBeenCalledWith('#FF0000');

		expect(screen.getByLabelText('HSL hue')).toBeInTheDocument();
		expect(screen.getByLabelText('OKLCH lightness')).toBeInTheDocument();
	});

	it('keeps the HSL hue when the color passes through gray, like upstream', async () => {
		const onChange = vi.fn();
		render(ColorPicker, { value: '#FF0000', variant: 'panel', onChange });

		const saturation = screen.getByLabelText('HSL saturation');
		await fireEvent.input(saturation, { target: { value: '0' } });
		await fireEvent.blur(saturation);
		expect(onChange).toHaveBeenLastCalledWith('#808080');
		expect(screen.getByLabelText('HSL hue')).toHaveValue('0.0');

		await fireEvent.input(saturation, { target: { value: '100' } });
		await fireEvent.blur(saturation);
		expect(onChange).toHaveBeenLastCalledWith('#FF0000');
	});

	it('steps channel values with the arrow keys', async () => {
		const onChange = vi.fn();
		render(ColorPicker, { value: '#000000', variant: 'panel', onChange });

		await fireEvent.keyDown(screen.getByLabelText('Green'), { key: 'ArrowUp' });
		expect(onChange).toHaveBeenCalledWith('#000100');
	});

	it('adjusts hue and opacity from the panel sliders', async () => {
		const onChange = vi.fn();
		render(ColorPicker, { value: '#FF0000', variant: 'panel', showAlpha: true, onChange });

		const hue = screen.getByRole('slider', { name: 'Hue' });
		expect(hue).toHaveAttribute('aria-valuemax', '360');
		await fireEvent.keyDown(hue, { key: 'ArrowDown' });
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange.mock.calls[0]![0]).toMatch(/^#[0-9A-F]{6}$/);

		const opacity = screen.getByRole('slider', { name: 'Opacity' });
		await fireEvent.keyDown(opacity, { key: 'ArrowDown' });
		expect(onChange).toHaveBeenCalledTimes(2);
		expect(onChange.mock.calls[1]![0]).toMatch(/^#[0-9A-F]{8}$/);
	});

	it('renders the panel variant inline without a trigger', () => {
		const { container } = render(ColorPicker, { value: '#FF0000', variant: 'panel' });

		expect(screen.getByLabelText('Color value')).toBeInTheDocument();
		expect(container.querySelector('[data-color-picker-trigger]')).toBeNull();
	});

	it('disables the trigger and fields when disabled', async () => {
		const onChange = vi.fn();
		render(ColorPicker, { value: '#FF0000', variant: 'swatch', disabled: true, onChange });

		const trigger = screen.getByRole('button', { name: 'Choose color' });
		expect(trigger).toBeDisabled();
		await fireEvent.click(trigger);
		expect(screen.queryByLabelText('Color value')).not.toBeInTheDocument();
		expect(onChange).not.toHaveBeenCalled();
	});

	it('disables only the channel and opacity fields in a disabled panel, like upstream', () => {
		render(ColorPicker, { value: '#FF0000', variant: 'panel', disabled: true, showAlpha: true });

		for (const name of ['Red', 'HSL hue', 'OKLCH lightness']) {
			expect(screen.getByLabelText(name)).toBeDisabled();
		}
		expect(screen.getByLabelText('Opacity', { selector: 'input' })).toBeDisabled();

		// Upstream passes `disabled` only to the channel groups and the opacity field.
		expect(screen.getByRole('button', { name: 'Chroma and lightness' })).toBeEnabled();
		expect(screen.getByRole('slider', { name: 'Hue' })).toBeEnabled();
		expect(screen.getByRole('slider', { name: 'Opacity' })).toBeEnabled();
		expect(screen.getByLabelText('Color value')).toBeEnabled();
		expect(screen.getByLabelText('Color format')).toBeEnabled();
	});

	it('labels the panel opacity field "Opacity", like upstream', () => {
		render(ColorPicker, { value: '#FF000080', variant: 'panel', showAlpha: true });

		expect(screen.getByLabelText('Opacity', { selector: 'input' })).toHaveValue('50');
		expect(screen.queryByLabelText('Panel opacity')).not.toBeInTheDocument();
	});

	it('renders the rainbow trigger and custom icons', () => {
		const rainbow = render(ColorPicker, { value: '#FF0000', variant: 'swatch', rainbowTrigger: true });
		expect(rainbow.container.querySelector('span[style*="conic-gradient"]')).not.toBeNull();
		rainbow.unmount();

		render(ColorPicker, {
			value: '#FF0000',
			variant: 'swatch',
			icon: iconSnippet() as never
		});
		expect(screen.getByTestId('icon')).toBeInTheDocument();
	});

	it('forwards trigger mouse and pointer down handlers', async () => {
		const onTriggerMouseDown = vi.fn();
		const onTriggerPointerDown = vi.fn();
		render(ColorPicker, {
			value: '#FF0000',
			variant: 'swatch',
			onTriggerMouseDown,
			onTriggerPointerDown
		});

		const trigger = screen.getByRole('button', { name: 'Choose color' });
		await fireEvent.mouseDown(trigger);
		await fireEvent.pointerDown(trigger);
		expect(onTriggerMouseDown).toHaveBeenCalledTimes(1);
		expect(onTriggerPointerDown).toHaveBeenCalledTimes(1);
	});

	it('reflects the parent dark-mode flag and never fires onIsDarkChange itself', async () => {
		const onIsDarkChange = vi.fn();
		const { container, rerender } = render(ColorPicker, { value: '#FF0000', isDark: false });

		expect(container.firstElementChild).not.toHaveClass('dark');
		await rerender({ value: '#FF0000', isDark: true, onIsDarkChange });
		expect(container.firstElementChild).toHaveClass('dark');

		await fireEvent.click(screen.getByRole('button', { name: 'Choose color' }));
		expect(onIsDarkChange).not.toHaveBeenCalled();
	});
});

describe('ColorPickerPanel', () => {
	it('renders an inline panel bound to color and onChange', async () => {
		const onChange = vi.fn();
		const { container } = render(ColorPickerPanel, {
			color: '#00FF00',
			label: 'Fill',
			onChange
		});

		expect(screen.getByLabelText('Color value')).toHaveValue('00FF00');
		expect(container.querySelector('[data-color-picker-trigger]')).toBeNull();

		const blue = screen.getByLabelText('Blue');
		await fireEvent.input(blue, { target: { value: '255' } });
		await fireEvent.blur(blue);
		expect(onChange).toHaveBeenCalledWith('#00FFFF');
	});
});

describe('ColorPicker className alias', () => {
	it('merges className and class onto the input-variant root', () => {
		render(ColorPicker, { value: '#FF0000', class: 'a', className: 'b' });
		const root = screen.getByLabelText('Choose color value').closest('[data-slot="color-picker"]');
		expect(root).toHaveClass('a');
		expect(root).toHaveClass('b');
	});

	it('merges className onto the swatch trigger and the panel root', () => {
		const swatch = render(ColorPicker, { color: '#FF0000', className: 'swatch-alias' });
		expect(screen.getByRole('button', { name: 'Choose color' })).toHaveClass('swatch-alias');
		swatch.unmount();

		const { container } = render(ColorPickerPanel, {
			color: '#FF0000',
			label: 'Fill',
			onChange: () => {},
			className: 'panel-alias'
		});
		expect(container.firstElementChild).toHaveClass('panel-alias');
	});
});

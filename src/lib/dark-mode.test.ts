// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_IS_DARK, resolveIsDark, toggleIsDark } from './dark-mode';
import type { DarkModeProps } from './dark-mode';

describe('dark-mode contract', () => {
	it('defaults to light mode', () => {
		expect(DEFAULT_IS_DARK).toBe(false);
	});

	it('keeps the isDark / onIsDarkChange prop contract', () => {
		const props: DarkModeProps = { isDark: true, onIsDarkChange: () => {} };

		expect(props.isDark).toBe(true);
		expect(typeof props.onIsDarkChange).toBe('function');
	});

	it('resolveIsDark passes explicit values through', () => {
		expect(resolveIsDark(true)).toBe(true);
		expect(resolveIsDark(false)).toBe(false);
	});

	it('resolveIsDark falls back to the default when undefined', () => {
		expect(resolveIsDark(undefined)).toBe(DEFAULT_IS_DARK);
		expect(resolveIsDark()).toBe(DEFAULT_IS_DARK);
	});

	it('toggleIsDark flips true to false and notifies', () => {
		const onIsDarkChange = vi.fn();

		expect(toggleIsDark(true, onIsDarkChange)).toBe(false);
		expect(onIsDarkChange).toHaveBeenCalledTimes(1);
		expect(onIsDarkChange).toHaveBeenCalledWith(false);
	});

	it('toggleIsDark flips false to true and notifies', () => {
		const onIsDarkChange = vi.fn();

		expect(toggleIsDark(false, onIsDarkChange)).toBe(true);
		expect(onIsDarkChange).toHaveBeenCalledWith(true);
	});

	it('toggleIsDark treats undefined as the default and notifies', () => {
		const onIsDarkChange = vi.fn();

		expect(toggleIsDark(undefined, onIsDarkChange)).toBe(true);
		expect(onIsDarkChange).toHaveBeenCalledWith(true);
	});

	it('toggleIsDark works without a callback', () => {
		expect(toggleIsDark(true)).toBe(false);
		expect(toggleIsDark(false)).toBe(true);
	});
});

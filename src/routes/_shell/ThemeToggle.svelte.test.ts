// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import ThemeToggle from './ThemeToggle.svelte';

beforeEach(() => {
	const store = new Map<string, string>();
	vi.stubGlobal('localStorage', {
		getItem: (k: string) => store.get(k) ?? null,
		setItem: (k: string, v: string) => void store.set(k, v),
		clear: () => store.clear()
	});
	delete document.documentElement.dataset.theme;
	document.documentElement.classList.remove('dark');
});

describe('ThemeToggle', () => {
	it('uses the stored theme on mount', async () => {
		localStorage.setItem('docs-theme', 'dark');
		render(ThemeToggle);
		await Promise.resolve();
		expect(document.documentElement.dataset.theme).toBe('dark');
		expect(document.documentElement).toHaveClass('dark');
	});

	it('flips theme, class and storage on click', async () => {
		localStorage.setItem('docs-theme', 'light');
		render(ThemeToggle);
		await fireEvent.click(screen.getByRole('button', { name: 'Toggle theme' }));
		expect(document.documentElement.dataset.theme).toBe('dark');
		expect(document.documentElement).toHaveClass('dark');
		expect(localStorage.getItem('docs-theme')).toBe('dark');
		await fireEvent.click(screen.getByRole('button', { name: 'Toggle theme' }));
		expect(document.documentElement.dataset.theme).toBe('light');
		expect(document.documentElement).not.toHaveClass('dark');
	});
});

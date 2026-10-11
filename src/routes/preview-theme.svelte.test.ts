// MIT License — docs preview theme regressions. Upstream: extend-hq/ui (MIT).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import ThemeToggle from './_shell/ThemeToggle.svelte';
import FileUploadPage from './file-upload/+page.svelte';
import CsvPage from './csv-tsv-viewer/+page.svelte';

beforeEach(() => {
	const storage = new Map<string, string>();
	vi.stubGlobal('localStorage', {
		getItem: (key: string) => storage.get(key) ?? null,
		setItem: (key: string, value: string) => storage.set(key, value)
	});
});

describe('docs preview theme', () => {
	it('starts in the saved dark theme and follows site theme changes', async () => {
		localStorage.setItem('docs-theme', 'dark');
		render(ThemeToggle);
		render(FileUploadPage);

		const previewSwitch = screen.getByRole('checkbox', { name: 'Dark mode' });
		await waitFor(() => expect(previewSwitch).toBeChecked());
		await fireEvent.click(screen.getByRole('button', { name: 'Toggle theme' }));
		await waitFor(() => expect(previewSwitch).not.toBeChecked());
		await fireEvent.click(previewSwitch);
		expect(previewSwitch).toBeChecked();
		expect(document.documentElement.dataset.theme).toBe('light');
	});

	it('makes every CSV preview follow light and dark, including empty and long examples', async () => {
		localStorage.setItem('docs-theme', 'light');
		render(ThemeToggle);
		const { container } = render(CsvPage);
		const previews = () => Array.from(container.querySelectorAll('.csv-tsv-viewer'));
		expect(previews()).toHaveLength(4);
		for (const preview of previews()) expect(preview).not.toHaveClass('dark');
		await fireEvent.click(screen.getByRole('button', { name: 'Toggle theme' }));
		await waitFor(() => {
			for (const preview of previews()) expect(preview).toHaveClass('dark');
		});
	});
});

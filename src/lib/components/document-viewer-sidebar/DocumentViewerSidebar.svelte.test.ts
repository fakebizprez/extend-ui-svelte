import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import DocumentViewerSidebar from './DocumentViewerSidebar.svelte';
import type { DocumentViewerSidebarSection } from './DocumentViewerSidebar.svelte';

const SECTIONS: DocumentViewerSidebarSection[] = [
	{
		id: 'navigate',
		title: 'Navigate',
		items: [
			{ id: 'thumbnails', label: 'Thumbnails' },
			{ id: 'outline', label: 'Outline' }
		]
	},
	{
		id: 'tools',
		title: 'Tools',
		items: [
			{ id: 'search', label: 'Search' },
			{ id: 'annotate', label: 'Annotate', disabled: true }
		]
	}
];

describe('DocumentViewerSidebar', () => {
	it('renders section titles and item labels', () => {
		render(DocumentViewerSidebar, { sections: SECTIONS });

		expect(screen.getByText('Navigate')).toBeInTheDocument();
		expect(screen.getByText('Tools')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Thumbnails' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Outline' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
	});

	it('marks the active item with aria-current', () => {
		render(DocumentViewerSidebar, { sections: SECTIONS, activeItemId: 'outline' });

		expect(screen.getByRole('button', { name: 'Outline' })).toHaveAttribute('aria-current', 'true');
		expect(screen.getByRole('button', { name: 'Thumbnails' })).not.toHaveAttribute('aria-current');
	});

	it('emits onActiveItemChange when an item is clicked', async () => {
		const onActiveItemChange = vi.fn();
		render(DocumentViewerSidebar, { sections: SECTIONS, onActiveItemChange });

		await fireEvent.click(screen.getByRole('button', { name: 'Search' }));

		expect(onActiveItemChange).toHaveBeenCalledTimes(1);
		expect(onActiveItemChange).toHaveBeenCalledWith('search');
	});

	it('does not emit onActiveItemChange for disabled items', async () => {
		const onActiveItemChange = vi.fn();
		render(DocumentViewerSidebar, { sections: SECTIONS, onActiveItemChange });

		expect(screen.getByRole('button', { name: 'Annotate' })).toBeDisabled();
		await fireEvent.click(screen.getByRole('button', { name: 'Annotate' }));

		expect(onActiveItemChange).not.toHaveBeenCalled();
	});

	it('collapsed state hides item labels and flags the sidebar', () => {
		render(DocumentViewerSidebar, { sections: SECTIONS, collapsed: true });

		expect(screen.getByTestId('document-viewer-sidebar')).toHaveAttribute(
			'data-collapsed',
			'true'
		);
		expect(screen.queryByText('Thumbnails')).not.toBeInTheDocument();
		expect(screen.queryByText('Navigate')).not.toBeInTheDocument();
	});

	it('collapse toggle notifies onCollapsedChange', async () => {
		const onCollapsedChange = vi.fn();
		render(DocumentViewerSidebar, { sections: SECTIONS, onCollapsedChange });

		await fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));

		expect(onCollapsedChange).toHaveBeenCalledTimes(1);
		expect(onCollapsedChange).toHaveBeenCalledWith(true);
	});

	it('dark-mode contract: isDark sets the dark theme', () => {
		render(DocumentViewerSidebar, { sections: SECTIONS, isDark: true });

		expect(screen.getByTestId('document-viewer-sidebar')).toHaveAttribute('data-theme', 'dark');
	});

	it('dark-mode toggle notifies onIsDarkChange', async () => {
		const onIsDarkChange = vi.fn();
		render(DocumentViewerSidebar, { sections: SECTIONS, isDark: false, onIsDarkChange });

		await fireEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }));

		expect(onIsDarkChange).toHaveBeenCalledTimes(1);
		expect(onIsDarkChange).toHaveBeenCalledWith(true);
	});
});

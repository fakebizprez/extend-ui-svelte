import { describe, expect, it } from 'vitest';
import { createRawSnippet } from 'svelte';
import { render, screen, waitFor } from '@testing-library/svelte';
import DocumentViewerThumbnailSidebar from './DocumentViewerThumbnailSidebar.svelte';

const children = createRawSnippet(() => ({ render: () => '<p>Thumbnails</p>' }));

function sidebar(container: HTMLElement): HTMLElement {
	return container.querySelector('[data-document-thumbnail-sidebar]') as HTMLElement;
}

describe('DocumentViewerThumbnailSidebar', () => {
	it('renders children in an open inline aside', () => {
		const { container } = render(DocumentViewerThumbnailSidebar, {
			inline: true,
			open: true,
			children
		});
		const aside = sidebar(container);

		expect(aside.tagName).toBe('ASIDE');
		expect(aside).toHaveAttribute('data-sidebar-mode', 'inline');
		expect(aside).toHaveAttribute('data-sidebar-open', 'true');
		expect(screen.getByText('Thumbnails')).toBeInTheDocument();
	});

	it('marks a closed overlay sidebar', () => {
		const { container } = render(DocumentViewerThumbnailSidebar, {
			inline: false,
			open: false,
			children
		});

		expect(sidebar(container)).toHaveAttribute('data-sidebar-mode', 'overlay');
		expect(sidebar(container)).toHaveAttribute('data-sidebar-open', 'false');
	});

	it('merges className and class onto the root', () => {
		const { container } = render(DocumentViewerThumbnailSidebar, {
			inline: true,
			open: true,
			className: 'from-react',
			class: 'from-svelte',
			children
		});

		expect(sidebar(container)).toHaveClass('from-react', 'from-svelte');
	});

	it('enables transitions only after two frames and only while open', async () => {
		const { container, rerender } = render(DocumentViewerThumbnailSidebar, {
			inline: true,
			open: true,
			children
		});

		expect(sidebar(container)).not.toHaveClass('animate');
		await waitFor(() => expect(sidebar(container)).toHaveClass('animate'));

		await rerender({ inline: true, open: false, children });
		expect(sidebar(container)).not.toHaveClass('animate');
	});

	it('reflects the parent isDark and renders no theme control of its own', () => {
		const { container } = render(DocumentViewerThumbnailSidebar, {
			inline: true,
			open: true,
			isDark: true,
			children
		});

		expect(sidebar(container)).toHaveClass('dark');
		expect(screen.queryByRole('button')).not.toBeInTheDocument();
	});
});

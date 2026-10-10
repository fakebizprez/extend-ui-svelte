import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import DocumentViewerSidebarSkeleton from './DocumentViewerSidebarSkeleton.svelte';

describe('DocumentViewerSidebarSkeleton', () => {
	it('renders nothing when the sidebar is an overlay', () => {
		const { container } = render(DocumentViewerSidebarSkeleton, { inline: false });

		expect(container.querySelector('[data-document-sidebar-skeleton]')).toBeNull();
	});

	it('renders a placeholder thumbnail and label when inline', () => {
		const { container } = render(DocumentViewerSidebarSkeleton, { inline: true });
		const skeleton = container.querySelector('[data-document-sidebar-skeleton]');

		expect(skeleton).not.toBeNull();
		expect(skeleton!.querySelector('.thumbnail .pulse')).not.toBeNull();
		expect(skeleton!.querySelector('.label')).not.toBeNull();
	});

	it('merges className and class and reflects isDark', () => {
		const { container } = render(DocumentViewerSidebarSkeleton, {
			inline: true,
			className: 'from-react',
			class: 'from-svelte',
			isDark: true
		});

		expect(container.querySelector('[data-document-sidebar-skeleton]')).toHaveClass(
			'from-react',
			'from-svelte',
			'dark'
		);
	});
});

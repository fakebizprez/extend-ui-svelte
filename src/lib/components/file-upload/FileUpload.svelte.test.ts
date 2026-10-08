// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
// Tests for FileUpload, ported from apps/v4/components/extend/file-upload.tsx.
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import FileUpload from './FileUpload.svelte';

const pdfFile = () => new File(['%PDF-1.4'], 'report.pdf', { type: 'application/pdf' });
const pngFile = () => new File(['png-bytes'], 'photo.png', { type: 'image/png' });
const exeFile = () =>
	new File(['MZ-bytes'], 'setup.exe', { type: 'application/x-msdownload' });

function dropOn(node: HTMLElement, files: File[]) {
	return fireEvent.drop(node, {
		dataTransfer: { files, types: ['Files'] }
	});
}

describe('FileUpload', () => {
	beforeEach(() => {
		vi.stubGlobal(
			'URL',
			class extends URL {
				static createObjectURL = vi.fn(() => 'blob:mock-url');
				static revokeObjectURL = vi.fn();
			}
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('renders the default title, description, and browse label', () => {
		render(FileUpload);

		expect(screen.getByText('Click to upload or drop files')).toBeInTheDocument();
		expect(screen.getByText('PDF, DOC/DOCX, XLSX, CSV, PNG, or JPG')).toBeInTheDocument();
		expect(screen.getByText('Browse files')).toBeInTheDocument();
		expect(
			screen.getByRole('button', { name: /click to upload or drop files/i })
		).toBeInTheDocument();
	});

	it('renders a native file input with accept and multiple attributes', () => {
		const { container } = render(FileUpload);

		const input = container.querySelector('input[type="file"]') as HTMLInputElement;
		expect(input).not.toBeNull();
		expect(input.getAttribute('accept')).toContain('.pdf');
		expect(input.hasAttribute('multiple')).toBe(true);
	});

	it('emits files selected through the native input and lists them', async () => {
		const onFilesAccepted = vi.fn();
		const onFilesChange = vi.fn();
		const { container } = render(FileUpload, { onFilesAccepted, onFilesChange });

		const input = container.querySelector('input[type="file"]') as HTMLInputElement;
		const file = pdfFile();
		await fireEvent.change(input, { target: { files: [file] } });

		expect(onFilesAccepted).toHaveBeenCalledTimes(1);
		expect(onFilesAccepted).toHaveBeenCalledWith([file]);
		expect(onFilesChange).toHaveBeenCalledTimes(1);
		const items = onFilesChange.mock.calls[0][0];
		expect(items).toHaveLength(1);
		expect(items[0]).toMatchObject({ name: 'report.pdf', type: 'application/pdf' });
		expect(items[0].id).toContain('report.pdf');
		expect(items[0].url).toBe('blob:mock-url');
		expect(screen.getByText('report.pdf')).toBeInTheDocument();
		expect(screen.getByText('Ready')).toBeInTheDocument();
	});

	it('accepts files dropped on the drop zone', async () => {
		const onFilesAccepted = vi.fn();
		render(FileUpload, { onFilesAccepted });

		const dropzone = screen.getByRole('button', { name: /click to upload/i });
		const file = pngFile();
		await dropOn(dropzone, [file]);

		expect(onFilesAccepted).toHaveBeenCalledTimes(1);
		expect(onFilesAccepted).toHaveBeenCalledWith([file]);
		expect(screen.getByText('photo.png')).toBeInTheDocument();
	});

	it('accepts multiple files when multiple is true', async () => {
		const onFilesAccepted = vi.fn();
		render(FileUpload, { multiple: true, onFilesAccepted });

		const dropzone = screen.getByRole('button', { name: /click to upload/i });
		await dropOn(dropzone, [pdfFile(), pngFile()]);

		expect(onFilesAccepted).toHaveBeenCalledTimes(1);
		expect(onFilesAccepted.mock.calls[0][0]).toHaveLength(2);
		expect(screen.getByText('report.pdf')).toBeInTheDocument();
		expect(screen.getByText('photo.png')).toBeInTheDocument();
	});

	it('keeps only the first file when multiple is false', async () => {
		const onFilesAccepted = vi.fn();
		render(FileUpload, { multiple: false, onFilesAccepted });

		const dropzone = screen.getByRole('button', { name: /click to upload/i });
		await dropOn(dropzone, [pdfFile(), pngFile()]);

		expect(onFilesAccepted).toHaveBeenCalledTimes(1);
		expect(onFilesAccepted.mock.calls[0][0]).toHaveLength(1);
		expect(screen.getByText('report.pdf')).toBeInTheDocument();
		expect(screen.queryByText('photo.png')).not.toBeInTheDocument();
	});

	it('rejects files outside the accept filter with a message and no events', async () => {
		const onFilesAccepted = vi.fn();
		const onFilesChange = vi.fn();
		render(FileUpload, { onFilesAccepted, onFilesChange });

		const dropzone = screen.getByRole('button', { name: /click to upload/i });
		await dropOn(dropzone, [exeFile()]);

		expect(screen.getByText('This file type is not supported here.')).toBeInTheDocument();
		expect(onFilesAccepted).not.toHaveBeenCalled();
		expect(onFilesChange).not.toHaveBeenCalled();
	});

	it('honours a custom accept filter', async () => {
		const onFilesAccepted = vi.fn();
		render(FileUpload, { accept: 'image/*', onFilesAccepted });

		const dropzone = screen.getByRole('button', { name: /click to upload/i });
		await dropOn(dropzone, [pngFile(), pdfFile()]);

		expect(onFilesAccepted).toHaveBeenCalledTimes(1);
		expect(onFilesAccepted.mock.calls[0][0]).toHaveLength(1);
		expect(onFilesAccepted.mock.calls[0][0][0].name).toBe('photo.png');
	});

	it('shows the dragging label while a drag is over the drop zone', async () => {
		render(FileUpload);

		const dropzone = screen.getByRole('button', { name: /click to upload/i });
		await fireEvent.dragEnter(dropzone);

		expect(screen.getByText('Drop to add')).toBeInTheDocument();

		await fireEvent.dragLeave(dropzone);

		expect(screen.getByText('Browse files')).toBeInTheDocument();
	});

	it('opens the file dialog on click and on Enter', async () => {
		const { container } = render(FileUpload);

		const input = container.querySelector('input[type="file"]') as HTMLInputElement;
		const clickSpy = vi.spyOn(input, 'click').mockImplementation(() => {});
		const dropzone = screen.getByRole('button', { name: /click to upload/i });

		await fireEvent.click(dropzone);
		expect(clickSpy).toHaveBeenCalledTimes(1);

		await fireEvent.keyDown(dropzone, { key: 'Enter' });
		expect(clickSpy).toHaveBeenCalledTimes(2);
	});

	it('hides the file list when showFileList is false', async () => {
		const onFilesAccepted = vi.fn();
		render(FileUpload, { showFileList: false, onFilesAccepted });

		const dropzone = screen.getByRole('button', { name: /click to upload/i });
		await dropOn(dropzone, [pdfFile()]);

		expect(onFilesAccepted).toHaveBeenCalledTimes(1);
		expect(screen.queryByText('report.pdf')).not.toBeInTheDocument();
	});

	it('applies the dark class when isDark is true', async () => {
		const { container, rerender } = render(FileUpload, { isDark: false });
		const root = container.firstElementChild as HTMLElement;

		expect(root).not.toHaveClass('dark');

		await rerender({ isDark: true });

		expect((container.firstElementChild as HTMLElement)).toHaveClass('dark');
	});

	it('notifies the parent through onIsDarkChange from the theme toggle', async () => {
		const onIsDarkChange = vi.fn();
		render(FileUpload, { isDark: false, onIsDarkChange });

		await fireEvent.click(screen.getByRole('button', { name: /toggle dark mode/i }));

		expect(onIsDarkChange).toHaveBeenCalledTimes(1);
		expect(onIsDarkChange).toHaveBeenCalledWith(true);
	});
});

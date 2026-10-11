// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
/// <reference types="vite/client" />
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	interface Window {
		/** Test hook set by the /engines/docx harness page for Playwright. */
		__docxHarness?: {
			render: (bytes: number[]) => Promise<import('$lib/engines/docx/index.js').DocxRenderResult>;
		};
	}
}

export {};

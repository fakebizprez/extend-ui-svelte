// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
export { default as ESignature, type ESignatureProps } from './ESignature.svelte';
/** Upstream React export name. */
export { default as ESignatureBlock } from './ESignature.svelte';
export { default } from './ESignature.svelte';
export {
	clampPage,
	clampScale,
	dataUrlToBytes,
	DEFAULT_POSITION_X,
	DEFAULT_POSITION_Y,
	DEFAULT_SCALE,
	DEFAULT_SIGNATURE_HEIGHT,
	DEFAULT_SIGNATURE_WIDTH,
	embedSignaturePng,
	ensurePdfExtension,
	getSignedDownloadFileName,
	MAX_SCALE,
	MIN_SCALE,
	resolvePlacement,
	type SignaturePlacement,
	type SignaturePlacementInput
} from './sign-pdf.js';

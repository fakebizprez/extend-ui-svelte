// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
import { describe, expect, it } from 'vitest';
import {
	formatColorValue,
	formatCssColor,
	hslToRgb,
	oklchToRgb,
	parseColorInput,
	rgbaToHex,
	rgbToHsv,
	rgbToOklch
} from './color-utils.js';

describe('color-utils', () => {
	it('parses hex bodies with and without a hash', () => {
		expect(parseColorInput('#ff0000', 'hex')).toMatchObject({
			rgb: { r: 255, g: 0, b: 0 },
			alpha: null,
			format: 'hex'
		});
		expect(parseColorInput('0f0', 'hex')?.rgb).toMatchObject({ r: 0, g: 255, b: 0 });
		expect(parseColorInput('#0000ff80', 'hex')?.alpha).toBeCloseTo(0.5, 2);
	});

	it('parses functional rgb, hsl, and oklch syntax', () => {
		expect(parseColorInput('rgb(255, 0, 0)', 'hex')?.rgb).toMatchObject({ r: 255, g: 0, b: 0 });
		expect(parseColorInput('hsl(120, 100%, 50%)', 'hex')?.rgb).toMatchObject({
			r: 0,
			g: 255,
			b: 0
		});
		const oklch = parseColorInput('oklch(62.8% 0.258 29.2)', 'hex');
		expect(oklch?.format).toBe('oklch');
		expect(oklch!.rgb.r).toBeGreaterThan(200);
	});

	it('rejects empty and invalid input', () => {
		expect(parseColorInput('', 'hex')).toBeNull();
		expect(parseColorInput('not-a-color', 'hex')).toBeNull();
		expect(parseColorInput('#12', 'hex')).toBeNull();
	});

	it('serializes channels to uppercase hex with optional alpha', () => {
		expect(rgbaToHex({ r: 255, g: 0, b: 0 })).toBe('#FF0000');
		expect(rgbaToHex({ r: 0, g: 0, b: 0 }, 1)).toBe('#000000');
		expect(rgbaToHex({ r: 255, g: 255, b: 255 }, 0.5)).toBe('#FFFFFF80');
	});

	it('converts between rgb, hsv, hsl, and oklch', () => {
		expect(rgbToHsv({ r: 255, g: 0, b: 0 })).toMatchObject({ h: 0, s: 100, v: 100 });
		expect(hslToRgb({ h: 240, s: 100, l: 50 })).toMatchObject({ r: 0, g: 0, b: 255 });
		const oklch = rgbToOklch({ r: 255, g: 255, b: 255 });
		expect(oklch.l).toBeCloseTo(1, 3);
		expect(oklchToRgb({ l: 1, c: 0, h: 0 })).toMatchObject({ r: 255, g: 255, b: 255 });
	});

	it('formats values and css colors per format', () => {
		const parts = {
			rgb: { r: 255, g: 0, b: 0 },
			hsl: { h: 0, s: 100, l: 50 },
			oklch: { l: 0.62796, c: 0.25768, h: 29.23 },
			alpha: 1
		};
		expect(formatColorValue('hex', parts)).toBe('FF0000');
		expect(formatColorValue('rgb', parts)).toBe('255 0 0');
		expect(formatCssColor('rgb', parts)).toBe('rgb(255, 0, 0)');
		expect(formatCssColor('hex', { ...parts, alpha: 0.5 })).toBe('#FF000080');
	});
});

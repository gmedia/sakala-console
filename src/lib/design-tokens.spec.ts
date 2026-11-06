import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(import.meta.dirname, '../app.css'), 'utf8');

function token(name: string): string {
	const match = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})`, 'i'));
	if (!match) throw new Error(`--color-${name} is not a hex token in app.css`);
	return match[1];
}

function luminance(hex: string): number {
	const [r, g, b] = [1, 3, 5].map((i) => {
		const channel = parseInt(hex.slice(i, i + 2), 16) / 255;
		return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a: string, b: string): number {
	const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (high + 0.05) / (low + 0.05);
}

const BACKGROUNDS = ['surface', 'background', 'background-soft', 'primary-50', 'surface-elevated'];
const TEXT = [
	'foreground',
	'muted',
	'primary',
	'primary-dark',
	'success',
	'success-dark',
	'warning',
	'warning-dark',
	'error',
	'error-base',
	'error-dark',
	'info'
];

describe('colour tokens (U-67, U-68, U-98)', () => {
	it.each(TEXT.flatMap((text) => BACKGROUNDS.map((background) => [text, background])))(
		'%s text holds 4.5:1 on %s',
		(text, background) => {
			expect(ratio(token(text), token(background))).toBeGreaterThanOrEqual(4.5);
		}
	);

	it.each(BACKGROUNDS)('border-strong and the focus ring hold 3:1 on %s', (background) => {
		expect(ratio(token('border-strong'), token(background))).toBeGreaterThanOrEqual(3);
		expect(ratio(token('primary'), token(background))).toBeGreaterThanOrEqual(3);
	});

	it('the focus ring is still visible on the terminal', () => {
		expect(ratio(token('primary'), token('terminal'))).toBeGreaterThanOrEqual(3);
	});

	it.each(['primary', 'success', 'warning', 'error', 'error-base', 'info', 'muted'])(
		'white text holds 4.5:1 on a %s fill',
		(fill) => {
			expect(ratio('#ffffff', token(fill))).toBeGreaterThanOrEqual(4.5);
		}
	);

	it('terminal text holds 4.5:1 and the terminal matches Figma (U-76)', () => {
		expect(token('terminal').toLowerCase()).toBe('#1e1e1d');
		expect(ratio(token('terminal-text'), token('terminal'))).toBeGreaterThanOrEqual(4.5);
	});

	it('keeps the brand anchor', () => {
		expect(token('primary').toLowerCase()).toBe('#0f766e');
	});

	it('loads no font from another origin, and never blocks text on one (U-78)', () => {
		expect(css).not.toMatch(/fonts\.googleapis|@import\s+url/);
		const faces = css.match(/@font-face\s*{[^}]*}/g) ?? [];
		expect(faces.length).toBeGreaterThan(0);
		for (const face of faces) expect(face).toContain('font-display: swap');
	});
});

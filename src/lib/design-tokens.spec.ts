import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
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

describe('colour tokens', () => {
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

	it('terminal text holds 4.5:1 and the terminal matches Figma', () => {
		expect(token('terminal').toLowerCase()).toBe('#1e1e1d');
		expect(ratio(token('terminal-text'), token('terminal'))).toBeGreaterThanOrEqual(4.5);
	});

	it('a queued status fills shapes with the brand orange, and its text uses the darker ink', () => {
		expect(token('queued').toLowerCase()).toBe('#c2670e');
		expect(ratio(token('queued'), token('surface'))).toBeGreaterThanOrEqual(3);
		expect(ratio(token('queued'), token('background'))).toBeGreaterThanOrEqual(3);
		expect(ratio(token('queued-ink'), token('queued-soft'))).toBeGreaterThanOrEqual(4.5);
		expect(ratio(token('queued-ink'), token('surface'))).toBeGreaterThanOrEqual(4.5);
	});

	it('a skeleton can be seen on white, which the old grey at 1.17:1 could not', () => {
		expect(ratio(token('skeleton'), token('surface'))).toBeGreaterThanOrEqual(1.5);
	});

	it('keeps the brand anchor', () => {
		expect(token('primary').toLowerCase()).toBe('#0f766e');
	});

	it('loads no font from another origin, and never blocks text on one', () => {
		expect(css).not.toMatch(/fonts\.googleapis|@import\s+url/);
		const faces = css.match(/@font-face\s*{[^}]*}/g) ?? [];
		expect(faces.length).toBeGreaterThan(0);
		for (const face of faces) expect(face).toContain('font-display: swap');
	});
});

describe('the type and shape system', () => {
	const SOURCE = resolve(import.meta.dirname, '..');

	function sourceFiles(directory: string): string[] {
		return readdirSync(directory).flatMap((entry) => {
			const path = join(directory, entry);
			if (statSync(path).isDirectory()) return sourceFiles(path);
			return /\.svelte$|(?<!\.spec|\.test)\.ts$/.test(path) && !path.endsWith('schema.d.ts')
				? [path]
				: [];
		});
	}

	// Anything here compiles to no style at all, or to a value outside the scale.
	it.each([
		['a size outside the scale', /\btext-(\[\d|lg\b|4xl\b|6xl\b)/],
		['a weight outside the three in use', /\bfont-(thin|light|bold|extrabold|black)\b/],
		['a removed font class', /\bfont-(montserrat|jetbrains)/],
		['a radius outside the three in use', /\brounded-(sm|md|lg|xl|2xl|3xl)\b/],
		['a shadow other than the overlay one', /\bshadow-(xs|sm|md|lg|xl|2xl|inner)\b/],
		['a colour outside the tokens', /\b(text|bg|border)-(zinc|gray|slate|blue|amber)-\d/]
	])('no component uses %s', (_name, pattern) => {
		const hits = sourceFiles(SOURCE).filter((path) => pattern.test(readFileSync(path, 'utf8')));
		expect(hits).toEqual([]);
	});

	it('loads one variable file per family', () => {
		const faces = css.match(/@font-face\s*{[^}]*}/g) ?? [];
		expect(faces.map((face) => face.match(/font-family: '([^']+)'/)?.[1])).toEqual([
			'Inter',
			'Montserrat',
			'JetBrains Mono'
		]);
	});
});

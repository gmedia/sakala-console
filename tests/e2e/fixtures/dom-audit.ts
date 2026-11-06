import type { Page } from '@playwright/test';

/** Runs in the browser. Everything a route must not do, measured on what actually rendered. */
function auditInBrowser({ minTarget, minPrimary }: { minTarget: number; minPrimary: number }) {
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = 1;
	const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

	type Rgba = [number, number, number, number];

	// Chromium reports token colours as oklch() or color-mix(); a canvas resolves all of them.
	function toRgba(css: string): Rgba {
		ctx.clearRect(0, 0, 1, 1);
		ctx.fillStyle = 'rgba(0,0,0,0)';
		ctx.fillStyle = css;
		ctx.fillRect(0, 0, 1, 1);
		const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
		return [r, g, b, a / 255];
	}

	function over(top: Rgba, below: Rgba): Rgba {
		const alpha = top[3] + below[3] * (1 - top[3]);
		if (alpha === 0) return [0, 0, 0, 0];
		const mix = (i: number) => (top[i] * top[3] + below[i] * below[3] * (1 - top[3])) / alpha;
		return [mix(0), mix(1), mix(2), alpha];
	}

	function luminance([r, g, b]: Rgba): number {
		const f = (c: number) => {
			const s = c / 255;
			return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
		};
		return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
	}

	function ratio(a: Rgba, b: Rgba): number {
		const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
		return (hi + 0.05) / (lo + 0.05);
	}

	const hex = ([r, g, b]: Rgba) =>
		'#' + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('');

	/** The opaque colour behind an element, or null when an image or gradient is behind it. */
	function backgroundOf(start: Element | null): Rgba | null {
		const layers: Rgba[] = [];
		for (let el = start; el; el = el.parentElement) {
			const style = getComputedStyle(el);
			if (style.backgroundImage !== 'none') return null;
			const color = toRgba(style.backgroundColor);
			if (color[3] > 0) {
				layers.push([color[0], color[1], color[2], color[3] * Number(style.opacity)]);
				if (color[3] === 1 && style.opacity === '1') break;
			}
		}
		return layers.reduceRight<Rgba>((below, layer) => over(layer, below), [255, 255, 255, 1]);
	}

	function opacityOf(start: Element): number {
		let opacity = 1;
		for (let el: Element | null = start; el; el = el.parentElement) {
			opacity *= Number(getComputedStyle(el).opacity);
		}
		return opacity;
	}

	function isShown(el: Element): boolean {
		const rect = el.getBoundingClientRect();
		const style = getComputedStyle(el);
		return (
			rect.width > 1 &&
			rect.height > 1 &&
			style.visibility !== 'hidden' &&
			style.display !== 'none' &&
			style.clipPath === 'none' &&
			style.clip !== 'rect(0px, 0px, 0px, 0px)'
		);
	}

	const isDisabled = (el: Element) =>
		Boolean(el.closest(':disabled, [aria-disabled="true"], [aria-busy="true"]'));
	const describe = (el: Element, text = '') =>
		`${el.tagName.toLowerCase()} "${(text || el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 40)}"`;

	const contrast: string[] = [];
	const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		const parent = node.parentElement;
		if (!parent || !node.textContent?.trim() || !isShown(parent) || isDisabled(parent)) continue;
		if (parent.closest('script, style, noscript, [aria-hidden="true"]')) continue;
		const background = backgroundOf(parent);
		if (!background) continue;
		const style = getComputedStyle(parent);
		const color = toRgba(style.color);
		color[3] *= opacityOf(parent);
		const size = parseFloat(style.fontSize);
		const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
		const value = ratio(over(color, background), background);
		if (value < (large ? 3 : 4.5)) {
			contrast.push(
				`${hex(over(color, background))} on ${hex(background)} ${value.toFixed(2)} ${describe(parent, node.textContent)}`
			);
		}
	}

	const controls: string[] = [];
	for (const el of document.querySelectorAll<HTMLElement>(
		'input:not([type="hidden"]), select, textarea, [role="switch"]'
	)) {
		if (!isShown(el) || isDisabled(el)) continue;
		const style = getComputedStyle(el);
		const outside = backgroundOf(el.parentElement);
		if (!outside) continue;
		// A radio or checkbox inside a card takes the whole label as its target and its visible part.
		if (style.position === 'absolute' && parseFloat(style.width) <= 1) continue;
		const fill = over(toRgba(style.backgroundColor), outside);
		// A search box draws its edge on the wrapper around the input.
		const framed = parseFloat(style.borderTopWidth) > 0 ? el : el.parentElement!;
		const frame = getComputedStyle(framed);
		const edge = parseFloat(frame.borderTopWidth) > 0 ? toRgba(frame.borderTopColor) : fill;
		const best = Math.max(ratio(over(edge, outside), outside), ratio(fill, outside));
		if (best < 3) controls.push(`${best.toFixed(2)} ${describe(el, el.id)}`);

		const placeholder = el.getAttribute('placeholder');
		if (placeholder && !(el as HTMLInputElement).value) {
			const value = ratio(over(toRgba(getComputedStyle(el, '::placeholder').color), fill), fill);
			if (value < 4.5)
				contrast.push(`placeholder ${value.toFixed(2)} ${describe(el, placeholder)}`);
		}
	}

	const brand = toRgba(
		getComputedStyle(document.documentElement).getPropertyValue('--color-primary')
	);
	const sameColor = (a: Rgba, b: Rgba) => a.slice(0, 3).join() === b.slice(0, 3).join();

	const targets: string[] = [];
	const primaryTargets: string[] = [];
	for (const el of document.querySelectorAll<HTMLElement>(
		'a[href], button, input, select, textarea, summary, [role="switch"], [role="radio"], [tabindex="0"]'
	)) {
		if (!isShown(el) || isDisabled(el) || el.closest('[aria-hidden="true"]')) continue;
		if ((el as HTMLInputElement).type === 'hidden') continue;
		// WCAG 2.5.8 exempts a link inside a sentence.
		const parentText = el.parentElement?.textContent?.trim() ?? '';
		if (el.tagName === 'A' && parentText.length > (el.textContent?.trim().length ?? 0) + 3) {
			const display = getComputedStyle(el).display;
			if (display === 'inline') continue;
		}
		// A checkbox's target includes the label it sits in.
		const hit = el.tagName === 'INPUT' ? (el.closest('label') ?? el) : el;
		const { width, height } = hit.getBoundingClientRect();
		if (width < minTarget || height < minTarget) {
			targets.push(`${Math.round(width)}x${Math.round(height)} ${describe(el)}`);
		}
		const isCurrentPage = el.getAttribute('aria-current') === 'page';
		if (
			height < minPrimary &&
			!isCurrentPage &&
			sameColor(toRgba(getComputedStyle(el).backgroundColor), brand)
		) {
			primaryTargets.push(`${Math.round(width)}x${Math.round(height)} ${describe(el)}`);
		}
	}

	const doc = document.documentElement;
	const overflow: string[] = [];
	if (doc.scrollWidth > doc.clientWidth)
		overflow.push(`page ${doc.scrollWidth}>${doc.clientWidth}`);
	for (const main of document.querySelectorAll('main')) {
		if (main.scrollWidth > main.clientWidth) {
			overflow.push(`main ${main.scrollWidth}>${main.clientWidth}`);
		}
	}
	// `overflow: hidden` on the shell hides a page that is too wide instead of making it scroll,
	// so anything past the viewport counts unless it is in a scroller of its own.
	for (const el of document.querySelectorAll('body *')) {
		if (!isShown(el)) continue;
		const container = el.closest('main');
		const limit =
			(container
				? container.clientWidth + container.getBoundingClientRect().left
				: doc.clientWidth) + 0.5;
		const rect = el.getBoundingClientRect();
		if (rect.right <= limit) continue;
		let clipped = false;
		for (
			let up = el.parentElement;
			up && up !== container && up !== document.body;
			up = up.parentElement
		) {
			const { overflowX } = getComputedStyle(up);
			if (overflowX !== 'visible' && up.getBoundingClientRect().right <= limit) {
				clipped = true;
				break;
			}
		}
		if (!clipped)
			overflow.push(`${describe(el)} right=${Math.round(rect.right)}>${Math.round(limit)}`);
	}

	return {
		contrast,
		controls,
		targets,
		primaryTargets,
		overflow: overflow.slice(0, 10),
		h1: document.querySelectorAll('h1').length,
		main: document.querySelectorAll('main').length,
		title: document.title
	};
}

export type DomAudit = ReturnType<typeof auditInBrowser>;

/** `minPrimary` is 44 on touch layouts and 24 otherwise, like every other target. */
export function auditDom(page: Page, minTarget = 24, minPrimary = minTarget): Promise<DomAudit> {
	return page.evaluate(auditInBrowser, { minTarget, minPrimary });
}

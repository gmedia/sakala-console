import type { encode } from 'uqr';

/** The quiet zone the QR specification asks for around the code, in modules. */
export const QR_QUIET_ZONE = 4;

/**
 * One SVG path for the dark modules of an encoded QR code, so the code is drawn with the page's
 * own markup and colors instead of an HTML string. The encoding itself comes from `uqr`.
 */
export function qrPath(code: ReturnType<typeof encode>): { d: string; size: number } {
	const parts: string[] = [];
	code.data.forEach((row, y) => {
		row.forEach((dark, x) => {
			if (dark) parts.push(`M${x} ${y}h1v1h-1z`);
		});
	});
	return { d: parts.join(''), size: code.size };
}

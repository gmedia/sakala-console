import { describe, expect, it } from 'vitest';
import { encode } from 'uqr';
import { QR_QUIET_ZONE, qrPath } from './qr-path';

describe('qrPath', () => {
	it('draws one square per dark module, inside the quiet zone', () => {
		const code = encode('https://toko-kopi.sakala.app', { ecc: 'M', border: QR_QUIET_ZONE });
		const { d, size } = qrPath(code);
		const dark = code.data.flat().filter(Boolean).length;
		expect(size).toBe(code.size);
		expect(d.match(/M/g)).toHaveLength(dark);
		// Nothing is drawn in the border rows.
		expect(code.data[0].some(Boolean)).toBe(false);
		expect(d.startsWith(`M${QR_QUIET_ZONE} ${QR_QUIET_ZONE}h1`)).toBe(true);
	});
});

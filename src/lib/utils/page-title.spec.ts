import { describe, expect, it } from 'vitest';
import { pageTitle } from './page-title';

describe('pageTitle', () => {
	it('puts the page first and the product last', () => {
		expect(pageTitle('Masuk')).toBe('Masuk · Sakala');
	});

	it('names the project between them, so two tabs of two projects differ', () => {
		expect(pageTitle('Riwayat', 'toko-kopi-web')).toBe('Riwayat · toko-kopi-web · Sakala');
	});

	it('leaves the project out until it is known', () => {
		expect(pageTitle('Riwayat', undefined)).toBe('Riwayat · Sakala');
		expect(pageTitle('Riwayat', '')).toBe('Riwayat · Sakala');
	});
});

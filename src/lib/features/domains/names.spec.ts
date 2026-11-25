import { describe, expect, it } from 'vitest';
import { getDomainFixture } from '$lib/testing/domain-fixtures';
import {
	dnsHostLabel,
	parentZone,
	parseDomainName,
	registeredDomainOf,
	stripDomainInput
} from './names';

const FORBIDDEN = ['sakala.app'];

function apiMessage(fixture: string): string {
	return (getDomainFixture(fixture).body as { errors: { hostname: string[] } }).errors.hostname[0];
}

function refusal(input: string): string | null {
	const parsed = parseDomainName(input, FORBIDDEN);
	return parsed.ok ? null : parsed.message;
}

describe('parseDomainName', () => {
	it('refuses what the API refuses, in the API own words', () => {
		const cases: [string, string][] = [
			['*.kopi-senja.com', 'domain-create-invalid-wildcard'],
			['192.0.2.10', 'domain-create-invalid-ip'],
			['kopisenja', 'domain-create-invalid-one-label'],
			['kopi_senja.com', 'domain-create-invalid-label'],
			['-kopi.com', 'domain-create-invalid-hyphen'],
			['my.id', 'domain-create-invalid-public-suffix'],
			['kopi-senja.lokal', 'domain-create-invalid-unknown-suffix'],
			['kopi-senja.sakala.app', 'domain-create-invalid-forbidden'],
			[
				`${'a'.repeat(63)}.${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(61)}.com`,
				'domain-create-invalid-too-long'
			]
		];
		for (const [input, fixture] of cases) {
			expect(refusal(input), input).toBe(apiMessage(fixture));
		}
	});

	it('asks for a name when the field is empty, instead of the API field rule', () => {
		expect(refusal('  ')).toBe('Isi nama domain, misalnya www.contoh.com.');
	});

	it('normalizes a pasted URL the way the API stored it', () => {
		const stored = (getDomainFixture('domain-create').body as { data: { hostname: string } }).data
			.hostname;
		expect(parseDomainName('https://WWW.Kopi-Senja.com/menu', FORBIDDEN)).toEqual({
			ok: true,
			hostname: stored,
			kind: 'subdomain'
		});
		expect(stripDomainInput('kopi-senja.com.:8080')).toBe('kopi-senja.com');
		expect(stripDomainInput('http://kopi-senja.com:8080/a?b#c')).toBe('kopi-senja.com');
	});

	it('turns an international name into punycode', () => {
		expect(parseDomainName('Bücher.de')).toEqual({
			ok: true,
			hostname: 'xn--bcher-kva.de',
			kind: 'apex'
		});
	});

	it('tells an apex from a subdomain with the Public Suffix List, as the API does', () => {
		const kinds = Object.fromEntries(
			[
				'kopi-senja.com',
				'www.kopi-senja.com',
				'rina.my.id',
				'kampus.ac.id',
				'himpunan.kampus.ac.id',
				'rina.github.io'
			].map((name) => {
				const parsed = parseDomainName(name);
				return [name, parsed.ok ? parsed.kind : parsed.message];
			})
		);
		expect(kinds).toEqual({
			'kopi-senja.com': 'apex',
			'www.kopi-senja.com': 'subdomain',
			'rina.my.id': 'apex',
			'kampus.ac.id': 'apex',
			'himpunan.kampus.ac.id': 'subdomain',
			'rina.github.io': 'apex'
		});
		const apex = getDomainFixture('domain-create-apex-my-id').body as { data: { kind: string } };
		expect(apex.data.kind).toBe('apex');
	});
});

describe('DNS host names', () => {
	it('gives the name relative to the registered domain, and @ for the apex itself', () => {
		const www = registeredDomainOf('www.kopi-senja.com', 'subdomain');
		expect(www).toBe('kopi-senja.com');
		expect(dnsHostLabel('_sakala.www.kopi-senja.com', www)).toBe('_sakala.www');
		expect(dnsHostLabel('www.kopi-senja.com', www)).toBe('www');
		const apex = registeredDomainOf('kopi-senja.com', 'apex');
		expect(dnsHostLabel('kopi-senja.com', apex)).toBe('@');
		expect(dnsHostLabel('_sakala.kopi-senja.com', apex)).toBe('_sakala');
		const campus = registeredDomainOf('a.b.kampus.ac.id', 'subdomain');
		expect(dnsHostLabel('_sakala.a.b.kampus.ac.id', campus)).toBe('_sakala.a.b');
	});

	it('gives no relative name when the zone is unknown', () => {
		expect(registeredDomainOf('www.kopi-senja.lokal', 'subdomain')).toBeNull();
		expect(dnsHostLabel('www.kopi-senja.lokal', null)).toBeNull();
	});

	it('finds the zone of the target and of the project address', () => {
		expect(parentZone('edge.sakala.app')).toBe('sakala.app');
		expect(parentZone('toko-kopi.sakala.app')).toBe('sakala.app');
		expect(parentZone(null)).toBeNull();
		expect(parentZone('localhost')).toBeNull();
	});
});

import { describe, expect, it } from 'vitest';
import { parseGithubInstallationResult } from './github-installation-result';

const parse = (query: string) => parseGithubInstallationResult(new URLSearchParams(query));

describe('parseGithubInstallationResult (U-52)', () => {
	it('is null when the wizard was not reached from the install callback', () => {
		expect(parse('')).toBeNull();
		expect(parse('error=github_access_denied')).toBeNull();
	});

	it('reports a connected installation', () => {
		expect(parse('github_installation=connected')?.kind).toBe('connected');
	});

	it.each([
		['github_app_not_configured', /belum dikonfigurasi/],
		['github_invalid_state', /sudah tidak berlaku/],
		['github_invalid_installation', /pemilik organisasi/],
		['github_access_denied', /tidak punya akses/],
		['github_provider_failure', /gagal menghubungi GitHub/]
	])('explains %s', (code, message) => {
		const result = parse(`github_installation=error&error=${code}`);

		expect(result?.kind).toBe('error');
		expect(result?.message).toMatch(message);
	});

	it.each(['', '&error=constructor', '&error=%3Cscript%3E'])(
		'falls back to a generic message for an unknown code (%s)',
		(suffix) => {
			const result = parse(`github_installation=error${suffix}`);

			expect(result?.kind).toBe('error');
			expect(result?.message).toBe(
				'Pemasangan GitHub belum berhasil. Klik Hubungkan GitHub untuk mencoba lagi.'
			);
		}
	);
});

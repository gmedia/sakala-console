import { describe, expect, it } from 'vitest';
import {
	normalizeGithubRepositoryUrl,
	REPOSITORY_URL_MESSAGES,
	validateRepositoryUrl
} from './repositoryUrl';

const CANONICAL = 'https://github.com/owner/repo';

describe('normalizeGithubRepositoryUrl', () => {
	it.each([
		['the canonical address', CANONICAL],
		['a trailing slash', 'https://github.com/owner/repo/'],
		['no scheme', 'github.com/owner/repo'],
		['www and no scheme', 'www.github.com/owner/repo'],
		['http', 'http://github.com/owner/repo'],
		['a .git suffix from the Code button', 'https://github.com/owner/repo.git'],
		['a branch page', 'https://github.com/owner/repo/tree/main'],
		['a folder on a branch', 'https://github.com/owner/repo/tree/feat/login/src/app'],
		['a file page', 'https://github.com/owner/repo/blob/main/README.md'],
		['a query and a hash', 'https://github.com/owner/repo?tab=readme-ov-file#readme'],
		['the SSH form', 'git@github.com:owner/repo.git'],
		['the ssh:// form', 'ssh://git@github.com/owner/repo.git'],
		['owner/repo on its own', 'owner/repo'],
		['surrounding spaces', '  https://github.com/owner/repo  ']
	])('accepts %s and sends the canonical address', (_label, input) => {
		const result = normalizeGithubRepositoryUrl(input);
		expect(result).toMatchObject({ ok: true, url: CANONICAL, fullName: 'owner/repo' });
	});

	it('keeps the case GitHub shows, because the API compares names as typed', () => {
		expect(normalizeGithubRepositoryUrl('github.com/GMedia/Sakala-Console/')).toMatchObject({
			url: 'https://github.com/GMedia/Sakala-Console',
			owner: 'GMedia',
			name: 'Sakala-Console'
		});
	});

	it('says whether the input was changed, so the field can show what is used', () => {
		expect(normalizeGithubRepositoryUrl(CANONICAL)).toMatchObject({ changed: false });
		expect(normalizeGithubRepositoryUrl('github.com/owner/repo')).toMatchObject({ changed: true });
	});

	it.each([
		['empty', '', REPOSITORY_URL_MESSAGES.required],
		['only spaces', '   ', REPOSITORY_URL_MESSAGES.required],
		['GitLab', 'https://gitlab.com/owner/repo', REPOSITORY_URL_MESSAGES.notGithub],
		[
			'a Sakala Console address',
			'http://app.sakala.test:5173/projects/01a0cd45',
			REPOSITORY_URL_MESSAGES.notGithub
		],
		[
			'an owner without repository',
			'https://github.com/owner',
			REPOSITORY_URL_MESSAGES.missingRepository
		],
		['GitHub itself', 'github.com', REPOSITORY_URL_MESSAGES.missingRepository],
		['a name with spaces', 'https://github.com/owner/my repo', REPOSITORY_URL_MESSAGES.unreadable],
		['a dot for a name', 'https://github.com/owner/..', REPOSITORY_URL_MESSAGES.missingRepository]
	])('refuses %s with a message that shows an example', (_label, input, message) => {
		expect(normalizeGithubRepositoryUrl(input)).toEqual({ ok: false, message });
		expect(message).toContain('https://github.com/owner/repo');
	});
});

describe('validateRepositoryUrl', () => {
	it('returns null for any accepted form and the message otherwise', () => {
		expect(validateRepositoryUrl('github.com/owner/repo/')).toBeNull();
		expect(validateRepositoryUrl('https://gitlab.com/owner/repo')).toBe(
			REPOSITORY_URL_MESSAGES.notGithub
		);
	});
});

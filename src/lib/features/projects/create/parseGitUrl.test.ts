import { describe, expect, it } from 'vitest';
import { parseGitUrl } from './parseGitUrl';

describe('parseGitUrl', () => {
	it('should parse URL with .git suffix', () => {
		expect(parseGitUrl('https://github.com/GMedia/sakala-console.git')).toEqual({
			owner: 'GMedia',
			name: 'sakala-console',
			fullName: 'GMedia/sakala-console'
		});
	});

	it('should parse URL without .git suffix', () => {
		expect(parseGitUrl('https://github.com/GMedia/sakala-console')).toEqual({
			owner: 'GMedia',
			name: 'sakala-console',
			fullName: 'GMedia/sakala-console'
		});
	});

	it('should parse URL with trailing slash', () => {
		expect(parseGitUrl('https://github.com/GMedia/sakala-console/')).toEqual({
			owner: 'GMedia',
			name: 'sakala-console',
			fullName: 'GMedia/sakala-console'
		});
	});

	it('return null for URL without owner/repo (just domain)', () => {
		expect(parseGitUrl('https://github.com')).toBeNull();
	});

	it('return null for URL with only owner', () => {
		expect(parseGitUrl('https://github.com/GMedia')).toBeNull();
	});

	it('return null for invalid URL', () => {
		expect(parseGitUrl('not-a-valid-url')).toBeNull();
	});

	it('return null for empty string', () => {
		expect(parseGitUrl('')).toBeNull();
	});

	it('should parse URL with whitespase around', () => {
		expect(parseGitUrl('  https://github.com/GMedia/sakala-console.git  ')).toEqual({
			owner: 'GMedia',
			name: 'sakala-console',
			fullName: 'GMedia/sakala-console'
		});
	});
});

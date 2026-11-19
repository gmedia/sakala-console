import { describe, expect, it } from 'vitest';
import { parseGitUrl } from './parseGitUrl';

const PARSED = { owner: 'GMedia', name: 'sakala-console', fullName: 'GMedia/sakala-console' };

describe('parseGitUrl', () => {
	it.each([
		'https://github.com/GMedia/sakala-console.git',
		'https://github.com/GMedia/sakala-console',
		'https://github.com/GMedia/sakala-console/',
		'github.com/GMedia/sakala-console/tree/main',
		'  https://github.com/GMedia/sakala-console.git  '
	])('reads the repository from %s', (input) => {
		expect(parseGitUrl(input)).toEqual(PARSED);
	});

	it.each(['https://github.com', 'https://github.com/GMedia', 'https://gitlab.com/a/b', ''])(
		'returns null for %s',
		(input) => {
			expect(parseGitUrl(input)).toBeNull();
		}
	);
});

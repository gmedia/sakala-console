import { describe, expect, it } from 'vitest';
import { parseProfileReturn, profileReturnPath } from './return-to';

describe('profile return path', () => {
	it('round-trips a workspace and a user detail page', () => {
		const workspace = { kind: 'workspaces', id: '01a1cae3-b6e6-71a1-8a4d-4b075ba386bc' } as const;
		expect(parseProfileReturn(profileReturnPath(workspace))).toEqual(workspace);
		expect(parseProfileReturn('/admin/users/42')).toEqual({ kind: 'users', id: '42' });
	});

	it('refuses anything that could leave the admin detail pages', () => {
		for (const value of [
			null,
			'',
			'https://evil.example/admin/users/1',
			'//evil.example/admin/users/1',
			'/admin/users/1/../../logout',
			'/admin/projects/1',
			'/admin/users/1?x=1',
			'/admin/workspaces/'
		]) {
			expect(parseProfileReturn(value), String(value)).toBeNull();
		}
	});
});

import { describe, expect, it } from 'vitest';
import { DEPLOY_FAILURE_GUIDE_URL } from '$lib/config/project';
import { failureDocsHref } from './failure-docs';

describe('failureDocsHref', () => {
	it('links a code with its own section to that heading', () => {
		expect(failureDocsHref('runtime_app_crashed')).toBe(
			`${DEPLOY_FAILURE_GUIDE_URL}#runtime_app_crashed`
		);
		expect(failureDocsHref('repository_access_revoked')).toBe(
			`${DEPLOY_FAILURE_GUIDE_URL}#repository_access_revoked`
		);
	});

	it("links a failure on Sakala's side to the table that lists it", () => {
		expect(failureDocsHref('runtime_disk_pressure')).toBe(
			`${DEPLOY_FAILURE_GUIDE_URL}#gangguan-di-sisi-sakala`
		);
	});

	it('gives no link for a code the guide does not cover, or no code', () => {
		expect(failureDocsHref('runtime_something_new')).toBeNull();
		expect(failureDocsHref(null)).toBeNull();
		expect(failureDocsHref('')).toBeNull();
	});
});

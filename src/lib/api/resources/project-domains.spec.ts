import { describe, expect, it } from 'vitest';
import { CUSTOM_DOMAIN_ERROR_CODES } from '$lib/api/errors';
import { domainFixtureNames, getDomainFixture } from '$lib/testing/domain-fixtures';
import { parseAdminCustomDomain, parseAdminCustomDomains } from './admin/custom-domains';
import { parseLimitProfile } from './admin/accounts';
import { parseDomainRefusal } from './domain-refusals';
import { parsePilotLimitsResponse } from './pilot-limits';
import { parseProjectDomain, parseProjectDomainList } from './project-domains';

const successful = (prefix: string) =>
	domainFixtureNames().filter(
		(name) =>
			name.startsWith(prefix) &&
			getDomainFixture(name).body !== null &&
			getDomainFixture(name).status < 300
	);

describe('custom domain responses captured from sakala-api', () => {
	it('parses every project domain list', () => {
		const lists = successful('domains-');
		expect(lists.length).toBeGreaterThan(8);
		for (const name of lists) {
			expect(() => parseProjectDomainList(getDomainFixture(name).body), name).not.toThrow();
		}
	});

	it('parses every single domain the API answered with', () => {
		const singles = [...successful('domain-create'), ...successful('domain-check')];
		expect(singles.length).toBeGreaterThan(15);
		for (const name of singles) {
			expect(() => parseProjectDomain(getDomainFixture(name).body), name).not.toThrow();
		}
	});

	it('reads waiting_for_node as the boolean the API sends, not the documented string', () => {
		const [domain] = parseProjectDomainList(getDomainFixture('domains-waiting-for-node').body);
		expect(domain.waiting_for_node).toBe(true);
	});

	it('parses the admin list, disable, and enable answers', () => {
		const list = parseAdminCustomDomains(getDomainFixture('admin-custom-domains').body);
		expect(list.data.length).toBe(list.meta.total);
		expect(list.data[0].project?.name).toBeTruthy();
		const disabled = parseAdminCustomDomain(getDomainFixture('admin-disable').body);
		expect(disabled.domain.admin_disabled).toBe(true);
		expect(disabled.domain.admin_disabled_reason).toMatch(/login palsu/);
		expect(
			parseAdminCustomDomain(getDomainFixture('admin-enable').body).domain.admin_disabled
		).toBe(false);
	});

	it('reads the flag, the target, and the quota from pilot-limits', () => {
		const on = parsePilotLimitsResponse(getDomainFixture('pilot-limits-domains').body);
		expect(on.custom_domains).toEqual({ enabled: true, target: 'edge.sakala.app' });
		expect(on.quotas.max_custom_domains).toBe(4);
		expect(on.quotas.current_custom_domains_count).toBe(0);
		const off = parsePilotLimitsResponse(getDomainFixture('pilot-limits-domains-off').body);
		expect(off.custom_domains?.enabled).toBe(false);
	});

	it('reads max_custom_domains on a limit profile', () => {
		expect(
			parseLimitProfile(getDomainFixture('limit-profile-create').body).max_custom_domains
		).toBe(2);
	});

	it('reads the documented fields of each refusal', () => {
		const limit = getDomainFixture('domain-create-limit').body as Record<string, unknown>;
		expect(limit.code).toBe(CUSTOM_DOMAIN_ERROR_CODES.limitExceeded);
		expect(parseDomainRefusal(CUSTOM_DOMAIN_ERROR_CODES.limitExceeded, limit)).toEqual({
			limit: 1,
			current: 1
		});
		const taken = getDomainFixture('domain-create-taken').body as Record<string, unknown>;
		expect(taken.code).toBe(CUSTOM_DOMAIN_ERROR_CODES.taken);
		expect(parseDomainRefusal(CUSTOM_DOMAIN_ERROR_CODES.taken, taken)).toEqual({
			hostname: 'www.kopi-senja.com'
		});
		expect(parseDomainRefusal(CUSTOM_DOMAIN_ERROR_CODES.taken, {})).toBeNull();
	});
});

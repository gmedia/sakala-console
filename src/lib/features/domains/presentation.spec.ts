import { describe, expect, it } from 'vitest';
import { parsePilotLimitsResponse } from '$lib/api/resources/pilot-limits';
import {
	parseProjectDomain,
	parseProjectDomainList,
	type ProjectDomain
} from '$lib/api/resources/project-domains';
import { errorFromDomainFixture, getDomainFixture } from '$lib/testing/domain-fixtures';
import {
	checkWaitSeconds,
	customDomainsEnabled,
	domainAddErrorMessage,
	domainCheckErrorMessage,
	domainChecks,
	domainQuota,
	domainQuotaText,
	domainStatusView,
	formatDomainTime,
	hasAddressesWarning,
	servingDomain
} from './presentation';
import { domainPollInterval } from './queries';
import { dnsRecordRows } from './records';

const one = (name: string): ProjectDomain => parseProjectDomain(getDomainFixture(name).body);
const list = (name: string): ProjectDomain[] => parseProjectDomainList(getDomainFixture(name).body);
const limits = (name: string) => parsePilotLimitsResponse(getDomainFixture(name).body);

/** Before the disabled domain's 30 days end, so it is still checked on its own. */
const DURING_REACTIVATION = Date.parse('2026-11-30T00:00:00Z');

describe('domain state', () => {
	it('gives every state one badge and one short sentence', () => {
		const views = {
			pendingNew: domainStatusView(one('domain-create')),
			pendingChecked: domainStatusView(one('domain-check-caa')),
			active: domainStatusView(one('domain-check-verified')),
			failing: domainStatusView(list('domains-failing-warned')[0]),
			waiting: domainStatusView(list('domains-waiting-for-node')[0]),
			failed: domainStatusView(list('domains-failed')[0]),
			disabled: domainStatusView(list('domains-disabled')[0], DURING_REACTIVATION),
			admin: domainStatusView(list('domains-admin-disabled')[1]),
			released: domainStatusView(list('domains-released')[0])
		};
		expect(
			Object.fromEntries(Object.entries(views).map(([key, view]) => [key, [view.kind, view.label]]))
		).toEqual({
			pendingNew: ['pending', 'Menunggu DNS'],
			pendingChecked: ['pending', 'Menunggu DNS'],
			active: ['active', 'Aktif'],
			failing: ['failing', 'DNS bermasalah'],
			waiting: ['waiting_for_node', 'Menunggu server'],
			failed: ['failed', 'Gagal'],
			disabled: ['disabled', 'Nonaktif'],
			admin: ['admin_disabled', 'Dinonaktifkan admin'],
			released: ['released', 'Dipakai proyek lain']
		});
		for (const [key, view] of Object.entries(views)) {
			expect(view.summary.split(/\s+/).length, key).toBeLessThanOrEqual(20);
		}
	});

	it('writes the deadline of a failing domain in WIB', () => {
		expect(domainStatusView(list('domains-failing')[0]).summary).toBe(
			'Dinonaktifkan 28 Nov, 16.27 WIB kalau DNS belum diperbaiki.'
		);
		expect(formatDomainTime('2026-11-25T03:12:00+00:00')).toBe('25 Nov, 10.12 WIB');
	});

	it('says when a disabled domain stops coming back on its own', () => {
		const disabled = list('domains-disabled')[0];
		expect(domainStatusView(disabled, DURING_REACTIVATION).summary).toContain(
			'sampai 28 Des, 16.27 WIB'
		);
		expect(domainStatusView(disabled, Date.parse('2027-01-10T00:00:00Z')).summary).toBe(
			'DNS gagal 72 jam. Perbaiki record, lalu periksa lagi.'
		);
	});

	it('only offers a check where it can change something', () => {
		expect(domainStatusView(list('domains-admin-disabled')[1]).canCheck).toBe(false);
		expect(domainStatusView(list('domains-released')[0]).canCheck).toBe(false);
		expect(domainStatusView(list('domains-waiting-for-node')[0]).canCheck).toBe(false);
		expect(domainStatusView(one('domain-create')).canCheck).toBe(true);
	});
});

describe('domain checks', () => {
	it('puts each reason under its check and keeps the API message', () => {
		const caa = domainChecks(one('domain-check-caa'));
		expect(caa.rows.map((row) => [row.label, row.state])).toEqual([
			['TXT kepemilikan', 'pass'],
			['CNAME ke Sakala', 'pass'],
			['CAA sertifikat', 'fail']
		]);
		expect(caa.rows[2].reasons[0].message).toMatch(/letsencrypt\.org/);
		const missing = domainChecks(one('domain-check-missing'));
		expect(missing.rows.map((row) => row.state)).toEqual(['fail', 'fail', 'pass']);
		const apex = domainChecks(one('domain-check-apex-extra-addresses'));
		expect(apex.rows[1]).toMatchObject({ label: 'ALIAS ke Sakala', state: 'fail' });
	});

	it('leaves every check unknown after a DNS error, and shows the error once', () => {
		const checks = domainChecks(one('domain-check-dns-error'));
		expect(checks.rows.map((row) => row.state)).toEqual(['unknown', 'unknown', 'unknown']);
		expect(checks.general.map((reason) => reason.code)).toEqual(['dns_error']);
	});
});

describe('DNS records', () => {
	it('numbers the TXT then the CNAME, with names relative to the zone', () => {
		const { zone, rows } = dnsRecordRows(one('domain-create'));
		expect(zone).toBe('kopi-senja.com');
		expect(
			rows.map((row) => [row.type, row.host, row.value.startsWith('sakala-verify=') || row.value])
		).toEqual([
			['TXT', '_sakala.www', true],
			['CNAME', 'www', 'edge.sakala.app']
		]);
		expect(rows[1].hint).toMatch(/DNS only/);
	});

	it('points an apex with ALIAS at @, never an address', () => {
		const { rows } = dnsRecordRows(one('domain-create-apex'));
		expect(rows.map((row) => [row.type, row.host])).toEqual([
			['TXT', '_sakala'],
			['ALIAS', '@']
		]);
		expect(JSON.stringify(rows)).not.toMatch(/\d+\.\d+\.\d+\.\d+/);
	});

	it('warns about an apex found by its addresses only', () => {
		expect(hasAddressesWarning(one('domain-check-apex-verified'))).toBe(true);
		expect(hasAddressesWarning(one('domain-check-verified'))).toBe(false);
	});
});

describe('the address visitors use', () => {
	it('is the oldest active domain, not one waiting for its node', () => {
		expect(servingDomain(list('domains-verified'))).toBe('www.kopi-senja.com');
		expect(servingDomain(list('domains-waiting-for-node'))).toBeNull();
		expect(servingDomain(list('domains-failing'))).toBe('www.kopi-senja.com');
		expect(servingDomain(list('domains-disabled'))).toBe('kopi-senja.com');
		expect(servingDomain(undefined)).toBeNull();
	});
});

describe('flag and quota', () => {
	it('reads the flag only from pilot-limits', () => {
		expect(customDomainsEnabled(limits('pilot-limits-domains'))).toBe(true);
		expect(customDomainsEnabled(limits('pilot-limits-domains-off'))).toBe(false);
		expect(customDomainsEnabled(undefined)).toBe(false);
	});

	it('says how much of the quota is used, full, or closed', () => {
		const used = domainQuota(limits('pilot-limits-domains-used'))!;
		expect(domainQuotaText(used)).toBe('Kuota workspace: 1 dari 4 terpakai.');
		const full = domainQuota(limits('pilot-limits-domains-full'))!;
		expect(full.full).toBe(true);
		expect(domainQuotaText(full)).toBe(
			'Kuota 1 custom domain workspace habis. Hapus domain yang tidak dipakai.'
		);
		expect(domainQuotaText(domainQuota(limits('pilot-limits-domains-zero'))!)).toBe(
			'Workspace ini belum punya kuota custom domain. Minta ke admin Sakala.'
		);
	});
});

describe('refusals', () => {
	it('maps each refusal code to what to do next', () => {
		expect(domainAddErrorMessage(errorFromDomainFixture('domain-create-taken'))).toBe(
			'www.kopi-senja.com sudah aktif di proyek lain. Hapus dulu di sana, lalu tambahkan di sini.'
		);
		expect(domainAddErrorMessage(errorFromDomainFixture('domain-create-limit'))).toBe(
			'Kuota 1 custom domain workspace habis. Hapus domain yang tidak dipakai.'
		);
		expect(domainAddErrorMessage(errorFromDomainFixture('domain-create-limit-zero'))).toBe(
			'Workspace ini belum punya kuota custom domain. Minta ke admin Sakala.'
		);
		expect(domainAddErrorMessage(errorFromDomainFixture('domain-create-viewer'))).toBe(
			'Hanya pemilik dan anggota workspace yang bisa mengatur domain.'
		);
		expect(domainAddErrorMessage(errorFromDomainFixture('domains-off'))).toBe(
			'Custom domain belum bisa dipakai di instalasi Sakala ini.'
		);
	});

	it('waits as long as a 429 says before the next check', () => {
		const limited = errorFromDomainFixture('domain-check-rate-limited');
		expect(checkWaitSeconds(limited)).toBe(60);
		expect(domainCheckErrorMessage(limited)).toBe(
			'Terlalu sering diperiksa. Coba lagi dalam 60 detik.'
		);
		expect(checkWaitSeconds(errorFromDomainFixture('domain-create-taken'))).toBeNull();
	});
});

describe('polling', () => {
	it('polls only while a domain waits for DNS, and backs off on a 429', () => {
		expect(domainPollInterval(list('domains-pending'))).toBe(30_000);
		expect(domainPollInterval(list('domains-verified'))).toBe(false);
		expect(domainPollInterval(undefined)).toBe(false);
		expect(
			domainPollInterval(
				list('domains-pending'),
				errorFromDomainFixture('domain-check-rate-limited')
			)
		).toBe(60_000);
	});
});

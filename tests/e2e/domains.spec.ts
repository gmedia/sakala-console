import { mkdir, writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { mockAdminApi, type RecordedCall } from './fixtures/admin';
import { auditDom } from './fixtures/dom-audit';
import { PROJECT_ID } from './fixtures/project-detail';
import {
	capturedDomain,
	domainFrom,
	domainStates,
	mockDomainsApi,
	type MockDomain
} from './fixtures/domains';

/** Custom domains have their own settings page. */
const SETTINGS_URL = `/projects/${PROJECT_ID}/settings/domain`;
const OVERVIEW_URL = `/projects/${PROJECT_ID}`;

/**
 * The project pages keep polling (live status, metrics), so the network never stays idle for long;
 * waiting for the main landmark and the workspace limits is enough, and expect() waits for the rest.
 */
async function settled(page: Page) {
	await expect(page.locator('main')).toHaveCount(1);
	await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => undefined);
}

/** Several states side by side need their own ids; the captured ones repeat. */
function withId(domain: MockDomain, id: string, hostname?: string): MockDomain {
	return { ...domain, id, ...(hostname ? { hostname } : {}) };
}

const section = (page: Page) => page.getByTestId('domains-section');
const items = (page: Page) => section(page).getByTestId('custom-domain');

test.describe('where custom domains appear', () => {
	test('with the server flag off nothing new shows and no domain endpoint is asked', async ({
		page
	}) => {
		const { calls } = await mockDomainsApi(page, { enabled: false });
		const limits = page.waitForResponse(/\/pilot-limits/);
		await page.goto(SETTINGS_URL);
		await limits;
		await settled(page);
		await expect(page.getByTestId('settings-sections')).toBeVisible();
		await expect(
			page.getByTestId('settings-sections').getByRole('link', { name: 'Domain', exact: true })
		).toHaveCount(0);
		await expect(section(page)).toHaveCount(0);

		await page.goto(OVERVIEW_URL);
		await settled(page);
		await expect(page.getByTestId('overview-domain')).toContainText('Lihat roadmap');
		await expect(page.getByTestId('overview-custom-domains')).toHaveCount(0);
		expect(calls).toEqual([]);
	});

	test('with the flag on the settings get a Domain section and link', async ({ page }) => {
		await mockDomainsApi(page);
		await page.goto(SETTINGS_URL);
		await settled(page);
		const link = page.getByTestId('settings-sections').getByRole('link', { name: 'Domain' });
		await expect(link).toHaveAttribute('href', `/projects/${PROJECT_ID}/settings/domain`);
		await expect(link).toHaveAttribute('aria-current', 'page');
		await expect(section(page).getByRole('heading', { name: 'Domain' })).toBeVisible();
		await expect(section(page)).toContainText('Belum ada domain');
		await expect(section(page).getByTestId('domain-quota')).toHaveText(
			'Kuota workspace: 0 dari 1 terpakai.'
		);
	});
});

test.describe('adding a domain', () => {
	test('a subdomain gets two numbered records with host names as providers expect', async ({
		page,
		context
	}) => {
		await context.grantPermissions(['clipboard-read', 'clipboard-write']);
		const { calls } = await mockDomainsApi(page);
		await page.goto(SETTINGS_URL);
		await settled(page);

		// A pasted URL is reduced to the name, as the API would.
		await page.getByLabel('Nama domain').fill('https://WWW.Kopi-Senja.com/menu');
		await page.getByRole('button', { name: 'Tambah domain' }).click();

		await expect(items(page)).toHaveCount(1);
		expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
			hostname: 'www.kopi-senja.com'
		});
		const item = items(page).first();
		await expect(item.getByTestId('custom-domain-status')).toHaveText('Menunggu DNS');
		const records = item.getByTestId('dns-record');
		await expect(records).toHaveCount(2);
		await expect(records.nth(0)).toContainText('TXT');
		await expect(records.nth(0)).toContainText('_sakala.www');
		await expect(records.nth(0)).toContainText(/sakala-verify=[0-9a-f]{32}/);
		await expect(records.nth(1)).toContainText('CNAME');
		await expect(records.nth(1)).toContainText('edge.sakala.app');
		await expect(records.nth(1)).toContainText('DNS only');
		await expect(item).toContainText('Tambahkan .kopi-senja.com di belakangnya.');
		await expect(page.getByLabel('Nama domain')).toHaveValue('');

		await item.getByRole('button', { name: 'Salin nama TXT' }).click();
		expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('_sakala.www');
		await item.getByRole('button', { name: 'Salin nilai CNAME' }).click();
		expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('edge.sakala.app');
	});

	test('an apex is explained before it is added, and www is one click away', async ({ page }) => {
		const { calls } = await mockDomainsApi(page);
		await page.goto(SETTINGS_URL);
		await settled(page);
		await page.getByLabel('Nama domain').fill('kopi-senja.com');
		const hint = page.getByTestId('apex-hint');
		await expect(hint).toContainText('kopi-senja.com adalah domain utama.');
		await expect(hint).toContainText('ALIAS atau CNAME flattening');
		await hint.getByRole('button', { name: 'Pakai www.kopi-senja.com' }).click();
		await expect(page.getByLabel('Nama domain')).toHaveValue('www.kopi-senja.com');
		await expect(hint).toHaveCount(0);
		expect(calls.filter((call) => call.method === 'POST')).toEqual([]);
	});

	test('an apex added anyway shows an ALIAS record at @', async ({ page }) => {
		await mockDomainsApi(page);
		await page.goto(SETTINGS_URL);
		await settled(page);
		await page.getByLabel('Nama domain').fill('kopi-senja.com');
		await page.getByRole('button', { name: 'Tambah domain' }).click();
		const records = items(page).first().getByTestId('dns-record');
		await expect(records.nth(0)).toContainText('_sakala');
		await expect(records.nth(1)).toContainText('ALIAS');
		await expect(records.nth(1).getByText('@', { exact: true })).toBeVisible();
		await expect(records.nth(1)).toContainText('Cloudflare: CNAME dengan nama @');
		// Never an address to type.
		await expect(items(page).first()).not.toContainText(/\d+\.\d+\.\d+\.\d+/);
	});

	test('names the API would refuse are explained before sending', async ({ page }) => {
		const { calls } = await mockDomainsApi(page);
		await page.goto(SETTINGS_URL);
		await settled(page);
		for (const [input, fixture] of [
			['*.kopi-senja.com', 'domain-create-invalid-wildcard'],
			['192.0.2.10', 'domain-create-invalid-ip'],
			['my.id', 'domain-create-invalid-public-suffix'],
			['kopi-senja.sakala.app', 'domain-create-invalid-forbidden'],
			['kopi_senja.com', 'domain-create-invalid-label']
		] as const) {
			await page.getByLabel('Nama domain').fill(input);
			await page.getByRole('button', { name: 'Tambah domain' }).click();
			const message = capturedDomain<{ errors: { hostname: string[] } }>(fixture).body.errors
				.hostname[0];
			await expect(page.getByText(message)).toBeVisible();
			await expect(page.getByLabel('Nama domain')).toBeFocused();
		}
		expect(calls.filter((call) => call.method === 'POST')).toEqual([]);
	});

	test('refusals from the API show on the field with what to do', async ({ page }) => {
		let reply = 'domain-create-taken';
		await mockDomainsApi(page, { add: () => capturedDomain(reply) });
		await page.goto(SETTINGS_URL);
		await settled(page);
		const input = page.getByLabel('Nama domain');

		await input.fill('www.kopi-senja.com');
		await page.getByRole('button', { name: 'Tambah domain' }).click();
		await expect(page.getByText('www.kopi-senja.com sudah aktif di proyek lain.')).toBeVisible();

		reply = 'domain-create-limit';
		await page.getByRole('button', { name: 'Tambah domain' }).click();
		await expect(page.getByText('Kuota 1 custom domain workspace habis.')).toBeVisible();

		reply = 'domain-create-invalid-punycode';
		await input.fill('xn--zz.com');
		await page.getByRole('button', { name: 'Tambah domain' }).click();
		await expect(
			page.getByText('Bagian nama domain yang diawali xn-- bukan nama internasional yang valid.')
		).toBeVisible();
	});

	test('a full quota keeps the form closed and says why', async ({ page }) => {
		await mockDomainsApi(page, { domains: [domainStates.active()] });
		await page.goto(SETTINGS_URL);
		await settled(page);
		await expect(page.getByLabel('Nama domain')).toBeDisabled();
		await expect(section(page).getByTestId('domain-quota')).toHaveText(
			'Kuota 1 custom domain workspace habis. Hapus domain yang tidak dipakai.'
		);
	});

	test('a workspace without quota sees the reason instead of a form', async ({ page }) => {
		await mockDomainsApi(page, { max: 0 });
		await page.goto(SETTINGS_URL);
		await settled(page);
		await expect(page.getByLabel('Nama domain')).toHaveCount(0);
		await expect(section(page).getByTestId('domain-quota')).toHaveText(
			'Workspace ini belum punya kuota custom domain. Minta ke admin Sakala.'
		);
	});

	test('the form and the records work by keyboard alone', async ({ page }) => {
		// Room for a second domain, so the form stays enabled after the first.
		const { calls } = await mockDomainsApi(page, { max: 2 });
		await page.goto(SETTINGS_URL);
		await settled(page);
		await page.getByLabel('Nama domain').focus();
		await page.keyboard.type('www.kopi-senja.com');
		await page.keyboard.press('Enter');
		await expect(items(page)).toHaveCount(1);
		expect(calls.filter((call) => call.method === 'POST')).toHaveLength(1);
		// From the field, Tab reaches the add button, then the first copy button.
		await page.getByLabel('Nama domain').focus();
		await page.keyboard.press('Tab');
		await expect(page.getByRole('button', { name: 'Tambah domain' })).toBeFocused();
		await page.keyboard.press('Tab');
		await expect(page.getByRole('button', { name: 'Salin nama TXT' })).toBeFocused();
	});
});

test.describe('checking a domain', () => {
	test('each check says whether it passed, with the API message for the one that failed', async ({
		page
	}) => {
		await mockDomainsApi(page, { domains: [domainStates.pendingCaa()] });
		await page.goto(SETTINGS_URL);
		await settled(page);
		const checks = items(page).first().getByTestId('domain-check');
		await expect(checks).toHaveCount(3);
		await expect(checks.nth(0)).toHaveAttribute('data-state', 'pass');
		await expect(checks.nth(0)).toContainText('TXT kepemilikan');
		await expect(checks.nth(1)).toHaveAttribute('data-state', 'pass');
		await expect(checks.nth(2)).toHaveAttribute('data-state', 'fail');
		await expect(checks.nth(2)).toContainText('Perbaiki');
		await expect(checks.nth(2)).toContainText('0 issue "letsencrypt.org"');
	});

	test('a DNS error leaves every check unknown and says so once', async ({ page }) => {
		await mockDomainsApi(page, { domains: [domainStates.pendingDnsError()] });
		await page.goto(SETTINGS_URL);
		await settled(page);
		const item = items(page).first();
		await expect(item.locator('[data-state="unknown"]')).toHaveCount(3);
		await expect(item.locator('[data-reason="dns_error"]')).toContainText(
			'tidak menjawab atau menjawab dengan error'
		);
	});

	test('Periksa sekarang turns a passing domain active and folds its records away', async ({
		page
	}) => {
		const { calls } = await mockDomainsApi(page, {
			domains: [domainStates.pendingMissing()],
			check: () => domainStates.active()
		});
		await page.goto(SETTINGS_URL);
		await settled(page);
		const item = items(page).first();
		await item.getByRole('button', { name: 'Periksa sekarang' }).click();
		await expect(item.getByTestId('custom-domain-status')).toHaveText('Aktif');
		await expect(item.getByTestId('custom-domain-summary')).toContainText('Aktif sejak');
		await expect(item.getByTestId('custom-domain-records')).not.toHaveAttribute('open');
		await expect(item.getByTestId('domain-checks')).toHaveCount(0);
		expect(calls.filter((call) => call.path.endsWith('/check'))).toHaveLength(1);
	});

	test('a rate-limited check waits as long as the API says', async ({ page }) => {
		const limited = capturedDomain('domain-check-rate-limited');
		await mockDomainsApi(page, {
			domains: [domainStates.pendingMissing()],
			check: () => ({ status: limited.status, body: limited.body, headers: limited.headers })
		});
		await page.goto(SETTINGS_URL);
		await settled(page);
		const item = items(page).first();
		await item.getByRole('button', { name: 'Periksa sekarang' }).click();
		await expect(item.getByRole('alert')).toHaveText(
			'Terlalu sering diperiksa. Coba lagi dalam 60 detik.'
		);
		await expect(item.getByRole('button', { name: /Tunggu \d+ detik/ })).toBeDisabled();
	});
});

test.describe('states after adding', () => {
	test('each state has one badge and one short sentence', async ({ page }) => {
		const domains = [
			withId(domainStates.failing(), 'd-failing', 'www.kopi-senja.com'),
			withId(domainStates.disabled(), 'd-disabled', 'toko.kopi-senja.com'),
			withId(domainStates.adminDisabled(), 'd-admin', 'kopi-senja.com'),
			withId(domainStates.failed(), 'd-failed', 'blog.kopi-senja.com'),
			withId(domainStates.released(), 'd-released', 'lama.kopi-senja.com'),
			withId(domainStates.waitingForNode(), 'd-waiting', 'menu.kopi-senja.com')
		];
		await mockDomainsApi(page, { domains, max: 6 });
		await page.goto(SETTINGS_URL);
		await settled(page);
		const byState = (state: string) => section(page).locator(`[data-state="${state}"]`).first();

		await expect(byState('failing').getByTestId('custom-domain-status')).toHaveText(
			'DNS bermasalah'
		);
		await expect(byState('failing').getByTestId('custom-domain-summary')).toHaveText(
			'Dinonaktifkan 28 Nov, 16.27 WIB kalau DNS belum diperbaiki.'
		);
		await expect(byState('disabled').getByTestId('custom-domain-status')).toHaveText('Nonaktif');
		await expect(byState('disabled').getByTestId('custom-domain-summary')).toContainText(
			'sampai 28 Des, 16.27 WIB'
		);
		await expect(byState('admin_disabled').getByTestId('custom-domain-summary')).toContainText(
			'Halaman login palsu yang meniru bank.'
		);
		await expect(
			byState('admin_disabled').getByRole('button', { name: 'Periksa sekarang' })
		).toHaveCount(0);
		await expect(byState('failed').getByTestId('custom-domain-status')).toHaveText('Gagal');
		await expect(byState('released').getByTestId('custom-domain-status')).toHaveText(
			'Dipakai proyek lain'
		);
		await expect(byState('released').getByRole('button', { name: 'Periksa sekarang' })).toHaveCount(
			0
		);
		await expect(byState('waiting_for_node').getByTestId('custom-domain-status')).toHaveText(
			'Menunggu server'
		);
		for (const summary of await section(page).getByTestId('custom-domain-summary').all()) {
			const words = (await summary.innerText()).split(/\s+/).filter(Boolean).length;
			expect(words, 'one short sentence per state').toBeLessThanOrEqual(20);
		}
	});

	test('an apex found by its addresses gets a one-line warning', async ({ page }) => {
		await mockDomainsApi(page, { domains: [domainStates.apexActive()] });
		await page.goto(SETTINGS_URL);
		await settled(page);
		await expect(items(page).first().getByTestId('custom-domain-addresses')).toHaveText(
			'Terdeteksi lewat alamat IP. Kalau itu record A manual, ganti dengan ALIAS.'
		);
	});

	test('deleting asks first, then removes the domain', async ({ page }) => {
		const { calls } = await mockDomainsApi(page, { domains: [domainStates.active()] });
		await page.goto(SETTINGS_URL);
		await settled(page);
		await items(page).first().getByRole('button', { name: 'Hapus www.kopi-senja.com' }).click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toContainText('Hapus www.kopi-senja.com?');
		await dialog.getByRole('button', { name: 'Hapus domain' }).click();
		await expect(items(page)).toHaveCount(0);
		expect(calls.find((call) => call.method === 'DELETE')?.path).toMatch(/\/domains\/[^/]+$/);
		await expect(page.getByLabel('Nama domain')).toBeEnabled();
	});

	test('a viewer reads the domains without controls', async ({ page }) => {
		await mockDomainsApi(page, { role: 'viewer', domains: [domainStates.pendingCaa()] });
		await page.goto(SETTINGS_URL);
		await settled(page);
		await expect(items(page)).toHaveCount(1);
		await expect(page.getByLabel('Nama domain')).toHaveCount(0);
		await expect(section(page).getByRole('button', { name: 'Periksa sekarang' })).toHaveCount(0);
		await expect(section(page)).toContainText(
			'Hanya pemilik dan anggota workspace yang bisa mengatur domain.'
		);
	});
});

test.describe('the project address', () => {
	test('an active custom domain becomes the address, with the Sakala one beside it', async ({
		page
	}) => {
		await mockDomainsApi(page, { domains: [domainStates.active()] });
		await page.goto(OVERVIEW_URL);
		await settled(page);
		await expect(page.getByTestId('project-public-url')).toHaveText('www.kopi-senja.com');
		await expect(page.getByTestId('project-public-url')).toHaveAttribute(
			'href',
			'https://www.kopi-senja.com'
		);
		await expect(page.getByTestId('project-default-url')).toContainText('toko-kopi-web.sakala.app');
		const card = page.getByTestId('overview-custom-domains');
		await expect(card).toContainText('www.kopi-senja.com');
		await expect(card).toContainText('Aktif');
		await expect(card.getByRole('link', { name: 'Atur domain' })).toHaveAttribute(
			'href',
			`/projects/${PROJECT_ID}/settings/domain`
		);
	});

	test('a domain that does not serve yet leaves the Sakala address in front', async ({ page }) => {
		await mockDomainsApi(page, { domains: [domainStates.waitingForNode()] });
		await page.goto(OVERVIEW_URL);
		await settled(page);
		await expect(page.getByTestId('project-public-url')).toHaveText('toko-kopi-web.sakala.app');
		await expect(page.getByTestId('project-default-url')).toHaveCount(0);
		await expect(page.getByTestId('overview-custom-domains')).toContainText('Menunggu server');
	});

	test('without a domain the overview offers to add one', async ({ page }) => {
		await mockDomainsApi(page);
		await page.goto(OVERVIEW_URL);
		await settled(page);
		const card = page.getByTestId('overview-custom-domains');
		await expect(card).toContainText('Belum ada.');
		await card.getByRole('link', { name: 'Tambah domain' }).click();
		await expect(page).toHaveURL(new RegExp(`/projects/${PROJECT_ID}/settings/domain$`));
		await expect(section(page)).toBeInViewport();
	});
});

test.describe('layout floor', () => {
	for (const width of [320, 1280]) {
		test(`settings and overview hold at ${width} px`, async ({ page }) => {
			await page.setViewportSize({ width, height: 900 });
			const domains = [
				withId(domainStates.pendingCaa(), 'd-pending'),
				withId(domainStates.apexPending(), 'd-apex'),
				withId(domainStates.failing(), 'd-failing', 'menu.kopi-senja.com'),
				withId(domainStates.adminDisabled(), 'd-admin', 'promo.kopi-senja.com'),
				withId(domainFrom('domain-check-apex-verified'), 'd-active', 'kopi-senja.id')
			];
			await mockDomainsApi(page, { domains, max: 5 });
			for (const path of [SETTINGS_URL, OVERVIEW_URL]) {
				await page.goto(path);
				await settled(page);
				// Folded records and "Pelajari" open too, so their content is measured.
				for (const details of await page.locator('[data-testid="domains-section"] details').all()) {
					await details.evaluate((element) => element.setAttribute('open', ''));
				}
				const audit = await auditDom(page, 24, width < 768 ? 44 : 24);
				const at = `${path} at ${width} px`;
				expect.soft(audit.overflow, `${at}: nothing past the viewport`).toEqual([]);
				expect.soft(audit.contrast, `${at}: text contrast`).toEqual([]);
				expect.soft(audit.controls, `${at}: edge of inputs`).toEqual([]);
				expect.soft(audit.targets, `${at}: targets of at least 24 px`).toEqual([]);
				expect.soft(audit.primaryTargets, `${at}: primary actions on touch`).toEqual([]);
				expect.soft(audit.h1, `${at}: exactly one h1`).toBe(1);
				expect.soft(audit.main, `${at}: exactly one main`).toBe(1);
			}
		});
	}
});

/** The admin mocks, with pilot-limits saying whether the server has custom domains on. */
async function mockAdminDomains(page: Page, enabled = true) {
	let disabled = false;
	const calls = await mockAdminApi(page, {
		override: (call: RecordedCall) => {
			if (!call.path.startsWith('custom-domains')) return undefined;
			if (!enabled) return capturedDomain('admin-custom-domains-off');
			if (call.path.endsWith('/disable')) {
				disabled = true;
				return capturedDomain('admin-disable');
			}
			if (call.path.endsWith('/enable')) {
				disabled = false;
				return capturedDomain('admin-enable');
			}
			if (call.search.get('failing') === '1') return capturedDomain('admin-custom-domains-failing');
			const list = capturedDomain<{ data: { domain: MockDomain }[] }>('admin-custom-domains');
			if (disabled) {
				const after = capturedDomain<{ data: { domain: MockDomain } }>('admin-disable').body.data;
				list.body.data = list.body.data.map((row) =>
					row.domain.id === after.domain.id ? after : row
				);
			}
			return list;
		}
	});
	await page.route(/\/api\/v1\/app\/pilot-limits(\?.*)?$/, (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(
				capturedDomain(enabled ? 'pilot-limits-domains' : 'pilot-limits-domains-off').body
			)
		})
	);
	return calls;
}

const ADMIN_URL = '/admin/custom-domains';

test.describe('admin', () => {
	test('lists every custom domain with its project, and filters the failing ones', async ({
		page
	}) => {
		const calls = await mockAdminDomains(page);
		await page.goto(ADMIN_URL);
		await settled(page);
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Custom domain');
		await expect(page.getByRole('link', { name: 'Custom domain' }).first()).toHaveAttribute(
			'aria-current',
			'page'
		);
		const rows = page.getByTestId('admin-custom-domain');
		await expect(rows).toHaveCount(3);
		await expect(rows.first()).toContainText('blog.kopi-senja.com');
		await expect(rows.first()).toContainText('blog-kopi');
		await page.getByLabel('Pemeriksaan').selectOption('1');
		await expect(page).toHaveURL(/failing=1/);
		await expect(rows).toHaveCount(1);
		expect(calls.some((call) => call.search.get('failing') === '1')).toBe(true);
	});

	test('disables a domain with a reason, and enables it again', async ({ page }) => {
		const calls = await mockAdminDomains(page);
		await page.goto(ADMIN_URL);
		await settled(page);
		await page.getByRole('button', { name: 'Nonaktifkan kopi-senja.com' }).click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toContainText('kopi-senja.com');
		await dialog.getByLabel(/Alasan/).fill('Halaman login palsu yang meniru bank.');
		await dialog.getByRole('button', { name: 'Nonaktifkan' }).click();
		await expect(dialog).toHaveCount(0);
		const disable = calls.find((call) => call.path.endsWith('/disable'));
		expect(disable?.body).toEqual({ reason: 'Halaman login palsu yang meniru bank.' });

		const row = page.getByTestId('admin-custom-domain').filter({ hasText: /^kopi-senja\.com/ });
		await expect(row).toContainText('Dinonaktifkan admin');
		await row.getByRole('button', { name: 'Aktifkan lagi kopi-senja.com' }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Aktifkan lagi' }).click();
		await expect(page.getByRole('dialog')).toHaveCount(0);
		expect(calls.some((call) => call.path.endsWith('/enable') && call.method === 'POST')).toBe(
			true
		);
	});

	test('with the flag off the menu has no entry and the page says so', async ({ page }) => {
		const calls = await mockAdminDomains(page, false);
		await page.goto('/admin');
		await settled(page);
		await expect(page.getByRole('link', { name: 'Custom domain' })).toHaveCount(0);
		await page.goto(ADMIN_URL);
		await settled(page);
		await expect(page.getByText('Custom domain tidak aktif di server ini')).toBeVisible();
		expect(calls.filter((call) => call.path.startsWith('custom-domains'))).toEqual([]);
	});

	for (const width of [320, 1280]) {
		test(`the admin list holds at ${width} px`, async ({ page }) => {
			await page.setViewportSize({ width, height: 900 });
			await mockAdminDomains(page);
			await page.goto(ADMIN_URL);
			await settled(page);
			const audit = await auditDom(page, 24, width < 768 ? 44 : 24);
			expect.soft(audit.overflow).toEqual([]);
			expect.soft(audit.contrast).toEqual([]);
			expect.soft(audit.targets).toEqual([]);
			expect.soft(audit.h1).toBe(1);
		});
	}
});

/**
 * Screenshots for the pull request, written only when DOMAIN_SCREENSHOTS names a folder, so CI does
 * not spend time on them.
 */
const SCREENSHOT_DIR = process.env.DOMAIN_SCREENSHOTS;
const SCREENSHOT_HEIGHT = 900;
const SCREENSHOT_MAX_HEIGHT = 4000;

async function sectionShot(page: Page, path: string) {
	await settled(page);
	// A viewport as tall as the page, so the section is captured whole at any width.
	const width = page.viewportSize()?.width ?? 1280;
	const height = await page.evaluate(() => document.documentElement.scrollHeight);
	await page.setViewportSize({ width, height: Math.min(height + 48, SCREENSHOT_MAX_HEIGHT) });
	await section(page).screenshot({ path });
	await writeFile(path.replace(/\.png$/, '.html'), await page.content());
	await page.setViewportSize({ width, height: SCREENSHOT_HEIGHT });
}

async function fullShot(page: Page, path: string, width: number) {
	await settled(page);
	const height = await page.evaluate(() =>
		Math.max(...Array.from(document.querySelectorAll('*'), (element) => element.scrollHeight))
	);
	await page.setViewportSize({ width, height: Math.min(height + 48, SCREENSHOT_MAX_HEIGHT) });
	await page.screenshot({ path });
	await writeFile(path.replace(/\.png$/, '.html'), await page.content());
	await page.setViewportSize({ width, height: SCREENSHOT_HEIGHT });
}

test.describe('screenshots', () => {
	test.skip(!SCREENSHOT_DIR, 'set DOMAIN_SCREENSHOTS to write them');

	const states: [string, () => MockDomain[], { max?: number; role?: 'viewer' }?][] = [
		['empty', () => []],
		['pending-subdomain', () => [domainStates.pendingNew()]],
		['pending-subdomain-checked', () => [domainStates.pendingCaa()]],
		['pending-apex', () => [domainStates.apexPointsElsewhere()]],
		['active', () => [domainStates.active()]],
		['active-apex', () => [domainStates.apexActive()]],
		['failing-warning', () => [domainStates.failing()]],
		['disabled', () => [domainStates.disabled()]],
		['admin-disabled', () => [domainStates.adminDisabled()]],
		['failed', () => [domainStates.failed()]],
		['released', () => [domainStates.released()]],
		['waiting-for-node', () => [domainStates.waitingForNode()]],
		['viewer', () => [domainStates.pendingCaa()], { role: 'viewer' }]
	];

	for (const width of [1280, 320]) {
		for (const [name, domains, options] of states) {
			test(`${name} at ${width} px`, async ({ page }) => {
				const dir = `${SCREENSHOT_DIR}/settings`;
				await mkdir(dir, { recursive: true });
				await page.setViewportSize({ width, height: SCREENSHOT_HEIGHT });
				await mockDomainsApi(page, { domains: domains(), max: 1, ...options });
				await page.goto(SETTINGS_URL);
				await sectionShot(page, `${dir}/${name}-${width}.png`);
			});
		}

		test(`add form with apex hint at ${width} px`, async ({ page }) => {
			const dir = `${SCREENSHOT_DIR}/settings`;
			await mkdir(dir, { recursive: true });
			await page.setViewportSize({ width, height: SCREENSHOT_HEIGHT });
			await mockDomainsApi(page);
			await page.goto(SETTINGS_URL);
			await page.getByLabel('Nama domain').fill('kopi-senja.com');
			await sectionShot(page, `${dir}/add-form-apex-${width}.png`);
			await page.getByLabel('Nama domain').fill('*.kopi-senja.com');
			await page.getByRole('button', { name: 'Tambah domain' }).click();
			await sectionShot(page, `${dir}/add-form-error-${width}.png`);
		});

		test(`overview and header at ${width} px`, async ({ page }) => {
			const dir = `${SCREENSHOT_DIR}/overview`;
			await mkdir(dir, { recursive: true });
			await page.setViewportSize({ width, height: SCREENSHOT_HEIGHT });
			await mockDomainsApi(page, { domains: [domainStates.active()] });
			await page.goto(OVERVIEW_URL);
			await fullShot(page, `${dir}/active-${width}.png`, width);
		});

		test(`admin list at ${width} px`, async ({ page }) => {
			const dir = `${SCREENSHOT_DIR}/admin`;
			await mkdir(dir, { recursive: true });
			await page.setViewportSize({ width, height: SCREENSHOT_HEIGHT });
			await mockAdminDomains(page);
			await page.goto(ADMIN_URL);
			await fullShot(page, `${dir}/custom-domains-${width}.png`, width);
			await page.getByRole('button', { name: 'Nonaktifkan kopi-senja.com' }).click();
			await page
				.getByRole('dialog')
				.getByLabel(/Alasan/)
				.fill('Halaman login palsu.');
			await page.screenshot({ path: `${dir}/disable-dialog-${width}.png` });
		});

		test(`flag off at ${width} px`, async ({ page }) => {
			const dir = `${SCREENSHOT_DIR}/flag-off`;
			await mkdir(dir, { recursive: true });
			await page.setViewportSize({ width, height: SCREENSHOT_HEIGHT });
			await mockDomainsApi(page, { enabled: false });
			await page.goto(SETTINGS_URL);
			await fullShot(page, `${dir}/settings-${width}.png`, width);
			await page.goto(OVERVIEW_URL);
			await fullShot(page, `${dir}/overview-${width}.png`, width);
		});
	}
});

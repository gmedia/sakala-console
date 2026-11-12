import { expect, test, type Page } from '@playwright/test';
import { ADMIN_ROUTES, adminFixture, ids, mockAdminApi } from './fixtures/admin';
import { mockEveryRoute, signedInUser } from './fixtures/all-routes';
import { auditDom } from './fixtures/dom-audit';

async function settled(page: Page) {
	await page.waitForLoadState('networkidle');
	await expect(page.locator('main')).toHaveCount(1);
}

test.describe('admin access', () => {
	test('a non-admin who opens an admin address gets the 403 page and no admin data', async ({
		page
	}) => {
		const calls = await mockAdminApi(page, { role: 'user' });

		await page.goto(`/admin/projects/${ids.project}`);

		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kamu tidak memiliki akses');
		await expect(page.getByText('Error 403')).toBeVisible();
		await expect(page.getByRole('link', { name: 'Buka proyek' })).toBeVisible();
		await expect(page).toHaveTitle('Akses ditolak · Sakala');
		expect(calls).toEqual([]);
	});

	test('the user menu offers the admin area to admins only', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 900 });
		await mockEveryRoute(page);
		await page.goto('/projects');
		await page.getByRole('button', { name: 'Menu akun pengguna' }).click();
		await expect(page.getByRole('link', { name: 'Pengaturan' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Area admin' })).toHaveCount(0);

		await mockAdminApi(page);
		await page.route('**/api/v1/auth/user', (route) =>
			route.fulfill({ json: { data: { ...signedInUser, role: 'admin' } } })
		);
		await page.reload();
		await page.getByRole('button', { name: 'Menu akun pengguna' }).click();
		await page.getByRole('link', { name: 'Area admin' }).click();

		await expect(page).toHaveURL(/\/admin$/);
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Overview');
		await expect(page.getByRole('navigation', { name: 'Navigasi admin' })).toBeVisible();
	});

	test('an admin demoted mid-session sees the API refusal instead of an empty page', async ({
		page
	}) => {
		await mockAdminApi(page, {
			override: (call) =>
				call.path === 'users'
					? { status: 403, body: { message: 'This action is unauthorized.' } }
					: undefined
		});
		await page.goto('/admin/users');

		await expect(page.getByRole('alert')).toContainText('Kamu tidak lagi punya akses admin');
	});
});

test.describe('admin journeys', () => {
	test.beforeEach(async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 900 });
	});

	test('the overview labels every number with its range and reads a new range from the URL', async ({
		page
	}) => {
		const calls = await mockAdminApi(page);
		await page.goto('/admin');

		await expect(page.getByText('Rentang: 5 Nov 2026 – 11 Nov 2026')).toBeVisible();
		await expect(page.getByText('Dihitung 11 Nov 2026, 17.00 WIB')).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Perlu perhatian' })).toBeVisible();
		await expect(page.getByText(/^2 deployment gagal \(67% dari yang selesai/)).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Validasi pilot' })).toBeVisible();

		await page.getByLabel('Rentang waktu').selectOption('7d');
		await expect(page).toHaveURL(/range=7d/);
		await expect
			.poll(() =>
				calls.some((call) => call.path === 'overview' && call.search.get('range') === '7d')
			)
			.toBe(true);

		await page.getByLabel('Rentang waktu').selectOption('custom');
		await page.getByLabel('Dari').fill('2026-11-11');
		await page.getByLabel('Sampai').fill('2026-11-01');
		await page.getByRole('button', { name: 'Terapkan' }).click();
		await expect(page.getByText('Tanggal akhir tidak boleh sebelum tanggal mulai.')).toBeVisible();

		await page.getByLabel('Dari').fill('2026-11-01');
		await page.getByLabel('Sampai').fill('2026-11-11');
		await page.getByRole('button', { name: 'Terapkan' }).click();
		await expect(page).toHaveURL(/from=2026-11-01&range=custom&to=2026-11-11/);

		await page.getByText('Lihat sebagai tabel').first().click();
		await expect(page.getByRole('columnheader', { name: 'Pendaftaran' })).toBeVisible();
	});

	test('user filters and pages live in the URL, so a shared link opens the same view', async ({
		page
	}) => {
		const calls = await mockAdminApi(page);
		await page.goto('/admin/users');

		await page.getByLabel('Peran').selectOption('admin');
		await expect(page).toHaveURL(/\/admin\/users\?role=admin$/);
		await page.getByRole('textbox', { name: 'Cari nama, username, atau email' }).fill('rani');
		await expect(page).toHaveURL(/role=admin&search=rani/);
		await expect
			.poll(() => calls.at(-1)?.search.toString())
			.toBe('per_page=25&page=1&search=rani&role=admin');

		await page.getByRole('button', { name: 'Halaman 2' }).click();
		await expect(page).toHaveURL(/page=2/);

		await page.reload();
		await expect(page.getByLabel('Peran')).toHaveValue('admin');
		await expect(
			page.getByRole('textbox', { name: 'Cari nama, username, atau email' })
		).toHaveValue('rani');

		await page.getByRole('button', { name: 'Hapus filter' }).click();
		await expect(page).toHaveURL(/\/admin\/users$/);
	});

	test('promoting a user asks for a reason and sends it', async ({ page }) => {
		const calls = await mockAdminApi(page);
		await page.goto(`/admin/users/${ids.user}`);

		await page.getByRole('button', { name: 'Jadikan admin' }).click();
		const dialog = page.getByRole('dialog', { name: 'Jadikan admin?' });
		await expect(dialog).toContainText('Rani Putri (@rani)');
		await dialog.getByLabel('Alasan').fill('Asisten pilot');
		await dialog.getByRole('button', { name: 'Jadikan admin' }).click();

		await expect(dialog).toBeHidden();
		await expect(page.getByText('Rani Putri sekarang admin.')).toBeVisible();
		const patch = calls.find((call) => call.method === 'PATCH');
		expect(patch?.path).toBe(`users/${ids.user}/role`);
		expect(patch?.body).toEqual({ role: 'admin', reason: 'Asisten pilot' });
	});

	test('a team limit typed on the keyboard is sent as an integer', async ({ page }) => {
		const calls = await mockAdminApi(page);
		await page.goto(`/admin/users/${ids.user}`);

		await page.getByRole('button', { name: 'Ubah batas tim' }).click();
		const dialog = page.getByRole('dialog', { name: 'Ubah batas tim' });
		await dialog.getByLabel('Pakai batas default dari konfigurasi').uncheck();
		await dialog.getByLabel('Jumlah tim maksimal').pressSequentially('3');
		await dialog.getByLabel('Alasan').pressSequentially('Koordinator tiga kelas');
		await dialog.getByRole('button', { name: 'Simpan batas' }).click();

		await expect(dialog).toBeHidden();
		await expect(page.getByText('Batas tim disimpan.')).toBeVisible();
		const patch = calls.find((call) => call.method === 'PATCH');
		expect(patch?.path).toBe(`users/${ids.user}/team-limit`);
		expect(patch?.body).toEqual({ max_owned_teams: 3, reason: 'Koordinator tiga kelas' });
	});

	test('suspending a project names it, explains the consequence, and sends one request', async ({
		page
	}) => {
		const calls = await mockAdminApi(page);
		await page.goto(`/admin/projects/${ids.project}`);

		await page.getByRole('button', { name: 'Tangguhkan' }).click();
		const dialog = page.getByRole('dialog', { name: 'Tangguhkan proyek?' });
		await expect(dialog).toContainText('Toko Kue');
		await expect(dialog).toContainText('pemilik tidak bisa men-deploy');
		await expect(dialog.getByLabel('Alasan')).toBeFocused();

		const confirm = dialog.getByRole('button', { name: 'Tangguhkan' });
		await confirm.click();
		await expect(dialog.getByRole('alert')).toHaveText('Belum bisa dilanjutkan. Isi alasan dulu.');
		await expect(dialog.getByLabel('Alasan')).toBeFocused();
		expect(calls.filter((call) => call.method === 'POST')).toHaveLength(0);
		await dialog.getByLabel('Alasan').fill('Konten phishing');
		await confirm.dblclick();

		await expect(dialog).toBeHidden();
		await expect(page.getByText('Proyek ditangguhkan.')).toBeVisible();
		const posts = calls.filter((call) => call.method === 'POST');
		expect(posts).toHaveLength(1);
		expect(posts[0].path).toBe(`projects/${ids.project}/suspend`);
		expect(posts[0].body).toEqual({ reason: 'Konten phishing' });
		expect(posts[0].headers['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/);
	});

	test('a stop the API refuses keeps the dialog open with the reason it gave', async ({ page }) => {
		await mockAdminApi(page, {
			override: (call) =>
				call.method === 'POST'
					? {
							status: 409,
							body: { message: 'Command stop proyek ini masih berjalan. Tunggu sampai selesai.' }
						}
					: undefined
		});
		await page.goto(`/admin/projects/${ids.project}`);

		await page.getByRole('button', { name: 'Hentikan' }).click();
		const dialog = page.getByRole('dialog', { name: 'Hentikan workload proyek?' });
		await dialog.getByLabel('Alasan').fill('Penggunaan berlebih');
		await dialog.getByRole('button', { name: 'Hentikan' }).click();

		await expect(dialog.getByRole('alert')).toContainText(
			'Belum bisa dijalankan: Command stop proyek ini masih berjalan.'
		);
		await expect(dialog.getByLabel('Alasan')).toHaveValue('Penggunaan berlebih');
	});

	test('a suspended project offers only unsuspend and shows the reason in force', async ({
		page
	}) => {
		await mockAdminApi(page);
		await page.goto(`/admin/projects/${ids.suspendedProject}`);

		await expect(page.getByText('Alasan: Konten phishing')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Buka penangguhan' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Tangguhkan' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Hentikan' })).toHaveCount(0);
	});

	test('deleting a limit profile in use explains the refusal and links to its workspaces', async ({
		page
	}) => {
		await mockAdminApi(page);
		await page.goto('/admin/limit-profiles');

		await page.getByRole('button', { name: 'Hapus Kelas' }).click();
		const dialog = page.getByRole('dialog', { name: 'Hapus profil batas?' });
		await dialog.getByLabel('Alasan').fill('Tidak dipakai lagi');
		await dialog.getByRole('button', { name: 'Hapus profil' }).click();

		await expect(dialog.getByRole('alert')).toContainText('masih dipakai workspace');
		await dialog.getByRole('link', { name: 'Lihat workspace yang memakai profil ini' }).click();
		await expect(page).toHaveURL(
			new RegExp(`/admin/workspaces\\?limit_profile_id=${ids.limitProfile}`)
		);
		await expect(page.getByLabel('Profil batas')).toHaveValue(ids.limitProfile);
	});

	test('a new limit profile starts from the team defaults, so a name and a reason are enough', async ({
		page
	}) => {
		const calls = await mockAdminApi(page);
		await page.goto('/admin/limit-profiles');

		await page.getByRole('button', { name: 'Buat profil' }).click();
		const form = page.getByRole('dialog', { name: 'Buat profil batas' });
		await expect(form).toContainText('batas default tim bawaan Sakala');
		await expect(form.getByLabel('Build per jam (opsional)')).toHaveValue('');
		await form.getByLabel('Nama (wajib)').fill('Magang');
		await form.getByLabel('Alasan').fill('Pilot magang semester ini');
		await form.getByRole('button', { name: 'Buat profil' }).click();

		await expect(form).toBeHidden();
		await expect(page.getByText('Profil Magang dibuat.')).toBeVisible();
		expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
			name: 'Magang',
			max_projects: 2,
			max_active_containers: 2,
			max_active_deployments: 1,
			max_memory_mb: 512,
			max_cpu_millis: 1000,
			max_builds_per_hour: null,
			reason: 'Pilot magang semester ini'
		});
	});

	test('with no limit profiles yet, an admin creates one and assigns it to a team workspace with a reason', async ({
		page
	}) => {
		// Production on 2026-11-12: no profiles at all, and the workspace on the team default.
		const workspaceDetail = structuredClone(adminFixture('workspace-detail'));
		const detailData = (
			workspaceDetail.body as {
				data: { workspace: { limit_profile: unknown }; quota: { limit_profile: unknown } };
			}
		).data;
		detailData.workspace.limit_profile = null;
		detailData.quota.limit_profile = null;
		const created = adminFixture('limit-profile-create');
		const createdProfile = (created.body as { data: { id: string } }).data;
		const listOf = (profiles: unknown[]) => {
			const list = structuredClone(adminFixture('limit-profiles'));
			const body = list.body as { data: unknown[]; meta: { total: number } };
			body.data = profiles;
			body.meta.total = profiles.length;
			return list;
		};
		let profileCreated = false;
		const calls = await mockAdminApi(page, {
			override: ({ method, path }) => {
				if (method === 'GET' && path === `workspaces/${ids.workspace}`) return workspaceDetail;
				if (path !== 'limit-profiles') return undefined;
				if (method === 'POST') {
					profileCreated = true;
					return created;
				}
				return listOf(profileCreated ? [createdProfile] : []);
			}
		});

		await page.goto(`/admin/workspaces/${ids.workspace}`);
		await page.getByRole('button', { name: 'Ubah profil batas' }).click();
		const empty = page.getByRole('dialog', { name: 'Ubah profil batas' });
		await expect(empty.getByRole('heading', { name: 'Belum ada profil batas' })).toBeVisible();
		await expect(empty).toContainText('Sekarang memakai Default tim.');
		await expect(empty.getByRole('button', { name: 'Simpan profil' })).toHaveCount(0);
		await empty.getByRole('link', { name: 'Buat profil batas' }).click();

		await expect(page).toHaveURL(/\/admin\/limit-profiles\?create=1&return_to=/);
		const form = page.getByRole('dialog', { name: 'Buat profil batas' });
		await expect(form).toContainText('kamu kembali ke workspace tadi');
		// Prefilled with the team default this workspace runs on (5, 3, 2, 512 MB, 1,000 m).
		await expect(form).toContainText('batas Default tim yang berlaku di workspace tadi');
		await expect(form.getByLabel('Proyek (wajib)', { exact: true })).toHaveValue('5');
		await form.getByRole('button', { name: 'Buat profil' }).click();
		await expect(form.getByRole('alert')).toHaveText(
			'Belum bisa dilanjutkan. Periksa isian yang ditandai: Nama. Isi alasan dulu.'
		);
		await expect(form.getByLabel('Nama (wajib)')).toBeFocused();

		await form.getByLabel('Nama (wajib)').fill('Magang');
		await form.getByLabel('Proyek (wajib)', { exact: true }).fill('3');
		await form.getByLabel('Container berjalan (wajib)').fill('2');
		await form.getByLabel('Deployment berjalan (wajib)').fill('1');
		await form.getByLabel('Memori per proyek (MB) (wajib)').fill('512');
		await form.getByLabel('CPU per proyek (millicore) (wajib)').fill('500');
		await form.getByLabel('Alasan').fill('Pilot magang semester ini');
		await form.getByRole('button', { name: 'Buat profil' }).click();

		await expect(page).toHaveURL(new RegExp(`/admin/workspaces/${ids.workspace}$`));
		const assign = page.getByRole('dialog', { name: 'Ubah profil batas' });
		const select = assign.getByLabel('Profil batas');
		await expect(select).toHaveValue(createdProfile.id);
		await expect(select.locator('option:checked')).toHaveText(
			'Magang (3 proyek, 2 container berjalan, 1 deployment berjalan)'
		);
		await assign.getByLabel('Alasan').fill('Workspace magang memakai paket Magang');
		await assign.getByRole('button', { name: 'Simpan profil' }).click();

		await expect(assign).toBeHidden();
		await expect(page.getByText('Profil batas disimpan.')).toBeVisible();
		expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
			name: 'Magang',
			max_projects: 3,
			max_active_containers: 2,
			max_active_deployments: 1,
			max_memory_mb: 512,
			max_cpu_millis: 500,
			max_builds_per_hour: null,
			reason: 'Pilot magang semester ini'
		});
		const put = calls.find((call) => call.method === 'PUT');
		expect(put?.path).toBe(`workspaces/${ids.workspace}/limit-profile`);
		expect(put?.body).toEqual({
			limit_profile_id: createdProfile.id,
			reason: 'Workspace magang memakai paket Magang'
		});
	});

	test('a new node shows its token once and cannot be closed before it is saved', async ({
		page
	}) => {
		const calls = await mockAdminApi(page);
		await page.goto('/admin/agents');

		await page.getByRole('button', { name: 'Daftarkan node' }).click();
		const form = page.getByRole('dialog', { name: 'Daftarkan runtime node' });
		await form.getByLabel('Nama node').fill('agent-sby-01');
		await form.getByLabel('Alasan').fill('Node baru');
		await form.getByRole('button', { name: 'Buat dan tampilkan token' }).click();

		const tokenDialog = page.getByRole('dialog', { name: 'Token untuk agent-sby-01' });
		await expect(tokenDialog.getByTestId('agent-token')).toHaveText(
			'sk_agt_contoh_bukan_token_asli_1'
		);
		await page.keyboard.press('Escape');
		await expect(tokenDialog).toBeVisible();
		await tokenDialog.getByRole('button', { name: 'Tutup' }).click();
		await expect(tokenDialog).toBeVisible();
		await expect(tokenDialog.getByRole('alert')).toContainText('Centang dulu kotak di atas.');

		await tokenDialog.getByLabel('Saya sudah menyimpan token ini').check();
		await tokenDialog.getByRole('button', { name: 'Tutup' }).click();
		await expect(tokenDialog).toBeHidden();
		await expect(page.getByText('sk_agt_contoh_bukan_token_asli_1')).toHaveCount(0);

		const post = calls.find((call) => call.method === 'POST');
		expect(post?.body).toEqual({ name: 'agent-sby-01', description: null, reason: 'Node baru' });
	});

	test('a failure opens to its category, timeline, and log', async ({ page }) => {
		await mockAdminApi(page);
		await page.goto('/admin/failures');

		await expect(page.getByText('Semua deployment gagal', { exact: true })).toBeVisible();
		await page.getByLabel('Kategori', { exact: true }).selectOption('build');
		await expect(page).toHaveURL(/category=build/);
		await page.getByRole('link', { name: /Detail deployment #3/ }).click();

		await expect(
			page.getByText('Build: Deployment gagal saat proses build aplikasi.')
		).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Timeline' })).toBeVisible();
		await expect(page.getByRole('log')).toContainText('Maiores quis repellat');
	});

	test('feedback status changes with a reason, and audit filters go to the API', async ({
		page
	}) => {
		const calls = await mockAdminApi(page);
		await page.goto('/admin/feedback');

		await page.getByRole('button', { name: /Ubah status/ }).click();
		const dialog = page.getByRole('dialog', { name: 'Ubah status masukan' });
		await dialog.getByLabel('Status baru').selectOption('resolved');
		await dialog.getByLabel('Alasan').fill('Sudah diperbaiki');
		await dialog.getByRole('button', { name: 'Simpan status' }).click();
		await expect(page.getByText('Status masukan menjadi Selesai.')).toBeVisible();
		expect(calls.find((call) => call.method === 'PATCH')?.body).toEqual({
			status: 'resolved',
			reason: 'Sudah diperbaiki'
		});

		await page.goto('/admin/audit');
		await page.getByLabel('Aksi (persis)').fill('feedback.status_changed');
		await page.getByRole('button', { name: 'Terapkan' }).click();
		await expect(page).toHaveURL(/action=feedback.status_changed/);
		await expect.poll(() => calls.at(-1)?.search.get('action')).toBe('feedback.status_changed');
		await expect(page.getByRole('cell', { name: 'Sudah diperbaiki' }).first()).toBeVisible();
	});
});

test.describe('every admin route meets the accessibility floor', () => {
	test.describe.configure({ timeout: 120_000 });

	for (const width of [320, 1280] as const) {
		test(`admin routes at ${width} px`, async ({ page }) => {
			await page.setViewportSize({ width, height: 800 });
			await mockAdminApi(page);
			for (const [name, path] of ADMIN_ROUTES) {
				await page.goto(path);
				await settled(page);
				const audit = await auditDom(page, 24, width < 768 ? 44 : 24);
				const at = `${name} at ${width} px`;
				expect.soft(audit.overflow, `${at}: nothing past the viewport`).toEqual([]);
				expect.soft(audit.contrast, `${at}: text contrast`).toEqual([]);
				expect.soft(audit.controls, `${at}: edge of inputs`).toEqual([]);
				expect.soft(audit.targets, `${at}: targets of at least 24 px`).toEqual([]);
				expect.soft(audit.primaryTargets, `${at}: primary actions on touch`).toEqual([]);
				expect.soft(audit.h1, `${at}: exactly one h1`).toBe(1);
				expect.soft(audit.main, `${at}: exactly one main`).toBe(1);
				expect.soft(audit.title, `${at}: a title of its own`).toMatch(/· Admin · Sakala$/);
			}
		});
	}
});

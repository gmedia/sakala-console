import { expect, test, type Page } from '@playwright/test';
import { MEMBERS, MY_INVITATION, PROJECT_ID, TEAM, mockWorkspaceApi } from './fixtures/workspaces';

const switcher = (page: Page) => page.getByTestId('workspace-switcher').first();
const teamPage = `/workspaces/${TEAM.id}`;
const [ownerMember, memberMember, viewerMember] = MEMBERS;

async function chooseWorkspace(page: Page, name: string) {
	await switcher(page).click();
	await page.getByRole('menuitemradio', { name: new RegExp(name) }).click();
}

test.describe('team workspaces', () => {
	test('a solo user starts in the personal workspace and the list asks for it', async ({
		page
	}) => {
		const { calls } = await mockWorkspaceApi(page, { persona: 'invitee' });
		await page.goto('/projects');

		await expect(switcher(page)).toContainText('Pribadi');
		await expect(page.getByRole('heading', { name: 'Tugas Pribadi' })).toBeVisible();
		await expect
			.poll(() => calls.projectLists.at(-1)?.searchParams.get('workspace_id'))
			.toBe('00000004-personal');
		// No team, no workspace chip on the cards: nothing changes for someone working alone.
		await expect(page.getByTestId('project-card-workspace')).toHaveCount(0);
	});

	test('creates a team, then explains the owned-team cap', async ({ page }) => {
		const { calls } = await mockWorkspaceApi(page, { persona: 'owner' });
		await page.goto('/projects');

		await switcher(page).click();
		await page.getByRole('menuitem', { name: 'Buat workspace tim' }).click();
		const dialog = page.getByRole('dialog');
		await dialog.getByLabel('Nama workspace').fill('Tim Kelas Web');
		await dialog.getByRole('button', { name: 'Buat workspace' }).click();

		await expect(page).toHaveURL(/\/workspaces\/01a1cb4a-aaaa-/);
		await expect(page.getByRole('heading', { name: 'Tim Kelas Web', level: 2 })).toBeVisible();
		await expect(switcher(page)).toContainText('Tim Kelas Web');
		expect(calls.createWorkspace).toEqual([{ name: 'Tim Kelas Web' }]);

		// A third owned team passes the cap of two, which the API refuses with its numbers.
		await switcher(page).click();
		await page.getByRole('menuitem', { name: 'Buat workspace tim' }).click();
		await dialog.getByLabel('Nama workspace').fill('Tim Ketiga');
		await dialog.getByRole('button', { name: 'Buat workspace' }).click();
		await expect(dialog.getByRole('alert')).toContainText(
			'Kamu sudah memiliki 2 workspace tim, dan itu batasnya.'
		);
		await expect(dialog).toBeVisible();
	});

	test('the switcher filters the project list and is remembered', async ({ page }) => {
		const { calls } = await mockWorkspaceApi(page, { persona: 'owner' });
		await page.goto('/projects');
		await expect(page.getByRole('heading', { name: 'Tugas Pribadi' })).toBeVisible();

		await chooseWorkspace(page, TEAM.name);
		await expect(page.getByRole('heading', { name: 'Facility Reporting' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Tugas Pribadi' })).toHaveCount(0);
		expect(calls.projectLists.at(-1)?.searchParams.get('workspace_id')).toBe(TEAM.id);
		await expect(page.getByTestId('project-card-workspace').first()).toContainText(TEAM.name);
		await expect(page.getByText(`Workspace ${TEAM.name} memakai 1 dari 5 proyek`)).toBeVisible();

		await page.reload();
		await expect(switcher(page)).toContainText(TEAM.name);
		await expect(page.getByRole('heading', { name: 'Facility Reporting' })).toBeVisible();
	});

	test('the switcher works from the navigation drawer on a phone', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 800 });
		const { calls } = await mockWorkspaceApi(page, { persona: 'owner' });
		await page.goto('/projects');
		await expect(page.getByRole('heading', { name: 'Tugas Pribadi' })).toBeVisible();

		await page.getByRole('button', { name: 'Buka navigasi' }).click();
		const drawer = page.getByRole('dialog', { name: 'Navigasi' });
		await drawer.getByTestId('workspace-switcher').click();
		await page.getByRole('menuitemradio', { name: new RegExp(TEAM.name) }).click();

		await expect(drawer).toBeHidden();
		await expect(page.getByRole('heading', { name: 'Facility Reporting' })).toBeVisible();
		expect(calls.projectLists.at(-1)?.searchParams.get('workspace_id')).toBe(TEAM.id);
	});

	test('invites by email with a role and lists the pending invitation', async ({ page }) => {
		const { calls } = await mockWorkspaceApi(page, { persona: 'owner' });
		await page.goto(teamPage);

		await expect(page.getByTestId('member-row')).toHaveCount(3);
		await page.getByRole('button', { name: 'Undang anggota' }).click();
		const dialog = page.getByRole('dialog');
		await dialog.getByLabel('Email').fill('Fajar@Kampus.test');
		await dialog.getByRole('radio', { name: /Pengamat/ }).check();
		await dialog.getByRole('button', { name: 'Kirim undangan' }).click();

		await expect(dialog).toBeHidden();
		expect(calls.invite).toEqual([{ email: 'Fajar@Kampus.test', role: 'viewer' }]);
		const row = page.getByTestId('invitation-row').filter({ hasText: 'fajar@kampus.test' });
		await expect(row).toContainText('Pengamat');

		// An address that is already a member is refused, and the dialog says why.
		await page.getByRole('button', { name: 'Undang anggota' }).click();
		await dialog.getByLabel('Email').fill(memberMember.user.email!);
		await dialog.getByRole('button', { name: 'Kirim undangan' }).click();
		await expect(dialog.getByRole('alert')).toContainText('sudah menjadi anggota workspace');
	});

	test('changes a member’s role', async ({ page }) => {
		const { calls } = await mockWorkspaceApi(page, { persona: 'owner' });
		await page.goto(teamPage);

		await page.getByRole('button', { name: `Ubah peran ${viewerMember.user.name}` }).click();
		const dialog = page.getByRole('dialog');
		await expect(dialog.getByRole('radio', { name: /Pengamat/ })).toBeChecked();
		await dialog.getByRole('radio', { name: /Anggota/ }).check();
		await dialog.getByRole('button', { name: 'Simpan peran' }).click();

		await expect(dialog).toBeHidden();
		expect(calls.changeRole).toEqual([{ memberId: viewerMember.id, body: { role: 'member' } }]);
		const row = page.getByTestId('member-row').filter({ hasText: viewerMember.user.name });
		await expect(row).toContainText('Anggota');
	});

	test('the last owner cannot be demoted, removed, or leave, and the UI says so', async ({
		page
	}) => {
		const { calls } = await mockWorkspaceApi(page, {
			persona: 'owner',
			refuseRemoval: memberMember.id
		});
		await page.goto(teamPage);

		await expect(page.getByTestId('last-owner-note')).toContainText('Kamu satu-satunya pemilik');
		await expect(page.getByRole('button', { name: 'Keluar dari workspace' })).toBeDisabled();
		await expect(page.getByTestId('leave-blocked')).toContainText('satu-satunya pemilik');

		await page.getByRole('button', { name: `Ubah peran ${ownerMember.user.name}` }).click();
		const dialog = page.getByRole('dialog');
		await expect(dialog.getByRole('radio', { name: /Anggota/ })).toBeDisabled();
		await expect(dialog.getByRole('radio', { name: /Pengamat/ })).toBeDisabled();
		await expect(dialog).toContainText('satu-satunya pemilik');
		await dialog.getByRole('button', { name: 'Batal' }).click();
		expect(calls.changeRole).toEqual([]);

		// The API stays the authority: a refusal it sends anyway is explained in the dialog.
		await page.getByRole('button', { name: `Keluarkan ${memberMember.user.name}` }).click();
		await expect(dialog.getByRole('button', { name: 'Batal' })).toBeFocused();
		await dialog.getByRole('button', { name: 'Keluarkan' }).click();
		await expect(dialog.getByRole('alert')).toContainText('harus selalu punya pemilik');
		expect(calls.removeMember).toEqual([memberMember.id]);
	});

	test('accepts an invitation from the email link, token included', async ({ page }) => {
		const { calls } = await mockWorkspaceApi(page, { persona: 'invitee' });
		await page.goto(`/workspace-invitations/${MY_INVITATION.id}?token=dari-email`);

		const card = page.getByTestId('invitation-card');
		await expect(card).toContainText(`Undangan ke ${MY_INVITATION.workspace.name}`);
		await expect(card).toContainText('Rani Putri mengundangmu sebagai anggota');
		await card.getByRole('button', { name: 'Terima undangan' }).click();

		await expect(page).toHaveURL(/\/projects$/);
		expect(calls.accept).toEqual([{ id: MY_INVITATION.id, body: { token: 'dari-email' } }]);
		await expect(switcher(page)).toContainText(TEAM.name);
		await expect(page.getByRole('heading', { name: 'Facility Reporting' })).toBeVisible();
	});

	test('explains an expired invitation from the notifications list', async ({ page }) => {
		await mockWorkspaceApi(page, { persona: 'invitee' });
		await page.goto('/notifications');

		const cards = page.getByTestId('invitation-card');
		await expect(cards).toHaveCount(2);
		const expired = cards.filter({ hasText: 'Tim Lama' });
		await expired.getByRole('button', { name: 'Terima undangan' }).click();
		await expect(expired.getByTestId('invitation-problem')).toContainText(
			'Undangan sudah kedaluwarsa'
		);
	});

	test('a link without a token for someone else’s invitation explains what happened', async ({
		page
	}) => {
		await mockWorkspaceApi(page, { persona: 'invitee' });
		await page.goto('/workspace-invitations/01a1cb4a-ffff-7000-8000-000000000000');
		await expect(page.getByTestId('invitation-unreachable')).toContainText(
			'Undangan tidak ditemukan'
		);
	});

	test('a viewer sees team projects read-only, without secret values or controls', async ({
		page
	}) => {
		await mockWorkspaceApi(page, { persona: 'viewer' });
		await page.goto('/projects');
		await chooseWorkspace(page, TEAM.name);
		await expect(page.getByRole('heading', { name: 'Facility Reporting' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Buat proyek' })).toHaveCount(0);
		await expect(page.getByTestId('viewer-create-note')).toBeVisible();

		await page.goto(`/projects/${PROJECT_ID}/deployments`);
		await expect(page.getByTestId('read-only-notice')).toContainText('Kamu pengamat');
		await expect(page.getByTestId('project-workspace')).toContainText(TEAM.name);
		await expect(page.getByRole('button', { name: /Redeploy|Deploy sekarang/ })).toHaveCount(0);

		await page.goto(`/projects/${PROJECT_ID}/environments`);
		await expect(page.getByText('DATABASE_URL')).toBeVisible();
		await expect(page.getByText('facility', { exact: true })).toBeVisible();
		await expect(page.getByRole('button', { name: /Tampilkan nilai/ })).toHaveCount(0);
		await expect(page.getByRole('button', { name: /^Ubah / })).toHaveCount(0);
		await expect(page.getByRole('button', { name: /^Hapus / })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Tambah variabel' })).toHaveCount(0);

		await page.goto(`/projects/${PROJECT_ID}/settings`);
		await expect(page.getByTestId('settings-read-only')).toContainText('Facility Reporting');
		await expect(page.getByRole('button', { name: 'Simpan perubahan' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Hapus proyek' })).toHaveCount(0);

		await page.goto(teamPage);
		await expect(page.getByTestId('viewer-note')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Undang anggota' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: /^Ubah peran/ })).toHaveCount(0);
	});

	test('creates a project in the active team, with that team’s quota', async ({ page }) => {
		const { calls } = await mockWorkspaceApi(page, { persona: 'owner' });
		await page.goto('/projects');
		await chooseWorkspace(page, TEAM.name);
		await page.getByRole('link', { name: 'Buat proyek' }).click();

		const picker = page.getByLabel('Workspace', { exact: true });
		await expect(picker).toHaveValue(TEAM.id);
		await expect(page.getByText(`Workspace ${TEAM.name} memakai 1 dari 5 proyek`)).toBeVisible();

		await page.getByRole('radio', { name: /rani\/repo-1\b/ }).click();
		await page.getByRole('button', { name: 'Lanjut', exact: true }).click();
		await expect(page.getByRole('heading', { name: 'Persiapan deployment' })).toBeVisible();
		await expect(picker).toHaveValue(TEAM.id);
		await page.getByRole('button', { name: 'Buat proyek' }).click();

		await expect.poll(() => calls.createProject.length).toBe(1);
		expect(calls.createProject[0].workspace_id).toBe(TEAM.id);
	});

	test('a project created in the personal workspace sends no workspace', async ({ page }) => {
		const { calls } = await mockWorkspaceApi(page, { persona: 'owner' });
		await page.goto('/projects/new');

		const picker = page.getByLabel('Workspace', { exact: true });
		await expect(picker).toHaveValue('00000001-personal');
		await page.getByRole('radio', { name: /rani\/repo-1\b/ }).click();
		await page.getByRole('button', { name: 'Lanjut', exact: true }).click();
		await page.getByRole('button', { name: 'Buat proyek' }).click();

		await expect.poll(() => calls.createProject.length).toBe(1);
		expect(calls.createProject[0]).not.toHaveProperty('workspace_id');
	});
});

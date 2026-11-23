import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page, type Route } from '@playwright/test';
import { auditDom } from './fixtures/dom-audit';
import {
	baseProject,
	mockProjectApi,
	personalWorkspace,
	PROJECT_ID,
	succeededDeployment
} from './fixtures/project-detail';

/*
 * Rollback, "Sedang melayani", Pemicu with names, the paused auto-deploy banner, held pushes, and
 * Restart, against the API contract of sakala-api's rollback change. Set ROLLBACK_SCREENS to a
 * directory to keep a screenshot and the rendered HTML of each state there.
 */

const PROJECT_URL = `/projects/${PROJECT_ID}`;
const HISTORY_URL = `${PROJECT_URL}/deployments`;
const SCREENS = process.env.ROLLBACK_SCREENS;

const TEAM = { id: '01a1cb4a-de2f-734f-a44f-293d0157team', name: 'Tim Kopi', slug: 'tim-kopi' };
const TEAM_SUMMARY = { ...TEAM, type: 'team' };

const id = (sequence: number) =>
	`01a0cd92-b2e0-7327-97a1-d688062f30${String(sequence).padStart(2, '0')}`;
const sha = (seed: string) => seed.repeat(40).slice(0, 40);
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const rani = { kind: 'user', name: 'Rani', user_id: 1 };
const bima = { kind: 'github_push', name: 'Bima', user_id: null };

function deployment(sequence: number, overrides: Record<string, unknown> = {}) {
	const created = minutesAgo(200 - sequence * 10);
	return {
		...succeededDeployment,
		id: id(sequence),
		sequence,
		commit_sha: sha(String(sequence)),
		is_active: false,
		created_at: created,
		started_at: created,
		finished_at: new Date(Date.parse(created) + 52_000).toISOString(),
		triggered_by: rani,
		rollback: null,
		rollback_target: null,
		build: {
			mode: 'built',
			image_source_deployment_id: null,
			image_source_sequence: null,
			fallback_reason: null
		},
		...overrides
	};
}

const failedPush = deployment(9, {
	status: 'failed',
	trigger: 'webhook',
	triggered_by: bima,
	commit_message: 'feat(menu): kategori minuman dingin',
	failure: {
		code: 'runtime_build_failed',
		category: 'build',
		summary: 'Build berhenti.',
		recovery_hint: 'Cek log.',
		user_fixable: true,
		detail: null,
		stage: 'building'
	}
});
const servingRollback = deployment(8, {
	trigger: 'rollback',
	is_active: true,
	commit_sha: sha('7'),
	commit_message: 'fix(keranjang): harga promo',
	rollback: { target_deployment_id: id(7), target_sequence: 7 },
	build: {
		mode: 'reused',
		image_source_deployment_id: id(7),
		image_source_sequence: 7,
		fallback_reason: null
	}
});
const keptImage = deployment(7, {
	trigger: 'webhook',
	triggered_by: bima,
	commit_message: 'fix(keranjang): harga promo',
	rollback_target: { image_expected: true }
});
const rebuiltImage = deployment(6, {
	trigger: 'redeploy',
	commit_message: 'feat(beranda): foto menu baru',
	rollback_target: { image_expected: false }
});
const oldManual = deployment(5, {
	trigger: 'manual',
	commit_message: 'chore: deploy pertama',
	rollback_target: { image_expected: false }
});
const history = [failedPush, servingRollback, keptImage, rebuiltImage, oldManual];

const pause = {
	paused_at: minutesAgo(25),
	reason: 'rollback',
	deployment_id: servingRollback.id,
	deployment_sequence: 8,
	held_push_count: 2
};

const ROLLBACK_ID = id(10);
const newRollback = deployment(10, {
	status: 'queued',
	trigger: 'rollback',
	commit_sha: keptImage.commit_sha,
	commit_message: keptImage.commit_message,
	created_at: minutesAgo(0),
	started_at: null,
	finished_at: null,
	rollback: { target_deployment_id: keptImage.id, target_sequence: 7 }
});

type Setup = {
	workspace?: 'personal' | 'team';
	role?: 'owner' | 'member' | 'viewer';
	project?: Record<string, unknown>;
	deployments?: unknown[];
	skippedPushes?: unknown[];
	byId?: Record<string, unknown>;
	rollback?: (target: string, key: string | null) => { status: number; body: unknown };
	restart?: (key: string | null) => { status: number; body: unknown };
};

type Calls = {
	rollback: string[];
	rollbackKeys: (string | null)[];
	restart: number;
	updates: unknown[];
};

function json(route: Route, status: number, body: unknown) {
	return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

const listMeta = (count: number) => ({
	current_page: 1,
	from: count ? 1 : null,
	last_page: 1,
	per_page: 100,
	to: count || null,
	total: count
});

async function open(page: Page, url: string, setup: Setup = {}): Promise<Calls> {
	const calls: Calls = { rollback: [], rollbackKeys: [], restart: 0, updates: [] };
	const team = setup.workspace === 'team';
	let project: Record<string, unknown> = {
		...baseProject,
		active_deployment_id: servingRollback.id,
		auto_deploy: true,
		auto_deploy_pause: null,
		restart: null,
		...(team ? { workspace: TEAM_SUMMARY } : {}),
		...setup.project
	};
	const deployments = setup.deployments ?? history;
	const byId: Record<string, unknown> = {
		...Object.fromEntries(deployments.map((item) => [(item as { id: string }).id, item])),
		[ROLLBACK_ID]: newRollback,
		...setup.byId
	};

	await mockProjectApi(page, {
		project: () => project,
		deploymentList: () => deployments,
		skippedPushes: () => ({
			body: { data: setup.skippedPushes ?? [], meta: listMeta(setup.skippedPushes?.length ?? 0) }
		}),
		updateProject: (body) => {
			calls.updates.push(body);
			project = {
				...project,
				...body,
				...(body.auto_deploy === true ? { auto_deploy_pause: null } : {})
			};
			return { body: { data: project } };
		}
	});
	await page.route(/\/api\/v1\/app\/workspaces(\?.*)?$/, (route) =>
		json(route, 200, {
			data: [
				{ ...personalWorkspace, projects_count: 1, active_deployments_count: 0 },
				...(team
					? [
							{
								...TEAM_SUMMARY,
								role: setup.role ?? 'member',
								limit_profile: null,
								projects_count: 1,
								active_deployments_count: 0,
								created_at: '2026-01-01T00:00:00+00:00'
							}
						]
					: [])
			]
		})
	);
	await page.route('**/api/v1/app/projects/**', (route) => {
		const request = route.request();
		const path = new URL(request.url()).pathname;
		const key = request.headers()['idempotency-key'] ?? null;

		const rollback = path.match(/\/deployments\/([^/]+)\/rollback\/?$/);
		if (rollback && request.method() === 'POST') {
			calls.rollback.push(rollback[1]);
			calls.rollbackKeys.push(key);
			const reply = setup.rollback?.(rollback[1], key) ?? {
				status: 201,
				body: { data: newRollback }
			};
			return json(route, reply.status, reply.body);
		}
		if (/\/restart\/?$/.test(path) && request.method() === 'POST') {
			calls.restart += 1;
			const reply = setup.restart?.(key) ?? {
				status: 202,
				body: {
					data: {
						project_id: PROJECT_ID,
						action: 'restart',
						status: 'active',
						runtime_status: project.runtime_status,
						command: { id: 'cmd-1', type: 'RestartProject', status: 'Pending' },
						wake: null
					}
				}
			};
			if (reply.status === 202) {
				project = { ...project, restart: { requested_at: minutesAgo(0), status: 'pending' } };
			}
			return json(route, reply.status, reply.body);
		}
		const single = path.match(/\/deployments\/([^/]+)\/?$/);
		if (single && request.method() === 'GET' && byId[single[1]]) {
			return json(route, 200, { data: byId[single[1]] });
		}
		return route.fallback();
	});

	await page.goto(url);
	return calls;
}

async function keep(page: Page, name: string) {
	if (!SCREENS) return;
	mkdirSync(SCREENS, { recursive: true });
	const width = page.viewportSize()?.width ?? 0;
	await page.screenshot({ path: join(SCREENS, `${name}-${width}.png`), fullPage: true });
	writeFileSync(join(SCREENS, `${name}-${width}.html`), await page.content());
}

async function expectFloor(page: Page) {
	const width = page.viewportSize()?.width ?? 0;
	const audit = await auditDom(page, 24, width < 768 ? 44 : 24);
	expect.soft(audit.overflow, 'nothing past the viewport').toEqual([]);
	expect.soft(audit.contrast, 'text contrast').toEqual([]);
	expect.soft(audit.targets, 'targets of at least 24 px').toEqual([]);
}

const rows = (page: Page) => page.getByTestId('deployment-row');

for (const width of [1440, 320]) {
	test.describe(`at ${width} px`, () => {
		test.use({ viewport: { width, height: 900 } });

		test('a team history marks the one serving version and names who started each', async ({
			page
		}) => {
			await open(page, HISTORY_URL, { workspace: 'team' });
			await expect(rows(page)).toHaveCount(5);

			await expect(page.getByTestId('deployment-row-serving')).toHaveCount(1);
			await expect(rows(page).nth(1).getByTestId('deployment-row-serving')).toHaveText(
				'Sedang melayani'
			);
			await expect(rows(page).nth(0).getByTestId('deployment-row-trigger')).toHaveText(
				'Bima, push ke main'
			);
			await expect(rows(page).nth(1).getByTestId('deployment-row-trigger')).toHaveText(
				'Rani, rollback ke #7'
			);
			await expect(rows(page).nth(3).getByTestId('deployment-row-trigger')).toHaveText(
				'Rani, redeploy manual'
			);
			await expect(rows(page).nth(4).getByTestId('deployment-row-trigger')).toHaveText(
				'Rani, deploy manual'
			);
			// Only rows the API offers as a target have the menu.
			await expect(page.getByRole('button', { name: /^Pilihan untuk deployment/ })).toHaveCount(3);

			await expectFloor(page);
			await keep(page, 'riwayat-team');
		});

		test('a personal history keeps its rows, but says which one is a rollback', async ({
			page
		}) => {
			await open(page, HISTORY_URL);
			await expect(rows(page)).toHaveCount(5);
			await expect(page.getByTestId('deployment-row-serving')).toHaveCount(1);
			await expect(page.getByTestId('deployment-row-trigger')).toHaveCount(1);
			await expect(rows(page).nth(1).getByTestId('deployment-row-trigger')).toHaveText(
				'Rollback ke #7'
			);
			await expect(page.getByText('Bima', { exact: false })).toHaveCount(0);

			await expectFloor(page);
			await keep(page, 'riwayat-personal');
		});

		test('rolling back to a kept image compares both versions, then opens the new deployment', async ({
			page
		}) => {
			const calls = await open(page, HISTORY_URL);
			await page.getByRole('button', { name: 'Pilihan untuk deployment #7' }).click();
			await page.getByRole('menuitem', { name: 'Kembalikan ke versi ini' }).click();

			const dialog = page.getByRole('dialog', { name: 'Kembalikan ke deployment #7?' });
			await expect(dialog).toBeVisible();
			await expect(dialog.getByTestId('rollback-current')).toContainText('#8');
			await expect(dialog.getByTestId('rollback-current')).toContainText('7777777');
			await expect(dialog.getByTestId('rollback-target')).toContainText('#7');
			await expect(dialog.getByTestId('rollback-target')).toContainText(
				'fix(keranjang): harga promo'
			);
			await expect(dialog).toContainText('Environment variable tetap yang sekarang');
			await expect(dialog).toContainText(
				'Image versi ini masih tersimpan, jadi tidak perlu build.'
			);
			await expect(dialog).toContainText('Auto-deploy dijeda sampai dinyalakan lagi');
			await expectFloor(page);
			await keep(page, 'rollback-dialog-kept');

			await dialog.getByRole('button', { name: 'Kembalikan ke #7' }).click();
			await expect(page).toHaveURL(`${HISTORY_URL}/${ROLLBACK_ID}`);
			expect(calls.rollback).toEqual([keptImage.id]);
			expect(calls.rollbackKeys[0]).toBeTruthy();
			await expect(page.getByText('Rollback ke #7 dimulai.')).toBeVisible();
		});

		test('rolling back to a pruned image says the commit is built again', async ({ page }) => {
			await open(page, HISTORY_URL, { project: { auto_deploy: false } });
			await page.getByRole('button', { name: 'Pilihan untuk deployment #6' }).click();
			await page.getByRole('menuitem', { name: 'Kembalikan ke versi ini' }).click();

			const dialog = page.getByRole('dialog', { name: 'Kembalikan ke deployment #6?' });
			await expect(dialog).toContainText(
				'Image versi ini sudah tidak tersimpan, jadi Sakala akan build ulang commit ini (lebih lama).'
			);
			// Auto-deploy was off, so nothing is paused.
			await expect(dialog).not.toContainText('Auto-deploy dijeda');
			await expectFloor(page);
			await keep(page, 'rollback-dialog-rebuild');
		});

		test('the paused banner says what happened and turns auto-deploy back on', async ({ page }) => {
			const calls = await open(page, PROJECT_URL, {
				project: { auto_deploy: false, auto_deploy_pause: pause }
			});
			const banner = page.getByTestId('auto-deploy-paused-banner');
			await expect(banner).toContainText('Auto-deploy dijeda setelah rollback ke #7');
			await expect(banner).toContainText('Push ke main dicatat di Riwayat');
			await expect(banner.getByTestId('auto-deploy-held-count')).toHaveText(
				'2 push sudah ditahan.'
			);
			await expect(page.getByRole('button', { name: 'Redeploy commit terbaru' })).toBeVisible();
			await expectFloor(page);
			await keep(page, 'paused-banner-owner');

			await banner.getByRole('button', { name: 'Nyalakan lagi auto-deploy' }).click();
			await expect(banner).toHaveCount(0);
			expect(calls.updates).toEqual([{ auto_deploy: true }]);
			await expect(page.getByRole('button', { name: 'Redeploy', exact: true })).toBeVisible();
		});

		test('a viewer reads the banner and who can turn it on, without the button', async ({
			page
		}) => {
			await open(page, PROJECT_URL, {
				workspace: 'team',
				role: 'viewer',
				project: { auto_deploy: false, auto_deploy_pause: pause }
			});
			// The role arrives with the workspace list; until then nothing is offered either way.
			await expect(page.getByTestId('read-only-notice')).toBeVisible();
			const banner = page.getByTestId('auto-deploy-paused-banner');
			await expect(banner).toContainText(
				'Pemilik atau anggota workspace Tim Kopi bisa menyalakannya lagi.'
			);
			await expect(banner.getByRole('button')).toHaveCount(0);
			await expectFloor(page);
			await keep(page, 'paused-banner-viewer');

			await page.goto(HISTORY_URL);
			await expect(page.getByTestId('read-only-notice')).toBeVisible();
			await expect(rows(page)).toHaveCount(5);
			await expect(page.getByRole('button', { name: /^Pilihan untuk deployment/ })).toHaveCount(0);
		});

		test('a push held while paused is recorded in the history, and explained', async ({ page }) => {
			await open(page, HISTORY_URL, {
				project: { auto_deploy: false, auto_deploy_pause: pause },
				skippedPushes: [
					{
						delivery_id: '6f1c2a3e-58cc-4372-a567-0e02b2c3d479',
						reason: 'auto_deploy_paused',
						commit_sha: sha('c'),
						commit_message: 'feat(menu): kategori minuman dingin, versi 2',
						branch: 'main',
						root_directory: '',
						changed_path_count: 2,
						example_paths: ['src/routes/menu/+page.svelte', 'src/lib/menu.ts'],
						after_deployment_id: failedPush.id,
						created_at: minutesAgo(5)
					}
				]
			});
			const held = page.getByTestId('skipped-push-row');
			await expect(held).toContainText('Ditahan — auto-deploy sedang dijeda');
			await held.getByRole('button', { name: 'Kenapa push ini tidak di-deploy?' }).click();
			const detail = page.getByTestId('skipped-push-detail');
			await expect(detail).toContainText('auto-deploy sedang dijeda setelah rollback');
			await expect(detail).toContainText('2 file berubah:');
			await expect(detail).not.toContainText('folder proyek lain');
			await expectFloor(page);
			await keep(page, 'held-push');
		});

		test('Restart asks first, then says it was requested and shows it waiting', async ({
			page
		}) => {
			const calls = await open(page, PROJECT_URL);
			await page.getByRole('button', { name: 'Pilihan build dan restart' }).click();
			await page.getByRole('menuitem', { name: 'Restart' }).click();

			const dialog = page.getByRole('dialog', { name: 'Restart aplikasi?' });
			await expect(dialog).toContainText(
				'Menyalakan ulang container tanpa build ulang. Kode dan variabel tidak berubah.'
			);
			await expectFloor(page);
			await keep(page, 'restart-dialog');

			await dialog.getByRole('button', { name: 'Restart' }).click();
			await expect(dialog).toHaveCount(0);
			expect(calls.restart).toBe(1);
			await expect(page.getByText('Restart diminta.')).toBeVisible();
			await expect(page.getByTestId('project-restart-pending')).toHaveText('Sedang restart');
		});

		test('a rollback deployment says where it went back to, and why it built', async ({ page }) => {
			const fellBack = deployment(10, {
				trigger: 'rollback',
				status: 'succeeded',
				commit_sha: rebuiltImage.commit_sha,
				commit_message: rebuiltImage.commit_message,
				rollback: { target_deployment_id: rebuiltImage.id, target_sequence: 6 },
				build: {
					mode: 'built',
					image_source_deployment_id: rebuiltImage.id,
					image_source_sequence: 6,
					fallback_reason: 'image_missing'
				}
			});
			await open(page, `${HISTORY_URL}/${ROLLBACK_ID}`, {
				workspace: 'team',
				byId: { [ROLLBACK_ID]: fellBack }
			});
			await expect(page.getByTestId('deployment-rollback-of')).toHaveText(/Rollback ke\s+#6/);
			await expect(
				page.getByTestId('deployment-rollback-of').getByRole('link', { name: '#6' })
			).toHaveAttribute('href', `${HISTORY_URL}/${rebuiltImage.id}`);
			if (width < 1024) await page.getByRole('button', { name: /Tahapan/ }).click();
			await expect(page.getByTestId('deployment-trigger')).toContainText('Rani, rollback ke #6');
			await expect(page.getByTestId('image-fallback-note')).toHaveText(
				'Image #6 sudah tidak ada di server, jadi Sakala build ulang commit ini.'
			);
			await expectFloor(page);
			await keep(page, 'rollback-detail');
		});
	});
}

test('a project that never went live has no serving version', async ({ page }) => {
	await open(page, HISTORY_URL, {
		project: { runtime_status: 'failed', active_deployment_id: null, status: 'draft' },
		deployments: [deployment(2, { status: 'failed' }), deployment(1, { status: 'failed' })]
	});
	await expect(rows(page)).toHaveCount(2);
	await expect(page.getByTestId('deployment-row-serving')).toHaveCount(0);
});

test('a queued rollback waiting for the project analysis says both', async ({ page }) => {
	const waiting = deployment(10, {
		status: 'queued',
		trigger: 'rollback',
		queue_state: 'waiting_for_inspection',
		started_at: null,
		finished_at: null,
		commit_sha: keptImage.commit_sha,
		commit_message: keptImage.commit_message,
		rollback: { target_deployment_id: keptImage.id, target_sequence: 7 }
	});
	await open(page, HISTORY_URL, { deployments: [waiting, ...history] });
	const row = rows(page).first();
	await expect(row.getByTestId('deployment-row-trigger')).toHaveText('Rollback ke #7');
	await expect(row).toContainText('Menunggu analisis proyek');
	await expect(row.getByTestId('deployment-row-serving')).toHaveCount(0);
	// The version that still serves keeps its mark while the rollback waits.
	await expect(page.getByTestId('deployment-row-serving')).toHaveCount(1);
	// Restart waits too: the Redeploy menu is busy while a deployment is open.
	await expect(page.getByRole('button', { name: 'Pilihan build dan restart' })).toBeDisabled();
});

test('a crashed project marks no version as serving', async ({ page }) => {
	await open(page, HISTORY_URL, { project: { runtime_status: 'crashed' } });
	await expect(rows(page)).toHaveCount(5);
	await expect(page.getByTestId('deployment-row-serving')).toHaveCount(0);
});

test('Ringkasan marks the serving version and names who started each in a team', async ({
	page
}) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await open(page, PROJECT_URL, { workspace: 'team' });
	const card = page.getByTestId('overview-deployments');
	await expect(card.getByTestId('overview-deployment-serving')).toHaveCount(1);
	await expect(
		card.getByTestId('overview-deployment-row').nth(1).getByTestId('overview-deployment-serving')
	).toBeVisible();
	await expect(card.getByTestId('overview-deployment-trigger').first()).toHaveText(
		'Bima, push ke main'
	);
});

test('a refused rollback says why in the dialog and reloads the history', async ({ page }) => {
	let listReads = 0;
	page.on('request', (request) => {
		if (/\/deployments\?/.test(request.url()) && request.method() === 'GET') listReads += 1;
	});
	const calls = await open(page, HISTORY_URL, {
		rollback: () => ({
			status: 409,
			body: {
				message: 'This deployment cannot be rolled back to.',
				code: 'DEPLOYMENT_NOT_ROLLBACK_TARGET',
				reason: 'branch_changed'
			}
		})
	});
	await page.getByRole('button', { name: 'Pilihan untuk deployment #7' }).click();
	await page.getByRole('menuitem', { name: 'Kembalikan ke versi ini' }).click();
	const dialog = page.getByRole('dialog', { name: 'Kembalikan ke deployment #7?' });
	const before = listReads;
	await dialog.getByRole('button', { name: 'Kembalikan ke #7' }).click();

	await expect(dialog.getByRole('alert')).toHaveText(
		'Deployment #7 dari branch lain. Rollback hanya ke deployment dari branch yang dipakai proyek sekarang.'
	);
	await expect(page).toHaveURL(HISTORY_URL);
	await expect.poll(() => listReads).toBeGreaterThan(before);
	expect(calls.rollback).toHaveLength(1);
});

test('a busy project refuses Restart with a reason, by code', async ({ page }) => {
	await open(page, PROJECT_URL, {
		restart: () => ({
			status: 409,
			body: { message: 'Busy.', code: 'PROJECT_RUNTIME_BUSY' }
		})
	});
	await page.getByRole('button', { name: 'Pilihan build dan restart' }).click();
	await page.getByRole('menuitem', { name: 'Restart' }).click();
	const dialog = page.getByRole('dialog', { name: 'Restart aplikasi?' });
	await dialog.getByRole('button', { name: 'Restart' }).click();
	await expect(dialog.getByRole('alert')).toHaveText(
		'Deployment atau restart lain masih berjalan. Tunggu sampai selesai, lalu coba lagi.'
	);
});

test('a sleeping project offers no Restart', async ({ page }) => {
	await open(page, PROJECT_URL, { project: { runtime_status: 'sleeping' } });
	await page.getByRole('button', { name: 'Pilihan cara build' }).click();
	await expect(page.getByRole('menuitem', { name: 'Build ulang dari awal' })).toBeVisible();
	await expect(page.getByRole('menuitem', { name: /Restart/ })).toHaveCount(0);
});

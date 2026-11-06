import { expect, test, type Locator, type Page } from '@playwright/test';
import {
	baseProject,
	cancelledDeployment,
	DEPLOYMENT_ID,
	DETAIL_URL,
	failedDeployment,
	failedWithoutDetails,
	logLine,
	logPage,
	mockProjectApi,
	NEW_DEPLOYMENT_ID,
	platformFailureDeployment,
	PROJECT_ID,
	queuedDeployment,
	runningDeployment,
	succeededDeployment,
	unknownFailureDeployment
} from './fixtures/project-detail';

const ENV_URL = `/projects/${PROJECT_ID}/environments`;
const SETTINGS_URL = `/projects/${PROJECT_ID}/settings`;

const envVars = [
	{ id: 1, key: 'DATABASE_URL', is_secret: true, created_at: '2026-01-01T00:00:00Z' },
	{ id: 2, key: 'APP_ENV', is_secret: true, created_at: '2026-01-01T00:00:00Z' }
];

/** True when the element's centre is what a mouse would actually hit. */
async function isClickable(page: Page, name: string) {
	return page.getByRole('button', { name, exact: true }).evaluate((element) => {
		const box = element.getBoundingClientRect();
		const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
		return Boolean(hit && (hit === element || element.contains(hit)));
	});
}

async function pageOverflowsHorizontally(page: Page) {
	return page.locator('main').evaluate((main) => main.scrollWidth > main.clientWidth);
}

async function isScrolledToEnd(log: Locator) {
	return log.evaluate(
		(element) => element.scrollHeight - element.scrollTop - element.clientHeight <= 1
	);
}

test.describe('log panel (U-02, #10)', () => {
	test('renders API history as plain text with stream labels, then picks up polled lines', async ({
		page
	}) => {
		let polled = false;
		await mockProjectApi(page, {
			deployment: () => runningDeployment,
			logs: () => ({
				body: logPage(
					polled
						? [
								logLine(1, '\u001B[32mCloning repository\u001B[0m'),
								logLine(2, 'npm warn deprecated', 'stderr'),
								logLine(3, '<img src=x onerror="window.__xss=1">'),
								logLine(4, 'Build selesai')
							]
						: [
								logLine(1, '\u001B[32mCloning repository\u001B[0m'),
								logLine(2, 'npm warn deprecated', 'stderr'),
								logLine(3, '<img src=x onerror="window.__xss=1">')
							]
				)
			})
		});

		await page.goto(DETAIL_URL);

		const log = page.getByRole('log', { name: 'Logs' });
		await expect(log).toBeVisible();
		await expect(log.getByText('Cloning repository')).toBeVisible();
		await expect(log).not.toContainText('\u001B');
		await expect(log.getByText('stderr', { exact: true })).toBeVisible();
		await expect(log.getByText('<img src=x onerror="window.__xss=1">')).toBeVisible();
		await expect(log.locator('img')).toHaveCount(0);
		await expect(page.getByText('Log deployment akan tersedia')).toHaveCount(0);

		polled = true;
		await expect(log.getByText('Build selesai')).toBeVisible({ timeout: 15_000 });
		await expect(log.getByText('Cloning repository')).toHaveCount(1);
		expect(await page.evaluate(() => (window as { __xss?: number }).__xss)).toBeUndefined();
	});

	test('asks for the newest lines first, and loads older ones on request', async ({ page }) => {
		const requests: URL[] = [];
		await mockProjectApi(page, {
			deployment: () => failedDeployment,
			logs: (url) => {
				requests.push(url);
				return url.searchParams.get('cursor')
					? { body: logPage([logLine(5, 'baris lama')]) }
					: {
							body: logPage(
								[logLine(201, 'npm ERR! build gagal', 'stderr'), logLine(200, 'baris 200')],
								{ next: 'c2' }
							)
						};
			}
		});

		await page.goto(DETAIL_URL);

		const log = page.getByRole('log');
		await expect(log.getByText('npm ERR! build gagal')).toBeVisible();
		await expect.poll(() => isScrolledToEnd(log)).toBe(true);
		expect(requests[0].searchParams.get('order')).toBe('desc');
		expect(requests[0].searchParams.get('per_page')).toBe('200');
		expect(requests).toHaveLength(1);

		await page.getByRole('button', { name: 'Muat log sebelumnya' }).click();

		await expect(log.getByText('baris lama')).toBeAttached();
		await expect(log.getByText('npm ERR! build gagal')).toBeAttached();
	});

	test('says it is waiting while a running deployment has no lines', async ({ page }) => {
		await mockProjectApi(page, { deployment: () => runningDeployment });

		await page.goto(DETAIL_URL);

		await expect(page.getByText('Menunggu log...')).toBeVisible();
	});

	test('says no log was recorded for a recently finished deployment', async ({ page }) => {
		await mockProjectApi(page, { deployment: () => succeededDeployment });

		await page.goto(DETAIL_URL);

		await expect(page.getByText('Tidak ada log untuk deployment ini')).toBeVisible();
		await expect(page.getByText('Menunggu log...')).toHaveCount(0);
	});

	test('explains retention when an old deployment has no lines left', async ({ page }) => {
		await mockProjectApi(page, {
			deployment: () => ({ ...succeededDeployment, finished_at: '2026-01-01T00:00:00Z' })
		});

		await page.goto(DETAIL_URL);

		await expect(page.getByText('Log sudah dihapus')).toBeVisible();
		await expect(page.getByText(/menyimpan log selama 7 hari/)).toBeVisible();
	});

	test('shows an error with a retry that recovers', async ({ page }) => {
		let failing = true;
		await mockProjectApi(page, {
			deployment: () => succeededDeployment,
			logs: () =>
				failing
					? { status: 500, body: { message: 'SQLSTATE[HY000] rahasia internal' } }
					: { body: logPage([logLine(1, 'pulih')]) }
		});

		await page.goto(DETAIL_URL);

		await expect(page.getByText('Server gagal mengirim log.')).toBeVisible({ timeout: 15_000 });
		await expect(page.getByText('rahasia internal')).toHaveCount(0);

		failing = false;
		await page.getByRole('button', { name: 'Coba lagi' }).click();

		await expect(page.getByRole('log').getByText('pulih')).toBeVisible();
	});

	test('does not offer retry when access is refused', async ({ page }) => {
		await mockProjectApi(page, {
			deployment: () => succeededDeployment,
			logs: () => ({ status: 403, body: { message: 'This action is unauthorized.' } })
		});

		await page.goto(DETAIL_URL);

		await expect(page.getByText('Kamu tidak memiliki akses untuk melihat log')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Coba lagi' })).toHaveCount(0);
	});

	test('pause keeps the position, shows a new-lines indicator, and follow returns to the end', async ({
		page
	}) => {
		let lineCount = 8;
		await mockProjectApi(page, {
			deployment: () => runningDeployment,
			logs: () => ({
				body: logPage(
					Array.from({ length: lineCount }, (_, index) =>
						logLine(index + 1, `baris ${index + 1}\n${'keluaran panjang\n'.repeat(4)}`)
					)
				)
			})
		});

		await page.setViewportSize({ width: 1280, height: 600 });
		await page.goto(DETAIL_URL);

		const log = page.getByRole('log');
		await expect(log.getByText(/^baris 8/)).toBeAttached();

		await page.getByRole('button', { name: 'Jeda' }).click();
		const top = await log.evaluate((element) => element.scrollTop);

		lineCount = 9;
		const indicator = page.getByRole('button', { name: '1 baris baru, ke log terbaru' });
		await expect(indicator).toBeVisible({ timeout: 15_000 });
		expect(await log.evaluate((element) => element.scrollTop)).toBe(top);

		await page.getByRole('button', { name: 'Ikuti log' }).click();

		await expect(indicator).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Jeda' })).toBeVisible();
		await expect.poll(() => isScrolledToEnd(log)).toBe(true);
	});

	test('can be scrolled and controlled from the keyboard', async ({ page }) => {
		await mockProjectApi(page, {
			deployment: () => succeededDeployment,
			logs: () => ({
				body: logPage(
					Array.from({ length: 9 }, (_, index) =>
						logLine(index + 1, `baris ${index + 1}\n${'keluaran panjang\n'.repeat(6)}`)
					)
				)
			})
		});

		await page.setViewportSize({ width: 1280, height: 600 });
		await page.goto(DETAIL_URL);

		const log = page.getByRole('log');
		await expect(log.getByText(/^baris 9/)).toBeAttached();

		await log.focus();
		await expect(log).toBeFocused();
		const outlineStyle = await log.evaluate((element) => getComputedStyle(element).outlineStyle);
		expect(outlineStyle).not.toBe('none');

		await page.keyboard.press('Home');
		// Chromium animates keyboard scrolling, so wait for it to land.
		await expect.poll(() => log.evaluate((element) => element.scrollTop)).toBe(0);
		await expect(page.getByRole('button', { name: 'Ke log terbaru' })).toBeVisible();

		await page.getByRole('button', { name: 'Ke log terbaru' }).focus();
		await page.keyboard.press('Enter');
		await expect.poll(() => isScrolledToEnd(log)).toBe(true);
	});

	test('copy reports the result and contains only log text', async ({ page, context }) => {
		await context.grantPermissions(['clipboard-read', 'clipboard-write']);
		await mockProjectApi(page, {
			deployment: () => succeededDeployment,
			logs: () => ({ body: logPage([logLine(1, 'satu'), logLine(2, 'dua', 'stderr')]) })
		});

		await page.goto(DETAIL_URL);
		await expect(page.getByRole('log').getByText('dua')).toBeVisible();

		await page.getByRole('button', { name: 'Salin log' }).click();

		await expect(page.getByText('2 baris tersalin')).toBeVisible();
		const copied = await page.evaluate(() => navigator.clipboard.readText());
		expect(copied).toMatch(/^\[\d{2}:\d{2}:\d{2}\] satu\n\[\d{2}:\d{2}:\d{2}\] stderr dua$/);
		expect(copied).not.toMatch(/Salin|Jeda|terbaru/);
	});

	test('fits a 320 px screen without sideways scrolling', async ({ page }) => {
		await mockProjectApi(page, {
			deployment: () => failedDeployment,
			logs: () => ({ body: logPage([logLine(1, 'x'.repeat(600))]) })
		});

		await page.setViewportSize({ width: 320, height: 800 });
		await page.goto(DETAIL_URL);

		await expect(page.getByRole('log').getByText('xxxx')).toBeVisible();
		expect(await pageOverflowsHorizontally(page)).toBe(false);
	});
});

test.describe('failure banner (U-24, U-27, #13)', () => {
	test('headline names the category and the summary comes from the API', async ({ page }) => {
		await mockProjectApi(page, { deployment: () => failedDeployment });

		await page.goto(DETAIL_URL);

		await expect(page.getByRole('heading', { name: 'Deployment gagal saat build' })).toBeVisible();
		await expect(page.getByText(failedDeployment.failure.summary)).toBeVisible();
		await expect(page.getByText(/Cara memperbaiki/)).toBeVisible();
	});

	test('shows failure.detail as its own block, and the stage from failure.stage (U-21)', async ({
		page
	}) => {
		await mockProjectApi(page, { deployment: () => failedDeployment });

		await page.goto(DETAIL_URL);

		await expect(page.locator('pre', { hasText: 'npm ERR! code ELIFECYCLE' })).toBeVisible();
		await expect(page.getByText(/Berhenti di tahap Build proyek/)).toBeVisible();
	});

	test('a platform failure does not blame the user, and its hint comes from the API', async ({
		page
	}) => {
		await mockProjectApi(page, { deployment: () => platformFailureDeployment });

		await page.goto(DETAIL_URL);

		await expect(page.getByText(/kendala di sisi platform Sakala/)).toBeVisible();
		await expect(page.getByText(/Cara memperbaiki/)).toHaveCount(0);
		await expect(page.getByText(/Yang bisa kamu lakukan:/)).toBeVisible();
		await expect(page.getByText(platformFailureDeployment.failure.recovery_hint)).toBeVisible();
	});

	test('a cancelled deployment is not called a failure, and can be redeployed', async ({
		page
	}) => {
		await mockProjectApi(page, { deployment: () => cancelledDeployment });

		await page.goto(DETAIL_URL);

		await expect(page.getByRole('heading', { name: 'Deployment dibatalkan' })).toBeVisible();
		await expect(page.getByText(/gagal/i)).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Lihat detail error' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Redeploy' })).toBeVisible();
	});

	test('an unknown failure stays honest and points to the logs', async ({ page }) => {
		await mockProjectApi(page, { deployment: () => unknownFailureDeployment });

		await page.goto(DETAIL_URL);

		await expect(
			page.getByRole('heading', { name: 'Deployment gagal', exact: true })
		).toBeVisible();
		await expect(page.getByText(unknownFailureDeployment.failure.summary)).toBeVisible();
		await expect(page.getByText(/lihat log di bawah/i)).toBeVisible();
	});

	test('a failure without summary points to the logs', async ({ page }) => {
		await mockProjectApi(page, { deployment: () => failedWithoutDetails });

		await page.goto(DETAIL_URL);

		await expect(
			page.getByRole('heading', { name: 'Deployment gagal', exact: true })
		).toBeVisible();
		await expect(page.locator('#failure-summary')).toHaveCount(0);
		await expect(page.getByText(/lihat log di bawah/i)).toBeVisible();
	});

	test('"Lihat detail error" focuses the failure summary when there is one', async ({ page }) => {
		await mockProjectApi(page, { deployment: () => failedDeployment });
		await page.goto(DETAIL_URL);

		await page.getByRole('button', { name: 'Lihat detail error' }).click();

		await expect(page.locator('#failure-summary')).toBeFocused();
		await expect(page.locator('#failure-summary')).toBeInViewport();
	});

	test('"Lihat detail error" falls back to the log panel when details are missing', async ({
		page
	}) => {
		await mockProjectApi(page, {
			deployment: () => failedWithoutDetails,
			logs: () => ({ body: logPage([logLine(1, 'npm ERR! build')]) })
		});

		await page.setViewportSize({ width: 1280, height: 500 });
		await page.goto(DETAIL_URL);

		await page.getByRole('button', { name: 'Lihat detail error' }).click();

		await expect(page.locator('#deployment-logs')).toBeFocused();
		await expect(page.getByRole('log').getByText('npm ERR! build')).toBeInViewport();
	});

	test.describe('with reduced motion', () => {
		test('"Lihat detail error" jumps without animating', async ({ page }) => {
			await page.emulateMedia({ reducedMotion: 'reduce' });
			await mockProjectApi(page, { deployment: () => failedWithoutDetails });
			await page.setViewportSize({ width: 1280, height: 500 });
			await page.goto(DETAIL_URL);

			const behavior = await page.evaluate(() => {
				const calls: (ScrollBehavior | undefined)[] = [];
				const original = Element.prototype.scrollIntoView;
				Element.prototype.scrollIntoView = function (options) {
					calls.push((options as ScrollIntoViewOptions).behavior);
					original.call(this, options);
				};
				(window as unknown as { __scrollCalls: typeof calls }).__scrollCalls = calls;
				return true;
			});
			expect(behavior).toBe(true);

			await page.getByRole('button', { name: 'Lihat detail error' }).click();

			await expect(page.locator('#deployment-logs')).toBeFocused();
			expect(
				await page.evaluate(() => (window as unknown as { __scrollCalls: string[] }).__scrollCalls)
			).toEqual(['auto']);
		});
	});

	test('Redeploy goes to the new deployment and blocks a double click', async ({ page }) => {
		let posts = 0;
		let postedBranch: unknown;
		await mockProjectApi(page, {
			project: () => ({ ...baseProject, branch: 'develop' }),
			deployment: () => failedDeployment,
			redeploy: () => {
				posts += 1;
				return {
					status: 201,
					body: { data: { ...runningDeployment, id: NEW_DEPLOYMENT_ID } }
				};
			}
		});
		page.on('request', (request) => {
			if (request.method() === 'POST' && request.url().endsWith('/deployments')) {
				postedBranch = request.postDataJSON().branch;
			}
		});

		await page.goto(DETAIL_URL);
		const redeploy = page.getByRole('button', { name: 'Redeploy' });
		await expect(redeploy).toBeEnabled();

		await redeploy.dblclick();

		await expect(page).toHaveURL(new RegExp(`/deployments/${NEW_DEPLOYMENT_ID}$`));
		expect(posts).toBe(1);
		expect(postedBranch).toBe('develop');
	});

	test('Redeploy shows a coded quota refusal in the banner (U-28)', async ({ page }) => {
		await mockProjectApi(page, {
			deployment: () => failedDeployment,
			redeploy: () => ({
				status: 422,
				body: {
					message: 'Kuota deployment aktif habis. Tunggu deployment lain selesai.',
					code: 'ACTIVE_DEPLOYMENT_LIMIT_EXCEEDED'
				}
			})
		});

		await page.goto(DETAIL_URL);
		await page.getByRole('button', { name: 'Redeploy' }).click();

		await expect(page.getByRole('alert')).toContainText('Kuota deployment aktif habis');
		await expect(page).toHaveURL(new RegExp(`/deployments/${DEPLOYMENT_ID}$`));
		await expect(page.getByRole('button', { name: 'Redeploy' })).toBeEnabled();
	});
});

test.describe('deployment detail (U-20, U-22, U-51, U-63)', () => {
	test('says "sudah live" and links the site only for the active deployment', async ({ page }) => {
		await mockProjectApi(page, { deployment: () => succeededDeployment });

		await page.goto(DETAIL_URL);

		await expect(page.getByText(/perubahan sudah live/)).toBeVisible();
		await expect(page.getByRole('link', { name: 'Kunjungi situs' })).toBeVisible();
	});

	test('a superseded deployment makes no live claim', async ({ page }) => {
		await mockProjectApi(page, {
			deployment: () => ({ ...succeededDeployment, is_active: false })
		});

		await page.goto(DETAIL_URL);

		await expect(page.getByText(/digantikan oleh deployment yang lebih baru/)).toBeVisible();
		await expect(page.getByText(/sudah live/)).toHaveCount(0);
		await expect(page.getByRole('link', { name: 'Kunjungi situs' })).toHaveCount(0);
	});

	test('the active deployment of a stopped project makes no live claim', async ({ page }) => {
		await mockProjectApi(page, {
			project: () => ({ ...baseProject, runtime_status: 'stopped' }),
			deployment: () => succeededDeployment
		});

		await page.goto(DETAIL_URL);

		await expect(page.getByText(/sedang tidak melayani/)).toBeVisible();
		await expect(page.getByText(/sudah live/)).toHaveCount(0);
	});

	test('explains a queue with no node, and promises no time', async ({ page }) => {
		await mockProjectApi(page, { deployment: () => queuedDeployment });

		await page.goto(DETAIL_URL);

		await expect(page.getByRole('heading', { name: 'Deployment mengantre' })).toBeVisible();
		await expect(page.getByText(/Belum ada server Sakala yang siap/)).toBeVisible();
	});

	test('cancel asks first, then posts once and shows the result', async ({ page }) => {
		let posts = 0;
		let cancelled = false;
		await mockProjectApi(page, {
			deployment: () => (cancelled ? cancelledDeployment : runningDeployment),
			cancel: () => {
				posts += 1;
				cancelled = true;
				return { status: 200, body: { data: cancelledDeployment } };
			}
		});

		await page.goto(DETAIL_URL);
		await page.getByRole('button', { name: 'Batalkan deployment' }).click();

		const dialog = page.getByRole('alertdialog').or(page.getByRole('dialog'));
		await expect(dialog).toContainText('Batalkan Deployment #3?');
		await expect(dialog.getByRole('button', { name: 'Tidak jadi' })).toBeFocused();
		expect(posts).toBe(0);

		await dialog.getByRole('button', { name: 'Ya, batalkan' }).click();

		await expect(page.getByRole('heading', { name: 'Deployment dibatalkan' })).toBeVisible();
		await expect(dialog).toHaveCount(0);
		expect(posts).toBe(1);
	});

	test('a cancel that still needs its node says so and stops offering the button', async ({
		page
	}) => {
		const requested = { ...runningDeployment, cancel_requested_at: '2026-09-20T08:42:00Z' };
		let asked = false;
		await mockProjectApi(page, {
			deployment: () => (asked ? requested : runningDeployment),
			cancel: () => {
				asked = true;
				return { status: 202, body: { data: requested } };
			}
		});

		await page.goto(DETAIL_URL);
		await page.getByRole('button', { name: 'Batalkan deployment' }).click();
		await page.getByRole('button', { name: 'Ya, batalkan' }).click();

		await expect(page.getByRole('heading', { name: 'Deployment sedang dibatalkan' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Batalkan deployment' })).toHaveCount(0);
	});

	test('a cancel that lost the race shows the API message', async ({ page }) => {
		await mockProjectApi(page, {
			deployment: () => runningDeployment,
			cancel: () => ({
				status: 409,
				body: { message: 'Deployment ini sudah selesai.', code: 'DEPLOYMENT_ALREADY_FINISHED' }
			})
		});

		await page.goto(DETAIL_URL);
		await page.getByRole('button', { name: 'Batalkan deployment' }).click();
		await page.getByRole('button', { name: 'Ya, batalkan' }).click();

		await expect(page.getByRole('alert')).toContainText('Deployment ini sudah selesai.');
	});

	test('names the deployment and links back to the history', async ({ page }) => {
		await mockProjectApi(page, { deployment: () => succeededDeployment });

		await page.goto(DETAIL_URL);

		const trail = page.getByRole('navigation', { name: 'Breadcrumb' });
		await expect(trail.getByText('Deployment #3')).toHaveAttribute('aria-current', 'page');
		await trail.getByRole('link', { name: 'Riwayat Deployment' }).click();
		await expect(page).toHaveURL(new RegExp(`/projects/${PROJECT_ID}/deployments$`));
	});

	test('a suspended project offers no Redeploy, and says why', async ({ page }) => {
		await mockProjectApi(page, {
			project: () => ({ ...baseProject, status: 'suspended' }),
			deployment: () => failedDeployment
		});

		await page.goto(DETAIL_URL);

		await expect(page.getByText(/ditangguhkan oleh admin/)).toBeVisible();
		await expect(page.getByRole('button', { name: 'Redeploy' })).toHaveCount(0);
	});

	test('Redeploy waits while another deployment runs, and says so', async ({ page }) => {
		await mockProjectApi(page, {
			deployment: () => failedDeployment,
			deploymentList: () => [
				{ ...failedDeployment, sequence: 3 },
				{ ...runningDeployment, id: NEW_DEPLOYMENT_ID, sequence: 4 }
			]
		});

		await page.goto(DETAIL_URL);

		await expect(page.getByText(/Deployment lain sedang berjalan/)).toBeVisible();
		await expect(page.getByRole('button', { name: 'Redeploy' })).toBeDisabled();
	});

	test('admits it has no stage record instead of drawing an empty timeline (U-21)', async ({
		page
	}) => {
		await mockProjectApi(page, { deployment: () => failedWithoutDetails, events: () => [] });

		await page.goto(DETAIL_URL);

		await expect(page.getByText(/Tahapan deployment ini tidak tercatat/)).toBeVisible();
		await expect(page.getByText(/tahap -/)).toHaveCount(0);
	});
});

test.describe('project header states (U-13 to U-18, U-26)', () => {
	const projectsUrl = `/projects/${PROJECT_ID}/deployments`;
	const url = baseProject.default_domain;

	test('not deployed: first deploy, no URL, no Draft', async ({ page }) => {
		await mockProjectApi(page, {
			project: () => ({
				...baseProject,
				status: 'draft',
				runtime_status: 'not_deployed',
				active_deployment_id: null,
				last_deployed_at: null
			})
		});

		await page.goto(projectsUrl);

		await expect(page.getByText('Belum Deploy').first()).toBeVisible();
		await expect(page.getByText('Draft')).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Deploy sekarang' })).toBeEnabled();
		await expect(page.getByText(url)).toHaveCount(0);
	});

	test('deploying on a live version: no second click, progress link, URL stays', async ({
		page
	}) => {
		await mockProjectApi(page, {
			project: () => ({ ...baseProject, runtime_status: 'deploying' }),
			deploymentList: () => [{ ...runningDeployment, sequence: 4 }]
		});

		await page.goto(projectsUrl);

		await expect(page.getByRole('button', { name: 'Sedang mendeploy' })).toBeDisabled();
		await expect(page.getByText(/Deployment #4 sedang berjalan/)).toBeVisible();
		await expect(page.getByText(/Versi sebelumnya masih melayani/)).toBeVisible();
		await expect(page.getByRole('link', { name: 'Lihat progres' })).toHaveAttribute(
			'href',
			DETAIL_URL
		);
		await expect(page.getByText(url)).toBeVisible();
	});

	test('a queued first deployment reads as deploying, though runtime_status has not moved', async ({
		page
	}) => {
		await mockProjectApi(page, {
			project: () => ({
				...baseProject,
				status: 'draft',
				runtime_status: 'not_deployed',
				active_deployment_id: null
			}),
			deploymentList: () => [{ ...queuedDeployment, sequence: 1 }]
		});

		await page.goto(projectsUrl);

		await expect(page.getByText(/belum ada server Sakala yang siap/)).toBeVisible();
		await expect(page.getByRole('button', { name: 'Sedang mendeploy' })).toBeDisabled();
		await expect(page.getByText(url)).toHaveCount(0);
		await expect(page.getByText('Tidak ada URL yang melayani saat ini')).toBeVisible();
	});

	test('active with a failed attempt: previous version still serves, URL stays', async ({
		page
	}) => {
		await mockProjectApi(page, {
			deploymentList: () => [
				{ ...succeededDeployment, id: 'older', sequence: 2 },
				{ ...failedDeployment, sequence: 3 }
			]
		});

		await page.goto(projectsUrl);

		await expect(
			page.getByText('Deployment #3 gagal. Versi sebelumnya masih melayani.')
		).toBeVisible();
		await expect(page.getByText(/belum ada URL publik/)).toHaveCount(0);
		await expect(page.getByText(url)).toBeVisible();
		await expect(page.getByRole('link', { name: 'Lihat log' })).toHaveAttribute(
			'href',
			`${DETAIL_URL}#deployment-logs`
		);
		await expect(page.getByLabel('Live').first()).toBeVisible();
	});

	test('crashed: a crash loop, honest that the URL may answer now and then', async ({ page }) => {
		await mockProjectApi(page, {
			project: () => ({ ...baseProject, runtime_status: 'crashed' })
		});

		await page.goto(projectsUrl);

		await expect(page.getByLabel('Crash')).toBeVisible();
		await expect(page.getByText(/kadang bisa dibuka, kadang tidak/)).toBeVisible();
		await expect(page.getByText(/tidak melayani/)).toHaveCount(0);
		await expect(page.getByRole('link', { name: 'Lihat log' })).toBeVisible();
		await expect(page.getByText(url)).toBeVisible();
		await expect(page.getByRole('button', { name: 'Redeploy' })).toBeEnabled();
	});

	test('shows the port traffic reaches, and when another one takes over', async ({ page }) => {
		await mockProjectApi(page, {
			project: () => ({ ...baseProject, serving_port: 3000, effective_port: 8080 })
		});

		await page.goto(projectsUrl);

		await expect(page.getByText('8080 berlaku di deploy berikutnya')).toBeVisible();
		await expect(page.getByText('3000', { exact: true })).toBeVisible();
	});

	test('a timeline survives metadata: [] and one malformed event', async ({ page }) => {
		await mockProjectApi(page, {
			events: () => [
				{
					sequence: 1,
					level: 'info',
					type: 'deployment.checkout.started',
					message: 'Cloning repository',
					metadata: [],
					occurred_at: '2026-09-20T08:41:02Z'
				},
				{ sequence: 2, level: 'surprise' }
			]
		});

		await page.goto(DETAIL_URL);

		await expect(page.getByText('Menyalin repository')).toBeVisible();
		await expect(page.getByText('Gagal memuat detail deployment')).toHaveCount(0);
	});

	test('stopped: no URL, Redeploy offered', async ({ page }) => {
		await mockProjectApi(page, {
			project: () => ({ ...baseProject, runtime_status: 'stopped' })
		});

		await page.goto(projectsUrl);

		await expect(page.getByText(/dihentikan dan tidak melayani/)).toBeVisible();
		await expect(page.getByRole('link', { name: 'Buka situs' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Redeploy' })).toBeEnabled();
	});

	test('suspended: no Redeploy, says why', async ({ page }) => {
		await mockProjectApi(page, {
			project: () => ({ ...baseProject, status: 'suspended' })
		});

		await page.goto(projectsUrl);

		await expect(page.getByLabel('Ditangguhkan')).toBeVisible();
		await expect(page.getByText(/ditangguhkan oleh admin/)).toBeVisible();
		await expect(page.getByRole('button', { name: 'Redeploy' })).toHaveCount(0);
		await expect(page.getByText(url)).toHaveCount(0);
	});

	test('a missing domain never becomes a link to https:// (U-17)', async ({ page }) => {
		await mockProjectApi(page, {
			project: () => ({ ...baseProject, default_domain: null, public_url: 'https://' })
		});

		await page.goto(projectsUrl);

		await expect(page.getByText('URL publik belum tersedia')).toBeVisible();
		await expect(page.getByRole('link', { name: 'Buka situs' })).toHaveCount(0);
	});

	test('shows effective_port, not the detected one', async ({ page }) => {
		await mockProjectApi(page, {
			project: () => ({ ...baseProject, detected_port: 3000, effective_port: 8080 })
		});

		await page.goto(projectsUrl);

		await expect(page.getByText('8080')).toBeVisible();
	});

	test('follows a deployment to the end, then reads the project again (U-15)', async ({ page }) => {
		let finished = false;
		let projectReads = 0;
		await mockProjectApi(page, {
			project: () => {
				projectReads += 1;
				return finished
					? baseProject
					: { ...baseProject, runtime_status: 'deploying', active_deployment_id: null };
			},
			deploymentList: () => [
				finished ? { ...succeededDeployment, sequence: 4 } : { ...runningDeployment, sequence: 4 }
			]
		});

		await page.goto(projectsUrl);
		await expect(page.getByRole('button', { name: 'Sedang mendeploy' })).toBeDisabled();
		const readsWhileRunning = projectReads;

		finished = true;

		await expect(page.getByRole('button', { name: 'Redeploy' })).toBeEnabled({ timeout: 20_000 });
		await expect(page.getByLabel('Live').first()).toBeVisible();
		await expect(page.getByText(url)).toBeVisible();
		expect(projectReads).toBeGreaterThan(readsWhileRunning);
	});

	test('Redeploy opens the new deployment (U-87)', async ({ page }) => {
		await mockProjectApi(page);

		await page.goto(projectsUrl);
		await page.getByRole('button', { name: 'Redeploy' }).click();

		await expect(page).toHaveURL(new RegExp(`/deployments/${NEW_DEPLOYMENT_ID}$`));
	});

	test('a suspended refusal updates the header, instead of leaving Redeploy there', async ({
		page
	}) => {
		let suspended = false;
		await mockProjectApi(page, {
			project: () => ({ ...baseProject, status: suspended ? 'suspended' : 'active' }),
			redeploy: () => {
				suspended = true;
				return {
					status: 409,
					body: {
						message: 'Project ini sedang ditangguhkan oleh admin, jadi belum bisa di-deploy.',
						code: 'PROJECT_SUSPENDED'
					}
				};
			}
		});

		await page.goto(projectsUrl);
		await page.getByRole('button', { name: 'Redeploy' }).click();

		await expect(page.getByRole('alert')).toContainText('ditangguhkan oleh admin');
		await expect(page.getByRole('button', { name: 'Redeploy' })).toHaveCount(0);
	});
});

test.describe('deployment history (U-19, U-25, U-86, U-95)', () => {
	const projectsUrl = `/projects/${PROJECT_ID}/deployments`;

	test('cards name what really happened, in Indonesian', async ({ page }) => {
		await mockProjectApi(page, {
			deploymentList: () => [
				{ ...failedDeployment, id: 'a', sequence: 5 },
				{ ...cancelledDeployment, id: 'b', sequence: 4 },
				{ ...queuedDeployment, id: 'c', sequence: 3 }
			]
		});

		await page.goto(projectsUrl);

		await expect(page.getByText('Gagal di tahap Build proyek')).toBeVisible();
		await expect(page.getByText('Dibatalkan sebelum selesai')).toBeVisible();
		await expect(page.getByText('Mengantre', { exact: true })).toBeVisible();
		await expect(page.getByText('Menunggu server siap')).toBeVisible();
		await expect(page.getByText('Build error')).toHaveCount(0);
		await expect(page.getByText('Deploying')).toHaveCount(0);
	});

	test('an empty 30 days does not claim there is no history, and offers all time', async ({
		page
	}) => {
		let requested: string[] = [];
		page.on('request', (request) => {
			const url = new URL(request.url());
			if (url.pathname.endsWith('/deployments')) {
				requested = [...requested, url.searchParams.get('filter') ?? ''];
			}
		});
		await mockProjectApi(page, { deploymentList: () => [] });

		await page.goto(projectsUrl);

		await expect(page.getByText('Tidak ada deployment dalam 30 hari terakhir.')).toBeVisible();
		await expect(page.getByText(/Belum ada riwayat/)).toHaveCount(0);

		await page.getByRole('button', { name: 'Lihat semua waktu' }).click();

		await expect(page.getByText(/Belum ada riwayat/)).toBeVisible();
	});

	test('a 500 offers a retry that recovers', async ({ page }) => {
		let failing = true;
		await mockProjectApi(page, { deploymentList: () => [succeededDeployment] });
		// Registered last so it runs first, ahead of the shared mock.
		await page.route(`**/api/v1/app/projects/${PROJECT_ID}/deployments?*`, (route) =>
			failing && route.request().url().includes('30_days')
				? route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
				: route.fallback()
		);

		await page.goto(projectsUrl);
		await expect(page.getByRole('alert')).toContainText('Gagal memuat riwayat deployment');

		failing = false;
		await page.getByRole('button', { name: 'Coba lagi' }).click();

		await expect(page.getByText('Deployment #3')).toBeVisible();
	});
});

test.describe('env editing (U-57)', () => {
	const vars = [
		{ id: 1, key: 'DATABASE_URL', is_secret: true, created_at: '2026-01-01T00:00:00Z' },
		{
			id: 2,
			key: 'APP_ENV',
			is_secret: false,
			value: 'production',
			created_at: '2026-01-01T00:00:00Z'
		}
	];

	test('a non-secret shows its value, and a secret stays hidden', async ({ page }) => {
		await mockProjectApi(page, { envList: () => vars });

		await page.goto(ENV_URL);

		await expect(page.getByText('production')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Tampilkan nilai APP_ENV' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Tampilkan nilai DATABASE_URL' })).toBeVisible();
	});

	test('editing sends the new value and flag, then asks for a redeploy', async ({ page }) => {
		let body: Record<string, unknown> | undefined;
		let required = false;
		await mockProjectApi(page, {
			project: () => ({ ...baseProject, redeploy_required: required }),
			envList: () => vars,
			updateEnv: (json) => {
				body = json;
				required = true;
				return {
					body: { data: { ...vars[1], value: 'staging', redeploy_required: true } }
				};
			}
		});

		await page.goto(ENV_URL);
		await expect(page.getByRole('button', { name: 'Redeploy sekarang' })).toHaveCount(0);

		await page.getByRole('button', { name: 'Ubah APP_ENV' }).click();
		const form = page.getByRole('form', { name: 'Ubah APP_ENV' });
		await expect(form.getByLabel('Nilai baru')).toBeFocused();
		await form.getByLabel('Nilai baru').fill('staging');
		await form.getByLabel(/Simpan sebagai secret/).check();
		await form.getByRole('button', { name: 'Simpan perubahan' }).click();

		await expect(form).toHaveCount(0);
		expect(body).toEqual({ value: 'staging', is_secret: true });
		await expect(page.getByRole('button', { name: 'Redeploy sekarang' })).toBeVisible();
		await expect(page.getByText(/belum dipakai aplikasi yang sedang berjalan/)).toBeVisible();
	});

	test('a secret left empty keeps its value, and only the flag is sent', async ({ page }) => {
		let body: Record<string, unknown> | undefined;
		await mockProjectApi(page, {
			envList: () => vars,
			updateEnv: (json) => {
				body = json;
				return { body: { data: { ...vars[0], is_secret: false } } };
			}
		});

		await page.goto(ENV_URL);
		await page.getByRole('button', { name: 'Ubah DATABASE_URL' }).click();
		const form = page.getByRole('form', { name: 'Ubah DATABASE_URL' });
		await form.getByLabel(/Simpan sebagai secret/).uncheck();
		await form.getByRole('button', { name: 'Simpan perubahan' }).click();

		await expect(form).toHaveCount(0);
		expect(body).toEqual({ is_secret: false });
	});

	test('Esc cancels the edit and returns focus', async ({ page }) => {
		await mockProjectApi(page, { envList: () => vars });

		await page.goto(ENV_URL);
		await page.getByRole('button', { name: 'Ubah APP_ENV' }).click();
		await page.getByRole('form', { name: 'Ubah APP_ENV' }).getByLabel('Nilai baru').press('Escape');

		await expect(page.getByRole('form', { name: 'Ubah APP_ENV' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Ubah APP_ENV' })).toBeFocused();
	});

	test('a new variable can be saved as not secret', async ({ page }) => {
		let body: Record<string, unknown> | undefined;
		await mockProjectApi(page, {
			addEnv: (json) => {
				body = json;
				return {
					status: 201,
					body: {
						data: { id: 3, key: json.key, is_secret: false, created_at: '2026-01-01T00:00:00Z' }
					}
				};
			}
		});

		await page.goto(ENV_URL);
		await page.getByRole('button', { name: 'Tambah Variabel' }).click();
		await page.getByLabel('Nama variabel').fill('LOG_LEVEL');
		await page.getByLabel('Nilai', { exact: true }).fill('debug');
		await page.getByLabel(/Simpan sebagai secret/).uncheck();
		await page.getByRole('button', { name: 'Simpan', exact: true }).click();

		await expect.poll(() => body).toEqual({ key: 'LOG_LEVEL', value: 'debug', is_secret: false });
	});

	test('Redeploy from the notice opens the new deployment', async ({ page }) => {
		await mockProjectApi(page, {
			project: () => ({ ...baseProject, redeploy_required: true }),
			envList: () => vars
		});

		await page.goto(ENV_URL);
		await page.getByRole('button', { name: 'Redeploy sekarang' }).click();

		await expect(page).toHaveURL(new RegExp(`/deployments/${NEW_DEPLOYMENT_ID}$`));
	});

	test('the row and its edit form fit a 320 px screen', async ({ page }) => {
		await mockProjectApi(page, { envList: () => vars });

		await page.setViewportSize({ width: 320, height: 800 });
		await page.goto(ENV_URL);
		await page.getByRole('button', { name: 'Ubah APP_ENV' }).click();

		await expect(page.getByRole('form', { name: 'Ubah APP_ENV' })).toBeVisible();
		expect(await pageOverflowsHorizontally(page)).toBe(false);
	});
});

test.describe('project header', () => {
	const failedProject = { ...baseProject, status: 'failed', runtime_status: 'failed' };

	test('"Lihat log" opens the logs of the latest failed deployment', async ({ page }) => {
		await mockProjectApi(page, {
			project: () => failedProject,
			deployment: () => failedDeployment,
			deploymentList: () => [
				{ ...succeededDeployment, id: 'older', sequence: 1 },
				{ ...failedDeployment, sequence: 3 },
				{ ...failedDeployment, id: 'old-failure', sequence: 2 }
			]
		});

		await page.goto(`/projects/${PROJECT_ID}/deployments`);

		const link = page.getByRole('link', { name: 'Lihat log' });
		await expect(link).toHaveAttribute('href', `${DETAIL_URL}#deployment-logs`);

		await link.click();

		await expect(page.locator('#deployment-logs')).toBeFocused();
	});

	test('falls back to the history when the failed deployment is unknown', async ({ page }) => {
		await mockProjectApi(page, { project: () => failedProject, deploymentList: () => [] });

		await page.goto(`/projects/${PROJECT_ID}/settings`);

		await expect(page.getByRole('link', { name: 'Lihat riwayat' })).toHaveAttribute(
			'href',
			`/projects/${PROJECT_ID}/deployments`
		);
	});

	test('a failed redeploy shows inline, with no browser alert', async ({ page }) => {
		let dialogs = 0;
		page.on('dialog', async (dialog) => {
			dialogs += 1;
			await dialog.dismiss();
		});
		await mockProjectApi(page, {
			redeploy: () => ({ status: 409, body: { message: 'Project is suspended.' } })
		});

		await page.goto(SETTINGS_URL);
		await page.getByRole('button', { name: 'Redeploy' }).click();

		await expect(page.getByRole('alert')).toContainText('Project is suspended.');
		expect(dialogs).toBe(0);
	});
});

test.describe('env form (U-72, U-83, U-71, U-31)', () => {
	for (const width of [320, 768, 1024, 1280, 1366]) {
		test(`add, save, reveal, and delete work with a mouse at ${width} px`, async ({ page }) => {
			const list = [...envVars];
			const posted: unknown[] = [];
			await mockProjectApi(page, {
				envList: () => list,
				addEnv: (body) => {
					posted.push(body);
					const created = {
						id: 'env_new',
						key: body.key,
						is_secret: true,
						created_at: '2026-01-01T00:00:00Z'
					};
					list.push(created as never);
					return { status: 201, body: { data: created } };
				},
				deleteEnv: () => {
					list.splice(0, 1);
					return { status: 204 };
				}
			});

			await page.setViewportSize({ width, height: 800 });
			await page.goto(ENV_URL);

			await expect(page.getByText('DATABASE_URL')).toBeVisible();
			expect(await pageOverflowsHorizontally(page)).toBe(false);

			await page.getByRole('button', { name: 'Tambah Variabel' }).click();
			await page.getByLabel('Nama variabel').fill('new_key');
			await page.getByLabel('Nilai', { exact: true }).fill('nilai-contoh');

			// Measured before any scrolling: scrollIntoView can reach inside `overflow: hidden`, a mouse cannot.
			const form = await page.getByRole('form', { name: 'Tambah variabel' }).boundingBox();
			const save = await page.getByRole('button', { name: 'Simpan' }).boundingBox();
			expect((save?.x ?? 0) + (save?.width ?? 0)).toBeLessThanOrEqual(
				(form?.x ?? 0) + (form?.width ?? 0)
			);

			// Vertical only, the way a mouse wheel reaches the bottom of the page.
			await page.locator('main').evaluate((main) => main.scrollTo(0, main.scrollHeight));
			await expect(page.getByRole('button', { name: 'Simpan' })).toBeInViewport({ ratio: 1 });
			await expect(page.getByRole('button', { name: 'Batal' })).toBeInViewport({ ratio: 1 });
			expect(await isClickable(page, 'Simpan')).toBe(true);
			expect(await isClickable(page, 'Batal')).toBe(true);
			expect(await pageOverflowsHorizontally(page)).toBe(false);

			await page.getByRole('button', { name: 'Simpan' }).click();

			await expect(page.getByText('NEW_KEY')).toBeVisible();
			expect(posted).toEqual([{ key: 'NEW_KEY', value: 'nilai-contoh', is_secret: true }]);

			await page.getByRole('button', { name: 'Tampilkan nilai DATABASE_URL' }).click();
			await expect(page.getByText('rahasia')).toBeVisible();

			await page.getByRole('button', { name: 'Hapus DATABASE_URL' }).click();
			const dialog = page.getByRole('dialog');
			await expect(dialog).toBeVisible();
			await dialog.getByRole('button', { name: 'Hapus Variabel' }).click();

			await expect(dialog).toHaveCount(0);
			await expect(page.getByText('DATABASE_URL')).toHaveCount(0);
		});
	}

	test('Enter saves and Esc cancels, returning focus', async ({ page }) => {
		const posted: unknown[] = [];
		await mockProjectApi(page, {
			envList: () => envVars,
			addEnv: (body) => {
				posted.push(body);
				return { status: 201, body: { data: { id: 'x', key: body.key, is_secret: true } } };
			}
		});
		await page.goto(ENV_URL);

		const add = page.getByRole('button', { name: 'Tambah Variabel' });
		await add.click();
		await expect(page.getByLabel('Nama variabel')).toBeFocused();

		await page.keyboard.type('draft');
		await page.keyboard.press('Escape');
		await expect(add).toBeFocused();
		await expect(page.getByLabel('Nama variabel')).toHaveCount(0);

		await add.click();
		await expect(page.getByLabel('Nama variabel')).toHaveValue('');
		await page.keyboard.type('new_key');
		await page.keyboard.press('Tab');
		await page.keyboard.type('nilai');
		await page.keyboard.press('Enter');

		await expect(add).toBeVisible();
		expect(posted).toEqual([{ key: 'NEW_KEY', value: 'nilai', is_secret: true }]);
	});

	test('maps a 422 to the field it belongs to', async ({ page }) => {
		await mockProjectApi(page, {
			envList: () => envVars,
			addEnv: () => ({
				status: 422,
				body: {
					message: 'Nama sudah dipakai. (and 1 more error)',
					errors: { key: ['Nama sudah dipakai.'], value: ['Nilai terlalu panjang.'] }
				}
			})
		});
		await page.goto(ENV_URL);

		await page.getByRole('button', { name: 'Tambah Variabel' }).click();
		await page.getByLabel('Nama variabel').fill('NEW_KEY');
		await page.getByLabel('Nilai', { exact: true }).fill('nilai');
		await page.getByRole('button', { name: 'Simpan' }).click();

		await expect(page.getByLabel('Nama variabel')).toHaveAccessibleDescription(
			'Nama sudah dipakai.'
		);
		await expect(page.getByLabel('Nilai', { exact: true })).toHaveAccessibleDescription(
			'Nilai terlalu panjang.'
		);
		await expect(page.getByLabel('Nama variabel')).toHaveValue('NEW_KEY');
	});

	test('a key that already exists is caught before the request', async ({ page }) => {
		let posts = 0;
		await mockProjectApi(page, {
			envList: () => envVars,
			addEnv: () => {
				posts += 1;
				return { status: 201, body: { data: {} } };
			}
		});
		await page.goto(ENV_URL);

		await page.getByRole('button', { name: 'Tambah Variabel' }).click();
		await page.getByLabel('Nama variabel').fill('APP_ENV');
		await page.getByLabel('Nilai', { exact: true }).fill('nilai');
		await page.getByRole('button', { name: 'Simpan' }).click();

		await expect(page.getByText('Variabel APP_ENV sudah ada.')).toBeVisible();
		expect(posts).toBe(0);
	});

	test('a failed delete stays open with a visible error', async ({ page }) => {
		await mockProjectApi(page, {
			envList: () => envVars,
			deleteEnv: () => ({ status: 500, body: { message: 'SQLSTATE rahasia' } })
		});
		await page.goto(ENV_URL);

		await page.getByRole('button', { name: 'Hapus APP_ENV' }).click();
		const dialog = page.getByRole('dialog');
		await dialog.getByRole('button', { name: 'Hapus Variabel' }).click();

		await expect(dialog.getByRole('alert')).toContainText('Terjadi kesalahan pada server');
		await expect(dialog).not.toContainText('rahasia');
	});

	test('a failed reveal shows inline, with no browser alert', async ({ page }) => {
		let dialogs = 0;
		page.on('dialog', async (dialog) => {
			dialogs += 1;
			await dialog.dismiss();
		});
		await mockProjectApi(page, {
			envList: () => envVars,
			revealEnv: () => ({ status: 500, body: {} })
		});
		await page.goto(ENV_URL);

		await page.getByRole('button', { name: 'Tampilkan nilai APP_ENV' }).click();

		await expect(page.getByRole('alert')).toContainText('Terjadi kesalahan pada server');
		expect(dialogs).toBe(0);
	});
});

test.describe('delete modals (U-69)', () => {
	test('env modal traps focus, starts on the safe button, and closes on Escape', async ({
		page
	}) => {
		await mockProjectApi(page, { envList: () => envVars });
		await page.goto(ENV_URL);

		const trigger = page.getByRole('button', { name: 'Hapus APP_ENV' });
		await trigger.click();

		const dialog = page.getByRole('dialog', { name: 'Hapus Variabel APP_ENV?' });
		const cancel = dialog.getByRole('button', { name: 'Batal' });
		const confirm = dialog.getByRole('button', { name: 'Hapus Variabel' });
		await expect(cancel).toBeFocused();

		await page.keyboard.press('Tab');
		await expect(confirm).toBeFocused();
		await page.keyboard.press('Tab');
		await expect(cancel).toBeFocused();

		await page.keyboard.press('Escape');
		await expect(dialog).toHaveCount(0);
		await expect(trigger).toBeFocused();
	});

	test('project modal needs the typed name, traps focus, and shows a failed delete', async ({
		page
	}) => {
		await mockProjectApi(page, {
			deleteProject: () => ({ status: 409, body: { message: 'Project is suspended.' } })
		});
		await page.goto(SETTINGS_URL);

		const trigger = page.getByRole('button', { name: 'Hapus Proyek' });
		await trigger.click();

		const dialog = page.getByRole('dialog', { name: /Hapus proyek toko-kopi-web/ });
		const input = dialog.getByLabel(/untuk konfirmasi/);
		const confirm = dialog.getByRole('button', { name: 'Hapus proyek ini' });
		await expect(input).toBeFocused();
		await expect(confirm).toBeDisabled();

		await input.fill('toko-kopi-web');
		await expect(confirm).toBeEnabled();
		await confirm.click();

		await expect(dialog.getByRole('alert')).toContainText('Project is suspended.');

		await page.keyboard.press('Escape');
		await expect(dialog).toHaveCount(0);
		await expect(trigger).toBeFocused();
	});

	for (const width of [320, 1280]) {
		test(`project modal fits and scrolls inside itself at ${width} px`, async ({ page }) => {
			await mockProjectApi(page, {
				project: () => ({
					...baseProject,
					name: `proyek-dengan-nama-yang-sangat-panjang-${'x'.repeat(80)}`
				})
			});
			await page.setViewportSize({ width, height: 500 });
			await page.goto(SETTINGS_URL);

			await page.getByRole('button', { name: 'Hapus Proyek' }).click();
			const dialog = page.getByRole('dialog');
			await expect(dialog).toBeVisible();

			const box = await dialog.boundingBox();
			expect(box?.x).toBeGreaterThanOrEqual(0);
			expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
			expect(box?.height).toBeLessThanOrEqual(500);
			expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
				true
			);

			await dialog.getByRole('button', { name: 'Batal' }).scrollIntoViewIfNeeded();
			await expect(dialog.getByRole('button', { name: 'Batal' })).toBeInViewport();
		});
	}
});

test.describe('project settings (U-82, U-42)', () => {
	test('a draft survives switching tabs, with all six fields intact', async ({ page }) => {
		await mockProjectApi(page, { envList: () => envVars });
		await page.goto(SETTINGS_URL);

		await page.getByLabel('Nama Proyek').fill('nama-baru');
		await page.getByLabel('Branch').fill('develop');

		await page.getByRole('link', { name: 'Environment Variables' }).click();
		await expect(page.getByText('DATABASE_URL')).toBeVisible();
		await page.getByRole('link', { name: 'Pengaturan', exact: true }).click();

		await expect(page.getByLabel('Nama Proyek')).toHaveValue('nama-baru');
		await expect(page.getByLabel('Branch')).toHaveValue('develop');
		await expect(page.getByLabel('Subdomain (URL Publik)')).toHaveValue('toko-kopi-web');
		// Nothing configured: the fields stay empty and editable, and the port names what is used.
		await expect(page.getByLabel('Port')).toHaveValue('');
		await expect(page.getByLabel('Port')).toHaveAccessibleDescription(/Sekarang 3000/);
		await expect(page.getByLabel('Root Directory')).toHaveValue('');
		await expect(page.getByLabel('Build command')).toHaveValue('');
		await expect(page.getByRole('button', { name: 'Simpan perubahan' })).toBeEnabled();
	});

	test('Redeploy after a tab switch still saves the draft first', async ({ page }) => {
		const calls: string[] = [];
		await mockProjectApi(page, {
			envList: () => envVars,
			updateProject: (body) => {
				calls.push(`PUT ${JSON.stringify(body)}`);
				return { body: { data: { ...baseProject, ...body } } };
			},
			redeploy: () => {
				calls.push('POST');
				return { status: 201, body: { data: { ...runningDeployment } } };
			}
		});
		await page.goto(SETTINGS_URL);

		await page.getByLabel('Branch').fill('develop');
		await page.getByRole('link', { name: 'Environment Variables' }).click();
		await expect(page.getByText('DATABASE_URL')).toBeVisible();
		await page.getByRole('button', { name: 'Redeploy' }).click();

		await expect
			.poll(() => calls)
			.toEqual(['PUT {"name":"toko-kopi-web","branch":"develop"}', 'POST']);
	});

	test('Save sends only what changed, without a redeploy', async ({ page }) => {
		const updates: unknown[] = [];
		let redeploys = 0;
		await mockProjectApi(page, {
			updateProject: (body) => {
				updates.push(body);
				return { body: { data: { ...baseProject, ...body } } };
			},
			redeploy: () => {
				redeploys += 1;
				return { status: 201, body: { data: runningDeployment } };
			}
		});
		await page.goto(SETTINGS_URL);

		const save = page.getByRole('button', { name: 'Simpan perubahan' });
		await expect(save).toBeDisabled();

		await page.getByLabel('Nama Proyek').fill('nama-baru');
		await save.click();

		await expect(page.getByText('Perubahan tersimpan.')).toBeVisible();
		await expect(save).toBeDisabled();
		expect(updates).toEqual([{ name: 'nama-baru' }]);
		expect(redeploys).toBe(0);
	});

	test('Save maps a 422 to its field and keeps the draft', async ({ page }) => {
		await mockProjectApi(page, {
			updateProject: () => ({
				status: 422,
				body: {
					message: 'Branch tidak ditemukan.',
					errors: { branch: ['Branch tidak ditemukan.'] }
				}
			})
		});
		await page.goto(SETTINGS_URL);

		await page.getByLabel('Branch').fill('tidak-ada');
		await page.getByRole('button', { name: 'Simpan perubahan' }).click();

		await expect(page.getByLabel('Branch')).toHaveAccessibleDescription('Branch tidak ditemukan.');
		await expect(page.getByLabel('Branch')).toHaveValue('tidak-ada');
	});

	test('an emptied name is refused before the request', async ({ page }) => {
		let updates = 0;
		await mockProjectApi(page, {
			updateProject: () => {
				updates += 1;
				return { body: { data: baseProject } };
			}
		});
		await page.goto(SETTINGS_URL);

		await page.getByLabel('Nama Proyek').fill('   ');
		await page.getByRole('button', { name: 'Simpan perubahan' }).click();

		await expect(page.getByLabel('Nama Proyek')).toHaveAccessibleDescription(/Isi nama proyek/);
		expect(updates).toBe(0);
	});

	for (const width of [320, 1280]) {
		test(`the form and danger zone stay inside the page at ${width} px`, async ({ page }) => {
			await mockProjectApi(page);
			await page.setViewportSize({ width, height: 800 });
			await page.goto(SETTINGS_URL);

			await expect(page.getByLabel('Build command')).toBeVisible();
			expect(await pageOverflowsHorizontally(page)).toBe(false);

			const form = await page.locator('form').boundingBox();
			const rightColumn = await page.getByLabel('Build command').boundingBox();
			expect((rightColumn?.x ?? 0) + (rightColumn?.width ?? 0)).toBeLessThanOrEqual(
				(form?.x ?? 0) + (form?.width ?? 0)
			);

			await page.getByRole('button', { name: 'Hapus Proyek' }).scrollIntoViewIfNeeded();
			expect(await isClickable(page, 'Hapus Proyek')).toBe(true);
		});
	}
});

test.describe('project detail shell (#75)', () => {
	test('tabs scroll inside their own strip on a narrow screen', async ({ page }) => {
		await mockProjectApi(page, {
			project: () => ({ ...baseProject, name: `nama-${'panjang'.repeat(20)}` })
		});
		await page.setViewportSize({ width: 320, height: 700 });
		await page.goto(SETTINGS_URL);

		const tabs = page.getByRole('navigation', { name: 'Bagian proyek' });
		const settingsTab = tabs.getByRole('link', { name: 'Pengaturan', exact: true });
		// Without this the tabs wrap onto a second row, and the strip has nothing to scroll.
		expect(await tabs.evaluate((nav) => nav.scrollWidth > nav.clientWidth)).toBe(true);
		await settingsTab.scrollIntoViewIfNeeded();
		await expect(settingsTab).toBeInViewport();
		expect(await tabs.evaluate((nav) => nav.scrollLeft)).toBeGreaterThan(0);
		expect(await pageOverflowsHorizontally(page)).toBe(false);
	});
});

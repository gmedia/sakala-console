import { expect, test, type Page } from '@playwright/test';
import {
	LONG,
	SIGNED_IN_ROUTES,
	SIGNED_OUT_ROUTES,
	WIDTHS,
	mockEveryRoute,
	mockSignedOutRoutes,
	signedInUser
} from './fixtures/all-routes';
import { auditDom } from './fixtures/dom-audit';
import { DEPLOYMENT_ID, PROJECT_ID } from './fixtures/create-project';

async function settled(page: Page) {
	await page.waitForLoadState('networkidle');
	await expect(page.locator('main')).toHaveCount(1);
}

async function expectFloor(page: Page, route: string, width: number) {
	const audit = await auditDom(page, 24, width < 768 ? 44 : 24);
	const at = `${route} at ${width} px`;
	expect.soft(audit.overflow, `${at}: nothing past the viewport`).toEqual([]);
	expect.soft(audit.contrast, `${at}: text and placeholder contrast`).toEqual([]);
	expect.soft(audit.controls, `${at}: edge of inputs and switches`).toEqual([]);
	expect.soft(audit.targets, `${at}: targets of at least 24 px`).toEqual([]);
	expect.soft(audit.primaryTargets, `${at}: primary actions on touch layouts`).toEqual([]);
	expect.soft(audit.h1, `${at}: exactly one h1`).toBe(1);
	expect.soft(audit.main, `${at}: exactly one main`).toBe(1);
	expect.soft(audit.title, `${at}: a title of its own`).toContain('|');
}

// One test per width and not per route: a route takes about a second, and every failure names both.
test.describe('every route, at every width (U-67, U-68, U-70, U-71, U-85, U-92 to U-98, U-101)', () => {
	test.describe.configure({ timeout: 120_000 });

	for (const width of WIDTHS) {
		test(`signed in, ${width} px`, async ({ page }) => {
			await page.setViewportSize({ width, height: 800 });
			await mockEveryRoute(page);
			for (const [name, path] of SIGNED_IN_ROUTES) {
				await page.goto(path);
				await settled(page);
				await expectFloor(page, name, width);
			}
		});

		test(`signed out, ${width} px`, async ({ page }) => {
			await page.setViewportSize({ width, height: 800 });
			await mockSignedOutRoutes(page);
			for (const [name, path] of SIGNED_OUT_ROUTES) {
				await page.goto(path);
				await settled(page);
				await expectFloor(page, name, width);
			}
		});
	}
});

test.describe('very long names, commits, and domains stay inside the page (U-93, U-94)', () => {
	test.describe.configure({ timeout: 120_000 });

	for (const width of WIDTHS) {
		test(`every signed-in route at ${width} px`, async ({ page }) => {
			await page.setViewportSize({ width, height: 800 });
			await mockEveryRoute(page, { long: true });
			for (const [name, path] of SIGNED_IN_ROUTES) {
				await page.goto(path);
				await settled(page);
				expect.soft((await auditDom(page)).overflow, name).toEqual([]);
			}
		});
	}

	test('wizard repositories stay tellable apart at 320 px (U-94)', async ({ page }) => {
		await page.setViewportSize({ width: 320, height: 800 });
		await mockEveryRoute(page, { long: true });
		await page.goto('/projects/new');

		for (const index of [1, 2]) {
			const name = page.getByText(`rani/${LONG}${index}`);
			await expect(name).toBeVisible();
			const clipped = await name.evaluate((el) => el.scrollWidth > el.clientWidth);
			expect(clipped).toBe(false);
		}
	});

	test('the deployment detail shows every value in full at 320 px (U-85)', async ({ page }) => {
		await page.setViewportSize({ width: 320, height: 800 });
		await mockEveryRoute(page, { long: true });
		await page.goto(`/projects/${PROJECT_ID}/deployments/${DEPLOYMENT_ID}`);

		const branch = page.getByTestId('deployment-branch');
		await expect(branch).toBeVisible();
		expect(await branch.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(false);
	});
});

test('onboarding fits 320 px and has a page heading (U-92)', async ({ page }) => {
	await page.setViewportSize({ width: 320, height: 800 });
	await mockEveryRoute(page);
	await page.route('**/api/v1/auth/user', (route) =>
		route.fulfill({
			contentType: 'application/json',
			body: JSON.stringify({ data: { ...signedInUser, onboarding_completed_at: null } })
		})
	);

	await page.goto('/onboarding');
	await expect(page.getByText('Langkah 1 dari 3')).toBeVisible();

	const audit = await auditDom(page, 24, 44);
	expect(audit.overflow).toEqual([]);
	expect(audit.h1).toBe(1);
	expect(audit.main).toBe(1);
	const next = await page.getByRole('button', { name: 'Lanjutkan' }).boundingBox();
	expect(next!.x + next!.width).toBeLessThanOrEqual(320);
});

test.describe('keyboard', () => {
	test('the skip link is the first stop and lands past the navigation (U-69)', async ({ page }) => {
		await mockEveryRoute(page);
		await page.goto('/projects');
		await settled(page);

		await page.keyboard.press('Tab');
		const skip = page.getByRole('link', { name: 'Langsung ke konten utama' });
		await expect(skip).toBeFocused();
		await expect(skip).toBeInViewport();

		await page.keyboard.press('Enter');
		await expect(page.locator('#main-content')).toBeFocused();

		await page.keyboard.press('Tab');
		await expect(page.getByRole('link', { name: 'Buat Proyek' })).toBeFocused();
	});

	test('the mobile drawer traps focus, closes on Esc and its button, and gives focus back (U-88)', async ({
		page
	}) => {
		await page.setViewportSize({ width: 320, height: 800 });
		await mockEveryRoute(page);
		await page.goto('/projects');

		const open = page.getByRole('button', { name: 'Buka navigasi' });
		await open.click();
		const drawer = page.getByRole('dialog', { name: 'Navigasi' });
		await expect(drawer).toBeVisible();
		await expect
			.poll(() => drawer.evaluate((el) => el.contains(document.activeElement)))
			.toBe(true);

		for (let i = 0; i < 10; i++) {
			await page.keyboard.press('Tab');
			expect(await drawer.evaluate((el) => el.contains(document.activeElement))).toBe(true);
		}

		await page.keyboard.press('Escape');
		await expect(drawer).toBeHidden();
		await expect(open).toBeFocused();

		await open.click();
		await page.getByRole('button', { name: 'Tutup menu' }).click();
		await expect(drawer).toBeHidden();
		await expect(open).toBeFocused();
	});

	test('the drawer closes itself when the window grows past it', async ({ page }) => {
		await page.setViewportSize({ width: 320, height: 800 });
		await mockEveryRoute(page);
		await page.goto('/projects');

		await page.getByRole('button', { name: 'Buka navigasi' }).click();
		await expect(page.getByRole('dialog', { name: 'Navigasi' })).toBeVisible();

		// `md:hidden` alone would hide it while it still held focus and the scroll lock.
		await page.setViewportSize({ width: 1024, height: 800 });
		await expect(page.getByRole('dialog', { name: 'Navigasi', includeHidden: true })).toHaveCount(
			0
		);
		await expect(page.getByRole('link', { name: 'Kirim Masukan' })).toBeVisible();
	});

	for (const [name, path] of [
		['projects', '/projects'],
		['deployments', `/projects/${PROJECT_ID}/deployments`],
		['environments', `/projects/${PROJECT_ID}/environments`],
		['settings', '/settings']
	] as const) {
		test(`every Tab stop on ${name} shows focus (U-90)`, async ({ page }) => {
			await mockEveryRoute(page);
			await page.goto(path);
			await settled(page);

			for (let i = 0; i < 18; i++) {
				await page.keyboard.press('Tab');
				const stop = await page.evaluate(() => {
					const el = document.activeElement as HTMLElement | null;
					if (!el || el === document.body) return null;
					const hasRing = (node: Element) => {
						const style = getComputedStyle(node);
						return (
							(style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) ||
							style.boxShadow !== 'none'
						);
					};
					return {
						name: el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 30) || el.id,
						visible: hasRing(el) || (el.parentElement ? hasRing(el.parentElement) : false)
					};
				});
				if (stop) expect(stop.visible, `focus ring on "${stop.name}"`).toBe(true);
			}
		});
	}

	test('the project search shows focus and asks the API once for a typed word (U-90, U-100)', async ({
		page
	}) => {
		await mockEveryRoute(page);
		const searches: string[] = [];
		await page.route(/\/api\/v1\/app\/projects\?.*search=/, (route) => {
			searches.push(new URL(route.request().url()).searchParams.get('search') ?? '');
			return route.fallback();
		});
		await page.goto('/projects');
		await settled(page);

		const box = page.getByRole('textbox', { name: 'Cari proyek' });
		await box.focus();
		const ring = await box.evaluate(
			(el) => getComputedStyle(el.parentElement as Element).boxShadow
		);
		expect(ring).not.toBe('none');

		await box.pressSequentially('kopi', { delay: 30 });
		await expect.poll(() => searches).toEqual(['kopi']);
	});

	test('the deployment search asks the API once for a typed word (U-100)', async ({ page }) => {
		await mockEveryRoute(page);
		const searches: string[] = [];
		await page.route(`**/api/v1/app/projects/${PROJECT_ID}/deployments?*`, (route) => {
			const search = new URL(route.request().url()).searchParams.get('search');
			if (search) searches.push(search);
			return route.fallback();
		});
		await page.goto(`/projects/${PROJECT_ID}/deployments`);
		await settled(page);

		await page
			.getByRole('textbox', { name: 'Cari deployment' })
			.pressSequentially('checkout', { delay: 30 });

		await expect.poll(() => searches).toEqual(['checkout']);
	});

	test('a destructive dialog does not start on its destructive button (U-102)', async ({
		page
	}) => {
		await mockEveryRoute(page);
		await page.goto(`/projects/${PROJECT_ID}/environments`);

		await page.getByRole('button', { name: 'Hapus DATABASE_URL' }).click();

		const dialog = page.getByRole('dialog');
		await expect(dialog.getByRole('button', { name: 'Batal' })).toBeFocused();
		await expect(dialog.getByRole('button', { name: 'Hapus Variabel' })).not.toBeFocused();
	});

	test('Enter saves a new variable and Esc cancels (U-102)', async ({ page }) => {
		await mockEveryRoute(page);
		const added: unknown[] = [];
		await page.route(`**/api/v1/app/projects/${PROJECT_ID}/environment-variables`, (route) => {
			if (route.request().method() === 'POST') added.push(route.request().postDataJSON());
			return route.fallback();
		});
		await page.goto(`/projects/${PROJECT_ID}/environments`);

		await page.getByRole('button', { name: 'Tambah Variabel' }).click();
		await page.keyboard.press('Escape');
		const addButton = page.getByRole('button', { name: 'Tambah Variabel' });
		await expect(addButton).toBeFocused();

		await addButton.click();
		await page.getByLabel('Nama variabel').fill('API_KEY');
		await page.getByLabel('Nilai', { exact: true }).fill('rahasia');
		await page.keyboard.press('Enter');

		await expect.poll(() => added).toHaveLength(1);
	});
});

test.describe('wording', () => {
	test('the auth screens make no claim Sakala cannot back up', async ({ page }) => {
		await mockSignedOutRoutes(page);
		await page.setViewportSize({ width: 1280, height: 800 });

		for (const path of ['/login', '/register']) {
			await page.goto(path);
			const text = (await page.locator('main').innerText()).toLowerCase();
			for (const claim of ['enterprise', 'keandalan', 'masa depan', 'scale', 'terpercaya']) {
				expect(text, `${path} says "${claim}"`).not.toContain(claim);
			}
		}
	});

	test('the deployment detail has a title of its own, and so does a missing page (U-101)', async ({
		page
	}) => {
		await mockEveryRoute(page);

		await page.goto(`/projects/${PROJECT_ID}/deployments/${DEPLOYMENT_ID}`);
		await expect(page).toHaveTitle('Deployment #3 | toko-kopi-web');

		await page.goto('/halaman-yang-tidak-ada');
		await expect(page).toHaveTitle('Halaman Tidak Ditemukan | Sakala Console');
	});

	test('fonts are served from this origin, and text never waits for them (U-78)', async ({
		page
	}) => {
		const external: string[] = [];
		page.on('request', (request) => {
			if (/font|\.woff2/.test(request.url()) && !request.url().startsWith('http://127.0.0.1')) {
				external.push(request.url());
			}
		});
		await mockSignedOutRoutes(page);
		await page.goto('/login');
		await settled(page);

		await expect
			.poll(() => page.evaluate(() => document.fonts.check('600 16px Montserrat')))
			.toBe(true);
		expect(external).toEqual([]);
	});
});

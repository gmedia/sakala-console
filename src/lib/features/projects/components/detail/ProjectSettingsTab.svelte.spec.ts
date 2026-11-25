import { page, userEvent } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { resetRateLimit } from '$lib/api/rate-limit';
import QueryTestHost from '$lib/testing/QueryTestHost.svelte';
import {
	baseProject,
	personalWorkspace,
	PROJECT_ID
} from '../../../../../../tests/e2e/fixtures/project-detail';
import {
	RELEASE_COMMAND_HELP,
	RELEASE_COMMAND_LABEL,
	RELEASE_COMMAND_PLACEHOLDER,
	SETTINGS_FIELD_HINTS
} from '../../build-help';
import { SETTINGS_PANEL_COPY } from '../../settings-panel';
import { REDEPLOY_REQUIRED_COPY } from '../../presentation';
import { REPLICAS_COPY } from '../../replicas';
import ProjectSettingsTab from './ProjectSettingsTab.svelte';

vi.mock('$lib/config/public', () => ({ publicConfig: { apiUrl: 'http://api.test' } }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
const location = vi.hoisted(() => ({ hash: '' }));
vi.mock('$app/state', () => ({
	page: {
		get url() {
			return new URL(`http://app.test/projects/x/settings${location.hash}`);
		}
	}
}));
vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

type Body = Record<string, unknown>;

let project: Body;
let saved: Body[];

function json(status: number, body: unknown) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

async function answer(request: Request): Promise<Response> {
	const { pathname } = new URL(request.url);
	if (pathname === '/sanctum/csrf-cookie') return new Response(null, { status: 204 });
	if (pathname === '/api/v1/app/workspaces') {
		return json(200, {
			data: [{ ...personalWorkspace, projects_count: 1, active_deployments_count: 0 }]
		});
	}
	if (pathname.endsWith('/branches')) return json(200, { data: [] });
	// The side panel reads the header's recent deployments.
	if (pathname.endsWith('/deployments')) {
		return json(200, {
			data: [],
			meta: { current_page: 1, from: null, last_page: 1, per_page: 6, to: null, total: 0 }
		});
	}
	if (pathname === `/api/v1/app/projects/${PROJECT_ID}` && request.method === 'PUT') {
		const body = (await request.json()) as Body;
		saved.push(body);
		// What the API answers: the new setting, waiting for the next deployment.
		project = { ...project, ...body, redeploy_required: true };
		return json(200, { data: project });
	}
	return json(200, { data: project });
}

const renderTab = () =>
	render(QueryTestHost, {
		props: { component: ProjectSettingsTab, props: { projectId: PROJECT_ID } }
	});
const replicasField = () => page.getByRole('spinbutton', { name: REPLICAS_COPY.label });
const save = () => page.getByRole('button', { name: 'Simpan perubahan' });
const advancedToggle = () => page.getByRole('button', { name: 'Lanjutan' });
/** Release command and replicas sit in Lanjutan, closed until opened when they hold no value. */
async function openAdvanced() {
	await advancedToggle().click();
	await expect.element(advancedToggle()).toHaveAttribute('aria-expanded', 'true');
}

beforeEach(() => {
	project = {
		...baseProject,
		replicas: 1,
		max_replicas: 4,
		serving_replicas: 1,
		replicas_ready: 1
	};
	saved = [];
	location.hash = '';
	vi.stubGlobal(
		'fetch',
		vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => answer(new Request(input, init)))
	);
});

afterEach(() => {
	resetRateLimit();
	vi.unstubAllGlobals();
});

describe('ProjectSettingsTab, replicas', () => {
	it('offers 1 to the workspace maximum, with the maximum under the field', async () => {
		await renderTab();
		await openAdvanced();

		const field = replicasField();
		await expect.element(field).toBeEnabled();
		await expect.element(field).toHaveValue(1);
		await expect.element(field).toHaveAttribute('min', '1');
		await expect.element(field).toHaveAttribute('max', '4');
		await expect.element(field).toHaveAccessibleDescription(REPLICAS_COPY.shortMaximum(4));
	});

	it('is disabled with the reason when the workspace allows one replica', async () => {
		project = { ...project, max_replicas: 1 };
		await renderTab();
		await openAdvanced();

		await expect.element(replicasField()).toBeDisabled();
		await expect
			.element(replicasField())
			.toHaveAccessibleDescription(REPLICAS_COPY.shortUnavailable);
	});

	it.each(['0', '5'])('refuses %s before sending', async (value) => {
		await renderTab();
		await openAdvanced();

		await userEvent.fill(replicasField(), value);
		await save().click();

		await expect
			.element(replicasField())
			.toHaveAccessibleDescription('Isi jumlah replika dengan bilangan bulat 1 sampai 4.');
		expect(saved).toEqual([]);
	});

	it('saves the new setting alone, then says the project needs a redeploy', async () => {
		await renderTab();
		await expect.element(page.getByText(REDEPLOY_REQUIRED_COPY.settings)).not.toBeInTheDocument();
		await openAdvanced();

		await userEvent.fill(replicasField(), '3');
		await save().click();

		await expect.poll(() => saved).toEqual([{ replicas: 3 }]);
		await expect
			.element(page.getByText('Perubahan tersimpan. Berlaku mulai deployment berikutnya.'))
			.toBeVisible();
		await expect.element(page.getByText(REDEPLOY_REQUIRED_COPY.settings)).toBeVisible();
		await expect
			.element(page.getByRole('button', { name: REDEPLOY_REQUIRED_COPY.action }))
			.toBeVisible();
		await expect.element(replicasField()).toHaveValue(3);
	});

	it('shows the API refusal on the field', async () => {
		vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
			const request = new Request(input, init);
			if (request.method === 'PUT') {
				return json(422, {
					message: 'Data tidak valid.',
					errors: {
						replicas: [
							'Proyek di workspace ini paling banyak berjalan dengan 4 replika. Minta admin menaikkan batasnya bila butuh lebih.'
						]
					}
				});
			}
			return answer(request);
		});
		await renderTab();
		await openAdvanced();

		await userEvent.fill(replicasField(), '2');
		await save().click();

		await expect
			.element(replicasField())
			.toHaveAccessibleDescription(
				'Proyek di workspace ini paling banyak berjalan dengan 4 replika. Minta admin menaikkan batasnya bila butuh lebih.'
			);
	});
});

describe('ProjectSettingsTab, release command', () => {
	const migrate = 'php artisan migrate --force';
	const releaseField = () => page.getByRole('textbox', { name: RELEASE_COMMAND_LABEL });

	it('says in one line when the command runs, with the full explanation one click away', async () => {
		await renderTab();
		await openAdvanced();

		await expect.element(releaseField()).toHaveValue('');
		// An example in the field reads like a value that is already set.
		await expect
			.element(releaseField())
			.toHaveAttribute('placeholder', RELEASE_COMMAND_PLACEHOLDER);
		await expect
			.element(releaseField())
			.toHaveAccessibleDescription(SETTINGS_FIELD_HINTS.releaseCommand);

		const learnMore = page.getByTestId('advanced-learn-more');
		const explanation = learnMore.getByText(RELEASE_COMMAND_HELP, { exact: false });
		await expect.element(explanation).not.toBeVisible();
		await learnMore.getByText('Pelajari').click();
		await expect.element(explanation).toBeVisible();
	});

	it('saves a new command alone, then says the project needs a redeploy', async () => {
		await renderTab();
		await openAdvanced();

		await userEvent.fill(releaseField(), `  ${migrate} `);
		await save().click();

		await expect.poll(() => saved).toEqual([{ release_command: migrate }]);
		await expect
			.element(page.getByText('Perubahan tersimpan. Berlaku mulai deployment berikutnya.'))
			.toBeVisible();
		await expect.element(page.getByText(REDEPLOY_REQUIRED_COPY.settings)).toBeVisible();
		await expect.element(releaseField()).toHaveValue(migrate);
	});

	it('clears a saved command by sending null', async () => {
		project = { ...project, release_command: migrate };
		await renderTab();
		await expect.element(releaseField()).toHaveValue(migrate);

		await userEvent.clear(releaseField());
		await save().click();

		await expect.poll(() => saved).toEqual([{ release_command: null }]);
		await expect.element(releaseField()).toHaveValue('');
	});

	it('refuses a command over 1000 characters before sending', async () => {
		await renderTab();
		await openAdvanced();

		await userEvent.fill(releaseField(), 'a'.repeat(1001));
		await save().click();

		await expect
			.element(releaseField())
			.toHaveAccessibleDescription('Release command paling panjang 1000 karakter.');
		expect(saved).toEqual([]);
	});

	it('shows the API refusal on the field', async () => {
		const refusal = 'Perintah rilis harus satu baris.';
		vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
			const request = new Request(input, init);
			if (request.method === 'PUT') {
				return json(422, {
					message: 'Data tidak valid.',
					errors: { release_command: [refusal] }
				});
			}
			return answer(request);
		});
		await renderTab();
		await openAdvanced();

		await userEvent.fill(releaseField(), migrate);
		await save().click();

		await expect.element(releaseField()).toHaveAccessibleDescription(refusal);
	});

	it('shows the command to a viewer as a fact', async () => {
		const team = { ...personalWorkspace, id: 'team-workspace', type: 'team', role: 'viewer' };
		project = {
			...project,
			release_command: migrate,
			workspace: { id: team.id, name: team.name, slug: team.slug, type: team.type }
		};
		vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
			const request = new Request(input, init);
			if (new URL(request.url).pathname === '/api/v1/app/workspaces') {
				return json(200, {
					data: [{ ...team, projects_count: 1, active_deployments_count: 0 }]
				});
			}
			return answer(request);
		});
		await renderTab();

		await expect.element(page.getByTestId('settings-read-only')).toHaveTextContent(migrate);
		await expect.element(releaseField()).not.toBeInTheDocument();
	});
});

describe('ProjectSettingsTab, panel', () => {
	it('shows the address in the panel instead of a disabled subdomain field', async () => {
		await renderTab();

		await expect
			.element(page.getByTestId('settings-summary-address'))
			.toHaveTextContent('toko-kopi-web.sakala.app');
		await expect.element(page.getByLabelText('Subdomain, dibuat otomatis')).not.toBeInTheDocument();
	});

	it('marks unsaved changes in the panel until they are saved', async () => {
		await renderTab();
		await expect.element(page.getByTestId('settings-summary-unsaved')).not.toBeInTheDocument();

		await userEvent.fill(page.getByRole('textbox', { name: 'Nama proyek' }), 'kopi-baru');
		await expect
			.element(page.getByTestId('settings-summary-unsaved'))
			.toHaveTextContent(SETTINGS_PANEL_COPY.unsaved);

		await save().click();
		await expect.poll(() => saved).toEqual([{ name: 'kopi-baru' }]);
		await expect.element(page.getByTestId('settings-summary-unsaved')).not.toBeInTheDocument();
	});
});

describe('ProjectSettingsTab, sections', () => {
	const releaseField = () => page.getByRole('textbox', { name: RELEASE_COMMAND_LABEL });

	it('groups the form under Umum, Build dan start, and Lanjutan, then the panel, with the danger zone last', async () => {
		await renderTab();

		const form = page.getByTestId('form-page-main').getByRole('heading', { level: 2 });
		await expect.element(form.nth(0)).toHaveTextContent('Umum');
		await expect.element(form.nth(1)).toHaveTextContent('Build dan start');
		await expect.element(form.nth(2)).toHaveTextContent('Lanjutan');
		const headings = page.getByRole('heading', { level: 2 }).all();
		expect(headings.at(-1)?.element().textContent?.trim()).toBe('Zona berbahaya');
		await expect
			.element(page.getByRole('complementary', { name: SETTINGS_PANEL_COPY.label }))
			.toBeVisible();

		const links = page.getByRole('navigation', { name: 'Bagian pengaturan' }).getByRole('link');
		await expect.element(links.nth(0)).toHaveAttribute('href', '#umum');
		await expect.element(links.nth(3)).toHaveAttribute('href', '#zona-berbahaya');
	});

	it('keeps Lanjutan closed while it holds nothing, and the link at the top opens it', async () => {
		await renderTab();

		await expect.element(advancedToggle()).toHaveAttribute('aria-expanded', 'false');
		// Hidden fields are out of the accessibility tree too, so their role finds nothing.
		await expect.element(releaseField()).not.toBeInTheDocument();
		await expect.element(replicasField()).not.toBeInTheDocument();

		await page
			.getByRole('navigation', { name: 'Bagian pengaturan' })
			.getByRole('link', { name: 'Lanjutan' })
			.click();
		await expect.element(releaseField()).toBeVisible();
	});

	it('opens Lanjutan by itself when a release command is saved', async () => {
		project = { ...project, release_command: 'php artisan migrate --force' };
		await renderTab();

		await expect.element(advancedToggle()).toHaveAttribute('aria-expanded', 'true');
		await expect.element(releaseField()).toBeVisible();
	});

	it('opens Lanjutan by itself when the project runs more than one replica', async () => {
		project = { ...project, replicas: 2 };
		await renderTab();

		await expect.element(replicasField()).toBeVisible();
	});

	it('opens Lanjutan when a link lands on a field inside it', async () => {
		location.hash = '#releaseCommand';
		await renderTab();

		await expect.element(releaseField()).toBeVisible();
	});

	it('does not fold away under the cursor once a saved command is emptied and saved', async () => {
		project = { ...project, release_command: 'php artisan migrate --force' };
		await renderTab();

		await userEvent.clear(releaseField());
		await save().click();

		await expect.poll(() => saved).toEqual([{ release_command: null }]);
		await expect.element(releaseField()).toBeVisible();
	});
});

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
import { REDEPLOY_REQUIRED_COPY } from '../../presentation';
import { REPLICAS_COPY } from '../../replicas';
import ProjectSettingsTab from './ProjectSettingsTab.svelte';

vi.mock('$lib/config/public', () => ({ publicConfig: { apiUrl: 'http://api.test' } }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
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

beforeEach(() => {
	project = {
		...baseProject,
		replicas: 1,
		max_replicas: 4,
		serving_replicas: 1,
		replicas_ready: 1
	};
	saved = [];
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
	it('offers 1 to the workspace maximum, with the explanation', async () => {
		await renderTab();

		const field = replicasField();
		await expect.element(field).toBeEnabled();
		await expect.element(field).toHaveValue(1);
		await expect.element(field).toHaveAttribute('min', '1');
		await expect.element(field).toHaveAttribute('max', '4');
		await expect
			.element(field)
			.toHaveAccessibleDescription(
				`${REPLICAS_COPY.help} Paling banyak 4 replika di workspace ini.`
			);
	});

	it('is disabled with the reason when the workspace allows one replica', async () => {
		project = { ...project, max_replicas: 1 };
		await renderTab();

		await expect.element(replicasField()).toBeDisabled();
		await expect.element(replicasField()).toHaveAccessibleDescription(REPLICAS_COPY.unavailable);
	});

	it.each(['0', '5'])('refuses %s before sending', async (value) => {
		await renderTab();

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

		await userEvent.fill(replicasField(), '2');
		await save().click();

		await expect
			.element(replicasField())
			.toHaveAccessibleDescription(
				'Proyek di workspace ini paling banyak berjalan dengan 4 replika. Minta admin menaikkan batasnya bila butuh lebih.'
			);
	});
});

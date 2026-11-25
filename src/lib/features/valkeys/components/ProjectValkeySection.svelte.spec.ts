import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { getPilotLimits, parsePilotLimitsResponse } from '$lib/api/resources/pilot-limits';
import {
	attachValkey,
	detachValkey,
	listValkeys,
	parseValkeyAttachment,
	parseValkeyList
} from '$lib/api/resources/valkeys';
import { addEnvironmentVariable } from '$lib/features/projects/api';
import type { EnvironmentVariable, Project } from '$lib/features/projects/type';
import QueryTestHost from '$lib/testing/QueryTestHost.svelte';
import { errorFromValkeyFixture, getValkeyFixture } from '$lib/testing/valkey-fixtures';
import ProjectValkeySection from './ProjectValkeySection.svelte';

vi.mock('$lib/config/public', () => ({
	publicConfig: { apiUrl: 'http://api.test', appUrl: 'http://app.test' }
}));
vi.mock('$lib/api/resources/pilot-limits', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/resources/pilot-limits')>()),
	getPilotLimits: vi.fn()
}));
vi.mock('$lib/api/resources/valkeys', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/resources/valkeys')>()),
	attachValkey: vi.fn(),
	detachValkey: vi.fn(),
	listValkeys: vi.fn()
}));
vi.mock('$lib/features/projects/api', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/features/projects/api')>()),
	addEnvironmentVariable: vi.fn()
}));

const project = (getValkeyFixture('project-with-valkey').body as { data: Project }).data;
const overridden = (getValkeyFixture('project-with-valkey-overridden').body as { data: Project })
	.data;
const without = (getValkeyFixture('project-without-valkey').body as { data: Project }).data;
const flagOff = (getValkeyFixture('project-valkey-off').body as { data: Project }).data;
const laravel = { ...project, stack: { framework: 'Laravel', provider: 'php' } } as Project;
const opened = parsePilotLimitsResponse(getValkeyFixture('pilot-limits-valkeys-empty').body);
const closed = parsePilotLimitsResponse(getValkeyFixture('pilot-limits-valkeys-zero').body);

function renderSection(
	props: {
		project?: Project;
		readOnly?: boolean;
		projectValues?: Map<string, string | null>;
	} = {}
) {
	render(QueryTestHost, {
		props: {
			component: ProjectValkeySection,
			props: { project, readOnly: false, projectValues: new Map(), ...props }
		}
	});
}

beforeEach(() => {
	vi.mocked(getPilotLimits).mockReset();
	vi.mocked(addEnvironmentVariable).mockReset();
	vi.mocked(attachValkey).mockReset();
	vi.mocked(detachValkey).mockReset();
	vi.mocked(listValkeys).mockReset();
});

describe('ProjectValkeySection', () => {
	it('lists the injected names with hidden values and the mode, without asking for the password', async () => {
		renderSection();
		const section = page.getByTestId('valkey-variables');
		await expect.element(section).toHaveTextContent('Dari Valkey antrean-toko');
		await expect.element(section).toHaveTextContent('Persisten');
		for (const name of ['REDIS_URL', 'REDIS_HOST', 'REDIS_PORT', 'REDIS_PASSWORD']) {
			await expect
				.element(page.getByTestId(`valkey-variable-${name}`))
				.toHaveTextContent(/nilai disembunyikan/);
		}
		await expect
			.element(page.getByTestId('valkey-variables-cache-warning'))
			.not.toBeInTheDocument();
	});

	it('marks the variable the project overrides', async () => {
		renderSection({ project: overridden });
		await expect
			.element(page.getByTestId('valkey-variable-REDIS_URL'))
			.toHaveTextContent(/Ditimpa proyek/);
		await expect.element(page.getByTestId('valkey-variables-conflict')).toBeVisible();
	});

	it('suggests the missing Laravel variables and adds them as plain variables', async () => {
		vi.mocked(addEnvironmentVariable).mockResolvedValue({
			id: 9,
			key: 'CACHE_STORE',
			is_secret: false
		} as unknown as EnvironmentVariable);
		renderSection({ project: laravel, projectValues: new Map([['QUEUE_CONNECTION', 'database']]) });
		const hint = page.getByTestId('valkey-laravel-hint');
		await expect
			.element(page.getByTestId('valkey-laravel-different-QUEUE_CONNECTION'))
			.toHaveTextContent(/sekarang database/);
		await page.getByTestId('add-valkey-laravel-variables').click();
		expect(addEnvironmentVariable).toHaveBeenCalledWith(project.id, {
			key: 'CACHE_STORE',
			value: 'redis',
			is_secret: false
		});
		await expect.element(hint).toBeVisible();
	});

	it('warns that a cache store does not keep queues or sessions', async () => {
		renderSection({
			project: { ...project, valkeys: [{ ...project.valkeys![0], mode: 'cache' }] } as Project
		});
		await expect
			.element(page.getByTestId('valkey-variables-cache-warning'))
			.toHaveTextContent(/Jangan dipakai untuk antrean atau sesi/);
	});

	it('detaches from the project after a confirmation', async () => {
		vi.mocked(detachValkey).mockResolvedValue(undefined);
		renderSection();
		await page.getByTestId('detach-project-valkey').click();
		await page.getByRole('button', { name: 'Lepas Valkey' }).click();
		expect(detachValkey).toHaveBeenCalledWith(
			project.workspace!.id,
			project.valkeys![0].id,
			project.id
		);
	});

	it('offers to attach a ready store, and explains a store on another server', async () => {
		vi.mocked(getPilotLimits).mockResolvedValue(opened);
		vi.mocked(listValkeys).mockResolvedValue(parseValkeyList(getValkeyFixture('valkeys').body));
		vi.mocked(attachValkey).mockRejectedValue(errorFromValkeyFixture('attach-node-mismatch'));
		renderSection({ project: without });
		await expect
			.element(page.getByTestId('create-project-valkey'))
			.toHaveAttribute('href', `/valkeys/new?project=${without.id}`);
		await page.getByTestId('attach-project-valkey').click();
		const dialog = page.getByTestId('attach-project-valkey-dialog');
		await expect.element(dialog.getByRole('radio', { name: /cache-gagal/ })).toBeDisabled();
		await dialog.getByRole('radio', { name: /antrean-toko/ }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Pasang Valkey' }).click();
		await expect
			.element(page.getByTestId('attach-project-valkey-error'))
			.toHaveTextContent(/berjalan di server lain/);
	});

	it('attaches and says the project needs a redeploy', async () => {
		vi.mocked(getPilotLimits).mockResolvedValue(opened);
		vi.mocked(listValkeys).mockResolvedValue(parseValkeyList(getValkeyFixture('valkeys').body));
		vi.mocked(attachValkey).mockResolvedValue(
			parseValkeyAttachment(getValkeyFixture('attach').body)
		);
		renderSection({ project: without });
		await page.getByTestId('attach-project-valkey').click();
		await page.getByRole('radio', { name: /antrean-toko/ }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Pasang Valkey' }).click();
		await expect.poll(() => vi.mocked(attachValkey).mock.calls.length).toBe(1);
		await expect.element(page.getByTestId('attach-project-valkey-dialog')).not.toBeInTheDocument();
	});

	it('stays quiet for a workspace not opened for Valkey, and while the flag is off', async () => {
		vi.mocked(getPilotLimits).mockResolvedValue(closed);
		renderSection({ project: without });
		await expect.poll(() => vi.mocked(getPilotLimits).mock.calls.length).toBeGreaterThan(0);
		await expect.element(page.getByTestId('valkey-variables-offer')).not.toBeInTheDocument();
	});

	it('renders nothing and asks nothing when the project has no valkeys key', async () => {
		expect(flagOff.valkeys).toBeUndefined();
		renderSection({ project: flagOff });
		await expect.element(page.getByTestId('valkey-variables')).not.toBeInTheDocument();
		expect(getPilotLimits).not.toHaveBeenCalled();
	});
});

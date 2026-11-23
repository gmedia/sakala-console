import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { getPilotLimits, parsePilotLimitsResponse } from '$lib/api/resources/pilot-limits';
import { addEnvironmentVariable } from '$lib/features/projects/api';
import type { EnvironmentVariable, Project, ProjectBucket } from '$lib/features/projects/type';
import QueryTestHost from '$lib/testing/QueryTestHost.svelte';
import { getBucketFixture } from '$lib/testing/bucket-fixtures';
import ProjectBucketVariables from './ProjectBucketVariables.svelte';

vi.mock('$lib/config/public', () => ({
	publicConfig: { apiUrl: 'http://api.test', appUrl: 'http://app.test' }
}));
vi.mock('$lib/api/resources/pilot-limits', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/resources/pilot-limits')>()),
	getPilotLimits: vi.fn()
}));
vi.mock('$lib/features/projects/api', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/features/projects/api')>()),
	addEnvironmentVariable: vi.fn()
}));

const project = (getBucketFixture('project-with-bucket').body as { data: Project }).data;
const bucket = project.buckets![0] as ProjectBucket;
const laravel = { ...project, stack: { framework: 'Laravel', provider: 'php' } } as Project;
const limits = parsePilotLimitsResponse(getBucketFixture('pilot-limits-buckets').body);

function renderVariables(
	props: { project?: Project; readOnly?: boolean; projectKeys?: Set<string> } = {}
) {
	render(QueryTestHost, {
		props: {
			component: ProjectBucketVariables,
			props: { project, readOnly: false, projectKeys: new Set<string>(), ...props }
		}
	});
}

beforeEach(() => {
	vi.mocked(getPilotLimits).mockReset();
	vi.mocked(addEnvironmentVariable).mockReset();
});

describe('ProjectBucketVariables', () => {
	it('lists the injected names with hidden values, and marks the one the project overrides', async () => {
		renderVariables({ projectKeys: new Set(['AWS_DEFAULT_REGION']) });
		const section = page.getByTestId('bucket-variables');
		await expect.element(section).toHaveTextContent(`Dari bucket ${bucket.name}`);
		await expect
			.element(page.getByTestId('bucket-variable-AWS_SECRET_ACCESS_KEY'))
			.toHaveTextContent(/nilai disembunyikan/);
		await expect
			.element(page.getByTestId('bucket-variable-AWS_DEFAULT_REGION'))
			.toHaveTextContent(/Ditimpa proyek/);
		await expect.element(page.getByTestId('bucket-variables-conflict')).toBeVisible();
		await expect.element(page.getByTestId('bucket-variables-key-conflict')).not.toBeInTheDocument();
	});

	it('warns harder when the project overrides the key pair', async () => {
		renderVariables({
			project: {
				...project,
				buckets: [{ ...bucket, overridden_variables: ['AWS_ACCESS_KEY_ID'] }]
			} as Project
		});
		await expect
			.element(page.getByTestId('bucket-variables-key-conflict'))
			.toHaveTextContent(/access key AWS miliknya sendiri/);
	});

	it('suggests FILESYSTEM_DISK=s3 to a Laravel project and adds it as a plain variable', async () => {
		vi.mocked(addEnvironmentVariable).mockResolvedValue({
			id: 9,
			key: 'FILESYSTEM_DISK',
			is_secret: false
		} as unknown as EnvironmentVariable);
		renderVariables({ project: laravel });
		await expect
			.element(page.getByTestId('bucket-filesystem-disk-hint'))
			.toHaveTextContent(/FILESYSTEM_DISK=s3/);
		await page.getByTestId('add-filesystem-disk').click();
		expect(addEnvironmentVariable).toHaveBeenCalledWith(project.id, {
			key: 'FILESYSTEM_DISK',
			value: 's3',
			is_secret: false
		});
	});

	it('leaves the hint out once the project sets FILESYSTEM_DISK, and for other stacks', async () => {
		renderVariables({ project: laravel, projectKeys: new Set(['FILESYSTEM_DISK']) });
		await expect.element(page.getByTestId('bucket-variables')).toBeVisible();
		await expect.element(page.getByTestId('bucket-filesystem-disk-hint')).not.toBeInTheDocument();
	});

	it('offers a bucket to a project without one only when the workspace can create it', async () => {
		vi.mocked(getPilotLimits).mockResolvedValue({
			...limits,
			quotas: { ...limits.quotas, max_buckets: 5 }
		});
		renderVariables({ project: { ...project, buckets: [] } as Project });
		await expect
			.element(page.getByTestId('create-project-bucket'))
			.toHaveAttribute('href', `/buckets?project=${project.id}`);
	});

	it('stays quiet for a workspace not opened for buckets', async () => {
		vi.mocked(getPilotLimits).mockResolvedValue(
			parsePilotLimitsResponse(getBucketFixture('pilot-limits-buckets-zero').body)
		);
		renderVariables({ project: { ...project, buckets: [] } as Project });
		await expect.poll(() => vi.mocked(getPilotLimits).mock.calls.length).toBeGreaterThan(0);
		await expect.element(page.getByTestId('bucket-variables-offer')).not.toBeInTheDocument();
	});
});

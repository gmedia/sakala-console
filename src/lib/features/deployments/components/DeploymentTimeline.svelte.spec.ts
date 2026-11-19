import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import DeploymentTimeline from './DeploymentTimeline.svelte';
import type { DeploymentStep } from '../type';

const PROJECT_ID = 'project-1';

function reusedSteps(imageSource: DeploymentStep['imageSource'], title: string): DeploymentStep[] {
	return [
		{ key: 'Queued', title: 'Menunggu antrean', status: 'success' },
		{ key: 'ImageReused', title, status: 'success', imageSource },
		{ key: 'Deploying', title: 'Deploy proyek', status: 'running' }
	];
}

describe('DeploymentTimeline with a reused image', () => {
	it('names the source deployment and links to it', async () => {
		await render(DeploymentTimeline, {
			projectId: PROJECT_ID,
			steps: reusedSteps(
				{ deploymentId: 'deployment-12', sequence: 12 },
				'Memakai image dari deployment #12 (tanpa build)'
			)
		});

		const items = page.getByRole('listitem');
		await expect
			.element(items.nth(1))
			.toHaveTextContent('Memakai image dari deployment #12 (tanpa build)');
		await expect
			.element(page.getByRole('link', { name: '#12' }))
			.toHaveAttribute('href', `/projects/${PROJECT_ID}/deployments/deployment-12`);
		await expect.element(page.getByText('Menyalin repository')).not.toBeInTheDocument();
		await expect.element(page.getByText('Build proyek')).not.toBeInTheDocument();
	});

	it('says a deleted source without a link', async () => {
		await render(DeploymentTimeline, {
			projectId: PROJECT_ID,
			steps: reusedSteps(
				{ deploymentId: null, sequence: null },
				'Memakai image dari deployment yang sudah dihapus (tanpa build)'
			)
		});

		await expect
			.element(page.getByText('Memakai image dari deployment yang sudah dihapus (tanpa build)'))
			.toBeVisible();
		await expect.element(page.getByRole('link')).not.toBeInTheDocument();
	});

	it('keeps the stopped suffix after the linked title', async () => {
		await render(DeploymentTimeline, {
			projectId: PROJECT_ID,
			steps: [
				{
					key: 'ImageReused',
					title: 'Memakai image dari deployment #12 (tanpa build)',
					status: 'failed',
					imageSource: { deploymentId: 'deployment-12', sequence: 12 }
				}
			]
		});

		await expect
			.element(page.getByRole('listitem'))
			.toHaveTextContent('Memakai image dari deployment #12 (tanpa build) - gagal');
	});
});

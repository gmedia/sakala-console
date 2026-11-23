import { page, userEvent } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { Deployment } from '../../type';
import DeploymentRow from './DeploymentRow.svelte';

const deployment: Deployment = {
	id: 'deployment-14',
	project_id: 'project-1',
	sequence: 14,
	branch: 'main',
	status: 'succeeded',
	trigger: 'manual',
	commit_sha: 'a3f2c9d0',
	commit_message: 'feat: menu baru',
	image_reference: null,
	requested_resources: null,
	effective_resources: null,
	started_at: '2026-11-19T10:00:00Z',
	finished_at: '2026-11-19T10:00:40Z',
	cancelled_at: null,
	failure_code: null,
	failure_summary: null,
	is_active: true,
	cancel_requested_at: null,
	queue_state: null,
	failure: null,
	created_at: '2026-11-19T10:00:00Z',
	updated_at: '2026-11-19T10:00:40Z'
};

describe('DeploymentRow and image reuse', () => {
	it('labels a reused deployment in words, and says so to a screen reader', async () => {
		await render(DeploymentRow, {
			deployment: {
				...deployment,
				build: {
					mode: 'reused',
					image_source_deployment_id: 'deployment-12',
					image_source_sequence: 12,
					fallback_reason: null
				}
			}
		});

		await expect
			.element(page.getByTestId('deployment-row-reuse'))
			.toHaveTextContent('Tanpa build · image #12');
		await expect
			.element(page.getByRole('link'))
			.toHaveAccessibleName(
				'Deployment #14, Berhasil, tanpa build, memakai image deployment #12: feat: menu baru'
			);
	});

	it('adds nothing for a built deployment or an API without the field', async () => {
		await render(DeploymentRow, { deployment });

		await expect.element(page.getByTestId('deployment-row-reuse')).not.toBeInTheDocument();
		await expect
			.element(page.getByRole('link'))
			.toHaveAccessibleName('Deployment #14, Berhasil: feat: menu baru');
	});
});

describe('DeploymentRow in the history', () => {
	it('marks the serving version in words, and says so to a screen reader', async () => {
		await render(DeploymentRow, {
			deployment,
			serving: true,
			triggerNote: 'Rani, redeploy manual'
		});

		await expect
			.element(page.getByTestId('deployment-row-serving'))
			.toHaveTextContent('Sedang melayani');
		await expect
			.element(page.getByTestId('deployment-row-trigger'))
			.toHaveTextContent('Rani, redeploy manual');
		await expect
			.element(page.getByRole('link'))
			.toHaveAccessibleName(
				'Deployment #14, Berhasil, sedang melayani, Rani, redeploy manual: feat: menu baru'
			);
	});

	it('opens "Kembalikan ke versi ini" from the row menu, after the link by keyboard', async () => {
		const onRollback = vi.fn();
		await render(DeploymentRow, {
			deployment: { ...deployment, is_active: false },
			withActions: true,
			onRollback
		});

		(page.getByRole('link').element() as HTMLElement).focus();
		await userEvent.tab();
		const menu = page.getByRole('button', { name: 'Pilihan untuk deployment #14' });
		await expect.element(menu).toHaveFocus();
		await userEvent.keyboard('{Enter}');
		await expect
			.element(page.getByRole('menuitem', { name: 'Kembalikan ke versi ini' }))
			.toHaveFocus();
		await userEvent.keyboard('{Enter}');

		expect(onRollback).toHaveBeenCalledOnce();
	});

	it('keeps the menu column empty for a row that cannot be rolled back to', async () => {
		await render(DeploymentRow, { deployment, withActions: true });

		await expect.element(page.getByRole('button')).not.toBeInTheDocument();
	});
});

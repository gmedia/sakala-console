import { page, userEvent } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { REDEPLOY_COPY } from '../../presentation';
import RedeployButton from './RedeployButton.svelte';

describe('RedeployButton', () => {
	it('redeploys without asking for a build, so the API decides', async () => {
		const onRedeploy = vi.fn();
		await render(RedeployButton, { onRedeploy, offerForceBuild: true });

		await page.getByRole('button', { name: 'Redeploy' }).click();

		expect(onRedeploy).toHaveBeenCalledExactlyOnceWith({});
	});

	it('reaches "Build ulang dari awal" by keyboard, with how it differs said beside it', async () => {
		const onRedeploy = vi.fn();
		await render(RedeployButton, { onRedeploy, offerForceBuild: true });

		await userEvent.tab();
		await expect.element(page.getByRole('button', { name: 'Redeploy' })).toHaveFocus();
		await userEvent.tab();
		const trigger = page.getByRole('button', { name: REDEPLOY_COPY.menuLabel });
		await expect.element(trigger).toHaveFocus();

		await userEvent.keyboard('{Enter}');
		const forceBuild = page.getByRole('menuitem', { name: REDEPLOY_COPY.forceBuild.label });
		await expect.element(forceBuild).toBeVisible();
		await expect
			.element(forceBuild)
			.toHaveAccessibleDescription(REDEPLOY_COPY.forceBuild.description);
		await expect
			.element(page.getByRole('menuitem', { name: REDEPLOY_COPY.reuse.label }))
			.toHaveAccessibleDescription(REDEPLOY_COPY.reuse.description);

		// Opening by keyboard puts focus on the first item, Redeploy.
		await userEvent.keyboard('{ArrowDown}');
		await expect.element(forceBuild).toHaveFocus();
		await userEvent.keyboard('{Enter}');

		expect(onRedeploy).toHaveBeenCalledExactlyOnceWith({ forceBuild: true });
		await expect.element(forceBuild).not.toBeInTheDocument();
		await expect.element(trigger).toHaveFocus();
	});

	it('has no menu where there is no live image to reuse', async () => {
		await render(RedeployButton, { onRedeploy: vi.fn() });

		await expect.element(page.getByRole('button', { name: 'Redeploy' })).toBeVisible();
		await expect
			.element(page.getByRole('button', { name: REDEPLOY_COPY.menuLabel }))
			.not.toBeInTheDocument();
	});

	it('disables both parts while busy', async () => {
		await render(RedeployButton, {
			onRedeploy: vi.fn(),
			offerForceBuild: true,
			busy: true,
			disabled: true,
			label: REDEPLOY_COPY.busy
		});

		await expect.element(page.getByRole('button', { name: REDEPLOY_COPY.busy })).toBeDisabled();
		await expect
			.element(page.getByRole('button', { name: REDEPLOY_COPY.menuLabel }))
			.toBeDisabled();
	});
});

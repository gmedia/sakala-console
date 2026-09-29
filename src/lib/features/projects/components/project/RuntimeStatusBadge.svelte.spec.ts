import { page } from 'vitest/browser';
import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';
import RuntimeStatusBadge from './RuntimeStatusBadge.svelte';
import type { RuntimeStatus } from '$lib/api/resources/projects';

describe('RuntimeStatusBadge', () => {
	test.each<[RuntimeStatus, string]>([
		['running', 'Live'],
		['failed', 'Gagal'],
		['stopped', 'Berhenti'],
		['crashed', 'Gagal'],
		['deploying', 'Mendeploy'],
		['not_deployed', 'Belum Deploy']
	])('menampilkan label "%s" -> "%s"', async (runtimeStatus, expectedLabel) => {
		await render(RuntimeStatusBadge, { runtimeStatus });

		await expect.element(page.getByText(expectedLabel, { exact: true })).toBeVisible();
	});

	test('fallback ke "Lainnya" untuk runtime status yang tidak dikenal', async () => {
		await render(RuntimeStatusBadge, {
			runtimeStatus: 'maintenance'
		});

		await expect.element(page.getByText('Lainnya', { exact: true })).toBeVisible();
	});
});

import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { goto } from '$app/navigation';
import {
	deleteValkey,
	parseValkey,
	parseValkeyList,
	type Valkey
} from '$lib/api/resources/valkeys';
import QueryTestHost from '$lib/testing/QueryTestHost.svelte';
import { getValkeyFixture } from '$lib/testing/valkey-fixtures';
import ValkeyDangerZone from './ValkeyDangerZone.svelte';

vi.mock('$app/navigation', () => ({ goto: vi.fn().mockResolvedValue(undefined) }));
vi.mock('$lib/config/public', () => ({
	publicConfig: { apiUrl: 'http://api.test', appUrl: 'http://app.test' }
}));
vi.mock('$lib/api/resources/valkeys', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/resources/valkeys')>()),
	deleteValkey: vi.fn()
}));

const all = parseValkeyList(getValkeyFixture('valkeys').body);
const queue = all.find((valkey) => valkey.name === 'antrean-toko')!;
const locked = all.find((valkey) => valkey.name === 'sesi-lama')!;

const renderCard = (valkey: Valkey) =>
	render(QueryTestHost, {
		props: {
			component: ValkeyDangerZone,
			props: { valkey, workspaceId: 'ws-1' }
		}
	});

beforeEach(() => {
	vi.mocked(deleteValkey).mockReset();
	vi.mocked(goto).mockClear();
});

describe('ValkeyDangerZone', () => {
	it('blocks deleting while projects are attached, and says which', async () => {
		renderCard(queue);
		await expect.element(page.getByTestId('delete-valkey')).toBeDisabled();
		await expect
			.element(page.getByTestId('valkey-delete-blocked'))
			.toHaveTextContent(/Masih dipasang ke toko-kopi-web/);
	});

	it('deletes a free store after its name is typed', async () => {
		vi.mocked(deleteValkey).mockResolvedValue(parseValkey(getValkeyFixture('valkey-delete').body));
		renderCard(locked);
		await page.getByTestId('delete-valkey').click();
		const confirm = page.getByRole('button', { name: 'Hapus Valkey ini' });
		await expect.element(confirm).toBeDisabled();
		await page.getByLabelText(/untuk konfirmasi/).fill('sesi-lama');
		await confirm.click();
		expect(deleteValkey).toHaveBeenCalledWith('ws-1', locked.id);
		await expect.poll(() => vi.mocked(goto).mock.calls.length).toBe(1);
	});
});

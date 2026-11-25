import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { goto } from '$app/navigation';
import {
	deleteValkey,
	parseValkey,
	parseValkeyList,
	updateValkey,
	type Valkey
} from '$lib/api/resources/valkeys';
import QueryTestHost from '$lib/testing/QueryTestHost.svelte';
import { errorFromValkeyFixture, getValkeyFixture } from '$lib/testing/valkey-fixtures';
import ValkeySettingsCard from './ValkeySettingsCard.svelte';

vi.mock('$app/navigation', () => ({ goto: vi.fn().mockResolvedValue(undefined) }));
vi.mock('$lib/config/public', () => ({
	publicConfig: { apiUrl: 'http://api.test', appUrl: 'http://app.test' }
}));
vi.mock('$lib/api/resources/valkeys', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/resources/valkeys')>()),
	deleteValkey: vi.fn(),
	updateValkey: vi.fn()
}));

const all = parseValkeyList(getValkeyFixture('valkeys').body);
const queue = all.find((valkey) => valkey.name === 'antrean-toko')!;
const locked = all.find((valkey) => valkey.name === 'sesi-lama')!;
const cache = parseValkey(getValkeyFixture('valkey-show-cache').body);
const pending = parseValkey(getValkeyFixture('valkey-show-pending-resize').body);

const renderCard = (valkey: Valkey, availableMb: number | null = 0) =>
	render(QueryTestHost, {
		props: {
			component: ValkeySettingsCard,
			props: { valkey, workspaceId: 'ws-1', sizes: [32, 64, 128], availableMb }
		}
	});

beforeEach(() => {
	vi.mocked(deleteValkey).mockReset();
	vi.mocked(updateValkey).mockReset();
	vi.mocked(goto).mockClear();
});

describe('ValkeySettingsCard', () => {
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

	it('offers only the sizes that fit the workspace, counting the store own size', async () => {
		renderCard(queue, 0);
		const group = page.getByTestId('valkey-size-options');
		await expect.element(group.getByRole('radio', { name: '32 MB' })).toBeEnabled();
		await expect.element(group.getByRole('radio', { name: '64 MB' })).toBeChecked();
		await expect.element(group.getByRole('radio', { name: '128 MB' })).toBeDisabled();
		await expect.element(group).toHaveTextContent(/Melebihi sisa jatah memori workspace/);
	});

	it('warns before shrinking, in the words of the mode, and sends the new size', async () => {
		vi.mocked(updateValkey).mockResolvedValue(parseValkey(getValkeyFixture('valkey-resize').body));
		renderCard(queue, 96);
		await page.getByRole('radio', { name: '32 MB' }).click();
		await expect
			.element(page.getByTestId('valkey-resize-shrink'))
			.toHaveTextContent(/selama datanya masih muat/);
		await page.getByTestId('save-valkey-size').click();
		expect(updateValkey).toHaveBeenCalledWith('ws-1', queue.id, { maxmemory_mb: 32 });
	});

	it('says a cache store drops keys when shrunk, and shows a refused growth in words', async () => {
		vi.mocked(updateValkey).mockRejectedValue(errorFromValkeyFixture('valkey-resize-memory-limit'));
		renderCard(cache, null);
		await page.getByRole('radio', { name: '128 MB' }).click();
		await page.getByTestId('save-valkey-size').click();
		await expect.element(page.getByRole('alert')).toHaveTextContent(/melebihi sisa jatah memori/);
	});

	it('waits for a resize on its way', async () => {
		renderCard(pending, 96);
		await expect
			.element(page.getByTestId('valkey-size-options'))
			.toHaveTextContent(/masih diterapkan/);
		await expect.element(page.getByTestId('save-valkey-size')).toBeDisabled();
	});
});

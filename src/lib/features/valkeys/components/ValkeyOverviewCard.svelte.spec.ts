import { page, userEvent } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import {
	parseValkey,
	parseValkeyList,
	updateValkey,
	type Valkey
} from '$lib/api/resources/valkeys';
import QueryTestHost from '$lib/testing/QueryTestHost.svelte';
import { errorFromValkeyFixture, getValkeyFixture } from '$lib/testing/valkey-fixtures';
import ValkeyOverviewCard from './ValkeyOverviewCard.svelte';

vi.mock('$app/navigation', () => ({
	goto: vi.fn(),
	replaceState: vi.fn(),
	afterNavigate: vi.fn()
}));
vi.mock('$app/state', () => ({ page: { url: new URL('http://app.test/valkeys/v'), state: {} } }));
vi.mock('$lib/config/public', () => ({
	publicConfig: { apiUrl: 'http://api.test', appUrl: 'http://app.test' }
}));
vi.mock('$lib/api/resources/valkeys', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/resources/valkeys')>()),
	updateValkey: vi.fn()
}));

const all = parseValkeyList(getValkeyFixture('valkeys').body);
const queue = all.find((valkey) => valkey.name === 'antrean-toko')!;
const cache = parseValkey(getValkeyFixture('valkey-show-cache').body);
const pending = parseValkey(getValkeyFixture('valkey-show-pending-resize').body);

const renderCard = (valkey: Valkey, availableMb: number | null = 0, canManage = true) =>
	render(QueryTestHost, {
		props: {
			component: ValkeyOverviewCard,
			props: { valkey, workspaceId: 'ws-1', canManage, sizes: [32, 64, 128], availableMb }
		}
	});

const editSize = () => page.getByRole('button', { name: 'Ubah ukuran Valkey' });

beforeEach(() => {
	vi.mocked(updateValkey).mockReset();
});

describe('ValkeyOverviewCard editing in place', () => {
	it('gives a viewer the values without any way to edit them', async () => {
		renderCard(queue, 0, false);
		await expect.element(page.getByTestId('valkey-size-value')).toHaveTextContent('64 MB');
		await expect.element(page.getByRole('button', { name: /^Ubah/ })).not.toBeInTheDocument();
	});

	it('offers only the sizes that fit the workspace, with the current one focused', async () => {
		renderCard(queue, 0);
		await editSize().click();
		const group = page.getByTestId('valkey-size-options');
		await expect.element(group.getByRole('radio', { name: '32 MB' })).toBeEnabled();
		await expect.element(group.getByRole('radio', { name: '64 MB' })).toBeChecked();
		await expect.element(group.getByRole('radio', { name: '64 MB' })).toHaveFocus();
		await expect.element(group.getByRole('radio', { name: '128 MB' })).toBeDisabled();
		await expect.element(group).toHaveTextContent(/Melebihi sisa jatah memori workspace/);
		await userEvent.keyboard('{Escape}');
		await expect.element(group).not.toBeInTheDocument();
		await expect.element(editSize()).toHaveFocus();
	});

	it('warns before shrinking, in the words of the mode, and sends the new size', async () => {
		vi.mocked(updateValkey).mockResolvedValue(parseValkey(getValkeyFixture('valkey-resize').body));
		renderCard(queue, 96);
		await editSize().click();
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
		await editSize().click();
		await page.getByRole('radio', { name: '128 MB' }).click();
		await page.getByTestId('save-valkey-size').click();
		await expect.element(page.getByRole('alert')).toHaveTextContent(/melebihi sisa jatah memori/);
	});

	it('shows a resize on its way beside the size, and waits for it', async () => {
		renderCard(pending, 96);
		await expect.element(page.getByTestId('valkey-size-value')).toHaveTextContent(/menjadi/);
		await editSize().click();
		await expect
			.element(page.getByTestId('valkey-size-options'))
			.toHaveTextContent(/masih diterapkan/);
		await expect.element(page.getByTestId('save-valkey-size')).toBeDisabled();
	});

	it('renames in place', async () => {
		vi.mocked(updateValkey).mockResolvedValue({ ...queue, name: 'antrean-baru' });
		renderCard(queue);
		await page.getByRole('button', { name: 'Ubah nama Valkey' }).click();
		await page.getByLabelText('Nama Valkey', { exact: true }).fill('antrean-baru');
		await page.getByRole('button', { name: 'Simpan nama' }).click();
		expect(updateValkey).toHaveBeenCalledWith('ws-1', queue.id, { name: 'antrean-baru' });
	});
});

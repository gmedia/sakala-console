import { page, userEvent } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import BranchCombobox from './BranchCombobox.svelte';

const branches = ['main', 'develop', 'feat/checkout', 'release/2026'];

function setup(overrides: Record<string, unknown> = {}) {
	const onValueChange = vi.fn();
	return {
		onValueChange,
		screen: render(BranchCombobox, {
			id: 'branch',
			value: 'main',
			branches,
			onValueChange,
			...overrides
		})
	};
}

describe('BranchCombobox (U-36)', () => {
	it('shows the selected branch, and offers only what the API returned', async () => {
		setup();
		const input = page.getByRole('combobox');

		await expect.element(input).toHaveValue('main');

		await page.getByRole('button', { name: 'Tampilkan daftar branch' }).click();

		await expect.element(page.getByRole('option', { name: 'feat/checkout' })).toBeVisible();
		await expect.element(page.getByRole('option')).toHaveLength(4);
	});

	it('narrows the list as the user types, and picks with the keyboard', async () => {
		const { onValueChange } = setup();
		const input = page.getByRole('combobox');

		await input.click();
		await input.fill('rel');

		await expect.element(page.getByRole('option', { name: 'release/2026' })).toBeVisible();
		await expect.element(page.getByRole('option', { name: 'main' })).not.toBeInTheDocument();

		await userEvent.keyboard('{Enter}');

		expect(onValueChange).toHaveBeenCalledWith('release/2026');
	});

	it('says so when nothing matches, and does not accept the typed name', async () => {
		const { onValueChange } = setup();
		const input = page.getByRole('combobox');

		await input.click();
		await input.fill('tidak-ada');

		await expect.element(page.getByText('Tidak ada branch dengan nama itu.')).toBeVisible();
		await userEvent.keyboard('{Enter}');

		expect(onValueChange).not.toHaveBeenCalled();
	});

	it('restores the selection when a search is abandoned', async () => {
		setup();
		const input = page.getByRole('combobox');

		await input.click();
		await input.fill('tidak-ada');
		await userEvent.keyboard('{Escape}');

		await expect.element(input).toHaveValue('main');
	});

	it('accepts another name only when the list is known to be cut off', async () => {
		const { onValueChange } = setup({ allowOther: true });
		const input = page.getByRole('combobox');

		await input.click();
		await input.fill('branch-ke-101');
		await page.getByRole('option', { name: 'Pakai branch "branch-ke-101"' }).click();

		expect(onValueChange).toHaveBeenCalledWith('branch-ke-101');
	});
});

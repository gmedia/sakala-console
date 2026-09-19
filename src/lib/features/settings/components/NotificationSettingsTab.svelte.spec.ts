import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import NotificationSettingsTab from './NotificationSettingsTab.svelte';

describe('NotificationSettingsTab', () => {
	it('mengubah isDirty saat toggle diubah dan kembali disabled setelah disimpan', async () => {
		render(NotificationSettingsTab);

		const saveButton = page.getByRole('button', { name: 'Simpan Perubahan' });
		await expect.element(saveButton).toBeDisabled();

		const toggle = page.getByRole('switch', { name: 'Perubahan Kata Sandi' });
		await toggle.click();

		await expect.element(saveButton).toBeEnabled();

		await saveButton.click();

		await expect.element(saveButton).toBeDisabled();
	});
});

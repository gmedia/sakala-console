import { page, userEvent } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import DialogTestHost from './DialogTestHost.svelte';

describe('Dialog', () => {
	it('closes on Escape when idle', async () => {
		await render(DialogTestHost);
		await expect.element(page.getByRole('dialog', { name: 'Hapus?' })).toBeVisible();

		await userEvent.keyboard('{Escape}');

		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
		await expect.element(page.getByTestId('closes')).toHaveTextContent('1');
	});

	it('refuses to close while the request is running', async () => {
		await render(DialogTestHost, { loading: true });
		await expect.element(page.getByRole('dialog')).toBeVisible();

		await userEvent.keyboard('{Escape}');

		await expect.element(page.getByRole('dialog')).toBeVisible();
		await expect.element(page.getByTestId('closes')).toHaveTextContent('0');
	});

	it('honours initialFocus and traps Tab inside', async () => {
		const onConfirm = vi.fn();
		await render(DialogTestHost, { onConfirm });

		const cancel = page.getByRole('button', { name: 'Batal' });
		const confirm = page.getByRole('button', { name: 'Konfirmasi' });
		await expect.element(cancel).toHaveFocus();

		await userEvent.tab();
		await expect.element(confirm).toHaveFocus();
		await userEvent.tab();
		await expect.element(cancel).toHaveFocus();
	});
});

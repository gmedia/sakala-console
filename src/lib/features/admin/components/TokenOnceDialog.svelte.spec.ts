import { page, userEvent } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TokenOnceDialog from './TokenOnceDialog.svelte';

const TOKEN = 'sk_agt_contoh_bukan_token_asli_1';

function props(overrides: Record<string, unknown> = {}) {
	return {
		open: true,
		token: TOKEN,
		agentId: 'agent-01a1cae3',
		agentName: 'agent-sby-01',
		apiUrl: 'https://api.sakala.test',
		onDone: vi.fn(),
		...overrides
	};
}

describe('TokenOnceDialog', () => {
	it('shows the token once, with the agent configuration, and says it will not come back', async () => {
		await render(TokenOnceDialog, props());

		const dialog = page.getByRole('dialog', { name: 'Token untuk agent-sby-01' });
		await expect.element(dialog).toHaveTextContent('Token ini hanya ditampilkan sekali');
		await expect.element(page.getByTestId('agent-token')).toHaveTextContent(TOKEN);
		await expect.element(dialog).toHaveTextContent('SAKALA_API_URL=https://api.sakala.test');
		await expect.element(dialog).toHaveTextContent('SAKALA_AGENT_ID=agent-01a1cae3');
		await expect.element(dialog).toHaveTextContent(`SAKALA_AGENT_TOKEN=${TOKEN}`);
		await expect.element(page.getByRole('button', { name: 'Salin token' })).toHaveFocus();
	});

	it('cannot be closed, by button or Escape, until the admin says the token is saved', async () => {
		const onDone = vi.fn();
		await render(TokenOnceDialog, props({ onDone }));
		const close = page.getByRole('button', { name: 'Tutup' });

		await expect.element(close).toHaveAccessibleDescription(/Centang dulu kotak di atas/);
		await close.click();
		await userEvent.keyboard('{Escape}');
		await expect.element(page.getByRole('dialog')).toBeVisible();
		expect(onDone).not.toHaveBeenCalled();
		const checkbox = page.getByLabelText('Saya sudah menyimpan token ini');
		await expect.element(checkbox).toHaveFocus();
		await expect.element(checkbox).toHaveAttribute('aria-invalid', 'true');
		await expect.element(page.getByRole('alert')).toHaveTextContent('Centang dulu kotak di atas.');

		await checkbox.click();
		await close.click();

		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
		expect(onDone).toHaveBeenCalledTimes(1);
	});

	it('closes on Escape once the token is saved', async () => {
		const onDone = vi.fn();
		await render(TokenOnceDialog, props({ onDone }));

		await page.getByLabelText('Saya sudah menyimpan token ini').click();
		await userEvent.keyboard('{Escape}');

		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
		expect(onDone).toHaveBeenCalledTimes(1);
	});

	it('tells the admin that a rotation already ended the old token', async () => {
		await render(TokenOnceDialog, props({ rotated: true }));
		await expect
			.element(page.getByRole('dialog'))
			.toHaveTextContent('Token lama node ini sudah tidak berlaku.');
	});
});

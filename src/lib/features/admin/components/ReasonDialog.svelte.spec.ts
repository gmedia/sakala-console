import { page, userEvent } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { apiErrorFromResponse } from '$lib/api/errors';
import ReasonDialog from './ReasonDialog.svelte';

function props(overrides: Record<string, unknown> = {}) {
	return {
		open: true,
		title: 'Tangguhkan proyek?',
		subject: 'Toko Kue · workspace Rani',
		consequence: 'Pemilik tidak bisa men-deploy sampai penangguhan dibuka.',
		confirmLabel: 'Tangguhkan',
		variant: 'destructive' as const,
		onConfirm: vi.fn(() => Promise.resolve()),
		...overrides
	};
}

describe('ReasonDialog', () => {
	it('names the project and the consequence, and puts focus on the reason, not the action', async () => {
		await render(ReasonDialog, props());

		const dialog = page.getByRole('dialog', { name: 'Tangguhkan proyek?' });
		await expect.element(dialog).toHaveTextContent('Toko Kue · workspace Rani');
		await expect.element(dialog).toHaveTextContent('Pemilik tidak bisa men-deploy');
		await expect.element(page.getByLabelText('Alasan')).toHaveFocus();
		await expect.element(page.getByRole('button', { name: 'Tangguhkan' })).not.toHaveFocus();
	});

	it('keeps the action disabled until a reason is written, blanks included', async () => {
		const onConfirm = vi.fn(() => Promise.resolve());
		await render(ReasonDialog, props({ onConfirm }));
		const confirm = page.getByRole('button', { name: 'Tangguhkan' });

		await expect.element(confirm).toBeDisabled();
		await userEvent.fill(page.getByLabelText('Alasan'), '   ');
		await expect.element(confirm).toBeDisabled();
		await userEvent.fill(page.getByLabelText('Alasan'), '  Konten phishing  ');
		await expect.element(confirm).toBeEnabled();

		await confirm.click();
		expect(onConfirm).toHaveBeenCalledWith('Konten phishing');
	});

	it('sends once on a double click while the request runs', async () => {
		let finish: () => void = () => {};
		const onConfirm = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
		await render(ReasonDialog, props({ onConfirm }));

		await userEvent.fill(page.getByLabelText('Alasan'), 'Penipuan');
		const confirm = page.getByRole('button', { name: 'Tangguhkan' });
		await confirm.dblClick({ force: true });
		await confirm.click({ force: true });

		expect(onConfirm).toHaveBeenCalledTimes(1);
		await expect.element(page.getByLabelText('Alasan')).toBeDisabled();
		finish();
		await expect.element(page.getByLabelText('Alasan')).toBeEnabled();
	});

	it('refuses a reason over 500 characters before sending', async () => {
		await render(ReasonDialog, props());
		await userEvent.fill(page.getByLabelText('Alasan'), 'a'.repeat(501));

		await expect.element(page.getByText('Alasan paling panjang 500 karakter.')).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Tangguhkan' })).toBeDisabled();
	});

	it('shows a conflict from the API in its own words, inside the dialog', async () => {
		const error = apiErrorFromResponse(409, { apiMessage: 'Proyek ini sudah ditangguhkan.' });
		await render(ReasonDialog, props({ error }));

		await expect
			.element(page.getByRole('alert'))
			.toHaveTextContent('Proyek ini sudah ditangguhkan.');
	});

	it('puts a validation error on the reason field', async () => {
		const error = apiErrorFromResponse(422, { errors: { reason: ['Kolom reason wajib diisi.'] } });
		await render(ReasonDialog, props({ error }));

		await expect.element(page.getByText('Kolom reason wajib diisi.')).toBeVisible();
		await expect.element(page.getByLabelText('Alasan')).toHaveAttribute('aria-invalid', 'true');
	});

	it('closes on cancel without sending', async () => {
		const onConfirm = vi.fn(() => Promise.resolve());
		const onCancel = vi.fn();
		await render(ReasonDialog, props({ onConfirm, onCancel }));

		await page.getByRole('button', { name: 'Batal' }).click();

		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
		expect(onCancel).toHaveBeenCalledTimes(1);
		expect(onConfirm).not.toHaveBeenCalled();
	});
});

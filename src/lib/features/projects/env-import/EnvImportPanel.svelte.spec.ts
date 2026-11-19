import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import EnvImportPanel from './EnvImportPanel.svelte';

// Ten variables, with a comment and blank lines, two of which the project already has.
const TEN_LINES = `# from my laptop
APP_NAME="Toko Kopi"
APP_ENV=production

APP_DEBUG=false
APP_URL=https://toko-kopi.sakala.app
DB_HOST=db.local
DB_PORT=5432
DB_DATABASE=kopi
DB_USERNAME=kopi
DB_PASSWORD=rahasia
MAIL_MAILER=log
`;

function renderPanel(overrides: Partial<Parameters<typeof render<typeof EnvImportPanel>>[1]> = {}) {
	const onApply = vi.fn();
	const onCancel = vi.fn();
	const screen = render(EnvImportPanel, {
		existingKeys: ['APP_ENV', 'DB_HOST'],
		confirmLabel: (count: number) => `Tambahkan ${count} variabel`,
		onApply,
		onCancel,
		...overrides
	});
	return { screen, onApply, onCancel };
}

describe('EnvImportPanel, in the browser', () => {
	it('reads a pasted .env with dotenv and shows 8 new and 2 existing', async () => {
		const { onApply } = renderPanel({ initialText: TEN_LINES });

		await expect
			.element(page.getByRole('status'))
			.toHaveTextContent('10 variabel terbaca: 8 baru, 2 sudah ada.');
		await expect
			.element(page.getByText('Untuk 2 variabel yang sudah ada (APP_ENV, DB_HOST)'))
			.toBeVisible();
		await expect
			.element(page.getByLabelText('Lewati, pertahankan nilai yang sekarang'))
			.toBeChecked();

		await page.getByRole('button', { name: 'Tambahkan 8 variabel' }).click();

		const [plan] = onApply.mock.calls[0];
		expect(plan.toAdd).toHaveLength(8);
		expect(plan.toOverwrite).toEqual([]);
		expect(plan.kept).toEqual(['APP_ENV', 'DB_HOST']);
		expect(plan.toAdd.every((env: { isSecret: boolean }) => env.isSecret)).toBe(true);
	});

	it('overwrites the existing keys only after the user picks Timpa', async () => {
		const { onApply } = renderPanel({ initialText: TEN_LINES });

		await page.getByLabelText('Timpa dengan nilai yang ditempel').click();
		await page.getByRole('button', { name: 'Tambahkan 10 variabel' }).click();

		const [plan] = onApply.mock.calls[0];
		expect(plan.toOverwrite.map((env: { key: string }) => env.key)).toEqual(['APP_ENV', 'DB_HOST']);
	});

	it('keeps credentials secret and names them when the rest are stored as plain values', async () => {
		const { onApply } = renderPanel({ initialText: TEN_LINES });

		await page.getByLabelText(/Simpan semua sebagai secret/).click();

		await expect
			.element(page.getByText(/terlihat seperti kredensial: DB_PASSWORD\./))
			.toBeVisible();
		await page.getByRole('button', { name: 'Tambahkan 8 variabel' }).click();
		const [plan] = onApply.mock.calls[0];
		const secret = plan.toAdd.filter((env: { isSecret: boolean }) => env.isSecret);
		expect(secret.map((env: { key: string }) => env.key)).toEqual(['DB_PASSWORD']);
	});

	it('leaves PORT out, says why, and passes its value on', async () => {
		const { onApply } = renderPanel({
			existingKeys: [],
			initialText: 'PORT=5000\nAPP_ENV=production',
			portNote: (port: string) => `Port proyek diisi ${port}.`
		});

		await expect
			.element(page.getByText(/PORT tidak ditambahkan[\s\S]*Port proyek diisi 5000\./))
			.toBeVisible();
		await page.getByRole('button', { name: 'Tambahkan 1 variabel' }).click();
		expect(onApply).toHaveBeenCalledWith(expect.anything(), '5000');
	});

	it('names lines it skipped instead of dropping them', async () => {
		renderPanel({ existingKeys: [], initialText: 'app-url=x\nEMPTY=\nhello world\nOK=1' });

		await expect
			.element(
				page.getByText(/Dilewati: app-url \(nama harus huruf besar.*EMPTY \(nilainya kosong\)/)
			)
			.toBeVisible();
		await expect.element(page.getByText('1 baris tidak terbaca')).toBeVisible();
	});

	it('Esc cancels, and nothing is applied while nothing was read', async () => {
		const { onCancel } = renderPanel();

		await expect.element(page.getByRole('button', { name: 'Tambahkan 0 variabel' })).toBeDisabled();
		await page.getByRole('textbox', { name: 'Isi file .env' }).click();
		await page
			.getByRole('textbox', { name: 'Isi file .env' })
			.element()
			.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		expect(onCancel).toHaveBeenCalled();
	});
});

import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { getAuthOptions, register } from '$lib/api/resources/auth';
import { apiErrorFromResponse } from '$lib/api/errors';
import QueryTestHost from '$lib/testing/QueryTestHost.svelte';
import RegisterPage from './+page.svelte';

const url = vi.hoisted(() => ({ current: new URL('http://localhost/register') }));

vi.mock('$app/state', () => ({
	page: {
		get url() {
			return url.current;
		}
	}
}));
vi.mock('$app/navigation', () => ({ goto: vi.fn().mockResolvedValue(undefined) }));
vi.mock('$lib/config/public', () => ({
	publicConfig: { apiUrl: 'http://api.test', appUrl: 'http://app.test' }
}));
vi.mock('$lib/api/resources/auth', () => ({
	changePassword: vi.fn(),
	forgotPassword: vi.fn(),
	getAuthOptions: vi.fn(),
	getCurrentUser: vi.fn(),
	login: vi.fn(),
	logout: vi.fn(),
	register: vi.fn(),
	acceptLegalDocuments: vi.fn(),
	deleteAccount: vi.fn(),
	exportAccountData: vi.fn(),
	requestEmailChange: vi.fn(),
	resendVerificationEmail: vi.fn(),
	resetPassword: vi.fn()
}));

const renderPage = (search = '') => {
	url.current = new URL(`http://localhost/register${search}`);
	return render(QueryTestHost, { props: { component: RegisterPage } });
};
const options = (email_delivery_enabled: boolean, google = false) => ({
	email_delivery_enabled,
	providers: { github: true, google },
	legal: {
		terms_version: 'syarat-v1',
		acceptable_use_version: 'penggunaan-wajar-v1',
		privacy_notice_version: 'privasi-v1'
	}
});
const fillForm = async () => {
	await page.getByLabelText('Email').fill('rani@sakala.local');
	await page.getByLabelText('Nama lengkap').fill('Rani');
	await page.getByLabelText('Kata sandi', { exact: true }).fill('kata-sandi-baru');
	await page.getByLabelText('Konfirmasi kata sandi', { exact: true }).fill('kata-sandi-baru');
};
const provider = (name: string) => page.getByRole('button', { name: `Daftar dengan ${name}` });

beforeEach(() => {
	vi.mocked(getAuthOptions).mockReset();
	vi.mocked(register).mockReset();
});

describe('register page and email delivery', () => {
	it('offers only GitHub and says why when delivery is off', async () => {
		vi.mocked(getAuthOptions).mockResolvedValue(options(false));
		renderPage();

		await expect
			.element(page.getByText('Pendaftaran lewat email belum tersedia. Masuk lewat GitHub dulu.'))
			.toBeVisible();
		await expect.element(provider('GitHub')).toBeVisible();
		await expect.element(provider('email')).not.toBeInTheDocument();
		await expect.element(provider('Google')).not.toBeInTheDocument();
	});

	it('does not show the form for a kept ?method=email link when delivery is off', async () => {
		vi.mocked(getAuthOptions).mockResolvedValue(options(false));
		renderPage('?method=email');

		await expect.element(provider('GitHub')).toBeVisible();
		await expect
			.element(page.getByRole('button', { name: 'Buat akun', exact: true }))
			.not.toBeInTheDocument();
		await expect.element(page.getByRole('heading', { name: 'Daftar', exact: true })).toBeVisible();
	});

	it('offers email when delivery is on', async () => {
		vi.mocked(getAuthOptions).mockResolvedValue(options(true));
		renderPage();

		await expect.element(provider('email')).toBeVisible();
		await expect.element(page.getByText('belum tersedia')).not.toBeInTheDocument();
	});

	it('shows the form for ?method=email when delivery is on', async () => {
		vi.mocked(getAuthOptions).mockResolvedValue(options(true));
		renderPage('?method=email');

		await expect
			.element(page.getByRole('button', { name: 'Buat akun', exact: true }))
			.toBeVisible();
	});

	it('shows no option and no form until the flag is known', async () => {
		vi.mocked(getAuthOptions).mockReturnValue(new Promise(() => {}));
		renderPage('?method=email');

		await expect
			.element(page.getByRole('progressbar', { name: 'Memuat pilihan yang tersedia' }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: 'Buat akun', exact: true }))
			.not.toBeInTheDocument();
	});

	it('does not reload the options when the resend mounts after a registration', async () => {
		vi.mocked(getAuthOptions).mockResolvedValue(options(true));
		vi.mocked(register).mockResolvedValue(undefined);
		renderPage('?method=email');

		await fillForm();
		await page.getByRole('checkbox').click();
		await page.getByRole('button', { name: 'Buat akun', exact: true }).click();

		await expect.element(page.getByText('Cek email kamu')).toBeVisible();
		await expect
			.element(page.getByRole('button', { name: 'Kirim ulang email verifikasi' }))
			.toBeVisible();
		expect(getAuthOptions).toHaveBeenCalledTimes(1);
	});

	it('shows the refusal from the API', async () => {
		vi.mocked(getAuthOptions).mockResolvedValue(options(true));
		vi.mocked(register).mockRejectedValue(
			apiErrorFromResponse(503, {
				code: 'EMAIL_DELIVERY_UNAVAILABLE',
				apiMessage: 'Sakala belum bisa mengirim email untuk saat ini.'
			})
		);
		renderPage('?method=email');

		await fillForm();
		await page.getByRole('checkbox').click();
		await page.getByRole('button', { name: 'Buat akun', exact: true }).click();

		await expect
			.element(page.getByText('Sakala belum bisa mengirim email untuk saat ini.'))
			.toBeVisible();
	});
});

describe('consent on the register form', () => {
	const CONSENT =
		'Saya berusia minimal 18 tahun atau sudah mendapat persetujuan orang tua atau wali, dan menyetujui Syarat Layanan dan Kebijakan Penggunaan Wajar.';

	it('asks in exactly the agreed words, with links to both documents', async () => {
		vi.mocked(getAuthOptions).mockResolvedValue(options(true));
		renderPage('?method=email');

		const box = page.getByRole('checkbox', { name: CONSENT });
		await expect.element(box).toBeVisible();
		await expect.element(box).not.toBeChecked();
		await expect
			.element(page.getByRole('link', { name: 'Syarat Layanan' }).first())
			.toHaveAttribute('href', 'https://sakala.dev/syarat');
		await expect
			.element(page.getByRole('link', { name: 'Kebijakan Penggunaan Wajar' }))
			.toHaveAttribute('href', 'https://sakala.dev/penggunaan-wajar');
	});

	it('gives the privacy notice a link and no box of its own', async () => {
		vi.mocked(getAuthOptions).mockResolvedValue(options(true));
		renderPage('?method=email');

		await expect
			.element(page.getByRole('link', { name: 'Pemberitahuan Privasi' }))
			.toHaveAttribute('href', 'https://sakala.dev/privasi');
		expect(page.getByRole('checkbox').all()).toHaveLength(1);
	});

	it('no longer says Sakala has no written terms', async () => {
		vi.mocked(getAuthOptions).mockResolvedValue(options(true));
		renderPage();

		await expect.element(provider('GitHub')).toBeVisible();
		await expect
			.element(page.getByText(/belum memiliki Ketentuan Layanan/))
			.not.toBeInTheDocument();
		await expect.element(page.getByRole('link', { name: 'Pemberitahuan Privasi' })).toBeVisible();
	});

	it('sends nothing until the box is ticked', async () => {
		vi.mocked(getAuthOptions).mockResolvedValue(options(true));
		renderPage('?method=email');

		await fillForm();
		await page.getByRole('button', { name: 'Buat akun', exact: true }).click();

		await expect.element(page.getByText(/Centang pernyataan ini dulu/)).toBeVisible();
		expect(register).not.toHaveBeenCalled();
	});

	it('sends the versions the form showed', async () => {
		vi.mocked(getAuthOptions).mockResolvedValue(options(true));
		vi.mocked(register).mockResolvedValue(undefined);
		renderPage('?method=email');

		await fillForm();
		await page.getByRole('checkbox').click();
		await page.getByRole('button', { name: 'Buat akun', exact: true }).click();

		await expect.element(page.getByText('Cek email kamu')).toBeVisible();
		expect(register).toHaveBeenCalledWith(
			expect.objectContaining({
				accept_terms: true,
				terms_version: 'syarat-v1',
				acceptable_use_version: 'penggunaan-wajar-v1'
			})
		);
	});

	it('cannot be submitted when the versions could not be read, and says why', async () => {
		vi.mocked(getAuthOptions).mockRejectedValue(new Error('offline'));
		renderPage('?method=email');

		await expect.element(page.getByText(/belum bisa dimuat/)).toBeVisible();
		await expect
			.element(page.getByRole('button', { name: 'Buat akun', exact: true }))
			.toBeDisabled();
		await expect.element(page.getByRole('button', { name: 'Coba lagi' })).toBeVisible();
	});

	it('unticks and explains when a document changed while the form was open', async () => {
		vi.mocked(getAuthOptions).mockResolvedValue(options(true));
		vi.mocked(register).mockRejectedValue(
			apiErrorFromResponse(422, { errors: { terms_version: ['Versi lama.'] } })
		);
		renderPage('?method=email');

		await fillForm();
		await page.getByRole('checkbox').click();
		await page.getByRole('button', { name: 'Buat akun', exact: true }).click();

		await expect.element(page.getByText(/baru saja diperbarui/)).toBeVisible();
		await expect.element(page.getByRole('checkbox')).not.toBeChecked();
	});
});

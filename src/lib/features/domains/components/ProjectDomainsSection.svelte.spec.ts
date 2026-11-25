import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { parsePilotLimitsResponse } from '$lib/api/resources/pilot-limits';
import {
	addProjectDomain,
	checkProjectDomain,
	deleteProjectDomain,
	listProjectDomains,
	parseProjectDomain,
	parseProjectDomainList
} from '$lib/api/resources/project-domains';
import QueryTestHost from '$lib/testing/QueryTestHost.svelte';
import { errorFromDomainFixture, getDomainFixture } from '$lib/testing/domain-fixtures';
import ProjectDomainsSection from './ProjectDomainsSection.svelte';

vi.mock('$lib/config/public', () => ({ publicConfig: { apiUrl: 'http://api.test' } }));
vi.mock('$app/state', () => ({ page: { url: new URL('http://app.test/projects/p/settings') } }));
vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('$lib/api/resources/project-domains', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/resources/project-domains')>()),
	listProjectDomains: vi.fn(),
	addProjectDomain: vi.fn(),
	checkProjectDomain: vi.fn(),
	deleteProjectDomain: vi.fn()
}));

const one = (name: string) => parseProjectDomain(getDomainFixture(name).body);
const limits = (name: string) => parsePilotLimitsResponse(getDomainFixture(name).body);

function renderSection(options: { fixture?: string; readOnly?: boolean } = {}) {
	return render(QueryTestHost, {
		props: {
			component: ProjectDomainsSection,
			props: {
				projectId: 'p',
				defaultDomain: 'kopi-senja.example.test',
				limits: limits(options.fixture ?? 'pilot-limits-domains'),
				readOnly: options.readOnly ?? false
			}
		}
	});
}

beforeEach(() => {
	vi.mocked(listProjectDomains).mockReset().mockResolvedValue([]);
	vi.mocked(addProjectDomain).mockReset();
	vi.mocked(checkProjectDomain).mockReset();
	vi.mocked(deleteProjectDomain).mockReset();
});

describe('ProjectDomainsSection', () => {
	it('adds the normalized name and shows its two records as steps', async () => {
		vi.mocked(addProjectDomain).mockResolvedValue(one('domain-create'));
		renderSection();
		await page.getByLabelText('Nama domain').fill('https://WWW.Kopi-Senja.com/menu');
		await page.getByRole('button', { name: 'Tambah domain' }).click();
		expect(addProjectDomain).toHaveBeenCalledWith('p', 'www.kopi-senja.com');
		await expect
			.element(page.getByTestId('custom-domain-status'))
			.toHaveTextContent('Menunggu DNS');
		await expect.element(page.getByRole('button', { name: 'Salin nama TXT' })).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Salin nilai CNAME' })).toBeVisible();
	});

	it('refuses the project own zone before sending', async () => {
		renderSection();
		await page.getByLabelText('Nama domain').fill('toko.example.test');
		await page.getByRole('button', { name: 'Tambah domain' }).click();
		await expect
			.element(page.getByText(/Domain di bawah example\.test milik Sakala/))
			.toBeVisible();
		expect(addProjectDomain).not.toHaveBeenCalled();
	});

	it('shows the API reason on the field when it refuses the name', async () => {
		vi.mocked(addProjectDomain).mockRejectedValue(
			errorFromDomainFixture('domain-create-invalid-punycode')
		);
		renderSection();
		await page.getByLabelText('Nama domain').fill('xn--zz.com');
		await page.getByRole('button', { name: 'Tambah domain' }).click();
		await expect
			.element(page.getByLabelText('Nama domain'))
			.toHaveAccessibleDescription(/bukan nama internasional yang valid/);
	});

	it('disables the check for as long as a 429 says', async () => {
		vi.mocked(listProjectDomains).mockResolvedValue([one('domain-check-missing')]);
		vi.mocked(checkProjectDomain).mockRejectedValue(
			errorFromDomainFixture('domain-check-rate-limited')
		);
		renderSection({ fixture: 'pilot-limits-domains-used' });
		await page.getByRole('button', { name: 'Periksa sekarang' }).click();
		await expect
			.element(page.getByRole('alert'))
			.toHaveTextContent('Terlalu sering diperiksa. Coba lagi dalam 60 detik.');
		await expect.element(page.getByRole('button', { name: /Tunggu (60|59) detik/ })).toBeDisabled();
	});

	it('deletes after confirming', async () => {
		vi.mocked(listProjectDomains).mockResolvedValue(
			parseProjectDomainList(getDomainFixture('domains-verified').body)
		);
		vi.mocked(deleteProjectDomain).mockResolvedValue(undefined);
		renderSection({ fixture: 'pilot-limits-domains-used' });
		await page.getByRole('button', { name: 'Hapus kopi-senja.com' }).click();
		await page.getByRole('button', { name: 'Hapus domain' }).click();
		expect(deleteProjectDomain).toHaveBeenCalledWith('p', expect.any(String));
		await expect.element(page.getByText('kopi-senja.com', { exact: true })).not.toBeInTheDocument();
	});

	it('gives a viewer the domains without a form or actions', async () => {
		vi.mocked(listProjectDomains).mockResolvedValue([one('domain-check-caa')]);
		renderSection({ readOnly: true });
		await expect.element(page.getByTestId('custom-domain')).toBeVisible();
		await expect.element(page.getByLabelText('Nama domain')).not.toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: 'Periksa sekarang' }))
			.not.toBeInTheDocument();
	});

	it('explains a zero quota instead of offering the form', async () => {
		renderSection({ fixture: 'pilot-limits-domains-zero' });
		await expect
			.element(page.getByTestId('domain-quota'))
			.toHaveTextContent('Workspace ini belum punya kuota custom domain. Minta ke admin Sakala.');
		await expect.element(page.getByLabelText('Nama domain')).not.toBeInTheDocument();
	});
});

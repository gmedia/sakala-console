import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { goto } from '$app/navigation';
import { NetworkError } from '$lib/api/errors';
import {
	submitOnboardingCompleted,
	submitOnboardingProfile,
	submitOnboardingSource
} from '$lib/api/resources/onboarding';
import QueryTestHost from '$lib/testing/QueryTestHost.svelte';
import OnboardingPage from './+page.svelte';

vi.mock('$app/navigation', () => ({ goto: vi.fn().mockResolvedValue(undefined) }));
vi.mock('$lib/api/resources/onboarding', () => ({
	submitOnboardingCompleted: vi.fn(),
	submitOnboardingProfile: vi.fn(),
	submitOnboardingSource: vi.fn()
}));

const completedUser = { id: 1, onboarding_completed_at: '2026-11-19T00:00:00Z' };
const createProject = () => page.getByRole('button', { name: 'Buat proyek pertama' });
const openProjects = () => page.getByRole('button', { name: 'Lihat dashboard dulu' });

beforeEach(() => {
	vi.mocked(goto).mockClear();
	vi.mocked(submitOnboardingCompleted).mockReset();
	vi.mocked(submitOnboardingProfile).mockReset();
	vi.mocked(submitOnboardingSource).mockReset();
});

describe('onboarding is one welcome screen', () => {
	it('welcomes, says what can be done, and asks nothing', async () => {
		await render(QueryTestHost, { props: { component: OnboardingPage } });

		await expect
			.element(page.getByRole('heading', { level: 1, name: 'Selamat datang di Sakala' }))
			.toBeVisible();
		await expect
			.element(page.getByRole('heading', { name: 'Yang bisa kamu lakukan' }))
			.toBeVisible();
		expect(page.getByRole('textbox').elements()).toHaveLength(0);
		expect(page.getByRole('radio').elements()).toHaveLength(0);
		await expect.element(page.getByText('Dari mana kamu tahu Sakala?')).not.toBeInTheDocument();
		await expect.element(page.getByText(/Langkah \d dari/)).not.toBeInTheDocument();
	});

	it('has one primary action, and the order it describes matches the wizard', async () => {
		await render(QueryTestHost, { props: { component: OnboardingPage } });

		await expect.element(createProject()).toBeVisible();
		await expect.element(createProject()).toHaveClass(/bg-primary/);
		await expect.element(openProjects()).not.toHaveClass(/bg-primary/);
		// Configuration comes before detection in the wizard, so the copy says it in that order.
		await expect
			.element(page.getByText(/Atur branch dan environment variable, lalu Sakala mendeteksi/))
			.toBeVisible();
		await expect.element(page.getByText(/memeriksa proyeknya lebih dulu/)).not.toBeInTheDocument();
	});

	it('finishes onboarding and opens the create-project wizard', async () => {
		vi.mocked(submitOnboardingCompleted).mockResolvedValue(completedUser as never);
		await render(QueryTestHost, { props: { component: OnboardingPage } });

		await createProject().click();

		await vi.waitFor(() => expect(goto).toHaveBeenCalledWith('/projects/new'));
		expect(submitOnboardingCompleted).toHaveBeenCalledTimes(1);
		expect(submitOnboardingProfile).not.toHaveBeenCalled();
		expect(submitOnboardingSource).not.toHaveBeenCalled();
	});

	it('lets someone look around first, for example a member invited to a team', async () => {
		vi.mocked(submitOnboardingCompleted).mockResolvedValue(completedUser as never);
		await render(QueryTestHost, { props: { component: OnboardingPage } });

		await openProjects().click();

		await vi.waitFor(() => expect(goto).toHaveBeenCalledWith('/projects'));
	});

	it('stays put and says why when finishing fails, and can be tried again', async () => {
		vi.mocked(submitOnboardingCompleted).mockRejectedValueOnce(new NetworkError());
		await render(QueryTestHost, { props: { component: OnboardingPage } });

		await createProject().click();

		await expect
			.element(page.getByRole('alert'))
			.toHaveTextContent('Sakala tidak bisa dihubungi. Periksa koneksi internet kamu');
		expect(goto).not.toHaveBeenCalled();

		vi.mocked(submitOnboardingCompleted).mockResolvedValue(completedUser as never);
		await createProject().click();
		await vi.waitFor(() => expect(goto).toHaveBeenCalledWith('/projects/new'));
	});
});

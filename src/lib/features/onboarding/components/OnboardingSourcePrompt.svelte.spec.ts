import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { getCurrentUser } from '$lib/api/resources/auth';
import { NetworkError } from '$lib/api/errors';
import { submitOnboardingSource } from '$lib/api/resources/onboarding';
import QueryTestHost from '$lib/testing/QueryTestHost.svelte';
import { sourcePromptDismissedKey } from '../source-prompt';
import OnboardingSourcePrompt from './OnboardingSourcePrompt.svelte';

vi.mock('$lib/api/resources/auth', () => ({ getAuthOptions: vi.fn(), getCurrentUser: vi.fn() }));
vi.mock('$lib/api/resources/onboarding', () => ({
	submitOnboardingCompleted: vi.fn(),
	submitOnboardingSource: vi.fn()
}));

const user = (onboarding_source: string | null) => ({
	id: 7,
	name: 'Rani Wulandari',
	email: 'rani@sakala.local',
	onboarding_source,
	onboarding_completed_at: '2026-11-19T00:00:00Z'
});
const renderPrompt = () => render(QueryTestHost, { props: { component: OnboardingSourcePrompt } });
const question = () => page.getByRole('heading', { name: 'Dari mana kamu tahu Sakala?' });
const choice = (name: string) => page.getByRole('button', { name, exact: true });

beforeEach(() => {
	localStorage.clear();
	vi.mocked(getCurrentUser).mockReset();
	vi.mocked(submitOnboardingSource).mockReset();
});

describe('the source question after a first deploy', () => {
	it('asks someone who has not answered, with one-tap choices and a way to skip', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(user(null) as never);
		await renderPrompt();

		await expect.element(question()).toBeVisible();
		await expect.element(page.getByText(/Boleh dilewati/)).toBeVisible();
		for (const label of [
			'Kampus',
			'Teman',
			'Komunitas',
			'Workshop',
			'Media sosial',
			'GMEDIA',
			'GitHub',
			'Lainnya'
		]) {
			await expect.element(choice(label)).toBeVisible();
		}
		await expect.element(page.getByRole('button', { name: 'Lewati' })).toBeVisible();
		// The question never had a free-text answer, so "Lainnya" stays a single tap.
		expect(page.getByRole('textbox').elements()).toHaveLength(0);
	});

	it('does not ask someone who already answered', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(user('campus') as never);
		await renderPrompt();

		await vi.waitFor(() => expect(getCurrentUser).toHaveBeenCalled());
		await expect.element(question()).not.toBeInTheDocument();
	});

	it('sends one tap to the onboarding source endpoint and thanks', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(user(null) as never);
		vi.mocked(submitOnboardingSource).mockResolvedValue(user('workshop') as never);
		await renderPrompt();

		await choice('Workshop').click();

		expect(submitOnboardingSource).toHaveBeenCalledWith({ source: 'workshop' });
		await expect
			.element(page.getByRole('status'))
			.toHaveTextContent('Terima kasih, jawabanmu tersimpan.');
		await expect.element(page.getByRole('status')).toHaveFocus();
		await expect.element(question()).not.toBeInTheDocument();
	});

	it('skips without calling the API, and stays skipped on this browser', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(user(null) as never);
		const screen = await renderPrompt();

		await page.getByRole('button', { name: 'Lewati' }).click();

		await expect.element(question()).not.toBeInTheDocument();
		expect(submitOnboardingSource).not.toHaveBeenCalled();
		expect(localStorage.getItem(sourcePromptDismissedKey(7))).toBe('1');

		await screen.unmount();
		await renderPrompt();
		await vi.waitFor(() => expect(getCurrentUser).toHaveBeenCalledTimes(2));
		await expect.element(question()).not.toBeInTheDocument();
	});

	it('keeps the choices and says what to do when saving fails', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(user(null) as never);
		vi.mocked(submitOnboardingSource).mockRejectedValueOnce(new NetworkError());
		await renderPrompt();

		await choice('Teman').click();

		await expect.element(page.getByRole('alert')).toHaveTextContent('Jawabanmu belum tersimpan');
		await expect.element(choice('Teman')).toBeEnabled();

		vi.mocked(submitOnboardingSource).mockResolvedValue(user('friend') as never);
		await choice('Teman').click();
		await expect.element(page.getByRole('status')).toHaveTextContent('Terima kasih');
	});
});

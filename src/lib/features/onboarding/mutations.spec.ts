import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
	useSubmitOnboardingSource,
	useSubmitOnboardingProfile,
	useCompleteOnboarding
} from './mutations';
import {
	submitOnboardingSource,
	submitOnboardingProfile,
	submitOnboardingCompleted
} from '$lib/api/resources/onboarding';
import { queryKeys } from '$lib/api/query-keys';

vi.mock('$lib/api/resources/onboarding', () => ({
	submitOnboardingSource: vi.fn(),
	submitOnboardingProfile: vi.fn(),
	submitOnboardingCompleted: vi.fn()
}));

const invalidateQueries = vi.fn();
let capturedConfig: {
	mutationFn: (selection?: unknown) => Promise<unknown>;
	onSuccess: () => void;
} | null = null;

vi.mock('@tanstack/svelte-query', () => ({
	createMutation: vi.fn((config: () => typeof capturedConfig) => {
		capturedConfig = config();
		return {} as unknown;
	}),
	useQueryClient: vi.fn(() => ({ invalidateQueries }))
}));

const mockedSubmitSource = vi.mocked(submitOnboardingSource);
const mockedSubmitProfile = vi.mocked(submitOnboardingProfile);
const mockedSubmitCompleted = vi.mocked(submitOnboardingCompleted);

beforeEach(() => {
	mockedSubmitSource.mockReset();
	mockedSubmitProfile.mockReset();
	mockedSubmitCompleted.mockReset();
	invalidateQueries.mockReset();
	capturedConfig = null;
});

describe('useSubmitOnboarding', () => {
	it('map { type: "source" } to just the payload { source }, without skipping', async () => {
		mockedSubmitSource.mockResolvedValue({} as never);
		useSubmitOnboardingSource();
		await capturedConfig!.mutationFn({ type: 'source', source: 'github' });
		expect(mockedSubmitSource).toHaveBeenCalledWith({ source: 'github' });
	});

	it('map { type: "skip" } to just the payload { skip }, without source', async () => {
		mockedSubmitSource.mockResolvedValue({} as never);
		useSubmitOnboardingSource();
		await capturedConfig!.mutationFn({ type: 'skip' });
		const [payload] = mockedSubmitSource.mock.calls[0];
		expect(payload).toHaveProperty('skip');
		expect(payload).not.toHaveProperty('source');
	});

	it('calls invalidateQueries for current-user after success', () => {
		useSubmitOnboardingSource();
		capturedConfig!.onSuccess();
		expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.auth.currentUser });
	});
});

describe('useSubmitOnboardingProfile', () => {
	it('foward the selection { name, role } to submitOnboardingProfile', async () => {
		mockedSubmitProfile.mockResolvedValue({} as never);
		useSubmitOnboardingProfile();

		await capturedConfig!.mutationFn({ name: 'sakala_programmer', role: 'developer' });

		expect(mockedSubmitProfile).toHaveBeenCalledWith({
			name: 'sakala_programmer',
			role: 'developer'
		});
	});

	it('foward the selection { skip: true } as-is, without re-mapping', async () => {
		mockedSubmitProfile.mockResolvedValue({} as never);
		useSubmitOnboardingProfile();

		await capturedConfig!.mutationFn({ skip: true });

		expect(mockedSubmitProfile).toHaveBeenCalledWith({ skip: true });
	});

	it('calls invalidateQueries for current-user after success', () => {
		useSubmitOnboardingProfile();

		capturedConfig!.onSuccess();

		expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.auth.currentUser });
	});
});

describe('useCompleteOnboarding', () => {
	it('calls submitOnboardingCompleted without any arguments', async () => {
		mockedSubmitCompleted.mockResolvedValue({} as never);
		useCompleteOnboarding();

		await capturedConfig!.mutationFn(undefined);

		expect(mockedSubmitCompleted).toHaveBeenCalledWith();
	});

	it('calls invalidateQueries for current-user after success', () => {
		useCompleteOnboarding();

		capturedConfig!.onSuccess();

		expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.auth.currentUser });
	});
});

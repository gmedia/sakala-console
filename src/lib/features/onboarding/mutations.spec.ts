import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useSubmitOnboarding } from './mutations';
import { submitOnboardingSource } from '$lib/api/resources/onboarding';
import { queryKeys } from '$lib/api/query-keys';

vi.mock('$lib/api/resources/onboarding', () => ({ submitOnboardingSource: vi.fn() }));

const invalidateQueries = vi.fn();
let capturedConfig: {
	mutationFn: (selection: unknown) => Promise<unknown>;
	onSuccess: () => void;
} | null = null;

vi.mock('@tanstack/svelte-query', () => ({
	createMutation: vi.fn((config: () => typeof capturedConfig) => {
		capturedConfig = config();
		return {} as unknown;
	}),
	useQueryClient: vi.fn(() => ({ invalidateQueries }))
}));

const mockedSubmit = vi.mocked(submitOnboardingSource);

describe('useSubmitOnboarding', () => {
	beforeEach(() => {
		mockedSubmit.mockReset();
		invalidateQueries.mockReset();
	});

	it('memetakan { type: "source" } jadi payload { source } saja, tanpa skip', async () => {
		mockedSubmit.mockResolvedValue({} as never);
		useSubmitOnboarding();

		await capturedConfig!.mutationFn({ type: 'source', source: 'github' });

		expect(mockedSubmit).toHaveBeenCalledWith({ source: 'github' });
	});

	it('memetakan { type: "skip" } jadi payload { skip } saja, tanpa source', async () => {
		mockedSubmit.mockResolvedValue({} as never);
		mockedSubmit.mockResolvedValue({} as never);
		useSubmitOnboarding();

		await capturedConfig!.mutationFn({ type: 'skip' });

		const [payload] = mockedSubmit.mock.calls[0];
		expect(payload).toHaveProperty('skip');
		expect(payload).not.toHaveProperty('source');
	});

	it('memanggil invalidateQueries untuk current-user setelah sukses', () => {
		useSubmitOnboarding();

		capturedConfig!.onSuccess();

		expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.auth.currentUser });
	});
});

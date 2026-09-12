import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useOnboardingFlow } from './use-onboarding-flow.svelte';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/paths', () => ({
	resolve: vi.fn((path: string) => path) as unknown as typeof resolve
}));

const sourceMutate = vi.fn();
const profileMutate = vi.fn();
const completeMutate = vi.fn();

vi.mock('./mutations', () => ({
	useSubmitOnboardingSource: vi.fn(() => ({ mutate: sourceMutate })),
	useSubmitOnboardingProfile: vi.fn(() => ({ mutate: profileMutate })),
	useCompleteOnboarding: vi.fn(() => ({ mutate: completeMutate }))
}));

const mockedGoto = vi.mocked(goto);
const mockedResolve = vi.mocked(resolve);

beforeEach(() => {
	sourceMutate.mockReset();
	profileMutate.mockReset();
	completeMutate.mockReset();
	mockedGoto.mockReset();
	mockedResolve.mockReset();
	mockedResolve.mockImplementation(((path: string) => path) as typeof resolve);
});

describe('useOnboardingFlow', () => {
	it('dimulai pada step 1 tanpa source/profile terpilih', () => {
		const flow = useOnboardingFlow();

		expect(flow.step).toBe(1);
		expect(flow.selectedSource).toBeUndefined();
		expect(flow.profileName).toBeUndefined();
		expect(flow.profileRole).toBeUndefined();
	});

	describe('selectSource & submitSource', () => {
		it('tidak memanggil mutate kalau belum ada source terpilih', () => {
			const flow = useOnboardingFlow();

			flow.submitSource();

			expect(sourceMutate).not.toHaveBeenCalled();
		});

		it('mengirim { type: "source", source } dan pindah ke step 2 saat sukses', () => {
			const flow = useOnboardingFlow();
			flow.selectSource('github');

			flow.submitSource();

			expect(sourceMutate).toHaveBeenCalledWith(
				{ type: 'source', source: 'github' },
				expect.objectContaining({ onSuccess: expect.any(Function) })
			);

			const { onSuccess } = sourceMutate.mock.calls[0][1];
			onSuccess();

			expect(flow.step).toBe(2);
		});
	});

	describe('skipSource', () => {
		it('mengirim { type: "skip" } dan pindah ke step 2 saat sukses', () => {
			const flow = useOnboardingFlow();

			flow.skipSource();

			expect(sourceMutate).toHaveBeenCalledWith(
				{ type: 'skip' },
				expect.objectContaining({ onSuccess: expect.any(Function) })
			);

			const { onSuccess } = sourceMutate.mock.calls[0][1];
			onSuccess();

			expect(flow.step).toBe(2);
		});
	});

	describe('updateProfile', () => {
		it('hanya meng-update field yang dikirim, field lain tetap seperti sebelumnya', () => {
			const flow = useOnboardingFlow();

			flow.updateProfile({ name: 'sakala_programmer' });
			expect(flow.profileName).toBe('sakala_programmer');
			expect(flow.profileRole).toBeUndefined();

			flow.updateProfile({ role: 'developer' });
			expect(flow.profileName).toBe('sakala_programmer');
			expect(flow.profileRole).toBe('developer');
		});
	});

	describe('submitProfile & skipProfile', () => {
		it('mengirim { name, role } dari state saat ini dan pindah ke step 3 saat sukses', () => {
			const flow = useOnboardingFlow();
			flow.updateProfile({ name: 'sakala_programmer', role: 'architect' });

			flow.submitProfile();

			expect(profileMutate).toHaveBeenCalledWith(
				{ name: 'sakala_programmer', role: 'architect' },
				expect.objectContaining({ onSuccess: expect.any(Function) })
			);

			const { onSuccess } = profileMutate.mock.calls[0][1];
			onSuccess();

			expect(flow.step).toBe(3);
		});

		it('skipProfile mengirim { skip: true } dan pindah ke step 3 saat sukses', () => {
			const flow = useOnboardingFlow();

			flow.skipProfile();

			expect(profileMutate).toHaveBeenCalledWith(
				{ skip: true },
				expect.objectContaining({ onSuccess: expect.any(Function) })
			);

			const { onSuccess } = profileMutate.mock.calls[0][1];
			onSuccess();

			expect(flow.step).toBe(3);
		});
	});

	describe('finish', () => {
		it('memanggil completeMutation.mutate(undefined, ...) dan redirect ke /projects saat sukses', () => {
			const flow = useOnboardingFlow();

			flow.finish();

			expect(completeMutate).toHaveBeenCalledWith(
				undefined,
				expect.objectContaining({ onSuccess: expect.any(Function) })
			);

			const { onSuccess } = completeMutate.mock.calls[0][1];
			onSuccess();

			expect(mockedResolve).toHaveBeenCalledWith('/projects');
			expect(mockedGoto).toHaveBeenCalledWith('/projects');
		});
	});

	describe('back', () => {
		it('mengurangi step kalau step > 1', () => {
			const flow = useOnboardingFlow();
			flow.selectSource('github');
			flow.submitSource();
			sourceMutate.mock.calls[0][1].onSuccess();
			expect(flow.step).toBe(2);

			flow.back();

			expect(flow.step).toBe(1);
		});

		it('tidak melakukan apa-apa kalau sudah di step 1', () => {
			const flow = useOnboardingFlow();

			flow.back();

			expect(flow.step).toBe(1);
		});
	});
});

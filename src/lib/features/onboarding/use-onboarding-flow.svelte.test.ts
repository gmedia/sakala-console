import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useOnboardingFlow } from './use-onboarding-flow.svelte';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { ApiError, NetworkError } from '$lib/api/errors';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/paths', () => ({
	resolve: vi.fn((path: string) => path) as unknown as typeof resolve
}));

function createMutationStub() {
	let isPending = $state(false);
	let variables = $state<unknown>(undefined);
	let error = $state<unknown>(null);

	type MutationOptions = {
		onSuccess?: () => void;
		onError?: (error: unknown) => void;
	};

	let options = $state<MutationOptions | undefined>(undefined);

	const mutate = vi.fn((vars: unknown, mutationOptions?: MutationOptions) => {
		isPending = true;
		variables = vars;
		error = null;
		options = mutationOptions;
	});

	function resolveSuccess() {
		isPending = false;
		error = null;
		options?.onSuccess?.();
	}

	function resolveError(nextError: unknown) {
		isPending = false;
		error = nextError;
		options?.onError?.(nextError);
	}

	return {
		mutate,
		resolveSuccess,
		resolveError,
		get isPending() {
			return isPending;
		},
		get variables() {
			return variables;
		},
		get error() {
			return error;
		}
	};
}

const sourceMutationStub = createMutationStub();
const profileMutationStub = createMutationStub();
const completeMutationStub = createMutationStub();

const sourceMutate = sourceMutationStub.mutate;
const profileMutate = profileMutationStub.mutate;
const completeMutate = completeMutationStub.mutate;

vi.mock('./mutations', () => ({
	useSubmitOnboardingSource: vi.fn(() => sourceMutationStub),
	useSubmitOnboardingProfile: vi.fn(() => profileMutationStub),
	useCompleteOnboarding: vi.fn(() => completeMutationStub)
}));

const mockedGoto = vi.mocked(goto);
const mockedResolve = vi.mocked(resolve);

beforeEach(() => {
	sourceMutate.mockClear();
	profileMutate.mockClear();
	completeMutate.mockClear();
	sourceMutationStub.resolveSuccess();
	profileMutationStub.resolveSuccess();
	completeMutationStub.resolveSuccess();
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

			sourceMutationStub.resolveSuccess();

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

			sourceMutationStub.resolveSuccess();

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

			profileMutationStub.resolveSuccess();

			expect(flow.step).toBe(3);
		});

		it('skipProfile mengirim { skip: true } dan pindah ke step 3 saat sukses', () => {
			const flow = useOnboardingFlow();

			flow.skipProfile();

			expect(profileMutate).toHaveBeenCalledWith(
				{ skip: true },
				expect.objectContaining({ onSuccess: expect.any(Function) })
			);

			profileMutationStub.resolveSuccess();

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

			completeMutationStub.resolveSuccess();

			expect(mockedResolve).toHaveBeenCalledWith('/projects');
			expect(mockedGoto).toHaveBeenCalledWith('/projects');
		});
	});

	describe('back', () => {
		it('mengurangi step kalau step > 1', () => {
			const flow = useOnboardingFlow();
			flow.selectSource('github');
			flow.submitSource();
			sourceMutationStub.resolveSuccess();
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

	describe('source submission state', () => {
		it('isSubmittingSource true ketika source sedang disubmit', () => {
			const flow = useOnboardingFlow();

			flow.selectSource('github');
			flow.submitSource();

			expect(flow.isSubmittingSource).toBe(true);
			expect(flow.isSkippingSource).toBe(false);
		});

		it('isSkippingSource true ketika source sedang di-skip', () => {
			const flow = useOnboardingFlow();

			flow.skipSource();

			expect(flow.isSubmittingSource).toBe(false);
			expect(flow.isSkippingSource).toBe(true);
		});
	});

	describe('profile submission state', () => {
		it('isSubmittingProfile true ketika profile sedang disubmit', () => {
			const flow = useOnboardingFlow();

			flow.updateProfile({
				name: 'sakala_programmer',
				role: 'developer'
			});

			flow.submitProfile();

			expect(flow.isSubmittingProfile).toBe(true);
			expect(flow.isSkippingProfile).toBe(false);
		});

		it('isSkippingProfile true ketika profile sedang di-skip', () => {
			const flow = useOnboardingFlow();

			flow.skipProfile();

			expect(flow.isSubmittingProfile).toBe(false);
			expect(flow.isSkippingProfile).toBe(true);
		});

		it('only name tidak bisa submite profile', () => {
			const flow = useOnboardingFlow();

			flow.updateProfile({ name: 'Test User' });

			flow.submitProfile();

			expect(profileMutationStub.mutate).not.toHaveBeenCalled();
		});

		it('only role tidak bisa submite profile', () => {
			const flow = useOnboardingFlow();

			flow.updateProfile({ role: 'developer' });

			flow.submitProfile();

			expect(profileMutationStub.mutate).not.toHaveBeenCalled();
		});

		it('name yang hanya berisi whitespace tidak bisa submite profile', () => {
			const flow = useOnboardingFlow();

			flow.updateProfile({
				name: '   ',
				role: 'developer'
			});

			flow.submitProfile();

			expect(profileMutationStub.mutate).not.toHaveBeenCalled();
		});
	});

	describe('source error state', () => {
		it('menampilkan pesan khusus ketika terjadi NetworkError', () => {
			const flow = useOnboardingFlow();

			flow.selectSource('github');
			flow.submitSource();

			sourceMutationStub.resolveError(new NetworkError());

			expect(flow.sourceErrorMessage).toBe(
				'Tidak dapat terhubung ke server. Periksa koneksi internet Anda dan coba lagi.'
			);
		});

		it('menampilkan pesan validation ketika terjadi ApiError 422', () => {
			const flow = useOnboardingFlow();

			flow.selectSource('github');
			flow.submitSource();

			sourceMutationStub.resolveError(new ApiError('Data invalid', 422));

			expect(flow.sourceErrorMessage).toBe(
				'Data yang dikirim tidak valid. Silakan periksa kembali.'
			);
		});

		it('menampilkan pesan fallback untuk error lainnya', () => {
			const flow = useOnboardingFlow();

			flow.selectSource('github');
			flow.submitSource();

			sourceMutationStub.resolveError(new Error('Unexpected error'));

			expect(flow.sourceErrorMessage).toBe('Gagal menyimpan, silakan coba lagi.');
		});

		it('mempertahankan source yang dipilih ketika submit gagal', () => {
			const flow = useOnboardingFlow();

			flow.selectSource('github');
			flow.submitSource();

			sourceMutationStub.resolveError(new ApiError('Server error', 500));

			expect(flow.step).toBe(1);
			expect(flow.selectedSource).toBe('github');
			expect(flow.sourceErrorMessage).toBe('Gagal menyimpan, silakan coba lagi.');
		});

		it('dapat retry setelah submit source gagal tanpa kehilangan source', () => {
			const flow = useOnboardingFlow();

			flow.selectSource('github');
			flow.submitSource();

			sourceMutationStub.resolveError(new ApiError('Server error', 500));

			expect(flow.step).toBe(1);
			expect(flow.selectedSource).toBe('github');

			flow.submitSource();

			expect(sourceMutate).toHaveBeenCalledTimes(2);
			expect(sourceMutate).toHaveBeenLastCalledWith(
				{ type: 'source', source: 'github' },
				expect.objectContaining({ onSuccess: expect.any(Function) })
			);

			sourceMutationStub.resolveSuccess();

			expect(flow.step).toBe(2);
			expect(flow.selectedSource).toBe('github');
		});
	});

	describe('profile error state', () => {
		it('menampilkan pesan error dan mempertahankan profile ketika submit gagal', () => {
			const flow = useOnboardingFlow();

			flow.selectSource('github');
			flow.submitSource();
			sourceMutationStub.resolveSuccess();

			flow.updateProfile({
				name: 'sakala_programmer',
				role: 'developer'
			});

			flow.submitProfile();

			profileMutationStub.resolveError(new ApiError('Invalid data', 422));

			expect(flow.step).toBe(2);
			expect(flow.profileName).toBe('sakala_programmer');
			expect(flow.profileRole).toBe('developer');
			expect(flow.profileErrorMessage).toBe(
				'Data yang dikirim tidak valid. Silakan periksa kembali.'
			);
		});
	});

	describe('complete error state', () => {
		it('menampilkan pesan error dan tidak redirect ketika complete gagal', () => {
			const flow = useOnboardingFlow();

			flow.finish();

			completeMutationStub.resolveError(new NetworkError());

			expect(flow.completeErrorMessage).toBe(
				'Tidak dapat terhubung ke server. Periksa koneksi internet Anda dan coba lagi.'
			);
			expect(mockedGoto).not.toHaveBeenCalled();
		});
	});
});

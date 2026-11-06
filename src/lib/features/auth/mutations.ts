import { createMutation, useQueryClient } from '@tanstack/svelte-query';
import {
	acceptLegalDocuments,
	changePassword,
	deleteAccount,
	exportAccountData,
	forgotPassword,
	logout,
	login,
	register,
	requestEmailChange,
	resendVerificationEmail,
	resetPassword,
	type ChangePasswordPayload,
	type DeleteAccountPayload,
	type LegalAcceptancePayload,
	type LoginPayload,
	type RegisterPayload,
	type RequestEmailChangePayload,
	type ResetPasswordPayload
} from '$lib/api/resources/auth';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { disconnectEcho } from '$lib/realtime/echo';
import { forgetSession, noteAccountDeleted } from '$lib/features/auth/session-notice';
import { queryKeys } from '$lib/api/query-keys';
import { setLastLoginProvider, clearPendingOAuthProvider } from '$lib/features/auth/utils/oauth';

export function useLogout() {
	const queryClient = useQueryClient();

	function cleanupSession() {
		forgetSession();
		queryClient.clear();
		disconnectEcho();
		goto(resolve('/login'));
	}

	return createMutation(() => ({
		mutationFn: logout,
		retry: false,
		meta: { handlesUnauthenticated: true },
		onSuccess: () => {
			cleanupSession();
		},
		onError: (error: unknown) => {
			const err = error as { status?: number; response?: { status?: number } };

			if (err?.status === 401 || err?.response?.status === 401) {
				cleanupSession();
				return;
			}

			console.error('Logout failed:', error);
		}
	}));
}

export function useLogin() {
	const queryClient = useQueryClient();

	return createMutation(() => ({
		mutationFn: (payload: LoginPayload) => login(payload),
		// A 401 here means wrong credentials, not an expired session.
		meta: { handlesUnauthenticated: true },
		onSuccess: (user) => {
			setLastLoginProvider('email');
			clearPendingOAuthProvider();
			queryClient.setQueryData(queryKeys.auth.currentUser, user);
		}
	}));
}

export function useRegister() {
	return createMutation(() => ({
		mutationFn: (payload: RegisterPayload) => register(payload)
	}));
}

export function useResendVerification() {
	return createMutation(() => ({
		mutationFn: (email: string) => resendVerificationEmail(email)
	}));
}

export function useForgotPassword() {
	return createMutation(() => ({
		mutationFn: (email: string) => forgotPassword(email)
	}));
}

export function useResetPassword() {
	return createMutation(() => ({
		mutationFn: (payload: ResetPasswordPayload) => resetPassword(payload)
	}));
}

export function useChangePassword() {
	const queryClient = useQueryClient();

	return createMutation(() => ({
		mutationFn: (payload: ChangePasswordPayload) => changePassword(payload),
		onSuccess: (user) => queryClient.setQueryData(queryKeys.auth.currentUser, user)
	}));
}

export function useRequestEmailChange() {
	const queryClient = useQueryClient();

	return createMutation(() => ({
		mutationFn: (payload: RequestEmailChangePayload) => requestEmailChange(payload),
		onSuccess: (user) => queryClient.setQueryData(queryKeys.auth.currentUser, user)
	}));
}

export function useAcceptLegalDocuments() {
	const queryClient = useQueryClient();

	return createMutation(() => ({
		mutationFn: (payload: LegalAcceptancePayload) => acceptLegalDocuments(payload),
		onSuccess: (user) => queryClient.setQueryData(queryKeys.auth.currentUser, user)
	}));
}

export function useDeleteAccount() {
	const queryClient = useQueryClient();

	return createMutation(() => ({
		mutationFn: (payload: DeleteAccountPayload) => deleteAccount(payload),
		onSuccess: () => {
			forgetSession();
			noteAccountDeleted();
			queryClient.clear();
			disconnectEcho();
			goto(resolve('/login'));
		}
	}));
}

export function useExportAccountData() {
	return createMutation(() => ({
		mutationFn: () => exportAccountData()
	}));
}

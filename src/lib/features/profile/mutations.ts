import { createMutation, useQueryClient } from '@tanstack/svelte-query';
import { queryKeys } from '$lib/api/query-keys';
import {
	removeAvatar,
	updateProfile,
	uploadAvatar,
	type UpdateProfilePayload
} from '$lib/api/resources/profile';

export function useUpdateProfile() {
	const queryClient = useQueryClient();

	return createMutation(() => ({
		mutationFn: (payload: UpdateProfilePayload) => updateProfile(payload),
		onSuccess: (user) => queryClient.setQueryData(queryKeys.auth.currentUser, user)
	}));
}

export function useUploadAvatar() {
	const queryClient = useQueryClient();

	return createMutation(() => ({
		mutationFn: (file: File) => uploadAvatar(file),
		onSuccess: (user) => queryClient.setQueryData(queryKeys.auth.currentUser, user)
	}));
}

export function useRemoveAvatar() {
	const queryClient = useQueryClient();

	return createMutation(() => ({
		mutationFn: () => removeAvatar(),
		onSuccess: (user) => queryClient.setQueryData(queryKeys.auth.currentUser, user)
	}));
}

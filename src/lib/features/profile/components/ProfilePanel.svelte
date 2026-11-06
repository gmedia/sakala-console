<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import { resolve } from '$app/paths';
	import UserIcon from 'phosphor-svelte/lib/User';
	import { tick } from 'svelte';
	import FormField from '$lib/components/ui/FormField.svelte';
	import { getErrorMessage, getFieldError } from '$lib/api/errors';
	import { useCurrentUser } from '$lib/features/auth/queries';
	import { formatDate } from '$lib/utils/date';
	import { useRemoveAvatar, useUpdateProfile, useUploadAvatar } from '../mutations';
	import { USERNAME_RULE_HINT, usernameError } from '../username';

	const currentUserQuery = useCurrentUser();
	const user = $derived(currentUserQuery.data);

	const updateProfile = useUpdateProfile();
	const uploadAvatar = useUploadAvatar();
	const removeAvatar = useRemoveAvatar();

	/** Null until edited, so the form follows the API until then. */
	let nameEdit = $state<string | null>(null);
	let usernameEdit = $state<string | null>(null);
	let errors = $state<{ name?: string; username?: string; general?: string }>({});
	let saved = $state(false);

	const name = $derived(nameEdit ?? user?.name ?? '');
	const username = $derived(usernameEdit ?? user?.username ?? '');
	const trimmedName = $derived(name.trim());
	const isDirty = $derived(
		trimmedName !== (user?.name ?? '') || username !== (user?.username ?? '')
	);
	const usernameProblem = $derived(usernameEdit === null ? null : usernameError(username));
	const canSave = $derived(
		isDirty && trimmedName.length > 0 && !usernameProblem && !updateProfile.isPending
	);

	const joinedDate = $derived(user?.created_at ? formatDate(user.created_at) : '-');

	async function handleSave(event: SubmitEvent) {
		event.preventDefault();
		if (!canSave) return;
		errors = {};
		saved = false;

		try {
			await updateProfile.mutateAsync({
				...(trimmedName !== user?.name ? { name: trimmedName } : {}),
				...(username !== user?.username ? { username } : {})
			});
			nameEdit = null;
			usernameEdit = null;
			saved = true;
		} catch (error) {
			const nameError = getFieldError(error, 'name');
			const usernameApiError = getFieldError(error, 'username');
			errors = {
				name: nameError,
				username: usernameApiError,
				general:
					nameError || usernameApiError
						? undefined
						: getErrorMessage(error, 'Gagal menyimpan profil. Coba lagi.')
			};
			await tick();
			if (usernameApiError) document.getElementById('username')?.focus();
			else if (nameError) document.getElementById('full-name')?.focus();
		}
	}

	const allowedAvatarTypes = ['image/png', 'image/jpeg', 'image/webp'];
	const maxAvatarSize = 1 * 1024 * 1024;

	let fileInputRef = $state<HTMLInputElement | null>(null);
	let lastTriggerElement = $state<HTMLElement | null>(null);
	let isEditPhotoModalOpen = $state(false);
	let photoErrorMessage = $state<string | null>(null);

	const isPhotoBusy = $derived(uploadAvatar.isPending || removeAvatar.isPending);

	function openPhotoModal(e: MouseEvent | KeyboardEvent) {
		lastTriggerElement = e.currentTarget as HTMLElement;
		photoErrorMessage = null;
		isEditPhotoModalOpen = true;
	}

	function closePhotoModal() {
		isEditPhotoModalOpen = false;
		photoErrorMessage = null;
	}

	async function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		target.value = '';

		photoErrorMessage = null;
		if (!file) return;

		if (!allowedAvatarTypes.includes(file.type)) {
			photoErrorMessage = 'Format file tidak didukung. Gunakan PNG, JPG, atau WebP.';
			return;
		}

		if (file.size > maxAvatarSize) {
			photoErrorMessage = 'Ukuran file terlalu besar. Maksimal ukuran foto adalah 1 MB.';
			return;
		}

		try {
			await uploadAvatar.mutateAsync(file);
			closePhotoModal();
		} catch (error) {
			photoErrorMessage =
				getFieldError(error, 'avatar') ??
				getErrorMessage(error, 'Gagal mengunggah foto. Coba lagi.');
		}
	}

	async function handleRemovePhoto() {
		photoErrorMessage = null;
		try {
			await removeAvatar.mutateAsync();
			closePhotoModal();
		} catch (error) {
			photoErrorMessage = getErrorMessage(error, 'Gagal menghapus foto. Coba lagi.');
		}
	}
</script>

<div class="max-w-reading space-y-8 pb-12">
	<p class="text-sm text-muted">Info dasar akun kamu di Sakala.</p>

	<form class="surface-card space-y-8 p-6" onsubmit={handleSave} novalidate>
		<div class="flex items-center gap-6">
			<button
				type="button"
				onclick={openPhotoModal}
				class="group relative flex size-20 items-center justify-center rounded-full bg-background-soft ring-1 ring-border/80 transition-all hover:opacity-90 cursor-pointer overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-dark"
				aria-label="Ubah foto profil"
			>
				{#if user?.avatar_url}
					<img src={user.avatar_url} alt="Foto profil {user.name}" class="size-full object-cover" />
				{:else}
					<UserIcon size={36} class="size-9 text-muted group-hover:text-foreground" />
				{/if}
			</button>

			<Button variant="link" onclick={openPhotoModal}>Ubah foto</Button>
		</div>

		<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
			<FormField
				id="full-name"
				label="Nama lengkap"
				autocomplete="name"
				bind:value={() => name, (next) => (nameEdit = next)}
				error={errors.name}
			/>
			<FormField
				id="username"
				label="Username"
				autocomplete="username"
				hint={USERNAME_RULE_HINT}
				bind:value={() => username, (next) => (usernameEdit = next)}
				error={errors.username ?? usernameProblem}
			/>
		</div>

		<div class="flex flex-col items-end gap-2 pt-2">
			{#if errors.general}
				<p class="text-xs text-error-base" role="alert">{errors.general}</p>
			{:else if saved && !isDirty}
				<p class="text-xs text-primary-dark" role="status">Profil tersimpan.</p>
			{/if}
			<Button type="submit" disabled={!canSave}>
				{updateProfile.isPending ? 'Menyimpan...' : 'Simpan perubahan'}
			</Button>
		</div>
	</form>

	<div class="surface-card space-y-6 p-6">
		<div>
			<h2 class="font-sans text-base font-semibold text-foreground">Detail akun</h2>
			<p class="mt-0.5 text-xs text-muted">
				Email diganti lewat
				<a href={resolve('/settings')} class="font-semibold text-primary-dark hover:underline">
					Pengaturan
				</a>.
			</p>
		</div>

		<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
			<div class="space-y-1.5">
				<label for="email-field" class="block text-sm font-medium text-foreground"> Email </label>
				<input
					id="email-field"
					type="email"
					value={user?.email ?? ''}
					disabled
					class="control-input"
				/>
			</div>

			<div class="space-y-1.5">
				<label for="joined-field" class="block text-sm font-medium text-foreground">
					Bergabung sejak
				</label>
				<input id="joined-field" type="text" value={joinedDate} disabled class="control-input" />
			</div>
		</div>
	</div>
</div>

<input
	type="file"
	accept="image/png,image/jpeg,image/webp"
	class="hidden"
	aria-label="Pilih foto profil"
	bind:this={fileInputRef}
	onchange={handleFileSelect}
/>

<Dialog
	bind:open={isEditPhotoModalOpen}
	title="Ubah foto profil"
	description="PNG, JPG, atau WebP. Maksimal 1 MB."
	class="max-w-sm"
	confirmLabel={uploadAvatar.isPending ? 'Mengunggah...' : 'Unggah foto'}
	loading={isPhotoBusy}
	returnFocus={() => lastTriggerElement}
	onConfirm={() => fileInputRef?.click()}
	onCancel={() => (photoErrorMessage = null)}
>
	{#if user?.avatar_url}
		<Button
			variant="secondary"
			size="lg"
			class="w-full text-error hover:text-error"
			disabled={isPhotoBusy}
			onclick={handleRemovePhoto}
		>
			{removeAvatar.isPending ? 'Menghapus...' : 'Hapus foto saat ini'}
		</Button>
	{/if}

	{#if photoErrorMessage}
		<p class="mt-3 rounded-control bg-error-50 p-3 text-xs text-error-base" role="alert">
			{photoErrorMessage}
		</p>
	{/if}
</Dialog>

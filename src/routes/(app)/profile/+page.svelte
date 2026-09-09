<script lang="ts">
	import { PencilSimple, User as UserIcon } from 'phosphor-svelte';
	import { useCurrentUser } from '$lib/features/auth/queries';

	const currentUserQuery = useCurrentUser();

	let initialName = $state('Sasongko');
	let initialUsername = $state('ssngk');
	let initialAvatarUrl = $state<string | null>(null);

	let name = $state('Sasongko');
	let username = $state('ssngk');
	let email = $state('sasongko@gmail.com');
	let joinedDate = $state('Maret 2026');
	let avatarUrl = $state<string | null>(null);

	let fileInputRef = $state<HTMLInputElement | null>(null);

	$effect(() => {
		if (currentUserQuery.data) {
			const u = currentUserQuery.data;
			if (u.name) {
				initialName = u.name;
				name = u.name;
			}
			if (u.email) {
				email = u.email;
				const extractedUsername = u.email.split('@')[0];
				initialUsername = extractedUsername;
				username = extractedUsername;
			}
			if (u.avatar_url) {
				initialAvatarUrl = u.avatar_url;
				avatarUrl = u.avatar_url;
			}
			if (u.onboarding_completed_at || u.last_login_at) {
				const dateStr = u.onboarding_completed_at || u.last_login_at;
				if (dateStr) {
					const d = new Date(dateStr);
					if (!isNaN(d.getTime())) {
						joinedDate = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
					}
				}
			}
		}
	});

	let isDirty = $derived(
		name !== initialName || username !== initialUsername || avatarUrl !== initialAvatarUrl
	);

	let isEditPhotoModalOpen = $state(false);

	function handleSave() {
		if (!isDirty) return;
		initialName = name;
		initialUsername = username;
		initialAvatarUrl = avatarUrl;
	}

	function handlePhotoAction(action: 'upload' | 'remove') {
		if (action === 'remove') {
			avatarUrl = null;
			isEditPhotoModalOpen = false;
		} else if (action === 'upload') {
			fileInputRef?.click();
		}
	}

	function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (file) {
			avatarUrl = URL.createObjectURL(file);
			isEditPhotoModalOpen = false;
		}
		target.value = '';
	}
</script>

<svelte:head>
	<title>Profil Saya | Sakala Console</title>
</svelte:head>

<div class="mx-auto space-y-8 max-w-4xl pb-12">
	<div>
		<h2 class="font-sans text-2xl font-bold text-foreground">Profil Saya</h2>
		<p class="mt-1 font-sans text-sm text-muted">Info dasar akun kamu di Sakala.</p>
	</div>

	<div class="rounded-2xl border border-border/70 bg-white p-8 shadow-xs space-y-8">
		<div class="flex items-center gap-6">
			<button
				type="button"
				onclick={() => (isEditPhotoModalOpen = true)}
				class="group relative flex size-20 items-center justify-center rounded-full bg-background-soft ring-1 ring-border/80 transition-all hover:opacity-90 cursor-pointer overflow-hidden"
				aria-label="Ubah foto profil"
			>
				{#if avatarUrl}
					<img src={avatarUrl} alt={name} class="size-full object-cover" />
				{:else}
					<UserIcon size={36} class="size-9 text-muted group-hover:text-foreground" />
				{/if}
			</button>

			<button
				type="button"
				onclick={() => (isEditPhotoModalOpen = true)}
				class="font-sans text-sm font-semibold text-primary-dark hover:underline cursor-pointer"
			>
				Edit Foto
			</button>
		</div>

		<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
			<div class="space-y-2">
				<label for="full-name" class="block font-sans text-sm font-medium text-foreground">
					Nama lengkap
				</label>
				<div class="relative">
					<input
						id="full-name"
						type="text"
						bind:value={name}
						class="w-full rounded-xl border border-border/80 bg-white px-4 py-3 pr-10 font-sans text-sm text-foreground focus:border-primary-dark focus:outline-none focus:ring-1 focus:ring-primary-dark"
					/>
					<PencilSimple
						size={18}
						class="absolute right-3.5 top-3.5 size-4.5 text-muted pointer-events-none"
					/>
				</div>
			</div>

			<div class="space-y-2">
				<label for="username" class="block font-sans text-sm font-medium text-foreground">
					Username
				</label>
				<div class="relative">
					<input
						id="username"
						type="text"
						bind:value={username}
						class="w-full rounded-xl border border-border/80 bg-white px-4 py-3 pr-10 font-sans text-sm text-foreground focus:border-primary-dark focus:outline-none focus:ring-1 focus:ring-primary-dark"
					/>
					<PencilSimple
						size={18}
						class="absolute right-3.5 top-3.5 size-4.5 text-muted pointer-events-none"
					/>
				</div>
			</div>
		</div>

		<div class="pt-2">
			<button
				type="button"
				onclick={handleSave}
				disabled={!isDirty}
				class={isDirty
					? 'rounded-xl bg-primary-dark px-6 py-3 font-sans text-sm font-semibold text-white shadow-xs transition-colors hover:bg-primary-dark/90 cursor-pointer'
					: 'rounded-xl bg-[#E5E7EB] px-6 py-3 font-sans text-sm font-semibold text-[#9CA3AF] cursor-not-allowed'}
			>
				Simpan Perubahan
			</button>
		</div>
	</div>

	<div class="rounded-2xl border border-border/70 bg-white p-8 shadow-xs space-y-6">
		<div>
			<h3 class="font-sans text-base font-semibold text-foreground">Detail Akun</h3>
			<p class="mt-0.5 font-sans text-xs text-muted">Informasi dasar akun kamu di Sakala</p>
		</div>

		<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
			<div class="space-y-2">
				<label for="email-field" class="block font-sans text-sm font-medium text-foreground">
					Email
				</label>
				<input
					id="email-field"
					type="email"
					value={email}
					disabled
					class="w-full rounded-xl border border-border/60 bg-background-soft/60 px-4 py-3 font-sans text-sm text-foreground/80 cursor-not-allowed"
				/>
			</div>

			<div class="space-y-2">
				<label for="joined-field" class="block font-sans text-sm font-medium text-foreground">
					Bergabung sejak
				</label>
				<input
					id="joined-field"
					type="text"
					value={joinedDate}
					disabled
					class="w-full rounded-xl border border-border/60 bg-background-soft/60 px-4 py-3 font-sans text-sm text-foreground/80 cursor-not-allowed"
				/>
			</div>
		</div>
	</div>
</div>

<input
	type="file"
	accept="image/png,image/jpeg,image/webp,image/gif"
	class="hidden"
	bind:this={fileInputRef}
	onchange={handleFileSelect}
/>

{#if isEditPhotoModalOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
		role="dialog"
		aria-modal="true"
		aria-labelledby="edit-photo-modal-title"
	>
		<div
			class="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl border border-border/80 text-center"
		>
			<div class="border-b border-border/60 py-4 px-6">
				<h3 id="edit-photo-modal-title" class="font-sans text-base font-semibold text-primary-dark">
					Ubah Foto Profil
				</h3>
			</div>

			<div class="divide-y divide-border/60">
				<button
					type="button"
					onclick={() => handlePhotoAction('upload')}
					class="w-full py-3.5 font-sans text-sm font-medium text-foreground transition-colors hover:bg-background-soft cursor-pointer"
				>
					Unggah Foto
				</button>
				<button
					type="button"
					onclick={() => handlePhotoAction('remove')}
					class="w-full py-3.5 font-sans text-sm font-medium text-foreground transition-colors hover:bg-background-soft cursor-pointer"
				>
					Hapus Foto Saat Ini
				</button>
				<button
					type="button"
					onclick={() => (isEditPhotoModalOpen = false)}
					class="w-full py-3.5 font-sans text-sm font-medium text-error-base transition-colors hover:bg-error/10 cursor-pointer"
				>
					Batal
				</button>
			</div>
		</div>
	</div>
{/if}

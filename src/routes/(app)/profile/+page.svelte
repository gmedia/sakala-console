<script lang="ts">
	import { PencilSimple, User as UserIcon } from 'phosphor-svelte';
	import { tick } from 'svelte';

	let initialName = $state('Sasongko');
	let initialUsername = $state('ssngk');
	let initialAvatarUrl = $state<string | null>(null);

	let name = $state('Sasongko');
	let username = $state('ssngk');
	let email = $state('sasongko@gmail.com');
	let joinedDate = $state('-');
	let avatarUrl = $state<string | null>(null);

	let fileInputRef = $state<HTMLInputElement | null>(null);
	let lastTriggerElement = $state<HTMLElement | null>(null);

	let isDirty = $derived(
		name !== initialName || username !== initialUsername || avatarUrl !== initialAvatarUrl
	);

	let isEditPhotoModalOpen = $state(false);

	const allowed_avatar_types = ['image/png', 'image/jpeg', 'image/webp'];
	const max_avatar_size = 1 * 1024 * 1024;

	let photoErrorMessage = $state<string | null>(null);

	async function openPhotoModal(e: MouseEvent | KeyboardEvent) {
		lastTriggerElement = e.currentTarget as HTMLElement;
		photoErrorMessage = null;
		isEditPhotoModalOpen = true;
	}

	async function closePhotoModal() {
		isEditPhotoModalOpen = false;
		photoErrorMessage = null;
		await tick();
		lastTriggerElement?.focus();
	}

	function modalTrap(node: HTMLElement) {
		const focusableSelector =
			'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

		function handleKeyDown(e: KeyboardEvent) {
			if (e.key === 'Escape') {
				e.preventDefault();
				closePhotoModal();
				return;
			}

			if (e.key === 'Tab') {
				const focusables = Array.from(node.querySelectorAll<HTMLElement>(focusableSelector));
				if (focusables.length === 0) return;

				const first = focusables[0];
				const last = focusables[focusables.length - 1];

				if (e.shiftKey && document.activeElement === first) {
					e.preventDefault();
					last.focus();
				} else if (!e.shiftKey && document.activeElement === last) {
					e.preventDefault();
					first.focus();
				}
			}
		}

		tick().then(() => {
			const firstFocusable = node.querySelector<HTMLElement>(focusableSelector);
			firstFocusable?.focus();
		});

		node.addEventListener('keydown', handleKeyDown);
		return {
			destroy() {
				node.removeEventListener('keydown', handleKeyDown);
			}
		};
	}

	function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];

		photoErrorMessage = null;
		if (!file) {
			target.value = '';
			return;
		}

		if (!allowed_avatar_types.includes(file.type)) {
			photoErrorMessage = 'Format file tidak didukung. Gunakan PNG, JPG, atau WebP.';
			target.value = '';
			return;
		}

		if (file.size > max_avatar_size) {
			photoErrorMessage = 'Ukuran file terlalu besar. Maksimal ukuran foto adalah 1 MB.';
			target.value = '';
			return;
		}

		if (avatarUrl && avatarUrl.startsWith('blob:')) {
			URL.revokeObjectURL(avatarUrl);
		}
		avatarUrl = URL.createObjectURL(file);
		closePhotoModal();
		target.value = '';
	}

	function handleSave() {
		if (!isDirty) return;
		initialName = name;
		initialUsername = username;
		initialAvatarUrl = avatarUrl;
	}

	function handlePhotoAction(action: 'upload' | 'remove') {
		if (action === 'remove') {
			avatarUrl = null;
			closePhotoModal();
		} else if (action === 'upload') {
			fileInputRef?.click();
		}
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
				onclick={openPhotoModal}
				class="group relative flex size-20 items-center justify-center rounded-full bg-background-soft ring-1 ring-border/80 transition-all hover:opacity-90 cursor-pointer overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-dark"
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
				onclick={openPhotoModal}
				class="font-sans text-sm font-semibold text-primary-dark hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-dark rounded-md px-1"
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
					? 'rounded-xl bg-primary-dark px-6 py-3 font-sans text-sm font-semibold text-white shadow-xs transition-colors hover:bg-primary-dark/90 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-dark focus-visible:ring-offset-2'
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
	accept="image/png,image/jpeg,image/webp"
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
		use:modalTrap
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
					class="w-full py-3.5 font-sans text-sm font-medium text-foreground transition-colors hover:bg-background-soft cursor-pointer focus-visible:bg-background-soft focus-visible:outline-none"
				>
					Unggah Foto
				</button>
				<button
					type="button"
					onclick={() => handlePhotoAction('remove')}
					class="w-full py-3.5 font-sans text-sm font-medium text-foreground transition-colors hover:bg-background-soft cursor-pointer focus-visible:bg-background-soft focus-visible:outline-none"
				>
					Hapus Foto Saat Ini
				</button>
				<button
					type="button"
					onclick={closePhotoModal}
					class="w-full py-3.5 font-sans text-sm font-medium text-error-base transition-colors hover:bg-error/10 cursor-pointer focus-visible:bg-error/10 focus-visible:outline-none"
				>
					Batal
				</button>
			</div>

			{#if photoErrorMessage}
				<div class="border-t border-border/60 bg-red-50 p-3">
					<p class="font-sans text-xs text-error-base" role="alert">
						{photoErrorMessage}
					</p>
				</div>
			{/if}
		</div>
	</div>
{/if}

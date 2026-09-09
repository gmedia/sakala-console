<script lang="ts">
	import { PencilSimple, Eye, EyeClosed } from 'phosphor-svelte';
	import { useCurrentUser } from '$lib/features/auth/queries';

	const currentUserQuery = useCurrentUser();

	let initialEmail = $state('sasongko@gmail.com');
	let email = $state('sasongko@gmail.com');

	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');

	let showCurrentPassword = $state(false);
	let showNewPassword = $state(false);
	let showConfirmPassword = $state(false);

	$effect(() => {
		if (currentUserQuery.data?.email) {
			initialEmail = currentUserQuery.data.email;
			email = currentUserQuery.data.email;
		}
	});

	let isEmailDirty = $derived(email.trim() !== initialEmail && email.trim().length > 0);

	const isPasswordValid = $derived(
		currentPassword.trim().length > 0 && newPassword.length >= 8 && newPassword === confirmPassword
	);

	function handleUpdateEmail() {
		if (!isEmailDirty) return;
		initialEmail = email;
	}

	function handleUpdatePassword() {
		if (!isPasswordValid) return;
		currentPassword = '';
		newPassword = '';
		confirmPassword = '';
	}
</script>

<div class="space-y-6">
	<div class="rounded-2xl border border-border/70 bg-white p-6 shadow-xs space-y-4">
		<div>
			<h3 class="font-sans text-base font-semibold text-foreground">Email</h3>
			<p class="mt-0.5 font-sans text-xs text-muted">
				Alamat email dipakai untuk login dan notifikasi penting.
			</p>
		</div>

		<div class="space-y-4">
			<div class="relative">
				<input
					type="email"
					bind:value={email}
					class="w-full rounded-xl border border-border/80 bg-white px-4 py-3 pr-10 font-sans text-sm text-foreground focus:border-primary-dark focus:outline-none focus:ring-1 focus:ring-primary-dark"
				/>
				<PencilSimple
					size={18}
					class="absolute right-3.5 top-3.5 size-4.5 text-muted pointer-events-none"
				/>
			</div>

			<button
				type="button"
				onclick={handleUpdateEmail}
				disabled={!isEmailDirty}
				class={isEmailDirty
					? 'rounded-xl bg-primary-dark px-5 py-2.5 font-sans text-sm font-semibold text-white shadow-xs transition-colors hover:bg-primary-dark/90 cursor-pointer'
					: 'rounded-xl bg-[#E5E7EB] px-5 py-2.5 font-sans text-sm font-semibold text-[#9CA3AF] cursor-not-allowed'}
			>
				Ubah Email
			</button>
		</div>
	</div>

	<div class="rounded-2xl border border-border/70 bg-white p-6 shadow-xs space-y-6">
		<div>
			<h3 class="font-sans text-base font-semibold text-foreground">Ubah Kata Sandi</h3>
			<p class="mt-0.5 font-sans text-xs text-muted">
				Harap ganti kata sandi sementara ini dengan kata sandi baru yang aman.
			</p>
		</div>

		<div class="space-y-5">
			<div class="space-y-2">
				<label for="current-password" class="block font-sans text-sm font-medium text-foreground">
					Kata sandi saat ini
				</label>
				<div class="relative">
					<input
						id="current-password"
						type={showCurrentPassword ? 'text' : 'password'}
						placeholder="Masukkan kata sandi saat ini"
						bind:value={currentPassword}
						class="w-full rounded-xl border border-border/80 bg-white px-4 py-3 pr-11 font-sans text-sm text-foreground focus:border-primary-dark focus:outline-none focus:ring-1 focus:ring-primary-dark"
					/>
					<button
						type="button"
						onclick={() => (showCurrentPassword = !showCurrentPassword)}
						class="absolute right-3.5 top-3.5 text-muted hover:text-foreground cursor-pointer"
						aria-label={showCurrentPassword
							? 'Sembunyikan kata sandi saat ini'
							: 'Tampilkan kata sandi saat ini'}
					>
						{#if showCurrentPassword}
							<EyeClosed size={18} />
						{:else}
							<Eye size={18} />
						{/if}
					</button>
				</div>
			</div>

			<div class="space-y-2">
				<label for="new-password" class="block font-sans text-sm font-medium text-foreground">
					Kata sandi baru
				</label>
				<div class="relative">
					<input
						id="new-password"
						type={showNewPassword ? 'text' : 'password'}
						placeholder="Masukkan kata sandi baru Anda"
						bind:value={newPassword}
						class="w-full rounded-xl border border-border/80 bg-white px-4 py-3 pr-11 font-sans text-sm text-foreground focus:border-primary-dark focus:outline-none focus:ring-1 focus:ring-primary-dark"
					/>
					<button
						type="button"
						onclick={() => (showNewPassword = !showNewPassword)}
						class="absolute right-3.5 top-3.5 text-muted hover:text-foreground cursor-pointer"
						aria-label={showNewPassword
							? 'Sembunyikan kata sandi baru'
							: 'Tampilkan kata sandi baru'}
					>
						{#if showNewPassword}
							<EyeClosed size={18} />
						{:else}
							<Eye size={18} />
						{/if}
					</button>
				</div>
				<p class="font-sans text-xs text-muted">
					Minimal 8 karakter dengan kombinasi huruf, angka, dan simbol.
				</p>
			</div>

			<div class="space-y-2">
				<label for="confirm-password" class="block font-sans text-sm font-medium text-foreground">
					Konfirmasi kata sandi baru
				</label>
				<div class="relative">
					<input
						id="confirm-password"
						type={showConfirmPassword ? 'text' : 'password'}
						placeholder="Masukkan konfirmasi kata sandi baru Anda"
						bind:value={confirmPassword}
						class="w-full rounded-xl border border-border/80 bg-white px-4 py-3 pr-11 font-sans text-sm text-foreground focus:border-primary-dark focus:outline-none focus:ring-1 focus:ring-primary-dark"
					/>
					<button
						type="button"
						onclick={() => (showConfirmPassword = !showConfirmPassword)}
						class="absolute right-3.5 top-3.5 text-muted hover:text-foreground cursor-pointer"
						aria-label={showConfirmPassword
							? 'Sembunyikan konfirmasi kata sandi'
							: 'Tampilkan konfirmasi kata sandi'}
					>
						{#if showConfirmPassword}
							<EyeClosed size={18} />
						{:else}
							<Eye size={18} />
						{/if}
					</button>
				</div>
				<p class="font-sans text-xs text-muted">
					Minimal 8 karakter dengan kombinasi huruf, angka, dan simbol.
				</p>
			</div>

			<div class="pt-2">
				<button
					type="button"
					onclick={handleUpdatePassword}
					disabled={!isPasswordValid}
					class={isPasswordValid
						? 'w-full rounded-xl bg-primary-dark py-3 font-sans text-sm font-semibold text-white shadow-xs transition-colors hover:bg-primary-dark/90 cursor-pointer'
						: 'w-full rounded-xl bg-[#E5E7EB] py-3 font-sans text-sm font-semibold text-[#9CA3AF] cursor-not-allowed'}
				>
					Perbarui Kata Sandi
				</button>
			</div>
		</div>
	</div>
</div>

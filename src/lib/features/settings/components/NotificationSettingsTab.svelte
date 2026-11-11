<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import Bell from 'phosphor-svelte/lib/Bell';
	import ShieldCheck from 'phosphor-svelte/lib/ShieldCheck';
	import { getErrorMessage } from '$lib/api/errors';
	import type { NotificationPreferences } from '$lib/api/resources/notifications';
	import { useUpdateNotificationPreferences } from '$lib/features/notifications/mutations';
	import { createNotificationPreferencesQuery } from '$lib/features/notifications/queries';
	import { cn } from '$lib/utils/cn';
	import NotificationSectionCard from './NotificationSectionCard.svelte';
	import NotificationToggleItem from './NotificationToggleItem.svelte';

	type Category = keyof NotificationPreferences;

	const CATEGORIES: Category[] = [
		'deployment_success',
		'deployment_failure',
		'project_issue',
		'account_security'
	];

	const preferencesQuery = createNotificationPreferencesQuery();
	const updatePreferences = useUpdateNotificationPreferences();

	/** Unsaved edits on top of what the API returned. */
	let edits = $state<Partial<NotificationPreferences>>({});
	let justSaved = $state(false);

	const saved = $derived(preferencesQuery.data);
	const current = $derived(saved ? { ...saved, ...edits } : null);
	const changes = $derived.by(() => {
		const result: Partial<NotificationPreferences> = {};
		if (!saved || !current) return result;
		for (const category of CATEGORIES) {
			if (current[category] !== saved[category]) result[category] = current[category];
		}
		return result;
	});
	const isDirty = $derived(Object.keys(changes).length > 0);
	const allEnabled = $derived(current ? CATEGORIES.every((category) => current[category]) : false);

	function setCategory(category: Category, value: boolean) {
		justSaved = false;
		edits = { ...edits, [category]: value };
	}

	function toggleAll() {
		justSaved = false;
		const next = !allEnabled;
		edits = Object.fromEntries(CATEGORIES.map((category) => [category, next]));
	}

	function handleSave() {
		if (!isDirty) return;
		updatePreferences.mutate(changes, {
			onSuccess: () => {
				edits = {};
				justSaved = true;
			}
		});
	}
</script>

{#if preferencesQuery.isPending}
	<p class="py-12 text-center text-sm text-muted" role="status">Memuat pengaturan notifikasi...</p>
{:else if preferencesQuery.isError || !current}
	<div class="space-y-3 py-12 text-center" role="alert">
		<p class="text-sm text-error-base">
			{getErrorMessage(preferencesQuery.error, 'Gagal memuat pengaturan notifikasi.')}
		</p>
		<Button variant="link" onclick={() => preferencesQuery.refetch()}>Coba lagi</Button>
	</div>
{:else}
	<div class="space-y-6">
		<div class="surface-card flex items-center justify-between gap-4 p-6">
			<div>
				<h2 class="font-sans text-base font-semibold text-foreground">Aktifkan semua notifikasi</h2>
				<p class="mt-0.5 text-xs text-muted">
					Mengatur notifikasi di lonceng Sakala, bukan email. Kategori yang dimatikan tidak membuat
					notifikasi sama sekali.
				</p>
			</div>

			<button
				type="button"
				role="switch"
				aria-label="Aktifkan semua notifikasi"
				aria-checked={allEnabled}
				onclick={toggleAll}
				class={cn(
					'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:ring-2 focus-visible:ring-primary-dark focus-visible:ring-offset-2 focus-visible:outline-none',
					allEnabled ? 'bg-primary-dark' : 'bg-muted'
				)}
			>
				<span
					class={cn(
						'pointer-events-none inline-block size-5 transform rounded-full bg-surface ring-0 transition duration-200 ease-in-out',
						allEnabled ? 'translate-x-5' : 'translate-x-0'
					)}
				></span>
			</button>
		</div>

		<NotificationSectionCard title="Aktivitas proyek" icon={Bell}>
			<NotificationToggleItem
				title="Deployment berhasil"
				description="Deployment selesai dan aplikasimu berjalan."
				checked={current.deployment_success}
				onToggle={() => setCategory('deployment_success', !current.deployment_success)}
			/>
			<NotificationToggleItem
				title="Deployment gagal"
				description="Deployment gagal sebelum aplikasimu berjalan."
				checked={current.deployment_failure}
				onToggle={() => setCategory('deployment_failure', !current.deployment_failure)}
			/>
			<NotificationToggleItem
				title="Masalah proyek"
				description="Aplikasi berhenti sendiri, atau auto-deploy dilewati."
				checked={current.project_issue}
				onToggle={() => setCategory('project_issue', !current.project_issue)}
			/>
		</NotificationSectionCard>

		<NotificationSectionCard title="Keamanan akun" icon={ShieldCheck}>
			<NotificationToggleItem
				title="Perubahan kata sandi dan email"
				description="Kabari kalau kata sandi atau email akunmu berubah."
				checked={current.account_security}
				onToggle={() => setCategory('account_security', !current.account_security)}
			/>
		</NotificationSectionCard>

		<div class="flex flex-col items-end gap-2 pt-2">
			{#if updatePreferences.isError}
				<p class="text-xs text-error-base" role="alert">
					{getErrorMessage(updatePreferences.error, 'Gagal menyimpan. Coba lagi.')}
				</p>
			{:else if justSaved}
				<p class="text-xs text-primary-dark" role="status">Pengaturan notifikasi tersimpan.</p>
			{/if}
			<Button
				class="w-full md:w-auto"
				onclick={handleSave}
				disabled={!isDirty || updatePreferences.isPending}
			>
				{updatePreferences.isPending ? 'Menyimpan...' : 'Simpan perubahan'}
			</Button>
		</div>
	</div>
{/if}

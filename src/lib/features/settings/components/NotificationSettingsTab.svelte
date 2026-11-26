<script lang="ts">
	import Check from 'phosphor-svelte/lib/Check';
	import { SvelteMap } from 'svelte/reactivity';
	import { getErrorMessage, getFieldError } from '$lib/api/errors';
	import type {
		EmailNotificationCategory,
		NotificationCategory,
		NotificationPreferencesChange
	} from '$lib/api/resources/notifications';
	import Button from '$lib/components/ui/Button.svelte';
	import LearnMore from '$lib/components/ui/LearnMore.svelte';
	import Switch from '$lib/components/ui/Switch.svelte';
	import { useUpdateNotificationPreferences } from '$lib/features/notifications/mutations';
	import { createNotificationPreferencesQuery } from '$lib/features/notifications/queries';

	type Row = {
		category: NotificationCategory;
		title: string;
		description: string;
		/** Only these three can be emailed; the API sends what matters for the rest regardless. */
		email: boolean;
	};

	const PROJECT_ROWS: Row[] = [
		{
			category: 'deployment_success',
			title: 'Deployment berhasil',
			description: 'Deployment selesai dan aplikasimu berjalan.',
			email: true
		},
		{
			category: 'deployment_failure',
			title: 'Deployment gagal',
			description: 'Deployment gagal sebelum aplikasimu berjalan.',
			email: true
		},
		{
			category: 'project_issue',
			title: 'Masalah proyek',
			description: 'Aplikasi berhenti sendiri, atau auto-deploy dilewati.',
			email: true
		}
	];
	const TEAM_ROW: Row = {
		category: 'workspace',
		title: 'Undangan dan keanggotaan tim',
		description: 'Undangan, undangan yang diterima, dan perubahan peranmu di tim.',
		email: false
	};
	const SECURITY_ROW: Row = {
		category: 'account_security',
		title: 'Perubahan kata sandi dan email',
		description: 'Saat kata sandi atau email akunmu berubah.',
		email: false
	};
	/** One card, three groups: the switches line up under one pair of column names. */
	const GROUPS: { id: string; title: string; rows: Row[] }[] = [
		{ id: 'projects', title: 'Aktivitas proyek', rows: PROJECT_ROWS },
		{ id: 'team', title: 'Tim', rows: [TEAM_ROW] },
		{ id: 'security', title: 'Keamanan akun', rows: [SECURITY_ROW] }
	];
	const BELL_CATEGORIES: NotificationCategory[] = [
		...PROJECT_ROWS.map((row) => row.category),
		TEAM_ROW.category,
		SECURITY_ROW.category
	];
	const SAVED_NOTE_MS = 3_000;
	const ALL_ROW = 'all';

	const uid = $props.id();
	const preferencesQuery = createNotificationPreferencesQuery();
	const updatePreferences = useUpdateNotificationPreferences();
	const current = $derived(preferencesQuery.data);
	const allBellEnabled = $derived(
		current ? BELL_CATEGORIES.every((category) => current[category]) : false
	);

	type Feedback = { kind: 'saving' | 'saved' } | { kind: 'error'; message: string };
	/** Keyed by row and channel, so the note sits next to the switch that moved. */
	const feedback = new SvelteMap<string, Feedback>();
	/** Not state: only clears the note it set. */
	const timers: Record<string, ReturnType<typeof setTimeout>> = {};

	function errorFor(error: unknown, fields: string[]): string {
		for (const field of fields) {
			const message = getFieldError(error, field);
			if (message) return message;
		}
		return getErrorMessage(error, 'Belum tersimpan, jadi pengaturannya dikembalikan. Coba lagi.');
	}

	async function save(noteKey: string, change: NotificationPreferencesChange, fields: string[]) {
		clearTimeout(timers[noteKey]);
		feedback.set(noteKey, { kind: 'saving' });
		try {
			await updatePreferences.mutateAsync(change);
			feedback.set(noteKey, { kind: 'saved' });
			timers[noteKey] = setTimeout(() => feedback.delete(noteKey), SAVED_NOTE_MS);
		} catch (error) {
			feedback.set(noteKey, { kind: 'error', message: errorFor(error, fields) });
		}
	}

	function toggleBell(category: NotificationCategory) {
		if (!current) return;
		void save(category, { [category]: !current[category] }, [category]);
	}

	function toggleEmail(category: EmailNotificationCategory) {
		if (!current) return;
		void save(category, { email: { [category]: !current.email[category] } }, [
			`email.${category}`,
			'email'
		]);
	}

	function toggleAllBell() {
		const next = !allBellEnabled;
		void save(
			ALL_ROW,
			Object.fromEntries(BELL_CATEGORIES.map((category) => [category, next])),
			BELL_CATEGORIES
		);
	}
</script>

{#snippet note(noteKey: string)}
	{@const state = feedback.get(noteKey)}
	<p class="mt-1 min-h-4 text-xs" aria-live="polite">
		{#if state?.kind === 'saved'}
			<span class="inline-flex items-center gap-1 text-primary-dark">
				<Check size={12} weight="bold" aria-hidden="true" />
				Tersimpan
			</span>
		{:else if state?.kind === 'saving'}
			<span class="text-muted">Menyimpan...</span>
		{:else if state?.kind === 'error'}
			<span class="text-error-dark" role="alert">{state.message}</span>
		{/if}
	</p>
{/snippet}

{#snippet row(item: Row)}
	{@const descriptionId = `${uid}-${item.category}-description`}
	<div
		class="grid gap-x-4 gap-y-2 py-3 sm:grid-cols-[minmax(0,1fr)_5rem_7.5rem] sm:items-start"
		data-testid="notification-row-{item.category}"
	>
		<div class="min-w-0">
			<p class="text-sm font-semibold text-foreground">{item.title}</p>
			<p id={descriptionId} class="mt-0.5 text-xs text-muted">{item.description}</p>
			{@render note(item.category)}
		</div>
		{#if current}
			<div class="flex items-center gap-2 sm:justify-center sm:pt-0.5">
				<span class="w-16 shrink-0 text-xs text-muted sm:hidden" aria-hidden="true">Lonceng</span>
				<Switch
					label={`Lonceng: ${item.title}`}
					describedBy={descriptionId}
					checked={current[item.category]}
					busy={feedback.get(item.category)?.kind === 'saving'}
					onToggle={() => toggleBell(item.category)}
				/>
			</div>
			<div class="flex items-center gap-2 sm:justify-center sm:pt-0.5">
				<span class="w-16 shrink-0 text-xs text-muted sm:hidden" aria-hidden="true">Email</span>
				{#if item.email}
					{@const category = item.category as EmailNotificationCategory}
					<Switch
						label={`Email: ${item.title}`}
						describedBy={descriptionId}
						checked={current.email[category]}
						busy={feedback.get(category)?.kind === 'saving'}
						onToggle={() => toggleEmail(category)}
					/>
				{:else}
					<p class="text-xs text-muted sm:text-center">Email penting selalu dikirim</p>
				{/if}
			</div>
		{/if}
	</div>
{/snippet}

{#snippet columns()}
	<!-- The switches name their channel themselves; these headings are for the eye. -->
	<div
		class="hidden gap-x-4 text-xs font-semibold text-muted sm:grid sm:grid-cols-[minmax(0,1fr)_5rem_7.5rem]"
		aria-hidden="true"
	>
		<span></span>
		<span class="text-center">Lonceng</span>
		<span class="text-center">Email</span>
	</div>
{/snippet}

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
	<div class="flex flex-col gap-4">
		<section class="surface-card flex items-start justify-between gap-4 p-4 sm:p-6">
			<div class="flex flex-col gap-1">
				<h2 class="font-sans text-base font-semibold text-foreground">Semua notifikasi lonceng</h2>
				<p id="{uid}-master-description" class="text-sm text-muted">
					Langsung tersimpan. Email diatur per kategori.
				</p>
				{@render note(ALL_ROW)}
			</div>
			<Switch
				label="Semua notifikasi lonceng"
				describedBy="{uid}-master-description"
				checked={allBellEnabled}
				busy={feedback.get(ALL_ROW)?.kind === 'saving'}
				onToggle={toggleAllBell}
			/>
		</section>

		<section
			class="surface-card flex flex-col gap-3 p-4 sm:p-6"
			aria-labelledby="{uid}-categories"
			data-testid="notification-categories"
		>
			<h2 id="{uid}-categories" class="font-sans text-base font-semibold text-foreground">
				Per kategori
			</h2>
			{@render columns()}
			{#each GROUPS as group (group.id)}
				<div role="group" aria-labelledby="{uid}-{group.id}" class="border-t border-border pt-3">
					<h3 id="{uid}-{group.id}" class="text-sm font-semibold text-primary-dark">
						{group.title}
					</h3>
					<div class="divide-y divide-border">
						{#each group.rows as item (item.category)}
							{@render row(item)}
						{/each}
					</div>
				</div>
			{/each}
			<LearnMore topic="lonceng dan email" testid="notification-channels-help">
				<p>
					Lonceng adalah notifikasi di Console. Email dikirim ke alamat akunmu, supaya kamu tetap
					tahu saat Console tidak dibuka.
				</p>
			</LearnMore>
		</section>
	</div>
{/if}

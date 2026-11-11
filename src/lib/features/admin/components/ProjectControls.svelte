<script lang="ts">
	import { toast } from 'svelte-sonner';
	import Button from '$lib/components/ui/Button.svelte';
	import { ApiError, NetworkError, getErrorMessage } from '$lib/api/errors';
	import type {
		AdminProject,
		ProjectControlAction,
		ReconcileOptions
	} from '$lib/api/resources/admin/projects';
	import ReasonDialog from './ReasonDialog.svelte';
	import { createProjectControlMutation } from '../mutations';

	let { project }: { project: AdminProject } = $props();

	const mutation = createProjectControlMutation();

	let action = $state<ProjectControlAction | null>(null);
	let error = $state<unknown>(null);
	let idempotencyKey = $state('');
	let desiredState = $state<ReconcileOptions['desired_state']>('running');
	let actions = $state<ReconcileOptions['actions']>([]);

	const suspended = $derived(project.status === 'suspended');
	const serving = $derived(project.active_deployment_id !== null);

	type ActionCopy = {
		label: string;
		title: string;
		consequence: string;
		variant: 'default' | 'destructive';
		done: string;
	};

	const COPY = $derived<Record<ProjectControlAction, ActionCopy>>({
		stop: {
			label: 'Hentikan',
			title: 'Hentikan workload proyek?',
			consequence: `Node menghentikan container ${project.name} dan URL publiknya berhenti melayani. Status proyek tidak berubah, jadi pemilik bisa men-deploy lagi kapan saja.`,
			variant: 'destructive',
			done: 'Perintah stop dikirim ke node. Status runtime berubah setelah node melaporkan hasilnya.'
		},
		suspend: {
			label: 'Tangguhkan',
			title: 'Tangguhkan proyek?',
			consequence: `${project.name} ditangguhkan: workload yang berjalan dihentikan, dan pemilik tidak bisa men-deploy atau mendeteksi ulang sampai penangguhan dibuka. Alasanmu dikirim apa adanya ke anggota workspace lewat notifikasi dan email, jadi jangan tulis identitas pelapor.`,
			variant: 'destructive',
			done: 'Proyek ditangguhkan. Kalau workload masih berjalan, node menghentikannya sebentar lagi.'
		},
		unsuspend: {
			label: 'Buka penangguhan',
			title: 'Buka penangguhan proyek?',
			consequence: `${project.name} bisa di-deploy lagi. Workload tidak dinyalakan otomatis: pemilik diberi tahu lalu perlu men-deploy ulang.`,
			variant: 'default',
			done: 'Penangguhan dibuka. Pemilik perlu men-deploy ulang.'
		},
		reconcile: {
			label: 'Rekonsiliasi',
			title: 'Rekonsiliasi workload?',
			consequence: `Node yang melayani ${project.name} mencocokkan workload dengan keadaan yang kamu pilih. Tanpa aksi yang dicentang, node hanya melaporkan perbedaannya.`,
			variant: 'default',
			done: 'Permintaan rekonsiliasi dikirim ke node. Hasilnya tercatat di riwayat command node.'
		}
	});

	const available = $derived<ProjectControlAction[]>(
		suspended ? ['unsuspend'] : [...(serving ? (['reconcile', 'stop'] as const) : []), 'suspend']
	);

	const RECONCILE_ACTIONS: { value: ReconcileOptions['actions'][number]; label: string }[] = [
		{ value: 'restore_route', label: 'Pasang ulang route publik' },
		{ value: 'restart_log_follower', label: 'Nyalakan ulang pembaca log' },
		{ value: 'cleanup_failed_candidate', label: 'Bersihkan container kandidat yang gagal' }
	];

	function open(next: ProjectControlAction) {
		error = null;
		desiredState = 'running';
		actions = [];
		// One key per dialog: a resend after a lost response is a retry, never a second command.
		idempotencyKey = crypto.randomUUID();
		action = next;
	}

	/** 403, 409, and the network each need a different next step, so each says so. */
	const errorText = $derived.by(() => {
		if (!error) return null;
		if (error instanceof ApiError && error.isForbidden) {
			return 'API menolak: akunmu tidak lagi punya akses admin. Muat ulang halaman.';
		}
		if (error instanceof ApiError && error.status === 409) {
			return `Belum bisa dijalankan: ${error.message} Muat ulang untuk melihat keadaan terbaru.`;
		}
		if (error instanceof NetworkError) {
			return 'Sakala API tidak bisa dijangkau. Permintaan aman dicoba lagi: kunci yang sama mencegah perintah ganda.';
		}
		return getErrorMessage(error, 'Permintaan gagal. Coba lagi.');
	});

	async function confirm(reason: string) {
		if (!action) return;
		const current = action;
		error = null;
		try {
			await mutation.mutateAsync({
				id: project.id,
				action: current,
				reason,
				idempotencyKey,
				reconcile: current === 'reconcile' ? { desired_state: desiredState, actions } : undefined
			});
			action = null;
			toast.success(COPY[current].done);
		} catch (caught) {
			error = caught;
		}
	}
</script>

<section aria-labelledby="controls-heading" class="surface-card flex flex-col gap-4 p-5">
	<div>
		<h2 id="controls-heading" class="text-base">Kontrol admin</h2>
		<p class="mt-1 text-sm text-muted">
			<strong class="text-foreground">Hentikan</strong> mematikan workload yang sedang melayani,
			pemilik tetap bisa men-deploy lagi.
			<strong class="text-foreground">Tangguhkan</strong> juga melarang deploy sampai admin membuka penangguhannya.
			Semua aksi meminta alasan dan tercatat di audit.
		</p>
	</div>
	<div class="flex flex-wrap gap-2">
		{#each available as item (item)}
			<!-- One filled button per screen: the destructive ones are outlined in red. -->
			<Button
				variant="secondary"
				class={COPY[item].variant === 'destructive'
					? 'text-error hover:border-error hover:text-error'
					: undefined}
				onclick={() => open(item)}
			>
				{COPY[item].label}
			</Button>
		{/each}
	</div>
	{#if !serving && !suspended}
		<p class="text-xs text-muted">
			Hentikan dan rekonsiliasi butuh deployment yang sedang melayani; proyek ini tidak punya.
		</p>
	{/if}
</section>

{#if action}
	{@const copy = COPY[action]}
	<ReasonDialog
		open={action !== null}
		id={`project-${action}`}
		title={copy.title}
		subject={`${project.name}${project.workspace ? ` · workspace ${project.workspace.name}` : ''}`}
		consequence={copy.consequence}
		confirmLabel={copy.label}
		variant={copy.variant}
		{error}
		{errorText}
		reasonHint={action === 'suspend'
			? 'Wajib. Dikirim ke anggota workspace dan tercatat di audit.'
			: undefined}
		onCancel={() => (action = null)}
		onConfirm={confirm}
	>
		{#snippet fields()}
			{#if action === 'reconcile'}
				<div class="space-y-1.5">
					<label for="reconcile-state" class="block text-sm font-medium"
						>Keadaan yang diinginkan</label
					>
					<select
						id="reconcile-state"
						class="control-input cursor-pointer"
						bind:value={desiredState}
					>
						<option value="running">Berjalan</option>
						<option value="stopped">Berhenti</option>
						<option value="missing">Tidak ada</option>
					</select>
				</div>
				<fieldset class="space-y-2">
					<legend class="text-sm font-medium">Aksi yang boleh dilakukan node</legend>
					{#each RECONCILE_ACTIONS as option (option.value)}
						<label class="flex items-center gap-3 text-sm">
							<input type="checkbox" class="size-5" value={option.value} bind:group={actions} />
							{option.label}
						</label>
					{/each}
				</fieldset>
			{/if}
		{/snippet}
	</ReasonDialog>
{/if}

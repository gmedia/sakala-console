<script lang="ts">
	import { toast } from 'svelte-sonner';
	import Check from 'phosphor-svelte/lib/Check';
	import Warning from 'phosphor-svelte/lib/Warning';
	import type { WorkspaceRole } from '$lib/api/resources/workspaces';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import { cn } from '$lib/utils/cn';
	import { INVITE_COPY, parseInviteAddresses, type InviteOutcome } from '../invite-addresses';
	import { createInviteManyMutation } from '../mutations';
	import RoleOptions from './RoleOptions.svelte';

	type Props = {
		open: boolean;
		workspaceId: string;
		workspaceName: string;
		/** Members' addresses, so an address already in the team is caught before it is sent. */
		memberEmails?: readonly (string | null | undefined)[];
	};

	let { open = $bindable(false), workspaceId, workspaceName, memberEmails = [] }: Props = $props();

	const uid = $props.id();
	const fieldId = `${uid}-emails`;
	const inviteMany = createInviteManyMutation(() => workspaceId);

	type Outcome = InviteOutcome & { malformed: string[] };

	let text = $state('');
	let role = $state<WorkspaceRole>('member');
	let fieldError = $state<string | null>(null);
	/** What the last send did, with the addresses it skipped. Cleared as soon as the text changes. */
	let outcome = $state<Outcome | null>(null);
	/** True after a paste or a send, so an address still being typed is not called wrong. */
	let reviewing = $state(false);
	let sending = $state(false);
	let sendingTotal = $state(0);
	let progress = $state(0);
	let textareaEl = $state<HTMLTextAreaElement | null>(null);
	// `sending` reaches the button a tick late for a double click; this does not.
	let submitting = false;

	$effect(() => {
		if (open) {
			text = '';
			role = 'member';
			fieldError = null;
			outcome = null;
			reviewing = false;
		}
	});

	const parsed = $derived(parseInviteAddresses(text, memberEmails));
	const skipped = $derived(parsed.malformed.length + parsed.members.length);
	const confirmLabel = $derived.by(() => {
		if (sending) {
			return sendingTotal > 1
				? `Mengirim ${Math.min(progress + 1, sendingTotal)} dari ${sendingTotal}...`
				: 'Mengirim...';
		}
		return parsed.ready.length > 1 ? `Kirim ${parsed.ready.length} undangan` : 'Kirim undangan';
	});
	const describedBy = $derived(
		[fieldError ? `${fieldId}-error` : `${fieldId}-hint`, outcome ? `${uid}-outcome` : null]
			.filter(Boolean)
			.join(' ')
	);

	function handleInput() {
		fieldError = null;
		outcome = null;
	}

	function nothingToSendMessage(): string {
		if (skipped === 0) return `Isi alamat email, misalnya ${INVITE_COPY.example}.`;
		if (parsed.members.length === 0 && parsed.malformed.length === 1) {
			return `Isi alamat email lengkap, misalnya ${INVITE_COPY.example}.`;
		}
		return 'Belum ada alamat yang bisa diundang. Lihat catatan di bawah.';
	}

	async function handleInvite() {
		if (submitting) return;
		reviewing = true;
		fieldError = null;
		const { ready, malformed, members } = parsed;

		if (ready.length === 0) {
			fieldError = nothingToSendMessage();
			outcome = skipped
				? { sent: [], members, failed: [], notSent: [], stopReason: null, malformed }
				: null;
			textareaEl?.focus();
			return;
		}

		submitting = true;
		sending = true;
		sendingTotal = ready.length;
		progress = 0;
		try {
			const result = await inviteMany.mutateAsync({
				emails: ready,
				role,
				onProgress: (done) => (progress = done)
			});
			if (result.sent.length === ready.length && skipped === 0) {
				open = false;
				toast.success(
					result.sent.length === 1
						? `Undangan dikirim ke ${result.sent[0].toLowerCase()}.`
						: `${result.sent.length} undangan terkirim.`
				);
				return;
			}
			outcome = { ...result, members: [...members, ...result.members], malformed };
			// What stays in the field is what is worth fixing and sending again.
			text = [...malformed, ...result.failed.map((item) => item.email), ...result.notSent].join(
				'\n'
			);
			textareaEl?.focus();
		} finally {
			submitting = false;
			sending = false;
		}
	}
</script>

{#snippet problem(message: string)}
	<li class="flex gap-2">
		<Warning size={16} class="mt-0.5 shrink-0 text-warning-dark" aria-hidden="true" />
		<span class="min-w-0 wrap-anywhere">{message}</span>
	</li>
{/snippet}

{#snippet problems(malformed: readonly string[], members: readonly string[])}
	{#each malformed as email (email)}
		{@render problem(INVITE_COPY.malformed(email))}
	{/each}
	{#each members as email (email)}
		{@render problem(INVITE_COPY.member(email))}
	{/each}
{/snippet}

<Dialog
	bind:open
	title="Undang anggota"
	description={`Orang yang diundang menerima email berisi tautan untuk bergabung ke ${workspaceName}. Mengundang email yang sama lagi mengganti undangan sebelumnya.`}
	descriptionClass="text-muted"
	class="max-w-lg"
	{confirmLabel}
	loading={sending}
	initialFocus={() => textareaEl}
	onConfirm={handleInvite}
>
	<form
		class="flex flex-col gap-4"
		novalidate
		onsubmit={(event) => {
			event.preventDefault();
			void handleInvite();
		}}
	>
		<div class="flex flex-col gap-1.5">
			<label for={fieldId} class="text-sm font-medium text-foreground">Email</label>
			<textarea
				id={fieldId}
				bind:this={textareaEl}
				bind:value={text}
				rows="3"
				autocomplete="email"
				spellcheck="false"
				placeholder={INVITE_COPY.example}
				required
				aria-invalid={fieldError ? 'true' : undefined}
				aria-describedby={describedBy}
				oninput={handleInput}
				onpaste={() => (reviewing = true)}
				class={cn('control-input max-h-48 resize-y', fieldError && 'border-error')}></textarea>
			{#if fieldError}
				<p id="{fieldId}-error" class="text-xs text-error-dark">{fieldError}</p>
			{:else}
				<p id="{fieldId}-hint" class="text-xs text-foreground/70">
					Bisa lebih dari satu. Pisahkan dengan koma, spasi, atau baris baru, atau tempel satu kolom
					dari spreadsheet.
				</p>
			{/if}
		</div>

		{#if outcome}
			<!-- After a send: what went out, and every address that did not, with the reason. -->
			<div
				id="{uid}-outcome"
				role="alert"
				class="flex flex-col gap-2 rounded-control border border-border bg-background-soft p-3 text-sm text-foreground"
				data-testid="invite-outcome"
			>
				{#if outcome.sent.length}
					<p class="flex items-center gap-2 font-medium">
						<Check size={16} weight="bold" class="text-primary-dark" aria-hidden="true" />
						{outcome.sent.length} undangan terkirim.
					</p>
				{/if}
				<ul class="flex flex-col gap-1.5">
					{@render problems(outcome.malformed, outcome.members)}
					{#each outcome.failed as item (item.email)}
						{@render problem(`${item.email}: ${item.message}`)}
					{/each}
					{#if outcome.notSent.length}
						{@render problem(INVITE_COPY.notSent(outcome.notSent.length, outcome.stopReason ?? ''))}
					{/if}
				</ul>
			</div>
		{:else if reviewing && skipped > 0}
			<!-- Before a send: the addresses that will be left out, so nothing is skipped silently. -->
			<div
				class="flex flex-col gap-2 rounded-control border border-border bg-background-soft p-3 text-sm text-foreground"
				aria-live="polite"
				data-testid="invite-review"
			>
				<p class="font-medium">
					{parsed.ready.length} alamat siap diundang, {skipped} tidak ikut dikirim:
				</p>
				<ul class="flex flex-col gap-1.5">
					{@render problems(parsed.malformed, parsed.members)}
				</ul>
			</div>
		{/if}

		<RoleOptions name="invite-role" bind:value={role} legend="Peran" />
		{#if role === 'owner'}
			<p class="text-sm text-muted" data-testid="owner-invite-note">
				Undangan sebagai pemilik hanya bisa diterima akun yang memakai email ini, dan tidak bisa
				diteruskan ke orang lain.
			</p>
		{/if}
	</form>
</Dialog>

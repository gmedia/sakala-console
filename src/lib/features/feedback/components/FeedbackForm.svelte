<script lang="ts">
	import { tick } from 'svelte';
	import { page } from '$app/state';
	import { ApiError, getErrorMessage, getFieldError } from '$lib/api/errors';
	import type { FeedbackCategory } from '$lib/api/resources/feedback';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import { createDeploymentQuery } from '$lib/features/deployments/queries';
	import { createProjectQuery } from '$lib/features/projects/queries';
	import CircleNotchIcon from 'phosphor-svelte/lib/CircleNotchIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import { readFeedbackContext } from '../context';
	import { createSubmitFeedbackMutation } from '../mutations';

	// Mirrors StoreFeedbackRequest in sakala-api, which stays the final check.
	const MESSAGE_MIN = 5;
	const MESSAGE_MAX = 2000;

	const categories: { value: FeedbackCategory; label: string }[] = [
		{ value: 'general', label: 'Umum' },
		{ value: 'bug', label: 'Ada yang rusak' },
		{ value: 'feature_request', label: 'Usul fitur' },
		{ value: 'experience', label: 'Pengalaman memakai Sakala' },
		{ value: 'performance', label: 'Kecepatan' }
	];

	const context = readFeedbackContext(page.url.searchParams);
	let projectId = $state(context.projectId);
	let deploymentId = $state(context.deploymentId);

	const projectQuery = createProjectQuery(() => projectId ?? '');
	const deploymentQuery = createDeploymentQuery(
		() => projectId ?? '',
		() => deploymentId ?? ''
	);

	let category = $state<FeedbackCategory>('general');
	let message = $state('');
	let consent = $state(false);
	let messageError = $state('');
	let categoryError = $state('');
	let formError = $state('');
	let sent = $state(false);
	let messageEl = $state<HTMLTextAreaElement>();
	let successEl = $state<HTMLElement>();

	const mutation = createSubmitFeedbackMutation();
	// `isPending` updates a tick after mutate(), which is too late for a double click.
	let submitting = false;

	function validateMessage(value: string): string {
		const length = value.trim().length;
		if (length === 0) return 'Tulis masukanmu dulu, supaya tim Sakala tahu apa yang perlu dilihat.';
		if (length < MESSAGE_MIN)
			return `Masukan minimal ${MESSAGE_MIN} karakter. Ceritakan sedikit lebih lengkap.`;
		if (length > MESSAGE_MAX) {
			return `Masukan paling panjang ${MESSAGE_MAX} karakter. Sekarang ${length} karakter, jadi perlu dipersingkat.`;
		}
		return '';
	}

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (submitting) return;

		formError = '';
		categoryError = '';
		messageError = validateMessage(message);
		if (messageError) {
			messageEl?.focus();
			return;
		}

		submitting = true;
		mutation.mutate(
			{
				category,
				message: message.trim(),
				consent,
				project_id: projectId,
				deployment_id: projectId ? deploymentId : null
			},
			{
				onSuccess: async () => {
					sent = true;
					await tick();
					successEl?.focus();
				},
				onError: (error) => {
					// Nothing is cleared here: the text stays so it can be sent again.
					if (error instanceof ApiError && error.isValidationError) {
						messageError = getFieldError(error, 'message') ?? '';
						categoryError = getFieldError(error, 'category') ?? '';
						if (messageError) messageEl?.focus();
						if (messageError || categoryError) return;
					}
					formError = getErrorMessage(
						error,
						'Masukanmu belum terkirim, dan tulisannya masih ada di form. Silakan coba lagi.'
					);
				},
				onSettled: () => {
					submitting = false;
				}
			}
		);
	}

	function writeAnother() {
		message = '';
		sent = false;
		consent = false;
	}
</script>

<div class="flex w-full max-w-reading flex-col gap-4">
	<p class="text-sm text-muted">
		Ceritakan yang kamu alami saat memakai Sakala selama pilot. Tidak wajib, dan tidak mengganggu
		deployment yang sedang berjalan.
	</p>

	{#if sent}
		<Card class="flex flex-col gap-3 rounded-control p-4">
			<div role="status" class="flex flex-col gap-3">
				<h2 bind:this={successEl} tabindex="-1" class="text-xl outline-none">
					Masukanmu sudah tersimpan
				</h2>
				<p class="text-sm">
					Tim Sakala membacanya untuk memperbaiki produk. Form ini bukan jalur bantuan, jadi kamu
					belum tentu mendapat balasan.
				</p>
			</div>
			<div>
				<Button variant="secondary" onclick={writeAnother}>Tulis masukan lain</Button>
			</div>
		</Card>
	{:else}
		<form onsubmit={handleSubmit} novalidate class="flex flex-col gap-4">
			<Card class="flex flex-col gap-4 rounded-control p-4">
				{#if projectId}
					<div class="flex flex-col gap-2">
						<p class="font-medium text-sm">Terkait dengan</p>
						<ul class="flex flex-wrap gap-2">
							<li
								class="flex min-w-0 items-center gap-1 rounded-full border border-border-strong py-1 pl-3 pr-1 text-sm"
							>
								<span class="min-w-0 wrap-anywhere">
									Proyek {projectQuery.data?.name ??
										(projectQuery.isError ? '(namanya belum bisa dimuat)' : '(memuat...)')}
								</span>
								<button
									type="button"
									aria-label="Hapus kaitan dengan proyek"
									class="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full hover:bg-muted/10"
									onclick={() => {
										projectId = null;
										deploymentId = null;
									}}
								>
									<XIcon class="size-4" aria-hidden="true" />
								</button>
							</li>
							{#if deploymentId}
								<li
									class="flex min-w-0 items-center gap-1 rounded-full border border-border-strong py-1 pl-3 pr-1 text-sm"
								>
									<span class="min-w-0 wrap-anywhere">
										Deployment {deploymentQuery.data
											? `#${deploymentQuery.data.data.sequence}`
											: deploymentQuery.isError
												? '(nomornya belum bisa dimuat)'
												: '(memuat...)'}
									</span>
									<button
										type="button"
										aria-label="Hapus kaitan dengan deployment"
										class="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full hover:bg-muted/10"
										onclick={() => (deploymentId = null)}
									>
										<XIcon class="size-4" aria-hidden="true" />
									</button>
								</li>
							{/if}
						</ul>
					</div>
				{/if}

				<div class="flex flex-col gap-1">
					<label for="feedback-category" class="font-medium text-sm">Jenis masukan</label>
					<select
						id="feedback-category"
						bind:value={category}
						aria-invalid={categoryError ? 'true' : undefined}
						aria-describedby={categoryError ? 'feedback-category-error' : undefined}
						class="control-input"
					>
						{#each categories as option (option.value)}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
					{#if categoryError}
						<p id="feedback-category-error" role="alert" class="text-xs text-error-dark">
							{categoryError}
						</p>
					{/if}
				</div>

				<div class="flex flex-col gap-1">
					<label for="feedback-message" class="font-medium text-sm">Masukanmu</label>
					<textarea
						id="feedback-message"
						bind:this={messageEl}
						bind:value={message}
						oninput={() => (messageError = '')}
						rows="6"
						aria-invalid={messageError ? 'true' : undefined}
						aria-describedby="feedback-message-help"
						class="control-input {messageError ? 'border-error' : ''}"></textarea>
					<p
						id="feedback-message-help"
						class="text-xs {messageError ? 'text-error-dark' : 'text-foreground/70'}"
					>
						{messageError ||
							`${MESSAGE_MIN} sampai ${MESSAGE_MAX} karakter. Sekarang ${message.trim().length} karakter.`}
					</p>
				</div>

				<p class="rounded-control bg-primary-50 p-3 text-sm">
					Jangan menulis kata sandi, token, atau isi environment variable di sini. Masukan disimpan
					di akunmu dan dibaca tim Sakala.
				</p>

				<label class="flex min-h-6 items-start gap-2 text-sm">
					<input type="checkbox" bind:checked={consent} class="mt-0.5 size-4 rounded-control" />
					Tim Sakala boleh memakai masukan ini untuk evaluasi pilot.
				</label>
			</Card>

			{#if formError}
				<p class="text-sm text-error-dark" role="alert">{formError}</p>
			{/if}

			<Button class="self-end" type="submit" disabled={mutation.isPending}>
				{#if mutation.isPending}
					<CircleNotchIcon class="size-5 animate-spin" aria-hidden="true" />
					Mengirim...
				{:else}
					Kirim masukan
				{/if}
			</Button>
		</form>
	{/if}
</div>

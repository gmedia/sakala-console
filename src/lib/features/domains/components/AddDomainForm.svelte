<script lang="ts">
	import Info from 'phosphor-svelte/lib/Info';
	import Plus from 'phosphor-svelte/lib/Plus';
	import CircleNotch from 'phosphor-svelte/lib/CircleNotch';
	import { getFieldError } from '$lib/api/errors';
	import { DOMAIN_KIND, type ProjectDomain } from '$lib/api/resources/project-domains';
	import Button from '$lib/components/ui/Button.svelte';
	import FormField from '$lib/components/ui/FormField.svelte';
	import { createAddDomainMutation } from '../mutations';
	import { parseDomainName, wwwOf } from '../names';
	import { DOMAIN_COPY, domainAddErrorMessage } from '../presentation';

	type Props = {
		projectId: string;
		/** Sakala's own zones the Console knows of, refused before sending. */
		forbiddenZones: readonly string[];
		/** Set when the workspace's quota leaves no room; the reason is shown by the section. */
		blocked: boolean;
		onAdded: (domain: ProjectDomain) => void;
	};

	let { projectId, forbiddenZones, blocked, onAdded }: Props = $props();

	const inputId = 'custom-domain-name';
	const addMutation = createAddDomainMutation();

	let value = $state('');
	let error = $state('');

	const parsed = $derived(value.trim() ? parseDomainName(value, forbiddenZones) : null);
	const apex = $derived(parsed?.ok && parsed.kind === DOMAIN_KIND.apex ? parsed.hostname : null);

	// `isPending` updates a tick after mutate(), which is too late for a double click.
	let adding = false;

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (adding || blocked) return;
		const result = parseDomainName(value, forbiddenZones);
		if (!result.ok) {
			error = result.message;
			document.getElementById(inputId)?.focus();
			return;
		}
		adding = true;
		error = '';
		try {
			const domain = await addMutation.mutateAsync({ projectId, hostname: result.hostname });
			value = '';
			onAdded(domain);
		} catch (failure) {
			error = getFieldError(failure, 'hostname') ?? domainAddErrorMessage(failure);
			document.getElementById(inputId)?.focus();
		} finally {
			adding = false;
		}
	}
</script>

<form onsubmit={submit} novalidate class="flex flex-col gap-3" data-testid="add-domain-form">
	<div class="flex flex-col gap-2 sm:flex-row sm:items-start">
		<div class="min-w-0 flex-1">
			<FormField
				id={inputId}
				label={DOMAIN_COPY.inputLabel}
				placeholder={DOMAIN_COPY.inputPlaceholder}
				autocomplete="off"
				spellcheck={false}
				inputClass="font-mono"
				disabled={blocked}
				bind:value
				oninput={() => (error = '')}
				{error}
			/>
		</div>
		<Button
			type="submit"
			class="sm:mt-6.5"
			disabled={blocked || addMutation.isPending}
			aria-busy={addMutation.isPending}
		>
			{#if addMutation.isPending}
				<CircleNotch
					size={16}
					weight="bold"
					class="animate-spin motion-reduce:animate-none"
					aria-hidden="true"
				/>
			{:else}
				<Plus size={16} aria-hidden="true" />
			{/if}
			{DOMAIN_COPY.add}
		</Button>
	</div>

	{#if apex && !error}
		<div
			class="flex flex-col gap-2 rounded-control border border-info/20 bg-info/10 p-3 text-sm"
			data-testid="apex-hint"
		>
			<p class="flex gap-2 wrap-anywhere text-foreground">
				<Info size={18} class="mt-0.5 shrink-0 text-info" aria-hidden="true" />
				<span
					><span class="font-medium">{DOMAIN_COPY.apexTitle(apex)}</span>
					{DOMAIN_COPY.apexShort}</span
				>
			</p>
			<div class="flex flex-wrap items-center gap-x-3 gap-y-1 pl-6.5">
				<Button variant="secondary" size="sm" onclick={() => (value = wwwOf(apex))}>
					{DOMAIN_COPY.useWww(wwwOf(apex))}
				</Button>
				<details>
					<summary
						class="inline-flex min-h-6 cursor-pointer items-center font-medium text-primary-dark underline underline-offset-2"
						>{DOMAIN_COPY.learn}</summary
					>
					<p class="mt-1 text-foreground/80">{DOMAIN_COPY.apexLearn}</p>
				</details>
			</div>
		</div>
	{/if}
</form>

<script lang="ts">
	import { flushSync } from 'svelte';
	import { Combobox } from 'bits-ui';
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDownIcon';
	import CheckIcon from 'phosphor-svelte/lib/CheckIcon';
	import { cn } from '$lib/utils/cn';

	type Props = {
		id: string;
		value: string;
		branches: string[];
		loading?: boolean;
		/** The list is known to be cut off, so a name outside it may still be real. */
		allowOther?: boolean;
		invalid?: boolean;
		describedBy?: string;
		onValueChange: (branch: string) => void;
	};

	let {
		id,
		value,
		branches,
		loading = false,
		allowOther = false,
		invalid = false,
		describedBy,
		onValueChange
	}: Props = $props();

	let open = $state(false);
	let query = $state('');
	// bits-ui only lets this be pushed in, so a text abandoned on close is replaced from here.
	// svelte-ignore state_referenced_locally
	let inputText = $state(value);

	const matches = $derived.by(() => {
		const needle = query.trim().toLowerCase();
		return needle ? branches.filter((branch) => branch.toLowerCase().includes(needle)) : branches;
	});
	const otherBranch = $derived.by(() => {
		const typed = query.trim();
		return allowOther && typed && !branches.includes(typed) ? typed : null;
	});
</script>

<Combobox.Root
	type="single"
	{value}
	bind:open
	allowDeselect={false}
	inputValue={inputText}
	onValueChange={(next) => {
		if (next) {
			onValueChange(next);
			inputText = next;
		}
		query = '';
	}}
	onOpenChangeComplete={(open) => {
		if (open) return;
		query = '';
		inputText = value;
	}}
>
	<div class="relative">
		<Combobox.Input
			{id}
			autocomplete="off"
			spellcheck={false}
			aria-invalid={invalid ? 'true' : undefined}
			aria-describedby={describedBy}
			oninput={(event) => {
				query = event.currentTarget.value;
				inputText = query;
				open = true;
				// bits-ui highlights the first option right after this handler. Without a flush that
				// is an option the filter is about to remove, and Enter would then do nothing.
				flushSync();
			}}
			onclick={() => (open = true)}
			onfocus={(event) => event.currentTarget.select()}
			placeholder="Cari branch..."
			class={cn(
				'w-full rounded-lg border bg-primary-50/40 px-4 py-2 pr-11 font-jetbrains-mono-regular text-sm focus:ring-primary',
				invalid ? 'border-error ring-1 ring-error' : 'border-border-strong'
			)}
		/>
		<Combobox.Trigger
			aria-label="Tampilkan daftar branch"
			class="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center"
		>
			<CaretDownIcon class="size-5" aria-hidden="true" />
		</Combobox.Trigger>
	</div>
	<Combobox.Portal>
		<Combobox.Content
			sideOffset={4}
			class="z-50 max-h-64 w-(--bits-combobox-anchor-width) overflow-y-auto rounded-lg border border-border-strong bg-surface py-1 shadow-md"
		>
			<Combobox.Viewport>
				{#if loading}
					<p class="px-3 py-2 font-montserrat text-sm text-foreground/70">Memuat branch...</p>
				{:else if matches.length === 0 && !otherBranch}
					<p class="px-3 py-2 font-montserrat text-sm text-foreground/70">
						Tidak ada branch dengan nama itu.
					</p>
				{/if}
				{#each matches as branch (branch)}
					<Combobox.Item
						value={branch}
						label={branch}
						class="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 font-jetbrains-mono-regular text-sm wrap-anywhere data-highlighted:bg-primary data-highlighted:text-white"
					>
						{#snippet children({ selected })}
							{branch}
							{#if selected}
								<CheckIcon class="size-4 shrink-0" aria-label="Terpilih" />
							{/if}
						{/snippet}
					</Combobox.Item>
				{/each}
				{#if otherBranch}
					<Combobox.Item
						value={otherBranch}
						label={otherBranch}
						class="cursor-pointer px-3 py-2 font-montserrat text-sm wrap-anywhere data-highlighted:bg-primary data-highlighted:text-white"
					>
						Pakai branch "{otherBranch}"
					</Combobox.Item>
				{/if}
			</Combobox.Viewport>
		</Combobox.Content>
	</Combobox.Portal>
</Combobox.Root>

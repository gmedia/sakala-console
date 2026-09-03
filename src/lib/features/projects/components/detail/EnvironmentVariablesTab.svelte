<script lang="ts">
	import { Eye, EyeSlash, Check, X, Plus } from 'phosphor-svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { createEnvironmentVariablesQuery } from '../../queries';
	import {
		createAddEnvironmentVariableMutation,
		createDeleteEnvironmentVariableMutation
	} from '../../mutations';

	let { projectId }: { projectId: string } = $props();

	// Queries & Mutations
	const query = createEnvironmentVariablesQuery(() => projectId);
	const addMutation = createAddEnvironmentVariableMutation();
	const deleteMutation = createDeleteEnvironmentVariableMutation();

	// Local State
	const revealedIds = new SvelteSet<string>();
	let isAdding = $state(false);
	let newKey = $state('');
	let newValue = $state('');
	let errorMessage = $state('');

	// Handlers
	function toggleReveal(id: string) {
		if (revealedIds.has(id)) {
			revealedIds.delete(id);
		} else {
			revealedIds.add(id);
		}
	}

	function handleKeyInput(e: Event) {
		const target = e.target as HTMLInputElement;
		newKey = target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
		if (errorMessage) errorMessage = '';
	}

	function handleValueInput() {
		if (errorMessage) errorMessage = '';
	}

	function handleOpenAdd() {
		isAdding = true;
		errorMessage = '';
	}

	function handleCancelAdd() {
		newKey = '';
		newValue = '';
		errorMessage = '';
		isAdding = false;
	}

	function handleSave() {
		if (!newKey.trim() || !newValue.trim()) {
			errorMessage = 'Nama variabel dan value tidak boleh kosong.';
			return;
		}

		addMutation.mutate({
			projectId,
			data: {
				key: newKey.trim(),
				value: newValue.trim(),
				is_secret: true
			}
		});

		newKey = '';
		newValue = '';
		errorMessage = '';
		isAdding = false;
	}

	function handleDelete(id: string) {
		if (confirm('Apakah kamu yakin ingin menghapus variabel ini?')) {
			deleteMutation.mutate({ projectId, id });
		}
	}
</script>

<div class="flex flex-col w-280 max-w-full">
	<div
		class="w-280 max-w-full rounded-lg border border-border bg-surface overflow-hidden shadow-none"
	>
		{#if query.isLoading}
			<div class="p-6 text-center text-sm font-montserrat text-muted">
				Memuat environment variables...
			</div>
		{:else if query.isError}
			<div class="p-6 text-center text-sm font-montserrat text-error">
				Gagal memuat data environment variables.
			</div>
		{:else if query.data}
			{#if query.data.length === 0 && !isAdding}
				<div class="p-8 text-center text-sm font-montserrat text-muted">
					Belum ada environment variable untuk proyek ini.
				</div>
			{:else}
				<div class="flex flex-col w-full divide-y divide-border">
					{#each query.data as env (env.id)}
						<div class="flex items-center w-280 max-w-full h-18 bg-surface">
							<div class="ml-6 w-58 mr-10 shrink-0">
								<span
									class="font-jetbrains-mono-semibold font-bold text-base text-foreground break-all"
								>
									{env.key}
								</span>
							</div>

							<div class="w-107.25 h-10 flex items-center overflow-hidden mr-4 shrink-0">
								{#if revealedIds.has(env.id)}
									<span class="font-montserrat-semibold text-base text-muted truncate">
										{env.value}
									</span>
								{:else}
									<span
										class="font-montserrat-semibold text-base text-muted tracking-widest truncate"
									>
										{Array(Math.min(env.value.length, 20)).fill('.').join('')}
									</span>
								{/if}
							</div>

							<div class="flex items-center shrink-0">
								<button
									type="button"
									class="text-muted hover:text-foreground transition-colors cursor-pointer"
									onclick={() => toggleReveal(env.id)}
									title={revealedIds.has(env.id) ? 'Sembunyikan nilai' : 'Tampilkan nilai'}
								>
									{#if revealedIds.has(env.id)}
										<Eye size={24} weight="regular" />
									{:else}
										<EyeSlash size={24} weight="regular" />
									{/if}
								</button>
							</div>

							<div class="flex-1"></div>

							<button
								type="button"
								class="font-montserrat-medium text-sm text-muted hover:text-error transition-colors mr-6 cursor-pointer"
								onclick={() => handleDelete(env.id)}
								disabled={deleteMutation.isPending}
							>
								Hapus
							</button>
						</div>
					{/each}
				</div>
			{/if}
		{/if}

		{#if isAdding}
			<div
				class="flex flex-col justify-center w-280 max-w-full min-h-21 bg-primary-50/50 border-t border-border py-4"
			>
				<div class="flex items-center">
					<input
						type="text"
						placeholder="NAMA_VARIABEL"
						value={newKey}
						oninput={handleKeyInput}
						class="ml-6 w-58 h-13 rounded-lg bg-surface border {errorMessage
							? 'border-error-dark focus:border-error-dark'
							: 'border-border focus:border-primary'} pl-4 pr-3 font-montserrat text-base text-foreground outline-none uppercase placeholder:normal-case placeholder:font-montserrat placeholder:text-muted shrink-0 transition-colors"
					/>

					<input
						type="text"
						placeholder="Isi value"
						bind:value={newValue}
						oninput={handleValueInput}
						class="ml-2 w-176 h-13 rounded-lg bg-surface border {errorMessage
							? 'border-error-dark focus:border-error-dark'
							: 'border-border focus:border-primary'} pl-4 pr-3 font-montserrat text-base text-foreground outline-none placeholder:font-montserrat placeholder:text-muted shrink-0 transition-colors"
					/>

					<button
						type="button"
						class="ml-10 w-10 h-12 rounded-lg bg-primary text-white flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
						onclick={handleSave}
						disabled={addMutation.isPending}
						title="Simpan"
					>
						<Check size={24} weight="bold" />
					</button>

					<button
						type="button"
						class="ml-2 mr-6 w-10 h-12 rounded-lg bg-transparent text-muted hover:text-foreground flex items-center justify-center hover:bg-black/5 transition-colors shrink-0 cursor-pointer"
						onclick={handleCancelAdd}
						title="Batal"
					>
						<X size={24} weight="regular" />
					</button>
				</div>

				{#if errorMessage}
					<span class="ml-6 mt-2 font-montserrat text-xs text-error-dark">
						{errorMessage}
					</span>
				{/if}
			</div>
		{/if}
	</div>

	{#if isAdding}
		<p class="mt-3 font-montserrat text-xs text-muted">
			Key otomatis jadi UPPERCASE_SNAKE_CASE. Klik centang untuk simpan, silang untuk batal.
		</p>
	{/if}

	{#if !isAdding}
		<button
			type="button"
			onclick={handleOpenAdd}
			class="mt-4 flex items-center justify-center w-280 max-w-full h-12 rounded-lg border border-dashed border-black bg-surface text-foreground font-montserrat-semibold text-base gap-3 hover:bg-surface-elevated transition-colors cursor-pointer"
		>
			<Plus size={24} weight="regular" />
			<span>Tambah Variabel</span>
		</button>
	{/if}
</div>

<script lang="ts">
	import { LEGAL_LINKS } from '$lib/config/project';
	import LegalLink from './LegalLink.svelte';

	type Props = {
		id: string;
		checked: boolean;
		error?: string;
		disabled?: boolean;
		onchange?: () => void;
	};

	let { id, checked = $bindable(), error, disabled = false, onchange }: Props = $props();
</script>

<!-- One declaration, one box. The privacy notice is read, not agreed to, so it never gets a box. -->
<div class="space-y-3">
	<div>
		<label for={id} class="flex cursor-pointer items-start gap-3 text-sm text-foreground">
			<input
				{id}
				type="checkbox"
				bind:checked
				{onchange}
				{disabled}
				required
				aria-invalid={error ? 'true' : undefined}
				aria-describedby={error ? `${id}-error` : undefined}
				class="mt-0.5 size-5 shrink-0 cursor-pointer"
			/>
			<span>
				Saya berusia minimal 18 tahun atau sudah mendapat persetujuan orang tua atau wali, dan
				menyetujui <LegalLink href={LEGAL_LINKS.terms}>Syarat Layanan</LegalLink> dan
				<LegalLink href={LEGAL_LINKS.acceptableUse}>Kebijakan Penggunaan Wajar</LegalLink>.
			</span>
		</label>
		{#if error}
			<p id="{id}-error" class="mt-1.5 text-xs text-error-dark">{error}</p>
		{/if}
	</div>

	<p class="text-sm text-muted">
		Baca <LegalLink href={LEGAL_LINKS.privacy}>Pemberitahuan Privasi</LegalLink> untuk tahu bagaimana
		datamu diproses.
	</p>
</div>

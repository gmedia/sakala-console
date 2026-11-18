<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import type { AuthProviderOption, OAuthProviderId } from '../availability';
	import type { AuthProviderId } from '../utils/oauth';
	import LastUsedBadge from './LastUsedBadge.svelte';
	import SocialLogo from './SocialLogo.svelte';

	type Props = {
		providers: AuthProviderOption[];
		/** "Masuk" or "Daftar", the verb in front of each provider name. */
		verb: string;
		lastUsed?: AuthProviderId | null;
		onSelect: (id: OAuthProviderId) => void;
	};

	let { providers, verb, lastUsed = null, onSelect }: Props = $props();
</script>

<div class="space-y-3">
	{#each providers as provider (provider.id)}
		{@const isLastUsed = provider.id === lastUsed}
		<Button
			variant="secondary"
			size="lg"
			class="w-full justify-between"
			onclick={() => onSelect(provider.id)}
		>
			<span class="flex items-center gap-2.5 text-left">
				<SocialLogo name={provider.id} />
				<span>{verb} dengan {provider.name}</span>
			</span>
			{#if isLastUsed}
				<LastUsedBadge />
			{/if}
		</Button>
	{/each}
</div>

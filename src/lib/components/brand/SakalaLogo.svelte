<script lang="ts">
	import { resolve } from '$app/paths';
	import { cn } from '$lib/utils/cn';
	import markSrc from '$lib/assets/favicon.svg';
	import taglineWhiteSrc from '$lib/assets/sakala-logo.svg';
	import wordmarkSrc from '$lib/assets/sakala-wordmark.svg';
	import wordmarkWhiteSrc from '$lib/assets/sakala-wordmark-white.svg';

	type Props = {
		/**
		 * `tagline` is only readable above 200 px wide, so it belongs on the auth hero and nowhere
		 * smaller. `mark` is the simplified S, drawn for 16 to 32 px.
		 */
		lockup?: 'wordmark' | 'mark' | 'tagline';
		tone?: 'brand' | 'white';
		class?: string;
		onclick?: () => void;
	};

	let { lockup = 'wordmark', tone = 'brand', class: className = '', onclick }: Props = $props();

	const src = $derived.by(() => {
		if (lockup === 'mark') return markSrc;
		if (lockup === 'tagline') return taglineWhiteSrc;
		return tone === 'white' ? wordmarkWhiteSrc : wordmarkSrc;
	});
</script>

<!-- Inside the Console a logo always goes to the Console's home. The landing page has its own. -->
<a
	href={resolve('/projects')}
	{onclick}
	class={cn('inline-flex shrink-0 items-center', className)}
	aria-label="Sakala"
>
	<img {src} alt="" class="h-full w-auto" />
</a>

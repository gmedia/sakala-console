<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { settingsHref } from '$lib/features/projects/overview/links';

	// Settings are sub-pages now. A link from before the split (`/settings#releaseCommand`) carries
	// the section or field in its hash, which only the browser sees, so the redirect happens here:
	// the anchor decides the page, and a field's id travels on so the page can open it.
	$effect(() => {
		const projectId = page.params.id;
		if (!projectId) return;
		const anchor = page.url.hash.slice(1) || undefined;
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolveRoute() plus a hash
		void goto(settingsHref(projectId, anchor), { replaceState: true });
	});
</script>

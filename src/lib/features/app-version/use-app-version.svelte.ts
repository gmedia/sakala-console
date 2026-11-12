import { beforeNavigate } from '$app/navigation';
import { updated } from '$app/state';
import { toast } from 'svelte-sonner';

export const NEW_VERSION_MESSAGE =
	'Versi baru Sakala sudah tersedia. Halaman dimuat ulang saat kamu pindah halaman.';

/**
 * A tab left open across a deploy still runs the old build, whose code-split chunks are gone from
 * the server. Instead of a reload in the middle of whatever the user is doing, the Console notices
 * the new version, says so once, and makes the next navigation a full page load, which fetches the
 * new build.
 *
 * Two signals: SvelteKit polls `/_app/version.json` (`version.pollInterval` in vite.config.ts) and
 * sets `updated`, and Vite fires `vite:preloadError` when a chunk fails to load. A failed chunk
 * also asks SvelteKit to check the version at once. The failing import is left to SvelteKit, which
 * already answers a navigation it cannot load with a full load of the same URL.
 *
 * Call once, from the root layout.
 */
export function useAppVersion() {
	let chunkFailed = $state(false);
	const stale = $derived(updated.current || chunkFailed);

	$effect(() => {
		if (stale) toast.info(NEW_VERSION_MESSAGE, { id: 'app-version' });
	});

	$effect(() => {
		const onPreloadError = () => {
			chunkFailed = true;
			void updated.check();
		};
		window.addEventListener('vite:preloadError', onPreloadError);
		return () => window.removeEventListener('vite:preloadError', onPreloadError);
	});

	beforeNavigate(({ to, willUnload }) => {
		if (stale && !willUnload && to?.url) location.href = to.url.href;
	});
}

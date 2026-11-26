<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { getCurrentUser } from '$lib/api/resources/auth';
	import { unsubscribeFromNotificationEmail } from '$lib/api/resources/notifications';
	import Button from '$lib/components/ui/Button.svelte';
	import AuthStatusScreen from '$lib/features/auth/components/AuthStatusScreen.svelte';
	import {
		emailCategoryLabel,
		isCompleteUnsubscribeLink,
		unsubscribeOutcome,
		unsubscribeOutcomeCopy,
		type UnsubscribeOutcome
	} from '$lib/features/notifications/unsubscribe';
	import { pageTitle } from '$lib/utils/page-title';

	// Email links land here (the API redirects its GET here), so nothing changes until confirmed:
	// mail scanners open every link.
	const search = page.url.search;
	const params = page.url.searchParams;
	const label = emailCategoryLabel(params.get('category'));
	const complete = isCompleteUnsubscribeLink(params);

	type State =
		| { kind: 'confirm' }
		| { kind: 'pending' }
		| { kind: 'done'; signedIn: boolean }
		| { kind: 'failed'; outcome: UnsubscribeOutcome };

	let state = $state<State>(
		complete ? { kind: 'confirm' } : { kind: 'failed', outcome: { kind: 'invalid' } }
	);

	async function confirm() {
		if (state.kind === 'pending') return;
		state = { kind: 'pending' };
		try {
			await unsubscribeFromNotificationEmail(search);
		} catch (error) {
			state = { kind: 'failed', outcome: unsubscribeOutcome(error) };
			return;
		}
		// Only to offer the settings link. Read outside the query cache, so a 401 here is just "no".
		const signedIn = await getCurrentUser().then(
			() => true,
			() => false
		);
		state = { kind: 'done', signedIn };
	}

	const categoryText = $derived(label ? `email "${label}"` : 'email kategori ini');
	const content = $derived.by(() => {
		if (state.kind === 'done') {
			return {
				tone: 'success' as const,
				title: 'Email dimatikan',
				description: `Sakala tidak lagi mengirim ${categoryText}; nyalakan lagi kapan saja di pengaturan notifikasi.`
			};
		}
		if (state.kind === 'failed') {
			const copy = unsubscribeOutcomeCopy(state.outcome);
			return { tone: 'error' as const, title: copy.title, description: copy.description };
		}
		return {
			tone: 'unknown' as const,
			title: 'Berhenti menerima email ini?',
			description: `Hanya ${categoryText} yang berhenti; lonceng Console dan kategori lain tetap jalan.`
		};
	});
	const canRetry = $derived(
		state.kind === 'failed' && unsubscribeOutcomeCopy(state.outcome).canRetry
	);
	const settingsHref = `${resolve('/settings')}?tab=notifications`;
</script>

<svelte:head>
	<title>{pageTitle('Berhenti menerima email')}</title>
</svelte:head>

<AuthStatusScreen {...content} focusHeading={state.kind === 'done' || state.kind === 'failed'}>
	{#if state.kind === 'confirm' || state.kind === 'pending'}
		<Button
			size="lg"
			class="w-full"
			onclick={confirm}
			disabled={state.kind === 'pending'}
			aria-busy={state.kind === 'pending'}
		>
			{state.kind === 'pending' ? 'Mematikan email...' : 'Ya, matikan email ini'}
		</Button>
	{:else if canRetry}
		<Button size="lg" class="w-full" onclick={confirm}>Coba lagi</Button>
	{/if}

	{#if state.kind === 'done' && state.signedIn}
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved, plus a query -->
		<Button href={settingsHref as '/settings'} variant="secondary" size="lg" class="w-full">
			Buka pengaturan notifikasi
		</Button>
	{:else if state.kind !== 'confirm' && state.kind !== 'pending'}
		<Button href={resolve('/login')} variant="secondary" size="lg" class="w-full">
			Masuk ke Sakala
		</Button>
	{/if}
</AuthStatusScreen>

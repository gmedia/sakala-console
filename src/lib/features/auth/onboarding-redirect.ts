/**
 * Where a signed-in user has to go before the page they asked for can show: onboarding until it is
 * finished, and away from it once it is. `null` means no redirect is due. The guard navigates on
 * this, and holds the app shell back while it says `/onboarding`, so `/projects` never flashes on
 * the way to onboarding right after login.
 */
export function getOnboardingRedirect(
	user: { onboarding_completed_at?: string | null },
	pathname: string
): '/onboarding' | '/projects' | null {
	const onOnboarding = pathname === '/onboarding';

	if (!user.onboarding_completed_at) return onOnboarding ? null : '/onboarding';
	return onOnboarding ? '/projects' : null;
}

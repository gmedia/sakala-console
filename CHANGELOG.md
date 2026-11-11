# Changelog

Semua perubahan penting pada project ini akan didokumentasikan di file ini mengikuti Keep a Changelog dan Semantic Versioning.

## [Unreleased]

## [0.5.0] - 2026-11-12

### Added

- Team workspaces (ADR-018). A switcher in the sidebar picks the personal workspace or a team, is remembered per user in the browser, filters the project list, and is the default for new projects; the personal workspace stays the default, so someone without a team sees no change beyond the switcher. Teams are created from the switcher, with the owned-team cap explained in the dialog, and managed at `/workspaces/{id}`: members with roles, invitations by email with a role, pending invitations with revoke, role changes, removal, leaving, rename, and delete once the team has no projects. The last owner cannot be demoted, removed, or leave, and the page says so before anyone tries; destructive actions confirm in a dialog that does not focus them first and sends once.
- Invitations are answered from the email link (`/workspace-invitations/{id}?token=`), from `/workspace-invitations`, and from the notifications page, with copy for expired, revoked or used, other-address, already-member, and unverified-email cases.
- The project wizard asks which workspace the project belongs to when there is a choice and shows that workspace's remaining quota. Project cards and the project header name the owning workspace once the user is in a team, and the workspace page shows its limits and limit profile.
- Viewers see team projects read-only: no redeploy, cancel, secret values, variable changes, settings form, or delete.
- Zod schemas for the workspace resources, checked against responses captured from sakala-api, and a stateful mocked workspace API for e2e tests built from the same captures.
- The image can be pointed at any installation when the container starts: `PUBLIC_API_URL`, `PUBLIC_APP_URL`, and `PUBLIC_REVERB_*` set on the container replace the values baked in at build. `docker/entrypoint.sh` validates them, renders a same-origin `/runtime-config.js` that the app reads before it starts, and rewrites the Content-Security-Policy to name the configured API and Reverb. A container that sets none of them serves exactly what was built, so existing deployments do not change.
- Admin area under `/admin` with its own navigation, reachable from the user menu by admins (#97, covering #12 and #15): Overview (pilot validation numbers, what needs attention, user growth, deployment outcomes, failure categories, and new-user sources for one WIB time range, refreshed every 5 minutes), Pengguna, Workspace, Profil batas, Proyek with stop, suspend, unsuspend, and reconcile, Analisis kegagalan with a deployment detail page, Runtime node with provisioning, token rotation, revocation, and command history, Masukan, and Audit. Lists are paged, searched, and filtered on the server, with every filter in the URL so a view can be shared. Every change asks for a reason in a dialog that names what it acts on and what happens; destructive actions are never focused first and send once, and project controls carry an `Idempotency-Key`. A node token is shown once and the dialog only closes after "Saya sudah menyimpan token ini". Anyone but an admin gets a 403 page at `/admin/*`; the API stays the authority.
- Zod schemas for every admin response, checked against responses captured from sakala-api, and a mocked admin API for e2e tests built from the same captures.
- The invitation link page reads the invitation through `GET app/workspace-invitations/{id}?token=` (sakala-api#133 contract), so a link sent to another address shows the workspace, role, inviter, and expiry, and says before anyone clicks when this account cannot accept it (owner invitation for another address, already a member, owned-team cap). Already accepted, declined, revoked, expired, wrong-token, and unverified-email links each get their own message.
- Workspace notifications open their invitation by `invitation_id`, or the team by `workspace_id`; older ones still open the invitation list.
- The workspace switcher and the team page show how many projects a workspace has, and the team page also shows deployments running there.
- The notification settings page has the `workspace` category (team invitations and membership changes).

### Fixed

- `Breadcrumb` type-checks again past 25 routes, where TypeScript stopped relating a union of paths to `resolve()`.

## [0.4.0] - 2026-11-11

### Added

- The project list follows deployments that are in progress over realtime, through each deployment's channel, and falls back to polling every 5 minutes, so a project's status changes without a reload.
- Toasts confirm copying, saving an environment variable, and queueing a redeploy.

### Fixed

- Skeleton loaders are visible again: 1.70:1 on white, and at least 1.42:1 through their pulse.
- The sidebar shows the released version: `package.json` now carries `0.3.0`, and the release workflow refuses a tag that does not match it.
- Deleting a project no longer reads the project and its deployments again after the `204`, which logged two `404` errors.
- Onboarding fills "Nama lengkap" with the name on the account, and keeps whatever the user types instead.

### Changed

- Dependencies updated through Dependabot: the npm minor and patch group (21 packages, including Svelte, Vite, bits-ui, TanStack Query, and Zod), vitest-browser-svelte 3, actions/checkout v7, actions/setup-node v7, and docker/setup-buildx-action v4.

## [0.3.0] - 2026-11-11

### Added

- Register asks for the required declaration and sends the versions it showed. Accounts that have not accepted the current terms, such as a first GitHub login, get a blocking screen, and `/settings` stays open so nobody has to agree in order to leave.
- Settings can delete the account, with a typed email, the password or a fresh provider login, and the real retention from the API, and can download a copy of the account's data.
- A suspended project shows `suspension.reason` from the API and `abuse@sakala.dev`, instead of reading the reason out of the owner's notification.
- Project cards show the public URL, the last commit, and its branch, from `public_url` and `latest_deployment` on the list. The list follows `notification.created` and polls within the request budget.
- `Content-Security-Policy` with `frame-ancestors 'none'`, `X-Content-Type-Options`, `X-Frame-Options`, and `Referrer-Policy` on the image. The policy is generated at build from the same env file as the bundle.
- Login, register, forgot-password, resend verification, and account settings follow `GET /api/v1/auth/options`: email-based options and unconfigured providers are not offered, with a plain explanation, and `EMAIL_DELIVERY_UNAVAILABLE` shows the API's message.
- Initial SvelteKit static SPA foundation.
- Sakala design tokens and sidebar-based application shell.
- Sanctum-aware API client, typed errors, and TanStack Query foundation.
- OpenAPI type generation, unit/component/E2E testing, CI, and contributor documentation.
- Accessibility floor spec (`tests/e2e/a11y-floor.spec.ts`) over every route at 320, 768, 1024, 1280, and 1366 px, and a colour token contrast spec (`src/lib/design-tokens.spec.ts`).
- Skip link, a focus-trapped mobile drawer, and a lint rule against hex colours in `.svelte` class strings.
- A notice on the login page when a session ends by itself, and a clear message for `GITHUB_RATE_LIMITED` with its wait time.

### Changed

- The deployment page has two columns from 1024 px: stages and facts in 260 px, and the terminal filling the rest down to the bottom of the viewport. On smaller screens the log comes first and the rest folds away.
- The terminal has columns for time and stream, labels and tints stderr, shows a cursor while the process runs, and carries its own follow and copy controls. "Lihat error di log" jumps to the first stderr line.
- The first deployment of a project to succeed says `<project> sudah live` with the address, open, and copy together. Later ones stay calm, and a deployment whose app keeps crashing no longer reads as a plain success.
- Stages show how long each one took, and the page shows the commit message and links the SHA to GitHub.
- Deployment history is one row per deployment, with the whole row as the link and two levels on phones. A project that never deployed no longer offers filters.
- The project header leads with the address as a link. Project settings are one column with the same fields as the wizard, and the delete dialog states the real retention.
- The wizard folds port, build, start, and root directory under "Pengaturan lanjutan", and opens it by itself on an error. Esc clears the draft in its env editor. On phones the stepper reads "Langkah 2 dari 3".
- Re-reading deployment events continues from the last page instead of walking all of them again.
- Colour tokens meet WCAG 2.2 AA: 4.5:1 for text and 3:1 for control edges and the focus ring. Figma's `#A2A2A2` secondary text became `#6B6B6B`.
- Project links use `public_url` from the API instead of building `https://` from the domain.
- Interface wording is consistent: `Proyek`, `Pengaturan`, and `kamu`. Unsubstantiated claims on the auth and onboarding screens were replaced with what the product does.
- Times use `08:41:02`, with the date when older than today, and durations read as `2 menit 5 detik`. A failed step shows when it failed.
- Fonts are self-hosted with `font-display: swap`; the Google Fonts import is gone. Sources and licences are in `static/fonts/README.md`.
- Inter is self-hosted for reading text, with Montserrat for headings and one JetBrains Mono file for code. Text uses one scale of 12, 14, 16, 20, 24, 32, and 48 px and three weights, and `design-tokens.spec.ts` rejects anything else.
- `Button` has fixed sizes and variants, every field shares `.control-input` and one focus style, and controls, cards, and overlays have one radius each. Only overlays have a shadow.
- The sidebar becomes a drawer up to 1024 px, with a small S mark in the mobile header. Notification rows put the time under the text on narrow screens.
- A running deployment is teal, and a queued one uses a new `#C2670E` token. Status names come from one dictionary.
- Login and register share one layout with the logo on mobile, and the hero shows a labelled sample flow without the glow. Tab titles follow `page · project · Sakala`, and every logo link stays in the Console.
- Onboarding asks for the profile first, the source question stays optional, and it ends on the new project page.
- Project cards are whole links without a thumbnail box, and the list shows filters only for more than six projects, defaulting to all time.
- Deleting a project confirms with a toast (`svelte-sonner`), and its dialog says the data goes after the retention period and the address is not reused.

### Removed

- `static/icons/load.svg`, whose origin is not recorded, the 1.26 MB `bg.png`, and unused logo files.
- Dead code: `ApiStatusCard`, `ConfirmDialog`, `Select`, the system status resource, and `api/envelope.ts`.

[Unreleased]: https://github.com/gmedia/sakala-console/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/gmedia/sakala-console/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/gmedia/sakala-console/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/gmedia/sakala-console/compare/v0.2.0...v0.3.0

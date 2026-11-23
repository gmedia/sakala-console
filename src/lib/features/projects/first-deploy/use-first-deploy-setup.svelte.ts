import { useQueryClient } from '@tanstack/svelte-query';
import type { PilotLimits } from '$lib/api/resources/pilot-limits';
import {
	createAttachDatabaseMutation,
	createCreateDatabaseMutation,
	createDetachDatabaseMutation
} from '$lib/features/databases/mutations';
import { databaseQuota, databasesUnavailable } from '$lib/features/databases/presentation';
import { createDatabasesQuery } from '$lib/features/databases/queries';
import { isLaravelStack } from '../build-help';
import type { EnvSaveFailure, WizardEnvVar } from '../create/createProjectState.svelte';
import { saveEnvVars, withoutAlreadySaved } from '../create/save-env-vars';
import {
	classifyEnvExample,
	hasStorableSuggestions,
	isStorable,
	SUGGESTION_GROUPS
} from '../env-suggestions/classify-env-example';
import {
	editDraft,
	emptyNeedsInputCount,
	onePerKey,
	suggestedEnvVars,
	syncSuggestionDraft,
	type DraftEntry,
	type SuggestionDraft
} from '../env-suggestions/suggestion-draft';
import { createAddEnvironmentVariableMutation, createUpdateProjectMutation } from '../mutations';
import { createEnvironmentVariablesQuery, projectKeys } from '../queries';
import { generateSecret } from '../secret-generation';
import type { Project } from '../type';
import {
	attachCandidates,
	createDatabaseBlockedReason,
	DATABASE_OPTIONS,
	defaultDatabaseOption,
	firstUsableCandidate,
	suggestedReleaseCommand,
	type DatabaseOption
} from './database-choice';
import { databaseEngineNote, databaseSignalsSentence } from './database-hint';
import { deployWhenReadyOf, deployWhenReadyView } from './deploy-when-ready';
import {
	firstDeployFailure,
	isAlreadyAttached,
	type FirstDeployFailure
} from './first-deploy-errors';
import {
	FIRST_DEPLOY_STEPS,
	NO_STEPS_DONE,
	runFirstDeploy,
	withStepDone,
	type FirstDeployDatabase,
	type FirstDeployEffects,
	type FirstDeployStep
} from './run-first-deploy';

/**
 * State and actions of the Persiapan phase of the wizard's last step: the database choice, the
 * variables from `.env.example`, and "Deploy sekarang". The rules live in the pure modules next to
 * this file; this only wires them to the queries and mutations.
 */

/** Whether the Persiapan phase has anything to ask, once the project's variables are known. */
export type SetupDecision = 'unknown' | 'needed' | 'not-needed';

/** What the step is doing after "Deploy sekarang", for the status line and the button. */
export type SetupPhase = 'prepare' | 'running' | 'variables-failed';

type Options = {
	projectId: () => string;
	project: () => Project | undefined;
	limits: () => PilotLimits | undefined;
	/** Starts the deployment the way the step always has, with its idempotency key. */
	deploy: () => Promise<{ id: string }>;
	onDeployed: (deploymentId: string) => void;
};

export function useFirstDeploySetup(options: Options) {
	const queryClient = useQueryClient();
	const createDatabaseMutation = createCreateDatabaseMutation();
	const attachDatabaseMutation = createAttachDatabaseMutation();
	const detachDatabaseMutation = createDetachDatabaseMutation();
	const updateProjectMutation = createUpdateProjectMutation();
	const addEnvMutation = createAddEnvironmentVariableMutation();

	const project = $derived(options.project());
	const inspected = $derived(project?.preview_status === 'succeeded');
	const workspaceId = $derived(project?.workspace?.id ?? null);
	const envExample = $derived(inspected ? (project?.inspection?.env_example ?? null) : null);
	const hint = $derived(inspected ? (project?.inspection?.database_hint ?? null) : null);
	const attached = $derived(project?.databases?.[0] ?? null);

	// The project's variables are read only when the file has entries to compare them with.
	const envQuery = createEnvironmentVariablesQuery(
		() => options.projectId(),
		() => ({ enabled: Boolean(envExample?.entries.length) })
	);
	// Unknown is treated as none: a key that turns out to exist is refused on save, and named.
	const liveExistingKeys = $derived(
		envQuery.data?.map((env) => env.key) ?? (envQuery.isError ? [] : null)
	);
	// Taken when "Deploy sekarang" starts. Each saved variable refreshes the list, and reading it
	// live would turn the rows being saved into "already set": the lead would count down
	// (11, 7, 1 variables) and the rows would leave the panel mid-save.
	let frozenExistingKeys = $state<readonly string[] | null>(null);
	const existingKeys = $derived(frozenExistingKeys ?? liveExistingKeys);

	const databasesQuery = createDatabasesQuery(
		() => workspaceId,
		() => ({ enabled: inspected && attached === null })
	);

	const limits = $derived(options.limits());
	const unavailable = $derived(databasesUnavailable(limits));
	const quota = $derived(databaseQuota(limits?.quotas));
	const createBlockedReason = $derived(
		createDatabaseBlockedReason({ unavailable, quotaBlockedReason: quota?.blockedReason ?? null })
	);
	const candidates = $derived(project ? attachCandidates(databasesQuery.data ?? [], project) : []);
	// Whether a Sakala database is within reach: one is attached, one can be made, or one of the
	// workspace's can be used. Notes about the app's own engine only recommend one when it is.
	const sakalaDatabase = $derived(
		attached !== null || createBlockedReason === null || firstUsableCandidate(candidates) !== null
	);

	let chosenOption = $state<DatabaseOption | null>(null);
	const option = $derived<DatabaseOption>(
		attached
			? DATABASE_OPTIONS.none
			: (chosenOption ??
					defaultDatabaseOption({
						likely: hint?.likely ?? false,
						createBlocked: createBlockedReason !== null
					}))
	);
	let chosenDatabaseId = $state<string | null>(null);
	const databaseId = $derived(chosenDatabaseId ?? firstUsableCandidate(candidates));

	const releaseSuggestion = $derived(
		suggestedReleaseCommand({
			option,
			current: project?.release_command,
			suggestion: hint?.suggested_release_command
		})
	);
	let editedReleaseCommand = $state<string | null>(null);
	const releaseCommand = $derived(editedReleaseCommand ?? releaseSuggestion ?? '');

	const databaseProvided = $derived(attached !== null || option !== DATABASE_OPTIONS.none);
	const suggestions = $derived(
		envExample && existingKeys
			? classifyEnvExample(envExample.entries, {
					publicUrl: project?.public_url ?? null,
					databaseProvided,
					existingKeys
				})
			: null
	);

	const generate = onePerKey(generateSecret);
	let storedDraft = $state<SuggestionDraft>({});
	const draft = $derived(
		suggestions ? syncSuggestionDraft(storedDraft, suggestions.rows, generate) : storedDraft
	);

	const freshDecision = $derived.by<SetupDecision>(() => {
		if (!inspected) return 'unknown';
		if (hint?.likely && attached === null) return 'needed';
		if (!envExample?.entries.length) return 'not-needed';
		if (!suggestions) return 'unknown';
		return hasStorableSuggestions(suggestions) ? 'needed' : 'not-needed';
	});
	// Once shown, the phase stays: saving its variables makes them "already set", which would
	// otherwise take the panel away in the middle of "Deploy sekarang".
	let latched = $state(false);
	$effect(() => {
		if (freshDecision === 'needed') latched = true;
	});
	const decision = $derived<SetupDecision>(latched ? 'needed' : freshDecision);

	const prepared = $derived(
		suggestions?.rows.filter((row) => row.group !== SUGGESTION_GROUPS.needsInput).length ?? 0
	);
	const needsYou = $derived(
		suggestions?.rows.filter((row) => row.group === SUGGESTION_GROUPS.needsInput).length ?? 0
	);

	let phase = $state<SetupPhase>('prepare');
	let activeStep = $state<FirstDeployStep | null>(null);
	let failure = $state<FirstDeployFailure | null>(null);
	let envFailures = $state<EnvSaveFailure[]>([]);
	let done: ReadonlySet<FirstDeployStep> = NO_STEPS_DONE;
	/** After refused variables, only those are tried again. */
	let retryEnvVars: WizardEnvVar[] | null = null;
	// `isPending` updates a tick after mutate(), which is too late for a double click.
	let running = false;

	const whenReady = $derived(deployWhenReadyView(deployWhenReadyOf(project)));

	function planDatabase(choice: DatabaseOption): FirstDeployDatabase {
		if (choice === DATABASE_OPTIONS.create) return { kind: DATABASE_OPTIONS.create };
		if (choice === DATABASE_OPTIONS.attach && databaseId) {
			return { kind: DATABASE_OPTIONS.attach, databaseId };
		}
		return { kind: DATABASE_OPTIONS.none };
	}

	function envVarsToSave(): WizardEnvVar[] {
		if (retryEnvVars) return retryEnvVars;
		if (!suggestions) return [];
		return suggestedEnvVars(suggestions.rows, draft).map((env, index) => ({
			id: index + 1,
			...env
		}));
	}

	function track<Args extends unknown[], Result>(
		step: FirstDeployStep,
		run: (...args: Args) => Promise<Result>
	) {
		return (...args: Args) => {
			activeStep = step;
			return run(...args);
		};
	}

	const effects: FirstDeployEffects = {
		saveReleaseCommand: track(FIRST_DEPLOY_STEPS.releaseCommand, (command: string) =>
			updateProjectMutation.mutateAsync({
				id: options.projectId(),
				data: { release_command: command }
			})
		),
		saveVariables: track(FIRST_DEPLOY_STEPS.variables, (envVars: readonly WizardEnvVar[]) =>
			saveEnvVars(envVars, {
				save: (env) =>
					addEnvMutation.mutateAsync({
						projectId: options.projectId(),
						data: { key: env.key, value: env.value, is_secret: env.isSecret }
					})
			})
		),
		createDatabase: track(FIRST_DEPLOY_STEPS.database, () =>
			createDatabaseMutation.mutateAsync({
				workspaceId: workspaceId ?? '',
				payload: { project_id: options.projectId(), deploy_when_ready: true }
			})
		),
		attachDatabase: track(FIRST_DEPLOY_STEPS.database, (id: string) =>
			attachDatabaseMutation.mutateAsync({
				workspaceId: workspaceId ?? '',
				databaseId: id,
				projectId: options.projectId()
			})
		),
		deploy: track(FIRST_DEPLOY_STEPS.deploy, () => options.deploy())
	};

	function refreshProject() {
		void queryClient.invalidateQueries({
			queryKey: projectKeys.detail(options.projectId()),
			exact: true
		});
	}

	async function run(choice: DatabaseOption = option) {
		if (running) return;
		running = true;
		phase = 'running';
		failure = null;
		frozenExistingKeys ??= liveExistingKeys;
		const database = planDatabase(choice);
		const command = releaseSuggestion !== null ? releaseCommand.trim() : '';

		try {
			const result = await runFirstDeploy(
				{ releaseCommand: command || null, envVars: envVarsToSave(), database },
				done,
				effects
			);
			done = result.done;
			const { outcome } = result;
			switch (outcome.kind) {
				case 'deployed':
					options.onDeployed(outcome.deploymentId);
					return;
				case 'waiting-for-database':
					// The project now names its database and the request; the step reads it from there.
					refreshProject();
					phase = 'prepare';
					return;
				case 'variables-failed':
					envFailures = outcome.failures;
					phase = 'variables-failed';
					return;
				case 'failed':
					failure = firstDeployFailure(outcome.step, outcome.error, database);
					if (isAlreadyAttached(outcome.error)) refreshProject();
					phase = 'prepare';
					return;
			}
		} finally {
			running = false;
			activeStep = null;
		}
	}

	async function retryVariables() {
		const pending = envFailures.map((item) => item.env);
		// A lost response can hide a variable that was stored; asking again would answer 422.
		const existing = (await envQuery.refetch()).data ?? [];
		const remaining = withoutAlreadySaved(
			envFailures,
			existing.map((env) => env.key)
		).map((item) => item.env);
		retryEnvVars = remaining.length > 0 ? remaining : null;
		if (remaining.length === 0 && pending.length > 0)
			done = withStepDone(done, FIRST_DEPLOY_STEPS.variables);
		envFailures = [];
		await run();
	}

	async function continueWithoutFailedVariables() {
		done = withStepDone(done, FIRST_DEPLOY_STEPS.variables);
		retryEnvVars = null;
		envFailures = [];
		await run();
	}

	async function deployWithoutDatabase() {
		chosenOption = DATABASE_OPTIONS.none;
		await run(DATABASE_OPTIONS.none);
	}

	/**
	 * After the API skipped the deploy it was asked for. A database that failed to be made still
	 * blocks deployments, so "Deploy tanpa database" detaches it first; the data was never there.
	 */
	async function deployAfterSkip({ detachFirst }: { detachFirst: boolean }) {
		if (running) return;
		running = true;
		phase = 'running';
		failure = null;
		try {
			activeStep = FIRST_DEPLOY_STEPS.deploy;
			if (detachFirst && attached && workspaceId) {
				await detachDatabaseMutation.mutateAsync({
					workspaceId,
					databaseId: attached.id,
					projectId: options.projectId()
				});
			}
			const deployment = await options.deploy();
			options.onDeployed(deployment.id);
		} catch (error) {
			failure = firstDeployFailure(FIRST_DEPLOY_STEPS.deploy, error, {
				kind: DATABASE_OPTIONS.none
			});
			phase = 'prepare';
		} finally {
			running = false;
			activeStep = null;
		}
	}

	return {
		get decision() {
			return decision;
		},
		get phase() {
			return phase;
		},
		get activeStep() {
			return activeStep;
		},
		get failure() {
			return failure;
		},
		get envFailures() {
			return envFailures;
		},
		get whenReady() {
			return whenReady;
		},
		get attached() {
			return attached;
		},

		get hint() {
			return hint;
		},
		get signalsSentence() {
			return hint ? databaseSignalsSentence(hint.signals) : null;
		},
		get engineNote() {
			return hint
				? databaseEngineNote(hint.engine, {
						laravel: isLaravelStack(project?.stack),
						sakalaDatabase
					})
				: null;
		},
		get createBlockedReason() {
			return createBlockedReason;
		},
		get candidates() {
			return candidates;
		},
		get candidatesLoading() {
			return databasesQuery.isPending && attached === null;
		},
		get candidatesFailed() {
			return databasesQuery.isError;
		},
		get option() {
			return option;
		},
		set option(value: DatabaseOption) {
			chosenOption = value;
			failure = null;
		},
		get databaseId() {
			return databaseId;
		},
		set databaseId(value: string | null) {
			chosenDatabaseId = value;
		},
		get showReleaseCommand() {
			return releaseSuggestion !== null;
		},
		get currentReleaseCommand() {
			return project?.release_command?.trim() || null;
		},
		get releaseCommand() {
			return releaseCommand;
		},
		set releaseCommand(value: string) {
			editedReleaseCommand = value;
		},

		get suggestions() {
			return suggestions;
		},
		get truncated() {
			return envExample?.truncated ?? false;
		},
		get draft() {
			return draft;
		},
		editRow(key: string, change: Partial<Pick<DraftEntry, 'included' | 'value'>>) {
			storedDraft = editDraft(draft, key, change);
		},
		get prepared() {
			return prepared;
		},
		get needsYou() {
			return needsYou;
		},
		get emptyNeedsInput() {
			return suggestions ? emptyNeedsInputCount(suggestions.rows, draft) : 0;
		},
		get storableCount() {
			return suggestions?.rows.filter(isStorable).length ?? 0;
		},

		run,
		retryVariables,
		continueWithoutFailedVariables,
		deployWithoutDatabase,
		deployAfterSkip
	};
}

export type FirstDeploySetup = ReturnType<typeof useFirstDeploySetup>;

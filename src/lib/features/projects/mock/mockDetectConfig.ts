import type { Repository } from '../type';

export type DetectConfigResult = {
	hasDockerfile: boolean;
	detectedPort: string | null;
	detectedBranch: string | null;
};

type DetectScenario = 'dockerfile' | 'no-dockerfile' | 'failed';

export async function detectProjectConfig(
	repository: Repository | null,
	branch: string,
	currentPort: string,
	scenario?: DetectScenario,
	attempt: number = 1
): Promise<DetectConfigResult> {
	const delay = 3000 + Math.random() * 1000;
	await new Promise((resolve) => setTimeout(resolve, delay));

	const resolvedScenario = scenario ?? pickRandomScenario(attempt);

	if (resolvedScenario === 'failed') {
		throw new Error(
			`Gagal menganalisis repository ${repository?.full_name ?? 'tidak diketahui'}. Coba scan ulang.`
		);
	}

	if (resolvedScenario === 'no-dockerfile') {
		return {
			hasDockerfile: false,
			detectedPort: currentPort || '3000',
			detectedBranch: branch
		};
	}

	return {
		hasDockerfile: true,
		detectedPort: '3000',
		detectedBranch: branch
	};
}

export function pickRandomScenario(attempt: number): DetectScenario {
	const failChance = attempt <= 1 ? 0.4 : 0.1;
	const noDockerfileChance = 0.15;

	const roll = Math.random();
	if (roll < failChance) return 'failed';
	if (roll < failChance + noDockerfileChance) return 'no-dockerfile';
	return 'dockerfile';
}

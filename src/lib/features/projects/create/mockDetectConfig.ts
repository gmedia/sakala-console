export type DetectConfigResult = {
	hasDockerfile: boolean;
	detectedPort: string | null;
	detectedBranch: string | null;
};

type DetectScenario = 'dockerfile' | 'no-dockerfile' | 'failed';

export async function detectProjectConfig(
	repository: { full_name: string } | null,
	branch: string,
	scenario?: DetectScenario
): Promise<DetectConfigResult> {
	const delay = 3000 + Math.random() * 1000;
	await new Promise((resolve) => setTimeout(resolve, delay));

	if (scenario === 'failed') {
		throw new Error('Gagal menganalisis repository. Coba scan ulang.');
	}

	if (scenario === 'no-dockerfile') {
		return {
			hasDockerfile: false,
			detectedPort: '3000',
			detectedBranch: branch
		};
	}

	return {
		hasDockerfile: true,
		detectedPort: '3000',
		detectedBranch: branch
	};
}

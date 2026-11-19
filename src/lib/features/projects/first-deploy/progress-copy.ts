import { DATABASE_OPTIONS, type DatabaseOption } from './database-choice';
import { FIRST_DEPLOY_STEPS, type FirstDeployStep } from './run-first-deploy';

/** What the button and the status line say while one step of "Deploy sekarang" runs. */
export function firstDeployProgressText(step: FirstDeployStep, option: DatabaseOption): string {
	switch (step) {
		case FIRST_DEPLOY_STEPS.releaseCommand:
			return 'Menyimpan release command...';
		case FIRST_DEPLOY_STEPS.variables:
			return 'Menyimpan environment variable...';
		case FIRST_DEPLOY_STEPS.database:
			return option === DATABASE_OPTIONS.attach ? 'Memasang database...' : 'Membuat database...';
		case FIRST_DEPLOY_STEPS.deploy:
			return 'Memulai deploy...';
	}
}

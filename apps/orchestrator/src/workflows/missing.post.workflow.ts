import { proxyActivities, sleep } from '@social/nestjs-libraries/temporal/workflow';
import { PostActivity } from '@social/orchestrator/activities/post.activity';

const { searchForMissingThreeHoursPosts } = proxyActivities<PostActivity>({
  startToCloseTimeout: '10 minute',
  retry: {
    maximumAttempts: 3,
    backoffCoefficient: 1,
    initialInterval: '2 minutes',
  },
});

export async function missingPostWorkflow() {
  await searchForMissingThreeHoursPosts();
  while (true) {
    await sleep('1 hour');
    await searchForMissingThreeHoursPosts();
  }
}

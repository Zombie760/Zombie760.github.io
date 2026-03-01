import { auth } from 'thepopebot/auth';
import { redirect } from 'next/navigation';
import { CodePage } from 'thepopebot/code';
import { getFeatureFlags } from 'thepopebot/chat/actions';

export default async function CodeRoute({ params }) {
  const session = await auth();
  const { claudeWorkspace } = await getFeatureFlags();
  if (!claudeWorkspace) redirect('/');
  const { claudeWorkspaceId } = await params;
  return <CodePage session={session} claudeWorkspaceId={claudeWorkspaceId} />;
}

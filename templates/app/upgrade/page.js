import { auth } from 'thepopebot/auth';
import { UpgradePage } from 'thepopebot/chat';

export default async function UpgradeRoute() {
  const session = await auth();
  return <UpgradePage session={session} />;
}

import { auth } from 'thepopebot/auth';
import { CronsPage } from 'thepopebot/chat';

export default async function CronsRoute() {
  const session = await auth();
  return <CronsPage session={session} />;
}

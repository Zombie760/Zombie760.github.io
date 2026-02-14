import { getPageAuthState } from 'thepopebot/auth';
import { AsciiLogo } from '../components/ascii-logo';
import { SetupForm } from '../components/setup-form';
import { LoginForm } from '../components/login-form';
import { NotificationsPage } from 'thepopebot/chat';

export default async function NotificationsRoute() {
  const { session, needsSetup } = await getPageAuthState();

  if (needsSetup) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-8">
        <AsciiLogo />
        <SetupForm />
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-8">
        <AsciiLogo />
        <LoginForm />
      </main>
    );
  }

  return <NotificationsPage session={session} />;
}

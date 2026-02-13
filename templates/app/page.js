import { getPageAuthState } from 'thepopebot/auth';
import { AsciiLogo } from './components/ascii-logo';
import { SetupForm } from './components/setup-form';
import { LoginForm } from './components/login-form';
import { Dashboard } from './components/dashboard';

export default async function Home() {
  const { session, needsSetup } = await getPageAuthState();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <AsciiLogo />
      {needsSetup ? (
        <SetupForm />
      ) : !session ? (
        <LoginForm />
      ) : (
        <Dashboard user={session.user} />
      )}
    </main>
  );
}

'use client';

import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';

const CodePage = dynamic(() => import('thepopebot/code').then(m => m.CodePage), { ssr: false });

export default function CodeRoute() {
  const { claudeWorkspaceId } = useParams();
  return <CodePage claudeWorkspaceId={claudeWorkspaceId} />;
}

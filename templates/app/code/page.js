'use client';

import dynamic from 'next/dynamic';

const CodePage = dynamic(() => import('thepopebot/code').then(m => m.CodePage), { ssr: false });

export default function CodeRoute() {
  return <CodePage />;
}

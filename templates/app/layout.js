export const metadata = {
  title: 'thepopebot',
  description: 'AI Agent',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, overflow: 'hidden' }}>{children}</body>
    </html>
  );
}

import type { Metadata } from 'next';
import '../styles/globals.css';
import { FullScreenSync } from '../components/FullScreenSync';

export const metadata: Metadata = {
  title: 'RevOps Agent — Beacon Plumbing',
  description: 'An agent-first RevOps harness over a mock CRM.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Serif:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </head>
      <body>
        <FullScreenSync />
        {children}
      </body>
    </html>
  );
}

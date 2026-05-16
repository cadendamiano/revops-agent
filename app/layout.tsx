import type { Metadata } from 'next';
import '../styles/globals.css';
import { FullScreenSync } from '../components/FullScreenSync';

export const metadata: Metadata = {
  title: 'Salesforce Coworker',
  description: 'An AI prototype harness.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap"
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

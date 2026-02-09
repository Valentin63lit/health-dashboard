import type { Metadata, Viewport } from 'next';
import './globals.css';
import { NavBar } from '@/components/NavBar';

export const metadata: Metadata = {
  title: 'Health Dashboard — Cold Labs',
  description: 'Personal health tracking: Oura Ring + MacroFactor + AI insights',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#061A19',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-brand-darkest text-brand-text">
        <NavBar />
        <main className="px-4 pb-24 pt-4 max-w-lg mx-auto">
          {children}
        </main>
      </body>
    </html>
  );
}

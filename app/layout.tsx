import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { ToastProvider } from '@/components/toast/ToastProvider';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'GravyFlow',
  description: 'Infrastructure canvas for modern deployments',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}

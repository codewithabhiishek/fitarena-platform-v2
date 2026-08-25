import "./globals.css";
import { Barlow } from "next/font/google";
import PostHogProvider from "../components/PostHogProvider";
import { ClerkProvider } from '@clerk/nextjs';
import { Analytics } from '@vercel/analytics/react';

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
  variable: "--font-barlow",
});

export const metadata = {
  title: "FitArena — Elite Gym Challenges",
  description: "Compete, earn badges, climb leaderboards at your gym.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

import { dark } from '@clerk/themes';

export default function RootLayout({ children }) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: '#39FF14',
          colorBackground: '#121212',
          colorInputBackground: '#1e1e1e',
          colorInputText: '#ffffff',
          colorText: '#ffffff',
          colorTextOnPrimaryBackground: '#000000',
          colorTextSecondary: '#a1a1aa',
        },
        elements: {
          card: 'bg-[#121212] border border-zinc-800 shadow-2xl',
          headerTitle: 'text-[#39FF14]',
          headerSubtitle: 'text-zinc-400',
          socialButtonsBlockButton: 'bg-[#1e1e1e] border border-zinc-800 hover:bg-zinc-800 transition-colors text-white',
          socialButtonsBlockButtonText: 'text-white font-semibold',
          formFieldLabel: 'text-zinc-300 font-medium',
          formFieldInput: 'bg-[#1e1e1e] border border-zinc-700 text-white focus:border-[#39FF14] focus:ring-[#39FF14]/20',
          formButtonPrimary: 'bg-[#39FF14] text-black font-bold tracking-wide uppercase hover:bg-[#32e011]',
          footerActionLink: 'text-[#39FF14] hover:text-[#32e011]',
          dividerLine: 'bg-zinc-800',
          dividerText: 'text-zinc-500',
        }
      }}
    >
      <html lang="en">
        <body className={barlow.variable}>
          <PostHogProvider>{children}</PostHogProvider>
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  );
}


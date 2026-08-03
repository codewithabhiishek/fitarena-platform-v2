import "./globals.css";
import { Barlow } from "next/font/google";
import PostHogProvider from "../components/PostHogProvider";
import { ClerkProvider } from '@clerk/nextjs';

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
          colorBackground: '#0a0a0a',
          colorInputBackground: '#1a1a1a',
          colorText: '#ffffff',
          colorTextOnPrimaryBackground: '#000000',
        },
        elements: {
          card: 'bg-black border border-[#39FF14]/20 shadow-[0_0_15px_rgba(57,255,20,0.1)]',
          headerTitle: 'text-[#39FF14]',
          headerSubtitle: 'text-zinc-400',
          socialButtonsBlockButton: 'border-[#39FF14]/20 hover:bg-[#39FF14]/10 hover:border-[#39FF14]',
          socialButtonsBlockButtonText: 'font-semibold',
          formButtonPrimary: 'font-bold tracking-wide uppercase',
          footerActionLink: 'text-[#39FF14] hover:text-[#39FF14]/80',
        }
      }}
    >
      <html lang="en">
        <body className={barlow.variable}>
          <PostHogProvider>{children}</PostHogProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}

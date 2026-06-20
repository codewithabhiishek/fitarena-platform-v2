import "./globals.css";
import { Barlow } from "next/font/google";
import PostHogProvider from "../components/PostHogProvider";

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
  variable: "--font-barlow",
});

export const metadata = {
  title: "FitArena — Elite Gym Challenges",
  description: "Compete, earn badges, climb leaderboards at your gym.",
  icons: {
    icon: '/favicon.ico',
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={barlow.variable}>
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}

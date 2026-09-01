import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RailBD — Bangladesh Train Tracker",
  description: "Bangladesh railway schedules, train routes and live-tracking ready infrastructure.",
};

export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body>{children}</body></html>;
}


import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "@mantine/core/styles.css";
import { theme } from "../theme.ts";
import { ColorSchemeScript, mantineHtmlProps } from '@mantine/core';
import SidebarNav from '@/components/SidebarNav';
import { MantineProvider } from "@mantine/core";
import { ModalsProvider } from '@mantine/modals';


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gallery AI",
  description: "AI-powered image gallery",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <MantineProvider theme={theme} defaultColorScheme="dark">
        <ModalsProvider>
            <div style={{ display: 'flex', flexDirection: 'row', minHeight: '100vh', background: '#0d0d0d' }}>
              <SidebarNav />
              <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                {children}
              </div>
            </div>
          </ModalsProvider>
        </MantineProvider>
      </body>
    </html>
  );
}

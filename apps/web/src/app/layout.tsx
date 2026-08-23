import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "../index.css";
import Header from "@/components/header";
import Providers from "@/components/providers";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "HateWatch — preserve the context behind online hate",
	description:
		"Turn scattered evidence of online anti-Muslim hate into a structured, human-reviewed incident record.",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body
				className={`${geistSans.variable} ${geistMono.variable} antialiased`}
			>
				<Providers>
					{/* Blueprint paper: fixed behind everything, never scrolls. */}
					<div className="hw-grid pointer-events-none fixed inset-0 -z-10" />
					<div className="grid min-h-svh grid-rows-[auto_1fr_auto]">
						<Header />
						<main>{children}</main>
						<footer className="border-rule border-t px-4 py-3">
							<p className="hw-label leading-relaxed">
								AI suggests · humans verify · exports are built from verified
								fields only
							</p>
						</footer>
					</div>
				</Providers>
			</body>
		</html>
	);
}

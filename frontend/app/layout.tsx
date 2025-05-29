import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
	title: "Experiment Hub - ML Experiment Management",
	description:
		"A platform for managing machine learning experiments and hyperparameter tuning",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" className="mdl-js">
			<body className={inter.className}>
				{children}
				<Toaster />
			</body>
		</html>
	);
}

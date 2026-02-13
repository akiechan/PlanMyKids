import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { Providers } from "@/components/Providers";
import CompareBar from "@/components/CompareBar";
import UserMenu from "@/components/UserMenu";
import MobileNav from "@/components/MobileNav";
import RegionSwitcher from "@/components/RegionSwitcher";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PlanMyKids - Organize Your Kids' Schedule",
  description: "Discover extracurricular enrichment programs in San Francisco - swimming, art, chess, soccer, music, and more!",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16">
                <div className="flex items-center gap-1">
                  <Link href="/" className="flex items-center space-x-2">
                    <span className="text-xl font-bold text-primary-600">
                      PlanMyKids
                    </span>
                  </Link>
                </div>
                <div className="flex items-center space-x-4 sm:space-x-6">
                  <nav className="hidden md:flex items-center space-x-4 lg:space-x-6">
                    <Link
                      href="/programs"
                      className="text-sm lg:text-base text-gray-700 hover:text-primary-600 transition-colors"
                    >
                      Programs
                    </Link>
                    <Link
                      href="/camps"
                      className="text-sm lg:text-base text-gray-700 hover:text-primary-600 transition-colors"
                    >
                      Camps
                    </Link>
                    <Link
                      href="/birthday-venues"
                      className="text-sm lg:text-base text-gray-700 hover:text-primary-600 transition-colors"
                    >
                      Birthday Venues
                    </Link>
                    <Link
                      href="/leagues"
                      className="text-sm lg:text-base text-gray-700 hover:text-primary-600 transition-colors"
                    >
                      Leagues
                    </Link>
                    <Link
                      href="/familyplanning/dashboard"
                      className="text-sm lg:text-base text-gray-700 hover:text-primary-600 transition-colors"
                    >
                      Family Planner
                    </Link>
                  </nav>
                  <RegionSwitcher />
                  <UserMenu />
                </div>
              </div>
            </div>
          </nav>
          <main className="min-h-screen">{children}</main>
          <footer className="bg-gray-50 border-t border-gray-200 mt-20 pb-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <p className="text-center text-gray-600">
                © 2024 PlanMyKids. Helping SF families find amazing programs for their kids.
              </p>
            </div>
          </footer>
          <MobileNav />
          <CompareBar />
        </Providers>
      </body>
    </html>
  );
}

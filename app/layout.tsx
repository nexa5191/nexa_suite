import type { Metadata } from "next";
import {
  Inter,
  Manrope,
  Plus_Jakarta_Sans,
  Outfit,
  Space_Grotesk,
  Source_Serif_4,
  Lora,
  IBM_Plex_Mono,
  JetBrains_Mono,
  DM_Sans,
  Poppins,
  Sora,
  Work_Sans,
  Figtree,
  Merriweather,
  Fira_Code,
} from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { PrefsProvider } from "@/components/prefs/prefs-provider";
import { AppShell } from "@/components/shell/app-shell";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", display: "swap" });
const space = Space_Grotesk({ subsets: ["latin"], variable: "--font-space", display: "swap" });
const sourceserif = Source_Serif_4({ subsets: ["latin"], variable: "--font-sourceserif", display: "swap" });
const lora = Lora({ subsets: ["latin"], variable: "--font-lora", display: "swap" });
const ibmplex = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-ibmplex", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });
const dmsans = DM_Sans({ subsets: ["latin"], variable: "--font-dmsans", display: "swap" });
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-poppins", display: "swap" });
const sora = Sora({ subsets: ["latin"], variable: "--font-sora", display: "swap" });
const worksans = Work_Sans({ subsets: ["latin"], variable: "--font-worksans", display: "swap" });
const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree", display: "swap" });
const merriweather = Merriweather({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-merriweather", display: "swap" });
const firacode = Fira_Code({ subsets: ["latin"], variable: "--font-firacode", display: "swap" });

const fontVars = [
  inter, manrope, jakarta, outfit, space, sourceserif, lora, ibmplex, jetbrains,
  dmsans, poppins, sora, worksans, figtree, merriweather, firacode,
]
  .map((f) => f.variable)
  .join(" ");

export const metadata: Metadata = {
  title: "NEXA — Accounting",
  description: "Multi-entity, multi-currency accounting platform with cash & accrual basis.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className={`${fontVars} font-sans antialiased`}>
        <ThemeProvider>
          <PrefsProvider>
            <AppShell>{children}</AppShell>
          </PrefsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

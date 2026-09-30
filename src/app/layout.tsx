import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Inter: a neutral grotesque close to the Instrument Sans in the design,
// with Cyrillic support for Russian channel and campaign names.
const instrument = Inter({
  variable: "--font-instrument",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Sanalytics",
  description: "All your store analytics in one report",
  icons: {
    icon: [
      { url: "/favicon-light.svg", media: "(prefers-color-scheme: light)" },
      { url: "/favicon-dark.svg", media: "(prefers-color-scheme: dark)" },
    ],
  },
};

// Sets the theme before first paint (localStorage -> prefers-color-scheme).
const themeInit = `(function(){try{var t=localStorage.getItem('theme');if(!t){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${instrument.variable} ${jetbrains.variable}`}>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        {children}
      </body>
    </html>
  );
}

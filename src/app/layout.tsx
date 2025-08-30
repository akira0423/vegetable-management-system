import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PWARegister } from "@/components/pwa-register";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#059669',
  colorScheme: 'light dark',
}

export const metadata: Metadata = {
  title: {
    default: "AgriFinance Pro - プロフェッショナル農業経営管理システム",
    template: "%s | AgriFinance Pro"
  },
  description: "JA出荷対応、農薬管理、気象連携を備えたプロフェッショナル農業経営管理システム。作業記録、収支分析、コンプライアンス管理を一元化。",
  keywords: ["農業", "経営管理", "作業記録", "農薬管理", "JA出荷", "気象", "収支分析", "コンプライアンス"],
  authors: [{ name: "AgriFinance Pro Team" }],
  creator: "AgriFinance Pro",
  publisher: "AgriFinance Pro",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  
  // PWA関連メタデータ
  applicationName: "AgriFinance Pro",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AgriFinance Pro",
  },
  
  // マニフェスト
  manifest: "/manifest.json",
  
  // アイコン
  icons: {
    icon: [
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icon-152x152.png", sizes: "152x152", type: "image/png" },
    ],
    other: [
      { rel: "apple-touch-icon-precomposed", url: "/icon-152x152.png" },
    ],
  },
  
  // Social Media
  openGraph: {
    type: "website",
    siteName: "AgriFinance Pro",
    title: "AgriFinance Pro - プロフェッショナル農業経営管理システム",
    description: "JA出荷対応、農薬管理、気象連携を備えたプロフェッショナル農業経営管理システム",
    locale: "ja_JP",
  },
  
  twitter: {
    card: "summary_large_image",
    title: "AgriFinance Pro - プロフェッショナル農業経営管理システム", 
    description: "JA出荷対応、農薬管理、気象連携を備えたプロフェッショナル農業経営管理システム",
  },
  
  // 検索エンジン
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        {/* PWA Meta Tags */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="AgriFinance Pro" />
        <meta name="msapplication-TileColor" content="#059669" />
        <meta name="msapplication-tap-highlight" content="no" />
        
        {/* iOS Safari */}
        <meta name="apple-touch-fullscreen" content="yes" />
        
        {/* Prevent zoom on input focus (mobile) */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        
        {/* Preconnect for performance */}
        <link rel="preconnect" href="https://www.jma.go.jp" />
        <link rel="dns-prefetch" href="https://www.jma.go.jp" />
        
        {/* Apple Splash Screens */}
        <link rel="apple-touch-startup-image" href="/splash-640x1136.png" media="(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)" />
        <link rel="apple-touch-startup-image" href="/splash-750x1334.png" media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)" />
        <link rel="apple-touch-startup-image" href="/splash-828x1792.png" media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <PWARegister />
      </body>
    </html>
  );
}

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // セキュリティ強化設定
  poweredByHeader: false, // X-Powered-By ヘッダーを削除

  // 本番環境でのセキュリティヘッダー
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ];
  },
  
  // 環境変数の安全性チェック
  env: {
    NODE_ENV: process.env.NODE_ENV,
  },
};

export default nextConfig;

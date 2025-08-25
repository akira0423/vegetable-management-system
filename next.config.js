/** @type {import('next').NextConfig} */
const nextConfig = {
  // 本番デプロイ用設定
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Jest workerエラーを回避するための設定
  experimental: {
    // workerThreads: false,
    // esmExternals: false
  },
  // 開発時のワーカープロセス設定
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      // 開発時のJestワーカーを無効化
      config.optimization = {
        ...config.optimization,
        minimize: false,
      }
    }
    
    // Supabase警告を抑制
    config.module.rules.push({
      test: /\.js$/,
      include: /node_modules\/@supabase/,
      use: {
        loader: 'babel-loader',
        options: {
          presets: ['@babel/preset-env'],
          plugins: []
        }
      }
    })
    
    // WebSocket警告を抑制
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    }
    
    return config
  },
  // 画像最適化設定
  images: {
    domains: [
      ...(process.env.NEXT_PUBLIC_SUPABASE_URL 
        ? [new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname] 
        : []
      ),
      'images.unsplash.com',
      'via.placeholder.com'
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
}

module.exports = nextConfig
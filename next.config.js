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
  // Webpack設定：地図ライブラリの最適化問題を解決
  webpack: (config, { isServer }) => {
    // WebSocket警告を抑制
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    }

    // 地図ライブラリの最適化を無効化（ReferenceErrorを防ぐ）
    if (!isServer) {
      config.externals = config.externals || []
      
      // MapLibre GLとMapbox GL Drawを外部依存として扱う
      config.externals.push({
        'maplibre-gl': 'maplibregl',
        '@mapbox/mapbox-gl-draw': 'MapboxDraw'
      })
      
      // 最適化設定を調整
      config.optimization = config.optimization || {}
      config.optimization.splitChunks = config.optimization.splitChunks || {}
      config.optimization.splitChunks.cacheGroups = {
        ...config.optimization.splitChunks.cacheGroups,
        maplibre: {
          name: 'maplibre',
          test: /[\\/]node_modules[\\/](maplibre-gl|@mapbox\/mapbox-gl-draw)[\\/]/,
          priority: 10,
          chunks: 'all',
          enforce: true
        }
      }
    }
    
    return config
  },
  // 画像最適化設定
  images: {
    domains: [
      // Supabaseドメインを動的に追加（有効なURLの場合のみ）
      ...(process.env.NEXT_PUBLIC_SUPABASE_URL && 
          process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('https://') 
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
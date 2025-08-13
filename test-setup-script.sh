#!/bin/bash

# Test Setup and Execution Script
# 野菜管理システム用テストスクリプト

set -e

echo "🌱 野菜管理システム テストセットアップ開始..."

# 依存関係のインストール
echo "📦 依存関係をインストール中..."
npm install

# TypeScript型チェック
echo "🔍 TypeScript型チェック実行中..."
npx tsc --noEmit

# ESLint実行
echo "📝 コード品質チェック実行中..."
npm run lint

# テスト実行
echo "🧪 テストスイート実行中..."

# ユニットテスト
echo "  → ユニットテスト実行..."
npm test -- --testPathPattern="/(components|lib)/" --verbose

# APIテスト  
echo "  → APIテスト実行..."
npm test -- --testPathPattern="/api/" --verbose

# 統合テスト
echo "  → 統合テスト実行..."
npm test -- --testPathPattern="/integration/" --verbose

# カバレッジレポート生成
echo "📊 カバレッジレポート生成中..."
npm run test:coverage

echo "✅ すべてのテストが正常に完了しました！"
echo ""
echo "📊 カバレッジレポート: coverage/index.html"
echo "📋 テスト結果の詳細を確認してください。"
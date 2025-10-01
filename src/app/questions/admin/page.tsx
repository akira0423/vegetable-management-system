'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/utils/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DollarSign, Users, CreditCard, TrendingUp, AlertCircle, Clock } from 'lucide-react';

interface DashboardStats {
  totalRevenue: number;
  totalQuestions: number;
  totalAnswers: number;
  totalUsers: number;
  pendingPayouts: number;
  ppvPools: {
    totalHeldForBest: number;
    totalOthersPool: number;
    questionsWithPools: number;
  };
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  user_id: string;
  created_at: string;
  metadata?: any;
}

interface PPVPool {
  id: string;
  question_id: string;
  held_for_best: number;
  total_amount: number;
  updated_at: string;
  question?: {
    title: string;
    status: string;
  };
}

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [ppvPools, setPpvPools] = useState<PPVPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const supabase = createBrowserSupabaseClient();

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      router.push('/qa');
      return;
    }

    // 管理者確認（実際はメタデータやロールで判定）
    const isAdminUser = user.email?.includes('admin') || 
                       user.user_metadata?.role === 'admin';
    
    if (!isAdminUser) {
      router.push('/qa');
      return;
    }

    setIsAdmin(true);
    loadDashboardData();
  };

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // 統計データ取得
      const [statsRes, transactionsRes, poolsRes] = await Promise.all([
        fetchStats(),
        fetchRecentTransactions(),
        fetchPPVPools(),
      ]);

      setStats(statsRes);
      setTransactions(transactionsRes);
      setPpvPools(poolsRes);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async (): Promise<DashboardStats> => {
    // 収益合計
    const { data: revenueData } = await supabase
      .from('qa_transactions')
      .select('amount, platform_fee')
      .eq('status', 'COMPLETED');

    const totalRevenue = revenueData?.reduce((sum, tx) => sum + (tx.platform_fee || 0), 0) || 0;

    // 質問・回答数
    const { count: questionsCount } = await supabase
      .from('qa_questions')
      .select('*', { count: 'exact', head: true });

    const { count: answersCount } = await supabase
      .from('qa_answers')
      .select('*', { count: 'exact', head: true });

    // ユーザー数
    const { count: usersCount } = await supabase
      .from('qa_user_profiles')
      .select('*', { count: 'exact', head: true });

    // 保留中の出金
    const { data: pendingPayouts } = await supabase
      .from('qa_payouts')
      .select('amount')
      .in('status', ['REQUESTED', 'PROCESSING']);

    const pendingAmount = pendingPayouts?.reduce((sum, p) => sum + p.amount, 0) || 0;

    // PPVプール統計
    const { data: poolsData } = await supabase
      .from('qa_ppv_pools')
      .select('held_for_best, total_amount');

    const ppvStats = {
      totalHeldForBest: poolsData?.reduce((sum, p) => sum + p.held_for_best, 0) || 0,
      totalOthersPool: poolsData?.reduce((sum, p) => sum + p.total_amount, 0) || 0,
      questionsWithPools: poolsData?.length || 0,
    };

    return {
      totalRevenue,
      totalQuestions: questionsCount || 0,
      totalAnswers: answersCount || 0,
      totalUsers: usersCount || 0,
      pendingPayouts: pendingAmount,
      ppvPools: ppvStats,
    };
  };

  const fetchRecentTransactions = async () => {
    const { data } = await supabase
      .from('qa_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    return data || [];
  };

  const fetchPPVPools = async () => {
    const { data } = await supabase
      .from('qa_ppv_pools')
      .select(`
        *,
        question:qa_questions(
          title,
          status
        )
      `)
      .gt('held_for_best', 0)
      .or('total_amount.gt.0')
      .order('updated_at', { ascending: false })
      .limit(10);

    return data || [];
  };

  const handleDistributePPV = async (questionId: string, action: 'distribute_best' | 'distribute_others') => {
    try {
      const response = await fetch('/api/qa/settlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, action }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(`分配完了: ¥${result.distributed.toLocaleString()}`);
        loadDashboardData();
      } else {
        const error = await response.json();
        alert(`エラー: ${error.error}`);
      }
    } catch (error) {
      console.error('Distribution error:', error);
      alert('分配処理に失敗しました');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Q&Aプラットフォーム 管理ダッシュボード</h1>
        <p className="text-gray-600 mt-2">システムの統計と運用状態を監視</p>
      </div>

      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">プラットフォーム収益</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ¥{stats?.totalRevenue.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">累計手数料収入</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">総質問数</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalQuestions || 0}</div>
            <p className="text-xs text-muted-foreground">総回答数: {stats?.totalAnswers || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">アクティブユーザー</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
            <p className="text-xs text-muted-foreground">登録ユーザー数</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">保留出金</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ¥{stats?.pendingPayouts.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">処理待ち出金</p>
          </CardContent>
        </Card>
      </div>

      {/* PPVプール状態 */}
      <Alert className="mb-8">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="ml-2">
          <strong>PPVプール状態:</strong>
          <span className="ml-4">ベスト保留: ¥{stats?.ppvPools.totalHeldForBest.toLocaleString() || 0}</span>
          <span className="ml-4">その他プール: ¥{stats?.ppvPools.totalOthersPool.toLocaleString() || 0}</span>
          <span className="ml-4">対象質問: {stats?.ppvPools.questionsWithPools || 0}件</span>
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="transactions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="transactions">最近の取引</TabsTrigger>
          <TabsTrigger value="ppv-pools">PPVプール管理</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>最近の取引</CardTitle>
              <CardDescription>直近10件の取引履歴</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>日時</TableHead>
                    <TableHead>タイプ</TableHead>
                    <TableHead>金額</TableHead>
                    <TableHead>ステータス</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-sm">
                        {new Date(tx.created_at).toLocaleString('ja-JP')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={tx.type === 'PPV' ? 'default' : 'secondary'}>
                          {tx.type}
                        </Badge>
                      </TableCell>
                      <TableCell>¥{tx.amount.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            tx.status === 'COMPLETED'
                              ? 'default'
                              : tx.status === 'FAILED'
                              ? 'destructive'
                              : 'secondary'
                          }
                        >
                          {tx.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ppv-pools" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>PPVプール管理</CardTitle>
              <CardDescription>未清算のPPVプール一覧</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>質問</TableHead>
                    <TableHead>ベスト保留</TableHead>
                    <TableHead>その他プール</TableHead>
                    <TableHead>更新日時</TableHead>
                    <TableHead>アクション</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ppvPools.map((pool) => (
                    <TableRow key={pool.id}>
                      <TableCell className="max-w-xs truncate">
                        {pool.question?.title || pool.question_id}
                      </TableCell>
                      <TableCell>¥{pool.held_for_best.toLocaleString()}</TableCell>
                      <TableCell>¥{pool.total_amount.toLocaleString()}</TableCell>
                      <TableCell className="text-sm">
                        {new Date(pool.updated_at).toLocaleDateString('ja-JP')}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {pool.held_for_best > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDistributePPV(pool.question_id, 'distribute_best')}
                            >
                              ベスト分配
                            </Button>
                          )}
                          {pool.total_amount > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDistributePPV(pool.question_id, 'distribute_others')}
                            >
                              その他分配
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
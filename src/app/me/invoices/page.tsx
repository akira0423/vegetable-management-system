'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

interface Invoice {
  id: string;
  invoice_number: string;
  period_start: string;
  period_end: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  status: 'DRAFT' | 'ISSUED' | 'SENT' | 'PAID' | 'CANCELLED';
  issued_at?: string;
  line_items?: Array<{
    date: string;
    type: string;
    questionId?: string;
    questionTitle?: string;
    description?: string;
    amount: number;
    transactionId?: string;
  }>;
}

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  useEffect(() => {
    fetchInvoices();
  }, [selectedYear, selectedMonth]);

  const fetchInvoices = async () => {
    try {
      let url = '/api/questions/invoices';
      const params = new URLSearchParams();

      if (selectedYear) {
        params.append('year', selectedYear.toString());
      }
      if (selectedMonth !== null) {
        params.append('month', (selectedMonth + 1).toString());
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/auth/login');
          return;
        }
        throw new Error('Failed to fetch invoices');
      }
      const data = await response.json();
      setInvoices(data);
    } catch (error) {
      console.error('Error fetching invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async (invoice: Invoice) => {
    setDownloading(invoice.id);
    try {
      const response = await fetch(`/api/questions/invoices/${invoice.id}/pdf`);
      if (!response.ok) throw new Error('Failed to download invoice');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice_${invoice.invoice_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading invoice:', error);
      alert('請求書のダウンロードに失敗しました');
    } finally {
      setDownloading(null);
    }
  };

  const statusColors = {
    DRAFT: 'bg-gray-100 text-gray-800',
    ISSUED: 'bg-blue-100 text-blue-800',
    SENT: 'bg-yellow-100 text-yellow-800',
    PAID: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800',
  };

  const statusLabels = {
    DRAFT: '下書き',
    ISSUED: '発行済み',
    SENT: '送付済み',
    PAID: '支払済み',
    CANCELLED: 'キャンセル',
  };

  const transactionTypeLabels: Record<string, string> = {
    ESCROW: 'エスクロー手数料',
    PPV: 'PPV手数料',
    BEST_ANSWER: 'ベストアンサー手数料',
    PPV_SHARE: 'PPV分配手数料',
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">請求書</h1>
          <p className="text-gray-600 mt-2">プラットフォーム利用手数料の明細</p>
        </div>

        {/* フィルター */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                年
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {[2025, 2024, 2023].map(year => (
                  <option key={year} value={year}>{year}年</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                月
              </label>
              <select
                value={selectedMonth !== null ? selectedMonth : ''}
                onChange={(e) => setSelectedMonth(e.target.value ? parseInt(e.target.value) : null)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">全て</option>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i} value={i}>
                    {i + 1}月
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 請求書一覧 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    請求書番号
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    期間
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    状態
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    手数料（税抜）
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    消費税
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    合計
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      請求書がありません
                    </td>
                  </tr>
                ) : (
                  invoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {invoice.invoice_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {format(new Date(invoice.period_start), 'yyyy年MM月', { locale: ja })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[invoice.status]}`}>
                          {statusLabels[invoice.status]}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                        ¥{invoice.subtotal.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                        ¥{invoice.tax_amount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                        ¥{invoice.total_amount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                        <button
                          onClick={() => setSelectedInvoice(invoice)}
                          className="text-blue-600 hover:text-blue-800 mr-3"
                        >
                          詳細
                        </button>
                        <button
                          onClick={() => handleDownloadPDF(invoice)}
                          disabled={downloading === invoice.id}
                          className="text-green-600 hover:text-green-800 disabled:opacity-50"
                        >
                          {downloading === invoice.id ? 'ダウンロード中...' : 'PDF'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 請求書詳細モーダル */}
        {selectedInvoice && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold text-gray-900">
                    請求書詳細 - {selectedInvoice.invoice_number}
                  </h2>
                  <button
                    onClick={() => setSelectedInvoice(null)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="p-6">
                {/* 請求書情報 */}
                <div className="mb-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm font-medium text-gray-700">期間</div>
                      <div className="text-gray-900">
                        {format(new Date(selectedInvoice.period_start), 'yyyy年MM月dd日', { locale: ja })} -
                        {format(new Date(selectedInvoice.period_end), 'yyyy年MM月dd日', { locale: ja })}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-700">状態</div>
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[selectedInvoice.status]}`}>
                        {statusLabels[selectedInvoice.status]}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 明細 */}
                {selectedInvoice.line_items && selectedInvoice.line_items.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-3">明細</h3>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">日付</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">種別</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">説明</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">手数料</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {selectedInvoice.line_items.map((item, index) => (
                            <tr key={index}>
                              <td className="px-4 py-2 text-sm text-gray-900">
                                {format(new Date(item.date), 'MM/dd', { locale: ja })}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900">
                                {transactionTypeLabels[item.type] || item.type}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900">
                                {item.questionTitle || item.description || '-'}
                              </td>
                              <td className="px-4 py-2 text-sm text-right text-gray-900">
                                ¥{item.amount.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 金額サマリー */}
                <div className="border-t border-gray-200 pt-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-700">手数料合計（税抜）</span>
                      <span className="text-gray-900">¥{selectedInvoice.subtotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">消費税（{selectedInvoice.tax_rate}%）</span>
                      <span className="text-gray-900">¥{selectedInvoice.tax_amount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-lg">
                      <span className="text-gray-900">合計</span>
                      <span className="text-gray-900">¥{selectedInvoice.total_amount.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* 注記 */}
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">
                    ※ この請求書はプラットフォーム利用手数料の明細です。
                    手数料は各取引時に自動的に控除されています。
                  </p>
                </div>

                {/* アクション */}
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => setSelectedInvoice(null)}
                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    閉じる
                  </button>
                  <button
                    onClick={() => handleDownloadPDF(selectedInvoice)}
                    disabled={downloading === selectedInvoice.id}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                  >
                    {downloading === selectedInvoice.id ? 'ダウンロード中...' : 'PDFダウンロード'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
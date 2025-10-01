import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

// フォント登録（日本語フォントが必要な場合は適切なフォントファイルを追加）
// Font.register({
//   family: 'NotoSansJP',
//   src: '/fonts/NotoSansJP-Regular.ttf'
// });

interface InvoiceData {
  invoice_number: string;
  period_start: string;
  period_end: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  issued_at?: string;
  issuer: {
    company_name: string;
    address: string;
    registration_no: string;
    tel: string;
    email: string;
  };
  recipient: {
    display_name: string;
    company_name?: string;
    billing_address?: string;
    invoice_registration_no?: string;
  };
  line_items?: Array<{
    date: string;
    type: string;
    questionTitle?: string;
    description?: string;
    amount: number;
  }>;
}

interface InvoicePDFProps {
  invoice: InvoiceData;
}

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 11,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    marginBottom: 10,
    textAlign: 'center',
  },
  invoiceNumber: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 20,
  },
  section: {
    marginBottom: 15,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  label: {
    fontWeight: 'bold',
    marginRight: 10,
  },
  value: {
    flex: 1,
  },
  table: {
    marginTop: 10,
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingBottom: 5,
    marginBottom: 5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 3,
  },
  tableCol1: {
    width: '15%',
  },
  tableCol2: {
    width: '20%',
  },
  tableCol3: {
    width: '45%',
  },
  tableCol4: {
    width: '20%',
    textAlign: 'right',
  },
  tableHeaderText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  tableCellText: {
    fontSize: 10,
  },
  summary: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#000',
    paddingTop: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 5,
  },
  summaryLabel: {
    width: 100,
    textAlign: 'right',
    marginRight: 20,
  },
  summaryValue: {
    width: 100,
    textAlign: 'right',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 5,
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: '#000',
  },
  totalLabel: {
    width: 100,
    textAlign: 'right',
    marginRight: 20,
    fontSize: 14,
    fontWeight: 'bold',
  },
  totalValue: {
    width: 100,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: 'bold',
  },
  footer: {
    marginTop: 30,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#ccc',
  },
  note: {
    fontSize: 9,
    color: '#666',
    marginTop: 10,
  },
  issuerInfo: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#f5f5f5',
  },
  issuerTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  issuerText: {
    fontSize: 10,
    marginBottom: 2,
  },
});

const transactionTypeLabels: Record<string, string> = {
  ESCROW: 'Escrow Fee',
  PPV: 'PPV Fee',
  TIP: 'Tip Fee',
  REFUND: 'Refund',
  WITHDRAWAL: 'Withdrawal',
};

const InvoicePDF: React.FC<InvoicePDFProps> = ({ invoice }) => {
  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'yyyy/MM/dd');
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (amount: number) => {
    return `¥${amount.toLocaleString()}`;
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ヘッダー */}
        <View style={styles.header}>
          <Text style={styles.title}>INVOICE</Text>
          <Text style={styles.invoiceNumber}>
            Invoice No: {invoice.invoice_number}
          </Text>
        </View>

        {/* 日付情報 */}
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>Issue Date:</Text>
            <Text style={styles.value}>
              {invoice.issued_at ? formatDate(invoice.issued_at) : formatDate(new Date().toISOString())}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Period:</Text>
            <Text style={styles.value}>
              {formatDate(invoice.period_start)} - {formatDate(invoice.period_end)}
            </Text>
          </View>
        </View>

        {/* 受領者情報 */}
        <View style={styles.section}>
          <Text style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 5 }}>
            Bill To:
          </Text>
          <Text>{invoice.recipient.company_name || invoice.recipient.display_name}</Text>
          {invoice.recipient.billing_address && (
            <Text style={{ fontSize: 10 }}>{invoice.recipient.billing_address}</Text>
          )}
          {invoice.recipient.invoice_registration_no && (
            <Text style={{ fontSize: 10 }}>
              Registration No: {invoice.recipient.invoice_registration_no}
            </Text>
          )}
        </View>

        {/* 明細テーブル */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCol1, styles.tableHeaderText]}>Date</Text>
            <Text style={[styles.tableCol2, styles.tableHeaderText]}>Type</Text>
            <Text style={[styles.tableCol3, styles.tableHeaderText]}>Description</Text>
            <Text style={[styles.tableCol4, styles.tableHeaderText]}>Amount</Text>
          </View>

          {invoice.line_items?.map((item, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={[styles.tableCol1, styles.tableCellText]}>
                {format(new Date(item.date), 'MM/dd')}
              </Text>
              <Text style={[styles.tableCol2, styles.tableCellText]}>
                {transactionTypeLabels[item.type] || item.type}
              </Text>
              <Text style={[styles.tableCol3, styles.tableCellText]}>
                {item.questionTitle || item.description || '-'}
              </Text>
              <Text style={[styles.tableCol4, styles.tableCellText]}>
                {formatCurrency(item.amount)}
              </Text>
            </View>
          ))}
        </View>

        {/* 金額サマリー */}
        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal:</Text>
            <Text style={styles.summaryValue}>{formatCurrency(invoice.subtotal)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tax ({invoice.tax_rate}%):</Text>
            <Text style={styles.summaryValue}>{formatCurrency(invoice.tax_amount)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total:</Text>
            <Text style={styles.totalValue}>{formatCurrency(invoice.total_amount)}</Text>
          </View>
        </View>

        {/* 発行者情報 */}
        <View style={styles.issuerInfo}>
          <Text style={styles.issuerTitle}>Issuer Information</Text>
          <Text style={styles.issuerText}>{invoice.issuer.company_name}</Text>
          <Text style={styles.issuerText}>{invoice.issuer.address}</Text>
          <Text style={styles.issuerText}>Registration No: {invoice.issuer.registration_no}</Text>
          <Text style={styles.issuerText}>Tel: {invoice.issuer.tel}</Text>
          <Text style={styles.issuerText}>Email: {invoice.issuer.email}</Text>
        </View>

        {/* 注記 */}
        <View style={styles.footer}>
          <Text style={styles.note}>
            * This invoice is for platform usage fees that have been automatically deducted from each transaction.
          </Text>
          <Text style={styles.note}>
            * This is a qualified invoice under the Japanese Invoice System.
          </Text>
        </View>
      </Page>
    </Document>
  );
};

export default InvoicePDF;
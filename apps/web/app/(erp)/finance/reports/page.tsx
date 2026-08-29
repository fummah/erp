'use client';
import { Card, Tabs } from 'antd';
import { BalanceSheetSection, CashflowSection, PnlSection, VarianceSection } from '@/components/finance-sections';

const items = [
  { key: 'pnl', label: 'Profit & Loss', children: <PnlSection /> },
  { key: 'bs', label: 'Balance Sheet', children: <BalanceSheetSection /> },
  { key: 'cashflow', label: 'Cash Flow', children: <CashflowSection /> },
  { key: 'variance', label: 'Budget vs Actual', children: <VarianceSection /> },
];

export default function ReportsPage() {
  return (
    <div className="nex-fade">
      <Card className="nex-card" styles={{ body: { padding: '18px 20px' } }}>
        <Tabs items={items} defaultActiveKey="pnl" destroyOnHidden />
      </Card>
    </div>
  );
}


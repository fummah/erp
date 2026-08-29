'use client';
import { Card } from 'antd';
import { BalanceSheetSection } from '@/components/finance-sections';

export default function BalanceSheetPage() {
  return (
    <div className="nex-fade">
      <Card className="nex-card" styles={{ body: { padding: '18px 20px' } }}><BalanceSheetSection /></Card>
    </div>
  );
}


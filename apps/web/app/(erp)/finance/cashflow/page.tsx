'use client';
import { Card } from 'antd';
import { CashflowSection } from '@/components/finance-sections';

export default function CashflowPage() {
  return (
    <div className="nex-fade">
      <Card className="nex-card" styles={{ body: { padding: '18px 20px' } }}><CashflowSection /></Card>
    </div>
  );
}


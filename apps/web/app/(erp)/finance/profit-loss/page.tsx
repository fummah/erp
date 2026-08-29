'use client';
import { Card } from 'antd';
import { PnlSection } from '@/components/finance-sections';

export default function ProfitLossPage() {
  return (
    <div className="nex-fade">
      <Card className="nex-card" styles={{ body: { padding: '18px 20px' } }}><PnlSection /></Card>
    </div>
  );
}


'use client';
import { DataTablePage } from '@/components/data-table-page';
import { Tag } from 'antd';
export default function Page(){return <DataTablePage title="External Integrations" subtitle="Connection registry for ZIMRA FDMS, payments, banking, email, storage, identity, webhooks and messaging." path="/integrations" columns={[{title:'Type',dataIndex:'type'},{title:'Provider',dataIndex:'provider'},{title:'Name',dataIndex:'name'},{title:'Status',dataIndex:'status',render:(v:string)=><Tag color={['CONNECTED','MOCK'].includes(v)?'green':'default'}>{v}</Tag>},{title:'Base URL',dataIndex:'baseUrl'}]}/>}

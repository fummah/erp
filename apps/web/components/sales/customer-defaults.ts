'use client';
import { api } from '@/lib/api';

/**
 * Shared customer → document hydration used by Quote, Sales Order and Invoice forms
 * (manual selection and Customer Details entry points behave identically).
 */

/** Clean multi-line address from the structured customer master fields. */
export function formatCustomerAddress(c: any): string | null {
  if (!c) return null;
  const street = [c.address1, c.address2].map((x: any) => String(x || '').trim()).filter(Boolean).join(', ');
  const locality = [c.city, c.state].map((x: any) => String(x || '').trim()).filter(Boolean).join(', ');
  const zipLine = [locality, String(c.zip || '').trim()].filter(Boolean).join(' ');
  const lines = [street, zipLine, String(c.country || '').trim()].filter(Boolean);
  return lines.length ? lines.join('\n') : null;
}

export type CustomerDocDefaults = {
  customerId: string;
  displayName: string;
  email: string | null;
  billingAddress: string | null;
  shippingAddress: string | null;
  terms: string | null;
  taxStatus: string;
  defaultTaxRate: number;
  priceList: { id: string; name: string; currency: string } | null;
};

/** One hydration path for every sales document form. */
export async function fetchCustomerDocumentDefaults(customerId: string): Promise<CustomerDocDefaults | null> {
  try { return await api(`/sales/customers/${customerId}/document-defaults`); } catch { return null; }
}

export type ResolvedProductPrice = {
  price: number | null;
  source: 'PRICE_LIST' | 'DEFAULT_SALES_PRICE' | 'NONE';
  priceListName?: string;
  currency: string;
  warning: string | null;
};

/** Authoritative product → Rate resolution (backend PricingService). */
export async function resolveProductPrice(customerId: string | null | undefined, itemId: string, currency?: string | null, quantity?: number): Promise<ResolvedProductPrice> {
  const q = new URLSearchParams({ itemId });
  if (customerId) q.set('customerId', customerId);
  if (currency) q.set('currency', currency);
  if (quantity) q.set('quantity', String(quantity));
  const res = await api(`/sales/pricing/resolve?${q.toString()}`);
  return { price: res.price, source: res.source, priceListName: res.priceListName, currency: res.currency, warning: res.source === 'NONE' ? `Sales price not configured for this product${currency ? ` in ${currency}` : ''}. Enter a rate manually if permitted.` : null };
}

/** Terms engine: Net 15/30/60 → due date. */
export function dueDateFromTerms(terms: string | null | undefined, invoiceDate: any): any {
  if (!invoiceDate) return null;
  const d = typeof invoiceDate === 'string' ? new Date(invoiceDate) : invoiceDate?.toDate?.() || invoiceDate;
  if (!d || Number.isNaN(new Date(d).getTime())) return null;
  const t = String(terms || '').toLowerCase();
  const dayjsLike = new Date(d);
  if (t.includes('net 15')) { dayjsLike.setDate(dayjsLike.getDate() + 15); return dayjsLike; }
  if (t.includes('net 30')) { dayjsLike.setDate(dayjsLike.getDate() + 30); return dayjsLike; }
  if (t.includes('net 60')) { dayjsLike.setDate(dayjsLike.getDate() + 60); return dayjsLike; }
  return null;
}

/** Line defaults from the selected product (description snapshot: name only — no SKU). */
export function productLineDefaults(item: any): { description: string; unit?: string; quantity: number } {
  return {
    description: item?.name || item?.description || '',
    unit: item?.unit || undefined,
    quantity: 1,
  };
}

/** Improved product dropdown option: product name only (clean labels on quote/order/invoice lines). */
export function productOptions(items: any[] | undefined, currency = 'USD') {
  return (items || []).map((i: any) => ({
    label: i.name,
    value: i.id,
    item: i,
  }));
}

/**
 * Resolve the full line patch when a product is selected (or changed).
 * - description/unit snapshot from the item master
 * - Rate from the PricingService (price list → default sales price); never cost
 * - warning when no sales price is configured (never silently $0)
 */
export async function resolveProductLinePatch(itemId: string, items: any[] | undefined, customerId?: string | null, currency?: string | null): Promise<{ patch: Record<string, any>; warning: string | null }> {
  const item = (items || []).find((i: any) => i.id === itemId);
  const base = productLineDefaults(item);
  const res = await resolveProductPrice(customerId, itemId, currency);
  const patch: Record<string, any> = { itemId, description: base.description, unit: base.unit, quantity: base.quantity };
  if (res.price != null) patch.unitPrice = res.price; // otherwise leave the current rate untouched and warn
  return { patch, warning: res.warning };
}

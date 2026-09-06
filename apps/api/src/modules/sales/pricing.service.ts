import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { round2 } from '../performance/performance.constants';

export type ResolvedPrice = { price: number | null; source: 'PRICE_LIST' | 'DEFAULT_SALES_PRICE' | 'NONE'; priceListName?: string; currency: string };

/**
 * Authoritative sales pricing resolution.
 * Priority: customer price list (matching currency) → product default selling price.
 * Inventory cost (avgCost / purchasePrice) is NEVER used for the sales Rate.
 */
@Injectable()
export class PricingService {
  constructor(private prisma: PrismaService) {}

  async resolve(companyId: string, opts: { customerId?: string | null; itemId: string; currency?: string | null; quantity?: number | null }): Promise<ResolvedPrice> {
    const currency = (opts.currency || 'USD').toUpperCase();
    const item = await this.prisma.inventoryItem.findFirst({ where: { id: opts.itemId, companyId } });
    if (!item) return { price: null, source: 'NONE', currency };

    // 1. Customer price list
    if (opts.customerId) {
      const customer = await this.prisma.customer.findFirst({ where: { id: opts.customerId, companyId } });
      if (customer?.priceListId) {
        const listItems = await this.prisma.priceListItem.findMany({ where: { itemId: item.id, priceList: { companyId, active: true } }, include: { priceList: true } });
        const matching = listItems
          .filter((li) => (li.priceList.currency || 'USD').toUpperCase() === currency)
          .filter((li) => !li.minQty || !opts.quantity || Number(opts.quantity) >= Number(li.minQty))
          .sort((a, b) => Number(b.minQty || 0) - Number(a.minQty || 0));
        if (matching.length && Number(matching[0].price) > 0) {
          return { price: round2(Number(matching[0].price)), source: 'PRICE_LIST', priceListName: matching[0].priceList.name, currency };
        }
      }
    }

    // 2. Product default selling price
    if (item.sellingPrice != null && Number(item.sellingPrice) > 0) {
      return { price: round2(Number(item.sellingPrice)), source: 'DEFAULT_SALES_PRICE', currency };
    }

    // No sales price configured — never fall back to cost prices.
    return { price: null, source: 'NONE', currency };
  }

  /** Fill in unitPrice for submitted lines that reference a product but carry no price.
   *  Explicit (non-zero) submitted rates are preserved as manual overrides. */
  async resolveLinePrices(companyId: string, opts: { customerId?: string | null; currency?: string | null; lines: any[] }): Promise<{ lines: any[]; unresolved: string[] }> {
    const unresolved: string[] = [];
    const byItem = new Map<string, any[]>();
    for (const l of opts.lines) {
      if (l.itemId && (l.unitPrice == null || Number(l.unitPrice) <= 0)) {
        const key = `${l.itemId}`;
        if (!byItem.has(key)) byItem.set(key, []);
        byItem.get(key)!.push(l);
      }
    }
    if (byItem.size) {
      for (const [itemId, lines] of byItem) {
        const qty = Math.max(...lines.map((l) => Number(l.quantity || 1)));
        const res = await this.resolve(companyId, { customerId: opts.customerId, itemId, currency: opts.currency, quantity: qty });
        for (const l of lines) {
          if (res.price != null) { l.unitPrice = res.price; l.priceSource = res.source; }
          else unresolved.push(l.description || itemId);
        }
      }
    }
    return { lines: opts.lines, unresolved };
  }

  /** Customer master defaults used to pre-populate quote/order/invoice documents. */
  async documentDefaults(companyId: string, customerId: string) {
    const c = await this.prisma.customer.findFirst({ where: { id: customerId, companyId } });
    if (!c) return null;
    const priceList = c.priceListId ? await this.prisma.priceList.findFirst({ where: { id: c.priceListId, companyId, active: true }, select: { id: true, name: true, currency: true } }) : null;
    const billingAddress = [c.address1, c.address2, c.city, c.state, c.zip, c.country].filter((x) => String(x || '').trim()).join(', ');
    return {
      customerId: c.id,
      displayName: c.name,
      email: c.email || null,
      phone: c.phone || null,
      billingAddress: billingAddress || null,
      shippingAddress: billingAddress || null, // single structured address master — shipping defaults to billing
      terms: c.paymentTerms || null,
      taxStatus: c.taxStatus || 'Taxable',
      defaultTaxRate: Number(c.defaultTaxRate || 0),
      priceList: priceList || null,
    };
  }
}

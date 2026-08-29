import type { Finding } from '../common/types.js';
import { checkWooOrders, checkWooStuckOrders, checkWooFulfillmentLag, checkWooInventory, checkWooSkuQuality, checkWooWebhooks, type WooAuditOrder, type WooAuditProduct, type WooAuditWebhook } from './checks.js';
import { checkTrend } from '../common/checks.js';
import { gmtToIso } from '../common/types.js';

const PER_PAGE = 100;

async function wooGet(baseUrl: string, key: string, secret: string, path: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(`/wp-json/wc/v3/${path}`, baseUrl);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const auth = Buffer.from(`${key}:${secret}`).toString('base64');
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Basic ${auth}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`WooCommerce HTTP ${res.status} su /${path}`);
  return res.json();
}

async function wooGetAll(baseUrl: string, key: string, secret: string, path: string, params: Record<string, string>, maxItems: number): Promise<unknown[]> {
  const out: unknown[] = [];
  for (let page = 1; out.length < maxItems; page++) {
    const batch = await wooGet(baseUrl, key, secret, path, { ...params, per_page: String(PER_PAGE), page: String(page) });
    if (!Array.isArray(batch)) throw new Error(`Risposta WooCommerce non valida su /${path}: atteso array`);
    out.push(...batch);
    if (batch.length < PER_PAGE) break;
  }
  return out.slice(0, maxItems);
}

function mapProduct(r: any, type: string, name: string): WooAuditProduct {
  return {
    id: Number(r.id),
    name,
    sku: r.sku ? String(r.sku) : null,
    type,
    manageStock: r.manage_stock === true,
    stockQuantity: typeof r.stock_quantity === 'number' ? r.stock_quantity : null,
    stockStatus: String(r.stock_status ?? ''),
  };
}

export async function fetchWooData(baseUrl: string, key: string, secret: string) {
  const now = new Date();
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const findings: Finding[] = [];
  const skipped: string[] = [];

  try {
    const raw: any[] = await wooGetAll(baseUrl, key, secret, 'orders', {
      status: 'any',
      after: since,
      orderby: 'date',
      order: 'asc',
      _fields: 'id,number,status,date_created_gmt,date_paid_gmt,date_completed_gmt,total',
    }, 2000);
    const orders: WooAuditOrder[] = raw
      .filter((r) => Number.isFinite(r.id))
      .map((r) => ({
        id: Number(r.id),
        number: String(r.number ?? r.id),
        status: String(r.status ?? ''),
        createdAt: gmtToIso(r.date_created_gmt) ?? new Date(0).toISOString(),
        paidAt: gmtToIso(r.date_paid_gmt),
        completedAt: gmtToIso(r.date_completed_gmt),
        total: Number.parseFloat(String(r.total ?? '0')) || 0,
      }));
    findings.push(
      ...checkWooOrders(orders, now),
      ...checkWooStuckOrders(orders, now),
      ...checkWooFulfillmentLag(orders),
      ...checkTrend(orders, now),
    );
  } catch (err) {
    skipped.push(`Ordini non analizzabili (${err instanceof Error ? err.message : err}) - verificare la chiave REST (permesso read).`);
  }

  try {
    const fields = 'id,name,sku,type,manage_stock,stock_quantity,stock_status';
    const rawProducts: any[] = await wooGetAll(baseUrl, key, secret, 'products', { status: 'publish', _fields: fields }, 1000);
    const products: WooAuditProduct[] = rawProducts
      .filter((r) => Number.isFinite(r.id))
      .map((r) => mapProduct(r, String(r.type ?? 'simple'), String(r.name ?? `#${r.id}`)));

    const variabili = rawProducts.filter((r) => r.type === 'variable').slice(0, 200);
    for (const parent of variabili) {
      const variants: any[] = await wooGetAll(baseUrl, key, secret, `products/${parent.id}/variations`, { _fields: fields }, 500);
      products.push(...variants
        .filter((r) => Number.isFinite(r.id))
        .map((r) => mapProduct(r, 'variation', `${parent.name ?? `#${parent.id}`} (variante ${r.sku || r.id})`)));
    }
    findings.push(...checkWooInventory(products), ...checkWooSkuQuality(products));
  } catch (err) {
    skipped.push(`Catalogo non analizzabile (${err instanceof Error ? err.message : err}) - verificare la chiave REST sui prodotti.`);
  }

  try {
    const rawWebhooks: any[] = await wooGetAll(baseUrl, key, secret, 'webhooks', { _fields: 'name,topic,status,delivery_url' }, 200);
    const webhooks: WooAuditWebhook[] = rawWebhooks.map((r) => ({
      name: String(r.name ?? '?'),
      topic: String(r.topic ?? '?'),
      status: String(r.status ?? '?'),
      deliveryUrl: String(r.delivery_url ?? ''),
    }));
    findings.push(...checkWooWebhooks(webhooks));
  } catch (err) {
    skipped.push(`Webhook non analizzabili (${err instanceof Error ? err.message : err}) - su alcuni setup l'endpoint webhooks richiede una chiave con permessi più ampi.`);
  }

  return { findings, skipped, now };
}

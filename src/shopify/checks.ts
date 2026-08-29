import type { Finding, Severity } from '../common/types.js';

export interface AuditOrder {
  name: string;
  createdAt: string;
  cancelledAt: string | null;
  displayFulfillmentStatus: string;
  fulfilledAt?: string | null;
}

export interface AuditVariant {
  productTitle: string;
  sku: string | null;
  inventoryQuantity: number | null;
  tracked: boolean;
}

export interface AuditWebhook {
  topic: string;
  endpoint: string;
}

export interface AuditAppInstall {
  appName: string;
  accessScopes: string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function checkOrders(orders: AuditOrder[], now: Date): Finding[] {
  const findings: Finding[] = [];
  const area = 'Area 1 - Gestione degli ordini';
  const cancelled = orders.filter((o) => o.cancelledAt);
  if (orders.length === 0) {
    findings.push({ area, severity: 'attenzione', title: 'Nessun ordine negli ultimi 30 giorni', detail: 'Impossibile valutare il flusso ordini: verificare il periodo o gli accessi.' });
    return findings;
  }
  findings.push({
    area,
    severity: 'ok',
    title: orders.length === 1
      ? '1 ordine negli ultimi 30 giorni'
      : `${orders.length} ordini negli ultimi 30 giorni (~${(orders.length / 30).toFixed(1)}/giorno)`,
    detail: 'Base di volume su cui dimensionare integrazioni e automazioni.',
  });
  const cancelRate = cancelled.length / orders.length;
  if (cancelRate > 0.05) {
    findings.push({
      area,
      severity: cancelRate > 0.15 ? 'critico' : 'attenzione',
      title: `${(cancelRate * 100).toFixed(1)}% di ordini annullati (${cancelled.length})`,
      detail: 'Un tasso alto di annullamenti spesso nasconde errori di giacenza o processi manuali: da approfondire in sessione.',
    });
  }
  const staleUnfulfilled = orders.filter(
    (o) => !o.cancelledAt && o.displayFulfillmentStatus === 'UNFULFILLED' && now.getTime() - Date.parse(o.createdAt) > 7 * DAY_MS,
  );
  if (staleUnfulfilled.length > 0) {
    // Redazione dati: mostriamo al massimo 3 order name (che di solito sono #1001 e non sensibili, ma meglio mascherarli se lunghi)
    const examples = staleUnfulfilled.slice(0, 3).map((o) => o.name.replace(/(.+)@(.+)/, '***@$2')).join(', ');
    findings.push({
      area,
      severity: staleUnfulfilled.length > 5 ? 'critico' : 'attenzione',
      title: `${staleUnfulfilled.length} ordini non evasi da più di 7 giorni`,
      detail: `Esempi: ${examples}. Collo di bottiglia in evasione o dati non allineati col magazzino.`,
    });
  }
  return findings;
}

export function checkInventory(variants: AuditVariant[]): Finding[] {
  const findings: Finding[] = [];
  const area = 'Area 2 - Magazzino e inventario';
  const untracked = variants.filter((v) => !v.tracked);
  if (untracked.length > 0) {
    findings.push({
      area,
      severity: 'attenzione',
      title: `${untracked.length} varianti senza tracciamento giacenze`,
      detail: 'Senza tracking, nessun sistema a valle può fidarsi delle disponibilità: primo prerequisito per sincronizzare i canali.',
    });
  }
  const negative = variants.filter((v) => v.tracked && (v.inventoryQuantity ?? 0) < 0);
  if (negative.length > 0) {
    const examples = negative.slice(0, 3).map((v) => `${v.productTitle} (${v.inventoryQuantity})`).join(', ');
    findings.push({
      area,
      severity: 'critico',
      title: `${negative.length} varianti con giacenza negativa`,
      detail: `Esempi: ${examples}. Giacenze sotto zero = vendite oltre lo stock: sintomo classico di canali non sincronizzati.`,
    });
  }
  if (findings.length === 0 && variants.length > 0) {
    findings.push({ area, severity: 'ok', title: 'Giacenze tracciate e non negative', detail: `${variants.length} varianti analizzate.` });
  }
  return findings;
}

export function checkSkuQuality(variants: AuditVariant[]): Finding[] {
  const findings: Finding[] = [];
  const area = 'Area 4 - Integrazione dei sistemi';
  const missing = variants.filter((v) => !v.sku || !v.sku.trim());
  if (missing.length > 0) {
    const examples = [...new Set(missing.map((v) => v.productTitle))].slice(0, 3).join(', ');
    findings.push({
      area,
      severity: 'critico',
      title: `${missing.length} varianti senza SKU`,
      detail: `Esempi: ${examples}. Lo SKU è la chiave con cui eCommerce e gestionale si parlano: senza, l'integrazione non ha un aggancio affidabile.`,
    });
  }
  const bySku = new Map<string, number>();
  for (const v of variants) {
    const sku = v.sku?.trim();
    if (sku) bySku.set(sku, (bySku.get(sku) ?? 0) + 1);
  }
  const dupes = [...bySku.entries()].filter(([, n]) => n > 1);
  if (dupes.length > 0) {
    const examples = dupes.slice(0, 3).map(([sku, n]) => `${sku} (×${n})`).join(', ');
    findings.push({
      area,
      severity: 'critico',
      title: `${dupes.length} SKU duplicati`,
      detail: `Esempi: ${examples}. Un ordine con SKU ambiguo finisce sull'articolo sbagliato in gestionale.`,
    });
  }
  if (findings.length === 0 && variants.length > 0) {
    findings.push({ area, severity: 'ok', title: 'SKU presenti e univoci', detail: 'La chiave di integrazione col gestionale è solida.' });
  }
  return findings;
}

export function checkFulfillmentLag(orders: AuditOrder[]): Finding[] {
  const area = 'Area 3 - Automazione dei processi';
  const lagsHours = orders
    .filter((o) => o.fulfilledAt)
    .map((o) => (Date.parse(String(o.fulfilledAt)) - Date.parse(o.createdAt)) / (60 * 60 * 1000))
    .filter((h) => Number.isFinite(h) && h >= 0);

  if (lagsHours.length === 0) {
    return [{
      area,
      severity: 'attenzione',
      title: 'Lag di evasione non misurabile',
      detail: 'Nessun ordine con data di fulfillment disponibile nel periodo analizzato.',
    }];
  }

  const avg = lagsHours.reduce((a, b) => a + b, 0) / lagsHours.length;
  const p90 = [...lagsHours].sort((a, b) => a - b)[Math.min(lagsHours.length - 1, Math.floor(lagsHours.length * 0.9))] ?? avg;
  const sev: Severity = avg > 72 || p90 > 120 ? 'critico' : avg > 24 || p90 > 48 ? 'attenzione' : 'ok';
  return [{
    area,
    severity: sev,
    title: `Lag evasione medio ${avg.toFixed(1)}h (p90 ${p90.toFixed(1)}h)`,
    detail: `Calcolato su ${lagsHours.length} ordini evasi. Ridurre il lag taglia richieste "dov'è il mio ordine?" e lavoro manuale.`,
  }];
}

export function checkWebhooks(webhooks: AuditWebhook[]): Finding[] {
  const area = 'Area 4 - Integrazione dei sistemi';
  if (webhooks.length === 0) {
    return [{
      area,
      severity: 'attenzione',
      title: 'Nessun webhook Shopify registrato',
      detail: 'Solo polling = maggiore latenza operativa. Consigliato webhook + polling di riconciliazione.',
    }];
  }
  const hasOrderCreate = webhooks.some((w) => w.topic === 'ORDERS_CREATE');
  const missingOrderCreate: Finding[] = hasOrderCreate
    ? []
    : [{
      area,
      severity: 'critico',
      title: 'Webhook ORDERS_CREATE assente',
      detail: 'Senza ORDERS_CREATE gli ordini non arrivano in tempo reale.',
    }];

  return [
    {
      area,
      severity: hasOrderCreate ? 'ok' : 'attenzione',
      title: `${webhooks.length} webhook registrati`,
      detail: `Topic: ${[...new Set(webhooks.map((w) => w.topic))].slice(0, 6).join(', ') || 'n/d'}.`,
    },
    ...missingOrderCreate,
  ];
}

export function checkAppInstall(app: AuditAppInstall): Finding[] {
  const area = 'Area 4 - Integrazione dei sistemi';
  const required = ['read_orders', 'read_products', 'read_inventory'];
  const granted = new Set(app.accessScopes);
  const missing = required.filter((s) => !granted.has(s));
  return [{
    area,
    severity: missing.length === 0 ? 'ok' : missing.length > 1 ? 'critico' : 'attenzione',
    title: `App installata: ${app.appName}`,
    detail: missing.length === 0
      ? `Scope chiave presenti (${required.join(', ')}).`
      : `Scope mancanti: ${missing.join(', ')}.`,
  }];
}

import type { Finding } from '../common/types.js';

export interface WooAuditOrder {
  id: number;
  number: string;
  status: string;
  createdAt: string;
  paidAt: string | null;
  completedAt: string | null;
  total: number;
}

export interface WooAuditProduct {
  id: number;
  name: string;
  sku: string | null;
  type: string;
  manageStock: boolean;
  stockQuantity: number | null;
  stockStatus: string;
}

export interface WooAuditWebhook {
  name: string;
  topic: string;
  status: string;
  deliveryUrl: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

function sellable(products: WooAuditProduct[]): WooAuditProduct[] {
  return products.filter((p) => p.type === 'simple' || p.type === 'variation');
}

export function checkWooOrders(orders: WooAuditOrder[], _now: Date): Finding[] {
  const area = 'Area 1 - Gestione degli ordini';
  if (orders.length === 0) {
    return [{
      area, severity: 'attenzione',
      title: 'Nessun ordine negli ultimi 30 giorni',
      detail: 'Impossibile valutare il flusso ordini: verificare il periodo o le credenziali API.',
    }];
  }
  const findings: Finding[] = [{
    area, severity: 'ok',
    title: orders.length === 1
      ? '1 ordine negli ultimi 30 giorni'
      : `${orders.length} ordini negli ultimi 30 giorni (~${(orders.length / 30).toFixed(1)}/giorno)`,
    detail: 'Base di volume su cui dimensionare integrazioni e automazioni.',
  }];

  const lost = orders.filter((o) => o.status === 'cancelled' || o.status === 'refunded');
  const lostRate = lost.length / orders.length;
  if (lostRate > 0.05) {
    findings.push({
      area, severity: lostRate > 0.15 ? 'critico' : 'attenzione',
      title: `${(lostRate * 100).toFixed(1)}% di ordini annullati o rimborsati (${lost.length})`,
      detail: 'Un tasso alto spesso nasconde errori di giacenza, tempi di evasione o processi manuali: da approfondire in sessione.',
    });
  }

  const failed = orders.filter((o) => o.status === 'failed');
  const failedRate = failed.length / orders.length;
  if (failedRate > 0.1) {
    findings.push({
      area, severity: failedRate > 0.25 ? 'critico' : 'attenzione',
      title: `${(failedRate * 100).toFixed(1)}% di pagamenti falliti (${failed.length} ordini in stato failed)`,
      detail: 'Pagamenti che falliscono spesso = gateway mal configurato o checkout che perde clienti: fatturato che scivola via in silenzio.',
    });
  }
  return findings;
}

export function checkWooStuckOrders(orders: WooAuditOrder[], now: Date): Finding[] {
  const area = 'Area 1 - Gestione degli ordini';
  const findings: Finding[] = [];
  const ageMs = (o: WooAuditOrder) => now.getTime() - Date.parse(o.createdAt);
  const examples = (list: WooAuditOrder[]) => list.slice(0, 3).map((o) => `#${o.number.replace(/(.+)@(.+)/, '***@$2')}`).join(', ');

  const pendingOld = orders.filter((o) => o.status === 'pending' && ageMs(o) > 48 * HOUR_MS);
  if (pendingOld.length > 0) {
    findings.push({
      area, severity: pendingOld.length > 10 ? 'critico' : 'attenzione',
      title: `${pendingOld.length} ordini in "pending" da più di 48 ore`,
      detail: `Esempi: ${examples(pendingOld)}. Pagamento mai arrivato: o il gateway non notifica l'esito, o manca una pulizia automatica dei carrelli abbandonati al checkout.`,
    });
  }

  const onHoldOld = orders.filter((o) => o.status === 'on-hold' && ageMs(o) > 72 * HOUR_MS);
  if (onHoldOld.length > 0) {
    findings.push({
      area, severity: onHoldOld.length > 10 ? 'critico' : 'attenzione',
      title: `${onHoldOld.length} ordini in "on-hold" da più di 72 ore`,
      detail: `Esempi: ${examples(onHoldOld)}. Tipico dei bonifici non riconciliati: nessuno incrocia gli incassi con gli ordini, e il cliente aspetta.`,
    });
  }

  const processingOld = orders.filter((o) => o.status === 'processing' && ageMs(o) > 7 * DAY_MS);
  if (processingOld.length > 0) {
    findings.push({
      area, severity: processingOld.length > 5 ? 'critico' : 'attenzione',
      title: `${processingOld.length} ordini pagati ma non evasi da più di 7 giorni`,
      detail: `Esempi: ${examples(processingOld)}. Soldi incassati e merce ferma: collo di bottiglia in evasione o ordini persi di vista tra i sistemi.`,
    });
  }

  if (findings.length === 0 && orders.length > 0) {
    findings.push({
      area, severity: 'ok',
      title: 'Nessun ordine fermo oltre soglia',
      detail: 'Pending, on-hold e processing rientrano nei tempi fisiologici.',
    });
  }
  return findings;
}

export function checkWooFulfillmentLag(orders: WooAuditOrder[]): Finding[] {
  const area = 'Area 3 - Automazione dei processi';
  const lagsHours = orders
    .filter((o) => o.status === 'completed' && o.completedAt)
    .map((o) => (Date.parse(String(o.completedAt)) - Date.parse(o.createdAt)) / HOUR_MS)
    .filter((h) => Number.isFinite(h) && h >= 0);

  if (lagsHours.length === 0) {
    return [{
      area, severity: 'attenzione',
      title: 'Lag di evasione non misurabile',
      detail: 'Nessun ordine completato con data di completamento nel periodo analizzato.',
    }];
  }
  const avg = lagsHours.reduce((a, b) => a + b, 0) / lagsHours.length;
  const p90 = [...lagsHours].sort((a, b) => a - b)[Math.min(lagsHours.length - 1, Math.floor(lagsHours.length * 0.9))] ?? avg;
  const severity = avg > 72 || p90 > 120 ? 'critico' : avg > 24 || p90 > 48 ? 'attenzione' : 'ok';
  return [{
    area, severity,
    title: `Lag evasione medio ${avg.toFixed(1)}h (p90 ${p90.toFixed(1)}h)`,
    detail: `Calcolato su ${lagsHours.length} ordini completati. Ridurre il lag taglia richieste "dov'è il mio ordine?" e lavoro manuale.`,
  }];
}

export function checkWooInventory(products: WooAuditProduct[]): Finding[] {
  const area = 'Area 2 - Magazzino e inventario';
  const findings: Finding[] = [];
  const items = sellable(products);

  const untracked = items.filter((p) => !p.manageStock);
  if (untracked.length > 0) {
    findings.push({
      area, severity: 'attenzione',
      title: `${untracked.length} articoli senza gestione giacenze`,
      detail: 'Senza "Gestisci magazzino" attivo, nessun sistema a valle può fidarsi delle disponibilità: primo prerequisito per sincronizzare i canali.',
    });
  }

  const negative = items.filter((p) => p.manageStock && (p.stockQuantity ?? 0) < 0);
  if (negative.length > 0) {
    findings.push({
      area, severity: 'critico',
      title: `${negative.length} articoli con giacenza negativa`,
      detail: `Esempi: ${negative.slice(0, 3).map((p) => `${p.name} (${p.stockQuantity})`).join(', ')}. Giacenze sotto zero = vendite oltre lo stock: canali non sincronizzati o backorder fuori controllo.`,
    });
  }

  const sellableAtZero = items.filter((p) => p.manageStock && p.stockStatus === 'instock' && (p.stockQuantity ?? 0) <= 0);
  if (sellableAtZero.length > 0) {
    findings.push({
      area, severity: 'critico',
      title: `${sellableAtZero.length} articoli "disponibili" con giacenza zero o negativa`,
      detail: `Esempi: ${sellableAtZero.slice(0, 3).map((p) => p.name).join(', ')}. Il sito li vende ma il magazzino non li ha: oversell garantito al prossimo ordine.`,
    });
  }
  const blockedWithStock = items.filter((p) => p.manageStock && p.stockStatus === 'outofstock' && (p.stockQuantity ?? 0) > 0);
  if (blockedWithStock.length > 0) {
    findings.push({
      area, severity: 'attenzione',
      title: `${blockedWithStock.length} articoli "esauriti" con merce a scaffale`,
      detail: `Esempi: ${blockedWithStock.slice(0, 3).map((p) => `${p.name} (${p.stockQuantity})`).join(', ')}. Vendite bloccate con giacenza positiva: fatturato lasciato sul tavolo.`,
    });
  }

  if (findings.length === 0 && items.length > 0) {
    findings.push({
      area, severity: 'ok',
      title: 'Giacenze tracciate e coerenti',
      detail: `${items.length} articoli analizzati (varianti incluse).`,
    });
  }
  return findings;
}

export function checkWooSkuQuality(products: WooAuditProduct[]): Finding[] {
  const area = 'Area 4 - Integrazione dei sistemi';
  const findings: Finding[] = [];
  const items = sellable(products);

  const missing = items.filter((p) => !p.sku || !p.sku.trim());
  if (missing.length > 0) {
    findings.push({
      area, severity: 'critico',
      title: `${missing.length} articoli senza SKU`,
      detail: `Esempi: ${[...new Set(missing.map((p) => p.name))].slice(0, 3).join(', ')}. Lo SKU è la chiave con cui eCommerce e gestionale si parlano: senza, l'integrazione non ha un aggancio affidabile.`,
    });
  }

  const bySku = new Map<string, number>();
  for (const p of items) {
    const sku = p.sku?.trim();
    if (sku) bySku.set(sku, (bySku.get(sku) ?? 0) + 1);
  }
  const dupes = [...bySku.entries()].filter(([, n]) => n > 1);
  if (dupes.length > 0) {
    findings.push({
      area, severity: 'critico',
      title: `${dupes.length} SKU duplicati`,
      detail: `Esempi: ${dupes.slice(0, 3).map(([sku, n]) => `${sku} (×${n})`).join(', ')}. Un ordine con SKU ambiguo finisce sull'articolo sbagliato in gestionale.`,
    });
  }

  if (findings.length === 0 && items.length > 0) {
    findings.push({
      area, severity: 'ok',
      title: 'SKU presenti e univoci',
      detail: 'La chiave di integrazione col gestionale è solida.',
    });
  }
  return findings;
}

export function checkWooWebhooks(webhooks: WooAuditWebhook[]): Finding[] {
  const area = 'Area 4 - Integrazione dei sistemi';
  if (webhooks.length === 0) {
    return [{
      area, severity: 'attenzione',
      title: 'Nessun webhook registrato',
      detail: 'Le integrazioni (se esistono) vanno a polling o a export manuali: maggiore latenza operativa. Consigliato webhook + polling di riconciliazione.',
    }];
  }
  const findings: Finding[] = [];

  const inactive = webhooks.filter((w) => w.status !== 'active');
  if (inactive.length > 0) {
    findings.push({
      area, severity: 'critico',
      title: `${inactive.length} webhook non attivi (disabilitati o in pausa)`,
      detail: `Esempi: ${inactive.slice(0, 3).map((w) => `"${w.name}" (${w.topic}, ${w.status})`).join(', ')}. WooCommerce spegne da solo i webhook dopo consegne fallite ripetute: le integrazioni collegate hanno smesso di ricevere eventi in silenzio.`,
    });
  }

  const activeOrderTopics = webhooks.filter((w) => w.status === 'active' && w.topic.startsWith('order.'));
  if (activeOrderTopics.length === 0) {
    findings.push({
      area, severity: 'critico',
      title: 'Nessun webhook ordini attivo',
      detail: 'Senza un webhook order.* attivo gli ordini non raggiungono le integrazioni in tempo reale.',
    });
  } else {
    findings.push({
      area, severity: 'ok',
      title: `${webhooks.length} webhook registrati, ${activeOrderTopics.length} attivi sugli ordini`,
      detail: `Topic attivi: ${[...new Set(webhooks.filter((w) => w.status === 'active').map((w) => w.topic))].slice(0, 6).join(', ')}.`,
    });
  }
  return findings;
}

import type { Finding } from './types.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Area 7 - Scalabilità (trend di volume). */
export function checkTrend(orders: { createdAt: string }[], now: Date): Finding[] {
  const area = 'Area 7 - Scalabilità';
  const half = now.getTime() - 15 * DAY_MS;
  const recent = orders.filter((o) => Date.parse(o.createdAt) >= half).length;
  const previous = orders.length - recent;
  if (previous === 0) return [];
  const growth = (recent - previous) / previous;
  if (growth > 0.3) {
    return [{
      area,
      severity: 'attenzione',
      title: `Volume in crescita rapida: +${(growth * 100).toFixed(0)}% negli ultimi 15 giorni`,
      detail: 'La domanda giusta non è "reggerà il sito?" ma "reggeranno i processi?": ogni attività manuale per ordine va moltiplicata per questo trend.',
    }];
  }
  return [{
    area,
    severity: 'ok',
    title: `Volume stabile (${previous} → ${recent} ordini per quindicina)`,
    detail: 'Trend gestibile: buon momento per sistemare le fondamenta prima del prossimo picco.',
  }];
}

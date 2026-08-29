export type Severity = 'ok' | 'attenzione' | 'critico';

export interface Finding {
  area: string;
  severity: Severity;
  title: string;
  detail: string;
}

export const SESSION_QUESTIONS: Record<string, string[]> = {
  'Area 3 - Automazione dei processi': [
    'Quali attività vengono fatte ogni giorno copiando dati da un sistema all\'altro?',
    'Esistono fogli Excel senza i quali l\'operatività si ferma?'
  ],
  'Area 5 - Customer care': [
    'Per rispondere a "dov\'è il mio ordine?" quanti sistemi deve aprire un operatore?'
  ],
  'Area 6 - Controllo del business': [
    'I KPI arrivano da report automatici o da estrazioni manuali?'
  ]
};

export function gmtToIso(raw: string | null | undefined): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  return s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s) ? s : `${s}Z`;
}

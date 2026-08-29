import { writeFileSync } from 'node:fs';
import pc from 'picocolors';
import { SESSION_QUESTIONS, type Finding } from './common/types.js';

export function printAndSaveReport(platform: string, shop: string, findings: Finding[], skipped: string[], now: Date): void {
  const badgeEmoji = (s: Finding['severity']) => (s === 'ok' ? '🟢' : s === 'attenzione' ? '🟡' : '🔴');
  const badgeColor = (s: Finding['severity'], text: string) => {
    if (s === 'ok') return pc.green(text);
    if (s === 'attenzione') return pc.yellow(text);
    return pc.red(pc.bold(text));
  };

  const byArea = new Map<string, Finding[]>();
  let critici = 0;
  let attenzioni = 0;

  for (const f of findings) {
    if (f.severity === 'critico') critici++;
    if (f.severity === 'attenzione') attenzioni++;
    byArea.set(f.area, [...(byArea.get(f.area) ?? []), f]);
  }

  console.log(`\n${pc.bold(pc.cyan('=== REPORT AUDIT OPERATIVO ==='))}`);
  console.log(`Piattaforma: ${pc.bold(platform)}`);
  console.log(`Store: ${pc.bold(shop)}`);
  console.log(`Generato il: ${now.toLocaleDateString('it-IT')}\n`);

  let md = `# Diagnosi operativa ${platform} - ${shop}\n\nGenerata il ${now.toLocaleDateString('it-IT')} · ultimi 30 giorni · sola lettura\n`;

  for (const [area, list] of [...byArea.entries()].sort()) {
    console.log(pc.bold(pc.blue(area)));
    md += `\n## ${area}\n\n`;
    for (const f of list) {
      console.log(`  ${badgeEmoji(f.severity)} ${badgeColor(f.severity, f.title)}`);
      console.log(`     ${pc.dim(f.detail)}`);
      md += `- ${badgeEmoji(f.severity)} **${f.title}** - ${f.detail}\n`;
    }
    console.log();
  }

  md += `\n## Da approfondire in sessione (non misurabile via API)\n`;
  for (const [area, questions] of Object.entries(SESSION_QUESTIONS)) {
    md += `\n**${area}**\n${questions.map((q) => `- ${q}`).join('\n')}\n`;
  }

  if (skipped.length) {
    console.log(pc.bold(pc.yellow('Sezioni saltate (permessi insufficienti):')));
    md += `\n## Sezioni saltate\n\n`;
    for (const s of skipped) {
      console.log(`  ⚠️  ${pc.yellow(s)}`);
      md += `- ⚠️ ${s}\n`;
    }
    console.log();
  }

  // Costo inazione (stima rudimentale base gravità e warning)
  const penalty = (critici * 500) + (attenzioni * 150);
  const cost = Math.max(1000, penalty); // Almeno 1000 euro/mese di inefficienza se ci sono problemi
  
  md += `\n## ⚠️ Costo dell'Inazione (Stima)\n\n`;
  md += `In base alle inefficienze rilevate (${critici} criticità, ${attenzioni} avvisi), stimiamo un "Costo dell'Inazione" di circa **€${(cost * 12).toLocaleString('it-IT')} / anno** in lavoro manuale perso, mancate vendite e ticket di assistenza.\n\n`;
  md += `Questo disordine operativo ti costa tempo e denaro ogni singolo giorno. PHABDEV ha un'infrastruttura d'integrazione pronta all'85% per risolvere questa emorragia in 15 giorni senza cambiare i tuoi sistemi esistenti.\n\n`;
  md += `👉 **[Prenota ora la tua Sessione di Analisi Operativa](https://calendly.com/phabdev/sessione-di-analisi-operativa)**\n`;
  md += `\n---\n*Report generato dallo strumento di diagnosi PHABDEV (phabdev-audit). Nessun dato è stato modificato.*\n`;

  writeFileSync('phabdev-audit-report.md', md);
  console.log(pc.bold(pc.green(`✅ Report salvato in phabdev-audit-report.md`)));
  console.log(pc.dim('Usa questo file come base per la Sessione di Analisi Operativa.'));
}

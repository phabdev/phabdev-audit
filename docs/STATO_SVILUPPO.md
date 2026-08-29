# Stato di sviluppo — phabdev-audit

> Documento vivo: aggiornarlo ad ogni release/hotfix, non ad ogni
> commit. Scopo: dare a qualunque sessione futura (Claude o altro) il
> contesto minimo per continuare senza dover ripercorrere tutta la
> cronologia.

## Versione corrente

- Ultima release: **v1.0.0** (Prima release)
- Release precedente: **v1.0.0** (Prima release)
- Ultimo hotfix: nessuno
- Semver: `x.y.z` — `y` per nuove feature (resetta `z`), `z` per
  bugfix, `x` per breaking change

## Architettura

Pacchetto CLI Node.js (v22+), TypeScript in Strict Mode, zero dipendenze runtime eccetto picocolors per output terminale. Struttura divisa in `src/shopify`, `src/woo`, e core testato con `node:test` in `test/`.

## Infrastruttura e servizi

> Solo nomi/URL/convenzioni — nessun secret qui, quelli restano sulle
> dashboard dei rispettivi servizi.

- **GitHub**: repo `phabdev/phabdev-audit`. Branch principali:
  `main` (produzione, taggato ad ogni release/hotfix),
  `develop` (integrazione). Convenzione branch: `feature/*`,
  `release/x.y.z`, `hotfix/*`, `docs/*` (Git Flow classico, vedi
  `CLAUDE.md`).
     DB, DNS/registrar, email, API terze), con le convenzioni e i
     nomi delle env var attese (nomi, non valori). -->

## Backlog e priorità

{{Puntatori alle issue/roadmap, o elenco sintetico. Aggiornare quando

## Incidenti noti e fix

{{Registro sintetico degli incidenti di produzione e delle lezioni

# Contributing — phabdev-audit

## Git Flow

Il progetto segue il Git Flow classico (Vincent Driessen):

- **`feature/*`** / **`fix/*`**: branch da `develop`, PR di ritorno in
  `develop`.
- **`release/x.y.z`**: branch da `develop` per preparare una versione
  (solo bugfix minori, bump versione — niente nuove feature). Al
  completamento: PR verso `main` (tag di versione), poi
  merge del branch di release anche in `develop`.
- **`hotfix/*`**: branch da `main` per bug critici già
  in produzione. Merge esplicito sia in `main` (nuovo
  tag patch) sia in `develop`.
- `main` rappresenta sempre lo stato in produzione,
  taggato ad ogni release/hotfix.

## Versionamento

Semantic Versioning `x.y.z`:
- `y` incrementa per nuove funzionalità (`z` torna a 0)
- `z` incrementa per bugfix (stessa `x.y`)
- `x` incrementa per cambi importanti/breaking (`y` e `z` tornano a 0)

## Commit

[Conventional Commits](https://www.conventionalcommits.org/), in
italiano: `<tipo>(<scope opzionale>): <descrizione>`.

Tipi principali: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`,
`style`, `ci`.

## Processo leggero per soli aggiornamenti di documentazione

Quando la modifica tocca **solo** file `.md` — nessun codice, nessuna
dipendenza, nessun build coinvolto — non serve il ciclo di release
completo:

1. Branch `docs/<nome-breve>` da `develop`.
2. Commit + push.
3. **PR diretta sia verso `main` sia verso `develop`**
   (due PR separate dallo stesso branch, in qualunque ordine),
   **senza** passare da un branch `release/x.y.z` intermedio.
4. **Nessun bump di versione, nessuna nuova voce di `CHANGELOG.md`**:
   un aggiornamento di roadmap/policy interna non è una release di
   prodotto.
5. Nessuna build/verifica necessaria (nessun codice toccato) — solo
   coerenza tra i file `.md` (link interni, riferimenti a
   issue/versioni ancora validi).

Se anche un solo file di codice è incluso nella modifica, si torna al
processo normale (feature/fix + release completa).

## Processo per una nuova funzionalità

     se il remoto è GitHub; con altri remoti, adattare o togliere. -->
1. **Issue GitHub prima del codice**: obiettivo, scope, decisioni
   prese, e conferma esplicita prima di iniziare l'implementazione.
2. Branch `feature/*` da `develop`. Referenziare il numero della issue
   (`#N`, senza "Closes") nel corpo della PR verso `develop`.
3. Implementazione + verifica completa (vedi sotto).
4. **Check di sicurezza prima della PR**: scoping permessi/queryset,
   validazione input, IDOR su azioni custom, rate limiting dove serve.
5. PR verso `develop` **senza** "Closes #N" nel corpo (il merge su
   `develop` non triggererebbe comunque l'auto-close).
6. Dopo il merge la issue resta aperta: verrà chiusa al rilascio.
7. Al rilascio: branch `release/x.y.z`, PR verso `main`
   con **"Closes #N" per ogni issue risolta** nel corpo — il merge sul
   branch di default chiude le issue automaticamente. Poi merge del
   branch di release in `develop`, tag sul commit di
   `main`.
8. **Aggiornare `CHANGELOG.md` e `docs/STATO_SVILUPPO.md`** come parte
   di ogni release/hotfix, non a posteriori "quando capita".

## Verifica prima di ogni commit/PR

`npm run build`, `npm test` ed esecuzione locale della CLI (`node dist/src/index.js --help`)

- Pulizia di tutti gli artefatti temporanei generati durante la
  verifica, **processi inclusi**: un server di verifica lasciato vivo
  può continuare a servire uno stato vecchio (es. SQLite tiene aperto
  l'inode di un DB cancellato) e produrre "difetti" che non esistono.

### Quando una verifica fallisce

**Capire dove sta il difetto prima di toccare il codice.** Una
verifica rossa può indicare un problema nell'applicazione o nello
strumento che la verifica, e la differenza non è mai ovvia. Regola:
**non si modifica il codice applicativo per far passare un
controllo** — prima si dimostra da che parte sta il difetto
(interrogando l'API direttamente, guardando i log, isolando il
livello), poi si corregge quello che è davvero rotto.

### Cosa i test unitari non prendono

Per modifiche che attraversano più livelli i test unitari non bastano,
perché tipicamente mockano proprio il pezzo in mezzo: serve almeno un
giro completo del flusso reale prima di dichiarare la modifica pronta.

## Uso efficiente dell'API GitHub

- **"Closes #N" solo nella PR di release verso `main`**
  (mai nella PR feature/fix verso `develop`).
- **Non verificare un'azione appena eseguita con una chiamata di
  lettura separata** se lo strumento ha già confermato l'esito.
- **Non ritentare a raffica** su un rate limit: aspettare, o
  continuare con lavoro locale nel frattempo.
- Raggruppare le chiamate GitHub per fase.

## Note operative sulla sandbox di sviluppo

- La creazione di tag git e la cancellazione di branch remoti sono
  bloccate dal proxy dell'ambiente remoto — vanno sempre consegnate
  all'utente come comandi da eseguire in locale, **con lo SHA
  esplicito del commit** e precedute da `git fetch origin
  main` (senza fetch, `git tag -a <versione> <sha>`
  fallisce con "not a valid object name" se il commit non è nel clone
  locale dell'utente).

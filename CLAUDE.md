# phabdev-audit

Nome del prodotto: **phabdev-audit** (dominio `N/A`). Il
repository mantiene il nome `phabdev-audit` — non va rinominato senza
richiesta esplicita, per non rompere URL/integrazioni esterne.

## Git Flow

Questo progetto segue il Git Flow classico (Vincent Driessen):

> ⚠️ Eccezione: le modifiche **100% documentazione** (soli file `.md`)
> non richiedono release — vedi "Processo leggero per soli
> aggiornamenti di documentazione" in `CONTRIBUTING.md`: branch
> `docs/*` da `develop`, PR dirette sia verso `main` sia
> verso `develop`, nessun bump di versione né voce di changelog.

- **feature/***: branch da `develop`, PR/merge di ritorno in `develop`.
  I nomi dei branch seguono **sempre** queste convenzioni (`feature/*`,
  `release/x.y.z`, `hotfix/*`, `docs/*`), anche quando l'ambiente di
  lavoro (es. sessione remota Claude) propone un nome di branch
  proprio tipo `claude/*`: quel nome non va usato per il lavoro vero.
- **release/***: branch da `develop` per preparare una nuova versione
  (solo bugfix minori, bump versione, changelog — niente nuove
  feature); al completamento, merge sia in `main` (con
  tag di versione) sia in `develop`
- **hotfix/***: branch da `main` per bug critici in
  produzione; merge esplicito sia in `main` (nuovo tag
  patch) sia in `develop`
- `main` rappresenta sempre lo stato in produzione,
  taggato ad ogni release/hotfix

### Comandi di fine release

Se l'ambiente di lavoro dell'assistente non può eseguire il push dei
tag o la cancellazione dei ref remoti (tipico delle sessioni remote
con proxy git: verificarlo alla prima occasione, non assumerlo), quei
comandi vanno consegnati all'utente da lanciare in locale.

I blocchi di comandi destinati al copia-incolla vanno consegnati
**puliti, senza commenti dentro**: le spiegazioni (quale SHA è stato
scelto e perché, cosa fa ogni passo) stanno nel testo prima o dopo il
blocco, mai tra i comandi. Il blocco di fine release è:

```bash
git fetch origin main
git tag -a vX.Y.Z <sha> -m "Release vX.Y.Z"
git push origin vX.Y.Z
git ls-remote --tags origin | grep vX.Y.Z
git push origin --delete <branch-di-lavoro> release/X.Y.Z
git fetch --prune origin
git checkout develop && git pull && git checkout main && git pull
```

dove `<sha>` è il commit di merge della PR release/X.Y.Z su
`main` (indicato esplicitamente nel testo che accompagna
il blocco); il `ls-remote` in mezzo serve come conferma visiva del tag
appena creato.

Regole per l'assistente quando consegna questo blocco:

- **Sempre lo SHA esplicito**, mai un segnaposto: va indicato il
  commit esatto da taggare, dopo averlo verificato su
  `origin/main`.
- **Controllare prima lo stato remoto** (`git ls-remote --tags origin`,
  `git ls-remote --heads origin`): se il tag esiste già o i branch
  sono già stati cancellati, i relativi comandi vanno omessi, così
  l'utente non riceve comandi destinati a fallire.
- **Il blocco deve riportare dove si era**: mai lasciare l'utente su
  un branch che non ha scelto. Il `git pull` finale va **senza remoto
  esplicito**: ogni branch ha già il proprio upstream configurato.
- Il blocco va riproposto a **ogni** release, non solo la prima volta.

## Stato remoto: non fidarsi di quello locale

In sessione remota il clone può essere **shallow** e i ref locali
fermi a prima. Ogni affermazione sullo stato del repository va
verificata sul remoto, mai dedotta da comandi che leggono solo il
locale:

- `git ls-remote` per branch e tag, che interroga il remoto;
- `git fetch --unshallow` prima di qualunque ragionamento sulla
  storia: `git merge-base --is-ancestor` fallisce silenziosamente se
  il commit non è nel clone, e il risultato sembra un "no" legittimo;
- per dire che un branch è cancellabile: `git rev-list --count
  origin/main..origin/<branch>` uguale a zero, non
  l'impressione che sia stato mergiato.

## Prima di scegliere un numero di versione

Fra l'inizio di un lavoro e il suo rilascio possono essere uscite
altre versioni (altri contributori, altre sessioni). Prima di
preparare una release vanno controllati sul remoto:

- l'ultima versione realmente rilasciata (in cima al `CHANGELOG.md`
  di `origin/main`, non a quello che si ricorda);
- l'esistenza di un `release/X.Y.Z` già aperto da altri. Se c'è,
  **non ci si scrive sopra**: si prende il numero successivo.

Che un ref non sia stato creato dalla sessione corrente è la norma,
non un'anomalia: quel che conta è la coerenza dello stato — ogni tag
su un commit di `main`, `main` e `develop`
non divergenti, nessun branch orfano — non la paternità.

## Dove vive la versione

nel `CHANGELOG.md` come fonte di verità del prodotto. Il campo `version` del `package.json` si allinea al CHANGELOG (usare `npm version x.y.z --no-git-tag-version` nel branch di release)

## Commit messages

Usare i [Conventional Commits](https://www.conventionalcommits.org/):
`<tipo>(<scope opzionale>): <descrizione>`, in italiano. Tipi
principali: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`,
`style`, `ci`.

# phabdev-audit

Strumento CLI di **diagnosi operativa read-only** per Shopify e WooCommerce, progettato per individuare colli di bottiglia, disallineamenti di magazzino e ordini bloccati senza toccare i dati. 

Nato dall'esperienza sul campo PHABDEV per le Sessioni di Analisi Operativa.

## Installazione ed Uso

Puoi eseguire il comando "al volo" tramite `npx` senza installarlo globalmente:

```bash
npx phabdev-audit shopify --shop store.myshopify.com --token shpat_...
```

Oppure per WooCommerce:

```bash
npx phabdev-audit woocommerce --url https://miosito.it --key ck_... --secret cs_...
```

In alternativa, puoi creare un file `.env` locale in cui esporre le variabili (`SHOPIFY_SHOP`, `SHOPIFY_ADMIN_TOKEN`, oppure `WOO_BASE_URL`, `WOO_CONSUMER_KEY`, `WOO_CONSUMER_SECRET`) ed omettere gli argomenti a riga di comando.

## Caratteristiche

- **Zero dipendenze pesanti**: gira su Node.js 22+ in puro ESM usando solo la `fetch` nativa.
- **Sola lettura garantita**: non esegue operazioni di scrittura (POST/PUT/DELETE).
- **Degradazione controllata**: tollera la mancanza di permessi (es. se manca `read_inventory` non va in crash ma salta l'area con un avviso formattato).
- **Redazione Dati Personali**: ogni ID ordine o variante stampato viene analizzato e mascherato se assomiglia a un'e-mail (es. in setup errati di Woo).

## Output

Genera sempre **due risultati**:
1. Un report visivo a terminale (colorato per gravità: Verde, Giallo, Rosso).
2. Un report Markdown `phabdev-audit-report.md` pronto per la consegna o archiviazione, completo di **calcolo stimato del Costo dell'Inazione**.

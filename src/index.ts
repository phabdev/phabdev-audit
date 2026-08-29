#!/usr/bin/env node
import { parseArgs } from 'node:util';
import pc from 'picocolors';
import { fetchShopifyData } from './shopify/fetch.js';
import { fetchWooData } from './woo/fetch.js';
import { printAndSaveReport } from './report.js';

// Try to load .env file manually if exists
try {
  const { loadEnvFile } = await import('node:process');
  loadEnvFile();
} catch (err) {
  // Ignore, maybe no .env file
}

function showHelp(): never {
  console.log(`
${pc.cyan(pc.bold('phabdev-audit'))} - Strumento di diagnosi operativa read-only per eCommerce

${pc.bold('USO:')}
  npx phabdev-audit <piattaforma> [opzioni]

${pc.bold('PIATTAFORME E OPZIONI:')}

  ${pc.yellow('shopify')}
    Esegue l'audit su uno store Shopify.
    Opzioni (o tramite variabili d'ambiente .env):
      --shop <store.myshopify.com>     (o SHOPIFY_SHOP)
      --token <shpat_...>              (o SHOPIFY_ADMIN_TOKEN)

  ${pc.yellow('woocommerce')}
    Esegue l'audit su uno store WooCommerce.
    Opzioni (o tramite variabili d'ambiente .env):
      --url <url_sito>                 (o WOO_BASE_URL)
      --key <ck_...>                   (o WOO_CONSUMER_KEY)
      --secret <cs_...>                (o WOO_CONSUMER_SECRET)

${pc.bold('ESEMPI:')}
  $ npx phabdev-audit shopify --shop mystore.myshopify.com --token shpat_12345
  $ npx phabdev-audit woocommerce --url https://shop.com --key ck_123 --secret cs_456
  
  Oppure, con le variabili nel file .env:
  $ npx phabdev-audit shopify
`);
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
  showHelp();
}

const platform = args[0];
const optionsArgs = args.slice(1);

async function run() {
  try {
    if (platform === 'shopify') {
      const { values } = parseArgs({
        args: optionsArgs,
        options: {
          shop: { type: 'string' },
          token: { type: 'string' },
        },
      });

      const shop = values.shop || process.env.SHOPIFY_SHOP;
      const token = values.token || process.env.SHOPIFY_ADMIN_TOKEN;

      if (!shop || !token) {
        console.error(pc.red('Errore: Credenziali Shopify mancanti (shop e token richiesti).'));
        showHelp();
      }

      console.log(`\n${pc.cyan('Avvio audit Shopify per:')} ${shop}...`);
      const { findings, skipped, now } = await fetchShopifyData(shop, token);
      printAndSaveReport('Shopify', shop, findings, skipped, now);
      
    } else if (platform === 'woocommerce' || platform === 'woo') {
      const { values } = parseArgs({
        args: optionsArgs,
        options: {
          url: { type: 'string' },
          key: { type: 'string' },
          secret: { type: 'string' },
        },
      });

      const url = values.url || process.env.WOO_BASE_URL;
      const key = values.key || process.env.WOO_CONSUMER_KEY;
      const secret = values.secret || process.env.WOO_CONSUMER_SECRET;

      if (!url || !key || !secret) {
        console.error(pc.red('Errore: Credenziali WooCommerce mancanti (url, key e secret richiesti).'));
        showHelp();
      }

      console.log(`\n${pc.cyan('Avvio audit WooCommerce per:')} ${url}...`);
      const { findings, skipped, now } = await fetchWooData(url, key, secret);
      printAndSaveReport('WooCommerce', url, findings, skipped, now);

    } else {
      console.error(pc.red(`Errore: Piattaforma "${platform}" non supportata.`));
      showHelp();
    }
  } catch (err) {
    console.error(pc.red(`\nErrore imprevisto durante l'esecuzione:`));
    console.error(err);
    process.exit(1);
  }
}

run();

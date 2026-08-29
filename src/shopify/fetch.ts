import type { Finding } from '../common/types.js';
import { checkAppInstall, checkFulfillmentLag, checkInventory, checkOrders, checkSkuQuality, checkWebhooks, type AuditAppInstall, type AuditOrder, type AuditVariant, type AuditWebhook } from './checks.js';
import { checkTrend } from '../common/checks.js';

interface Edge<T> { node: T }
interface Page<T> { pageInfo: { hasNextPage: boolean; endCursor: string | null }; edges: Edge<T>[] }

async function gql<T>(shop: string, token: string, apiVersion: string, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`https://${shop}/admin/api/${apiVersion}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join('; '));
  return body.data as T;
}

export async function fetchShopifyData(shop: string, token: string, apiVersion = '2024-01') {
  const now = new Date();
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const findings: Finding[] = [];
  const skipped: string[] = [];

  try {
    const orders: AuditOrder[] = [];
    let after: string | null = null;
    do {
      const data: any = await gql(shop, token, apiVersion,
        `query($search: String!, $after: String) {
          orders(first: 100, query: $search, after: $after) {
            pageInfo { hasNextPage endCursor }
            edges { node {
              name
              createdAt
              cancelledAt
              displayFulfillmentStatus
              fulfillments(first: 10) { edges { node { createdAt } } }
            } }
          }
        }`,
        { search: `created_at:>'${since}'`, after }
      );
      orders.push(...data.orders.edges.map(({ node }: any) => ({
        name: node.name,
        createdAt: node.createdAt,
        cancelledAt: node.cancelledAt,
        displayFulfillmentStatus: node.displayFulfillmentStatus,
        fulfilledAt: node.fulfillments.edges
          .map((f: any) => f.node.createdAt)
          .filter(Boolean)
          .sort()[0] ?? null,
      })));
      after = data.orders.pageInfo.hasNextPage ? data.orders.pageInfo.endCursor : null;
    } while (after && orders.length < 2000);
    findings.push(...checkOrders(orders, now), ...checkTrend(orders, now), ...checkFulfillmentLag(orders));
  } catch (err) {
    skipped.push(`Ordini non analizzabili (${err instanceof Error ? err.message : err}) - verificare lo scope read_orders.`);
  }

  try {
    const variants: AuditVariant[] = [];
    let after: string | null = null;
    do {
      const data: any = await gql(shop, token, apiVersion,
        `query($after: String) {
          products(first: 50, after: $after) {
            pageInfo { hasNextPage endCursor }
            edges { node {
              title
              variants(first: 100) { pageInfo { hasNextPage endCursor } edges { node { sku inventoryQuantity inventoryItem { tracked } } } }
            } }
          }
        }`,
        { after }
      );
      for (const { node } of data.products.edges) {
        variants.push(...node.variants.edges.map(({ node: v }: any) => ({
          productTitle: node.title,
          sku: v.sku,
          inventoryQuantity: v.inventoryQuantity,
          tracked: v.inventoryItem?.tracked ?? false,
        })));
      }
      after = data.products.pageInfo.hasNextPage ? data.products.pageInfo.endCursor : null;
    } while (after && variants.length < 5000);
    findings.push(...checkInventory(variants), ...checkSkuQuality(variants));
  } catch (err) {
    skipped.push(`Catalogo non analizzabile (${err instanceof Error ? err.message : err}) - aggiungere gli scope read_products e read_inventory.`);
  }

  try {
    const data: any = await gql(shop, token, apiVersion,
      `query {
        webhookSubscriptions(first: 100) {
          pageInfo { hasNextPage endCursor }
          edges {
            node {
              topic
              endpoint {
                __typename
                ... on WebhookHttpEndpoint { callbackUrl }
                ... on WebhookEventBridgeEndpoint { arn }
                ... on WebhookPubSubEndpoint { pubSubProject pubSubTopic }
              }
            }
          }
        }
      }`
    );
    const webhooks = data.webhookSubscriptions.edges.map(({ node }: any) => {
      const endpoint = node.endpoint.__typename === 'WebhookHttpEndpoint'
        ? node.endpoint.callbackUrl
        : node.endpoint.__typename === 'WebhookEventBridgeEndpoint'
          ? node.endpoint.arn
          : `${node.endpoint.pubSubProject}/${node.endpoint.pubSubTopic}`;
      return { topic: node.topic, endpoint };
    });
    findings.push(...checkWebhooks(webhooks));
  } catch (err) {
    skipped.push(`Webhook non analizzabili (${err instanceof Error ? err.message : err}) - verificare i permessi dell'app Shopify.`);
  }

  try {
    const data: any = await gql(shop, token, apiVersion,
      `query {
        shop { name }
        currentAppInstallation {
          accessScopes { handle }
        }
      }`
    );
    const app: AuditAppInstall = {
      appName: `${data.shop.name} (current app)`,
      accessScopes: data.currentAppInstallation?.accessScopes.map((s: any) => s.handle) ?? [],
    };
    findings.push(...checkAppInstall(app));
  } catch (err) {
    skipped.push(`Installazione app non analizzabile (${err instanceof Error ? err.message : err}) - verificare i permessi GraphQL dello store.`);
  }

  return { findings, skipped, now };
}

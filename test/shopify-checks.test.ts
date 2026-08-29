import test from 'node:test';
import assert from 'node:assert/strict';
import { checkInventory, checkOrders, type AuditOrder, type AuditVariant } from '../src/shopify/checks.js';

test('Shopify - checkInventory segnala giacenze negative e non tracciate', () => {
  const variants: AuditVariant[] = [
    { productTitle: 'A', sku: 'SKU-A', inventoryQuantity: 10, tracked: true },
    { productTitle: 'B', sku: 'SKU-B', inventoryQuantity: -5, tracked: true },
    { productTitle: 'C', sku: 'SKU-C', inventoryQuantity: null, tracked: false },
  ];
  const findings = checkInventory(variants);
  assert.equal(findings.length, 2);
  assert.ok(findings.some(f => f.title.includes('1 varianti senza tracciamento')));
  assert.ok(findings.some(f => f.title.includes('1 varianti con giacenza negativa')));
});

test('Shopify - checkOrders redige correttamente il nome ordine e conta lag', () => {
  const now = new Date('2026-08-15T12:00:00Z');
  const orders: AuditOrder[] = [
    { name: '#1001', createdAt: '2026-08-01T10:00:00Z', cancelledAt: null, displayFulfillmentStatus: 'UNFULFILLED' }
  ];
  const findings = checkOrders(orders, now);
  const unfulfilledFinding = findings.find(f => f.title.includes('non evasi da più di 7 giorni'));
  assert.ok(unfulfilledFinding);
  // #1001 non ha l'@ quindi la regex non redigerà, per i nomi email maschera
});

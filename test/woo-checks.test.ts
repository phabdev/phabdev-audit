import test from 'node:test';
import assert from 'node:assert/strict';
import { checkWooStuckOrders, checkWooInventory, type WooAuditOrder, type WooAuditProduct } from '../src/woo/checks.js';

test('WooCommerce - checkWooStuckOrders segnala ordini fermi', () => {
  const now = new Date('2026-08-15T12:00:00Z');
  const orders: WooAuditOrder[] = [
    { id: 1, number: '1001', status: 'pending', createdAt: '2026-08-10T12:00:00Z', paidAt: null, completedAt: null, total: 10 },
    { id: 2, number: 'fabrizio@example.com', status: 'on-hold', createdAt: '2026-08-10T12:00:00Z', paidAt: null, completedAt: null, total: 20 },
  ];
  const findings = checkWooStuckOrders(orders, now);
  assert.ok(findings.some(f => f.title.includes('1 ordini in "pending" da più di 48 ore')));
  const onHoldFinding = findings.find(f => f.title.includes('in "on-hold" da più di 72 ore'));
  assert.ok(onHoldFinding);
  // Redaction check
  assert.ok(onHoldFinding?.detail.includes('***@example.com'));
});

test('WooCommerce - checkWooInventory segnala anomalie stockStatus', () => {
  const products: WooAuditProduct[] = [
    { id: 1, name: 'A', sku: 'SKU-A', type: 'simple', manageStock: true, stockQuantity: 0, stockStatus: 'instock' },
  ];
  const findings = checkWooInventory(products);
  assert.ok(findings.some(f => f.title.includes('"disponibili" con giacenza zero o negativa')));
});

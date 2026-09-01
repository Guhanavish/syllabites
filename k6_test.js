/**
 * k6 Load Test - Food Court (Syllabites) - Optimized 1:1 Throughput
 * Usage: k6 run k6_test.js --vus 20 --duration 10m
 * Or via test_traffic.mjs wrapper with Realtime pool simulation
 */
import http from 'k6/http';
import { sleep, check } from 'k6';
import { Trend, Counter } from 'k6/metrics';

const BASE_URL = __ENV.TARGET_URL || 'https://syllabites.vercel.app';

export const options = {
  scenarios: {
    boys_senders: { executor: 'constant-vus', vus: 5, duration: '10m', exec: 'boysSenders' },
    boys_receivers: { executor: 'constant-vus', vus: 5, duration: '10m', exec: 'boysReceivers' },
    girls_senders: { executor: 'constant-vus', vus: 5, duration: '10m', exec: 'girlsSenders' },
    girls_receivers: { executor: 'constant-vus', vus: 5, duration: '10m', exec: 'girlsReceivers' },
  },
  thresholds: {
    http_req_failed: ['rate<0.03'],
    http_req_duration: ['p(95)<800'],
  },
};

const placeLatency = new Trend('place_order_latency');
const boardLatency = new Trend('board_latency');
const statusLatency = new Trend('status_latency');
const idempotentSaves = new Counter('idempotent_saves');

// Shared pool simulated via global array + periodic board sync
// In k6, use a simple in-memory queue seeded by board polling
let boysPool = [];
let girlsPool = [];
let lastBoardSync = 0;

function getBoard(section) {
  const t0 = Date.now();
  const res = http.get(`${BASE_URL}/api/board?section=${section}`);
  boardLatency.add(Date.now() - t0);
  if (res.status === 200) {
    try {
      const data = JSON.parse(res.body);
      const pool = section === 'boys' ? boysPool : girlsPool;
      const known = new Set(pool.map(o => o.id));
      for (const o of (data.active || [])) {
        if (!known.has(o.id)) pool.push({ id: o.id, tokenNo: o.tokenNo });
      }
    } catch {}
  }
  return res;
}

function placeOrder(section) {
  const t0 = Date.now();
  const res = http.post(`${BASE_URL}/api/orders/place`, JSON.stringify({
    section: section,
    clientToken: `k6_${section}_${__VU}_${Date.now()}_${Math.random()}`,
    items: [{ itemId: 9, qty: 1 }],
  }), { headers: { 'Content-Type': 'application/json' } });
  placeLatency.add(Date.now() - t0);
  if (res.status === 200 || res.status === 201) {
    try {
      const order = JSON.parse(res.body);
      const pool = section === 'boys' ? boysPool : girlsPool;
      pool.push({ id: order.id, tokenNo: order.tokenNo });
    } catch {}
  }
  check(res, { 'place 2xx': (r) => r.status === 200 || r.status === 201 });
}

function serveOrder(section) {
  const pool = section === 'boys' ? boysPool : girlsPool;
  if (pool.length === 0) {
    // Background sync every 10s (realtime is primary)
    if (Date.now() - lastBoardSync > 10000) {
      getBoard('boys');
      getBoard('girls');
      lastBoardSync = Date.now();
    } else {
      sleep(0.2);
    }
    return;
  }
  const order = pool.shift();
  const t0 = Date.now();
  const res = http.post(`${BASE_URL}/api/orders/status`, JSON.stringify({ id: order.id, status: 'completed' }), { headers: { 'Content-Type': 'application/json' } });
  statusLatency.add(Date.now() - t0);
  if (res.status === 200) {
    try {
      const data = JSON.parse(res.body);
      if (data.alreadyCompleted) idempotentSaves.add(1);
    } catch {}
  }
  check(res, { 'status 200 (idempotent)': (r) => r.status === 200 });
}

export function boysSenders() { placeOrder('boys'); sleep(0.4 + Math.random()*0.4); }
export function girlsSenders() { placeOrder('girls'); sleep(0.4 + Math.random()*0.4); }
export function boysReceivers() { serveOrder('boys'); sleep(0.3 + Math.random()*0.3); }
export function girlsReceivers() { serveOrder('girls'); sleep(0.3 + Math.random()*0.3); }

export function handleSummary(data) {
  return { stdout: JSON.stringify({ idempotentSaves: data.metrics.idempotent_saves?.values.count || 0 }, null, 2) };
}

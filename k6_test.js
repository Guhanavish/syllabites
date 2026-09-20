/**
 * Food Court (Syllabites) 8-Device Intensive 30-Minute k6 Load Test
 * 
 * 8 Devices configured across 4 dedicated concurrent scenarios:
 *  - boys_senders:    2 VUs (Boys customer devices continuously placing orders)
 *  - boys_receivers:  2 VUs (Boys counter staff devices continuously serving orders)
 *  - girls_senders:   2 VUs (Girls customer devices continuously placing orders)
 *  - girls_receivers: 2 VUs (Girls counter staff devices continuously serving orders)
 * 
 * Run with k6:
 *   k6 run k6_test.js
 */

import http from 'k6/http';
import { sleep, check } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const TARGET_URL = __ENV.TARGET || 'https://syllabites.vercel.app';
const TEST_DURATION = __ENV.DURATION || '30m';

// Custom k6 Metrics
export const ordersPlacedBoys = new Counter('orders_placed_boys');
export const ordersPlacedGirls = new Counter('orders_placed_girls');
export const ordersCompletedBoys = new Counter('orders_completed_boys');
export const ordersCompletedGirls = new Counter('orders_completed_girls');
export const orderPlaceErrors = new Counter('orders_place_errors');
export const orderCompleteErrors = new Counter('orders_complete_errors');

export const placeLatency = new Trend('order_place_latency');
export const boardLatency = new Trend('board_get_latency');
export const statusLatency = new Trend('order_status_latency');

export const options = {
  scenarios: {
    boys_senders: {
      executor: 'constant-vus',
      vus: 2,
      duration: TEST_DURATION,
      exec: 'boysSenders',
      gracefulStop: '10s',
    },
    boys_receivers: {
      executor: 'constant-vus',
      vus: 2,
      duration: TEST_DURATION,
      exec: 'boysReceivers',
      gracefulStop: '10s',
    },
    girls_senders: {
      executor: 'constant-vus',
      vus: 2,
      duration: TEST_DURATION,
      exec: 'girlsSenders',
      gracefulStop: '10s',
    },
    girls_receivers: {
      executor: 'constant-vus',
      vus: 2,
      duration: TEST_DURATION,
      exec: 'girlsReceivers',
      gracefulStop: '10s',
    },
  },
  dns: {
    ttl: '5m',
    select: 'first',
  },
  noConnectionReuse: false,
  thresholds: {
    http_req_failed: ['rate<0.15'], // Allow for high-concurrency 400 race collisions
    http_req_duration: ['p(95)<3000'],
  },
  summaryTrendStats: ['min', 'med', 'avg', 'p(90)', 'p(95)', 'max'],
};

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': 'k6-8Device-LoadTester/1.0',
};

// High-stock item IDs in Supabase
const ITEM_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];

function placeOrder(section, secTag, prefix) {
  const itemId = ITEM_IDS[Math.floor(Math.random() * ITEM_IDS.length)];
  const clientToken = `k6_${section}_vu${__VU}_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;

  const payload = JSON.stringify({
    section,
    clientToken,
    items: [{ itemId, qty: 1 }],
  });

  const res = http.post(`${TARGET_URL}/api/orders/place`, payload, {
    headers: JSON_HEADERS,
    tags: { name: 'POST /api/orders/place' },
  });
  placeLatency.add(res.timings.duration);

  const passed = check(res, { 'order placed 201': (r) => r.status === 201 });
  if (passed) {
    if (section === 'boys') ordersPlacedBoys.add(1);
    else ordersPlacedGirls.add(1);

    try {
      const data = JSON.parse(res.body);
      const tokenNo = data.tokenNo || data.id;
      console.log(`${secTag} placed order ${prefix}${tokenNo}`);
    } catch (e) {}
  } else {
    orderPlaceErrors.add(1);
    if (res.status !== 201) {
      console.log(`WARN: ${secTag} place order failed with HTTP ${res.status}`);
    }
  }

  // Senders: 500ms - 800ms (continuous high-throughput order flow)
  sleep(Math.random() * 0.3 + 0.5);
}

function completeOrder(section, secTag, prefix) {
  const boardRes = http.get(`${TARGET_URL}/api/board?section=${section}`, {
    headers: JSON_HEADERS,
    tags: { name: 'GET /api/board' },
  });
  boardLatency.add(boardRes.timings.duration);

  check(boardRes, { 'board 200': (r) => r.status === 200 });

  if (boardRes.status === 200) {
    try {
      const board = JSON.parse(boardRes.body);
      if (board.active && Array.isArray(board.active) && board.active.length > 0) {
        // Pick active order
        const targetOrder = board.active[Math.floor(Math.random() * Math.min(board.active.length, 3))];
        if (targetOrder && targetOrder.id) {
          const completePayload = JSON.stringify({ id: targetOrder.id, status: 'completed' });
          const completeRes = http.post(`${TARGET_URL}/api/orders/status`, completePayload, {
            headers: JSON_HEADERS,
            tags: { name: 'POST /api/orders/status' },
          });
          statusLatency.add(completeRes.timings.duration);

          if (completeRes.status === 200) {
            if (section === 'boys') ordersCompletedBoys.add(1);
            else ordersCompletedGirls.add(1);

            const tokenNo = targetOrder.tokenNo || targetOrder.id;
            console.log(`${secTag} completed order ${prefix}${tokenNo}`);
          } else if (completeRes.status !== 400) {
            orderCompleteErrors.add(1);
          }
        }
      }
    } catch (e) {}
  }

  // Receivers: 350ms - 550ms (responsive clearing of queues)
  sleep(Math.random() * 0.2 + 0.35);
}

export function boysSenders() { placeOrder('boys', 'BOYS', 'B'); }
export function boysReceivers() { completeOrder('boys', 'BOYS', 'B'); }
export function girlsSenders() { placeOrder('girls', 'GIRLS', 'G'); }
export function girlsReceivers() { completeOrder('girls', 'GIRLS', 'G'); }

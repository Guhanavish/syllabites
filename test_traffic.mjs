/**
 * Food Court (Syllabites) 30-Minute Endurance & Load Test Simulator
 * 
 * Devices Configuration:
 *  - 👦 Boys Counter (10 Devices):
 *      • 5 x Order Senders
 *      • 5 x Order Receivers
 *  - 👧 Girls Counter (10 Devices):
 *      • 5 x Order Senders
 *      • 5 x Order Receivers
 * Total: 20 Devices (10 Senders + 10 Receivers)
 * 
 * Usage:
 *   node test_traffic.mjs --duration 30m
 */

import { performance } from 'node:perf_hooks';

// --- Parse CLI Arguments ---
const args = process.argv.slice(2);
function getArg(keys, defaultVal) {
  for (let i = 0; i < args.length; i++) {
    for (const key of keys) {
      if (args[i] === key && args[i + 1] !== undefined) return args[i + 1];
      if (args[i].startsWith(key + '=')) return args[i].split('=')[1];
    }
  }
  return defaultVal;
}

function parseDuration(str) {
  const match = String(str).match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h)?$/i);
  if (!match) return 1800000; // default 30m
  const val = parseFloat(match[1]);
  const unit = (match[2] || 's').toLowerCase();
  if (unit === 'ms') return val;
  if (unit === 's') return val * 1000;
  if (unit === 'm') return val * 60 * 1000;
  if (unit === 'h') return val * 3600 * 1000;
  return 1800000;
}

const TARGET_URL = (getArg(['--target', '-u', '--url'], 'https://syllabites.vercel.app')).replace(/\/+$/, '');
const DURATION_MS = parseDuration(getArg(['--duration', '-d', '-t'], '30m'));
const THINK_TIME_MS = Math.max(80, parseInt(getArg(['--pace', '-p'], '500'), 10));

// Concurrency setup: 20 Devices (10 Senders + 10 Receivers)
const BOYS_SENDERS = Math.max(1, parseInt(getArg(['--senders-boys', '--sb'], '5'), 10));
const BOYS_RECEIVERS = Math.max(1, parseInt(getArg(['--receivers-boys', '--rb'], '5'), 10));
const GIRLS_SENDERS = Math.max(1, parseInt(getArg(['--senders-girls', '--sg'], '5'), 10));
const GIRLS_RECEIVERS = Math.max(1, parseInt(getArg(['--receivers-girls', '--rg'], '5'), 10));

const TOTAL_SENDERS = BOYS_SENDERS + GIRLS_SENDERS;     // 10
const TOTAL_RECEIVERS = BOYS_RECEIVERS + GIRLS_RECEIVERS; // 10
const TOTAL_VUS = TOTAL_SENDERS + TOTAL_RECEIVERS;       // 20

const startTime = Date.now();
const endTime = startTime + DURATION_MS;

// ANSI colors
const C = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
};

// Global Metrics Tracker
const metrics = {
  requests: 0,
  success: 0,
  failures: 0,
  ordersPlaced: { boys: 0, girls: 0, total: 0 },
  ordersCompleted: { boys: 0, girls: 0, total: 0 },
  idempotentAlreadyServed: 0,
  statusCodes: {},
  latencies: [],
  endpointStats: {
    placeOrder: { count: 0, errors: 0, latencies: [] },
    getBoard: { count: 0, errors: 0, latencies: [] },
    completeOrder: { count: 0, errors: 0, latencies: [] },
  }
};

const activeOrderPool = {
  boys: [],
  girls: [],
};

const inFlightCompleting = new Set();
let menuItems = [];

// Helper: HTTP Request with timing
async function timedFetch(url, options = {}, endpointKey = '') {
  const t0 = performance.now();
  metrics.requests++;
  let status = 0;
  let data = null;
  let ok = false;

  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'FoodCourt30MinTester/1.0',
        ...(options.headers || {}),
      },
    });
    status = res.status;
    const dur = performance.now() - t0;
    metrics.latencies.push(dur);
    if (endpointKey && metrics.endpointStats[endpointKey]) {
      metrics.endpointStats[endpointKey].count++;
      metrics.endpointStats[endpointKey].latencies.push(dur);
    }
    metrics.statusCodes[status] = (metrics.statusCodes[status] || 0) + 1;

    if (res.ok) {
      metrics.success++;
      ok = true;
    } else {
      metrics.failures++;
      if (endpointKey && metrics.endpointStats[endpointKey]) {
        metrics.endpointStats[endpointKey].errors++;
      }
    }
    data = await res.json().catch(() => null);
    return { ok, status, data, duration: dur };
  } catch (err) {
    const dur = performance.now() - t0;
    metrics.failures++;
    metrics.statusCodes['ERR'] = (metrics.statusCodes['ERR'] || 0) + 1;
    if (endpointKey && metrics.endpointStats[endpointKey]) {
      metrics.endpointStats[endpointKey].count++;
      metrics.endpointStats[endpointKey].errors++;
      metrics.endpointStats[endpointKey].latencies.push(dur);
    }
    return { ok: false, status: 0, error: err.message, duration: dur };
  }
}

function getLogTimestamp() {
  const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
  const m = Math.floor(elapsedSec / 60);
  const s = elapsedSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDurationShort(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}m${String(s).padStart(2, '0')}s`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fetch in-stock menu items from Supabase
async function refreshMenu() {
  try {
    const supabaseUrl = 'https://azfwvoeolfziyohmiuwo.supabase.co';
    const supabaseKey = 'sb_publishable_9BYsicNZuRdf0QOyYFVPZA_YKAdWJug';
    const res = await fetch(`${supabaseUrl}/rest/v1/items?select=*&available=eq.true&stock=gt.10`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        menuItems = data;
      }
    }
  } catch {}

  if (!menuItems || menuItems.length === 0) {
    menuItems = [
      { id: 9, name: 'Jrrj', stock: 7000, price: 8000 },
      { id: 6, name: 'What is thsi', stock: 6000, price: 30000 },
      { id: 15, name: 'Pannys', stock: 5000, price: 540400 },
      { id: 13, name: 'Idkwjw', stock: 2800, price: 20000 },
      { id: 14, name: 'Heii', stock: 1800, price: 36400 },
      { id: 4, name: 'Combo', stock: 350, price: 24000 },
      { id: 1, name: 'SANDWHICH', stock: 150, price: 5000 },
    ];
  }
}

// Sender Device Runner
async function runSenderDevice(section, deviceNum) {
  const secTag = section === 'boys' ? 'BOYS' : 'GIRLS';
  const prefix = section === 'boys' ? 'B' : 'G';

  while (Date.now() < endTime) {
    const availableItems = menuItems.filter(i => (i.stock || 1) > 10);
    const item = availableItems[Math.floor(Math.random() * availableItems.length)] || menuItems[0] || { id: 9 };
    const qty = 1;
    const clientToken = `end_${section}_s${deviceNum}_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;

    const res = await timedFetch(
      `${TARGET_URL}/api/orders/place`,
      {
        method: 'POST',
        body: JSON.stringify({
          section,
          clientToken,
          items: [{ itemId: item.id, qty }]
        }),
      },
      'placeOrder'
    );

    if (res.ok && res.data) {
      const order = res.data;
      const orderCode = `${prefix}${order.tokenNo || order.id}`;
      metrics.ordersPlaced[section]++;
      metrics.ordersPlaced.total++;
      activeOrderPool[section].push({ id: order.id, tokenNo: order.tokenNo, section });

      console.log(
        `${C.cyan}INFO[${getLogTimestamp()}]${C.reset} ${secTag} placed order ${C.bold}${orderCode}${C.reset}`
      );
    } else {
      const errDetail = res.data?.error || `HTTP ${res.status}`;
      console.log(
        `${C.red}WARN[${getLogTimestamp()}]${C.reset} ${secTag} [Sender ${deviceNum}] order failed: ${errDetail}`
      );
      await refreshMenu();
    }

    const jitter = (Math.random() * 0.4 + 0.8) * THINK_TIME_MS;
    await sleep(jitter);
  }
}

// Receiver Device Runner (Continuous Counter Processing)
async function runReceiverDevice(section, deviceNum) {
  const secTag = section === 'boys' ? 'BOYS' : 'GIRLS';
  const prefix = section === 'boys' ? 'B' : 'G';

  while (Date.now() < endTime) {
    // 1. Fetch live board
    const boardRes = await timedFetch(
      `${TARGET_URL}/api/board?section=${section}`,
      { method: 'GET' },
      'getBoard'
    );

    let orderToComplete = null;

    if (boardRes.ok && boardRes.data && Array.isArray(boardRes.data.active) && boardRes.data.active.length > 0) {
      orderToComplete = boardRes.data.active.find(o => !inFlightCompleting.has(o.id)) || null;
    }

    if (!orderToComplete && activeOrderPool[section].length > 0) {
      const candidate = activeOrderPool[section].shift();
      if (candidate && !inFlightCompleting.has(candidate.id)) {
        orderToComplete = candidate;
      }
    }

    // 2. Serve order
    if (orderToComplete && orderToComplete.id) {
      inFlightCompleting.add(orderToComplete.id);
      const completeRes = await timedFetch(
        `${TARGET_URL}/api/orders/status`,
        {
          method: 'POST',
          body: JSON.stringify({ id: orderToComplete.id, status: 'completed' }),
        },
        'completeOrder'
      );
      inFlightCompleting.delete(orderToComplete.id);

      if (completeRes.ok) {
        const orderCode = `${prefix}${orderToComplete.tokenNo || orderToComplete.id}`;
        metrics.ordersCompleted[section]++;
        metrics.ordersCompleted.total++;

        if (completeRes.data?.alreadyCompleted) {
          metrics.idempotentAlreadyServed++;
          console.log(
            `${C.yellow}INFO[${getLogTimestamp()}]${C.reset} ${secTag} order ${C.bold}${orderCode}${C.reset} served (idempotent match)`
          );
        } else {
          console.log(
            `${C.green}INFO[${getLogTimestamp()}]${C.reset} ${secTag} completed order ${C.bold}${orderCode}${C.reset}`
          );
        }
      }
    }

    const jitter = (Math.random() * 0.4 + 0.6) * (THINK_TIME_MS * 0.8);
    await sleep(jitter);
  }
}

function calculatePercentiles(latencies) {
  if (!latencies || latencies.length === 0) return { min: 0, med: 0, p90: 0, p95: 0, max: 0, avg: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const p = (pct) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * (pct / 100)))];
  return {
    min: sorted[0],
    med: p(50),
    p90: p(90),
    p95: p(95),
    max: sorted[sorted.length - 1],
    avg: sum / sorted.length,
  };
}

function printHeader() {
  console.log(`\n${C.bold}----------------------------------------------------------------------${C.reset}`);
  console.log(`  ${C.bold}${C.red}🔥  30-MINUTE FULL ENDURANCE LOAD TEST (Food Court App)${C.reset}`);
  console.log(`${C.bold}----------------------------------------------------------------------${C.reset}`);
  console.log(`  execution: ${C.green}local${C.reset}`);
  console.log(`  script:    ${C.cyan}test_traffic.mjs${C.reset}`);
  console.log(`  target:    ${C.bold}${TARGET_URL}${C.reset}`);
  console.log(`  devices:   ${C.magenta}${TOTAL_SENDERS} Senders vs ${TOTAL_RECEIVERS} Receivers (${TOTAL_VUS} Devices Total)${C.reset}`);
  console.log(`  duration:  ${C.yellow}${formatDurationShort(DURATION_MS)}${C.reset}\n`);

  console.log(`  scenarios: (100.00%) 4 scenarios, ${TOTAL_VUS} max concurrent devices:`);
  console.log(`    * ${C.bold}boys_senders${C.reset}:    ${BOYS_SENDERS} looping VUs for ${formatDurationShort(DURATION_MS)} (exec: boysSenders)`);
  console.log(`    * ${C.bold}boys_receivers${C.reset}:  ${BOYS_RECEIVERS} looping VUs for ${formatDurationShort(DURATION_MS)} (exec: boysReceivers)`);
  console.log(`    * ${C.bold}girls_senders${C.reset}:   ${GIRLS_SENDERS} looping VUs for ${formatDurationShort(DURATION_MS)} (exec: girlsSenders)`);
  console.log(`    * ${C.bold}girls_receivers${C.reset}: ${GIRLS_RECEIVERS} looping VUs for ${formatDurationShort(DURATION_MS)} (exec: girlsReceivers)\n`);
}

function printSummary() {
  const totalElapsed = Date.now() - startTime;
  const rps = (metrics.requests / (totalElapsed / 1000)).toFixed(2);
  const overallP = calculatePercentiles(metrics.latencies);
  const placeP = calculatePercentiles(metrics.endpointStats.placeOrder.latencies);
  const boardP = calculatePercentiles(metrics.endpointStats.getBoard.latencies);
  const completeP = calculatePercentiles(metrics.endpointStats.completeOrder.latencies);

  console.log(`\n${C.bold}======================================================================${C.reset}`);
  console.log(`  ${C.bold}${C.green}📊 30-MINUTE TEST SUMMARY & VERCEL RESILIENCE REPORT${C.reset}`);
  console.log(`${C.bold}======================================================================${C.reset}\n`);

  console.log(`  Target Deployment:     ${C.cyan}${TARGET_URL}${C.reset}`);
  console.log(`  Total Duration:        ${(totalElapsed / 1000 / 60).toFixed(2)} minutes (${(totalElapsed / 1000).toFixed(1)}s)`);
  console.log(`  Device Setup:          ${TOTAL_SENDERS} Senders vs ${TOTAL_RECEIVERS} Receivers (${TOTAL_VUS} Devices Total)`);
  console.log(`    • 👦 Boys Counter:   ${BOYS_SENDERS} Senders + ${BOYS_RECEIVERS} Receivers`);
  console.log(`    • 👧 Girls Counter:  ${GIRLS_SENDERS} Senders + ${GIRLS_RECEIVERS} Receivers`);
  console.log(`  Total HTTP Requests:   ${metrics.requests} (${rps} req/s)`);
  console.log(`  Successful Requests:   ${C.green}${metrics.success}${C.reset} (${((metrics.success / (metrics.requests || 1)) * 100).toFixed(1)}%)`);
  console.log(`  Failed Requests:       ${metrics.failures > 0 ? C.red : C.green}${metrics.failures}${C.reset}\n`);

  console.log(`  ${C.bold}Order Totals & Handover Ratio:${C.reset}`);
  console.log(`    * Orders Placed:     ${C.cyan}${metrics.ordersPlaced.total}${C.reset} (👦 Boys: ${metrics.ordersPlaced.boys}, 👧 Girls: ${metrics.ordersPlaced.girls})`);
  console.log(`    * Orders Served:     ${C.green}${metrics.ordersCompleted.total}${C.reset} (👦 Boys: ${metrics.ordersCompleted.boys}, 👧 Girls: ${metrics.ordersCompleted.girls})`);
  console.log(`    * Idempotent Saves:  ${C.yellow}${metrics.idempotentAlreadyServed}${C.reset} double-serve collisions resolved cleanly\n`);

  console.log(`  ${C.bold}HTTP Status Breakdown:${C.reset}`);
  for (const [code, count] of Object.entries(metrics.statusCodes)) {
    const col = code.startsWith('2') ? C.green : code.startsWith('4') ? C.yellow : C.red;
    console.log(`    - Status ${col}${code}${C.reset}: ${count} responses`);
  }

  console.log(`\n  ${C.bold}Latency Percentiles (Response Time):${C.reset}`);
  console.log(`    * Overall:           avg=${overallP.avg.toFixed(1)}ms | min=${overallP.min.toFixed(1)}ms | med(p50)=${overallP.med.toFixed(1)}ms | p90=${overallP.p90.toFixed(1)}ms | p95=${overallP.p95.toFixed(1)}ms | max=${overallP.max.toFixed(1)}ms`);
  console.log(`    * POST /orders/place avg=${placeP.avg.toFixed(1)}ms | p95=${placeP.p95.toFixed(1)}ms | errors=${metrics.endpointStats.placeOrder.errors}`);
  console.log(`    * GET  /board        avg=${boardP.avg.toFixed(1)}ms | p95=${boardP.p95.toFixed(1)}ms | errors=${metrics.endpointStats.getBoard.errors}`);
  console.log(`    * POST /orders/statusavg=${completeP.avg.toFixed(1)}ms | p95=${completeP.p95.toFixed(1)}ms | errors=${metrics.endpointStats.completeOrder.errors}`);

  console.log(`\n  ${C.bold}Vercel & Supabase 30-Minute Resilience Verdict:${C.reset}`);
  const failRate = (metrics.failures / (metrics.requests || 1)) * 100;
  if (failRate === 0 && overallP.p95 < 2000) {
    console.log(`    ${C.green}✅ OUTSTANDING: Sustained 30 minutes of continuous high-volume order flow with zero errors.${C.reset}`);
  } else if (failRate < 3) {
    console.log(`    ${C.yellow}⚠️ EXCELLENT: ${(100 - failRate).toFixed(1)}% success rate across 30 minutes of heavy traffic.${C.reset}`);
  } else {
    console.log(`    ${C.red}❌ UNSTABLE: ${failRate.toFixed(1)}% errors under 30-minute endurance load.${C.reset}`);
  }
  console.log(`\n${C.bold}----------------------------------------------------------------------${C.reset}\n`);
}

// Main Runner
async function main() {
  printHeader();
  await refreshMenu();

  const devices = [];

  for (let i = 1; i <= BOYS_SENDERS; i++) devices.push(runSenderDevice('boys', i));
  for (let i = 1; i <= BOYS_RECEIVERS; i++) devices.push(runReceiverDevice('boys', i));
  for (let i = 1; i <= GIRLS_SENDERS; i++) devices.push(runSenderDevice('girls', i));
  for (let i = 1; i <= GIRLS_RECEIVERS; i++) devices.push(runReceiverDevice('girls', i));

  // Periodic heartbeat log every 60s
  const heartbeat = setInterval(() => {
    const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
    const remSec = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
    const rps = (metrics.requests / elapsedSec).toFixed(1);
    console.log(
      `\n${C.yellow}--- [HEARTBEAT ${getLogTimestamp()}] --- Elapsed: ${elapsedSec}s | Remaining: ${remSec}s | Req: ${metrics.requests} (${rps}/s) | Placed: ${metrics.ordersPlaced.total} | Served: ${metrics.ordersCompleted.total} | Errors: ${metrics.failures}${C.reset}\n`
    );
    refreshMenu();
  }, 60000);

  process.on('SIGINT', () => {
    console.log(`\n${C.yellow}Test interrupted by user! Generating report...${C.reset}`);
    clearInterval(heartbeat);
    printSummary();
    process.exit(0);
  });

  await Promise.all(devices);
  clearInterval(heartbeat);
  printSummary();
}

main().catch((err) => {
  console.error('Fatal load test runner error:', err);
  process.exit(1);
});

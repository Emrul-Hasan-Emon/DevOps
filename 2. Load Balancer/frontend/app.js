const LB_URL = 'http://localhost:3000';

const COLORS = [
  { bar: '#6366f1', text: '#818cf8' },
  { bar: '#f59e0b', text: '#fbbf24' },
  { bar: '#10b981', text: '#34d399' },
  { bar: '#ef4444', text: '#f87171' },
  { bar: '#8b5cf6', text: '#a78bfa' },
  { bar: '#06b6d4', text: '#22d3ee' },
  { bar: '#f97316', text: '#fb923c' },
  { bar: '#ec4899', text: '#f472b6' },
  { bar: '#84cc16', text: '#a3e635' },
  { bar: '#14b8a6', text: '#2dd4bf' },
];

// State
let servers = [];
let counts = {};
let totalCount = 0;
let resetting = false;

// --- SSE ---
let evtSource = null;

function connectSSE() {
  evtSource = new EventSource(`${LB_URL}/events`);

  evtSource.onopen = () => setStatus(true);

  evtSource.onmessage = (e) => {
    const data = JSON.parse(e.data);

    if (data.type === 'servers') {
      applyServerList(data.servers);
    } else if (data.type === 'request' && !resetting) {
      appendRow(data);
      if (!data.error) updateCounts(data.backend);
    }
  };

  evtSource.onerror = () => {
    setStatus(false);
    evtSource.close();
    setTimeout(connectSSE, 3000);
  };
}

function setStatus(connected) {
  const el = document.getElementById('connection-status');
  el.textContent = connected ? '● Connected to Load Balancer' : '● Disconnected — retrying...';
  el.className = connected ? 'connected' : 'disconnected';
}

// --- Server list ---
function applyServerList(newServers) {
  servers = newServers;
  counts = {};
  servers.forEach(s => counts[s] = 0);
  totalCount = 0;

  renderCards();
  renderBars();
  document.getElementById('logBody').innerHTML = '';
  document.getElementById('totalLabel').textContent = '';
}

function renderCards() {
  const grid = document.getElementById('statsGrid');
  grid.innerHTML = '';
  servers.forEach((name, i) => {
    const color = COLORS[i % COLORS.length];
    const card = document.createElement('div');
    card.className = 'server-card';
    card.id = `card-${i}`;
    card.style.setProperty('--accent', color.bar);
    card.style.setProperty('--text', color.text);
    card.innerHTML = `
      <h2>${name}</h2>
      <div class="count" id="count-${i}">0</div>
      <div class="sublabel">requests handled</div>
      <div class="active-label">Active: <span id="active-${i}">0</span></div>
    `;
    grid.appendChild(card);
  });
}

function renderBars() {
  const wrap = document.getElementById('barWrap');
  const labels = document.getElementById('barLabels');
  wrap.innerHTML = '';
  labels.innerHTML = '';

  const pct = servers.length > 0 ? (100 / servers.length).toFixed(1) : 0;

  servers.forEach((name, i) => {
    const color = COLORS[i % COLORS.length];

    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.id = `bar-${i}`;
    bar.style.width = `${pct}%`;
    bar.style.background = color.bar;
    wrap.appendChild(bar);

    const lbl = document.createElement('span');
    lbl.id = `pct-${i}`;
    lbl.style.color = color.text;
    lbl.textContent = `${name}: ${pct}%`;
    labels.appendChild(lbl);
  });
}

function updateCounts(backendName) {
  totalCount++;
  if (counts[backendName] !== undefined) counts[backendName]++;

  servers.forEach((name, i) => {
    document.getElementById(`count-${i}`).textContent = counts[name] || 0;
  });

  document.getElementById('totalLabel').textContent = `(${totalCount} total)`;

  servers.forEach((name, i) => {
    const pct = totalCount > 0 ? ((counts[name] || 0) / totalCount * 100) : (100 / servers.length);
    document.getElementById(`bar-${i}`).style.width = `${pct}%`;
    document.getElementById(`pct-${i}`).textContent = `${name}: ${Math.round(pct)}%`;
  });

  syncActiveConnections();
}

async function syncActiveConnections() {
  try {
    const res = await fetch(`${LB_URL}/status`);
    const data = await res.json();
    data.backends.forEach((b, i) => {
      const el = document.getElementById(`active-${i}`);
      if (el) el.textContent = b.activeConnections;
    });
  } catch {}
}

// --- Controls ---
document.getElementById('applyServersBtn').addEventListener('click', async () => {
  const n = parseInt(document.getElementById('serverCount').value, 10);
  const btn = document.getElementById('applyServersBtn');
  btn.disabled = true;
  btn.textContent = 'Starting...';

  try {
    await fetch(`${LB_URL}/servers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: n }),
    });
    // Fetch the confirmed server list directly — don't rely on SSE delivery order
    const res = await fetch(`${LB_URL}/status`);
    const data = await res.json();
    if (data.servers && data.servers.length > 0) {
      applyServerList(data.servers);
    }
  } catch {}

  btn.disabled = false;
  btn.textContent = 'Apply';
});

document.getElementById('algorithmSelect').addEventListener('change', async (e) => {
  try {
    await fetch(`${LB_URL}/algorithm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ algorithm: e.target.value }),
    });
  } catch {}
});

const fireBtn = document.getElementById('fireBtn');

fireBtn.addEventListener('click', async () => {
  const n = parseInt(document.getElementById('requestCount').value, 10);
  if (!n || n < 1) return;

  fireBtn.disabled = true;
  fireBtn.textContent = `Firing ${n}...`;

  const promises = Array.from({ length: n }, (_, i) =>
    fetch(`${LB_URL}/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: `req-${Date.now()}-${i}` }),
    }).catch(() => null)
  );

  await Promise.allSettled(promises);

  fireBtn.disabled = false;
  fireBtn.textContent = 'Fire Requests';
});

document.getElementById('resetBtn').addEventListener('click', () => {
  resetting = true;
  servers.forEach(s => counts[s] = 0);
  totalCount = 0;
  renderCards();
  renderBars();
  document.getElementById('logBody').innerHTML = '';
  document.getElementById('totalLabel').textContent = '';
  setTimeout(() => { resetting = false; }, 300);
});

// --- Log table ---
function appendRow(data) {
  const tbody = document.getElementById('logBody');
  const i = servers.indexOf(data.backend);
  const color = i >= 0 ? COLORS[i % COLORS.length].text : '#94a3b8';

  const tr = document.createElement('tr');
  tr.style.borderBottom = '1px solid #1a1f2e';

  if (data.error) {
    tr.innerHTML = `
      <td>${truncateId(data.requestId)}</td>
      <td style="color:${color};font-weight:600">${data.backend}</td>
      <td>${data.algorithm}</td>
      <td colspan="2" style="color:#f87171">ERROR: ${data.message || 'unknown'}</td>
      <td>${formatTime(data.timestamp)}</td>
    `;
  } else {
    tr.innerHTML = `
      <td>${truncateId(data.requestId)}</td>
      <td style="color:${color};font-weight:600">${data.backend}</td>
      <td>${data.algorithm}</td>
      <td>${data.processingMs}ms</td>
      <td>${data.totalMs}ms</td>
      <td>${formatTime(data.timestamp)}</td>
    `;
  }

  tbody.prepend(tr);
  while (tbody.rows.length > 200) tbody.deleteRow(tbody.rows.length - 1);
}

function truncateId(id) {
  if (!id) return '—';
  return id.length > 24 ? id.slice(0, 24) + '…' : id;
}

function formatTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString();
}

// --- Init ---
connectSSE();

setTimeout(async () => {
  try {
    const res = await fetch(`${LB_URL}/status`);
    const data = await res.json();
    if (data.servers && data.servers.length > 0) {
      applyServerList(data.servers);
    }
  } catch {}
}, 500);

const LB_URL = 'http://localhost:3000';

let countA = 0;
let countB = 0;
let totalCount = 0;

// --- SSE connection ---
let evtSource = null;

function connectSSE() {
  evtSource = new EventSource(`${LB_URL}/events`);

  evtSource.onopen = () => {
    setStatus(true);
  };

  evtSource.onmessage = (e) => {
    const data = JSON.parse(e.data);
    appendRow(data);
    if (!data.error) updateCounts(data.backend);
  };

  evtSource.onerror = () => {
    setStatus(false);
    evtSource.close();
    setTimeout(connectSSE, 3000);
  };
}

function setStatus(connected) {
  const el = document.getElementById('connection-status');
  if (connected) {
    el.textContent = '● Connected to Load Balancer';
    el.className = 'connected';
  } else {
    el.textContent = '● Disconnected — retrying...';
    el.className = 'disconnected';
  }
}

// --- Algorithm switch ---
document.getElementById('algorithmSelect').addEventListener('change', async (e) => {
  try {
    await fetch(`${LB_URL}/algorithm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ algorithm: e.target.value }),
    });
  } catch {
    // LB might not be running yet; no-op
  }
});

// --- Fire requests ---
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

// --- Reset ---
document.getElementById('resetBtn').addEventListener('click', () => {
  countA = 0;
  countB = 0;
  totalCount = 0;
  document.getElementById('count-a').textContent = '0';
  document.getElementById('count-b').textContent = '0';
  document.getElementById('active-a').textContent = '0';
  document.getElementById('active-b').textContent = '0';
  document.getElementById('bar-a').style.width = '50%';
  document.getElementById('bar-b').style.width = '50%';
  document.getElementById('pct-a').textContent = '50%';
  document.getElementById('pct-b').textContent = '50%';
  document.getElementById('logBody').innerHTML = '';
  document.getElementById('totalLabel').textContent = '';
});

// --- DOM helpers ---
function appendRow(data) {
  const tbody = document.getElementById('logBody');
  const tr = document.createElement('tr');

  if (data.error) {
    tr.className = 'row-error';
    tr.innerHTML = `
      <td>${truncateId(data.requestId)}</td>
      <td>${data.backend}</td>
      <td>${data.algorithm}</td>
      <td colspan="2" style="color:#f87171">ERROR: ${data.message || 'unknown'}</td>
      <td>${formatTime(data.timestamp)}</td>
    `;
  } else {
    tr.className = data.backend === 'Server A' ? 'row-a' : 'row-b';
    tr.innerHTML = `
      <td>${truncateId(data.requestId)}</td>
      <td>${data.backend}</td>
      <td>${data.algorithm}</td>
      <td>${data.processingMs}ms</td>
      <td>${data.totalMs}ms</td>
      <td>${formatTime(data.timestamp)}</td>
    `;
  }

  tbody.prepend(tr);

  // cap log at 200 rows
  while (tbody.rows.length > 200) {
    tbody.deleteRow(tbody.rows.length - 1);
  }
}

function updateCounts(backend) {
  totalCount++;
  if (backend === 'Server A') countA++;
  else countB++;

  document.getElementById('count-a').textContent = countA;
  document.getElementById('count-b').textContent = countB;
  document.getElementById('totalLabel').textContent = `(${totalCount} total)`;

  const pctA = Math.round((countA / totalCount) * 100);
  const pctB = 100 - pctA;

  document.getElementById('bar-a').style.width = `${pctA}%`;
  document.getElementById('bar-b').style.width = `${pctB}%`;
  document.getElementById('pct-a').textContent = `Server A: ${pctA}%`;
  document.getElementById('pct-b').textContent = `Server B: ${pctB}%`;

  // sync active connections from status
  syncActiveConnections();
}

async function syncActiveConnections() {
  try {
    const res = await fetch(`${LB_URL}/status`);
    const data = await res.json();
    data.backends.forEach(b => {
      const id = b.name === 'Server A' ? 'active-a' : 'active-b';
      document.getElementById(id).textContent = b.activeConnections;
    });
  } catch {
    // silent
  }
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

# Load Balancer Simulation

A full-stack learning project that visualizes how a load balancer distributes incoming HTTP requests across multiple backend servers in real time. Built with **NestJS** (backend) and **plain HTML/JS** (frontend).

---

## Table of Contents

1. [What This Project Demonstrates](#what-this-project-demonstrates)
2. [Architecture](#architecture)
3. [Project Structure](#project-structure)
4. [How It Works — Deep Dive](#how-it-works--deep-dive)
   - [The Request Flow](#the-request-flow)
   - [Load Balancing Algorithms](#load-balancing-algorithms)
   - [Dynamic Server Management](#dynamic-server-management)
   - [Real-Time Updates via SSE](#real-time-updates-via-sse)
5. [Running the Project](#running-the-project)
6. [Using the Dashboard](#using-the-dashboard)
7. [API Reference](#api-reference)
8. [Design Decisions](#design-decisions)
9. [Known Constraints](#known-constraints)

---

## What This Project Demonstrates

- How a **reverse proxy / load balancer** sits between a client and multiple backend servers
- How **Round Robin**, **Least Connections**, and **Random** algorithms distribute load differently
- How **concurrent requests** are handled — all N requests fire simultaneously and complete at their own pace
- How **real-time streaming** (SSE) pushes updates to a browser without polling
- How a **dynamic server pool** can be scaled up or down at runtime without restarting anything

---

## Architecture

```
Browser (frontend/)
  │
  ├── POST /request  ×N (simultaneous) ──▶  Load Balancer :3000
  │                                              │
  ├── GET  /events   (SSE stream, persistent) ◀──┤
  │                                              │
  ├── POST /algorithm                            ├──▶ Server A :3001
  ├── POST /servers                              ├──▶ Server B :3002
  └── GET  /status                               ├──▶ Server C :3003
                                                 └──▶ Server N :300N
```

**Key principle:** The browser never talks directly to the backend servers. The Load Balancer is the single entry point — a classic **reverse proxy** pattern.

### Port Allocation

| Service | Port |
|---|---|
| Load Balancer | 3000 |
| Server A | 3001 |
| Server B | 3002 |
| Server C | 3003 |
| Server N | 3000 + N |
| Frontend | opened as a local file (or Live Server :5500) |

---

## Project Structure

```
2. Load Balancer/
├── package.json                          ← root: npm workspaces + single start script
├── packages/
│   ├── load-balancer/                    ← NestJS app, port 3000
│   │   └── src/
│   │       ├── main.ts                   ← bootstrap, enableCors()
│   │       ├── app.module.ts
│   │       └── lb/
│   │           ├── lb.module.ts
│   │           ├── lb.controller.ts      ← HTTP endpoints
│   │           ├── lb.service.ts         ← core logic: routing, spawning, SSE
│   │           └── algorithms/
│   │               ├── round-robin.ts
│   │               ├── least-connections.ts
│   │               └── random.ts
│   └── server/
│       └── index.js                      ← generic backend server (plain Node.js)
└── frontend/
    ├── index.html                        ← UI structure
    ├── app.js                            ← all frontend logic
    └── style.css
```

> **Note:** `packages/server-a/` and `packages/server-b/` are legacy folders from the initial two-server implementation. They are no longer used — `packages/server/index.js` replaced them.

---

## How It Works — Deep Dive

### The Request Flow

**Step 1 — Browser fires N requests simultaneously**

```javascript
// frontend/app.js
const promises = Array.from({ length: n }, (_, i) =>
  fetch(`http://localhost:3000/request`, {
    method: 'POST',
    body: JSON.stringify({ requestId: `req-${Date.now()}-${i}` }),
  })
);
await Promise.allSettled(promises);
```

`Promise.allSettled` fires all N requests at the same instant without waiting for any to finish. This simulates real concurrent traffic — if requests were sent one-by-one in a loop, all algorithms would behave identically.

---

**Step 2 — Load Balancer picks a backend server**

```typescript
// packages/load-balancer/src/lb/lb.service.ts
async forwardRequest(requestId: string) {
  const algorithm = this.algorithms[this.currentAlgorithm];
  const backend = algorithm.pick(this.backends);  // ← strategy pattern

  backend.activeConnections++;
  // ...
}
```

The algorithm's `pick()` method receives the full backend list and returns one. The `activeConnections` counter on that backend increments immediately — before the request is even sent — so the Least Connections algorithm sees an accurate picture of in-flight load.

---

**Step 3 — Load Balancer proxies the request (reverse proxy)**

```typescript
const { data } = await axios.get(`${backend.url}/handle`, {
  params: { requestId },
  timeout: 5000,
});
```

The LB makes its own HTTP call to the chosen backend using `axios`. The browser never knows which backend handled it — from the browser's perspective it always talked to `localhost:3000`.

---

**Step 4 — Backend server processes the request**

```javascript
// packages/server/index.js
const delay = Math.floor(Math.random() * 300) + 50;  // 50–350ms random delay

setTimeout(() => {
  res.end(JSON.stringify({
    handledBy: NAME,
    requestId,
    processingMs: delay,
    timestamp: new Date().toISOString(),
  }));
}, delay);
```

The random delay (50–350ms) is intentional — it simulates real-world variable processing time and makes the difference between algorithms visible. Without it, all requests would complete at the same speed and Least Connections would behave identically to Round Robin.

---

**Step 5 — Load Balancer cleans up and broadcasts**

```typescript
} finally {
  backend.activeConnections--;  // always decrements, even on error
}

this.broadcast({
  type: 'request',
  backend: backend.name,
  processingMs: data.processingMs,
  totalMs: Date.now() - start,
  // ...
});
```

`finally` guarantees `activeConnections` always returns to the correct value — even if the backend throws an error or times out. Without `finally`, a failed request would permanently inflate the counter and Least Connections would keep routing away from that server.

`broadcast` pushes the result to all connected SSE clients instantly.

---

### Load Balancing Algorithms

All three algorithms implement the same interface:

```typescript
interface Algorithm {
  pick(backends: Backend[]): Backend;
}
```

**Round Robin** — cycles through servers in order, ignoring load:

```typescript
// packages/load-balancer/src/lb/algorithms/round-robin.ts
pick(backends: Backend[]): Backend {
  const chosen = backends[this.index % backends.length];
  this.index++;
  return chosen;
}
```

Request 1 → Server A, Request 2 → Server B, Request 3 → Server C, Request 4 → Server A... It wraps around forever using modulo. Predictable, but blind to how busy each server actually is.

---

**Least Connections** — always picks the server with the fewest active requests:

```typescript
// packages/load-balancer/src/lb/algorithms/least-connections.ts
pick(backends: Backend[]): Backend {
  return backends.reduce((min, b) =>
    b.activeConnections < min.activeConnections ? b : min
  );
}
```

If Server A is processing 5 slow requests and Server B is idle, the next request goes to B — even if Round Robin would have sent it to A. This produces a more even distribution under variable workloads. The `activeConnections` counter is incremented *before* the axios call and decremented *after*, so the algorithm always sees real-time load.

---

**Random** — pure coin flip:

```typescript
// packages/load-balancer/src/lb/algorithms/random.ts
pick(backends: Backend[]): Backend {
  return backends[Math.floor(Math.random() * backends.length)];
}
```

No state, no memory. Converges to even distribution only over many requests — with just 10 requests you might get 8/2 by chance.

---

### Dynamic Server Management

The most architecturally interesting part. When the user changes the server count, the Load Balancer:

1. **Kills** all existing child processes
2. **Waits** 400ms for their ports to free up
3. **Spawns** N new instances of `packages/server/index.js` as child processes, each with a unique port and name passed via environment variables
4. **Health-checks** each server by polling `/handle` until it responds (max 20 attempts × 150ms = 3 seconds per server)
5. **Broadcasts** the new server list via SSE so the frontend rebuilds its dashboard

```typescript
// packages/load-balancer/src/lb/lb.service.ts
for (let i = 0; i < count; i++) {
  const port = BASE_PORT + i;
  const name = `Server ${SERVER_NAMES[i]}`;  // A, B, C...

  const child = spawn('node', [SERVER_SCRIPT], {
    env: { ...process.env, PORT: String(port), SERVER_NAME: name },
    stdio: 'inherit',
  });

  this.serverProcesses.push(child);
  this.backends.push({ name, url: `http://localhost:${port}`, activeConnections: 0 });
}

// Don't proceed until every server is actually ready
await Promise.all(this.backends.map(b => this.waitForServer(b.name, b.url)));
```

`packages/server/index.js` is a plain Node.js HTTP server (no NestJS) — intentionally lightweight so it starts fast and can be spawned many times cheaply.

The `SERVER_SCRIPT` path uses `__dirname` with 3 levels up (`../../..`), which correctly resolves to `packages/server/index.js` whether the code is running from the TypeScript source directory (`src/lb/`) or the compiled output (`dist/lb/`).

---

### Real-Time Updates via SSE

Server-Sent Events (SSE) is a one-way persistent stream from the server to the browser. The browser opens one connection on page load and receives events as they are pushed, with no polling.

**Server side — opening the stream:**

```typescript
// packages/load-balancer/src/lb/lb.controller.ts
@Get('events')
sseStream(@Res() res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();  // ← critical: must flush immediately or buffering breaks SSE
  this.lbService.addSseClient(res);
}
```

`res.flushHeaders()` is mandatory. Without it, Node.js/Express buffers the response and the stream never reaches the browser.

**Server side — broadcasting an event:**

```typescript
private broadcast(data: object) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;  // SSE wire format
  this.sseClients.forEach(client => client.write(payload));
}
```

The `\n\n` double newline is required by the SSE specification to delimit events.

**Client side — receiving events:**

```javascript
// frontend/app.js
const evtSource = new EventSource('http://localhost:3000/events');

evtSource.onmessage = (e) => {
  const data = JSON.parse(e.data);

  if (data.type === 'servers') {
    applyServerList(data.servers);   // rebuild cards and bar chart
  } else if (data.type === 'request' && !resetting) {
    appendRow(data);                 // add row to log table
    updateCounts(data.backend);      // update counts and bar percentages
  }
};
```

Two event types flow through the same SSE stream:
- `servers` — sent when the server pool changes, triggers a full dashboard rebuild
- `request` — sent when each individual request completes, triggers a log row and counter update

The `resetting` flag is set for 300ms when the user clicks Reset, to prevent in-flight SSE events from re-populating the counts immediately after they are cleared.

---

## Running the Project

### Prerequisites

- Node.js 18+
- npm 9+

### Install dependencies

```bash
cd "2. Load Balancer"
npm install
```

### Start the Load Balancer

```bash
npm start
```

This starts only the NestJS Load Balancer on port 3000. The backend servers (A, B, ...) are spawned automatically by the Load Balancer itself on startup — you do not need to start them separately.

You will see output like:

```
Server A running on port 3001
Server B running on port 3002
[Nest] LOG — NestJS application successfully started
```

### Open the frontend

Open `frontend/index.html` directly in your browser. Options:

```bash
# Option 1 — VS Code Live Server (right-click index.html → Open with Live Server)

# Option 2 — npx serve
npx serve frontend
# then open http://localhost:3000 (or whatever port it shows)

# Option 3 — drag the file into your browser directly
open "frontend/index.html"
```

### Stop

Press `Ctrl+C` in the terminal. The Load Balancer's `onModuleDestroy` hook kills all spawned backend server processes cleanly.

---

## Using the Dashboard

### Controls

| Control | What it does |
|---|---|
| **Servers** input + **Apply** | Change the number of backend servers (1–10). Old servers are killed and new ones are spawned. Dashboard rebuilds automatically. |
| **Requests to fire** + **Fire Requests** | Fire N HTTP requests simultaneously to the Load Balancer. |
| **Algorithm** dropdown | Switch the load balancing strategy. Takes effect immediately on the next request. |
| **Reset** | Clears all counters and the request log. Does not affect running servers. |

### Reading the dashboard

- **Server cards** — show the total requests handled and current in-flight (active) connections per server
- **Distribution bar** — shows the percentage split across all servers, updated after every request
- **Request log** — shows each completed request: which server handled it, how long the backend took, how long total (including network/proxy overhead), and the timestamp. Color-coded by server.
- **Status indicator** (bottom-right) — green when SSE is connected, red when disconnected (auto-reconnects every 3 seconds)

### Observing algorithm differences

| Algorithm | What to observe |
|---|---|
| **Round Robin** | Strict alternation in the log: A → B → C → A → B → C |
| **Random** | Non-deterministic. Fire 30+ requests to see ~equal distribution emerge statistically |
| **Least Connections** | With random backend delays (50–350ms), the busier server gets fewer new requests. Distribution equalizes more than Round Robin under concurrent load |

---

## API Reference

All endpoints on the Load Balancer (`http://localhost:3000`):

| Method | Path | Body | Description |
|---|---|---|---|
| `POST` | `/request` | `{ requestId: string }` | Forward one request through the load balancer |
| `GET` | `/events` | — | SSE stream. Opens a persistent connection and receives events |
| `POST` | `/algorithm` | `{ algorithm: "round-robin" \| "least-connections" \| "random" }` | Switch the active algorithm |
| `POST` | `/servers` | `{ count: number }` | Change the number of backend servers (1–10) |
| `GET` | `/status` | — | Returns current algorithm, server list, and active connection counts |

Each backend server exposes one endpoint:

| Method | Path | Query | Description |
|---|---|---|---|
| `GET` | `/handle` | `requestId=string` | Processes the request with a random 50–350ms delay and returns metadata |

---

## Design Decisions

**Why plain Node.js for the backend servers instead of NestJS?**
Backend servers need to be spawned dynamically and cheaply — potentially up to 10 at once. NestJS adds startup overhead (decorators, DI container, module initialization). A plain `http.createServer` starts in ~50ms vs ~500ms for NestJS, which matters when the frontend is waiting for all servers to be ready.

**Why SSE instead of WebSockets?**
SSE is unidirectional (server → client), which is all this project needs. It is simpler to implement, works natively in browsers without a library, and reconnects automatically on disconnect. WebSockets add bidirectional complexity that offers no benefit here.

**Why `Promise.allSettled` instead of `Promise.all` for firing requests?**
`Promise.all` rejects immediately if any single request fails, which would stop the entire batch. `Promise.allSettled` waits for all requests to either resolve or reject, ensuring all N requests are fired regardless of individual failures.

**Why health-check polling instead of a fixed delay after spawning?**
A fixed delay (e.g., 300ms) might be too short on a loaded machine and too long on a fast one. Polling `/handle` until it responds ensures the LB only starts routing once each server is genuinely ready to accept connections.

**Why reset the Round Robin index when server count changes?**
When going from 5 servers back to 2, a persisted index of 4 would cause an out-of-bounds access on the next request. Resetting the index ensures Round Robin starts cleanly from Server A whenever the pool changes.

---

## Known Constraints

- Server names are limited to A–J (10 servers maximum). This is a learning project constraint — a production load balancer would use IPs, not alphabet letters.
- All servers run on `localhost`. In a real system, backend servers would be on different machines or containers.
- There is no persistence — restarting the Load Balancer resets to 2 servers and Round Robin.
- The frontend must be opened after the Load Balancer is running, otherwise the SSE connection will show "Disconnected" until the LB starts.

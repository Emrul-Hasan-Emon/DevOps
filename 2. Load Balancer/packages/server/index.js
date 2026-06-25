const http = require('http');

const PORT = parseInt(process.env.PORT || '3001');
const NAME = process.env.SERVER_NAME || `Server-${PORT}`;

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/handle') {
    const requestId = url.searchParams.get('requestId');
    const delay = Math.floor(Math.random() * 300) + 50;

    setTimeout(() => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        handledBy: NAME,
        requestId,
        processingMs: delay,
        timestamp: new Date().toISOString(),
      }));
    }, delay);
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(PORT, () => {
  console.log(`${NAME} running on port ${PORT}`);
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Response } from 'express';
import { ChildProcess, spawn } from 'child_process';
import * as path from 'path';
import axios from 'axios';
import { RoundRobin } from './algorithms/round-robin';
import { LeastConnections } from './algorithms/least-connections';
import { RandomAlgorithm } from './algorithms/random';

export interface Backend {
  name: string;
  url: string;
  activeConnections: number;
}

// __dirname is dist/lb/ (compiled) or src/lb/ (ts-node) — both are 2 levels inside the package
const SERVER_SCRIPT = path.join(__dirname, '..', '..', '..', 'server', 'index.js');
const BASE_PORT = 3001;
const SERVER_NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

@Injectable()
export class LbService implements OnModuleInit, OnModuleDestroy {
  private backends: Backend[] = [];
  private serverProcesses: ChildProcess[] = [];

  private algorithms = {
    'round-robin': new RoundRobin(),
    'least-connections': new LeastConnections(),
    'random': new RandomAlgorithm(),
  };

  private currentAlgorithm: keyof typeof this.algorithms = 'round-robin';
  private sseClients: Response[] = [];

  async onModuleInit() {
    await this.setServerCount(2);
  }

  onModuleDestroy() {
    this.killAll();
  }

  async setServerCount(count: number) {
    this.killAll();

    await new Promise(r => setTimeout(r, 400));

    this.backends = [];
    this.serverProcesses = [];
    this.algorithms['round-robin'] = new RoundRobin();

    for (let i = 0; i < count; i++) {
      const port = BASE_PORT + i;
      const name = `Server ${SERVER_NAMES[i]}`;

      const child = spawn('node', [SERVER_SCRIPT], {
        env: { ...process.env, PORT: String(port), SERVER_NAME: name },
        stdio: 'inherit',
      });

      this.serverProcesses.push(child);
      this.backends.push({ name, url: `http://localhost:${port}`, activeConnections: 0 });
    }

    console.log('server processes', this.serverProcesses.map(p => p.pid));
    console.log('backends', this.backends.map(b => b.url));

    // Wait until all servers are actually accepting connections
    await Promise.all(this.backends.map(b => this.waitForServer(b.name, b.url)));

    this.broadcast({
      type: 'servers',
      servers: this.backends.map(b => b.name),
      algorithm: this.currentAlgorithm,
    });
  }

  private async waitForServer(name: string, url: string, attempts = 20): Promise<void> {
    for (let i = 0; i < attempts; i++) {
      try {
        await axios.get(`${url}/handle?requestId=health`, { timeout: 300 });
        console.log(`Server ${name} is ready. URL: ${url}`);
        return;
      } catch {
        await new Promise(r => setTimeout(r, 150));
      }
    }
    throw new Error(`Server ${name} failed to start`);
  }

  private killAll() {
    this.serverProcesses.forEach(p => {
      try { p.kill('SIGTERM'); } catch {}
    });
    this.serverProcesses = [];
  }

  setAlgorithm(name: string) {
    if (name in this.algorithms) {
      this.currentAlgorithm = name as keyof typeof this.algorithms;
    }
  }

  getStatus() {
    return {
      algorithm: this.currentAlgorithm,
      servers: this.backends.map(b => b.name),
      backends: this.backends.map(b => ({
        name: b.name,
        activeConnections: b.activeConnections,
      })),
    };
  }

  addSseClient(res: Response) {
    this.sseClients.push(res);
    res.on('close', () => {
      this.sseClients = this.sseClients.filter(c => c !== res);
    });
  }

  private broadcast(data: object) {
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    this.sseClients.forEach(client => client.write(payload));
  }

  async forwardRequest(requestId: string) {
    if (this.backends.length === 0) {
      return { error: true, message: 'No servers available', requestId, timestamp: new Date().toISOString() };
    }

    const algorithm = this.algorithms[this.currentAlgorithm];
    const backend = algorithm.pick(this.backends);

    backend.activeConnections++;
    const start = Date.now();

    try {
      const { data } = await axios.get(`${backend.url}/handle`, {
        params: { requestId },
        timeout: 5000,
      });

      const result = {
        type: 'request',
        requestId,
        backend: backend.name,
        algorithm: this.currentAlgorithm,
        processingMs: data.processingMs,
        totalMs: Date.now() - start,
        timestamp: data.timestamp,
      };

      this.broadcast(result);
      return result;
    } catch (err) {
      const errorResult = {
        type: 'request',
        requestId,
        backend: backend.name,
        algorithm: this.currentAlgorithm,
        error: true,
        message: err.message,
        totalMs: Date.now() - start,
        timestamp: new Date().toISOString(),
      };
      this.broadcast(errorResult);
      return errorResult;
    } finally {
      backend.activeConnections--;
    }
  }
}

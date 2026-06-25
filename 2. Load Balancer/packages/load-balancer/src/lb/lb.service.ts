import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import axios from 'axios';
import { RoundRobin } from './algorithms/round-robin';
import { LeastConnections } from './algorithms/least-connections';
import { RandomAlgorithm } from './algorithms/random';

export interface Backend {
  name: string;
  url: string;
  activeConnections: number;
}

@Injectable()
export class LbService {
  private backends: Backend[] = [
    { name: 'Server A', url: 'http://localhost:3001', activeConnections: 0 },
    { name: 'Server B', url: 'http://localhost:3002', activeConnections: 0 },
  ];

  private algorithms = {
    'round-robin': new RoundRobin(),
    'least-connections': new LeastConnections(),
    'random': new RandomAlgorithm(),
  };

  private currentAlgorithm: keyof typeof this.algorithms = 'round-robin';
  private sseClients: Response[] = [];

  setAlgorithm(name: string) {
    if (name in this.algorithms) {
      this.currentAlgorithm = name as keyof typeof this.algorithms;
    }
  }

  getStatus() {
    return {
      algorithm: this.currentAlgorithm,
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
    const algorithm = this.algorithms[this.currentAlgorithm];
    const backend = algorithm.pick(this.backends);

    backend.activeConnections++;
    const start = Date.now();

    try {
      const { data } = await axios.get(`${backend.url}/handle`, {
        params: { requestId },
      });

      const result = {
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

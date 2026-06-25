import { Backend } from '../lb.service';

export class RandomAlgorithm {
  pick(backends: Backend[]): Backend {
    return backends[Math.floor(Math.random() * backends.length)];
  }
}

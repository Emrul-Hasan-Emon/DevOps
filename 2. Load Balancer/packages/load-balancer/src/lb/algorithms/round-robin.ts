import { Backend } from '../lb.service';

export class RoundRobin {
  private index = 0;

  pick(backends: Backend[]): Backend {
    const chosen = backends[this.index % backends.length];
    this.index++;
    return chosen;
  }
}

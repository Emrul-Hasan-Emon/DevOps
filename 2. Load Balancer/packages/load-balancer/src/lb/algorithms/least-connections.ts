import { Backend } from '../lb.service';

export class LeastConnections {
  pick(backends: Backend[]): Backend {
    return backends.reduce((min, b) =>
      b.activeConnections < min.activeConnections ? b : min
    );
  }
}

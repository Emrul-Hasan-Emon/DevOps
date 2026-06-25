import { Injectable } from '@nestjs/common';

@Injectable()
export class HandlerService {
  async process(requestId: string) {
    const delay = Math.floor(Math.random() * 300) + 50;
    await new Promise(r => setTimeout(r, delay));
    return {
      handledBy: 'Server A',
      requestId,
      processingMs: delay,
      timestamp: new Date().toISOString(),
    };
  }
}

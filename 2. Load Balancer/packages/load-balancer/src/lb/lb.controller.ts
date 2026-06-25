import { Body, Controller, Get, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { LbService } from './lb.service';

@Controller()
export class LbController {
  constructor(private readonly lbService: LbService) {}

  @Post('request')
  async handleRequest(@Body('requestId') requestId: string) {
    return this.lbService.forwardRequest(requestId);
  }

  @Get('events')
  sseStream(@Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    this.lbService.addSseClient(res);
  }

  @Post('algorithm')
  setAlgorithm(@Body('algorithm') algorithm: string) {
    this.lbService.setAlgorithm(algorithm);
    return { active: algorithm };
  }

  @Post('servers')
  async setServers(@Body('count') count: number) {
    const n = Math.min(Math.max(Math.floor(count), 1), 10);
    await this.lbService.setServerCount(n);
    return { count: n };
  }

  @Get('status')
  getStatus() {
    return this.lbService.getStatus();
  }
}

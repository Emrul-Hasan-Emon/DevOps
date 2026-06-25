import { Controller, Get, Query } from '@nestjs/common';
import { HandlerService } from './handler.service';

@Controller()
export class HandlerController {
  constructor(private readonly handlerService: HandlerService) {}

  @Get('handle')
  handle(@Query('requestId') requestId: string) {
    return this.handlerService.process(requestId);
  }
}

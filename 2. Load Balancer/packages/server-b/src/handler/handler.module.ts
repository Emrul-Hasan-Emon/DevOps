import { Module } from '@nestjs/common';
import { HandlerController } from './handler.controller';
import { HandlerService } from './handler.service';

@Module({
  controllers: [HandlerController],
  providers: [HandlerService],
})
export class HandlerModule {}

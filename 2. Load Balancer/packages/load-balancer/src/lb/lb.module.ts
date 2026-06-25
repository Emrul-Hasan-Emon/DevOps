import { Module } from '@nestjs/common';
import { LbController } from './lb.controller';
import { LbService } from './lb.service';

@Module({
  controllers: [LbController],
  providers: [LbService],
})
export class LbModule {}

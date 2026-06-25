import { Module } from '@nestjs/common';
import { LbModule } from './lb/lb.module';

@Module({
  imports: [LbModule],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { HandlerModule } from './handler/handler.module';

@Module({
  imports: [HandlerModule],
})
export class AppModule {}

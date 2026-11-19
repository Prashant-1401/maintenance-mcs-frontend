import { Module } from '@nestjs/common';
import { KnowledgeBankController } from './knowledge-bank.controller';
import { KnowledgeBankService } from './knowledge-bank.service';

@Module({
  controllers: [KnowledgeBankController],
  providers: [KnowledgeBankService],
})
export class KnowledgeBankModule {}

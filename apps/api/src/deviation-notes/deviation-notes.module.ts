import { Module } from '@nestjs/common';
import { DeviationNotesController } from './deviation-notes.controller';
import { DeviationNotesService } from './deviation-notes.service';

@Module({
  controllers: [DeviationNotesController],
  providers: [DeviationNotesService],
  exports: [DeviationNotesService],
})
export class DeviationNotesModule {}

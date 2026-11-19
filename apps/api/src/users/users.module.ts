import { Module } from '@nestjs/common';
import { FileExportModule } from '../common/file-export.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [FileExportModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}

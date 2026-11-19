import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import type { Response } from 'express';
import { PermissionTier } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { KnowledgeBankService } from './knowledge-bank.service';
import { CreateKnowledgeBankDocumentDto } from './dto/create-knowledge-bank-document.dto';
import { CreateOperationalBaselineDto } from './dto/create-operational-baseline.dto';
import { CreateTroubleshootingPlaybookDto } from './dto/create-playbook.dto';

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'knowledge-bank');
if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
}

@Controller('knowledge-bank')
@UseGuards(JwtAuthGuard, RolesGuard)
export class KnowledgeBankController {
  constructor(private readonly knowledgeBankService: KnowledgeBankService) {}

  // 1. Documents & Manuals
  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('assetId') assetId?: string,
  ) {
    return this.knowledgeBankService.findAll({ search, category, assetId });
  }

  @Post()
  @Roles(PermissionTier.ADMIN, PermissionTier.MANAGEMENT, PermissionTier.TECHNICIAN)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${unique}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  create(
    @Body() dto: CreateKnowledgeBankDocumentDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.knowledgeBankService.create(dto, file, user.id);
  }

  @Get(':id/download')
  async download(@Param('id') id: string, @Res() res: Response) {
    const doc = await this.knowledgeBankService.findOne(id);
    res.download(doc.filePath, doc.fileName);
  }

  @Delete(':id')
  @Roles(PermissionTier.ADMIN, PermissionTier.MANAGEMENT)
  remove(@Param('id') id: string) {
    return this.knowledgeBankService.remove(id);
  }

  // 2. Machine Operational Baselines
  @Get('baselines/all')
  findBaselines(@Query('assetId') assetId?: string, @Query('search') search?: string) {
    return this.knowledgeBankService.findBaselines({ assetId, search });
  }

  @Post('baselines')
  @Roles(PermissionTier.ADMIN, PermissionTier.MANAGEMENT, PermissionTier.TECHNICIAN)
  createBaseline(@Body() dto: CreateOperationalBaselineDto) {
    return this.knowledgeBankService.createBaseline(dto);
  }

  @Patch('baselines/:id')
  @Roles(PermissionTier.ADMIN, PermissionTier.MANAGEMENT)
  updateBaseline(@Param('id') id: string, @Body() dto: Partial<CreateOperationalBaselineDto>) {
    return this.knowledgeBankService.updateBaseline(id, dto);
  }

  @Delete('baselines/:id')
  @Roles(PermissionTier.ADMIN, PermissionTier.MANAGEMENT)
  removeBaseline(@Param('id') id: string) {
    return this.knowledgeBankService.removeBaseline(id);
  }

  // 3. Troubleshooting Playbooks
  @Get('playbooks/all')
  findPlaybooks(
    @Query('search') search?: string,
    @Query('assetId') assetId?: string,
    @Query('assetCategory') assetCategory?: string,
  ) {
    return this.knowledgeBankService.findPlaybooks({ search, assetId, assetCategory });
  }

  @Post('playbooks')
  @Roles(PermissionTier.ADMIN, PermissionTier.MANAGEMENT, PermissionTier.TECHNICIAN)
  createPlaybook(@Body() dto: CreateTroubleshootingPlaybookDto) {
    return this.knowledgeBankService.createPlaybook(dto);
  }

  @Patch('playbooks/:id')
  @Roles(PermissionTier.ADMIN, PermissionTier.MANAGEMENT)
  updatePlaybook(@Param('id') id: string, @Body() dto: Partial<CreateTroubleshootingPlaybookDto>) {
    return this.knowledgeBankService.updatePlaybook(id, dto);
  }

  @Delete('playbooks/:id')
  @Roles(PermissionTier.ADMIN, PermissionTier.MANAGEMENT)
  removePlaybook(@Param('id') id: string) {
    return this.knowledgeBankService.removePlaybook(id);
  }
}


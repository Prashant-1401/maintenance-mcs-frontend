import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PredictiveService } from './predictive.service';

@Controller('predictive')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PredictiveController {
  constructor(private readonly service: PredictiveService) {}

  @Get('heatmap')
  heatmap(@Query('locationId') locationId?: string, @Query('mode') mode?: 'status' | 'deviations') {
    return this.service.heatmap(locationId, mode);
  }
}

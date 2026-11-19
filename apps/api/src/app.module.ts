import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { LocationsModule } from './locations/locations.module';
import { AssetsModule } from './assets/assets.module';
import { WorkOrdersModule } from './work-orders/work-orders.module';
import { BreakdownsModule } from './breakdowns/breakdowns.module';
import { PmChecklistTemplatesModule } from './pm-checklist-templates/pm-checklist-templates.module';
import { PmSchedulesModule } from './pm-schedules/pm-schedules.module';
import { PmWorkOrdersModule } from './pm-work-orders/pm-work-orders.module';
import { PredictiveModule } from './predictive/predictive.module';
import { RcaModule } from './rca/rca.module';
import { AiSuggestionsModule } from './ai-suggestions/ai-suggestions.module';
import { KpiModule } from './kpi/kpi.module';
import { RolesModule } from './roles/roles.module';
import { PendingJobSheetModule } from './pending-job-sheet/pending-job-sheet.module';
import { SparePartsModule } from './spare-parts/spare-parts.module';
import { PredictiveSchedulesModule } from './predictive-schedules/predictive-schedules.module';
import { PredictiveWorkOrdersModule } from './predictive-work-orders/predictive-work-orders.module';
import { DeviationNotesModule } from './deviation-notes/deviation-notes.module';
import { KnowledgeBankModule } from './knowledge-bank/knowledge-bank.module';
import { PredictiveChecklistTemplatesModule } from './predictive-checklist-templates/predictive-checklist-templates.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 120,
      },
    ]),
    PrismaModule,
    HealthModule,
    AuthModule,
    RolesModule,
    UsersModule,
    LocationsModule,
    AssetsModule,
    WorkOrdersModule,
    BreakdownsModule,
    PmChecklistTemplatesModule,
    PmSchedulesModule,
    PmWorkOrdersModule,
    PredictiveModule,
    RcaModule,
    AiSuggestionsModule,
    KpiModule,
    PendingJobSheetModule,
    SparePartsModule,
    PredictiveSchedulesModule,
    PredictiveWorkOrdersModule,
    DeviationNotesModule,
    KnowledgeBankModule,
    PredictiveChecklistTemplatesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}


import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { LaunchpadPage } from './pages/LaunchpadPage';
import { DashboardPage } from './pages/DashboardPage';
import { AssetsPage } from './pages/AssetsPage';
import { AssetDetailPage } from './pages/AssetDetailPage';
import { BreakdownsPage } from './pages/BreakdownsPage';
import { BreakdownDetailPage } from './pages/BreakdownDetailPage';
import { BreakdownHistoryPage } from './pages/BreakdownHistoryPage';
import { PmChecklistTemplatesPage } from './pages/PmChecklistTemplatesPage';
import { PredictiveChecklistTemplatesPage } from './pages/PredictiveChecklistTemplatesPage';
import { PmSchedulesPage } from './pages/PmSchedulesPage';
import { PmWorkOrderDetailPage } from './pages/PmWorkOrderDetailPage';
import { PredictiveSchedulesPage } from './pages/PredictiveSchedulesPage';
import { PredictiveWorkOrderDetailPage } from './pages/PredictiveWorkOrderDetailPage';
import { PredictiveHeatmapPage } from './pages/PredictiveHeatmapPage';
import { PreventiveHeatmapPage } from './pages/PreventiveHeatmapPage';
import { BreakdownHeatmapPage } from './pages/BreakdownHeatmapPage';
import { RcaPage } from './pages/RcaPage';
import { RcaTrackerPage } from './pages/RcaTrackerPage';
import { UsersPage } from './pages/UsersPage';
import { RolesPage } from './pages/RolesPage';
import { SparePartsPage } from './pages/SparePartsPage';
import { OpenOrdersPage } from './pages/OpenOrdersPage';
import { PendingJobSheetPage } from './pages/PendingJobSheetPage';
import { DeviationNotesPage } from './pages/DeviationNotesPage';
import { KnowledgeBankPage } from './pages/KnowledgeBankPage';
import { InventoryPage } from './pages/InventoryPage';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<LaunchpadPage />} />
          <Route path="/kpi-dashboard" element={<DashboardPage />} />
          <Route path="/open-orders" element={<OpenOrdersPage />} />
          <Route path="/pending-job-sheet" element={<PendingJobSheetPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/assets/:id" element={<AssetDetailPage />} />
          <Route path="/breakdowns" element={<BreakdownsPage />} />
          <Route path="/breakdowns/:id" element={<BreakdownDetailPage />} />
          <Route path="/pm-schedules" element={<PmSchedulesPage />} />
          <Route path="/pm-work-orders/:id" element={<PmWorkOrderDetailPage />} />
          <Route path="/predictive-schedules" element={<PredictiveSchedulesPage />} />
          <Route path="/predictive-work-orders/:id" element={<PredictiveWorkOrderDetailPage />} />
          <Route path="/predictive-heatmap" element={<PredictiveHeatmapPage />} />
          <Route path="/preventive-heatmap" element={<PreventiveHeatmapPage />} />
          <Route path="/breakdown-heatmap" element={<BreakdownHeatmapPage />} />
          <Route path="/rca" element={<RcaPage />} />
          <Route path="/rca-tracker" element={<RcaTrackerPage />} />
          <Route path="/deviation-notes" element={<DeviationNotesPage />} />
          <Route path="/knowledge-bank" element={<KnowledgeBankPage />} />
        </Route>

        <Route element={<ProtectedRoute tiers={['ADMIN', 'MANAGEMENT']} />}>
          <Route element={<Layout />}>
            <Route path="/breakdown-history" element={<BreakdownHistoryPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute tiers={['ADMIN']} />}>
          <Route element={<Layout />}>
            <Route path="/users" element={<UsersPage />} />
            <Route path="/roles" element={<RolesPage />} />
            <Route path="/assets" element={<AssetsPage />} />
            <Route path="/pm-checklist-templates" element={<PmChecklistTemplatesPage />} />
            <Route path="/predictive-checklist-templates" element={<PredictiveChecklistTemplatesPage />} />
            <Route path="/spare-parts" element={<SparePartsPage />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}

export default App;

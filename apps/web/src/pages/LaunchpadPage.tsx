import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { Logo } from '../components/Logo';
import type { PermissionTier, KpiDashboard } from '../lib/types';

interface FioriTile {
  id: string;
  title: string;
  subtitle: string;
  to: string;
  icon: string;
  badge?: string;
  tiers?: PermissionTier[];
}

interface FioriCatalog {
  title: string;
  subtitle: string;
  tiles: FioriTile[];
}

const CATALOGS: FioriCatalog[] = [
  {
    title: 'Daily Operations',
    subtitle: 'Shift execution, job sheets & spare consumption',
    tiles: [
      {
        id: 'analytics',
        title: 'KPI Analytics',
        subtitle: 'MTTR, MTBF & reliability trends',
        to: '/kpi-dashboard',
        icon: '📊',
        badge: 'Analytics',
      },
      {
        id: 'open-orders',
        title: 'Open Orders',
        subtitle: 'All in-progress and scheduled tasks',
        to: '/open-orders',
        icon: '📋',
        badge: 'Active Queue',
      },
      {
        id: 'pending-jobs',
        title: 'Pending Job Sheet',
        subtitle: 'Technician work assignments',
        to: '/pending-job-sheet',
        icon: '⏱️',
      },
      {
        id: 'inventory',
        title: 'Inventory & Spares',
        subtitle: 'Store usage & spare stock levels',
        to: '/inventory',
        icon: '📦',
      },
    ],
  },
  {
    title: 'Breakdown Maintenance',
    subtitle: 'Emergency line stoppage response & logs',
    tiles: [
      {
        id: 'breakdown-slips',
        title: 'Breakdown Slips',
        subtitle: 'Log line stoppage & assign mechanics',
        to: '/breakdowns',
        icon: '🚨',
        badge: 'Urgent',
      },
      {
        id: 'breakdown-heatmap',
        title: 'Breakdown Heat Map',
        subtitle: 'Machine failure frequency distribution',
        to: '/breakdown-heatmap',
        icon: '🗺️',
      },
      {
        id: 'breakdown-history',
        title: 'History Cards',
        subtitle: 'Equipment failure record history',
        to: '/breakdown-history',
        icon: '📜',
        tiers: ['ADMIN', 'MANAGEMENT'],
      },
    ],
  },
  {
    title: 'Preventive Maintenance (PM)',
    subtitle: 'Routine inspections & scheduled service',
    tiles: [
      {
        id: 'pm-schedules',
        title: 'PM Schedules',
        subtitle: 'Calendar & recurring checklist execution',
        to: '/pm-schedules',
        icon: '📅',
        badge: 'Scheduled',
      },
      {
        id: 'pm-heatmap',
        title: 'PM Heat Map',
        subtitle: 'Compliance & completion rate map',
        to: '/preventive-heatmap',
        icon: '📊',
      },
      {
        id: 'pm-deviations',
        title: 'PM Deviations',
        subtitle: 'Delayed or deferred maintenance notes',
        to: '/deviation-notes?type=PM',
        icon: '⚠️',
      },
    ],
  },
  {
    title: 'Predictive Maintenance (PdM)',
    subtitle: 'Condition monitoring, telemetry & alerts',
    tiles: [
      {
        id: 'pdm-schedules',
        title: 'PdM Schedules',
        subtitle: 'Vibration, temperature & oil checks',
        to: '/predictive-schedules',
        icon: '📈',
        badge: 'Condition',
      },
      {
        id: 'pdm-heatmap',
        title: 'PdM Heat Map',
        subtitle: 'Plant-wide predictive coverage map',
        to: '/predictive-heatmap',
        icon: '🗺️',
      },
      {
        id: 'pdm-deviations',
        title: 'PdM Deviations',
        subtitle: 'Condition anomalies and alerts',
        to: '/deviation-notes?type=PREDICTIVE',
        icon: '⚡',
      },
    ],
  },
  {
    title: 'Problem Solving & RCA',
    subtitle: 'Root cause analysis & corrective actions',
    tiles: [
      {
        id: 'rca',
        title: 'RCA Sheets',
        subtitle: '5-Why & Ishikawa fishbone analysis',
        to: '/rca',
        icon: '🎯',
      },
      {
        id: 'rca-tracker',
        title: 'RCA Action Tracker',
        subtitle: 'Corrective action verification status',
        to: '/rca-tracker',
        icon: '🛡️',
        badge: 'CAPA',
      },
    ],
  },
  {
    title: 'Master Data & Administration',
    subtitle: 'Asset registry, checklists & permissions',
    tiles: [
      {
        id: 'assets',
        title: 'Machine Master',
        subtitle: 'Asset hierarchy & equipment registry',
        to: '/assets',
        icon: '🏭',
        tiers: ['ADMIN'],
      },
      {
        id: 'users',
        title: 'User Management',
        subtitle: 'Personnel accounts & login access',
        to: '/users',
        icon: '👥',
        tiers: ['ADMIN'],
      },
      {
        id: 'roles',
        title: 'Roles & Capacity',
        subtitle: 'Permission tiers & mechanic capacity',
        to: '/roles',
        icon: '🔑',
        tiers: ['ADMIN'],
      },
      {
        id: 'pm-templates',
        title: 'PM Checklist Forms',
        subtitle: 'Standard checklist definitions',
        to: '/pm-checklist-templates',
        icon: '📝',
        tiers: ['ADMIN'],
      },
      {
        id: 'pdm-templates',
        title: 'PdM Checklist Forms',
        subtitle: 'Predictive parameter definitions',
        to: '/predictive-checklist-templates',
        icon: '📋',
        tiers: ['ADMIN'],
      },
      {
        id: 'spare-parts',
        title: 'Spare Parts Master',
        subtitle: 'Catalog codes, units & pricing',
        to: '/spare-parts',
        icon: '🔩',
        tiers: ['ADMIN'],
      },
      {
        id: 'knowledge-bank',
        title: 'Knowledge Bank',
        subtitle: 'Equipment manuals & SOPs',
        to: '/knowledge-bank',
        icon: '📚',
      },
    ],
  },
];

export function LaunchpadPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchFilter, setSearchFilter] = useState('');

  // Live KPI Summary
  const { data: kpiData } = useQuery<KpiDashboard>({
    queryKey: ['kpi-dashboard-summary'],
    queryFn: async () => {
      const res = await api.get<KpiDashboard>('/kpi/dashboard');
      return res.data;
    },
    staleTime: 60000,
  });

  const filteredCatalogs = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    return CATALOGS.map((catalog) => {
      if (selectedCategory !== 'all' && catalog.title !== selectedCategory) {
        return null;
      }

      const visibleTiles = catalog.tiles.filter((tile) => {
        if (tile.tiers && (!user || !tile.tiers.includes(user.tier))) {
          return false;
        }
        if (!q) return true;
        return (
          tile.title.toLowerCase().includes(q) ||
          tile.subtitle.toLowerCase().includes(q) ||
          catalog.title.toLowerCase().includes(q)
        );
      });

      if (visibleTiles.length === 0) return null;
      return { ...catalog, tiles: visibleTiles };
    }).filter(Boolean) as FioriCatalog[];
  }, [selectedCategory, searchFilter, user]);

  return (
    <div className="space-y-7 max-w-7xl mx-auto pb-16 animate-fade-in">
      {/* White & Orange Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 p-6 sm:p-8 text-white shadow-xl shadow-orange-500/20 border border-orange-400/30">
        {/* Subtle Decorative Background Circles */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute right-40 -bottom-20 h-56 w-56 rounded-full bg-amber-400/20 blur-xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="hidden sm:block p-1 bg-white/20 rounded-2xl backdrop-blur-md border border-white/30 shadow-lg">
              <Logo size="lg" showText={false} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-xs">
                Welcome, {user?.name || 'Operator'}
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-orange-100 max-w-xl font-medium leading-relaxed">
                Real-time plant maintenance dashboard. Select an application tile to log breakdowns, inspect schedules, or manage work orders.
              </p>
            </div>
          </div>

          {/* Quick Glassmorphic KPI Chips with Orange Highlights */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 bg-white/15 backdrop-blur-md p-3.5 rounded-2xl border border-white/25 shadow-lg shadow-black/5">
            <div className="text-center px-3.5 border-r border-white/20">
              <div className="text-[10px] text-orange-100 uppercase font-bold tracking-wider">MTTR</div>
              <div className="text-base font-extrabold text-white mt-0.5">
                {kpiData?.mttrMinutes != null ? `${Math.round(kpiData.mttrMinutes)}m` : '—'}
              </div>
            </div>
            <div className="text-center px-3.5 border-r border-white/20">
              <div className="text-[10px] text-orange-100 uppercase font-bold tracking-wider">MTBF</div>
              <div className="text-base font-extrabold text-white mt-0.5">
                {kpiData?.mtbfDaysOverall != null ? `${kpiData.mtbfDaysOverall.toFixed(1)}d` : '—'}
              </div>
            </div>
            <div className="text-center px-3.5">
              <div className="text-[10px] text-amber-200 uppercase font-bold tracking-wider">Breakdowns</div>
              <div className="text-base font-extrabold text-white mt-0.5">
                {kpiData?.breakdownCount ?? 0}
              </div>
            </div>
          </div>
        </div>

        {/* Catalog Filter Tabs & Search Bar */}
        <div className="mt-8 pt-6 border-t border-white/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Group Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none text-xs">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3.5 py-1.5 rounded-xl font-bold transition-all duration-200 whitespace-nowrap cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-white text-orange-600 shadow-md shadow-black/10 scale-102'
                  : 'bg-white/15 text-white hover:bg-white/25 backdrop-blur-xs'
              }`}
            >
              All Tiles
            </button>
            {CATALOGS.map((cat) => (
              <button
                key={cat.title}
                onClick={() => setSelectedCategory(cat.title)}
                className={`px-3.5 py-1.5 rounded-xl font-bold transition-all duration-200 whitespace-nowrap cursor-pointer ${
                  selectedCategory === cat.title
                    ? 'bg-white text-orange-600 shadow-md shadow-black/10 scale-102'
                    : 'bg-white/15 text-white hover:bg-white/25 backdrop-blur-xs'
                }`}
              >
                {cat.title}
              </button>
            ))}
          </div>

          {/* Quick Search */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Filter tiles..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full rounded-xl bg-white/20 border border-white/30 backdrop-blur-md px-3.5 py-1.5 text-xs text-white placeholder-orange-100 focus:outline-none focus:ring-2 focus:ring-white focus:bg-white/30 transition"
            />
            {searchFilter && (
              <button
                onClick={() => setSearchFilter('')}
                className="absolute inset-y-0 right-0 pr-3 text-xs text-white hover:text-white flex items-center font-bold"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Catalog Tile Sections */}
      <div className="space-y-10">
        {filteredCatalogs.map((catalog) => (
          <div key={catalog.title} className="space-y-3.5">
            {/* Catalog Group Header */}
            <div className="flex items-center justify-between border-b border-stone-200 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-orange-500" />
                <h2 className="text-base font-extrabold text-stone-900 tracking-tight">
                  {catalog.title}
                </h2>
                <span className="text-xs text-stone-400 font-medium hidden sm:inline">
                  — {catalog.subtitle}
                </span>
              </div>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-200">
                {catalog.tiles.length} app{catalog.tiles.length > 1 ? 's' : ''}
              </span>
            </div>

            {/* White & Orange SAP Fiori Tiles with Lift Animation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
              {catalog.tiles.map((tile) => (
                <button
                  key={tile.id}
                  onClick={() => navigate(tile.to)}
                  className="group relative text-left bg-white rounded-2xl p-5 border border-stone-200/90 shadow-2xs transition-all duration-300 ease-out flex flex-col justify-between h-44 cursor-pointer hover:-translate-y-1.5 hover:shadow-xl hover:shadow-orange-500/15 hover:border-orange-300 active:translate-y-0"
                >
                  {/* Subtle Top Orange Accent Pill on Hover */}
                  <div className="absolute top-0 left-6 right-6 h-1 rounded-b-md bg-gradient-to-r from-orange-500 to-amber-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  {/* Top Row: Icon + Badge */}
                  <div className="flex items-start justify-between w-full">
                    <div className="h-11 w-11 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-xl text-orange-600 group-hover:scale-110 group-hover:bg-gradient-to-br group-hover:from-orange-500 group-hover:to-amber-500 group-hover:text-white transition-all duration-300 shadow-2xs">
                      {tile.icon}
                    </div>
                    {tile.badge && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md border bg-orange-50 text-orange-700 border-orange-200/80 shadow-2xs">
                        {tile.badge}
                      </span>
                    )}
                  </div>

                  {/* Middle: Title & Subtitle */}
                  <div className="mt-2.5 flex-1">
                    <h3 className="font-extrabold text-sm text-stone-900 group-hover:text-orange-600 transition-colors duration-200">
                      {tile.title}
                    </h3>
                    <p className="text-xs text-stone-500 mt-1 line-clamp-2 leading-relaxed">
                      {tile.subtitle}
                    </p>
                  </div>

                  {/* Bottom: Action hint with animated arrow */}
                  <div className="mt-2 pt-2 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-400 group-hover:text-orange-600 font-semibold transition-colors duration-200">
                    <span>Open app</span>
                    <span className="text-orange-500 transform group-hover:translate-x-1.5 transition-transform duration-200">
                      →
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

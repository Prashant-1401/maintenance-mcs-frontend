import { useState, useMemo, useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useSyncStatus } from '../lib/offlineSync';
import { Logo } from './Logo';
import type { PermissionTier } from '../lib/types';

interface FioriApp {
  to: string;
  label: string;
  icon: string;
  category: string;
  tiers?: PermissionTier[];
}

const FIORI_APPS: FioriApp[] = [
  // Operations
  { to: '/', label: 'Launchpad', icon: '⊞', category: 'Operations' },
  { to: '/kpi-dashboard', label: 'KPI Analytics', icon: '📊', category: 'Operations' },
  { to: '/open-orders', label: 'Open Orders', icon: '📋', category: 'Operations' },
  { to: '/pending-job-sheet', label: 'Pending Job Sheet', icon: '⏱️', category: 'Operations' },
  { to: '/inventory', label: 'Inventory & Spares', icon: '📦', category: 'Operations' },

  // Breakdowns
  { to: '/breakdowns', label: 'Breakdown Slips', icon: '🚨', category: 'Breakdown' },
  { to: '/breakdown-heatmap', label: 'Breakdown Heat Map', icon: '🗺️', category: 'Breakdown' },
  { to: '/breakdown-history', label: 'Breakdown History', icon: '📜', category: 'Breakdown', tiers: ['ADMIN', 'MANAGEMENT'] },

  // Preventive
  { to: '/pm-schedules', label: 'PM Schedules', icon: '📅', category: 'Preventive' },
  { to: '/preventive-heatmap', label: 'PM Heat Map', icon: '📊', category: 'Preventive' },
  { to: '/deviation-notes?type=PM', label: 'PM Deviations', icon: '⚠️', category: 'Preventive' },

  // Predictive
  { to: '/predictive-schedules', label: 'PdM Schedules', icon: '📈', category: 'Predictive' },
  { to: '/predictive-heatmap', label: 'PdM Heat Map', icon: '🗺️', category: 'Predictive' },
  { to: '/deviation-notes?type=PREDICTIVE', label: 'PdM Deviations', icon: '⚡', category: 'Predictive' },

  // RCA
  { to: '/rca', label: 'RCA Sheets', icon: '🎯', category: 'Problem Solving' },
  { to: '/rca-tracker', label: 'RCA Tracker', icon: '🛡️', category: 'Problem Solving' },

  // Master Data
  { to: '/assets', label: 'Machine Master', icon: '🏭', category: 'Master Data', tiers: ['ADMIN'] },
  { to: '/users', label: 'Users', icon: '👥', category: 'Master Data', tiers: ['ADMIN'] },
  { to: '/roles', label: 'Roles & Permissions', icon: '🔑', category: 'Master Data', tiers: ['ADMIN'] },
  { to: '/pm-checklist-templates', label: 'PM Templates', icon: '📝', category: 'Master Data', tiers: ['ADMIN'] },
  { to: '/predictive-checklist-templates', label: 'PdM Templates', icon: '📋', category: 'Master Data', tiers: ['ADMIN'] },
  { to: '/spare-parts', label: 'Spare Parts Master', icon: '🔩', category: 'Master Data', tiers: ['ADMIN'] },
  { to: '/knowledge-bank', label: 'Knowledge Bank', icon: '📚', category: 'Master Data' },
];

function getPageTitle(pathname: string, search: string): string {
  if (pathname === '/') return 'Launchpad';
  const match = FIORI_APPS.find((app) => {
    const [path, query] = app.to.split('?');
    if (path !== pathname) return false;
    if (!query) return true;
    return search.replace(/^\?/, '') === query;
  });
  if (match) return match.label;
  if (pathname.startsWith('/assets/')) return 'Machine Detail';
  if (pathname.startsWith('/breakdowns/')) return 'Breakdown Slip Detail';
  if (pathname.startsWith('/pm-work-orders/')) return 'PM Order Detail';
  if (pathname.startsWith('/predictive-work-orders/')) return 'PdM Order Detail';
  return 'Application';
}

export function Layout() {
  const { user, logout } = useAuth();
  const { isOnline, queueCount, isSyncing, triggerSync } = useSyncStatus();
  const location = useLocation();
  const navigate = useNavigate();

  const isLaunchpad = location.pathname === '/';
  const pageTitle = getPageTitle(location.pathname, location.search);

  const [appLauncherOpen, setAppLauncherOpen] = useState(false);
  const [appSearch, setAppSearch] = useState('');
  const launcherRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (launcherRef.current && !launcherRef.current.contains(e.target as Node)) {
        setAppLauncherOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAppLauncherOpen(false);
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setAppLauncherOpen((prev) => !prev);
      }
    };
    if (appLauncherOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [appLauncherOpen]);

  const filteredApps = useMemo(() => {
    const q = appSearch.trim().toLowerCase();
    return FIORI_APPS.filter((app) => {
      if (app.tiers && (!user || !app.tiers.includes(user.tier))) return false;
      if (!q) return true;
      return (
        app.label.toLowerCase().includes(q) ||
        app.category.toLowerCase().includes(q)
      );
    });
  }, [appSearch, user]);

  const appsByCategory = useMemo(() => {
    const groups: Record<string, FioriApp[]> = {};
    for (const app of filteredApps) {
      if (!groups[app.category]) groups[app.category] = [];
      groups[app.category].push(app);
    }
    return groups;
  }, [filteredApps]);

  return (
    <div className="flex min-h-screen flex-col bg-stone-50 text-stone-900">
      {/* White & Orange SAP Fiori Top Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-orange-100 shadow-xs px-3 sm:px-6 py-2.5 transition-all duration-200">
        <div className="flex items-center justify-between gap-3 max-w-7xl mx-auto w-full">
          {/* Left: 9-Dot Launcher + Brand + Breadcrumbs */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* 9-Dot App Launcher Button */}
            <button
              onClick={() => {
                setAppLauncherOpen((prev) => !prev);
                setAppSearch('');
              }}
              className={`relative flex h-9 w-9 items-center justify-center rounded-xl border transition-all duration-200 ${
                appLauncherOpen
                  ? 'bg-gradient-to-br from-orange-500 to-amber-600 border-orange-500 text-white shadow-md shadow-orange-500/25 scale-105'
                  : 'bg-white border-stone-200 text-stone-700 hover:border-orange-300 hover:bg-orange-50/70 hover:text-orange-600 hover:scale-105 shadow-2xs'
              }`}
              title="Application Launcher (Ctrl+K)"
              aria-label="Open application launcher"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="5" cy="5" r="2.2" />
                <circle cx="12" cy="5" r="2.2" />
                <circle cx="19" cy="5" r="2.2" />
                <circle cx="5" cy="12" r="2.2" />
                <circle cx="12" cy="12" r="2.2" />
                <circle cx="19" cy="12" r="2.2" />
                <circle cx="5" cy="19" r="2.2" />
                <circle cx="12" cy="19" r="2.2" />
                <circle cx="19" cy="19" r="2.2" />
              </svg>
            </button>

            {/* Home Button (Icon only) */}
            <NavLink
              to="/"
              className={({ isActive }) =>
                `flex h-9 w-9 items-center justify-center rounded-xl border text-sm font-semibold transition-all duration-200 ${
                  isActive && isLaunchpad
                    ? 'bg-orange-50 text-orange-600 border-orange-200/80 shadow-2xs'
                    : 'bg-white border-stone-200 text-stone-600 hover:border-orange-300 hover:bg-orange-50/70 hover:text-orange-600 shadow-2xs'
                }`
              }
              title="Home"
              aria-label="Home"
            >
              <span className="text-sm text-orange-500">⊞</span>
            </NavLink>

            {/* Breadcrumb separator & Title */}
            {!isLaunchpad && (
              <div className="flex items-center gap-2 pl-2 border-l border-stone-200 text-xs">
                <button
                  onClick={() => navigate('/')}
                  className="text-stone-400 hover:text-orange-600 flex items-center gap-1 transition"
                  title="Back to Launchpad"
                >
                  <span>‹</span>
                  <span className="hidden md:inline font-medium">Home</span>
                </button>
                <span className="text-stone-300">/</span>
                <span className="font-bold text-orange-600 tracking-tight truncate max-w-[140px] sm:max-w-xs">
                  {pageTitle}
                </span>
              </div>
            )}
          </div>

          {/* Center Brand with SVG Logo */}
          <div className="hidden lg:flex items-center">
            <Logo size="sm" />
          </div>

          {/* Right: Search + Sync + User */}
          <div className="flex items-center gap-2 sm:gap-3 text-xs">
            {/* Quick Find Apps */}
            <button
              onClick={() => {
                setAppLauncherOpen(true);
                setAppSearch('');
              }}
              className="hidden md:flex items-center gap-2 rounded-xl bg-stone-50 border border-stone-200 px-3 py-1.5 text-stone-500 hover:border-orange-300 hover:text-orange-600 hover:bg-orange-50/50 transition-all duration-200 cursor-pointer shadow-2xs"
              title="Quick find application (Ctrl+K)"
            >
              <svg className="h-3.5 w-3.5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span>Search apps...</span>
              <kbd className="rounded-md bg-white border border-stone-200 px-1.5 py-0.5 text-[10px] text-stone-400 font-mono shadow-2xs">⌘K</kbd>
            </button>

            {/* Sync Badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border bg-white shadow-2xs">
              {!isOnline ? (
                <span className="flex items-center gap-1.5 text-amber-700">
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
                  <span className="hidden sm:inline">Offline</span>
                </span>
              ) : isSyncing ? (
                <span className="flex items-center gap-1.5 text-orange-600">
                  <span className="h-2 w-2 rounded-full bg-orange-500 animate-ping"></span>
                  <span className="hidden sm:inline">Syncing...</span>
                </span>
              ) : queueCount > 0 ? (
                <button
                  onClick={() => triggerSync()}
                  className="flex items-center gap-1.5 text-orange-700 hover:text-orange-800"
                  title="Click to sync local changes"
                >
                  <span className="h-2 w-2 rounded-full bg-orange-500"></span>
                  <span>{queueCount} queued</span>
                </button>
              ) : (
                <span className="flex items-center gap-1.5 text-emerald-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                  <span className="hidden sm:inline">Synced</span>
                </span>
              )}
            </div>

            {/* User Profile & Logout */}
            <div className="flex items-center gap-2 pl-2 border-l border-stone-200">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-600 text-xs font-bold text-white shadow-xs shadow-orange-500/30">
                {user?.name?.charAt(0) || 'U'}
              </span>
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-stone-900 text-xs font-semibold leading-none">{user?.name}</span>
                <span className="text-[10px] text-stone-500 mt-0.5">{user?.roleName}</span>
              </div>
              <button
                onClick={logout}
                className="rounded-lg border border-stone-200 p-1.5 text-stone-400 hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600 transition"
                title="Log out"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 9-Dot App Launcher Slide-Over / Popover Modal with Smooth Animation */}
      {appLauncherOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 pointer-events-auto">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs transition-opacity duration-300"
            onClick={() => setAppLauncherOpen(false)}
          />

          {/* Launcher Panel */}
          <div
            ref={launcherRef}
            className="relative z-50 w-full max-w-2xl max-h-[82vh] overflow-hidden rounded-3xl bg-white shadow-2xl border border-orange-100 flex flex-col animate-fade-in"
          >
            {/* Header: Orange Gradient */}
            <div className="p-5 bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 text-white">
              <div className="flex items-center justify-between pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">⊞</span>
                  <div>
                    <h2 className="text-sm font-extrabold tracking-tight uppercase">Applications</h2>
                    <p className="text-[11px] text-orange-100">Switch application or search modules</p>
                  </div>
                </div>
                <button
                  onClick={() => setAppLauncherOpen(false)}
                  className="rounded-xl p-1.5 text-white/80 hover:bg-white/20 hover:text-white transition"
                >
                  ✕
                </button>
              </div>

              {/* Search input in modal */}
              <div className="relative mt-1">
                <input
                  type="text"
                  autoFocus
                  placeholder="Type to filter apps (e.g. 'breakdown', 'pm', 'spares')..."
                  value={appSearch}
                  onChange={(e) => setAppSearch(e.target.value)}
                  className="w-full rounded-xl bg-white/15 border border-white/30 backdrop-blur-md px-3.5 py-2.5 text-xs text-white placeholder-orange-100 focus:outline-none focus:ring-2 focus:ring-white focus:bg-white/25 transition"
                />
                {appSearch && (
                  <button
                    onClick={() => setAppSearch('')}
                    className="absolute inset-y-0 right-0 pr-3.5 text-xs text-white/80 hover:text-white flex items-center font-medium"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Apps Grid */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6 max-h-[60vh] bg-stone-50/60">
              {Object.keys(appsByCategory).length === 0 ? (
                <div className="text-center py-12 text-stone-500 text-xs">
                  No applications match &ldquo;{appSearch}&rdquo;
                </div>
              ) : (
                Object.entries(appsByCategory).map(([category, apps]) => (
                  <div key={category} className="space-y-2.5">
                    <h3 className="text-xs font-bold text-orange-700 uppercase tracking-wider px-1 flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-orange-500"></span>
                      {category}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {apps.map((app) => (
                        <button
                          key={app.to}
                          onClick={() => {
                            setAppLauncherOpen(false);
                            navigate(app.to);
                          }}
                          className="flex items-center gap-3 p-3 rounded-2xl border border-stone-200/90 bg-white hover:border-orange-400 hover:bg-orange-50/50 hover:shadow-md hover:shadow-orange-500/10 hover:-translate-y-0.5 transition-all duration-200 text-left cursor-pointer group"
                        >
                          <div className="h-9 w-9 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-lg group-hover:scale-110 group-hover:bg-gradient-to-br group-hover:from-orange-500 group-hover:to-amber-500 group-hover:text-white transition-all duration-200 shadow-2xs">
                            {app.icon}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-stone-900 group-hover:text-orange-600 truncate transition">
                              {app.label}
                            </div>
                            <div className="text-[10px] text-stone-400 truncate">{category}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 bg-white border-t border-stone-200 text-[11px] text-stone-500 flex items-center justify-between">
              <span>Press <kbd className="px-1.5 py-0.5 rounded bg-stone-100 border border-stone-300 font-mono text-[10px]">Esc</kbd> to close</span>
              <span className="text-orange-600 font-semibold">Maintenance MCS</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
}

import React from 'react';
import {
  Activity,
  BarChart3,
  Layers,
  Users,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { AuditLogItem } from '../types/audit.types';

interface AuditAnalyticsChartsProps {
  logs: AuditLogItem[];
  totalLogsCount: number;
}

export const AuditAnalyticsCharts: React.FC<AuditAnalyticsChartsProps> = ({
  logs,
  totalLogsCount,
}) => {
  // 1. Compute Resource Types Count
  const resourceCounts: Record<string, number> = {};
  const actionCounts: Record<string, number> = {};
  const actorMap = new Set<string>();
  const dailyTimeline: Record<string, number> = {};

  logs.forEach((log) => {
    // Resource breakdown
    const rType = log.resource?.type || 'OTHER';
    resourceCounts[rType] = (resourceCounts[rType] || 0) + 1;

    // Action breakdown
    actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;

    // Unique actors
    if (log.actor?.email) {
      actorMap.add(log.actor.email);
    }

    // Daily distribution (last 7 days grouped by short date)
    const dateKey = new Date(log.createdAt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
    dailyTimeline[dateKey] = (dailyTimeline[dateKey] || 0) + 1;
  });

  const uniqueActorsCount = actorMap.size;
  const topActions = Object.entries(actionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const topResources = Object.entries(resourceCounts)
    .sort((a, b) => b[1] - a[1]);

  // Daily timeline entries (last 7 recorded slots)
  const timelineEntries = Object.entries(dailyTimeline).slice(-7);
  const maxDayCount = Math.max(...timelineEntries.map(([, count]) => count), 1);

  return (
    <div className="space-y-6">
      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Events */}
        <div className="glass-card rounded-2xl p-4 border border-slate-800/80 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Total Logged Events
            </span>
            <div className="text-2xl font-black text-white">
              {totalLogsCount.toLocaleString()}
            </div>
            <span className="text-[10px] text-brand-400 font-semibold flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              <span>Immutable Ledger</span>
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        {/* Unique Actors */}
        <div className="glass-card rounded-2xl p-4 border border-slate-800/80 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Active Users Tracked
            </span>
            <div className="text-2xl font-black text-white">
              {uniqueActorsCount.toLocaleString()}
            </div>
            <span className="text-[10px] text-indigo-400 font-semibold">
              Distinct Operators
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Resource Entities */}
        <div className="glass-card rounded-2xl p-4 border border-slate-800/80 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Resource Targets
            </span>
            <div className="text-2xl font-black text-white">
              {Object.keys(resourceCounts).length}
            </div>
            <span className="text-[10px] text-sky-400 font-semibold">
              Categorized Types
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        {/* Security / System Integrity */}
        <div className="glass-card rounded-2xl p-4 border border-slate-800/80 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Audit Compliance
            </span>
            <div className="text-2xl font-black text-emerald-400">
              100%
            </div>
            <span className="text-[10px] text-emerald-400/80 font-semibold">
              Strict Non-Repudiation
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 2 Graphic Chart Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Activity Timeline Graphic (Bar Chart) */}
        <div className="lg:col-span-2 glass-card rounded-2xl p-5 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-brand-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Audit Activity Trajectory
              </h3>
            </div>
            <span className="text-[10px] text-slate-500 font-semibold">
              Recent Activity Slots
            </span>
          </div>

          {timelineEntries.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-xs text-slate-500">
              No timeline logs recorded yet.
            </div>
          ) : (
            <div className="h-44 flex items-end justify-between gap-3 pt-4 px-2">
              {timelineEntries.map(([day, count]) => {
                const heightPct = Math.max(15, Math.round((count / maxDayCount) * 100));
                return (
                  <div key={day} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                    <span className="text-[10px] font-bold text-brand-300 opacity-0 group-hover:opacity-100 transition-opacity">
                      {count}
                    </span>
                    <div
                      style={{ height: `${heightPct}%` }}
                      className="w-full max-w-[42px] rounded-xl bg-gradient-to-t from-brand-600 to-violet-400 group-hover:from-brand-500 group-hover:to-pink-400 transition-all duration-300 shadow-md shadow-brand-500/20 relative"
                    >
                      <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 rounded-xl transition-opacity" />
                    </div>
                    <span className="text-[10px] font-semibold text-slate-400 whitespace-nowrap mt-1">
                      {day}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Resource Distribution Breakdown Progress */}
        <div className="glass-card rounded-2xl p-5 border border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-sky-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Resource Breakdown
              </h3>
            </div>
            <span className="text-[10px] text-slate-500 font-semibold">
              Distribution
            </span>
          </div>

          <div className="space-y-3.5">
            {topResources.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-4 text-center">No resource logs</p>
            ) : (
              topResources.map(([type, count]) => {
                const pct = Math.round((count / (logs.length || 1)) * 100);
                return (
                  <div key={type} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-300 uppercase tracking-wider text-[11px]">{type}</span>
                      <span className="text-slate-400 text-[11px]">
                        {count} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        style={{ width: `${pct}%` }}
                        className={`h-full rounded-full transition-all duration-500 ${
                          type === 'TASK'
                            ? 'bg-gradient-to-r from-indigo-500 to-brand-500'
                            : type === 'PROJECT'
                            ? 'bg-gradient-to-r from-sky-500 to-teal-400'
                            : type === 'USER' || type === 'SESSION'
                            ? 'bg-gradient-to-r from-amber-500 to-orange-400'
                            : 'bg-gradient-to-r from-purple-500 to-pink-500'
                        }`}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Top Actions Mini List */}
          {topActions.length > 0 && (
            <div className="pt-3 border-t border-slate-800/70 space-y-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Top Frequent Actions
              </span>
              <div className="flex flex-wrap gap-1.5">
                {topActions.map(([act, cnt]) => (
                  <span
                    key={act}
                    className="text-[10px] bg-slate-900 border border-slate-800 text-slate-300 px-2 py-0.5 rounded-lg flex items-center gap-1"
                  >
                    <span className="font-semibold truncate max-w-[120px]">{act}</span>
                    <span className="text-brand-400 font-bold">x{cnt}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

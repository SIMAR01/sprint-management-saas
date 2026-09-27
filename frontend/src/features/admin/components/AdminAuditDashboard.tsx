import React, { useState } from 'react';
import {
  Shield,
  Search,
  Filter,
  RefreshCw,
  Download,
  Clock,
  User,
  Globe,
  Eye,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  FileCode,
  Radio,
  FolderKanban,
  CheckSquare,
} from 'lucide-react';
import { useAuditLogsQuery } from '../hooks/useAuditQueries';
import { AuditLogItem } from '../types/audit.types';
import { AuditDetailModal } from './AuditDetailModal';
import { AuditAnalyticsCharts } from './AuditAnalyticsCharts';

const RESOURCE_TYPES = ['ALL', 'PROJECT', 'TASK', 'USER', 'SESSION'];

const COMMON_ACTIONS = [
  'ALL',
  'USER_LOGGED_IN',
  'USER_REGISTERED',
  'USER_LOGGED_OUT',
  'PROJECT_CREATED',
  'PROJECT_UPDATED',
  'PROJECT_DELETED',
  'PROJECT_ARCHIVED',
  'PROJECT_MEMBER_INVITED',
  'PROJECT_MEMBER_REMOVED',
  'TASK_CREATED',
  'TASK_UPDATED',
  'TASK_STATUS_UPDATED',
  'TASK_DELETED',
  'TASK_BULK_DELETED',
  'TASK_ATTACHMENT_ADDED',
  'TASK_ATTACHMENT_DELETED',
];

const getActionBadge = (action: string) => {
  const a = action.toUpperCase();
  if (a.includes('DELETE') || a.includes('REVOKED') || a.includes('REMOVE')) {
    return 'bg-red-500/10 text-red-400 border-red-500/30';
  }
  if (a.includes('CREATE') || a.includes('INVITE') || a.includes('REGISTER')) {
    return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
  }
  if (a.includes('UPDATE') || a.includes('STATUS') || a.includes('ASSIGN')) {
    return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
  }
  if (a.includes('LOGIN') || a.includes('AUTH')) {
    return 'bg-brand-500/10 text-brand-400 border-brand-500/30';
  }
  return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
};

export const AdminAuditDashboard: React.FC = () => {
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);
  const [selectedResourceType, setSelectedResourceType] = useState<string>('ALL');
  const [selectedAction, setSelectedAction] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLiveMonitor, setIsLiveMonitor] = useState<boolean>(false);

  const [selectedLogForInspect, setSelectedLogForInspect] = useState<AuditLogItem | null>(null);

  const {
    data: auditData,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useAuditLogsQuery(
    {
      page,
      limit,
      resourceType: selectedResourceType,
      action: selectedAction,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    },
    { isLive: isLiveMonitor }
  );

  const rawLogs = auditData?.logs || [];
  const pagination = auditData?.pagination || { total: 0, page: 1, limit, pages: 1 };

  // Local search filter matching actor email, action, resource name or correlation ID
  const filteredLogs = rawLogs.filter((log) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchAction = log.action.toLowerCase().includes(q);
    const matchEmail = (log.actor?.email || '').toLowerCase().includes(q);
    const matchResName = (log.resource?.name || '').toLowerCase().includes(q);
    const matchResId = String(log.resource?.id || '').toLowerCase().includes(q);
    const matchIp = (log.context?.ip || '').toLowerCase().includes(q);
    const matchCorr = (log.context?.correlationId || '').toLowerCase().includes(q);
    return matchAction || matchEmail || matchResName || matchResId || matchIp || matchCorr;
  });

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(rawLogs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `audit_logs_export_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handlePresetDate = (preset: 'today' | '7days' | '30days' | 'all') => {
    const now = new Date();
    setPage(1);
    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'today') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      setStartDate(startOfDay);
      setEndDate(now.toISOString());
    } else if (preset === '7days') {
      const past7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      setStartDate(past7);
      setEndDate(now.toISOString());
    } else if (preset === '30days') {
      const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      setStartDate(past30);
      setEndDate(now.toISOString());
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6 animate-fade-in pb-8">
      {/* Top Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-md shadow-brand-500/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white">
              Admin Audit & Compliance Console
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-brand-500/10 text-brand-300 text-[10px] font-extrabold border border-brand-500/30 uppercase tracking-wider">
              Restricted
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            System-wide immutable audit trails, actor forensic inspection, and activity analytics.
          </p>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Live Monitor Toggle */}
          {/* <button
            onClick={() => setIsLiveMonitor(!isLiveMonitor)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all shadow-sm ${isLiveMonitor
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40 animate-pulse'
              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>{isLiveMonitor ? 'Live Monitor Active (8s)' : 'Enable Live Stream'}</span>
          </button> */}

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-750 transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-brand-400' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportJson}
            disabled={rawLogs.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-tr from-brand-600 to-violet-500 hover:from-brand-500 hover:to-violet-400 active:scale-98 text-white rounded-xl text-xs font-semibold shadow-md shadow-brand-500/10 transition-all disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Ledger</span>
          </button>
        </div>
      </div>

      {/* Analytics Charts & Graphics */}
      <AuditAnalyticsCharts logs={rawLogs} totalLogsCount={pagination.total} />

      {/* Filter & Search Controls */}
      <div className="glass-card rounded-2xl p-5 border border-slate-800/80 space-y-4">
        {/* Row 1: Search & Date Presets */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-lg">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by action, operator email, resource ID/name, or IP address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
            />
          </div>

          {/* Quick Date Presets */}
          <div className="flex items-center gap-1.5 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80">
            <button
              onClick={() => handlePresetDate('all')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${!startDate && !endDate ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              All Time
            </button>
            <button
              onClick={() => handlePresetDate('today')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${startDate && !startDate.includes('-07') ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              Today
            </button>
            <button
              onClick={() => handlePresetDate('7days')}
              className="px-3 py-1 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
            >
              Last 7 Days
            </button>
            <button
              onClick={() => handlePresetDate('30days')}
              className="px-3 py-1 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
            >
              Last 30 Days
            </button>
          </div>
        </div>

        {/* Row 2: Secondary Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-slate-800/70 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
            <Filter className="w-3.5 h-3.5 text-brand-400" />
            <span>Refine Ledger:</span>
          </div>

          {/* Resource Type */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-[11px]">Resource:</span>
            <select
              value={selectedResourceType}
              onChange={(e) => {
                setSelectedResourceType(e.target.value);
                setPage(1);
              }}
              className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-brand-500 cursor-pointer"
            >
              {RESOURCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Action Type */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-[11px]">Action:</span>
            <select
              value={selectedAction}
              onChange={(e) => {
                setSelectedAction(e.target.value);
                setPage(1);
              }}
              className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-brand-500 cursor-pointer max-w-[200px]"
            >
              {COMMON_ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          {/* Per Page Count Selector */}
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-slate-500 text-[11px]">Rows:</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-brand-500 cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabular Data Grid View */}
      <div className="glass-card rounded-2xl border border-slate-800/80 overflow-hidden shadow-2xl flex flex-col">
        {isLoading ? (
          <div className="p-20 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-8 h-8 text-brand-500 animate-spin mb-3" />
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
              Querying distributed audit ledger...
            </p>
          </div>
        ) : error ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
            <h3 className="text-sm font-bold text-slate-200">Failed to load audit logs</h3>
            <p className="text-xs text-slate-400 mt-1">
              {(error as any)?.response?.data?.message || 'Access denied or server error occurred.'}
            </p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
              <Shield className="w-6 h-6 text-slate-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-200">No audit events match criteria</h3>
              <p className="text-xs text-slate-500 mt-1">
                Try loosening your filter parameters or search query.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-900/70 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Timestamp</th>
                  <th className="py-3.5 px-4">Action</th>
                  <th className="py-3.5 px-4">Operator / Actor</th>
                  <th className="py-3.5 px-4">Resource</th>
                  <th className="py-3.5 px-4">Network Context</th>
                  <th className="py-3.5 px-4">Diff / Changes</th>
                  <th className="py-3.5 px-4 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs text-slate-200">
                {filteredLogs.map((log) => {
                  const actionBadge = getActionBadge(log.action);
                  const hasDiff =
                    (log.diff?.before && Object.keys(log.diff.before).length > 0) ||
                    (log.diff?.after && Object.keys(log.diff.after).length > 0);

                  return (
                    <tr
                      key={log._id}
                      onClick={() => setSelectedLogForInspect(log)}
                      className="hover:bg-slate-850/50 transition-colors cursor-pointer group"
                    >
                      {/* Timestamp */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          <span className="font-medium text-slate-300">
                            {new Date(log.createdAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {new Date(log.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </span>
                        </div>
                      </td>

                      {/* Action Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${actionBadge}`}>
                          {log.action}
                        </span>
                      </td>

                      {/* Actor */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-white truncate max-w-[180px]">
                            {log.actor.email}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500 uppercase">
                            {log.actor.role}
                          </span>
                        </div>
                      </td>

                      {/* Resource */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          {log.resource.type === 'PROJECT' ? (
                            <FolderKanban className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                          ) : log.resource.type === 'TASK' ? (
                            <CheckSquare className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          ) : (
                            <User className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          )}
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-sky-400 uppercase">
                              {log.resource.type}
                            </span>
                            <span className="text-slate-300 text-xs truncate max-w-[150px]">
                              {log.resource.name || String(log.resource.id).substring(0, 10) + '...'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Network Context */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex flex-col text-[11px]">
                          <span className="font-mono text-slate-300 flex items-center gap-1">
                            <Globe className="w-3 h-3 text-slate-500" />
                            <span>{log.context?.ip || '127.0.0.1'}</span>
                          </span>
                          {log.context?.correlationId && (
                            <span className="font-mono text-[9px] text-slate-500 truncate max-w-[120px]" title={log.context.correlationId}>
                              cid: {log.context.correlationId.substring(0, 8)}...
                            </span>
                          )}
                        </div>
                      </td>

                      {/* State Diff */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {hasDiff ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                            <FileCode className="w-3 h-3" />
                            <span>State Diff</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-medium">-</span>
                        )}
                      </td>

                      {/* Action CTA */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLogForInspect(log);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-brand-600 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition-all inline-flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {pagination.pages > 1 && (
          <div className="px-6 py-3.5 bg-slate-900/70 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400">
              Page <span className="font-bold text-white">{pagination.page}</span> of{' '}
              <span className="font-bold text-white">{pagination.pages}</span> ({pagination.total} total logs)
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                disabled={page >= pagination.pages}
                className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Audit Detail Inspector Modal */}
      {selectedLogForInspect && (
        <AuditDetailModal
          log={selectedLogForInspect}
          onClose={() => setSelectedLogForInspect(null)}
        />
      )}
    </div>
  );
};

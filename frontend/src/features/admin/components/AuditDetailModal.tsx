import React, { useState } from 'react';
import {
  X,
  Shield,
  Clock,
  User,
  FolderKanban,
  CheckSquare,
  Globe,
  Terminal,
  Copy,
  Check,
  FileCode,
  Layers,
} from 'lucide-react';
import { AuditLogItem } from '../types/audit.types';

interface AuditDetailModalProps {
  log: AuditLogItem | null;
  onClose: () => void;
}

const getActionColor = (action: string) => {
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

export const AuditDetailModal: React.FC<AuditDetailModalProps> = ({ log, onClose }) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!log) return null;

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => {
      setCopiedField(null);
    }, 2000);
  };

  const actionClass = getActionColor(log.action);
  const diffBefore = log.diff?.before;
  const diffAfter = log.diff?.after;
  const hasDiff = (diffBefore && Object.keys(diffBefore).length > 0) || (diffAfter && Object.keys(diffAfter).length > 0);

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="glass-card w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden border border-slate-800 flex flex-col max-h-[92vh] animate-scale-in">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-brand-500/10 border border-brand-500/20 text-brand-400">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border uppercase ${actionClass}`}>
                {log.action}
              </span>
              <span className="text-xs text-slate-400 ml-2">
                Event ID: <span className="font-mono text-slate-300">{log._id.substring(0, 10)}...</span>
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 hover:bg-slate-800/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Metadata Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Actor Information */}
            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/70 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                <User className="w-4 h-4 text-brand-400" />
                <span>Actor Profile</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Email</span>
                  <span className="text-slate-200 font-semibold">{log.actor.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">System Role</span>
                  <span className="text-brand-300 font-bold uppercase">{log.actor.role}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">User ID</span>
                  <button
                    onClick={() => handleCopy(String(log.actor.userId), 'actorId')}
                    className="flex items-center gap-1 font-mono text-[11px] text-slate-400 hover:text-slate-200"
                  >
                    <span>{String(log.actor.userId).substring(0, 12)}...</span>
                    {copiedField === 'actorId' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Target Resource */}
            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/70 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                {log.resource.type === 'PROJECT' ? (
                  <FolderKanban className="w-4 h-4 text-sky-400" />
                ) : log.resource.type === 'TASK' ? (
                  <CheckSquare className="w-4 h-4 text-indigo-400" />
                ) : (
                  <Layers className="w-4 h-4 text-emerald-400" />
                )}
                <span>Target Resource</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Type</span>
                  <span className="text-sky-300 font-bold uppercase">{log.resource.type}</span>
                </div>
                {log.resource.name && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Name</span>
                    <span className="text-slate-200 font-medium truncate max-w-[160px]">{log.resource.name}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Resource ID</span>
                  <button
                    onClick={() => handleCopy(String(log.resource.id), 'resourceId')}
                    className="flex items-center gap-1 font-mono text-[11px] text-slate-400 hover:text-slate-200"
                  >
                    <span>{String(log.resource.id).substring(0, 12)}...</span>
                    {copiedField === 'resourceId' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Network Context */}
            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/70 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                <Globe className="w-4 h-4 text-emerald-400" />
                <span>Network Context</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">IP Address</span>
                  <span className="font-mono text-slate-200">{log.context?.ip || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Correlation ID</span>
                  {log.context?.correlationId ? (
                    <button
                      onClick={() => handleCopy(log.context.correlationId!, 'corrId')}
                      className="flex items-center gap-1 font-mono text-[11px] text-slate-400 hover:text-slate-200"
                    >
                      <span>{log.context.correlationId.substring(0, 12)}...</span>
                      {copiedField === 'corrId' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  ) : (
                    <span className="text-slate-500">N/A</span>
                  )}
                </div>
              </div>
            </div>

            {/* Timestamp & Timing */}
            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/70 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                <Clock className="w-4 h-4 text-purple-400" />
                <span>Recorded Timestamp</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Date</span>
                  <span className="text-slate-200 font-medium">
                    {new Date(log.createdAt).toLocaleDateString(undefined, {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Time (Local)</span>
                  <span className="text-slate-200 font-medium">
                    {new Date(log.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* User Agent String */}
          {log.context?.userAgent && (
            <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800/70">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Client User Agent
              </span>
              <p className="font-mono text-[11px] text-slate-300 break-all leading-relaxed">
                {log.context.userAgent}
              </p>
            </div>
          )}

          {/* State Diff / Changes Inspector */}
          {hasDiff && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                <FileCode className="w-4 h-4 text-amber-400" />
                <span>State Mutation Diff (Before ➔ After)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Before State */}
                <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 overflow-hidden">
                  <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-800">
                    <span className="text-[10px] font-bold text-red-400 uppercase">State Before</span>
                  </div>
                  <pre className="text-[11px] font-mono text-slate-300 overflow-x-auto max-h-48 scrollbar-thin">
                    {JSON.stringify(diffBefore || {}, null, 2)}
                  </pre>
                </div>

                {/* After State */}
                <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 overflow-hidden">
                  <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-800">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase">State After</span>
                  </div>
                  <pre className="text-[11px] font-mono text-slate-300 overflow-x-auto max-h-48 scrollbar-thin">
                    {JSON.stringify(diffAfter || {}, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* Metadata JSON Block */}
          {log.metadata && Object.keys(log.metadata).length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                <Terminal className="w-4 h-4 text-brand-400" />
                <span>Event Metadata</span>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 overflow-hidden">
                <pre className="text-[11px] font-mono text-slate-300 overflow-x-auto max-h-48 scrollbar-thin">
                  {JSON.stringify(log.metadata, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-900/60 border-t border-slate-800 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500">
            Immutable Audit Trail Record
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};

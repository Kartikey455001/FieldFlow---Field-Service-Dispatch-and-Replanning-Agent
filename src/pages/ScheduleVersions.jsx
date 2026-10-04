import React, { useState, useMemo } from 'react';
import {
  GitBranch,
  RotateCcw,
  CheckCircle,
  Eye,
  AlertCircle,
  ArrowRight,
  Layers,
} from 'lucide-react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { useDispatch } from '../context/useDispatch';
import { compareScheduleVersions } from '../utils/versionComparator';

export default function ScheduleVersions() {
  const { scheduleVersions, rollbackToVersion } = useDispatch();
  const [selectedVersion, setSelectedVersion] = useState(scheduleVersions[0]?.version || 'v3');
  const [toastMessage, setToastMessage] = useState('');
  const [inspectModalVersion, setInspectModalVersion] = useState(null);

  // Dynamic version comparison selection
  const [fromVersionLabel, setFromVersionLabel] = useState(
    scheduleVersions.length > 1 ? scheduleVersions[1].version : scheduleVersions[0]?.version || 'v2'
  );
  const [toVersionLabel, setToVersionLabel] = useState(
    scheduleVersions[0]?.version || 'v3'
  );

  // Filter for diff changes
  const [diffFilter, setDiffFilter] = useState('All'); // 'All' | 'Added' | 'Changed' | 'Removed' | 'Flagged' | 'Unchanged'

  const fromVersionObj = useMemo(() => {
    return scheduleVersions.find((v) => v.version === fromVersionLabel) || scheduleVersions[1] || scheduleVersions[0];
  }, [scheduleVersions, fromVersionLabel]);

  const toVersionObj = useMemo(() => {
    return scheduleVersions.find((v) => v.version === toVersionLabel) || scheduleVersions[0];
  }, [scheduleVersions, toVersionLabel]);

  // Dynamically compute the diff between selected versions
  const comparisonResult = useMemo(() => {
    return compareScheduleVersions(fromVersionObj, toVersionObj);
  }, [fromVersionObj, toVersionObj]);

  const filteredChanges = useMemo(() => {
    if (diffFilter === 'All') return comparisonResult.changes;
    return comparisonResult.changes.filter(
      (c) => c.changeType.toLowerCase() === diffFilter.toLowerCase()
    );
  }, [comparisonResult, diffFilter]);

  const handleRollback = async (ver) => {
    const res = await rollbackToVersion(ver);
    if (res && res.success) {
      setToastMessage(`Rollback successful! Schedule reverted to ${ver}.`);
    } else {
      setToastMessage(res?.message || `Rollback to ${ver} failed.`);
    }
    setTimeout(() => setToastMessage(''), 4500);
  };

  const getChangeBadgeVariant = (type) => {
    switch (type) {
      case 'Added':
        return 'success';
      case 'Changed':
        return 'info';
      case 'Removed':
        return 'danger';
      case 'Flagged':
        return 'warning';
      default:
        return 'neutral';
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] px-4 py-3 rounded-xl flex items-center justify-between shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle className="w-4 h-4 text-[#10B981]" />
            <span>{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage('')}
            className="text-xs text-[#065F46] underline hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-soft">
        <div className="flex items-center gap-2">
          <h2 className="text-xl sm:text-2xl font-bold text-[#172033] tracking-tight">
            Schedule Versions
          </h2>
          <Badge variant="info">
            <GitBranch className="w-3 h-3 text-[#4F46E5] mr-1" />
            {scheduleVersions.length} Revisions Recorded
          </Badge>
        </div>
        <p className="text-xs sm:text-sm text-[#6B7280] mt-1">
          Trace every automated replan iteration, manual dispatcher adjustment, and diff between versions.
        </p>
      </div>

      {/* Version History Table */}
      <Card padding="p-0" className="overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#172033]">
              Revision History
            </h3>
            <p className="text-xs text-[#6B7280]">
              Chronological snapshots generated today (Immutable Snapshots)
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-gray-200 text-[#6B7280] uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Version</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Created By</th>
                <th className="py-3 px-4">Created At</th>
                <th className="py-3 px-4">Reason / Trigger</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {scheduleVersions.map((ver) => (
                <tr
                  key={ver.version}
                  className={`hover:bg-slate-50 transition-colors ${
                    selectedVersion === ver.version ? 'bg-indigo-50/40' : ''
                  }`}
                >
                  <td className="py-3.5 px-4 font-bold text-[#172033]">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-[#4F46E5]">
                        {ver.version}
                      </span>
                      {ver.isCurrent && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-bold uppercase">
                          Current
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <Badge
                      variant={ver.status === 'Draft' ? 'warning' : 'success'}
                      dot
                    >
                      {ver.status}
                    </Badge>
                  </td>
                  <td className="py-3.5 px-4 font-medium text-[#172033]">
                    {ver.createdBy}
                  </td>
                  <td className="py-3.5 px-4 text-[#6B7280] font-mono">
                    {ver.createdAt}
                  </td>
                  <td className="py-3.5 px-4 text-[#172033] max-w-sm truncate">
                    {ver.reason}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant={selectedVersion === ver.version ? 'primary' : 'ghost'}
                        size="sm"
                        icon={Eye}
                        onClick={() => {
                          setSelectedVersion(ver.version);
                          setInspectModalVersion(ver);
                        }}
                      >
                        Inspect
                      </Button>
                      {!ver.isCurrent && (
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={RotateCcw}
                          onClick={() => handleRollback(ver.version)}
                        >
                          Rollback
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Dynamic Version Comparison Card (Section 13) */}
      <Card padding="p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-gray-100 mb-4">
          <div>
            <h3 className="text-base font-bold text-[#172033] flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#4F46E5]" />
              Version Comparison: {fromVersionObj.version} → {toVersionObj.version}
            </h3>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Side-by-side comparison of ADDED, REMOVED, CHANGED, UNCHANGED, and FLAGGED assignments.
            </p>
          </div>

          {/* Selectors for From and To Versions */}
          <div className="flex items-center gap-3 text-xs flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-[#6B7280] font-medium">From:</span>
              <select
                className="rounded-lg border border-gray-200 py-1.5 px-2.5 bg-white text-[#172033] font-mono focus:border-[#4F46E5]"
                value={fromVersionLabel}
                onChange={(e) => setFromVersionLabel(e.target.value)}
              >
                {scheduleVersions.map((v) => (
                  <option key={`from-${v.version}`} value={v.version}>
                    {v.version} ({v.status})
                  </option>
                ))}
              </select>
            </div>

            <ArrowRight className="w-3.5 h-3.5 text-gray-400" />

            <div className="flex items-center gap-1.5">
              <span className="text-[#6B7280] font-medium">To:</span>
              <select
                className="rounded-lg border border-gray-200 py-1.5 px-2.5 bg-white text-[#172033] font-mono focus:border-[#4F46E5]"
                value={toVersionLabel}
                onChange={(e) => setToVersionLabel(e.target.value)}
              >
                {scheduleVersions.map((v) => (
                  <option key={`to-${v.version}`} value={v.version}>
                    {v.version} ({v.status})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Diff Metric Summary Pills */}
        <div className="flex items-center gap-2 flex-wrap mb-4 pb-3 border-b border-gray-100 text-xs">
          <button
            type="button"
            onClick={() => setDiffFilter('All')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              diffFilter === 'All'
                ? 'bg-[#4F46E5] text-white'
                : 'bg-slate-100 text-[#172033] hover:bg-slate-200'
            }`}
          >
            All Changes ({comparisonResult.changes.length})
          </button>
          <button
            type="button"
            onClick={() => setDiffFilter('Changed')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors border ${
              diffFilter === 'Changed'
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
            }`}
          >
            {comparisonResult.counts.changed} Changed
          </button>
          <button
            type="button"
            onClick={() => setDiffFilter('Added')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors border ${
              diffFilter === 'Added'
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            {comparisonResult.counts.added} Added
          </button>
          <button
            type="button"
            onClick={() => setDiffFilter('Flagged')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors border ${
              diffFilter === 'Flagged'
                ? 'bg-amber-600 text-white border-amber-600'
                : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
            }`}
          >
            {comparisonResult.counts.flagged} Flagged
          </button>
          <button
            type="button"
            onClick={() => setDiffFilter('Removed')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors border ${
              diffFilter === 'Removed'
                ? 'bg-rose-600 text-white border-rose-600'
                : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
            }`}
          >
            {comparisonResult.counts.removed} Removed
          </button>
          <button
            type="button"
            onClick={() => setDiffFilter('Unchanged')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors border ${
              diffFilter === 'Unchanged'
                ? 'bg-slate-700 text-white border-slate-700'
                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
            }`}
          >
            {comparisonResult.counts.unchanged} Unchanged
          </button>
        </div>

        {/* Changes Diff List */}
        <div className="space-y-3.5">
          {filteredChanges.length > 0 ? (
            filteredChanges.map((change) => (
              <div
                key={change.requestId}
                className="p-4 rounded-xl border border-gray-200/80 bg-slate-50/50 space-y-3 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="font-bold text-sm text-[#172033]">
                      {change.requestId}
                    </span>
                    <span className="text-xs font-medium text-[#4F46E5] bg-white px-2 py-0.5 rounded border border-gray-200">
                      {change.serviceType}
                    </span>
                    <span className="text-xs text-[#6B7280]">
                      ({change.customer})
                    </span>
                    <Badge variant={getChangeBadgeVariant(change.changeType)} size="sm">
                      {change.changeType}
                    </Badge>
                  </div>
                  <span className="text-xs text-[#6B7280] italic">
                    {change.description}
                  </span>
                </div>

                {/* Diff Comparison Grid (BEFORE -> AFTER) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {/* Previous State (BEFORE) */}
                  <div className="p-3 rounded-lg bg-white border border-gray-200/70">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280] block mb-1">
                      BEFORE ({fromVersionObj.version})
                    </span>
                    <div className="space-y-1">
                      <div className="font-medium text-[#172033]">
                        Technician: <span className="font-semibold">{change.from.technician}</span>
                      </div>
                      <div className="text-gray-500 font-mono text-[11px]">
                        Time: {change.from.timeWindow}
                      </div>
                      <div className="text-gray-600 text-[11px]">
                        Status: <span className="font-medium text-slate-700">{change.from.status || 'ASSIGNED'}</span>
                      </div>
                    </div>
                  </div>

                  {/* New State (AFTER) */}
                  <div className="p-3 rounded-lg bg-indigo-50/50 border border-indigo-200">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#4F46E5] block mb-1">
                      AFTER ({toVersionObj.version})
                    </span>
                    <div className="space-y-1">
                      <div className="font-semibold text-[#172033]">
                        Technician: <span className="text-[#4F46E5]">{change.to.technician}</span>
                      </div>
                      <div className="text-indigo-900 font-mono text-[11px]">
                        Time: {change.to.timeWindow}
                      </div>
                      <div className="text-indigo-800 text-[11px]">
                        Status: <span className="font-semibold text-indigo-950">{change.to.status || 'ASSIGNED'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reason Explanation */}
                <div className="text-xs text-[#6B7280] flex items-start gap-1.5 pt-1 border-t border-gray-200/60">
                  <AlertCircle className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-[#172033]">Reason:</strong> {change.reason}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-xs text-gray-400 italic">
              No assignments match the selected diff filter ({diffFilter}).
            </div>
          )}
        </div>
      </Card>

      {/* Inspect Snapshot Modal */}
      <Modal
        isOpen={Boolean(inspectModalVersion)}
        onClose={() => setInspectModalVersion(null)}
        title={`Version Snapshot: ${inspectModalVersion?.version || ''}`}
        subtitle={`Created ${inspectModalVersion?.createdAt} by ${inspectModalVersion?.createdBy}`}
        footer={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setInspectModalVersion(null)}
          >
            Close
          </Button>
        }
      >
        {inspectModalVersion && (
          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-50 border border-gray-200 space-y-1">
              <span className="font-semibold text-[#172033]">Trigger Reason:</span>
              <p className="text-[#6B7280]">{inspectModalVersion.reason}</p>
            </div>

            <h5 className="font-bold text-[#172033] pt-1">Assignments Snapshot:</h5>
            <div className="max-h-60 overflow-y-auto space-y-2 divide-y divide-gray-100 pr-1">
              {(inspectModalVersion.assignmentsSnapshot || []).map((asg) => (
                <div key={asg.id || asg.requestId} className="pt-2 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-[#172033]">{asg.requestId || asg.id}</span>
                    <span className="text-gray-500 ml-2">({asg.skill || asg.serviceType})</span>
                    <p className="text-[#6B7280]">{asg.customer}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-[#4F46E5] block">
                      {asg.technician || 'Unassigned'}
                    </span>
                    <span className="font-mono text-gray-500 text-[11px]">
                      {asg.timeSlot || `${asg.startTime} – ${asg.endTime}`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

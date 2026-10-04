import React, { useState } from 'react';
import {
  ShieldCheck,
  Filter,
  Search,
  Bot,
  User,
  Clock,
} from 'lucide-react';
import Card, { CardHeader } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Input from '../components/ui/Input';
import EmptyState from '../components/common/EmptyState';
import { useDispatch } from '../context/useDispatch';

export default function AuditLog() {
  const { auditEvents } = useDispatch();
  const [searchTerm, setSearchTerm] = useState('');
  const [actorFilter, setActorFilter] = useState('All');
  const [actionFilter, setActionFilter] = useState('All');

  const filteredEvents = auditEvents.filter((evt) => {
    const matchesSearch =
      evt.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      evt.actor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      evt.entity.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesActor =
      actorFilter === 'All' || evt.actorType === actorFilter;

    const matchesAction =
      actionFilter === 'All' || evt.action.toLowerCase() === actionFilter.toLowerCase();

    return matchesSearch && matchesActor && matchesAction;
  });

  const getActorBadge = (actorType) => {
    switch (actorType) {
      case 'system':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Bot className="w-3 h-3" /> System AI
          </span>
        );
      case 'technician':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <User className="w-3 h-3" /> Technician
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
            <User className="w-3 h-3" /> Dispatcher
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-soft">
        <div className="flex items-center gap-2">
          <h2 className="text-xl sm:text-2xl font-bold text-[#172033] tracking-tight">
            Audit Log
          </h2>
          <Badge variant="info">
            <ShieldCheck className="w-3 h-3 text-[#4F46E5] mr-1" />
            Immutable Trail
          </Badge>
        </div>
        <p className="text-xs sm:text-sm text-[#6B7280] mt-1">
          Detailed chronological trace of manual dispatcher decisions, AI constraint runs, and operational overrides.
        </p>
      </div>

      {/* Filter and Search */}
      <Card padding="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <Input
              placeholder="Search actions, actors, or affected work orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              icon={Search}
            />
          </div>
          <div>
            <select
              className="w-full rounded-lg border border-gray-200 text-xs py-2 px-3 bg-white text-[#172033] focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5]"
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              aria-label="Filter by actor"
            >
              <option value="All">All Actors</option>
              <option value="user">Dispatcher</option>
              <option value="system">AI System</option>
              <option value="technician">Technician</option>
            </select>
          </div>
          <div>
            <select
              className="w-full rounded-lg border border-gray-200 text-xs py-2 px-3 bg-white text-[#172033] focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5]"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              aria-label="Filter by event type"
            >
              <option value="All">All Event Types</option>
              <option value="MANUAL_OVERRIDE">MANUAL_OVERRIDE</option>
              <option value="REQUEST_CREATED">REQUEST_CREATED</option>
              <option value="REQUEST_ASSIGNED">REQUEST_ASSIGNED</option>
              <option value="REQUEST_REASSIGNED">REQUEST_REASSIGNED</option>
              <option value="REQUEST_CANCELLED">REQUEST_CANCELLED</option>
              <option value="REQUEST_COMPLETED">REQUEST_COMPLETED</option>
              <option value="AI_PLAN_GENERATED">AI_PLAN_GENERATED</option>
              <option value="AI_PLAN_APPROVED">AI_PLAN_APPROVED</option>
              <option value="AI_PLAN_REJECTED">AI_PLAN_REJECTED</option>
              <option value="SCHEDULE_REPLANNED">SCHEDULE_REPLANNED</option>
              <option value="VERSION_CREATED">VERSION_CREATED</option>
              <option value="TECHNICIAN_UNAVAILABLE">TECHNICIAN_UNAVAILABLE</option>
              <option value="EMERGENCY_CREATED">EMERGENCY_CREATED</option>
              <option value="REVISED_PLAN_GENERATED">REVISED_PLAN_GENERATED</option>
              <option value="REVISED_PLAN_APPROVED">REVISED_PLAN_APPROVED</option>
              <option value="Schedule approved">Schedule approved</option>
              <option value="Constraint violation rejected">Constraint violation rejected</option>
              <option value="Missing-information question answered">Missing-information question answered</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Timeline List */}
      <Card padding="p-5">
        <CardHeader
          title="Activity Log"
          subtitle={`Showing ${filteredEvents.length} recorded events`}
        />

        {filteredEvents.length > 0 ? (
          <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
            {filteredEvents.map((evt) => (
              <div key={evt.id} className="relative group">
                {/* Timeline Dot */}
                <div className="absolute -left-[27px] top-1 w-4 h-4 rounded-full border-2 border-white bg-[#4F46E5] shadow-xs group-hover:scale-125 transition-transform" />

                <div className="p-4 rounded-xl border border-gray-200/80 bg-white hover:bg-slate-50/50 transition-colors shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-gray-100">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-bold text-sm text-[#172033]">
                        {evt.action}
                      </span>
                      {getActorBadge(evt.actorType)}
                      {evt.source && (
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                          Source: {evt.source}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-[#6B7280] font-mono">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      <span>{evt.timestamp}</span>
                    </div>
                  </div>

                  <div className="pt-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <p className="text-[#172033] font-medium">
                      {evt.entity}
                    </p>
                    <span className="text-[11px] text-[#6B7280]">
                      Actor: <strong className="text-[#172033]">{evt.actor}</strong>
                    </span>
                  </div>

                  {/* Before -> After state change if logged */}
                  {(evt.previousState || evt.newState) && (
                    <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-2 text-[11px]">
                      <span className="text-gray-500">State Change:</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-slate-700">
                        {evt.previousState || 'None'}
                      </span>
                      <span className="text-gray-400">→</span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 font-mono font-semibold">
                        {evt.newState || 'None'}
                      </span>
                    </div>
                  )}

                  {/* Reason if logged */}
                  {evt.reason && (
                    <p className="mt-1 text-[11px] text-[#6B7280] italic">
                      <strong className="text-slate-700 not-italic">Reason: </strong>
                      {evt.reason}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Filter}
            title="No audit events found"
            description="No logged events match the selected criteria."
            actionLabel="Reset Search"
            onAction={() => {
              setSearchTerm('');
              setActorFilter('All');
            }}
          />
        )}
      </Card>
    </div>
  );
}

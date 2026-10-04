import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Eye,
  Filter,
  MapPin,
  Clock,
  Wrench,
  CheckCircle,
  AlertCircle,
  X,
  Lock,
  ArrowRightCircle,
  Play,
  Check,
  Ban,
  RotateCcw,
} from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Drawer from '../components/ui/Drawer';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import EmptyState from '../components/common/EmptyState';
import { useDispatch } from '../context/useDispatch';
import {
  normalizeStatus,
  ALLOWED_TRANSITIONS,
} from '../utils/statusTransitions';

export default function ServiceRequests() {
  const { requests, createNewRequest, updateRequestStatus, auditEvents } = useDispatch();
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [regionFilter, setRegionFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isNewRequestModalOpen, setIsNewRequestModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // New Request Form State
  const [newRequest, setNewRequest] = useState({
    customer: '',
    phone: '',
    skill: 'AC Repair',
    region: 'Jaipur North',
    priority: 'Normal',
    duration: '2 hours',
    preferredWindow: '10:00 - 13:00',
    notes: '',
  });

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    await createNewRequest(newRequest);
    setIsNewRequestModalOpen(false);
    setToastMessage('New service request submitted and added to queue.');
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      const matchesSearch =
        req.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.requiredSkill.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.location.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesPriority =
        priorityFilter === 'All' || req.priority === priorityFilter;
      const matchesRegion =
        regionFilter === 'All' || req.region === regionFilter;
      const matchesStatus =
        statusFilter === 'All' ||
        normalizeStatus(req.status) === normalizeStatus(statusFilter);

      return matchesSearch && matchesPriority && matchesRegion && matchesStatus;
    });
  }, [requests, searchTerm, priorityFilter, regionFilter, statusFilter]);

  const getPriorityBadgeVariant = (priority) => {
    switch (priority) {
      case 'Critical':
        return 'danger';
      case 'High':
        return 'warning';
      case 'Medium':
        return 'info';
      default:
        return 'neutral';
    }
  };

  const getStatusBadgeVariant = (status) => {
    const norm = normalizeStatus(status);
    switch (norm) {
      case 'COMPLETED':
        return 'success';
      case 'IN_PROGRESS':
        return 'info';
      case 'ASSIGNED':
        return 'neutral';
      case 'UNASSIGNED':
        return 'danger';
      case 'PENDING_APPROVAL':
        return 'warning';
      case 'EMERGENCY':
        return 'danger';
      case 'BLOCKED':
        return 'warning';
      case 'CANCELLED':
        return 'neutral';
      default:
        return 'neutral';
    }
  };

  const handleStatusTransition = async (targetStatus) => {
    if (!selectedRequest) return;
    const res = await updateRequestStatus({
      requestId: selectedRequest.id,
      newStatus: targetStatus,
      reason: `Dispatcher manual status transition to ${targetStatus}`,
    });

    if (res && res.success) {
      setSelectedRequest((prev) => ({
        ...prev,
        status: res.newStatus,
        isProtectedCompleted: res.newStatus === 'COMPLETED' ? true : prev.isProtectedCompleted,
      }));
      setToastMessage(`${selectedRequest.id} status successfully transitioned to ${res.newStatus}.`);
    } else {
      setToastMessage(`Transition rejected: ${res?.error || 'Transition error'}`);
    }
    setTimeout(() => setToastMessage(''), 4500);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setPriorityFilter('All');
    setRegionFilter('All');
    setStatusFilter('All');
  };

  const hasActiveFilters =
    searchTerm !== '' ||
    priorityFilter !== 'All' ||
    regionFilter !== 'All' ||
    statusFilter !== 'All';

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

      {/* Header and New Request Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-gray-200/80 shadow-soft">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-[#172033] tracking-tight">
              Service Requests
            </h2>
            <Badge variant="info">
              {filteredRequests.length} / {requests.length} Requests
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-[#6B7280] mt-1">
            Dispatch, filter, and inspect incoming field tickets across all regions.
          </p>
        </div>

        <Button
          variant="primary"
          icon={Plus}
          onClick={() => setIsNewRequestModalOpen(true)}
        >
          New Request
        </Button>
      </div>

      {/* Search and Filter Controls */}
      <Card padding="p-4" className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-center">
          {/* Search Box */}
          <div className="lg:col-span-2">
            <Input
              placeholder="Search by ID, customer, skill, location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              icon={Search}
            />
          </div>

          {/* Priority Filter */}
          <div>
            <select
              className="w-full rounded-lg border border-gray-200 text-xs py-2 px-3 bg-white text-[#172033] focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5]"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              aria-label="Filter by priority"
            >
              <option value="All">All Priorities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Normal">Normal</option>
            </select>
          </div>

          {/* Region Filter */}
          <div>
            <select
              className="w-full rounded-lg border border-gray-200 text-xs py-2 px-3 bg-white text-[#172033] focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5]"
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              aria-label="Filter by region"
            >
              <option value="All">All Regions</option>
              <option value="Jaipur North">Jaipur North</option>
              <option value="Jaipur Central">Jaipur Central</option>
              <option value="Jaipur South">Jaipur South</option>
              <option value="Jaipur West">Jaipur West</option>
              <option value="Jaipur East">Jaipur East</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              className="w-full rounded-lg border border-gray-200 text-xs py-2 px-3 bg-white text-[#172033] focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5]"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
            >
              <option value="All">All Statuses</option>
              <option value="ASSIGNED">ASSIGNED (Scheduled)</option>
              <option value="UNASSIGNED">UNASSIGNED</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="PENDING_APPROVAL">PENDING_APPROVAL</option>
              <option value="CANCELLED">CANCELLED</option>
              <option value="BLOCKED">BLOCKED</option>
            </select>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs text-[#6B7280]">
            <span>Showing filtered results</span>
            <button
              onClick={clearFilters}
              className="text-[#4F46E5] hover:underline flex items-center gap-1 font-medium"
            >
              <X className="w-3.5 h-3.5" /> Clear Filters
            </button>
          </div>
        )}
      </Card>

      {/* Table Container */}
      <Card padding="p-0" className="overflow-hidden">
        {filteredRequests.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-gray-200 text-[#6B7280] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Request</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Required Skill</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Preferred Window</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRequests.map((req) => (
                  <tr
                    key={req.id}
                    onClick={() => setSelectedRequest(req)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-4 font-bold text-[#172033]">
                      {req.id}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-[#172033]">
                        {req.customer}
                      </div>
                      <div className="text-[11px] text-[#6B7280]">
                        {req.phone}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[#172033]">
                      <div>{req.region}</div>
                      <div className="text-[11px] text-[#6B7280] truncate max-w-[150px]">
                        {req.location}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-[#172033]">
                      {req.requiredSkill}
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge variant={getPriorityBadgeVariant(req.priority)}>
                        {req.priority}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-[#6B7280]">
                      {req.duration}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[#172033]">
                      {req.preferredWindow}
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge variant={getStatusBadgeVariant(req.status)} dot>
                        {req.status}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Eye}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRequest(req);
                        }}
                        aria-label={`View details for ${req.id}`}
                      >
                        Inspect
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={Filter}
            title="No service requests match the filter"
            description="Try changing your search terms or clearing your current filter criteria."
            actionLabel="Reset Filters"
            onAction={clearFilters}
          />
        )}
      </Card>

      {/* Details Drawer */}
      <Drawer
        isOpen={Boolean(selectedRequest)}
        onClose={() => setSelectedRequest(null)}
        title={selectedRequest ? `${selectedRequest.id} Details` : 'Request Details'}
        subtitle="Complete field ticket specifications & dispatch status"
        footer={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSelectedRequest(null)}
          >
            Close
          </Button>
        }
      >
        {selectedRequest && (
          <div className="space-y-5 text-xs sm:text-sm">
            {/* Header info */}
            <div className="p-4 rounded-xl bg-slate-50 border border-gray-200">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] text-[#6B7280]">Customer Name</span>
                  <h4 className="text-base font-bold text-[#172033] mt-0.5">
                    {selectedRequest.customer}
                  </h4>
                  <p className="text-xs text-[#6B7280]">{selectedRequest.phone}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <Badge variant={getStatusBadgeVariant(selectedRequest.status)} dot>
                    {selectedRequest.status}
                  </Badge>
                  <Badge variant={getPriorityBadgeVariant(selectedRequest.priority)}>
                    {selectedRequest.priority} Priority
                  </Badge>
                </div>
              </div>
            </div>

            {/* Ticket details */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-white border border-gray-200">
                <span className="text-[11px] text-[#6B7280] block mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-[#4F46E5]" /> Location / Region
                </span>
                <span className="font-semibold text-[#172033] block">
                  {selectedRequest.region}
                </span>
                <span className="text-[11px] text-[#6B7280] mt-0.5 block">
                  {selectedRequest.address || selectedRequest.location}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-white border border-gray-200">
                <span className="text-[11px] text-[#6B7280] block mb-1 flex items-center gap-1">
                  <Wrench className="w-3 h-3 text-[#4F46E5]" /> Required Skill
                </span>
                <span className="font-semibold text-[#172033]">
                  {selectedRequest.requiredSkill}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-white border border-gray-200">
                <span className="text-[11px] text-[#6B7280] block mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[#4F46E5]" /> Estimated Duration
                </span>
                <span className="font-semibold text-[#172033]">
                  {selectedRequest.duration}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-white border border-gray-200">
                <span className="text-[11px] text-[#6B7280] block mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[#4F46E5]" /> Preferred Time Window
                </span>
                <span className="font-semibold text-[#172033] font-mono">
                  {selectedRequest.preferredWindow}
                </span>
              </div>
            </div>

            {/* Assignment & Notes */}
            <div className="p-3.5 rounded-xl border border-gray-200 bg-white">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280] block mb-1">
                Dispatch Allocation
              </span>
              <p className="text-xs font-semibold text-[#172033]">
                Assigned: {selectedRequest.assignedTechName || 'None (Unassigned)'}
              </p>
              {selectedRequest.startTime && (
                <p className="text-xs text-indigo-700 mt-1">
                  Scheduled slot: {selectedRequest.startTime} – {selectedRequest.endTime}
                </p>
              )}
              {selectedRequest.notes && (
                <p className="text-xs text-[#6B7280] mt-2 pt-2 border-t border-gray-100">
                  <span className="font-medium text-[#172033]">Work Order Notes: </span>
                  {selectedRequest.notes}
                </p>
              )}
            </div>

            {/* Relevant Risks & Constraints */}
            <div className="p-3.5 rounded-xl border border-gray-200 bg-white space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280] block">
                Relevant Risks & Constraints
              </span>
              {selectedRequest.issueFlag ? (
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Constraint Flag: </span>
                    {selectedRequest.issueFlag}
                  </div>
                </div>
              ) : null}
              {selectedRequest.status === 'UNASSIGNED' && (
                <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-900 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Unassigned Reason: </span>
                    {selectedRequest.id === 'REQ-007'
                      ? 'No available technician with AC Maintenance in Jaipur East (Neha Kapoor on leave). Overtime or adjacent territory dispatch required.'
                      : selectedRequest.id === 'REQ-009'
                      ? 'Narrow 15:00–17:00 window conflict with technician transit constraints. Requires window extension or dispatcher approval.'
                      : selectedRequest.notes || 'Pending technician assignment matching skill and regional coverage.'}
                  </div>
                </div>
              )}
              {selectedRequest.priority === 'Critical' && (
                <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px] flex items-center gap-1.5 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  Critical SLA Risk: Mandatory expedited resolution within preferred window.
                </div>
              )}
              {selectedRequest.status !== 'UNASSIGNED' && !selectedRequest.issueFlag && selectedRequest.priority !== 'Critical' && (
                <p className="text-xs text-emerald-700 bg-emerald-50 p-2 rounded-lg border border-emerald-200 flex items-center gap-1.5 font-medium">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  All hard constraints satisfied (Skill, region, availability, and working window verified).
                </p>
              )}
            </div>

            {/* Assignment History */}
            <div className="p-3.5 rounded-xl border border-gray-200 bg-white space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280] block">
                Assignment History
              </span>
              {(() => {
                const historyEvents = (auditEvents || []).filter(
                  (ev) => ev.requestId === selectedRequest.id || ev.affectedRequestId === selectedRequest.id
                );

                if (historyEvents.length > 0) {
                  return (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {historyEvents.map((ev) => (
                        <div key={ev.id} className="text-xs p-2 rounded-lg bg-slate-50 border border-gray-100">
                          <div className="flex items-center justify-between text-[11px] text-gray-500 mb-0.5">
                            <span className="font-semibold text-[#172033]">{ev.action}</span>
                            <span className="font-mono">{ev.time || ev.timestamp}</span>
                          </div>
                          <p className="text-[11px] text-[#4B5563]">{ev.entity || ev.reason}</p>
                          <div className="text-[10px] text-indigo-600 mt-1 font-mono">
                            Actor: {ev.actor} ({ev.source || ev.actorType})
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                }

                // Initial baseline entries if no runtime changes yet
                return (
                  <div className="text-xs p-2.5 rounded-lg bg-slate-50 border border-gray-100 text-[#6B7280] space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-[#172033]">
                        {selectedRequest.status === 'COMPLETED'
                          ? 'Job Execution Completed'
                          : selectedRequest.assignedTechName
                          ? 'Initial Morning Dispatch'
                          : 'Queue Intake'}
                      </span>
                      <span className="font-mono">08:30 AM</span>
                    </div>
                    <p className="text-[11px]">
                      {selectedRequest.status === 'COMPLETED'
                        ? `Servicing completed by ${selectedRequest.assignedTechName} at 10:30 AM.`
                        : selectedRequest.assignedTechName
                        ? `Allocated to ${selectedRequest.assignedTechName} (${selectedRequest.startTime}–${selectedRequest.endTime}).`
                        : 'Placed in unassigned queue awaiting dispatcher optimization.'}
                    </p>
                  </div>
                );
              })()}
            </div>

            {/* Lifecycle Status Transition Control Panel (Requirement 9) */}
            <div className="p-3.5 rounded-xl border border-gray-200 bg-white space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                  Lifecycle Status Transition
                </span>
                <Badge variant={getStatusBadgeVariant(selectedRequest.status)} dot>
                  {normalizeStatus(selectedRequest.status)}
                </Badge>
              </div>

              {normalizeStatus(selectedRequest.status) === 'COMPLETED' ? (
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    <strong>Terminal Status:</strong> This work order is marked <strong>COMPLETED</strong>. Completed assignments are strictly immutable and protected from further modification.
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  <span className="text-[11px] text-[#6B7280] block">
                    Allowed next operational transitions:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {(ALLOWED_TRANSITIONS[normalizeStatus(selectedRequest.status)] || []).map((targetStatus) => {
                      let label = targetStatus;
                      let btnVariant = 'secondary';
                      let btnIcon = ArrowRightCircle;
                      if (targetStatus === 'IN_PROGRESS') {
                        label = 'Start Work (IN_PROGRESS)';
                        btnVariant = 'primary';
                        btnIcon = Play;
                      } else if (targetStatus === 'COMPLETED') {
                        label = 'Mark Completed';
                        btnVariant = 'success';
                        btnIcon = Check;
                      } else if (targetStatus === 'CANCELLED') {
                        label = 'Cancel Request';
                        btnVariant = 'danger';
                        btnIcon = Ban;
                      } else if (targetStatus === 'UNASSIGNED') {
                        label = 'Return to Queue';
                        btnVariant = 'secondary';
                        btnIcon = RotateCcw;
                      } else if (targetStatus === 'BLOCKED') {
                        label = 'Mark Blocked';
                        btnVariant = 'secondary';
                        btnIcon = AlertCircle;
                      } else if (targetStatus === 'PENDING_APPROVAL') {
                        label = 'Submit for Approval';
                        btnVariant = 'secondary';
                        btnIcon = ArrowRightCircle;
                      } else if (targetStatus === 'ASSIGNED') {
                        label = 'Mark Assigned';
                        btnVariant = 'primary';
                        btnIcon = Check;
                      }

                      return (
                        <Button
                          key={targetStatus}
                          size="sm"
                          variant={btnVariant}
                          icon={btnIcon}
                          onClick={() => handleStatusTransition(targetStatus)}
                        >
                          {label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* New Request Modal */}
      <Modal
        isOpen={isNewRequestModalOpen}
        onClose={() => setIsNewRequestModalOpen(false)}
        title="Create New Service Request"
        subtitle="Log a customer service ticket for immediate or AI replanning"
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsNewRequestModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreateSubmit}
            >
              Create Request
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <Input
            label="Customer Name"
            placeholder="e.g. Ramesh Chandra"
            required
            value={newRequest.customer}
            onChange={(e) =>
              setNewRequest({ ...newRequest, customer: e.target.value })
            }
          />
          <Input
            label="Contact Phone"
            placeholder="e.g. +91 98290 12345"
            value={newRequest.phone}
            onChange={(e) =>
              setNewRequest({ ...newRequest, phone: e.target.value })
            }
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#172033] mb-1.5">
                Required Skill
              </label>
              <select
                className="w-full rounded-lg border border-gray-200 text-xs py-2 px-3 bg-white text-[#172033] focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5]"
                value={newRequest.skill}
                onChange={(e) =>
                  setNewRequest({ ...newRequest, skill: e.target.value })
                }
              >
                <option value="AC Repair">AC Repair</option>
                <option value="Electrical Repair">Electrical Repair</option>
                <option value="Plumbing">Plumbing</option>
                <option value="HVAC">HVAC</option>
                <option value="AC Maintenance">AC Maintenance</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#172033] mb-1.5">
                Priority
              </label>
              <select
                className="w-full rounded-lg border border-gray-200 text-xs py-2 px-3 bg-white text-[#172033] focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5]"
                value={newRequest.priority}
                onChange={(e) =>
                  setNewRequest({ ...newRequest, priority: e.target.value })
                }
              >
                <option value="Normal">Normal</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#172033] mb-1.5">
                Region
              </label>
              <select
                className="w-full rounded-lg border border-gray-200 text-xs py-2 px-3 bg-white text-[#172033] focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5]"
                value={newRequest.region}
                onChange={(e) =>
                  setNewRequest({ ...newRequest, region: e.target.value })
                }
              >
                <option value="Jaipur North">Jaipur North</option>
                <option value="Jaipur Central">Jaipur Central</option>
                <option value="Jaipur South">Jaipur South</option>
                <option value="Jaipur West">Jaipur West</option>
                <option value="Jaipur East">Jaipur East</option>
              </select>
            </div>
            <Input
              label="Preferred Window"
              placeholder="e.g. 10:00 - 13:00"
              value={newRequest.preferredWindow}
              onChange={(e) =>
                setNewRequest({ ...newRequest, preferredWindow: e.target.value })
              }
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}

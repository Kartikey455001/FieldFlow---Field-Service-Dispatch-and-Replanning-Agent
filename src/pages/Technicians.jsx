import React, { useState } from 'react';
import {
  Users,
  Search,
  Star,
  MapPin,
  Clock,
  Wrench,
  LayoutGrid,
  List,
  UserX,
  Eye,
  Lock,
  Calendar,
} from 'lucide-react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Drawer from '../components/ui/Drawer';
import ProgressBar from '../components/ui/ProgressBar';
import Avatar from '../components/common/Avatar';
import EmptyState from '../components/common/EmptyState';
import { useDispatch } from '../context/useDispatch';
import { calculateTechnicianWorkloads } from '../utils/constraintEngine';

export default function Technicians() {
  const { technicians, requests, simulateTechnicianCancellation } = useDispatch();
  const [searchTerm, setSearchTerm] = useState('');
  const [regionFilter, setRegionFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'
  const [selectedTechForCancel, setSelectedTechForCancel] = useState(null);
  const [selectedTechForDetail, setSelectedTechForDetail] = useState(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

  // Dynamic workload calculation (Section 17)
  const workloads = React.useMemo(() => {
    return calculateTechnicianWorkloads(technicians, requests);
  }, [technicians, requests]);

  const filteredTechnicians = technicians.filter((tech) => {
    const matchesSearch =
      tech.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tech.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tech.skills.some((s) => s.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesRegion =
      regionFilter === 'All' || tech.region.includes(regionFilter);
    const matchesStatus =
      statusFilter === 'All' || tech.status === statusFilter;

    return matchesSearch && matchesRegion && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-gray-200/80 shadow-soft">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-[#172033] tracking-tight">
              Technician Roster
            </h2>
            <Badge variant="info">
              {filteredTechnicians.length} / {technicians.length} Active Staff
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-[#6B7280] mt-1">
            Monitor technician operational availability, assigned regions, skills, and daily workload caps.
          </p>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg border border-gray-200/60 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('cards')}
            className={`p-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
              viewMode === 'cards'
                ? 'bg-white text-[#172033] shadow-xs'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Cards</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`p-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
              viewMode === 'table'
                ? 'bg-white text-[#172033] shadow-xs'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Table</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card padding="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            placeholder="Search technicians, role, or skills..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            icon={Search}
          />
          <div>
            <select
              className="w-full rounded-lg border border-gray-200 text-xs py-2 px-3 bg-white text-[#172033] focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5]"
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              aria-label="Filter by region"
            >
              <option value="All">All Regions</option>
              <option value="North">Jaipur North</option>
              <option value="Central">Jaipur Central</option>
              <option value="South">Jaipur South</option>
              <option value="West">Jaipur West</option>
              <option value="East">Jaipur East</option>
            </select>
          </div>
          <div>
            <select
              className="w-full rounded-lg border border-gray-200 text-xs py-2 px-3 bg-white text-[#172033] focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5]"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
            >
              <option value="All">All Statuses</option>
              <option value="Available">Available</option>
              <option value="Unavailable">Unavailable</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Cards View */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredTechnicians.map((tech) => {
            const isUnavailable = tech.status === 'Unavailable';
            const wl = workloads[tech.id] || {
              totalHours: tech.currentWorkloadHours,
              maxHours: tech.maxWorkloadHours || 8,
              percentage: Math.round((tech.currentWorkloadHours / 8) * 100),
              isOverloaded: false,
            };
            const isNearCap = wl.percentage >= 90;

            return (
              <Card
                key={tech.id}
                padding="p-5"
                onClick={() => setSelectedTechForDetail(tech)}
                className={`flex flex-col justify-between hover:border-gray-300 transition-all shadow-sm cursor-pointer ${
                  isNearCap ? 'border-amber-200 bg-amber-50/10' : ''
                }`}
              >
                <div>
                  {/* Top profile header */}
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={tech.name}
                        initials={tech.avatar}
                        size="lg"
                        status={isUnavailable ? 'unavailable' : 'available'}
                      />
                      <div>
                        <h3 className="text-sm font-bold text-[#172033]">
                          {tech.name}
                        </h3>
                        <p className="text-xs text-[#4F46E5] font-medium">
                          {tech.role}
                        </p>
                        <div className="flex items-center gap-1 text-[11px] text-[#6B7280] mt-0.5">
                          <MapPin className="w-3 h-3 text-gray-400" />
                          <span>{tech.region}</span>
                        </div>
                      </div>
                    </div>
                    <Badge variant={isUnavailable ? 'danger' : 'success'} dot>
                      {tech.status}
                    </Badge>
                  </div>

                  {/* Skills tags */}
                  <div className="py-3">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280] block mb-1.5 flex items-center gap-1">
                      <Wrench className="w-3 h-3 text-[#4F46E5]" /> Certified Skills
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {tech.skills.map((skill) => (
                        <span
                          key={skill}
                          className="px-2 py-0.5 rounded-md bg-slate-100 text-[#172033] text-[11px] font-medium border border-slate-200/60"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Workload Progress Bar (Section 17) */}
                  <div className="py-3 border-t border-gray-100">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-[#6B7280] flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-gray-400" /> Daily Workload
                        {isNearCap && (
                          <span className="text-[10px] text-amber-700 font-semibold bg-amber-100 px-1.5 py-0.2 rounded">
                            Near Cap
                          </span>
                        )}
                      </span>
                      <span className={`font-semibold ${isNearCap ? 'text-amber-700' : 'text-[#172033]'}`}>
                        {wl.totalHours}h / {wl.maxHours}h ({wl.percentage}%)
                      </span>
                    </div>
                    <ProgressBar
                      value={wl.totalHours}
                      max={wl.maxHours}
                      height="h-2.5"
                    />
                  </div>
                </div>

                {/* Bottom info footer */}
                <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-[#6B7280]">
                  <div className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span className="font-semibold text-[#172033]">{tech.rating}</span>
                    <span className="text-[11px]">({tech.completedJobsToday} jobs today)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTechForDetail(tech);
                      }}
                      className="text-[10px] text-[#4F46E5] hover:text-[#4338CA] hover:bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 transition-colors flex items-center gap-1 font-medium"
                      title={`View ${tech.name} schedule & capabilities`}
                    >
                      <Eye className="w-3 h-3" /> Inspect
                    </button>
                    {tech.status === 'Available' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTechForCancel(tech);
                          setIsCancelModalOpen(true);
                        }}
                        className="text-[10px] text-red-600 hover:text-red-700 hover:bg-red-50 px-1.5 py-0.5 rounded border border-red-200 transition-colors flex items-center gap-1 font-medium"
                        title={`Report ${tech.name} shift cancellation`}
                      >
                        <UserX className="w-3 h-3" /> Report Unavailable
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <Card padding="p-0" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-gray-200 text-[#6B7280] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Technician</th>
                  <th className="py-3 px-4">Assigned Region</th>
                  <th className="py-3 px-4">Skills</th>
                  <th className="py-3 px-4">Availability</th>
                  <th className="py-3 px-4">Workload (Max {8}h)</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTechnicians.map((tech) => (
                  <tr
                    key={tech.id}
                    onClick={() => setSelectedTechForDetail(tech)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <Avatar
                          name={tech.name}
                          initials={tech.avatar}
                          size="sm"
                          status={tech.status === 'Unavailable' ? 'unavailable' : 'available'}
                        />
                        <div>
                          <div className="font-bold text-[#172033]">{tech.name}</div>
                          <div className="text-[11px] text-[#6B7280]">{tech.role}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-[#172033]">
                      {tech.region}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {tech.skills.map((skill) => (
                          <span
                            key={skill}
                            className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] text-[#172033]"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[#6B7280]">
                      {tech.availability}
                    </td>
                    <td className="py-3.5 px-4 w-44">
                      {(() => {
                        const wl = workloads[tech.id] || {
                          totalHours: tech.currentWorkloadHours,
                          maxHours: tech.maxWorkloadHours || 8,
                          percentage: Math.round((tech.currentWorkloadHours / 8) * 100),
                        };
                        return (
                          <>
                            <div className="flex items-center justify-between text-[11px] mb-1">
                              <span className="font-medium text-[#172033]">{wl.totalHours}h ({wl.percentage}%)</span>
                              <span className="text-gray-400">{wl.maxHours}h max</span>
                            </div>
                            <ProgressBar
                              value={wl.totalHours}
                              max={wl.maxHours}
                              height="h-2"
                            />
                          </>
                        );
                      })()}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={tech.status === 'Unavailable' ? 'danger' : 'success'}
                          dot
                        >
                          {tech.status}
                        </Badge>
                        {tech.status === 'Available' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTechForCancel(tech);
                              setIsCancelModalOpen(true);
                            }}
                            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title={`Report ${tech.name} shift cancellation`}
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Eye}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTechForDetail(tech);
                          }}
                        >
                          Inspect
                        </Button>
                        <div className="flex items-center gap-1 font-semibold text-[#172033]">
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                          <span>{tech.rating}</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {filteredTechnicians.length === 0 && (
        <EmptyState
          icon={Users}
          title="No technicians match criteria"
          description="Try changing the filter options to view available technicians."
          actionLabel="Clear Filters"
          onAction={() => {
            setSearchTerm('');
            setRegionFilter('All');
            setStatusFilter('All');
          }}
        />
      )}

      {/* Technician Cancellation Confirmation Modal (Requirement 10) */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title="Report Technician Unavailability"
        subtitle="Simulate sudden shift cancellation and trigger AI replanning cascade"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsCancelModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon={UserX}
              onClick={() => {
                if (selectedTechForCancel) {
                  simulateTechnicianCancellation(selectedTechForCancel.id, selectedTechForCancel.name);
                  setIsCancelModalOpen(false);
                  setSelectedTechForCancel(null);
                }
              }}
            >
              Confirm Unavailability
            </Button>
          </>
        }
      >
        {selectedTechForCancel && (
          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-950">
              <span className="font-bold block mb-1">
                Technician: {selectedTechForCancel.name} ({selectedTechForCancel.role})
              </span>
              <p>
                Triggering cancellation will mark this technician as <strong>Unavailable</strong>. All active scheduled assignments for this technician will be marked as <strong>Needs Replanning</strong>, generating an AI replan proposal.
              </p>
            </div>
            <p className="text-[#6B7280]">
              Completed assignments (e.g. REQ-010) are strictly protected and will NOT be moved or cancelled.
            </p>
          </div>
        )}
      </Modal>

      {/* Technician Detail Drawer */}
      <Drawer
        isOpen={Boolean(selectedTechForDetail)}
        onClose={() => setSelectedTechForDetail(null)}
        title={selectedTechForDetail ? `${selectedTechForDetail.name} — Profile` : 'Technician Details'}
        subtitle="Operational availability, certified capabilities & assigned schedule"
        footer={
          <div className="flex items-center justify-between w-full">
            <div>
              {selectedTechForDetail && selectedTechForDetail.status === 'Available' && (
                <Button
                  variant="danger"
                  size="sm"
                  icon={UserX}
                  onClick={() => {
                    const tech = selectedTechForDetail;
                    setSelectedTechForDetail(null);
                    setSelectedTechForCancel(tech);
                    setIsCancelModalOpen(true);
                  }}
                >
                  Report Unavailable
                </Button>
              )}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSelectedTechForDetail(null)}
            >
              Close
            </Button>
          </div>
        }
      >
        {selectedTechForDetail && (() => {
          const wl = workloads[selectedTechForDetail.id] || {
            totalHours: selectedTechForDetail.currentWorkloadHours,
            maxHours: selectedTechForDetail.maxWorkloadHours || 8,
            percentage: Math.round((selectedTechForDetail.currentWorkloadHours / 8) * 100),
          };
          const assignedJobs = requests.filter(
            (r) => r.assignedTechId === selectedTechForDetail.id
          );

          return (
            <div className="space-y-5 text-xs sm:text-sm">
              {/* Header profile summary */}
              <div className="p-4 rounded-xl bg-slate-50 border border-gray-200">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={selectedTechForDetail.name}
                      initials={selectedTechForDetail.avatar}
                      size="lg"
                      status={selectedTechForDetail.status === 'Unavailable' ? 'unavailable' : 'available'}
                    />
                    <div>
                      <h4 className="text-base font-bold text-[#172033]">
                        {selectedTechForDetail.name}
                      </h4>
                      <p className="text-xs text-[#4F46E5] font-semibold">
                        {selectedTechForDetail.role}
                      </p>
                      <div className="flex items-center gap-1 text-[11px] text-[#6B7280] mt-0.5">
                        <MapPin className="w-3 h-3 text-gray-400" />
                        <span>{selectedTechForDetail.region}</span>
                      </div>
                    </div>
                  </div>
                  <Badge
                    variant={selectedTechForDetail.status === 'Unavailable' ? 'danger' : 'success'}
                    dot
                  >
                    {selectedTechForDetail.status}
                  </Badge>
                </div>
              </div>

              {/* Attributes Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-white border border-gray-200">
                  <span className="text-[11px] text-[#6B7280] block mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[#4F46E5]" /> Shift & Working Hours
                  </span>
                  <span className="font-semibold text-[#172033] block">
                    09:00 – 17:00 (Standard Shift)
                  </span>
                  <span className="text-[11px] text-[#6B7280] mt-0.5 block font-mono">
                    {selectedTechForDetail.availability}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-white border border-gray-200">
                  <span className="text-[11px] text-[#6B7280] block mb-1 flex items-center gap-1">
                    <Star className="w-3 h-3 text-amber-500 fill-amber-500" /> Performance Rating
                  </span>
                  <span className="font-semibold text-[#172033] block text-sm">
                    {selectedTechForDetail.rating} / 5.0
                  </span>
                  <span className="text-[11px] text-[#6B7280] mt-0.5 block">
                    {selectedTechForDetail.completedJobsToday} jobs completed today
                  </span>
                </div>
              </div>

              {/* Skills Section */}
              <div className="p-3.5 rounded-xl border border-gray-200 bg-white">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280] block mb-2 flex items-center gap-1">
                  <Wrench className="w-3.5 h-3.5 text-[#4F46E5]" /> Certified Skills
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedTechForDetail.skills.map((skill) => (
                    <span
                      key={skill}
                      className="px-2.5 py-1 rounded-md bg-slate-100 text-[#172033] text-xs font-medium border border-slate-200/80"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* Workload Capacity */}
              <div className="p-3.5 rounded-xl border border-gray-200 bg-white">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-semibold text-[#172033] flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-[#4F46E5]" /> Daily Capacity & Workload
                  </span>
                  <span className="font-semibold text-[#172033]">
                    {wl.totalHours}h / {wl.maxHours}h ({wl.percentage}%)
                  </span>
                </div>
                <ProgressBar value={wl.totalHours} max={wl.maxHours} height="h-2.5" />
                <span className="text-[11px] text-[#6B7280] mt-2 block">
                  Hard constraint cap: Maximum 8 scheduled hours per technician shift.
                </span>
              </div>

              {/* Today's Assigned Jobs */}
              <div className="p-3.5 rounded-xl border border-gray-200 bg-white space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280] flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-[#4F46E5]" /> Today's Assigned Jobs ({assignedJobs.length})
                  </span>
                </div>

                {assignedJobs.length > 0 ? (
                  <div className="space-y-2">
                    {assignedJobs.map((job) => {
                      const isCompleted = job.status === 'COMPLETED' || job.status === 'Completed' || job.isProtectedCompleted;
                      return (
                        <div
                          key={job.id}
                          className="p-2.5 rounded-lg bg-slate-50 border border-gray-200 flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[#172033]">{job.id}</span>
                              <span className="font-medium text-[#4F46E5]">{job.requiredSkill}</span>
                              {isCompleted && (
                                <span className="text-[10px] font-bold text-slate-700 bg-slate-200 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                  <Lock className="w-2.5 h-2.5" /> Protected
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-[#6B7280] mt-0.5">{job.customer} · {job.region}</p>
                          </div>
                          <div className="text-right">
                            <span className="font-mono font-medium text-[#172033] block">
                              {job.startTime ? `${job.startTime} – ${job.endTime}` : job.preferredWindow}
                            </span>
                            <span className="text-[11px] text-gray-500">{job.duration}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-[#6B7280] italic py-2">
                    No active assignments currently scheduled for today.
                  </p>
                )}
              </div>
            </div>
          );
        })()}
      </Drawer>
    </div>
  );
}

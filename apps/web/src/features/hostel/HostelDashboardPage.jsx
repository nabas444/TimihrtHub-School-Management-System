import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Bed,
  Users,
  AlertCircle,
  Plus,
  Play,
  CheckCircle,
  RefreshCw,
  DoorOpen,
  Wrench,
  ShieldAlert,
  Search,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../../lib/api";
import {
  getHostels,
  getHostelOccupancy,
  createHostel,
  createBlock,
  createRoom,
  bulkCreateBeds,
  runAutoAllocation,
  checkOutResident,
} from "./hostelApi";

export default function HostelDashboardPage() {
  const queryClient = useQueryClient();
  const [selectedHostelId, setSelectedHostelId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Modal states
  const [showCreateHostelModal, setShowCreateHostelModal] = useState(false);
  const [showCreateBlockModal, setShowCreateBlockModal] = useState(false);
  const [showAddRoomModal, setShowAddRoomModal] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState(null);

  // Form states
  const [hostelForm, setHostelForm] = useState({
    name: "",
    type: "BOYS",
    wardenId: "",
    address: "",
    isActive: true,
  });

  const [blockForm, setBlockForm] = useState({
    name: "",
    floorCount: 1,
    gradeMin: "",
    gradeMax: "",
    isActive: true,
  });

  const [roomForm, setRoomForm] = useState({
    roomNumber: "",
    floor: 1,
    roomType: "QUAD",
    capacity: 4,
    isAccessible: false,
    autoCreateBeds: true,
  });

  // Fetch all hostels
  const { data: hostelsRes, isLoading: loadingHostels } = useQuery({
    queryKey: ["hostels"],
    queryFn: () => getHostels(),
  });

  const hostels = hostelsRes?.data || [];
  const activeHostelId = selectedHostelId || hostels[0]?.id;

  // Fetch employees for warden selection (only ACTIVE and PROBATION)
  const { data: employeesRes } = useQuery({
    queryKey: ["employees-active-list"],
    queryFn: () =>
      api.get("/employees?status=ACTIVE&limit=100").then((r) => r.data?.data || r.data || []),
  });
  const employees = (Array.isArray(employeesRes) ? employeesRes : []).filter(
    (emp) => emp.status === "ACTIVE" || emp.status === "PROBATION"
  );

  // Fetch occupancy for active hostel
  const {
    data: occupancyRes,
    isLoading: loadingOccupancy,
    refetch: refetchOccupancy,
  } = useQuery({
    queryKey: ["hostel-occupancy", activeHostelId],
    queryFn: () => getHostelOccupancy(activeHostelId),
    enabled: Boolean(activeHostelId),
  });

  const occupancy = occupancyRes?.data;

  // Create Hostel Mutation
  const createHostelMutation = useMutation({
    mutationFn: (data) =>
      createHostel({
        ...data,
        wardenId: data.wardenId ? data.wardenId : undefined,
      }),
    onSuccess: (res) => {
      toast.success("Hostel created successfully!");
      setShowCreateHostelModal(false);
      setHostelForm({
        name: "",
        type: "BOYS",
        wardenId: "",
        address: "",
        isActive: true,
      });
      queryClient.invalidateQueries(["hostels"]);
      if (res?.data?.id) {
        setSelectedHostelId(res.data.id);
      }
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to create hostel");
    },
  });

  // Create Block Mutation
  const createBlockMutation = useMutation({
    mutationFn: (data) =>
      createBlock(activeHostelId, {
        name: data.name,
        floorCount: Number(data.floorCount) || 1,
        gradeMin: data.gradeMin || undefined,
        gradeMax: data.gradeMax || undefined,
        isActive: data.isActive,
      }),
    onSuccess: () => {
      toast.success("Block created successfully!");
      setShowCreateBlockModal(false);
      setBlockForm({
        name: "",
        floorCount: 1,
        gradeMin: "",
        gradeMax: "",
        isActive: true,
      });
      queryClient.invalidateQueries(["hostel-occupancy", activeHostelId]);
      queryClient.invalidateQueries(["hostels"]);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to create block");
    },
  });

  // Create Room Mutation
  const createRoomMutation = useMutation({
    mutationFn: (data) =>
      createRoom(selectedBlockId, {
        roomNumber: data.roomNumber,
        floor: Number(data.floor) || 1,
        roomType: data.roomType,
        capacity: Number(data.capacity) || 1,
        isAccessible: data.isAccessible,
        autoCreateBeds: data.autoCreateBeds,
      }),
    onSuccess: () => {
      toast.success("Room created successfully with beds!");
      setShowAddRoomModal(false);
      setRoomForm({
        roomNumber: "",
        floor: 1,
        roomType: "QUAD",
        capacity: 4,
        isAccessible: false,
        autoCreateBeds: true,
      });
      queryClient.invalidateQueries(["hostel-occupancy", activeHostelId]);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to create room");
    },
  });

  // Run auto-allocation mutation
  const autoAllocateMutation = useMutation({
    mutationFn: () => runAutoAllocation(activeHostelId, { defaultBoardingFee: 15000 }),
    onSuccess: (res) => {
      toast.success(res.message || "Auto-allocation batch completed!");
      queryClient.invalidateQueries(["hostel-occupancy", activeHostelId]);
      queryClient.invalidateQueries(["hostels"]);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to run auto-allocation");
    },
  });

  // Check out resident mutation
  const checkOutMutation = useMutation({
    mutationFn: ({ allocId }) => checkOutResident(allocId, { vacateReason: "Dashboard Vacate" }),
    onSuccess: () => {
      toast.success("Resident checked out and bed vacated");
      queryClient.invalidateQueries(["hostel-occupancy", activeHostelId]);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to check out resident");
    },
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header & Main Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Hostel & Dormitory Operations
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Live occupancy, visual room grid & resident allocation
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-3">
          {/* Hostel Switcher */}
          {hostels.length > 0 && (
            <select
              value={activeHostelId || ""}
              onChange={(e) => setSelectedHostelId(e.target.value)}
              className="px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-indigo-500"
            >
              {hostels.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.type})
                </option>
              ))}
            </select>
          )}

          {activeHostelId && (
            <>
              <button
                onClick={() => autoAllocateMutation.mutate()}
                disabled={autoAllocateMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium shadow-sm transition disabled:opacity-50"
              >
                <Play className="w-4 h-4 fill-current" />
                {autoAllocateMutation.isPending ? "Allocating..." : "Run Auto-Allocation"}
              </button>

              <button
                onClick={() => setShowCreateBlockModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-300 rounded-xl text-sm font-medium transition"
              >
                <Plus className="w-4 h-4" />
                Add Block
              </button>
            </>
          )}

          <button
            onClick={() => setShowCreateHostelModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-black dark:bg-gray-100 dark:hover:bg-white text-white dark:text-gray-900 rounded-xl text-sm font-medium shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            Add Hostel
          </button>
        </div>
      </div>

      {/* When no hostels exist */}
      {!loadingHostels && hostels.length === 0 && (
        <div className="bg-white dark:bg-gray-800 p-12 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto">
            <Building2 className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              No Hostels Configured Yet
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              Get started by creating your first school dormitory or residential hall. You can then add wings/blocks, rooms, and configure beds.
            </p>
          </div>
          <button
            onClick={() => setShowCreateHostelModal(true)}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-md transition"
          >
            <Plus className="w-4 h-4" />
            Create First Hostel
          </button>
        </div>
      )}

      {/* KPI Cards */}
      {occupancy && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Beds</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{occupancy.totalBeds}</p>
            <p className="text-xs text-gray-400 mt-1">Capacity: {occupancy.totalCapacity}</p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Vacant Beds</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{occupancy.vacantBeds}</p>
            <span className="inline-block mt-1 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[11px] font-medium rounded-full">
              Ready for intake
            </span>
          </div>

          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Occupied Beds</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{occupancy.occupiedBeds}</p>
            <p className="text-xs text-gray-400 mt-1">Active residents</p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Reserved</p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{occupancy.reservedBeds}</p>
            <p className="text-xs text-gray-400 mt-1">Pending check-in</p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Maintenance</p>
            <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{occupancy.outOfServiceBeds}</p>
            <p className="text-xs text-gray-400 mt-1">Out of service</p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Occupancy Rate</p>
            <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{occupancy.overallOccupancyRate}%</p>
            <div className="w-full bg-gray-100 dark:bg-gray-700 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${occupancy.overallOccupancyRate}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Visual Room Grid / Block Matrix */}
      {occupancy?.blocks?.map((block) => (
        <div
          key={block.blockId}
          className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden"
        >
          <div className="px-6 py-4 bg-gray-50/50 dark:bg-gray-750 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-bold text-gray-900 dark:text-white text-base">
                {block.name}
              </span>
              <span className="px-2.5 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-full font-medium">
                {block.roomsCount} Rooms • {block.totalBeds} Beds
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Occupancy: {block.occupancyRate}%
              </span>
            </div>

            <button
              onClick={() => {
                setSelectedBlockId(block.blockId);
                setShowAddRoomModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-semibold rounded-lg transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Room
            </button>
          </div>

          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {block.rooms.map((room) => {
              const isMaintenance = room.status === "MAINTENANCE";
              const isFull = room.occupancyRate === 100;

              return (
                <div
                  key={room.roomId}
                  className={`p-4 rounded-xl border transition-all ${
                    isMaintenance
                      ? "bg-rose-50/30 border-rose-200 dark:border-rose-900/40"
                      : isFull
                      ? "bg-blue-50/20 border-blue-200 dark:border-blue-900/40"
                      : "bg-white dark:bg-gray-800/80 border-gray-200 dark:border-gray-700"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <DoorOpen className="w-4 h-4 text-gray-500" />
                      <span className="font-bold text-gray-900 dark:text-white">
                        Room {room.roomNumber}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                        isMaintenance
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                          : isFull
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                      }`}
                    >
                      {room.status}
                    </span>
                  </div>

                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    Floor {room.floor} • {room.roomType} • Capacity {room.capacity}
                  </p>

                  {/* Bed badges */}
                  <div className="space-y-1.5">
                    {room.occupants.map((occ) => (
                      <div
                        key={occ.allocationId}
                        className="flex items-center justify-between p-1.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-xs"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                            [{occ.bedNumber}]
                          </span>
                          <span className="font-medium text-gray-800 dark:text-gray-200 truncate">
                            {occ.studentName}
                          </span>
                        </div>

                        <button
                          onClick={() => checkOutMutation.mutate({ allocId: occ.allocationId })}
                          title="Vacate Bed / Check Out"
                          className="text-[11px] text-gray-400 hover:text-rose-600 transition px-1"
                        >
                          Vacate
                        </button>
                      </div>
                    ))}

                    {/* Vacant Bed Slots */}
                    {Array.from({ length: room.vacantBeds }).map((_, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 p-1.5 border border-dashed border-emerald-300 dark:border-emerald-700/50 rounded-lg text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50/20"
                      >
                        <Bed className="w-3.5 h-3.5" />
                        <span className="font-medium">Vacant Bed Available</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* ── MODAL: CREATE HOSTEL ──────────────────────────────────────────────── */}
      {showCreateHostelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Add New Hostel
                </h3>
              </div>
              <button
                onClick={() => setShowCreateHostelModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!hostelForm.name.trim()) {
                  toast.error("Please enter a hostel name");
                  return;
                }
                createHostelMutation.mutate(hostelForm);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                  Hostel / Hall Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Abune Petros Hall, Queen Taytu Hall"
                  value={hostelForm.name}
                  onChange={(e) => setHostelForm({ ...hostelForm, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                    Hostel Type *
                  </label>
                  <select
                    value={hostelForm.type}
                    onChange={(e) => setHostelForm({ ...hostelForm, type: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="BOYS">Boys Hostel</option>
                    <option value="GIRLS">Girls Hostel</option>
                    <option value="MIXED">Mixed Residential</option>
                    <option value="STAFF">Staff Quarters</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                    Head Warden (Optional)
                  </label>
                  <select
                    value={hostelForm.wardenId}
                    onChange={(e) => setHostelForm({ ...hostelForm, wardenId: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Unassigned --</option>
                    {employees.map((emp) => {
                      const fullName = `${emp.firstName} ${emp.middleName ? emp.middleName + " " : ""}${emp.lastName}`;
                      const pos = emp.position?.value || emp.jobTitle || "";
                      return (
                        <option key={emp.id} value={emp.id}>
                          {fullName} {pos ? `(${pos})` : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                  Campus Location / Address
                </label>
                <input
                  type="text"
                  placeholder="e.g. North Campus, Behind Science Building"
                  value={hostelForm.address}
                  onChange={(e) => setHostelForm({ ...hostelForm, address: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowCreateHostelModal(false)}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createHostelMutation.isPending}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-md transition disabled:opacity-50"
                >
                  {createHostelMutation.isPending ? "Creating..." : "Save Hostel"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: CREATE BLOCK ────────────────────────────────────────────────── */}
      {showCreateBlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Add Block / Wing
              </h3>
              <button
                onClick={() => setShowCreateBlockModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!blockForm.name.trim()) {
                  toast.error("Please enter a block name");
                  return;
                }
                createBlockMutation.mutate(blockForm);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                  Block Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Block A, East Wing, Ground Floor"
                  value={blockForm.name}
                  onChange={(e) => setBlockForm({ ...blockForm, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                  Number of Floors
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={blockForm.floorCount}
                  onChange={(e) => setBlockForm({ ...blockForm, floorCount: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                    Grade Min (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Grade 9"
                    value={blockForm.gradeMin}
                    onChange={(e) => setBlockForm({ ...blockForm, gradeMin: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                    Grade Max (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Grade 12"
                    value={blockForm.gradeMax}
                    onChange={(e) => setBlockForm({ ...blockForm, gradeMax: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowCreateBlockModal(false)}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createBlockMutation.isPending}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50"
                >
                  {createBlockMutation.isPending ? "Creating..." : "Save Block"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: CREATE ROOM ─────────────────────────────────────────────────── */}
      {showAddRoomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Add Room to Block
              </h3>
              <button
                onClick={() => setShowAddRoomModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!roomForm.roomNumber.trim()) {
                  toast.error("Please enter a room number");
                  return;
                }
                createRoomMutation.mutate(roomForm);
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                    Room Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 101, 204-B"
                    value={roomForm.roomNumber}
                    onChange={(e) => setRoomForm({ ...roomForm, roomNumber: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                    Floor
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={roomForm.floor}
                    onChange={(e) => setRoomForm({ ...roomForm, floor: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                    Room Type
                  </label>
                  <select
                    value={roomForm.roomType}
                    onChange={(e) => setRoomForm({ ...roomForm, roomType: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="SINGLE">Single (1 Bed)</option>
                    <option value="DOUBLE">Double (2 Beds)</option>
                    <option value="TRIPLE">Triple (3 Beds)</option>
                    <option value="QUAD">Quad (4 Beds)</option>
                    <option value="DORMITORY">Dormitory</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                    Bed Capacity *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    required
                    value={roomForm.capacity}
                    onChange={(e) => setRoomForm({ ...roomForm, capacity: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={roomForm.autoCreateBeds}
                    onChange={(e) => setRoomForm({ ...roomForm, autoCreateBeds: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Automatically generate beds (A, B, C, D...)</span>
                </label>

                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={roomForm.isAccessible}
                    onChange={(e) => setRoomForm({ ...roomForm, isAccessible: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Wheelchair & disability accessible</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowAddRoomModal(false)}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createRoomMutation.isPending}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50"
                >
                  {createRoomMutation.isPending ? "Creating..." : "Save Room"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

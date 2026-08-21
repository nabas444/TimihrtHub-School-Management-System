import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../lib/api";
import PageLoader from "../../components/ui/PageLoader";
import toast from "react-hot-toast";
import {
  Wrench,
  Trash2,
  ClipboardCheck,
  TrendingDown,
  Plus,
  CheckCircle,
  AlertTriangle,
  X,
  RefreshCw,
} from "lucide-react";

export default function InventoryLifecyclePage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("MAINTENANCE");

  // Maintenance Ticket state
  const [showMaintModal, setShowMaintModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [maintForm, setMaintForm] = useState({
    itemId: "",
    faultDescription: "",
    externalVendor: "",
    cost: "",
  });
  const [resolveForm, setResolveForm] = useState({
    status: "RESOLVED",
    resolutionNotes: "",
    cost: "",
    conditionAfterRepair: "GOOD",
  });

  // Disposal state
  const [showDisposalModal, setShowDisposalModal] = useState(false);
  const [disposalForm, setDisposalForm] = useState({
    itemId: "",
    reason: "OBSOLETE",
    saleValue: "",
    method: "",
    notes: "",
  });

  // Stock Count state
  const [showStockCountModal, setShowStockCountModal] = useState(false);
  const [stockCountForm, setStockCountForm] = useState({
    title: "",
    locationId: "",
    notes: "",
  });

  // Queries
  const { data: maintenanceTickets, isLoading: loadingMaint } = useQuery({
    queryKey: ["inventory-maintenance"],
    queryFn: async () => {
      const res = await api.get("/inventory/maintenance");
      return res.data.data;
    },
  });

  const { data: disposals, isLoading: loadingDisposals } = useQuery({
    queryKey: ["inventory-disposals"],
    queryFn: async () => {
      const res = await api.get("/inventory/disposal");
      return res.data.data;
    },
  });

  const { data: depreciationSchedule, isLoading: loadingDep } = useQuery({
    queryKey: ["inventory-depreciation-schedule"],
    queryFn: async () => {
      const res = await api.get("/inventory/reports/depreciation-schedule");
      return res.data.data;
    },
  });

  const { data: stockCounts, isLoading: loadingSC } = useQuery({
    queryKey: ["inventory-stock-counts"],
    queryFn: async () => {
      const res = await api.get("/inventory/stock-counts");
      return res.data.data;
    },
  });

  const { data: items } = useQuery({
    queryKey: ["inventory-items-all"],
    queryFn: async () => {
      const res = await api.get("/inventory/items?limit=100");
      return res.data.data;
    },
  });

  const { data: locations } = useQuery({
    queryKey: ["inventory-locations-list"],
    queryFn: async () => {
      const res = await api.get("/inventory/locations");
      return res.data.data;
    },
  });

  // Maintenance Mutations
  const createMaintMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post("/inventory/maintenance", payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Maintenance ticket logged and item flagged as under repair");
      queryClient.invalidateQueries({ queryKey: ["inventory-maintenance"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-summary"] });
      setShowMaintModal(false);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to create ticket");
    },
  });

  const resolveMaintMutation = useMutation({
    mutationFn: async ({ id, payload }) => {
      const res = await api.patch(`/inventory/maintenance/${id}/resolve`, payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Ticket resolved and item restored to stock");
      queryClient.invalidateQueries({ queryKey: ["inventory-maintenance"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-summary"] });
      setShowResolveModal(false);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to resolve ticket");
    },
  });

  // Disposal Mutation
  const createDisposalMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post("/inventory/disposal", payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Asset decommissioned and disposal record logged");
      queryClient.invalidateQueries({ queryKey: ["inventory-disposals"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-summary"] });
      setShowDisposalModal(false);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to dispose asset");
    },
  });

  // Stock Count Mutations
  const createStockCountMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post("/inventory/stock-counts", payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Physical stock count event initiated");
      queryClient.invalidateQueries({ queryKey: ["inventory-stock-counts"] });
      setShowStockCountModal(false);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to start stock count");
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Asset Lifecycle & Compliance</h1>
          <p className="text-sm text-gray-500 mt-1">
            Repairs & maintenance tickets, straight-line depreciation schedules, write-offs, and stock reconciliation
          </p>
        </div>
        <div className="flex items-center gap-3">
          {activeTab === "MAINTENANCE" && (
            <button
              onClick={() => setShowMaintModal(true)}
              className="btn btn-primary flex items-center gap-2 text-sm bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Report Fault / Repair
            </button>
          )}
          {activeTab === "DEPRECIATION" && (
            <button
              onClick={() => setShowDisposalModal(true)}
              className="btn btn-primary flex items-center gap-2 text-sm bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm"
            >
              <Trash2 className="w-4 h-4" />
              Decommission / Write-off
            </button>
          )}
          {activeTab === "STOCK_COUNTS" && (
            <button
              onClick={() => setShowStockCountModal(true)}
              className="btn btn-primary flex items-center gap-2 text-sm bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Initiate Stock Count
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {[
          { id: "MAINTENANCE", label: "Maintenance & Repairs", icon: Wrench },
          { id: "DEPRECIATION", label: "Depreciation & Disposal", icon: TrendingDown },
          { id: "STOCK_COUNTS", label: "Physical Audits & Stock Counts", icon: ClipboardCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
                activeTab === tab.id
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-gray-500 hover:text-gray-900"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: MAINTENANCE */}
      {activeTab === "MAINTENANCE" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loadingMaint ? (
            <PageLoader />
          ) : !maintenanceTickets || maintenanceTickets.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Wrench className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="font-medium text-gray-900">No maintenance tickets reported</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {maintenanceTickets.map((ticket) => (
                <div key={ticket.id} className="p-6 hover:bg-gray-50/60 transition-colors flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900">{ticket.item?.name}</span>
                      <span className="font-mono text-xs text-gray-400">({ticket.item?.assetTagNumber})</span>
                    </div>
                    <p className="text-xs text-gray-600">{ticket.faultDescription}</p>
                    <p className="text-[11px] text-gray-400">
                      Reported by: {ticket.reportedBy?.firstName} {ticket.reportedBy?.lastName} • {new Date(ticket.reportedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        ticket.status === "RESOLVED" || ticket.status === "CLOSED"
                          ? "bg-green-100 text-green-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {ticket.status}
                    </span>
                    {ticket.status !== "RESOLVED" && ticket.status !== "CLOSED" && (
                      <button
                        onClick={() => {
                          setSelectedTicket(ticket);
                          setShowResolveModal(true);
                        }}
                        className="px-3 py-1.5 bg-primary-50 text-primary-700 hover:bg-primary-100 rounded-lg text-xs font-medium"
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DEPRECIATION & DISPOSAL */}
      {activeTab === "DEPRECIATION" && (
        <div className="space-y-6">
          {/* Depreciation Schedule Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Straight-Line Fixed Asset Depreciation Schedule</h2>
            </div>
            {loadingDep ? (
              <PageLoader />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50 text-xs font-semibold text-gray-700 uppercase border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3.5">Asset Tag</th>
                      <th className="px-6 py-3.5">Asset Name</th>
                      <th className="px-6 py-3.5">Cost</th>
                      <th className="px-6 py-3.5">Useful Life</th>
                      <th className="px-6 py-3.5">Elapsed</th>
                      <th className="px-6 py-3.5">Accumulated Dep.</th>
                      <th className="px-6 py-3.5 font-bold text-gray-900">Current Book Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {depreciationSchedule?.map((d) => (
                      <tr key={d.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-6 py-4 font-mono font-bold text-xs text-gray-900">{d.assetTagNumber}</td>
                        <td className="px-6 py-4 font-medium text-gray-900">{d.name}</td>
                        <td className="px-6 py-4 font-semibold text-gray-800">{d.purchaseCost.toLocaleString()} ETB</td>
                        <td className="px-6 py-4 text-xs">{d.usefulLifeMonths} mo</td>
                        <td className="px-6 py-4 text-xs">{d.monthsElapsed} mo</td>
                        <td className="px-6 py-4 text-red-600 font-medium">-{d.accumulatedDepreciation.toLocaleString()} ETB</td>
                        <td className="px-6 py-4 font-bold text-green-700">{d.currentBookValue.toLocaleString()} ETB</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: STOCK COUNTS */}
      {activeTab === "STOCK_COUNTS" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loadingSC ? (
            <PageLoader />
          ) : !stockCounts || stockCounts.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <ClipboardCheck className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="font-medium text-gray-900">No stock count events recorded</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {stockCounts.map((sc) => (
                <div key={sc.id} className="p-6 hover:bg-gray-50/60 transition-colors flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{sc.title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Scope: {sc.location?.name || "Whole School"} • Started by: {sc.startedBy?.firstName} {sc.startedBy?.lastName}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      sc.status === "COMPLETED" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {sc.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Report Fault Modal */}
      {showMaintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Report Fault / Maintenance</h3>
              <button onClick={() => setShowMaintModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMaintMutation.mutate({
                  ...maintForm,
                  cost: maintForm.cost ? Number(maintForm.cost) : 0,
                });
              }}
              className="space-y-4 text-sm"
            >
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Select Item *</label>
                <select
                  required
                  value={maintForm.itemId}
                  onChange={(e) => setMaintForm({ ...maintForm, itemId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                >
                  <option value="">Select Item</option>
                  {items?.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name} ({it.assetTagNumber || it.status})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Fault Description *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe the issue or defect..."
                  value={maintForm.faultDescription}
                  onChange={(e) => setMaintForm({ ...maintForm, faultDescription: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">External Repair Vendor</label>
                <input
                  type="text"
                  placeholder="e.g. Sony Authorized Service Center"
                  value={maintForm.externalVendor}
                  onChange={(e) => setMaintForm({ ...maintForm, externalVendor: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowMaintModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMaintMutation.isPending}
                  className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium"
                >
                  Submit Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resolve Maintenance Modal */}
      {showResolveModal && selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Resolve Maintenance Ticket</h3>
            <p className="text-xs text-gray-500">Asset: {selectedTicket.item?.name}</p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                resolveMaintMutation.mutate({
                  id: selectedTicket.id,
                  payload: {
                    ...resolveForm,
                    cost: resolveForm.cost ? Number(resolveForm.cost) : undefined,
                  },
                });
              }}
              className="space-y-4 text-sm"
            >
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Resolution Status *</label>
                <select
                  value={resolveForm.status}
                  onChange={(e) => setResolveForm({ ...resolveForm, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                >
                  <option value="RESOLVED">Resolved (Restores Asset to IN_STOCK)</option>
                  <option value="UNRESOLVABLE">Unresolvable (Condemn for Disposal)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Repair Cost (ETB)</label>
                <input
                  type="number"
                  placeholder="0"
                  value={resolveForm.cost}
                  onChange={(e) => setResolveForm({ ...resolveForm, cost: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Resolution Notes</label>
                <textarea
                  rows={2}
                  placeholder="Replaced part, tested ok..."
                  value={resolveForm.resolutionNotes}
                  onChange={(e) => setResolveForm({ ...resolveForm, resolutionNotes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowResolveModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resolveMaintMutation.isPending}
                  className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium"
                >
                  Complete Resolution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

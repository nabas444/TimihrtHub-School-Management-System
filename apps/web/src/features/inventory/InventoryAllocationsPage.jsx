import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../lib/api";
import PageLoader from "../../components/ui/PageLoader";
import toast from "react-hot-toast";
import {
  Users,
  Plus,
  RotateCcw,
  ArrowRightLeft,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  AlertTriangle,
  X,
} from "lucide-react";

export default function InventoryAllocationsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("ACTIVE");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Modal states
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedAllocation, setSelectedAllocation] = useState(null);

  // Forms
  const [issueForm, setIssueForm] = useState({
    itemId: "",
    custodianType: "STAFF",
    custodianUserId: "",
    custodianRoomId: "",
    custodianLabel: "",
    dueBackAt: "",
    conditionAtIssue: "GOOD",
    quantity: 1,
    notes: "",
  });

  const [returnForm, setReturnForm] = useState({
    conditionAtReturn: "GOOD",
    returnLocationId: "",
    notes: "",
  });

  const [transferForm, setTransferForm] = useState({
    newCustodianType: "STAFF",
    newCustodianUserId: "",
    newCustodianRoomId: "",
    newCustodianLabel: "",
    newLocationId: "",
    notes: "",
  });

  // Queries
  const { data: allocationsData, isLoading } = useQuery({
    queryKey: ["inventory-allocations", activeTab, search, page],
    queryFn: async () => {
      let url = `/inventory/allocations?page=${page}&limit=20`;
      if (activeTab === "OVERDUE") {
        const res = await api.get("/inventory/allocations/overdue");
        return { data: res.data.data, meta: { total: res.data.data.length } };
      }
      if (activeTab !== "ALL") url += `&status=${activeTab}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      const res = await api.get(url);
      return res.data;
    },
  });

  const { data: availableItems } = useQuery({
    queryKey: ["inventory-available-items"],
    queryFn: async () => {
      const res = await api.get("/inventory/items?limit=100");
      return res.data.data;
    },
  });

  const { data: staffUsers } = useQuery({
    queryKey: ["staff-users-list"],
    queryFn: async () => {
      const res = await api.get("/staff?limit=100");
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

  // Mutations
  const issueMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post("/inventory/allocations", payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Asset allocated successfully");
      queryClient.invalidateQueries({ queryKey: ["inventory-allocations"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-summary"] });
      setShowIssueModal(false);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to issue allocation");
    },
  });

  const returnMutation = useMutation({
    mutationFn: async ({ id, payload }) => {
      const res = await api.patch(`/inventory/allocations/${id}/return`, payload);
      return res.data;
    },
    onSuccess: (data) => {
      if (data.data?.maintenanceRecordId) {
        toast.success("Return logged in DAMAGED condition; Maintenance Ticket auto-opened!", { duration: 5000 });
      } else {
        toast.success("Return recorded and asset restored to stock");
      }
      queryClient.invalidateQueries({ queryKey: ["inventory-allocations"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-summary"] });
      setShowReturnModal(false);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to process return");
    },
  });

  const transferMutation = useMutation({
    mutationFn: async ({ id, payload }) => {
      const res = await api.patch(`/inventory/allocations/${id}/transfer`, payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Asset transferred to new custodian");
      queryClient.invalidateQueries({ queryKey: ["inventory-allocations"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      setShowTransferModal(false);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to transfer allocation");
    },
  });

  const allocations = allocationsData?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Asset & Stock Allocations</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage checkouts, staff custodians, classroom equipment assignments, and returns
          </p>
        </div>
        <button
          onClick={() => setShowIssueModal(true)}
          className="btn btn-primary flex items-center gap-2 text-sm bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Issue / Allocate
        </button>
      </div>

      {/* Tabs and Filters */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg text-xs font-semibold">
          {[
            { id: "ACTIVE", label: "Active Allocations" },
            { id: "OVERDUE", label: "Overdue Returns" },
            { id: "RETURNED", label: "Returned" },
            { id: "ALL", label: "All History" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-md transition-all ${
                activeTab === tab.id
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search item, custodian..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Allocations Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <PageLoader />
        ) : allocations.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Users className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-base font-medium text-gray-900">No allocations found</p>
            <p className="text-sm text-gray-500 mt-1">Issue an asset or consumable to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-700 uppercase border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3.5">Asset / Item</th>
                  <th className="px-6 py-3.5">Custodian</th>
                  <th className="px-6 py-3.5">Type</th>
                  <th className="px-6 py-3.5">Issued Date</th>
                  <th className="px-6 py-3.5">Due Date</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {allocations.map((alloc) => {
                  const isOverdue =
                    alloc.status === "ACTIVE" &&
                    alloc.dueBackAt &&
                    new Date(alloc.dueBackAt) < new Date();
                  return (
                    <tr key={alloc.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-gray-900">{alloc.item?.name}</p>
                        <p className="font-mono text-xs text-gray-400 mt-0.5">
                          {alloc.item?.assetTagNumber || "Consumable"}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">
                          {alloc.custodianUser
                            ? `${alloc.custodianUser.firstName} ${alloc.custodianUser.lastName}`
                            : alloc.custodianRoom?.name || alloc.custodianLabel || "—"}
                        </p>
                        <p className="text-xs text-gray-400">{alloc.custodianType}</p>
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-gray-700">
                        {alloc.quantity} unit{alloc.quantity > 1 ? "s" : ""}
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-600">
                        {new Date(alloc.issuedAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-xs">
                        {alloc.dueBackAt ? (
                          <span className={isOverdue ? "text-red-600 font-bold" : "text-gray-600"}>
                            {new Date(alloc.dueBackAt).toLocaleDateString()}
                            {isOverdue && " (Overdue)"}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            alloc.status === "ACTIVE"
                              ? isOverdue
                                ? "bg-red-100 text-red-800"
                                : "bg-green-100 text-green-800"
                              : alloc.status === "RETURNED"
                              ? "bg-gray-100 text-gray-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {isOverdue ? "OVERDUE" : alloc.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        {alloc.status === "ACTIVE" && (
                          <>
                            <button
                              onClick={() => {
                                setSelectedAllocation(alloc);
                                setShowReturnModal(true);
                              }}
                              className="px-2.5 py-1 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
                            >
                              Return
                            </button>
                            <button
                              onClick={() => {
                                setSelectedAllocation(alloc);
                                setShowTransferModal(true);
                              }}
                              className="px-2.5 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                              Transfer
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Issue Modal */}
      {showIssueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Issue Inventory Allocation</h3>
              <button onClick={() => setShowIssueModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                issueMutation.mutate(issueForm);
              }}
              className="space-y-4 text-sm"
            >
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Item to Allocate *</label>
                <select
                  required
                  value={issueForm.itemId}
                  onChange={(e) => setIssueForm({ ...issueForm, itemId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                >
                  <option value="">Select Item</option>
                  {availableItems?.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name} ({it.assetTagNumber || `${it.quantityOnHand} ${it.unit}`}) - {it.status}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Custodian Type *</label>
                <select
                  value={issueForm.custodianType}
                  onChange={(e) => setIssueForm({ ...issueForm, custodianType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                >
                  <option value="STAFF">Staff Member</option>
                  <option value="ROOM">Room / Classroom / Lab</option>
                  <option value="DEPARTMENT">Department</option>
                </select>
              </div>

              {issueForm.custodianType === "STAFF" ? (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Select Staff Member *</label>
                  <select
                    required
                    value={issueForm.custodianUserId}
                    onChange={(e) => setIssueForm({ ...issueForm, custodianUserId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  >
                    <option value="">Select Staff</option>
                    {staffUsers?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.firstName} {s.lastName} ({s.email})
                      </option>
                    ))}
                  </select>
                </div>
              ) : issueForm.custodianType === "ROOM" ? (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Select Room / Location *</label>
                  <select
                    required
                    value={issueForm.custodianRoomId}
                    onChange={(e) => setIssueForm({ ...issueForm, custodianRoomId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  >
                    <option value="">Select Room</option>
                    {locations?.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.type})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Department / Class Label *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Grade 10 Science Department"
                    value={issueForm.custodianLabel}
                    onChange={(e) => setIssueForm({ ...issueForm, custodianLabel: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Expected Return Date</label>
                  <input
                    type="date"
                    value={issueForm.dueBackAt}
                    onChange={(e) => setIssueForm({ ...issueForm, dueBackAt: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Condition</label>
                  <select
                    value={issueForm.conditionAtIssue}
                    onChange={(e) => setIssueForm({ ...issueForm, conditionAtIssue: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  >
                    <option value="NEW">New</option>
                    <option value="GOOD">Good</option>
                    <option value="FAIR">Fair</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  placeholder="Purpose of issue..."
                  value={issueForm.notes}
                  onChange={(e) => setIssueForm({ ...issueForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowIssueModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={issueMutation.isPending}
                  className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium"
                >
                  {issueMutation.isPending ? "Allocating..." : "Confirm Allocation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return Modal */}
      {showReturnModal && selectedAllocation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Return Asset</h3>
            <p className="text-xs text-gray-500">
              Returning: <span className="font-semibold text-gray-900">{selectedAllocation.item?.name}</span>
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                returnMutation.mutate({ id: selectedAllocation.id, payload: returnForm });
              }}
              className="space-y-4 text-sm"
            >
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Condition on Return *</label>
                <select
                  value={returnForm.conditionAtReturn}
                  onChange={(e) => setReturnForm({ ...returnForm, conditionAtReturn: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                >
                  <option value="GOOD">Good / Normal Wear</option>
                  <option value="FAIR">Fair</option>
                  <option value="DAMAGED">Damaged (Auto-Creates Maintenance Ticket)</option>
                  <option value="CONDEMNED">Condemned (Beyond Repair)</option>
                </select>
              </div>

              {returnForm.conditionAtReturn === "DAMAGED" && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <span>
                    Marking as DAMAGED will immediately flag this item as UNDER_MAINTENANCE and generate an active repair ticket.
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Return Notes</label>
                <textarea
                  rows={2}
                  placeholder="Notes on condition or parts..."
                  value={returnForm.notes}
                  onChange={(e) => setReturnForm({ ...returnForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowReturnModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={returnMutation.isPending}
                  className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium"
                >
                  {returnMutation.isPending ? "Processing..." : "Confirm Return"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

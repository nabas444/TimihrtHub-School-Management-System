import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../lib/api";
import PageLoader from "../../components/ui/PageLoader";
import toast from "react-hot-toast";
import {
  ShoppingCart,
  FileCheck,
  PackageCheck,
  Truck,
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  Send,
  AlertCircle,
  X,
  Building,
} from "lucide-react";

export default function InventoryProcurementPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("REQUISITIONS");

  // Requisitions state
  const [showReqModal, setShowReqModal] = useState(false);
  const [reqForm, setReqForm] = useState({
    reason: "",
    departmentOrRoom: "",
    neededBy: "",
    lines: [{ freeTextName: "", quantityRequested: 1 }],
  });

  // Purchase Order state
  const [showPoModal, setShowPoModal] = useState(false);
  const [poForm, setPoForm] = useState({
    supplierId: "",
    expectedDeliveryDate: "",
    currency: "ETB",
    notes: "",
    lines: [{ description: "", quantityOrdered: 1, unitCost: 0 }],
  });

  // Goods Receipt state
  const [showGrnModal, setShowGrnModal] = useState(false);
  const [grnForm, setGrnForm] = useState({
    locationId: "",
    poId: "",
    notes: "",
    lines: [{ itemId: "", quantityReceived: 1 }],
  });

  // Queries
  const { data: requests, isLoading: loadingReqs } = useQuery({
    queryKey: ["inventory-requests"],
    queryFn: async () => {
      const res = await api.get("/inventory/requests");
      return res.data.data;
    },
  });

  const { data: purchaseOrders, isLoading: loadingPOs } = useQuery({
    queryKey: ["inventory-purchase-orders"],
    queryFn: async () => {
      const res = await api.get("/inventory/purchase-orders");
      return res.data.data;
    },
  });

  const { data: goodsReceipts, isLoading: loadingGRNs } = useQuery({
    queryKey: ["inventory-goods-receipts"],
    queryFn: async () => {
      const res = await api.get("/inventory/goods-receipts");
      return res.data.data;
    },
  });

  const { data: suppliers } = useQuery({
    queryKey: ["inventory-suppliers-list"],
    queryFn: async () => {
      const res = await api.get("/inventory/suppliers");
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

  const { data: availableItems } = useQuery({
    queryKey: ["inventory-items-select"],
    queryFn: async () => {
      const res = await api.get("/inventory/items?limit=100");
      return res.data.data;
    },
  });

  // Requisition Mutations
  const createReqMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post("/inventory/requests", payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Requisition submitted successfully");
      queryClient.invalidateQueries({ queryKey: ["inventory-requests"] });
      setShowReqModal(false);
      setReqForm({
        reason: "",
        departmentOrRoom: "",
        neededBy: "",
        lines: [{ freeTextName: "", quantityRequested: 1 }],
      });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to submit request");
    },
  });

  const approveReqMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.patch(`/inventory/requests/${id}/approve`);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Requisition approved");
      queryClient.invalidateQueries({ queryKey: ["inventory-requests"] });
    },
  });

  const rejectReqMutation = useMutation({
    mutationFn: async ({ id, reason }) => {
      const res = await api.patch(`/inventory/requests/${id}/reject`, { rejectionReason: reason });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Requisition rejected");
      queryClient.invalidateQueries({ queryKey: ["inventory-requests"] });
    },
  });

  // PO Mutations
  const createPoMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post("/inventory/purchase-orders", payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Purchase order created");
      queryClient.invalidateQueries({ queryKey: ["inventory-purchase-orders"] });
      setShowPoModal(false);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to create PO");
    },
  });

  const approvePoMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.patch(`/inventory/purchase-orders/${id}/approve`);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Purchase order approved");
      queryClient.invalidateQueries({ queryKey: ["inventory-purchase-orders"] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Approval failed");
    },
  });

  const orderPoMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.patch(`/inventory/purchase-orders/${id}/order`);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Purchase order sent to supplier (ORDERED)");
      queryClient.invalidateQueries({ queryKey: ["inventory-purchase-orders"] });
    },
  });

  // GRN Mutation
  const createGrnMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post("/inventory/goods-receipts", payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Stock received and movement ledger updated");
      queryClient.invalidateQueries({ queryKey: ["inventory-goods-receipts"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      setShowGrnModal(false);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to record goods receipt");
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Procurement & Supplier Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            Department requisitions, approval thresholds, Purchase Orders, and Goods Receipts (GRN)
          </p>
        </div>
        <div className="flex items-center gap-3">
          {activeTab === "REQUISITIONS" && (
            <button
              onClick={() => setShowReqModal(true)}
              className="btn btn-primary flex items-center gap-2 text-sm bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm"
            >
              <Plus className="w-4 h-4" />
              New Requisition
            </button>
          )}
          {activeTab === "PURCHASE_ORDERS" && (
            <button
              onClick={() => setShowPoModal(true)}
              className="btn btn-primary flex items-center gap-2 text-sm bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Create Purchase Order
            </button>
          )}
          {activeTab === "GOODS_RECEIPTS" && (
            <button
              onClick={() => setShowGrnModal(true)}
              className="btn btn-primary flex items-center gap-2 text-sm bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Record Stock-in (GRN)
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {[
          { id: "REQUISITIONS", label: "Staff Requisitions", icon: FileCheck },
          { id: "PURCHASE_ORDERS", label: "Purchase Orders", icon: ShoppingCart },
          { id: "GOODS_RECEIPTS", label: "Goods Receipts (Stock-In)", icon: PackageCheck },
          { id: "SUPPLIERS", label: "Vendors & Suppliers", icon: Truck },
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

      {/* TAB 1: REQUISITIONS */}
      {activeTab === "REQUISITIONS" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loadingReqs ? (
            <PageLoader />
          ) : !requests || requests.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <FileCheck className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="font-medium text-gray-900">No requisitions submitted</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {requests.map((req) => (
                <div key={req.id} className="p-6 hover:bg-gray-50/60 transition-colors space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900 text-base">{req.reason}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Requested by: {req.requestedBy?.firstName} {req.requestedBy?.lastName} ({req.requestedBy?.role}) • Department: {req.departmentOrRoom || "General"}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        req.status === "APPROVED"
                          ? "bg-green-100 text-green-800"
                          : req.status === "PENDING"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>

                  {/* Lines */}
                  <div className="bg-gray-50 p-3 rounded-lg text-xs space-y-1">
                    <p className="font-semibold text-gray-700">Requested Items:</p>
                    {req.lines?.map((l) => (
                      <p key={l.id} className="text-gray-600">
                        • {l.item?.name || l.freeTextName} — Qty: <span className="font-bold">{l.quantityRequested}</span>
                      </p>
                    ))}
                  </div>

                  {/* Action buttons */}
                  {req.status === "PENDING" && (
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        onClick={() => approveReqMutation.mutate(req.id)}
                        className="btn btn-sm bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button
                        onClick={() => {
                          const r = prompt("Enter rejection reason:");
                          if (r) rejectReqMutation.mutate({ id: req.id, reason: r });
                        }}
                        className="btn btn-sm bg-red-50 hover:bg-red-100 text-red-700 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PURCHASE ORDERS */}
      {activeTab === "PURCHASE_ORDERS" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loadingPOs ? (
            <PageLoader />
          ) : !purchaseOrders || purchaseOrders.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <ShoppingCart className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="font-medium text-gray-900">No purchase orders created</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-xs font-semibold text-gray-700 uppercase border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3.5">PO Number</th>
                    <th className="px-6 py-3.5">Supplier</th>
                    <th className="px-6 py-3.5">Total Amount</th>
                    <th className="px-6 py-3.5">Date</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {purchaseOrders.map((po) => (
                    <tr key={po.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-xs text-gray-900">{po.poNumber}</td>
                      <td className="px-6 py-4 font-medium text-gray-900">{po.supplier?.name}</td>
                      <td className="px-6 py-4 font-bold text-gray-900">
                        {po.totalAmount.toLocaleString()} {po.currency}
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-600">
                        {new Date(po.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            po.status === "APPROVED" || po.status === "RECEIVED"
                              ? "bg-green-100 text-green-800"
                              : po.status === "ORDERED"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {po.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        {po.status === "DRAFT" || po.status === "SUBMITTED" ? (
                          <button
                            onClick={() => approvePoMutation.mutate(po.id)}
                            className="px-2.5 py-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg"
                          >
                            Approve PO
                          </button>
                        ) : po.status === "APPROVED" ? (
                          <button
                            onClick={() => orderPoMutation.mutate(po.id)}
                            className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center gap-1 inline-flex"
                          >
                            <Send className="w-3 h-3" /> Mark Ordered
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: GOODS RECEIPTS */}
      {activeTab === "GOODS_RECEIPTS" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loadingGRNs ? (
            <PageLoader />
          ) : !goodsReceipts || goodsReceipts.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <PackageCheck className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="font-medium text-gray-900">No goods receipt records found</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {goodsReceipts.map((grn) => (
                <div key={grn.id} className="p-5 hover:bg-gray-50/60 transition-colors flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">
                      GRN #{grn.id.substring(0, 8)} • Receiving Store: {grn.location?.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Received By: {grn.receivedBy?.firstName} {grn.receivedBy?.lastName} • {new Date(grn.receivedAt).toLocaleString()}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded text-xs font-bold bg-green-50 text-green-700">
                    Received
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: SUPPLIERS */}
      {activeTab === "SUPPLIERS" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers?.map((s) => (
            <div key={s.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-900 text-base">{s.name}</h3>
                <span className="text-xs font-bold text-amber-600">⭐ {s.rating || 5}/5</span>
              </div>
              <p className="text-xs text-gray-600">Contact: {s.contactName || "—"}</p>
              <p className="text-xs text-gray-500">Phone: {s.phone || "—"}</p>
              <p className="text-xs text-gray-500">Email: {s.email || "—"}</p>
            </div>
          ))}
        </div>
      )}

      {/* New Requisition Modal */}
      {showReqModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">New Inventory Requisition</h3>
              <button onClick={() => setShowReqModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createReqMutation.mutate(reqForm);
              }}
              className="space-y-4 text-sm"
            >
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Reason / Purpose *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Science lab equipment for Grade 12"
                  value={reqForm.reason}
                  onChange={(e) => setReqForm({ ...reqForm, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Department / Classroom</label>
                <input
                  type="text"
                  placeholder="e.g. Biology Lab"
                  value={reqForm.departmentOrRoom}
                  onChange={(e) => setReqForm({ ...reqForm, departmentOrRoom: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Item Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Glass Beakers 500ml"
                  value={reqForm.lines[0].freeTextName}
                  onChange={(e) =>
                    setReqForm({
                      ...reqForm,
                      lines: [{ ...reqForm.lines[0], freeTextName: e.target.value }],
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Quantity Requested</label>
                <input
                  type="number"
                  min="1"
                  value={reqForm.lines[0].quantityRequested}
                  onChange={(e) =>
                    setReqForm({
                      ...reqForm,
                      lines: [{ ...reqForm.lines[0], quantityRequested: Number(e.target.value) }],
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowReqModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createReqMutation.isPending}
                  className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium"
                >
                  Submit Requisition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Purchase Order Modal */}
      {showPoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Create Purchase Order</h3>
              <button onClick={() => setShowPoModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createPoMutation.mutate(poForm);
              }}
              className="space-y-4 text-sm"
            >
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Vendor / Supplier *</label>
                <select
                  required
                  value={poForm.supplierId}
                  onChange={(e) => setPoForm({ ...poForm, supplierId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                >
                  <option value="">Select Supplier</option>
                  {suppliers?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Item Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dell Laptops 15-inch"
                  value={poForm.lines[0].description}
                  onChange={(e) =>
                    setPoForm({
                      ...poForm,
                      lines: [{ ...poForm.lines[0], description: e.target.value }],
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={poForm.lines[0].quantityOrdered}
                    onChange={(e) =>
                      setPoForm({
                        ...poForm,
                        lines: [{ ...poForm.lines[0], quantityOrdered: Number(e.target.value) }],
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Unit Cost (ETB)</label>
                  <input
                    type="number"
                    min="0"
                    value={poForm.lines[0].unitCost}
                    onChange={(e) =>
                      setPoForm({
                        ...poForm,
                        lines: [{ ...poForm.lines[0], unitCost: Number(e.target.value) }],
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowPoModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createPoMutation.isPending}
                  className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium"
                >
                  Generate Purchase Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Stock-in (GRN) Modal */}
      {showGrnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Record Goods Receipt (Stock-In)</h3>
              <button onClick={() => setShowGrnModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createGrnMutation.mutate(grnForm);
              }}
              className="space-y-4 text-sm"
            >
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Receiving Location / Store *</label>
                <select
                  required
                  value={grnForm.locationId}
                  onChange={(e) => setGrnForm({ ...grnForm, locationId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                >
                  <option value="">Select Location</option>
                  {locations?.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Select Catalog Item *</label>
                <select
                  required
                  value={grnForm.lines[0].itemId}
                  onChange={(e) =>
                    setGrnForm({
                      ...grnForm,
                      lines: [{ ...grnForm.lines[0], itemId: e.target.value }],
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                >
                  <option value="">Select Item</option>
                  {availableItems?.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name} ({it.itemType})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Quantity Received</label>
                <input
                  type="number"
                  min="1"
                  value={grnForm.lines[0].quantityReceived}
                  onChange={(e) =>
                    setGrnForm({
                      ...grnForm,
                      lines: [{ ...grnForm.lines[0], quantityReceived: Number(e.target.value) }],
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowGrnModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createGrnMutation.isPending}
                  className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium"
                >
                  Confirm Stock-in
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../lib/api";
import PageLoader from "../../components/ui/PageLoader";
import toast from "react-hot-toast";
import {
  Package,
  Plus,
  Search,
  Filter,
  QrCode,
  History,
  Trash2,
  Edit2,
  ArrowUpRight,
  Download,
  AlertTriangle,
  CheckCircle2,
  X,
} from "lucide-react";

export default function InventoryItemsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("ALL");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [page, setPage] = useState(1);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailDrawer, setShowDetailDrawer] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [selectedQrItem, setSelectedQrItem] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    categoryId: "",
    itemType: "FIXED_ASSET",
    sku: "",
    serialNumber: "",
    currentLocationId: "",
    initialQuantity: 1,
    unit: "unit",
    unitCost: "",
    purchaseCost: "",
    salvageValue: 0,
    usefulLifeMonths: 60,
    reorderPoint: "",
    reorderQty: "",
    condition: "NEW",
    description: "",
  });

  // Queries
  const { data: itemsData, isLoading } = useQuery({
    queryKey: ["inventory-items", activeTab, search, selectedCategory, page],
    queryFn: async () => {
      let url = `/inventory/items?page=${page}&limit=20`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (selectedCategory) url += `&categoryId=${selectedCategory}`;
      if (activeTab === "FIXED_ASSET" || activeTab === "CONSUMABLE") url += `&itemType=${activeTab}`;
      const res = await api.get(url);
      return res.data;
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["inventory-categories-list"],
    queryFn: async () => {
      const res = await api.get("/inventory/categories");
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

  const { data: itemHistory, isLoading: loadingHistory } = useQuery({
    queryKey: ["inventory-item-history", selectedItemId],
    queryFn: async () => {
      if (!selectedItemId) return null;
      const res = await api.get(`/inventory/items/${selectedItemId}/history`);
      return res.data.data;
    },
    enabled: !!selectedItemId && showDetailDrawer,
  });

  // Create item mutation
  const createItemMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post("/inventory/items", payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Inventory item registered successfully");
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-summary"] });
      setShowAddModal(false);
      setFormData({
        name: "",
        categoryId: "",
        itemType: "FIXED_ASSET",
        sku: "",
        serialNumber: "",
        currentLocationId: "",
        initialQuantity: 1,
        unit: "unit",
        unitCost: "",
        purchaseCost: "",
        salvageValue: 0,
        usefulLifeMonths: 60,
        reorderPoint: "",
        reorderQty: "",
        condition: "NEW",
        description: "",
      });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to create item");
    },
  });

  // Delete item mutation
  const deleteItemMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.delete(`/inventory/items/${id}`);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Item removed from active inventory");
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      setShowDetailDrawer(false);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to delete item");
    },
  });

  const handleSubmitItem = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return toast.error("Item name is required");
    if (!formData.categoryId) return toast.error("Category is required");

    const payload = {
      ...formData,
      initialQuantity: Number(formData.initialQuantity) || 0,
      unitCost: formData.unitCost ? Number(formData.unitCost) : undefined,
      purchaseCost: formData.purchaseCost ? Number(formData.purchaseCost) : undefined,
      salvageValue: formData.salvageValue ? Number(formData.salvageValue) : 0,
      usefulLifeMonths: formData.usefulLifeMonths ? Number(formData.usefulLifeMonths) : undefined,
      reorderPoint: formData.reorderPoint ? Number(formData.reorderPoint) : undefined,
      reorderQty: formData.reorderQty ? Number(formData.reorderQty) : undefined,
    };

    createItemMutation.mutate(payload);
  };

  const handleOpenQr = async (item) => {
    try {
      const res = await api.get(`/inventory/items/${item.id}/qrcode`);
      setSelectedQrItem({ ...item, qrDataUrl: res.data.data.qrDataUrl, qrPayload: res.data.data.qrPayload });
      setShowQrModal(true);
    } catch {
      toast.error("Failed to load QR code");
    }
  };

  const items = itemsData?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Items Catalog</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track fixed assets with serial numbers, barcodes, asset tags, and consumables stock
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary flex items-center gap-2 text-sm bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Item
        </button>
      </div>

      {/* Tabs & Search Filters */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Tabs */}
          <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg text-xs font-semibold">
            {[
              { id: "ALL", label: "All Items" },
              { id: "FIXED_ASSET", label: "Fixed Assets" },
              { id: "CONSUMABLE", label: "Consumables" },
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

          {/* Search and Category Filter */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search tag, name, SKU..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setPage(1);
              }}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-primary-500 focus:outline-none text-gray-700"
            >
              <option value="">All Categories</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <PageLoader />
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Package className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-base font-medium text-gray-900">No inventory items found</p>
            <p className="text-sm text-gray-500 mt-1">Get started by creating your first item catalog entry.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-700 uppercase border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3.5">Asset Tag / SKU</th>
                  <th className="px-6 py-3.5">Item Name</th>
                  <th className="px-6 py-3.5">Type</th>
                  <th className="px-6 py-3.5">Category</th>
                  <th className="px-6 py-3.5">Location</th>
                  <th className="px-6 py-3.5">Stock / Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs font-bold text-gray-900">
                      {item.assetTagNumber || item.sku || "—"}
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-gray-900">{item.name}</p>
                      {item.serialNumber && (
                        <p className="text-xs text-gray-400 mt-0.5">SN: {item.serialNumber}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${
                          item.itemType === "FIXED_ASSET"
                            ? "bg-purple-50 text-purple-700"
                            : "bg-blue-50 text-blue-700"
                        }`}
                      >
                        {item.itemType === "FIXED_ASSET" ? "Fixed Asset" : "Consumable"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-gray-700">
                      {item.category?.name || "General"}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-600">
                      {item.currentLocation?.name || "—"}
                    </td>
                    <td className="px-6 py-4">
                      {item.itemType === "FIXED_ASSET" ? (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            item.status === "IN_STOCK"
                              ? "bg-green-100 text-green-800"
                              : item.status === "ALLOCATED"
                              ? "bg-blue-100 text-blue-800"
                              : item.status === "UNDER_MAINTENANCE"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {item.status}
                        </span>
                      ) : (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            item.reorderPoint !== null && (item.quantityOnHand ?? 0) <= item.reorderPoint
                              ? "bg-red-100 text-red-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {item.quantityOnHand ?? 0} {item.unit}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleOpenQr(item)}
                        title="View QR Code"
                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-900 transition-colors"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedItemId(item.id);
                          setShowDetailDrawer(true);
                        }}
                        title="History & Details"
                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-900 transition-colors"
                      >
                        <History className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Add Inventory Item</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitItem} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Item Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MacBook Air M2 13-inch"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Category *</label>
                  <select
                    required
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  >
                    <option value="">Select Category</option>
                    {categories?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Item Type *</label>
                  <select
                    value={formData.itemType}
                    onChange={(e) => setFormData({ ...formData, itemType: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  >
                    <option value="FIXED_ASSET">Fixed Asset (Serialized / Tagged)</option>
                    <option value="CONSUMABLE">Consumable (Stocked in Bulk)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Initial Location</label>
                  <select
                    value={formData.currentLocationId}
                    onChange={(e) => setFormData({ ...formData, currentLocationId: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  >
                    <option value="">Select Location</option>
                    {locations?.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.type})
                      </option>
                    ))}
                  </select>
                </div>

                {formData.itemType === "FIXED_ASSET" ? (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Serial Number</label>
                      <input
                        type="text"
                        placeholder="e.g. C02G1234XYZ"
                        value={formData.serialNumber}
                        onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Purchase Cost (ETB)</label>
                      <input
                        type="number"
                        placeholder="55000"
                        value={formData.purchaseCost}
                        onChange={(e) => setFormData({ ...formData, purchaseCost: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Useful Life (Months)</label>
                      <input
                        type="number"
                        placeholder="60"
                        value={formData.usefulLifeMonths}
                        onChange={(e) => setFormData({ ...formData, usefulLifeMonths: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Initial Stock Qty</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.initialQuantity}
                        onChange={(e) => setFormData({ ...formData, initialQuantity: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Unit (e.g. ream, box)</label>
                      <input
                        type="text"
                        value={formData.unit}
                        onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Reorder Point</label>
                      <input
                        type="number"
                        placeholder="10"
                        value={formData.reorderPoint}
                        onChange={(e) => setFormData({ ...formData, reorderPoint: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createItemMutation.isPending}
                  className="px-5 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium shadow-sm"
                >
                  {createItemMutation.isPending ? "Saving..." : "Create Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQrModal && selectedQrItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Asset QR / Barcode</h3>
            <p className="text-xs text-gray-500">{selectedQrItem.name}</p>
            <div className="p-4 bg-white border border-gray-200 rounded-xl inline-block shadow-inner">
              <img
                src={selectedQrItem.qrDataUrl}
                alt="QR Code"
                className="w-48 h-48 mx-auto"
              />
            </div>
            <p className="font-mono text-sm font-bold text-gray-800">{selectedQrItem.assetTagNumber || selectedQrItem.sku}</p>
            <div className="flex justify-center gap-3 pt-2">
              <a
                href={selectedQrItem.qrDataUrl}
                download={`${selectedQrItem.assetTagNumber || selectedQrItem.id}-qrcode.png`}
                className="btn btn-outline flex items-center gap-1.5 text-xs border border-gray-300 px-3 py-1.5 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                <Download className="w-3.5 h-3.5" /> Download
              </a>
              <button
                onClick={() => setShowQrModal(false)}
                className="btn btn-primary text-xs bg-primary-600 text-white px-4 py-1.5 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail & History Drawer */}
      {showDetailDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <div className="bg-white w-full max-w-md h-full shadow-2xl p-6 overflow-y-auto space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{itemHistory?.item?.name}</h3>
                <p className="text-xs font-mono text-primary-600 mt-0.5">{itemHistory?.item?.assetTagNumber}</p>
              </div>
              <button onClick={() => setShowDetailDrawer(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Timeline */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Item Activity History</h4>
              <div className="space-y-4 border-l-2 border-primary-200 pl-4 ml-2">
                {itemHistory?.movements?.map((m) => (
                  <div key={m.id} className="relative">
                    <div className="absolute -left-[23px] top-1 w-3 h-3 bg-primary-600 rounded-full" />
                    <p className="text-xs font-bold text-gray-900">{m.type}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{m.note || "Movement"}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {new Date(m.createdAt).toLocaleString()} by {m.performedBy?.firstName}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Delete button */}
            <div className="pt-6 border-t border-gray-100">
              <button
                onClick={() => {
                  if (confirm("Are you sure you want to decommission/remove this item?")) {
                    deleteItemMutation.mutate(selectedItemId);
                  }
                }}
                className="w-full flex items-center justify-center gap-2 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg font-medium border border-red-200"
              >
                <Trash2 className="w-4 h-4" /> Decommission / Remove Item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../lib/api";
import PageLoader from "../../components/ui/PageLoader";
import toast from "react-hot-toast";
import {
  MapPin,
  FolderTree,
  Plus,
  Trash2,
  Edit2,
  ChevronRight,
  Layers,
  Building,
  X,
} from "lucide-react";

export default function InventoryLocationsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("LOCATIONS");

  // Add Location Modal
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationForm, setLocationForm] = useState({
    name: "",
    code: "",
    type: "ROOM",
    parentId: "",
  });

  // Add Category Modal
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    code: "",
    defaultItemType: "FIXED_ASSET",
    parentId: "",
  });

  // Queries
  const { data: locationTree, isLoading: loadingLocTree } = useQuery({
    queryKey: ["inventory-location-tree"],
    queryFn: async () => {
      const res = await api.get("/inventory/locations/tree");
      return res.data.data;
    },
  });

  const { data: locationsList } = useQuery({
    queryKey: ["inventory-locations-list"],
    queryFn: async () => {
      const res = await api.get("/inventory/locations");
      return res.data.data;
    },
  });

  const { data: categoryTree, isLoading: loadingCatTree } = useQuery({
    queryKey: ["inventory-category-tree"],
    queryFn: async () => {
      const res = await api.get("/inventory/categories/tree");
      return res.data.data;
    },
  });

  const { data: categoriesList } = useQuery({
    queryKey: ["inventory-categories-list"],
    queryFn: async () => {
      const res = await api.get("/inventory/categories");
      return res.data.data;
    },
  });

  // Location Mutations
  const createLocationMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post("/inventory/locations", payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Location created successfully");
      queryClient.invalidateQueries({ queryKey: ["inventory-location-tree"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-locations-list"] });
      setShowLocationModal(false);
      setLocationForm({ name: "", code: "", type: "ROOM", parentId: "" });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to create location");
    },
  });

  const deleteLocationMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.delete(`/inventory/locations/${id}`);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Location deleted");
      queryClient.invalidateQueries({ queryKey: ["inventory-location-tree"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-locations-list"] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to delete location");
    },
  });

  // Category Mutations
  const createCategoryMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post("/inventory/categories", payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Category created successfully");
      queryClient.invalidateQueries({ queryKey: ["inventory-category-tree"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-categories-list"] });
      setShowCategoryModal(false);
      setCategoryForm({ name: "", code: "", defaultItemType: "FIXED_ASSET", parentId: "" });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to create category");
    },
  });

  const renderLocationNode = (node, depth = 0) => (
    <div key={node.id} className="space-y-2">
      <div
        className="p-3 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between transition-colors shadow-sm"
        style={{ marginLeft: `${depth * 24}px` }}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-50 text-primary-600 rounded-lg">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm">{node.name}</p>
            <p className="text-xs text-gray-400">
              Code: <span className="font-mono">{node.code}</span> • Type: {node.type}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            if (confirm(`Delete location "${node.name}"?`)) {
              deleteLocationMutation.mutate(node.id);
            }
          }}
          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      {node.children && node.children.map((child) => renderLocationNode(child, depth + 1))}
    </div>
  );

  const renderCategoryNode = (node, depth = 0) => (
    <div key={node.id} className="space-y-2">
      <div
        className="p-3 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between transition-colors shadow-sm"
        style={{ marginLeft: `${depth * 24}px` }}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm">{node.name}</p>
            <p className="text-xs text-gray-400">
              Code: <span className="font-mono">{node.code}</span> • Default: {node.defaultItemType}
            </p>
          </div>
        </div>
      </div>
      {node.children && node.children.map((child) => renderCategoryNode(child, depth + 1))}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Locations & Categories Setup</h1>
          <p className="text-sm text-gray-500 mt-1">
            Hierarchical physical storage mapping (Campus $\rightarrow$ Building $\rightarrow$ Room $\rightarrow$ Shelf) and classification trees
          </p>
        </div>
        <div className="flex items-center gap-3">
          {activeTab === "LOCATIONS" ? (
            <button
              onClick={() => setShowLocationModal(true)}
              className="btn btn-primary flex items-center gap-2 text-sm bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm"
            >
              <Plus className="w-4 h-4" /> Add Location
            </button>
          ) : (
            <button
              onClick={() => setShowCategoryModal(true)}
              className="btn btn-primary flex items-center gap-2 text-sm bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm"
            >
              <Plus className="w-4 h-4" /> Add Category
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab("LOCATIONS")}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "LOCATIONS"
              ? "border-primary-600 text-primary-600"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          <Building className="w-4 h-4" />
          Physical Locations Tree
        </button>
        <button
          onClick={() => setActiveTab("CATEGORIES")}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "CATEGORIES"
              ? "border-primary-600 text-primary-600"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          <FolderTree className="w-4 h-4" />
          Categories Hierarchy
        </button>
      </div>

      {/* Locations Tab */}
      {activeTab === "LOCATIONS" && (
        <div className="space-y-3">
          {loadingLocTree ? (
            <PageLoader />
          ) : !locationTree || locationTree.length === 0 ? (
            <div className="p-12 text-center text-gray-500 bg-white rounded-xl border border-gray-200">
              <MapPin className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="font-medium text-gray-900">No physical locations configured</p>
            </div>
          ) : (
            locationTree.map((loc) => renderLocationNode(loc))
          )}
        </div>
      )}

      {/* Categories Tab */}
      {activeTab === "CATEGORIES" && (
        <div className="space-y-3">
          {loadingCatTree ? (
            <PageLoader />
          ) : !categoryTree || categoryTree.length === 0 ? (
            <div className="p-12 text-center text-gray-500 bg-white rounded-xl border border-gray-200">
              <Layers className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="font-medium text-gray-900">No inventory categories configured</p>
            </div>
          ) : (
            categoryTree.map((cat) => renderCategoryNode(cat))
          )}
        </div>
      )}

      {/* Add Location Modal */}
      {showLocationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Add Physical Location</h3>
              <button onClick={() => setShowLocationModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createLocationMutation.mutate({
                  ...locationForm,
                  parentId: locationForm.parentId || null,
                });
              }}
              className="space-y-4 text-sm"
            >
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Location Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Physics Laboratory Room 204"
                  value={locationForm.name}
                  onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Code / Room Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. LAB-PHYS-204"
                  value={locationForm.code}
                  onChange={(e) => setLocationForm({ ...locationForm, code: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Location Type *</label>
                <select
                  value={locationForm.type}
                  onChange={(e) => setLocationForm({ ...locationForm, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                >
                  <option value="CAMPUS">Campus</option>
                  <option value="BUILDING">Building / Block</option>
                  <option value="FLOOR">Floor</option>
                  <option value="ROOM">Room / Classroom / Lab</option>
                  <option value="STORE_ROOM">Store Room / Warehouse</option>
                  <option value="SHELF_BIN">Shelf / Bin</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Parent Location</label>
                <select
                  value={locationForm.parentId}
                  onChange={(e) => setLocationForm({ ...locationForm, parentId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                >
                  <option value="">None (Top-level Campus)</option>
                  {locationsList?.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-gray-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowLocationModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLocationMutation.isPending}
                  className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium"
                >
                  Create Location
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Add Inventory Category</h3>
              <button onClick={() => setShowCategoryModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createCategoryMutation.mutate({
                  ...categoryForm,
                  parentId: categoryForm.parentId || null,
                });
              }}
              className="space-y-4 text-sm"
            >
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Category Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Laboratory Equipment"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Category Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. LAB-EQ"
                  value={categoryForm.code}
                  onChange={(e) => setCategoryForm({ ...categoryForm, code: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Default Item Type *</label>
                <select
                  value={categoryForm.defaultItemType}
                  onChange={(e) => setCategoryForm({ ...categoryForm, defaultItemType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                >
                  <option value="FIXED_ASSET">Fixed Asset</option>
                  <option value="CONSUMABLE">Consumable</option>
                </select>
              </div>

              <div className="pt-3 border-t border-gray-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createCategoryMutation.isPending}
                  className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium"
                >
                  Create Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

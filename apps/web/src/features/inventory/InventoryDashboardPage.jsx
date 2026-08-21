import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import api from "../../lib/api";
import StatCard from "../../components/shared/StatCard";
import PageLoader from "../../components/ui/PageLoader";
import {
  Package,
  DollarSign,
  AlertTriangle,
  Wrench,
  Users,
  FileCheck,
  TrendingDown,
  ArrowRight,
  Plus,
  QrCode,
  Layers,
  MapPin,
} from "lucide-react";

export default function InventoryDashboardPage() {
  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["inventory-summary"],
    queryFn: async () => {
      const res = await api.get("/inventory/reports/summary");
      return res.data.data;
    },
  });

  const { data: lowStock, isLoading: loadingLowStock } = useQuery({
    queryKey: ["inventory-low-stock"],
    queryFn: async () => {
      const res = await api.get("/inventory/items/low-stock");
      return res.data.data;
    },
  });

  const { data: recentMovements, isLoading: loadingMovements } = useQuery({
    queryKey: ["inventory-recent-movements"],
    queryFn: async () => {
      const res = await api.get("/inventory/movements?limit=8");
      return res.data.data;
    },
  });

  const { data: categoryValuation, isLoading: loadingCatVal } = useQuery({
    queryKey: ["inventory-cat-valuation"],
    queryFn: async () => {
      const res = await api.get("/inventory/reports/category-valuation");
      return res.data.data;
    },
  });

  if (loadingSummary) return <PageLoader />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory & Asset Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time asset valuation, stock levels, equipment tracking, and compliance
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/inventory/allocations"
            className="btn btn-outline flex items-center gap-2 text-sm bg-white hover:bg-gray-50 border border-gray-300 px-4 py-2 rounded-lg font-medium text-gray-700 shadow-sm"
          >
            <Users className="w-4 h-4 text-gray-500" />
            Issue / Allocate
          </Link>
          <Link
            to="/inventory/items"
            className="btn btn-primary flex items-center gap-2 text-sm bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Item
          </Link>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={DollarSign}
          label="Total Inventory Value"
          value={`${(summary?.totalCombinedInventoryValuation || 0).toLocaleString()} ETB`}
          color="green"
          delta={`Fixed: ${(summary?.totalFixedAssetBookValue || 0).toLocaleString()} | Stock: ${(summary?.totalConsumableStockValue || 0).toLocaleString()}`}
        />
        <StatCard
          icon={Package}
          label="Catalog Items"
          value={summary?.totalItemsCount || 0}
          color="blue"
          delta={`${summary?.totalFixedAssetsCount || 0} Assets • ${summary?.totalConsumablesCount || 0} Consumables`}
        />
        <StatCard
          icon={AlertTriangle}
          label="Low Stock Alerts"
          value={summary?.lowStockAlertsCount || 0}
          color={summary?.lowStockAlertsCount > 0 ? "red" : "amber"}
          delta={summary?.lowStockAlertsCount > 0 ? "Requires Reorder" : "All stock healthy"}
        />
        <StatCard
          icon={Wrench}
          label="Under Maintenance"
          value={summary?.itemsUnderMaintenanceCount || 0}
          color="purple"
          delta={`${summary?.activeAllocationsCount?.TOTAL || 0} active allocations`}
        />
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Link
          to="/inventory/items"
          className="p-4 bg-white rounded-xl border border-gray-200 hover:border-primary-400 hover:shadow-sm transition-all group flex flex-col items-center text-center"
        >
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg group-hover:scale-110 transition-transform mb-2">
            <Package className="w-6 h-6" />
          </div>
          <span className="font-semibold text-gray-900 text-sm">Item Catalog</span>
          <span className="text-xs text-gray-500 mt-0.5">Fixed assets & supplies</span>
        </Link>
        <Link
          to="/inventory/allocations"
          className="p-4 bg-white rounded-xl border border-gray-200 hover:border-primary-400 hover:shadow-sm transition-all group flex flex-col items-center text-center"
        >
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg group-hover:scale-110 transition-transform mb-2">
            <Users className="w-6 h-6" />
          </div>
          <span className="font-semibold text-gray-900 text-sm">Allocations</span>
          <span className="text-xs text-gray-500 mt-0.5">Issue, return & transfer</span>
        </Link>
        <Link
          to="/inventory/procurement"
          className="p-4 bg-white rounded-xl border border-gray-200 hover:border-primary-400 hover:shadow-sm transition-all group flex flex-col items-center text-center"
        >
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg group-hover:scale-110 transition-transform mb-2">
            <FileCheck className="w-6 h-6" />
          </div>
          <span className="font-semibold text-gray-900 text-sm">Procurement</span>
          <span className="text-xs text-gray-500 mt-0.5">Requisitions & POs</span>
        </Link>
        <Link
          to="/inventory/lifecycle"
          className="p-4 bg-white rounded-xl border border-gray-200 hover:border-primary-400 hover:shadow-sm transition-all group flex flex-col items-center text-center"
        >
          <div className="p-3 bg-rose-50 text-rose-600 rounded-lg group-hover:scale-110 transition-transform mb-2">
            <Wrench className="w-6 h-6" />
          </div>
          <span className="font-semibold text-gray-900 text-sm">Lifecycle</span>
          <span className="text-xs text-gray-500 mt-0.5">Repairs, audit & disposal</span>
        </Link>
      </div>

      {/* Main Content Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Low Stock Alerts & Category Valuation */}
        <div className="lg:col-span-2 space-y-6">
          {/* Low Stock Alerts */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h2 className="font-semibold text-gray-900">Low Stock Consumables</h2>
              </div>
              <Link to="/inventory/items" className="text-xs text-primary-600 font-medium hover:underline flex items-center gap-1">
                View All <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="divide-y divide-gray-100">
              {lowStock && lowStock.length > 0 ? (
                lowStock.slice(0, 5).map((item) => (
                  <div key={item.id} className="px-6 py-3.5 flex items-center justify-between hover:bg-gray-50/60 transition-colors">
                    <div>
                      <p className="font-medium text-sm text-gray-900">{item.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Category: {item.category?.name || "General"} • Location: {item.currentLocation?.name || "Main Store"}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                        {item.quantityOnHand ?? 0} {item.unit} left
                      </span>
                      <p className="text-[11px] text-gray-400 mt-0.5">Reorder at: {item.reorderPoint} {item.unit}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-sm text-gray-500">
                  All consumable items are currently stocked above their reorder thresholds.
                </div>
              )}
            </div>
          </div>

          {/* Category Valuation Breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary-500" />
              Inventory Valuation by Category
            </h2>
            <div className="space-y-3">
              {categoryValuation && categoryValuation.length > 0 ? (
                categoryValuation.map((cat) => {
                  const maxVal = Math.max(...categoryValuation.map((c) => c.totalValuation || 1));
                  const pct = Math.min(100, Math.round(((cat.totalValuation || 0) / maxVal) * 100));
                  return (
                    <div key={cat.categoryId} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-gray-700">{cat.categoryName} ({cat.itemCount} items)</span>
                        <span className="font-semibold text-gray-900">{(cat.totalValuation || 0).toLocaleString()} ETB</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-primary-600 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(5, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-gray-500">No categories created yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Recent Movement Ledger */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-indigo-500" />
                Recent Ledger Movements
              </h2>
            </div>
            <div className="divide-y divide-gray-100 max-h-[480px] overflow-y-auto">
              {recentMovements && recentMovements.length > 0 ? (
                recentMovements.map((mov) => (
                  <div key={mov.id} className="p-4 hover:bg-gray-50/60 transition-colors text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-900">{mov.item?.name}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700">
                        {mov.type}
                      </span>
                    </div>
                    <p className="text-gray-500">
                      Qty: <span className="font-medium text-gray-800">{mov.quantity}</span> • {mov.note || "Movement recorded"}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      By {mov.performedBy?.firstName} {mov.performedBy?.lastName} • {new Date(mov.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-xs text-gray-400">
                  No stock movements recorded yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import api from "../../lib/api";
import PageLoader from "../../components/ui/PageLoader";
import { Package, Calendar, Clock, AlertCircle } from "lucide-react";

export default function MyAssetsPage() {
  const { data: myAllocations, isLoading } = useQuery({
    queryKey: ["inventory-my-allocations"],
    queryFn: async () => {
      const res = await api.get("/inventory/allocations/mine");
      return res.data.data;
    },
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Assigned Assets & Equipment</h1>
        <p className="text-sm text-gray-500 mt-1">
          Review all school laptops, lab apparatus, and teaching equipment currently checked out to you
        </p>
      </div>

      {!myAllocations || myAllocations.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm">
          <Package className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-base font-semibold text-gray-900">No assets currently assigned</p>
          <p className="text-sm text-gray-500 mt-1">
            You do not have any active school assets or equipment checked out in your custody.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {myAllocations.map((alloc) => {
            const isOverdue =
              alloc.dueBackAt && new Date(alloc.dueBackAt) < new Date();
            return (
              <div
                key={alloc.id}
                className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4 hover:border-primary-300 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="p-3 bg-primary-50 text-primary-600 rounded-xl">
                    <Package className="w-6 h-6" />
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      isOverdue
                        ? "bg-red-100 text-red-800"
                        : "bg-green-100 text-green-800"
                    }`}
                  >
                    {isOverdue ? "OVERDUE" : "ACTIVE"}
                  </span>
                </div>

                <div>
                  <h3 className="font-bold text-gray-900 text-base">{alloc.item?.name}</h3>
                  <p className="font-mono text-xs text-primary-600 mt-0.5 font-semibold">
                    {alloc.item?.assetTagNumber || "Consumable"}
                  </p>
                  {alloc.item?.serialNumber && (
                    <p className="text-xs text-gray-400 mt-0.5">SN: {alloc.item.serialNumber}</p>
                  )}
                </div>

                <div className="p-3 bg-gray-50 rounded-xl space-y-1.5 text-xs text-gray-600">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-gray-500">
                      <Calendar className="w-3.5 h-3.5" /> Issued on
                    </span>
                    <span className="font-medium text-gray-800">
                      {new Date(alloc.issuedAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-gray-500">
                      <Clock className="w-3.5 h-3.5" /> Return due
                    </span>
                    <span
                      className={`font-medium ${
                        isOverdue ? "text-red-600 font-bold" : "text-gray-800"
                      }`}
                    >
                      {alloc.dueBackAt
                        ? new Date(alloc.dueBackAt).toLocaleDateString()
                        : "Permanent / Indefinite"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Issued condition</span>
                    <span className="font-medium text-gray-800">{alloc.conditionAtIssue}</span>
                  </div>
                </div>

                {alloc.notes && (
                  <p className="text-xs text-gray-500 italic">"{alloc.notes}"</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

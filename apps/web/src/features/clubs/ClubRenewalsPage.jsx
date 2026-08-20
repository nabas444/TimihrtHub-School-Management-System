import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import api from "../../lib/api";
import PageLoader from "../../components/ui/PageLoader";
import { Badge } from "../../components/ui/index";
import RenewClubModal from "./components/RenewClubModal";

export default function ClubRenewalsPage() {
  const [renewModalOpen, setRenewModalOpen] = useState(false);
  const [selectedClubForRenew, setSelectedClubForRenew] = useState(null);

  const { data: renewalClubsData, isLoading: renewalLoading } = useQuery({
    queryKey: ["renewal-clubs"],
    queryFn: () => api.get("/clubs").then((r) => r.data.data),
  });

  const renewalClubs = renewalClubsData ?? [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header flex-wrap gap-3">
        <div>
          <h1 className="page-title">Annual Club Renewals & Academic Rollover</h1>
          <p className="page-subtitle">
            Manage academic year rollovers, update leadership charters, and renew faculty advisors.
          </p>
        </div>
      </div>

      <div className="card bg-white border border-gray-200 overflow-hidden">
        <div className="p-4 bg-gray-50/80 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-primary-600" />
            Club Academic Year Standing & Renewal Management
          </h3>
        </div>

        {renewalLoading ? (
          <PageLoader />
        ) : (
          <div className="overflow-x-auto">
            <table className="table w-full text-left text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-600 uppercase font-bold text-[10px]">
                  <th className="py-2.5 px-3">Club Name</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Current Year</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Faculty Advisor</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {renewalClubs.map((club) => (
                  <tr key={club.id} className="hover:bg-gray-50">
                    <td className="py-3 px-3 font-bold text-gray-900">
                      {club.name}
                    </td>
                    <td className="py-3 px-3">
                      <Badge variant="indigo">{club.category}</Badge>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold">
                      {club.academicYear}
                    </td>
                    <td className="py-3 px-3">
                      <Badge variant={club.status === "ACTIVE" ? "green" : "blue"}>
                        {club.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 text-gray-700">
                      {club.advisor
                        ? `${club.advisor.firstName} ${club.advisor.lastName}`
                        : "Unassigned"}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          className="btn-secondary btn-sm text-[10px] py-1 px-2.5"
                          onClick={() => {
                            setSelectedClubForRenew(club);
                            setRenewModalOpen(true);
                          }}
                        >
                          <RotateCcw className="w-3 h-3" /> Renew for New Year
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Renew Club Modal */}
      <RenewClubModal
        open={renewModalOpen}
        onClose={() => {
          setRenewModalOpen(false);
          setSelectedClubForRenew(null);
        }}
        club={selectedClubForRenew}
      />
    </div>
  );
}

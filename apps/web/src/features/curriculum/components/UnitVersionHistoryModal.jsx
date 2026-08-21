import { useQuery } from "@tanstack/react-query";
import { History, Calendar, User, FileText, CheckCircle2, ChevronRight } from "lucide-react";
import api from "../../../lib/api";
import Modal from "../../../components/ui/Modal";
import PageLoader from "../../../components/ui/PageLoader";
import { Badge, EmptyState } from "../../../components/ui/index";

export default function UnitVersionHistoryModal({ open, onClose, unit }) {
  const { data: versions = [], isLoading } = useQuery({
    queryKey: ["curriculum-unit-versions", unit?.id],
    queryFn: () => api.get(`/curriculum/units/${unit.id}/versions`).then((r) => r.data.data || []),
    enabled: open && !!unit?.id,
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Version History — ${unit?.title}`}
      size="lg"
      footer={
        <button type="button" className="btn-secondary" onClick={onClose}>
          Close
        </button>
      }
    >
      <div className="space-y-4 text-xs">
        <p className="text-gray-600">
          Chronological record of approved versions and revisions for this curriculum unit.
        </p>

        {isLoading ? (
          <PageLoader />
        ) : versions.length === 0 ? (
          <EmptyState
            icon={History}
            title="No prior versions recorded"
            description="When an approved curriculum unit is updated, previous approved snapshots are preserved here."
          />
        ) : (
          <div className="space-y-3">
            {versions.map((ver) => {
              const snap = ver.snapshot || {};
              return (
                <div
                  key={ver.id}
                  className="card p-4 bg-white border border-gray-200 rounded-xl space-y-2 hover:border-primary-300 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="indigo">Version {ver.versionNumber}</Badge>
                      <span className="font-bold text-gray-900 text-sm">{snap.title || unit.title}</span>
                    </div>
                    <span className="text-gray-400 text-[11px] flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(ver.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {ver.changeSummary && (
                    <p className="text-gray-700 bg-gray-50 p-2 rounded-lg border border-gray-100 font-medium">
                      📝 {ver.changeSummary}
                    </p>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 text-[11px] text-gray-500 border-t border-gray-100">
                    <div>
                      Author: <strong>{ver.createdBy?.firstName} {ver.createdBy?.lastName}</strong>
                    </div>
                    <div>
                      Duration: <strong>{snap.durationWeeks ? `${snap.durationWeeks} weeks` : "—"}</strong>
                    </div>
                    <div>
                      Standards: <strong>{Array.isArray(snap.standards) ? snap.standards.length : 0} outcomes</strong>
                    </div>
                  </div>

                  {Array.isArray(snap.learningObjectives) && snap.learningObjectives.length > 0 && (
                    <div className="pt-2">
                      <span className="font-bold text-gray-700 block mb-1">Objectives in this version:</span>
                      <ul className="list-disc list-inside space-y-0.5 text-gray-600 pl-1">
                        {snap.learningObjectives.map((obj, i) => (
                          <li key={i}>{obj}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}

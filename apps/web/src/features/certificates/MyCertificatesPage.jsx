import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Award, Download, FileText, Sparkles, GraduationCap, Calendar, UserCheck, Eye, Printer } from "lucide-react";
import api from "../../lib/api";
import { downloadFile } from "../../lib/downloadFile";
import { Badge, EmptyState } from "../../components/ui/index";
import PageLoader from "../../components/ui/PageLoader";
import Modal from "../../components/ui/Modal";
import CertificateRecognitionTemplate from "./components/CertificateRecognitionTemplate";
import toast from "react-hot-toast";
import clsx from "clsx";

export default function MyCertificatesPage() {
  const [selectedCert, setSelectedCert] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["my-certificates"],
    queryFn: () => api.get("/certificates/mine").then((r) => r.data.data),
  });

  const certificates = data?.certificates ?? [];

  const handleDownload = async (cert) => {
    try {
      const safeTitle = cert.title.toLowerCase().replace(/[^a-z0-9]/g, "-");
      const filename = `certificate-${safeTitle}.pdf`;
      await downloadFile(`/certificates/${cert.id}/pdf`, filename);
      toast.success("Certificate PDF downloaded");
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to download certificate PDF",
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="page-header flex-wrap gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Award className="w-6 h-6 text-amber-500" />
            My Certificates & Awards
          </h1>
          <p className="page-subtitle">
            View and download your official certificates, academic awards, and graduation documents.
          </p>
        </div>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : certificates.length === 0 ? (
        <div className="card p-12 text-center">
          <EmptyState
            icon={Award}
            title="No certificates awarded yet"
            description="Certificates awarded for academic excellence, graduation, or noteworthy achievements will appear here."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {certificates.map((cert) => {
            const isGraduation = cert.type === "GRADUATION";

            return (
              <div
                key={cert.id}
                className="card p-5 flex flex-col justify-between hover:shadow-md transition-shadow border-t-4 border-t-amber-500 dark:border-t-amber-400 relative overflow-hidden"
              >
                {/* Background decorative watermark */}
                <Award className="w-32 h-32 text-amber-500/5 absolute -right-6 -bottom-6 pointer-events-none" />

                <div className="space-y-3">
                  {/* Top Badge & Date */}
                  <div className="flex items-center justify-between">
                    <Badge
                      variant={isGraduation ? "primary" : "warning"}
                      size="sm"
                    >
                      {isGraduation ? "GRADUATION" : "RECOGNITION"}
                    </Badge>
                    <span className="text-xs text-gray-400 font-medium flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(cert.issueDate).toLocaleDateString("en-GB")}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-base font-extrabold text-gray-900 dark:text-white leading-snug">
                    {cert.title}
                  </h3>

                  {/* Reason / Citation */}
                  {cert.reason && (
                    <p className="text-xs text-gray-600 dark:text-gray-300 italic line-clamp-3 bg-gray-50 dark:bg-gray-800/50 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800">
                      "{cert.reason}"
                    </p>
                  )}

                  {/* Signer */}
                  {cert.signedBy && (
                    <p className="text-xs text-gray-400">
                      Authorized by:{" "}
                      <strong className="text-gray-700 dark:text-gray-300">
                        {[
                          cert.signedBy.firstName,
                          cert.signedBy.middleName,
                          cert.signedBy.lastName,
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      </strong>
                    </p>
                  )}
                </div>

                {/* Bottom Actions */}
                <div className="pt-4 mt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-mono text-gray-400">
                    ID: {cert.id.slice(0, 8).toUpperCase()}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedCert(cert)}
                      className="btn-secondary py-1.5 px-3 text-xs inline-flex items-center gap-1.5 shadow-xs"
                      title="View Official Certificate Template"
                    >
                      <Eye className="w-3.5 h-3.5 text-amber-500" />
                      View
                    </button>
                    <button
                      onClick={() => handleDownload(cert)}
                      className="btn-primary py-1.5 px-3 text-xs inline-flex items-center gap-1.5 shadow-xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      PDF
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── VIEW OFFICIAL CERTIFICATE MODAL ── */}
      {selectedCert && (
        <Modal
          isOpen={!!selectedCert}
          onClose={() => setSelectedCert(null)}
          title={`Official Certificate — ${selectedCert.title}`}
          size="xl"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-800">
              <span className="text-xs font-bold text-gray-500">
                Official Authenticated Document
              </span>
              <button
                type="button"
                onClick={() => window.print()}
                className="btn-primary text-xs inline-flex items-center gap-1.5 py-1 px-3 shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" /> Print Certificate
              </button>
            </div>

            <div className="overflow-x-auto p-3 bg-gray-100/70 dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800">
              <CertificateRecognitionTemplate
                schoolName="DEMO INTERNATIONAL ACADEMY"
                certificateTitle={selectedCert.title || "CERTIFICATE OF RECOGNITION"}
                recipientName={
                  selectedCert.studentProfile?.user
                    ? [
                        selectedCert.studentProfile.user.firstName,
                        selectedCert.studentProfile.user.middleName,
                        selectedCert.studentProfile.user.lastName,
                      ]
                        .filter(Boolean)
                        .join(" ")
                    : "Abebe Kebede Girma"
                }
                section={selectedCert.studentProfile?.class?.name || "Section 10A"}
                yearLevel="Grade 10"
                batch={selectedCert.academicYear || "2024/2025"}
                achievement={selectedCert.title || "Academic Excellence Award"}
                issueDay={new Date(selectedCert.issueDate).getDate().toString()}
                issueMonth={new Date(selectedCert.issueDate).toLocaleString("default", {
                  month: "long",
                })}
                issueYear={new Date(selectedCert.issueDate).getFullYear().toString()}
                location="Addis Ababa, Ethiopia"
                citationParagraph1={
                  selectedCert.reason ||
                  "Thank you for demonstrating the type of character and integrity that inspire others."
                }
                citationParagraph2="Your selfless efforts are appreciated and haven't gone unnoticed."
                signatoryLeft={{
                  title: "Homeroom Teacher",
                  name: "Mr. Daniel Tesfaye",
                }}
                signatoryRight={{
                  title: "School Principal / Director",
                  name: selectedCert.signedBy
                    ? [
                        selectedCert.signedBy.firstName,
                        selectedCert.signedBy.middleName,
                        selectedCert.signedBy.lastName,
                      ]
                        .filter(Boolean)
                        .join(" ")
                    : "Dr. Almaz Bekele",
                }}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setSelectedCert(null)}
                className="btn-secondary"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => handleDownload(selectedCert)}
                className="btn-primary inline-flex items-center gap-2"
              >
                <Download className="w-4 h-4" /> Download PDF
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

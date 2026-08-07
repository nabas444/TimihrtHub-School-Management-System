import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Download,
} from "lucide-react";
import api from "../../lib/api";
import { downloadFile } from "../../lib/downloadFile";
import StatCard from "../../components/shared/StatCard";
import { Badge, EmptyState, Pagination } from "../../components/ui/index";
import Modal from "../../components/ui/Modal";
import PageLoader from "../../components/ui/PageLoader";
import { useTranslation } from "../../lib/i18n/I18nProvider";
import { useAuthStore } from "../../store/authStore";
import { format } from "date-fns";
import toast from "react-hot-toast";

const STATUS_BADGE = {
  PENDING: "yellow",
  PARTIAL: "blue",
  PAID: "green",
  OVERDUE: "red",
  WAIVED: "gray",
};

export default function FeesPage() {
  const { t } = useTranslation();
  const { isAdmin, isFinance } = useAuthStore();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [payOpen, setPayOpen] = useState(null);
  const [payForm, setPayForm] = useState({
    amount: "",
    method: "CASH",
    reference: "",
  });

  const isFinanceUser = isFinance();
  const canViewAllFees = isAdmin() || isFinanceUser;
  const { data, isLoading } = useQuery({
    queryKey: ["fees", page, canViewAllFees],
    queryFn: () =>
      api
        .get(`${canViewAllFees ? "/fees" : "/fees/my"}?page=${page}&limit=15`)
        .then((r) => r.data),
    keepPreviousData: true,
  });

  const { data: overview } = useQuery({
    queryKey: ["fees-overview"],
    queryFn: () => api.get("/fees/overview").then((r) => r.data.data),
    enabled: canViewAllFees,
  });

  const payMutation = useMutation({
    mutationFn: ({ id, ...d }) => api.post(`/fees/${id}/pay`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fees"] });
      toast.success(t("fees.payment_recorded"));
      setPayOpen(null);
    },
  });

  const invoices = data?.data ?? [];
  const meta = data?.meta ?? {};

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("fees.page_title")}</h1>
          <p className="page-subtitle">{t("fees.page_subtitle")}</p>
        </div>
      </div>

      {canViewAllFees && overview && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={DollarSign}
            label={t("fees.total_invoiced")}
            value={`ETB ${overview.totalInvoiced.toLocaleString()}`}
            color="blue"
          />
          <StatCard
            icon={TrendingUp}
            label={t("fees.collected")}
            value={`ETB ${overview.totalCollected.toLocaleString()}`}
            color="green"
            delta={`${overview.collectionRate}% ${t("dashboard.rate_suffix")}`}
          />
          <StatCard
            icon={DollarSign}
            label={t("fees.outstanding")}
            value={`ETB ${overview.outstanding.toLocaleString()}`}
            color="amber"
          />
          <StatCard
            icon={AlertTriangle}
            label={t("fees.overdue_invoices")}
            value={overview.overdueCount}
            color="red"
          />
        </div>
      )}

      {isLoading ? (
        <PageLoader />
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                {isAdmin() && <th>{t("fees.student_col")}</th>}
                <th>{t("fees.invoice_col")}</th>
                <th>{t("fees.type_col")}</th>
                <th>{t("fees.amount_col")}</th>
                <th>{t("fees.paid_col")}</th>
                <th>{t("fees.due_date_col")}</th>
                <th>{t("fees.status_col")}</th>
                <th>{t("fees.receipt_col")}</th>
                {isAdmin() && <th>{t("fees.action_col")}</th>}
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <EmptyState
                      icon={DollarSign}
                      title={t("fees.no_records")}
                    />
                  </td>
                </tr>
              )}
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  {canViewAllFees && (
                    <td className="font-medium text-sm">
                      {inv.studentProfile?.user?.firstName}{" "}
                      {inv.studentProfile?.user?.lastName}
                    </td>
                  )}
                  <td className="font-medium text-gray-900">{inv.title}</td>
                  <td>
                    <Badge variant="gray">{inv.type}</Badge>
                  </td>
                  <td className="font-mono text-sm">
                    ETB {inv.amount.toLocaleString()}
                  </td>
                  <td className="font-mono text-sm text-green-600">
                    ETB {inv.paidAmount.toLocaleString()}
                  </td>
                  <td className="text-sm text-gray-500">
                    {format(new Date(inv.dueDate), "dd MMM yyyy")}
                  </td>
                  <td>
                    <Badge variant={STATUS_BADGE[inv.status] ?? "gray"}>
                      {inv.status}
                    </Badge>
                  </td>
                  <td>
                    {inv.feePayments?.[0] ? (
                      <button
                        className="btn-secondary btn-sm inline-flex items-center gap-1"
                        onClick={() =>
                          downloadFile(
                            `/fees/payments/${inv.feePayments[0].id}/receipt`,
                            `receipt-${inv.id}.pdf`,
                          ).catch(() =>
                            toast.error(t("fees.could_not_download_receipt")),
                          )
                        }
                      >
                        <Download size={14} /> {t("fees.receipt_button")}
                      </button>
                    ) : (
                      <span className="text-gray-300 text-sm">—</span>
                    )}
                  </td>
                  {canViewAllFees &&
                    inv.status !== "PAID" &&
                    inv.status !== "WAIVED" && (
                      <td>
                        <button
                          className="btn-primary btn-sm"
                          onClick={() => {
                            setPayOpen(inv);
                            setPayForm({
                              amount: String(inv.amount - inv.paidAmount),
                              method: "CASH",
                              reference: "",
                            });
                          }}
                        >
                          {t("fees.record_payment")}
                        </button>
                      </td>
                    )}
                  {isAdmin() &&
                    (inv.status === "PAID" || inv.status === "WAIVED") && (
                      <td />
                    )}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-6 pb-4">
            <Pagination
              page={page}
              totalPages={meta.totalPages ?? 1}
              onChange={setPage}
            />
          </div>
        </div>
      )}

      <Modal
        open={!!payOpen}
        onClose={() => setPayOpen(null)}
        title={t("fees.record_payment")}
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setPayOpen(null)}>
              {t("common.cancel")}
            </button>
            <button
              className="btn-primary"
              onClick={() =>
                payMutation.mutate({
                  id: payOpen?.id,
                  amount: parseFloat(payForm.amount),
                  method: payForm.method,
                  reference: payForm.reference,
                })
              }
              disabled={payMutation.isPending}
            >
              {payMutation.isPending
                ? t("fees.saving")
                : t("fees.save_payment")}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {t("fees.invoice_label")} <strong>{payOpen?.title}</strong> —{" "}
            {t("fees.balance_label")}{" "}
            <strong>
              ETB{" "}
              {(
                (payOpen?.amount ?? 0) - (payOpen?.paidAmount ?? 0)
              ).toLocaleString()}
            </strong>
          </p>
          <div>
            <label className="label">{t("fees.amount_label")}</label>
            <input
              className="input"
              type="number"
              value={payForm.amount}
              onChange={(e) =>
                setPayForm((f) => ({ ...f, amount: e.target.value }))
              }
              required
            />
          </div>
          <div>
            <label className="label">{t("fees.method_label")}</label>
            <select
              className="input"
              value={payForm.method}
              onChange={(e) =>
                setPayForm((f) => ({ ...f, method: e.target.value }))
              }
            >
              {["CASH", "BANK_TRANSFER", "STRIPE", "MPESA"].map((m) => (
                <option key={m} value={m}>
                  {m.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{t("fees.reference_label")}</label>
            <input
              className="input"
              value={payForm.reference}
              onChange={(e) =>
                setPayForm((f) => ({ ...f, reference: e.target.value }))
              }
              placeholder={t("fees.reference_placeholder")}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

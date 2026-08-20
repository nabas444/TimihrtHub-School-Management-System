import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Download,
  Calendar,
  Layers,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Clock,
  Printer,
  Sparkles,
  Percent,
  FileText,
  User,
  Search,
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
import clsx from "clsx";
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

  // Active top-level subtab
  const [activeTab, setActiveTab] = useState("invoices"); // "invoices" | "installments"

  // Invoices tab state
  const [page, setPage] = useState(1);
  const [createInvoiceOpen, setCreateInvoiceOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(null);
  const [receiptCopies, setReceiptCopies] = useState(1);

  // New Invoice Form
  const [invoiceForm, setInvoiceForm] = useState({
    studentProfileId: "",
    title: "Term 1 Tuition Fee",
    type: "TUITION",
    amount: "",
    discount: "0",
    discountType: "AMOUNT",
    taxRate: "0",
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    notes: "",
  });

  // Pay Invoice Form
  const [payForm, setPayForm] = useState({
    amount: "",
    method: "CASH",
    reference: "",
    provisionalReceipt: "",
    receiptCopies: 1,
  });

  // Installment Plans state
  const [instPage, setInstPage] = useState(1);
  const [createPlanOpen, setCreatePlanOpen] = useState(false);
  const [payInstallmentOpen, setPayInstallmentOpen] = useState(null);
  const [payInstForm, setPayInstForm] = useState({
    amount: "",
    method: "CASH",
    reference: "",
    provisionalReceipt: "",
    receiptCopies: 1,
  });

  const [planForm, setPlanForm] = useState({
    studentProfileId: "",
    totalAmount: "",
    numInstallments: "4",
    taxRate: "0",
    discount: "0",
  });

  const isFinanceUser = isFinance();
  const canViewAllFees = isAdmin() || isFinanceUser;

  // ── Queries ──────────────────────────────────────────────────────
  const { data: studentsData } = useQuery({
    queryKey: ["students-fee-select"],
    queryFn: () =>
      api.get("/users?role=STUDENT&page=1&limit=300").then((r) => r.data.data ?? []),
    enabled: canViewAllFees,
    staleTime: 5 * 60 * 1000,
  });

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

  const { data: installmentPlansData, isLoading: instPlansLoading } = useQuery({
    queryKey: ["installment-plans", instPage],
    queryFn: () =>
      api
        .get(`/fees/installment-plans?page=${instPage}&limit=10`)
        .then((r) => r.data),
    enabled: activeTab === "installments",
  });

  // ── Mutations ────────────────────────────────────────────────────
  const createInvoiceMutation = useMutation({
    mutationFn: (d) =>
      api.post("/fees", {
        ...d,
        amount: parseFloat(d.amount),
        discount: parseFloat(d.discount || "0"),
        taxRate: parseFloat(d.taxRate || "0"),
        dueDate: new Date(d.dueDate).toISOString(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fees"] });
      qc.invalidateQueries({ queryKey: ["fees-overview"] });
      toast.success("Invoice created successfully");
      setCreateInvoiceOpen(false);
      setInvoiceForm({
        studentProfileId: "",
        title: "Term 1 Tuition Fee",
        type: "TUITION",
        amount: "",
        discount: "0",
        discountType: "AMOUNT",
        taxRate: "0",
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        notes: "",
      });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to create invoice");
    },
  });

  const payMutation = useMutation({
    mutationFn: ({ id, ...d }) => api.post(`/fees/${id}/pay`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fees"] });
      qc.invalidateQueries({ queryKey: ["fees-overview"] });
      toast.success(t("fees.payment_recorded") || "Payment recorded");
      setPayOpen(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to record payment");
    },
  });

  const createPlanMutation = useMutation({
    mutationFn: (d) =>
      api.post("/fees/installment-plans", {
        studentProfileId: d.studentProfileId,
        totalAmount: parseFloat(d.totalAmount),
        numInstallments: parseInt(d.numInstallments),
        taxRate: parseFloat(d.taxRate || "0"),
        discount: parseFloat(d.discount || "0"),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["installment-plans"] });
      toast.success("Installment plan created successfully");
      setCreatePlanOpen(false);
      setPlanForm({
        studentProfileId: "",
        totalAmount: "",
        numInstallments: "4",
        taxRate: "0",
        discount: "0",
      });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to create installment plan");
    },
  });

  const payInstallmentMutation = useMutation({
    mutationFn: ({ id, ...d }) => api.post(`/fees/installments/${id}/pay`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["installment-plans"] });
      toast.success("Installment payment recorded");
      setPayInstallmentOpen(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to pay installment");
    },
  });

  const toggleNoCarryMutation = useMutation({
    mutationFn: ({ id, noCarryForward }) =>
      api.patch(`/fees/installments/${id}`, { noCarryForward }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["installment-plans"] });
      toast.success("Installment carry-forward rule updated");
    },
    onError: (err) => {
      toast.error("Failed to update installment rule");
    },
  });

  // Calculations for Create Invoice modal
  const invBase = parseFloat(invoiceForm.amount) || 0;
  const invDiscVal =
    invoiceForm.discountType === "PERCENT"
      ? (invBase * (parseFloat(invoiceForm.discount) || 0)) / 100
      : parseFloat(invoiceForm.discount) || 0;
  const invTaxable = Math.max(0, invBase - invDiscVal);
  const invTaxAmt = Math.round(((invTaxable * (parseFloat(invoiceForm.taxRate) || 0)) / 100) * 100) / 100;
  const invGrandTotal = Math.round((invTaxable + invTaxAmt) * 100) / 100;

  // Calculations for Installment Plan modal preview
  const planTotal = parseFloat(planForm.totalAmount) || 0;
  const planDisc = parseFloat(planForm.discount) || 0;
  const planTaxRate = parseFloat(planForm.taxRate) || 0;
  const planNum = parseInt(planForm.numInstallments) || 4;
  const planNetBase = Math.max(0, planTotal - planDisc);
  const planBasePer = Math.floor((planNetBase / planNum) * 100) / 100;
  const planTaxPer = Math.round(((planBasePer * planTaxRate) / 100) * 100) / 100;
  const planTotalPer = Math.round((planBasePer + planTaxPer) * 100) / 100;

  const invoices = data?.data ?? [];
  const meta = data?.meta ?? {};
  const installmentPlans = installmentPlansData?.data ?? [];
  const instMeta = installmentPlansData?.meta ?? {};

  return (
    <div className="space-y-6">
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <DollarSign className="w-7 h-7 text-primary-600" /> Fees & Tuition Management
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Track student fees, invoice collection, tax rates, multi-month installment plans & official receipts.
          </p>
        </div>

        {canViewAllFees && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              className="btn-secondary text-xs inline-flex items-center gap-1.5 shadow-xs"
              onClick={() => setCreatePlanOpen(true)}
            >
              <Layers className="w-4 h-4 text-purple-600" /> New Installment Plan
            </button>

            <button
              className="btn-primary text-xs inline-flex items-center gap-1.5 shadow-sm"
              onClick={() => setCreateInvoiceOpen(true)}
            >
              <Plus className="w-4 h-4" /> Issue Single Invoice
            </button>
          </div>
        )}
      </div>

      {/* ── Subtabs Header ───────────────────────────────────────────────── */}
      <div className="flex border-b border-gray-200 gap-2">
        <button
          onClick={() => setActiveTab("invoices")}
          className={clsx(
            "pb-3 px-4 text-xs font-extrabold flex items-center gap-2 transition-colors border-b-2",
            activeTab === "invoices"
              ? "border-primary-600 text-primary-700"
              : "border-transparent text-gray-500 hover:text-gray-900"
          )}
        >
          <FileText className="w-4 h-4" /> Invoices & Receipts
        </button>

        <button
          onClick={() => setActiveTab("installments")}
          className={clsx(
            "pb-3 px-4 text-xs font-extrabold flex items-center gap-2 transition-colors border-b-2",
            activeTab === "installments"
              ? "border-primary-600 text-primary-700"
              : "border-transparent text-gray-500 hover:text-gray-900"
          )}
        >
          <Layers className="w-4 h-4" /> Installment Plans Schedule
        </button>
      </div>

      {/* ── Overview KPI Cards ───────────────────────────────────────────── */}
      {canViewAllFees && overview && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={DollarSign}
            label={t("fees.total_invoiced") || "Total Invoiced"}
            value={`ETB ${overview.totalInvoiced.toLocaleString()}`}
            color="blue"
          />
          <StatCard
            icon={TrendingUp}
            label={t("fees.collected") || "Total Collected"}
            value={`ETB ${overview.totalCollected.toLocaleString()}`}
            color="green"
            delta={`${overview.collectionRate}% Collection Rate`}
          />
          <StatCard
            icon={DollarSign}
            label={t("fees.outstanding") || "Total Outstanding"}
            value={`ETB ${overview.outstanding.toLocaleString()}`}
            color="amber"
          />
          <StatCard
            icon={AlertTriangle}
            label={t("fees.overdue_invoices") || "Overdue Invoices"}
            value={overview.overdueCount}
            color="red"
          />
        </div>
      )}

      {/* ── TAB 1: INVOICES & PAYMENTS ────────────────────────────────────── */}
      {activeTab === "invoices" && (
        <>
          {isLoading ? (
            <PageLoader />
          ) : (
            <div className="card bg-white border border-gray-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50/75 text-gray-600 font-bold uppercase tracking-wider text-[10px]">
                      {canViewAllFees && <th className="py-3 px-4">Student</th>}
                      <th className="py-3 px-4">Invoice Title</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Base Amount</th>
                      <th className="py-3 px-4">Tax / Disc.</th>
                      <th className="py-3 px-4">Paid Amount</th>
                      <th className="py-3 px-4">Due Date</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Receipt</th>
                      {canViewAllFees && <th className="py-3 px-4 text-right">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {invoices.length === 0 && (
                      <tr>
                        <td colSpan={10} className="py-8">
                          <EmptyState icon={DollarSign} title="No invoices recorded" />
                        </td>
                      </tr>
                    )}
                    {invoices.map((inv) => {
                      const spUser = inv.studentProfile?.user;
                      const hasTaxOrDisc = (inv.taxRate && inv.taxRate > 0) || (inv.discount && inv.discount > 0);

                      return (
                        <tr key={inv.id} className="hover:bg-gray-50/70 transition-colors">
                          {canViewAllFees && (
                            <td className="py-3.5 px-4">
                              <span className="font-extrabold text-gray-900 block">
                                {spUser?.firstName} {spUser?.lastName}
                              </span>
                              <span className="text-[10px] text-gray-400 font-mono">
                                {inv.studentProfile?.admissionNumber || ""}
                              </span>
                            </td>
                          )}

                          <td className="py-3.5 px-4 font-bold text-gray-900">{inv.title}</td>

                          <td className="py-3.5 px-4">
                            <Badge variant="gray">{inv.type}</Badge>
                          </td>

                          <td className="py-3.5 px-4 font-mono font-bold text-gray-800">
                            ETB {inv.amount.toLocaleString()}
                          </td>

                          <td className="py-3.5 px-4 text-[11px] text-gray-500">
                            {hasTaxOrDisc ? (
                              <div className="space-y-0.5 font-mono">
                                {inv.discount > 0 && (
                                  <span className="text-amber-600 block">
                                    -Disc: {inv.discountType === "PERCENT" ? `${inv.discount}%` : `ETB ${inv.discount}`}
                                  </span>
                                )}
                                {inv.taxRate > 0 && (
                                  <span className="text-blue-600 block">
                                    +Tax ({inv.taxRate}%): ETB {inv.taxAmount}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 font-mono font-bold text-green-600">
                            ETB {inv.paidAmount.toLocaleString()}
                          </td>

                          <td className="py-3.5 px-4 text-gray-500">
                            {format(new Date(inv.dueDate), "dd MMM yyyy")}
                          </td>

                          <td className="py-3.5 px-4">
                            <Badge variant={STATUS_BADGE[inv.status] ?? "gray"}>
                              {inv.status}
                            </Badge>
                          </td>

                          <td className="py-3.5 px-4">
                            {inv.feePayments?.[0] ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  className="btn-secondary btn-sm text-[11px] inline-flex items-center gap-1 py-1 px-2"
                                  onClick={() =>
                                    downloadFile(
                                      `/fees/payments/${inv.feePayments[0].id}/receipt?copies=1`,
                                      `receipt-${inv.id}.pdf`
                                    ).catch(() => toast.error("Could not download receipt"))
                                  }
                                  title="Download Single Receipt"
                                >
                                  <Download size={13} /> Receipt
                                </button>
                                <button
                                  className="btn-ghost btn-sm text-[10px] text-primary-700 py-1 px-1.5 hover:underline"
                                  onClick={() =>
                                    downloadFile(
                                      `/fees/payments/${inv.feePayments[0].id}/receipt?copies=2`,
                                      `receipt-double-${inv.id}.pdf`
                                    ).catch(() => toast.error("Could not download receipt"))
                                  }
                                  title="Print 2 Copies (School + Parent)"
                                >
                                  (2x Copies)
                                </button>
                              </div>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>

                          {canViewAllFees && (
                            <td className="py-3.5 px-4 text-right">
                              {inv.status !== "PAID" && inv.status !== "WAIVED" ? (
                                <button
                                  className="btn-primary btn-sm text-xs py-1 px-2.5"
                                  onClick={() => {
                                    const discVal = inv.discountType === "PERCENT"
                                      ? (inv.amount * (inv.discount || 0)) / 100
                                      : inv.discount || 0;
                                    const effAmt = Math.max(0, inv.amount - discVal) + (inv.taxAmount || 0);
                                    const bal = Math.max(0, effAmt - inv.paidAmount);

                                    setPayOpen(inv);
                                    setPayForm({
                                      amount: String(bal),
                                      method: "CASH",
                                      reference: "",
                                      provisionalReceipt: "",
                                      receiptCopies: 1,
                                    });
                                  }}
                                >
                                  Record Pay
                                </button>
                              ) : (
                                <span className="text-green-600 font-bold text-xs">✓ Cleared</span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="p-4 border-t border-gray-100">
                <Pagination
                  page={page}
                  totalPages={meta.totalPages ?? 1}
                  onChange={setPage}
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* ── TAB 2: INSTALLMENT PLANS ──────────────────────────────────────── */}
      {activeTab === "installments" && (
        <div className="space-y-4">
          {instPlansLoading ? (
            <PageLoader />
          ) : installmentPlans.length === 0 ? (
            <div className="card p-12 bg-white border border-gray-200 text-center">
              <EmptyState
                icon={Layers}
                title="No Installment Plans Found"
                description="Create a flexible monthly installment plan with automated shortfall carry-forward rules."
              />
            </div>
          ) : (
            <div className="space-y-4">
              {installmentPlans.map((plan) => {
                const spUser = plan.studentProfile?.user;
                const paidCount = plan.installments?.filter((i) => i.payDate && i.payAmount >= i.total).length || 0;

                return (
                  <div
                    key={plan.id}
                    className="card bg-white border border-gray-200 shadow-xs overflow-hidden p-5 space-y-4"
                  >
                    {/* Plan Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-gray-900">
                            {spUser?.firstName} {spUser?.lastName}
                          </span>
                          <Badge variant="purple">
                            {plan.numInstallments} Monthly Installments
                          </Badge>
                          {plan.taxRate > 0 && (
                            <Badge variant="blue">Tax: {plan.taxRate}%</Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Adm: {plan.studentProfile?.admissionNumber || "—"} · Class: {plan.studentProfile?.class?.name || "Unassigned"} · Created: {format(new Date(plan.createdAt), "dd MMM yyyy")}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-xs text-gray-400 block">Total Plan Value</span>
                        <span className="font-mono font-black text-base text-gray-900">
                          ETB {plan.totalAmount.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Installments Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-gray-200 bg-gray-50/50 text-gray-600 font-bold uppercase tracking-wider text-[10px]">
                            <th className="py-2 px-3">#</th>
                            <th className="py-2 px-3">Due Date</th>
                            <th className="py-2 px-3">Base Amt</th>
                            <th className="py-2 px-3">Tax</th>
                            <th className="py-2 px-3">Total Due</th>
                            <th className="py-2 px-3">Paid Amt</th>
                            <th className="py-2 px-3">Receipt</th>
                            <th className="py-2 px-3">No Carry Forward</th>
                            {canViewAllFees && <th className="py-2 px-3 text-right">Action</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {plan.installments?.map((inst) => {
                            const isPaid = inst.payDate && (inst.payAmount || 0) >= inst.total;
                            const isPartial = inst.payDate && (inst.payAmount || 0) > 0 && (inst.payAmount || 0) < inst.total;

                            return (
                              <tr key={inst.id} className="hover:bg-gray-50/50">
                                <td className="py-2.5 px-3 font-bold text-gray-700">
                                  Inst #{inst.installmentNo}
                                </td>
                                <td className="py-2.5 px-3 text-gray-600">
                                  {format(new Date(inst.dueDate), "dd MMM yyyy")}
                                </td>
                                <td className="py-2.5 px-3 font-mono">
                                  ETB {inst.amount.toLocaleString()}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-gray-500">
                                  ETB {inst.tax.toLocaleString()}
                                </td>
                                <td className="py-2.5 px-3 font-mono font-bold text-gray-900">
                                  ETB {inst.total.toLocaleString()}
                                </td>
                                <td className="py-2.5 px-3 font-mono font-bold">
                                  {inst.payAmount ? (
                                    <span className="text-green-600">ETB {inst.payAmount.toLocaleString()}</span>
                                  ) : (
                                    <span className="text-gray-300">—</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3">
                                  {inst.payDate ? (
                                    <div className="flex items-center gap-1">
                                      <button
                                        className="btn-secondary btn-sm text-[10px] py-0.5 px-1.5 inline-flex items-center gap-1"
                                        onClick={() =>
                                          downloadFile(
                                            `/fees/installments/${inst.id}/receipt?copies=1`,
                                            `installment-receipt-${inst.installmentNo}.pdf`
                                          ).catch(() => toast.error("Could not download receipt"))
                                        }
                                        title="Download Single Receipt"
                                      >
                                        <Download size={11} /> Rec
                                      </button>
                                      <button
                                        className="btn-ghost btn-sm text-[9px] text-primary-700 py-0.5 px-1 hover:underline"
                                        onClick={() =>
                                          downloadFile(
                                            `/fees/installments/${inst.id}/receipt?copies=2`,
                                            `installment-receipt-2x-${inst.installmentNo}.pdf`
                                          ).catch(() => toast.error("Could not download receipt"))
                                        }
                                        title="Print 2 Copies (School + Parent)"
                                      >
                                        (2x)
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-gray-300">—</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3">
                                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={inst.noCarryForward}
                                      disabled={!canViewAllFees || !!isPaid}
                                      onChange={(e) =>
                                        toggleNoCarryMutation.mutate({
                                          id: inst.id,
                                          noCarryForward: e.target.checked,
                                        })
                                      }
                                      className="rounded text-primary-600 focus:ring-primary-500"
                                    />
                                    <span className="text-[10px] text-gray-500">Block rollover</span>
                                  </label>
                                </td>
                                {canViewAllFees && (
                                  <td className="py-2.5 px-3 text-right">
                                    {!isPaid ? (
                                      <button
                                        className="btn-primary btn-sm text-[11px] py-1 px-2"
                                        onClick={() => {
                                          const bal = Math.max(0, inst.total - (inst.payAmount || 0));
                                          setPayInstallmentOpen({
                                            ...inst,
                                            studentName: `${spUser?.firstName} ${spUser?.lastName}`,
                                            balance: bal,
                                          });
                                          setPayInstForm({
                                            amount: String(bal),
                                            method: "CASH",
                                            reference: "",
                                            provisionalReceipt: "",
                                            receiptCopies: 1,
                                          });
                                        }}
                                      >
                                        Pay Inst
                                      </button>
                                    ) : (
                                      <span className="text-green-600 font-bold text-[11px]">✓ Paid</span>
                                    )}
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}

              <div className="p-4 bg-white rounded-xl border border-gray-200">
                <Pagination
                  page={instPage}
                  totalPages={instMeta.totalPages ?? 1}
                  onChange={setInstPage}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CREATE INVOICE MODAL ─────────────────────────────────────────── */}
      <Modal
        open={createInvoiceOpen}
        onClose={() => setCreateInvoiceOpen(false)}
        title="Issue Student Fee Invoice"
        size="md"
        footer={
          <>
            <button className="btn-secondary text-xs" onClick={() => setCreateInvoiceOpen(false)}>
              Cancel
            </button>
            <button
              className="btn-primary text-xs inline-flex items-center gap-1.5"
              onClick={() => createInvoiceMutation.mutate(invoiceForm)}
              disabled={
                createInvoiceMutation.isPending ||
                !invoiceForm.studentProfileId ||
                !invoiceForm.amount ||
                !invoiceForm.title.trim()
              }
            >
              {createInvoiceMutation.isPending ? "Issuing…" : "Issue Fee Invoice"}
            </button>
          </>
        }
      >
        <div className="space-y-3.5 text-xs">
          <div>
            <label className="label font-bold">Select Student *</label>
            <select
              className="input text-xs"
              value={invoiceForm.studentProfileId}
              onChange={(e) => setInvoiceForm((f) => ({ ...f, studentProfileId: e.target.value }))}
              required
            >
              <option value="">— Select Enrolled Student —</option>
              {(studentsData ?? []).map((s) => (
                <option key={s.studentProfile?.id || s.id} value={s.studentProfile?.id || s.id}>
                  {s.firstName} {s.lastName} ({s.studentProfile?.admissionNumber || s.email})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label font-bold">Invoice Title *</label>
              <input
                className="input text-xs"
                value={invoiceForm.title}
                onChange={(e) => setInvoiceForm((f) => ({ ...f, title: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="label font-bold">Fee Type *</label>
              <select
                className="input text-xs"
                value={invoiceForm.type}
                onChange={(e) => setInvoiceForm((f) => ({ ...f, type: e.target.value }))}
              >
                {["TUITION", "TRANSPORT", "EXAM", "ADMISSION", "OTHER"].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label font-bold">Base Fee Amount (ETB) *</label>
            <input
              type="number"
              min="1"
              step="any"
              className="input text-xs font-mono font-bold"
              value={invoiceForm.amount}
              onChange={(e) => setInvoiceForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="e.g. 5000"
              required
            />
          </div>

          {/* Discount and Tax Section */}
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
            <h4 className="font-extrabold text-gray-900 text-xs flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Discount & Tax Computations
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="label font-bold mb-0">Discount</label>
                  <div className="flex items-center gap-1 bg-white border border-gray-200 rounded p-0.5">
                    <button
                      type="button"
                      className={clsx(
                        "px-1.5 py-0.5 text-[10px] font-bold rounded",
                        invoiceForm.discountType === "AMOUNT" ? "bg-primary-600 text-white" : "text-gray-500"
                      )}
                      onClick={() => setInvoiceForm((f) => ({ ...f, discountType: "AMOUNT" }))}
                    >
                      ETB
                    </button>
                    <button
                      type="button"
                      className={clsx(
                        "px-1.5 py-0.5 text-[10px] font-bold rounded",
                        invoiceForm.discountType === "PERCENT" ? "bg-primary-600 text-white" : "text-gray-500"
                      )}
                      onClick={() => setInvoiceForm((f) => ({ ...f, discountType: "PERCENT" }))}
                    >
                      %
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  min="0"
                  className="input text-xs font-mono"
                  value={invoiceForm.discount}
                  onChange={(e) => setInvoiceForm((f) => ({ ...f, discount: e.target.value }))}
                  placeholder={invoiceForm.discountType === "PERCENT" ? "e.g. 10%" : "e.g. 500"}
                />
              </div>

              <div>
                <label className="label font-bold">Tax Rate (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="input text-xs font-mono"
                  value={invoiceForm.taxRate}
                  onChange={(e) => setInvoiceForm((f) => ({ ...f, taxRate: e.target.value }))}
                  placeholder="e.g. 15"
                />
              </div>
            </div>

            {/* Live Calculated Summary Box */}
            <div className="p-2.5 bg-white rounded-lg border border-gray-200 space-y-1 font-mono text-[11px]">
              <div className="flex justify-between text-gray-500">
                <span>Base Amount:</span>
                <span>ETB {invBase.toLocaleString()}</span>
              </div>
              {invDiscVal > 0 && (
                <div className="flex justify-between text-amber-600">
                  <span>Discount ({invoiceForm.discountType === "PERCENT" ? `${invoiceForm.discount}%` : "Flat"}):</span>
                  <span>- ETB {invDiscVal.toLocaleString()}</span>
                </div>
              )}
              {invTaxAmt > 0 && (
                <div className="flex justify-between text-blue-600">
                  <span>Tax ({invoiceForm.taxRate}%):</span>
                  <span>+ ETB {invTaxAmt.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-gray-900 border-t border-gray-100 pt-1 text-xs">
                <span>Net Payable Total:</span>
                <span className="text-primary-700">ETB {invGrandTotal.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label font-bold">Due Date *</label>
              <input
                type="date"
                className="input text-xs"
                value={invoiceForm.dueDate}
                onChange={(e) => setInvoiceForm((f) => ({ ...f, dueDate: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="label font-bold">Internal Notes</label>
              <input
                className="input text-xs"
                value={invoiceForm.notes}
                onChange={(e) => setInvoiceForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optional notes…"
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* ── CREATE INSTALLMENT PLAN MODAL ────────────────────────────────── */}
      <Modal
        open={createPlanOpen}
        onClose={() => setCreatePlanOpen(false)}
        title="Create Student Installment Plan"
        size="md"
        footer={
          <>
            <button className="btn-secondary text-xs" onClick={() => setCreatePlanOpen(false)}>
              Cancel
            </button>
            <button
              className="btn-primary text-xs inline-flex items-center gap-1.5"
              onClick={() => createPlanMutation.mutate(planForm)}
              disabled={
                createPlanMutation.isPending ||
                !planForm.studentProfileId ||
                !planForm.totalAmount
              }
            >
              {createPlanMutation.isPending ? "Generating…" : "Generate Schedule"}
            </button>
          </>
        }
      >
        <div className="space-y-3.5 text-xs">
          <div>
            <label className="label font-bold">Select Student *</label>
            <select
              className="input text-xs"
              value={planForm.studentProfileId}
              onChange={(e) => setPlanForm((f) => ({ ...f, studentProfileId: e.target.value }))}
              required
            >
              <option value="">— Select Enrolled Student —</option>
              {(studentsData ?? []).map((s) => (
                <option key={s.studentProfile?.id || s.id} value={s.studentProfile?.id || s.id}>
                  {s.firstName} {s.lastName} ({s.studentProfile?.admissionNumber || s.email})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label font-bold">Total Plan Amount (ETB) *</label>
              <input
                type="number"
                min="1"
                className="input text-xs font-mono font-bold"
                value={planForm.totalAmount}
                onChange={(e) => setPlanForm((f) => ({ ...f, totalAmount: e.target.value }))}
                placeholder="e.g. 24000"
                required
              />
            </div>
            <div>
              <label className="label font-bold">Number of Installments *</label>
              <select
                className="input text-xs"
                value={planForm.numInstallments}
                onChange={(e) => setPlanForm((f) => ({ ...f, numInstallments: e.target.value }))}
              >
                {[2, 3, 4, 6, 8, 10, 12].map((n) => (
                  <option key={n} value={n}>
                    {n} Monthly Installments
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label font-bold">Discount (ETB)</label>
              <input
                type="number"
                min="0"
                className="input text-xs font-mono"
                value={planForm.discount}
                onChange={(e) => setPlanForm((f) => ({ ...f, discount: e.target.value }))}
                placeholder="e.g. 1000"
              />
            </div>
            <div>
              <label className="label font-bold">Tax Rate (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                className="input text-xs font-mono"
                value={planForm.taxRate}
                onChange={(e) => setPlanForm((f) => ({ ...f, taxRate: e.target.value }))}
                placeholder="e.g. 0"
              />
            </div>
          </div>

          {/* Generated Schedule Preview Box */}
          {planTotal > 0 && (
            <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 space-y-2">
              <h4 className="font-extrabold text-purple-900 text-xs flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-purple-600" /> Generated Schedule Preview
              </h4>
              <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
                <div className="bg-white p-2 rounded border border-purple-100">
                  <span className="text-gray-400 block text-[10px]">Per Installment</span>
                  <strong className="text-gray-900">ETB {planTotalPer.toLocaleString()}</strong>
                </div>
                <div className="bg-white p-2 rounded border border-purple-100">
                  <span className="text-gray-400 block text-[10px]">Monthly Base</span>
                  <strong className="text-gray-700">ETB {planBasePer.toLocaleString()}</strong>
                </div>
                <div className="bg-white p-2 rounded border border-purple-100">
                  <span className="text-gray-400 block text-[10px]">Monthly Tax</span>
                  <strong className="text-blue-600">ETB {planTaxPer.toLocaleString()}</strong>
                </div>
              </div>
              <p className="text-[10px] text-purple-700">
                Installment due dates will be spaced 1 month apart consecutively starting from today.
              </p>
            </div>
          )}
        </div>
      </Modal>

      {/* ── RECORD PAYMENT MODAL (INVOICE) ────────────────────────────────── */}
      <Modal
        open={!!payOpen}
        onClose={() => setPayOpen(null)}
        title="Record Invoice Fee Payment"
        size="sm"
        footer={
          <>
            <button className="btn-secondary text-xs" onClick={() => setPayOpen(null)}>
              {t("common.cancel") || "Cancel"}
            </button>
            <button
              className="btn-primary text-xs inline-flex items-center gap-1"
              onClick={() =>
                payMutation.mutate({
                  id: payOpen?.id,
                  amount: parseFloat(payForm.amount),
                  method: payForm.method,
                  reference: payForm.reference,
                  provisionalReceipt: payForm.provisionalReceipt,
                  receiptCopies: payForm.receiptCopies,
                })
              }
              disabled={payMutation.isPending || !payForm.amount}
            >
              {payMutation.isPending ? "Saving…" : "Save Payment"}
            </button>
          </>
        }
      >
        <div className="space-y-3.5 text-xs">
          <p className="text-xs text-gray-600">
            Invoice <strong>{payOpen?.title}</strong> — Outstanding Balance:{" "}
            <strong className="text-primary-700 font-mono">
              ETB {payForm.amount}
            </strong>
          </p>

          <div>
            <label className="label font-bold">Payment Amount (ETB) *</label>
            <input
              className="input text-xs font-mono font-bold"
              type="number"
              value={payForm.amount}
              onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label font-bold">Payment Method *</label>
              <select
                className="input text-xs"
                value={payForm.method}
                onChange={(e) => setPayForm((f) => ({ ...f, method: e.target.value }))}
              >
                {["CASH", "BANK_TRANSFER", "STRIPE", "MPESA", "CHEQUE"].map((m) => (
                  <option key={m} value={m}>
                    {m.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label font-bold">Print Receipt Copies</label>
              <select
                className="input text-xs"
                value={payForm.receiptCopies}
                onChange={(e) => setPayForm((f) => ({ ...f, receiptCopies: parseInt(e.target.value) }))}
              >
                <option value={1}>1 Copy (Standard)</option>
                <option value={2}>2 Copies (School + Parent)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label font-bold">Bank Reference / Transaction ID</label>
            <input
              className="input text-xs"
              value={payForm.reference}
              onChange={(e) => setPayForm((f) => ({ ...f, reference: e.target.value }))}
              placeholder="e.g. CBE-TX-987410"
            />
          </div>

          <div>
            <label className="label font-bold">Provisional / Draft Receipt Reference</label>
            <input
              className="input text-xs"
              value={payForm.provisionalReceipt}
              onChange={(e) => setPayForm((f) => ({ ...f, provisionalReceipt: e.target.value }))}
              placeholder="Optional paper slip reference…"
            />
          </div>
        </div>
      </Modal>

      {/* ── RECORD INSTALLMENT PAYMENT MODAL ──────────────────────────────── */}
      <Modal
        open={!!payInstallmentOpen}
        onClose={() => setPayInstallmentOpen(null)}
        title={`Record Payment for Installment #${payInstallmentOpen?.installmentNo}`}
        size="sm"
        footer={
          <>
            <button className="btn-secondary text-xs" onClick={() => setPayInstallmentOpen(null)}>
              Cancel
            </button>
            <button
              className="btn-primary text-xs inline-flex items-center gap-1"
              onClick={() =>
                payInstallmentMutation.mutate({
                  id: payInstallmentOpen?.id,
                  amount: parseFloat(payInstForm.amount),
                  method: payInstForm.method,
                  reference: payInstForm.reference,
                  provisionalReceipt: payInstForm.provisionalReceipt,
                  receiptCopies: payInstForm.receiptCopies,
                })
              }
              disabled={payInstallmentMutation.isPending || !payInstForm.amount}
            >
              {payInstallmentMutation.isPending ? "Saving…" : "Save Installment Payment"}
            </button>
          </>
        }
      >
        <div className="space-y-3.5 text-xs">
          <p className="text-xs text-gray-600">
            Student: <strong>{payInstallmentOpen?.studentName}</strong> — Installment #{payInstallmentOpen?.installmentNo} Total:{" "}
            <strong className="text-primary-700 font-mono">
              ETB {payInstallmentOpen?.total?.toLocaleString()}
            </strong>
          </p>

          <div>
            <label className="label font-bold">Payment Amount (ETB) *</label>
            <input
              className="input text-xs font-mono font-bold"
              type="number"
              value={payInstForm.amount}
              onChange={(e) => setPayInstForm((f) => ({ ...f, amount: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label font-bold">Payment Method *</label>
              <select
                className="input text-xs"
                value={payInstForm.method}
                onChange={(e) => setPayInstForm((f) => ({ ...f, method: e.target.value }))}
              >
                {["CASH", "BANK_TRANSFER", "STRIPE", "MPESA", "CHEQUE"].map((m) => (
                  <option key={m} value={m}>
                    {m.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label font-bold">Print Receipt Copies</label>
              <select
                className="input text-xs"
                value={payInstForm.receiptCopies}
                onChange={(e) => setPayInstForm((f) => ({ ...f, receiptCopies: parseInt(e.target.value) }))}
              >
                <option value={1}>1 Copy (Standard)</option>
                <option value={2}>2 Copies (School + Parent)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label font-bold">Bank Reference / Transaction ID</label>
            <input
              className="input text-xs"
              value={payInstForm.reference}
              onChange={(e) => setPayInstForm((f) => ({ ...f, reference: e.target.value }))}
              placeholder="e.g. CBE-TX-987410"
            />
          </div>

          <p className="text-[10px] text-gray-500 bg-gray-50 p-2 rounded border border-gray-200">
            <strong>Note:</strong> If paying less than the installment total and carry-forward is enabled, the shortfall will automatically roll forward to the next installment.
          </p>
        </div>
      </Modal>
    </div>
  );
}

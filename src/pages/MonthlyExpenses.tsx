import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  type Timestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import {
  Plus,
  Trash2,
  X,
  Loader2,
  CalendarClock,
  CheckCircle2,
  Circle,
  Wallet,
} from "lucide-react";

const EXPENSE_CATEGORIES = [
  "Rent / Mortgage",
  "Utilities",
  "Internet",
  "Subscriptions",
  "Insurance",
  "Loan Payment",
  "Transportation",
  "Groceries",
  "Phone Bill",
  "Other",
];

const CURRENCIES = [
  { code: "PHP", symbol: "₱" },
  { code: "USD", symbol: "$" },
  { code: "EUR", symbol: "€" },
  { code: "GBP", symbol: "£" },
  { code: "JPY", symbol: "¥" },
  { code: "SGD", symbol: "S$" },
  { code: "AUD", symbol: "A$" },
  { code: "CAD", symbol: "C$" },
  { code: "HKD", symbol: "HK$" },
  { code: "KRW", symbol: "₩" },
];

interface Account {
  id: string;
  uid: string;
  name: string;
  currency: string;
}

interface MonthlyExpense {
  id: string;
  uid: string;
  name: string;
  category: string;
  amount: number;
  accountId: string;
  dueDay: number;
  note: string;
  createdAt: Timestamp | null;
}

interface MonthlyPayment {
  id: string;
  uid: string;
  monthlyExpenseId: string;
  accountId: string;
  amount: number;
  month: number; // 1-12
  year: number;
  paidAt: Timestamp | null;
}

export default function MonthlyExpensesPage() {
  const { user } = useAuth();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [monthlyExpenses, setMonthlyExpenses] = useState<MonthlyExpense[]>([]);
  const [payments, setPayments] = useState<MonthlyPayment[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingExpenses, setLoadingExpenses] = useState(true);
  const [loadingPayments, setLoadingPayments] = useState(true);

  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [dueDay, setDueDay] = useState("1");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "accounts"), where("uid", "==", user.uid));
    return onSnapshot(q, (snap) => {
      setAccounts(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Account, "id">),
        })),
      );
      setLoadingAccounts(false);
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "monthly_expenses"),
      where("uid", "==", user.uid),
    );
    return onSnapshot(q, (snap) => {
      setMonthlyExpenses(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<MonthlyExpense, "id">),
        })),
      );
      setLoadingExpenses(false);
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "monthly_payments"),
      where("uid", "==", user.uid),
      where("year", "==", currentYear),
      where("month", "==", currentMonth),
    );
    return onSnapshot(q, (snap) => {
      setPayments(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<MonthlyPayment, "id">),
        })),
      );
      setLoadingPayments(false);
    });
  }, [user, currentMonth, currentYear]);

  const loading = loadingAccounts || loadingExpenses || loadingPayments;

  function isPaid(expenseId: string) {
    return payments.some((p) => p.monthlyExpenseId === expenseId);
  }

  const totalAmount = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0);
  const paidAmount = monthlyExpenses
    .filter((e) => isPaid(e.id))
    .reduce((sum, e) => sum + e.amount, 0);
  const unpaidAmount = totalAmount - paidAmount;

  function getAccountCurrencySymbol(accId: string) {
    const acc = accounts.find((a) => a.id === accId);
    if (!acc) return "₱";
    return (
      CURRENCIES.find((c) => c.code === acc.currency)?.symbol ?? acc.currency
    );
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (!name.trim()) {
      toast.error("Name is required.");
      return;
    }
    if (!category.trim()) {
      toast.error("Category is required.");
      return;
    }
    if (isNaN(parsed) || parsed <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }
    if (!accountId) {
      toast.error("Select an account.");
      return;
    }
    const day = parseInt(dueDay);
    if (isNaN(day) || day < 1 || day > 31) {
      toast.error("Due day must be 1–31.");
      return;
    }
    setSaving(true);
    try {
      await addDoc(collection(db, "monthly_expenses"), {
        uid: user!.uid,
        name: name.trim(),
        category: category.trim(),
        amount: parsed,
        accountId,
        dueDay: day,
        note: note.trim(),
        createdAt: serverTimestamp(),
      });
      setName("");
      setCategory("");
      setAmount("");
      setAccountId("");
      setDueDay("1");
      setNote("");
      setShowAddModal(false);
      toast.success("Monthly expense added.");
    } catch {
      toast.error("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteDoc(doc(db, "monthly_expenses", id));
      // also delete any payments for this expense
      const related = payments.filter((p) => p.monthlyExpenseId === id);
      await Promise.all(
        related.map((p) => deleteDoc(doc(db, "monthly_payments", p.id))),
      );
      toast.success("Recurring expense removed.");
    } catch {
      toast.error("Failed to delete.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleTogglePaid(expense: MonthlyExpense) {
    setMarkingId(expense.id);
    try {
      const existingPayment = payments.find(
        (p) => p.monthlyExpenseId === expense.id,
      );
      if (existingPayment) {
        await deleteDoc(doc(db, "monthly_payments", existingPayment.id));
        toast.success("Marked as unpaid.");
      } else {
        await addDoc(collection(db, "monthly_payments"), {
          uid: user!.uid,
          monthlyExpenseId: expense.id,
          accountId: expense.accountId,
          amount: expense.amount,
          month: currentMonth,
          year: currentYear,
          paidAt: serverTimestamp(),
        });
        toast.success("Marked as paid.");
      }
    } catch {
      toast.error("Failed to update.");
    } finally {
      setMarkingId(null);
    }
  }

  const monthLabel = now.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Monthly Expenses</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Recurring bills &amp; subscriptions
          </p>
        </div>
        <button
          onClick={() => {
            setName("");
            setCategory("");
            setAmount("");
            setAccountId("");
            setDueDay("1");
            setNote("");
            setShowAddModal(true);
          }}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
        >
          <Plus size={16} />
          Add Recurring
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
            Total Monthly
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            ₱{totalAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {monthlyExpenses.length} recurring expense
            {monthlyExpenses.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-green-600 font-medium uppercase tracking-wide">
            Paid · {monthLabel}
          </p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            ₱{paidAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {monthlyExpenses.filter((e) => isPaid(e.id)).length} paid
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-red-500 font-medium uppercase tracking-wide">
            Unpaid · {monthLabel}
          </p>
          <p className="text-2xl font-bold text-red-500 mt-1">
            ₱
            {unpaidAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {monthlyExpenses.filter((e) => !isPaid(e.id)).length} remaining
          </p>
        </div>
      </div>

      {/* Expenses list */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Recurring Expenses</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-green-600" />
          </div>
        ) : monthlyExpenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mb-3">
              <CalendarClock size={24} className="text-green-500" />
            </div>
            <p className="font-medium text-gray-700 mb-1">
              No recurring expenses yet
            </p>
            <p className="text-sm text-gray-400">
              Click "Add Recurring" to set up your monthly bills.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {monthlyExpenses
              .slice()
              .sort((a, b) => a.dueDay - b.dueDay)
              .map((expense) => {
                const paid = isPaid(expense.id);
                const symbol = getAccountCurrencySymbol(expense.accountId);
                const account = accounts.find(
                  (a) => a.id === expense.accountId,
                );
                return (
                  <div
                    key={expense.id}
                    className={`flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group ${paid ? "opacity-60" : ""}`}
                  >
                    {/* Paid toggle */}
                    <button
                      onClick={() => handleTogglePaid(expense)}
                      disabled={markingId === expense.id}
                      className="flex-shrink-0 text-gray-300 hover:text-green-500 transition-colors"
                    >
                      {markingId === expense.id ? (
                        <Loader2
                          size={20}
                          className="animate-spin text-green-500"
                        />
                      ) : paid ? (
                        <CheckCircle2 size={20} className="text-green-500" />
                      ) : (
                        <Circle size={20} />
                      )}
                    </button>

                    {/* Icon */}
                    <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <CalendarClock size={16} className="text-orange-500" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p
                          className={`font-semibold text-sm truncate ${paid ? "line-through text-gray-400" : "text-gray-800"}`}
                        >
                          {expense.name}
                        </p>
                        <span className="flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                          {expense.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Wallet
                          size={11}
                          className="text-gray-400 flex-shrink-0"
                        />
                        <p className="text-xs text-gray-400 truncate">
                          {account?.name ?? "Unknown account"} · Due day{" "}
                          {expense.dueDay}
                        </p>
                      </div>
                      {expense.note && (
                        <p className="text-xs text-gray-400 truncate mt-0.5">
                          {expense.note}
                        </p>
                      )}
                    </div>

                    {/* Amount */}
                    <p
                      className={`font-bold text-sm flex-shrink-0 ${paid ? "text-gray-400" : "text-red-500"}`}
                    >
                      {symbol}
                      {expense.amount.toLocaleString("en-PH", {
                        minimumFractionDigits: 2,
                      })}
                    </p>

                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(expense.id)}
                      disabled={deletingId === expense.id}
                      className="ml-1 w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                    >
                      {deletingId === expense.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Add Recurring Expense Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">
                Add Recurring Expense
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              >
                <X size={16} className="text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleAdd} className="space-y-4">
              {/* Name */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Expense Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Netflix, Meralco Bill…"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                />
              </div>

              {/* Category */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Category
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                        category === cat
                          ? "bg-green-600 text-white border-green-600"
                          : "bg-white text-gray-600 border-gray-200 hover:border-green-400 hover:text-green-700"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Account */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Deduct from Account
                </label>
                {loadingAccounts ? (
                  <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                    <Loader2 size={14} className="animate-spin" /> Loading
                    accounts…
                  </div>
                ) : accounts.length === 0 ? (
                  <p className="text-xs text-red-500">
                    No accounts found. Create one in Income first.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {accounts.map((acc) => {
                      const sym =
                        CURRENCIES.find((c) => c.code === acc.currency)
                          ?.symbol ?? acc.currency;
                      return (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() => setAccountId(acc.id)}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
                            accountId === acc.id
                              ? "bg-green-50 border-green-400 text-green-800"
                              : "bg-white border-gray-200 text-gray-700 hover:border-green-300"
                          }`}
                        >
                          <Wallet
                            size={15}
                            className={
                              accountId === acc.id
                                ? "text-green-600"
                                : "text-gray-400"
                            }
                          />
                          <span className="text-sm font-medium">
                            {acc.name}
                          </span>
                          <span className="ml-auto text-xs text-gray-400">
                            {sym}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Amount + Due Day */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">
                    Amount
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">
                    Due Day
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={dueDay}
                    onChange={(e) => setDueDay(e.target.value)}
                    placeholder="1"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                  />
                </div>
              </div>

              {/* Note */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Note{" "}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Any additional details…"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-semibold transition-all active:scale-[0.98]"
                >
                  {saving ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : null}
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  type Timestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import {
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  Banknote,
  X,
  Loader2,
  ArrowLeft,
} from "lucide-react";

const SOURCE_SUGGESTIONS = [
  "Salary",
  "Freelance",
  "Business",
  "Investment",
  "Gift",
  "Bonus",
  "Rental",
  "Other",
];

const EXPENSE_CATEGORIES = [
  "Online Payment",
  "ATM Withdrawal",
  "Bank Transfer",
  "Bills",
  "Shopping",
  "Food & Dining",
  "Transport",
  "Other",
];

const CURRENCIES = [
  { code: "PHP", symbol: "₱", label: "Philippine Peso" },
  { code: "USD", symbol: "$", label: "US Dollar" },
  { code: "EUR", symbol: "€", label: "Euro" },
  { code: "GBP", symbol: "£", label: "British Pound" },
  { code: "JPY", symbol: "¥", label: "Japanese Yen" },
  { code: "SGD", symbol: "S$", label: "Singapore Dollar" },
  { code: "AUD", symbol: "A$", label: "Australian Dollar" },
  { code: "CAD", symbol: "C$", label: "Canadian Dollar" },
  { code: "HKD", symbol: "HK$", label: "Hong Kong Dollar" },
  { code: "KRW", symbol: "₩", label: "Korean Won" },
];

interface Account {
  id: string;
  uid: string;
  name: string;
  type: string;
  currency: string;
  initialBalance: number;
  createdAt: Timestamp | null;
}

interface IncomeEntry {
  id: string;
  uid: string;
  accountId: string;
  source: string;
  amount: number;
  note: string;
  createdAt: Timestamp | null;
}

interface ExpenseEntry {
  id: string;
  uid: string;
  accountId: string;
  category: string;
  amount: number;
  note: string;
  createdAt: Timestamp | null;
}

export default function AccountsPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const accountName = searchParams.get("account");

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<IncomeEntry[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(true);

  // Modal
  const [showAddIncome, setShowAddIncome] = useState(false);
  const [source, setSource] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Expenses state
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [loadingExpenses, setLoadingExpenses] = useState(true);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expCategory, setExpCategory] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expNote, setExpNote] = useState("");
  const [savingExpense, setSavingExpense] = useState(false);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState<"income" | "expenses">("income");

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
      collection(db, "income"),
      where("uid", "==", user.uid),
      orderBy("createdAt", "desc"),
    );
    return onSnapshot(q, (snap) => {
      setEntries(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<IncomeEntry, "id">),
        })),
      );
      setLoadingEntries(false);
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "expenses"),
      where("uid", "==", user.uid),
      orderBy("createdAt", "desc"),
    );
    return onSnapshot(q, (snap) => {
      setExpenses(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ExpenseEntry, "id">),
        })),
      );
      setLoadingExpenses(false);
    });
  }, [user]);

  const account = accounts.find((a) => a.name === accountName);
  const accountEntries = account
    ? entries.filter((e) => e.accountId === account.id)
    : [];
  const accountExpenses = account
    ? expenses.filter((e) => e.accountId === account.id)
    : [];

  const totalIncome = accountEntries.reduce((sum, e) => sum + e.amount, 0);
  const totalExpenses = accountExpenses.reduce((sum, e) => sum + e.amount, 0);
  const balance = (account?.initialBalance ?? 0) + totalIncome - totalExpenses;

  const currency = account?.currency ?? "PHP";
  const currencySymbol =
    CURRENCIES.find((c) => c.code === currency)?.symbol ?? currency;

  const fmt = (n: number) =>
    n.toLocaleString("en-PH", { style: "currency", currency });

  const loading = loadingAccounts || loadingEntries || loadingExpenses;

  async function handleAddIncome(e: React.FormEvent) {
    e.preventDefault();
    if (!account) return;
    const parsed = parseFloat(amount);
    if (!source.trim()) {
      toast.error("Income source is required.");
      return;
    }
    if (isNaN(parsed) || parsed <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }
    setSaving(true);
    try {
      await addDoc(collection(db, "income"), {
        uid: user!.uid,
        accountId: account.id,
        source: source.trim(),
        amount: parsed,
        note: note.trim(),
        createdAt: serverTimestamp(),
      });
      setSource("");
      setAmount("");
      setNote("");
      setShowAddIncome(false);
      toast.success("Income entry added.");
    } catch {
      toast.error("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteEntry(id: string) {
    const entry = entries.find((e) => e.id === id);
    if (!entry || !user) return;
    setDeletingId(id);
    try {
      await deleteDoc(doc(db, "income", id));
      toast.success("Entry deleted.");
    } catch {
      toast.error("Failed to delete entry.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!account) return;
    const parsed = parseFloat(expAmount);
    if (!expCategory.trim()) {
      toast.error("Expense category is required.");
      return;
    }
    if (isNaN(parsed) || parsed <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }
    setSavingExpense(true);
    try {
      await addDoc(collection(db, "expenses"), {
        uid: user!.uid,
        accountId: account.id,
        category: expCategory.trim(),
        amount: parsed,
        note: expNote.trim(),
        createdAt: serverTimestamp(),
      });
      setExpCategory("");
      setExpAmount("");
      setExpNote("");
      setShowAddExpense(false);
      toast.success("Expense entry added.");
    } catch {
      toast.error("Failed to save. Please try again.");
    } finally {
      setSavingExpense(false);
    }
  }

  async function handleDeleteExpense(id: string) {
    if (!user) return;
    setDeletingExpenseId(id);
    try {
      await deleteDoc(doc(db, "expenses", id));
      toast.success("Expense deleted.");
    } catch {
      toast.error("Failed to delete expense.");
    } finally {
      setDeletingExpenseId(null);
    }
  }

  if (!loading && !account) {
    return (
      <div className="p-6 flex flex-col items-center justify-center py-20 text-center">
        <p className="font-semibold text-gray-700 mb-2">Account not found.</p>
        <button
          onClick={() => navigate("/income")}
          className="text-green-600 text-sm hover:underline mt-1"
        >
          ← Back to Income
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/income")}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={18} className="text-gray-600" />
          </button>
          <div>
            {loading ? (
              <div className="space-y-1.5">
                <div className="h-7 w-36 bg-gray-100 rounded-lg animate-pulse" />
                <div className="h-4 w-48 bg-gray-50 rounded animate-pulse" />
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-gray-900">
                  {account?.name}
                </h1>
                <p className="text-gray-500 text-sm mt-0.5">
                  {account?.type}
                  {currency !== "PHP" && (
                    <span className="ml-1.5 px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-semibold text-[10px]">
                      {currency}
                    </span>
                  )}
                  {" · "}
                  {fmt(balance)} balance
                </p>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "expenses" ? (
            <button
              onClick={() => {
                setExpCategory("");
                setExpAmount("");
                setExpNote("");
                setShowAddExpense(true);
              }}
              className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
            >
              <Plus size={16} />
              Add Expense
            </button>
          ) : (
            <button
              onClick={() => {
                setSource("");
                setAmount("");
                setNote("");
                setShowAddIncome(true);
              }}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
            >
              <Plus size={16} />
              Add Income
            </button>
          )}
        </div>
      </div>

      {/* Balance banner */}
      {!loading && account && (
        <div className="bg-gradient-to-br from-green-600 to-emerald-700 rounded-2xl p-6 text-white shadow-lg">
          <p className="text-green-100 text-sm font-medium">Current Balance</p>
          <p className="text-4xl font-bold mt-1">{fmt(balance)}</p>
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5">
              <TrendingUp size={13} className="text-green-200" />
              <p className="text-green-100 text-xs">+{fmt(totalIncome)}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <TrendingDown size={13} className="text-red-300" />
              <p className="text-green-100 text-xs">-{fmt(totalExpenses)}</p>
            </div>
            {account.initialBalance > 0 && (
              <p className="text-green-100 text-xs opacity-70">
                Starting: {fmt(account.initialBalance)}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Entries table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-1">
          <button
            onClick={() => setActiveTab("income")}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "income"
                ? "bg-green-100 text-green-700"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            Income
          </button>
          <button
            onClick={() => setActiveTab("expenses")}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "expenses"
                ? "bg-red-100 text-red-600"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            Expenses
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-green-600" />
          </div>
        ) : activeTab === "income" ? (
          accountEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mb-3">
                <Banknote size={24} className="text-green-500" />
              </div>
              <p className="font-medium text-gray-700 mb-1">
                No income entries yet
              </p>
              <p className="text-sm text-gray-400">
                Click "Add Income" to record your first entry.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {accountEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors group"
                >
                  <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <TrendingUp size={16} className="text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm truncate">
                      {entry.source}
                    </p>
                    {entry.note && (
                      <p className="text-xs text-gray-400 truncate">
                        {entry.note}
                      </p>
                    )}
                  </div>
                  <p className="font-bold text-green-600 text-sm flex-shrink-0">
                    +{fmt(entry.amount)}
                  </p>
                  <button
                    onClick={() => handleDeleteEntry(entry.id)}
                    disabled={deletingId === entry.id}
                    className="ml-1 w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                  >
                    {deletingId === entry.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )
        ) : accountExpenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mb-3">
              <TrendingDown size={24} className="text-red-400" />
            </div>
            <p className="font-medium text-gray-700 mb-1">
              No expense entries yet
            </p>
            <p className="text-sm text-gray-400">
              Click "Add Expense" to record an expense.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {accountExpenses.map((expense) => (
              <div
                key={expense.id}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors group"
              >
                <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <TrendingDown size={16} className="text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm truncate">
                    {expense.category}
                  </p>
                  {expense.note && (
                    <p className="text-xs text-gray-400 truncate">
                      {expense.note}
                    </p>
                  )}
                </div>
                <p className="font-bold text-red-500 text-sm flex-shrink-0">
                  -{fmt(expense.amount)}
                </p>
                <button
                  onClick={() => handleDeleteExpense(expense.id)}
                  disabled={deletingExpenseId === expense.id}
                  className="ml-1 w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                >
                  {deletingExpenseId === expense.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Income Modal */}
      {showAddIncome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Add Income</h2>
                <p className="text-xs text-gray-400 mt-0.5">{account?.name}</p>
              </div>
              <button
                onClick={() => setShowAddIncome(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              >
                <X size={16} className="text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleAddIncome} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Income Source
                </label>
                <input
                  type="text"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="e.g. Salary, Freelance…"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {SOURCE_SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSource(s)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                        source === s
                          ? "bg-green-600 text-white border-green-600"
                          : "bg-white text-gray-600 border-gray-200 hover:border-green-400 hover:text-green-700"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Amount ({currencySymbol})
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
                  onClick={() => setShowAddIncome(false)}
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
      {/* Add Expense Modal */}
      {showAddExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Add Expense</h2>
                <p className="text-xs text-gray-400 mt-0.5">{account?.name}</p>
              </div>
              <button
                onClick={() => setShowAddExpense(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              >
                <X size={16} className="text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Category
                </label>
                <input
                  type="text"
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value)}
                  placeholder="e.g. Online Payment, ATM Withdrawal…"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition"
                />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setExpCategory(cat)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                        expCategory === cat
                          ? "bg-red-500 text-white border-red-500"
                          : "bg-white text-gray-600 border-gray-200 hover:border-red-400 hover:text-red-600"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Amount ({currencySymbol})
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Note{" "}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={expNote}
                  onChange={(e) => setExpNote(e.target.value)}
                  placeholder="Any additional details…"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddExpense(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingExpense}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white text-sm font-semibold transition-all active:scale-[0.98]"
                >
                  {savingExpense ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : null}
                  {savingExpense ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

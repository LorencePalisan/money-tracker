import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
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
  Wallet,
  X,
  Loader2,
  Building2,
  ChevronRight,
} from "lucide-react";

const ACCOUNT_TYPES = [
  "Bank Account",
  "E-Wallet (GCash)",
  "E-Wallet (Maya)",
  "Cash",
  "Savings",
  "Investment",
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

export default function IncomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<IncomeEntry[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(true);

  // Modals
  const [showAddAccount, setShowAddAccount] = useState(false);

  // Add account form
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState(ACCOUNT_TYPES[0]);
  const [accountCurrency, setAccountCurrency] = useState("PHP");
  const [accountInitialBalance, setAccountInitialBalance] = useState("");
  const [savingAccount, setSavingAccount] = useState(false);

  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "accounts"),
      where("uid", "==", user.uid),
      orderBy("createdAt", "asc"),
    );
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

  const balanceFor = (accountId: string) => {
    const account = accounts.find((a) => a.id === accountId);
    const incomeTotal = entries
      .filter((e) => e.accountId === accountId)
      .reduce((sum, e) => sum + e.amount, 0);
    return (account?.initialBalance ?? 0) + incomeTotal;
  };

  const totalBalance = accounts.reduce((sum, a) => sum + balanceFor(a.id), 0);

  const fmtCurrency = (n: number, currency = "PHP") =>
    n.toLocaleString("en-PH", { style: "currency", currency });

  // Keep a simple formatter for the total banner (PHP only)
  const fmt = (n: number) => fmtCurrency(n, "PHP");

  async function handleAddAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!accountName.trim()) {
      toast.error("Account name is required.");
      return;
    }
    const parsedInitial = parseFloat(accountInitialBalance);
    const initialBalance =
      accountInitialBalance === ""
        ? 0
        : isNaN(parsedInitial)
          ? -1
          : parsedInitial;
    if (initialBalance < 0) {
      toast.error("Enter a valid starting balance (or leave blank for 0).");
      return;
    }
    setSavingAccount(true);
    try {
      await addDoc(collection(db, "accounts"), {
        uid: user!.uid,
        name: accountName.trim(),
        type: accountType,
        currency: accountCurrency,
        initialBalance,
        createdAt: serverTimestamp(),
      });
      setAccountName("");
      setAccountType(ACCOUNT_TYPES[0]);
      setAccountCurrency("PHP");
      setAccountInitialBalance("");
      setShowAddAccount(false);
      toast.success("Account created successfully.");
    } catch {
      toast.error("Failed to create account. Please try again.");
    } finally {
      setSavingAccount(false);
    }
  }

  async function handleDeleteAccount(accountId: string) {
    const account = accounts.find((a) => a.id === accountId);
    if (!account || !user) return;
    setDeletingAccountId(accountId);
    try {
      const toDelete = entries.filter((e) => e.accountId === accountId);
      await Promise.all(
        toDelete.map((e) => deleteDoc(doc(db, "income", e.id))),
      );
      await deleteDoc(doc(db, "accounts", accountId));
      toast.success(`"${account.name}" account deleted.`);
    } catch {
      toast.error("Failed to delete account.");
    } finally {
      setDeletingAccountId(null);
    }
  }

  const loading = loadingAccounts || loadingEntries;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Income</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Manage your accounts and income sources.
          </p>
        </div>
        <button
          onClick={() => {
            setAccountName("");
            setAccountType(ACCOUNT_TYPES[0]);
            setAccountCurrency("PHP");
            setAccountInitialBalance("");
            setShowAddAccount(true);
          }}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
        >
          <Plus size={16} />
          Add Account
        </button>
      </div>

      {/* Accounts list view */}
      <>
        {!loading && accounts.length > 0 && (
          <div className="bg-gradient-to-br from-green-600 to-emerald-700 rounded-2xl p-6 text-white shadow-lg">
            <p className="text-green-100 text-sm font-medium">Total Balance</p>
            <p className="text-4xl font-bold mt-1">{fmt(totalBalance)}</p>
            <p className="text-green-100 text-xs mt-2">
              {accounts.length} account{accounts.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-green-600" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
              <Building2 size={28} className="text-green-500" />
            </div>
            <p className="font-semibold text-gray-700 mb-1">No accounts yet</p>
            <p className="text-sm text-gray-400">
              Create your first account to start tracking income.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:border-green-200 hover:shadow-md transition-all group cursor-pointer"
                onClick={() =>
                  navigate(
                    `/accounts?account=${encodeURIComponent(account.name)}`,
                  )
                }
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-11 h-11 bg-green-50 rounded-xl flex items-center justify-center">
                    <Wallet size={20} className="text-green-600" />
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(ev) => {
                        ev.stopPropagation();
                        handleDeleteAccount(account.id);
                      }}
                      disabled={deletingAccountId === account.id}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                      title="Delete Account"
                    >
                      {deletingAccountId === account.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  </div>
                </div>
                <p className="font-bold text-gray-900 text-base">
                  {account.name}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {account.type}
                  {account.currency && account.currency !== "PHP" && (
                    <span className="ml-1.5 px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-semibold text-[10px]">
                      {account.currency}
                    </span>
                  )}
                </p>
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    {account.initialBalance > 0 && (
                      <p className="text-xs text-gray-400 mb-0.5">
                        Starting:{" "}
                        {fmtCurrency(
                          account.initialBalance,
                          account.currency ?? "PHP",
                        )}
                      </p>
                    )}
                    <p className="text-xs text-gray-400">Balance</p>
                    <p className="text-xl font-bold text-green-600">
                      {fmtCurrency(
                        balanceFor(account.id),
                        account.currency ?? "PHP",
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 text-xs text-gray-400">
                    <span>
                      {entries.filter((e) => e.accountId === account.id).length}{" "}
                      entries
                    </span>
                    <ChevronRight size={14} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </>

      {/* Add Account Modal */}
      {showAddAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">Add Account</h2>
              <button
                onClick={() => setShowAddAccount(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              >
                <X size={16} className="text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleAddAccount} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Account Name
                </label>
                <input
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="e.g. BDO Savings, GCash, Cash on Hand…"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Currency
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {CURRENCIES.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => setAccountCurrency(c.code)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                        accountCurrency === c.code
                          ? "bg-green-600 text-white border-green-600"
                          : "bg-white text-gray-600 border-gray-200 hover:border-green-400 hover:text-green-700"
                      }`}
                      title={c.label}
                    >
                      {c.symbol} {c.code}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Account Type
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {ACCOUNT_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setAccountType(t)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                        accountType === t
                          ? "bg-green-600 text-white border-green-600"
                          : "bg-white text-gray-600 border-gray-200 hover:border-green-400 hover:text-green-700"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Current Balance (
                  {CURRENCIES.find((c) => c.code === accountCurrency)?.symbol ??
                    accountCurrency}
                  ){" "}
                  <span className="text-gray-400 font-normal">
                    (optional, fixed after creation)
                  </span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={accountInitialBalance}
                  onChange={(e) => setAccountInitialBalance(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                />
                <p className="text-xs text-gray-400">
                  Enter how much money is already in this account. This cannot
                  be changed later.
                </p>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddAccount(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAccount}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-semibold transition-all active:scale-[0.98]"
                >
                  {savingAccount ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : null}
                  {savingAccount ? "Creating…" : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

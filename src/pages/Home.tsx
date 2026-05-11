import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  CalendarClock,
  ArrowRight,
} from "lucide-react";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  type Timestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";

const CURRENCIES: Record<string, string> = {
  PHP: "₱",
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  SGD: "S$",
  AUD: "A$",
  CAD: "C$",
  HKD: "HK$",
  KRW: "₩",
};

interface Account {
  id: string;
  uid: string;
  name: string;
  type: string;
  currency: string;
  initialBalance: number;
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
interface MonthlyExpense {
  id: string;
  uid: string;
  name: string;
  category: string;
  amount: number;
  accountId: string;
  dueDay: number;
}
interface MonthlyPayment {
  id: string;
  uid: string;
  monthlyExpenseId: string;
  amount: number;
  month: number;
  year: number;
}

interface Transaction {
  id: string;
  type: "income" | "expense";
  label: string;
  accountName: string;
  amount: number;
  currency: string;
  createdAt: Timestamp | null;
}

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const firstName =
    user?.displayName?.split(" ")[0] ?? user?.email?.split("@")[0] ?? "there";

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [income, setIncome] = useState<IncomeEntry[]>([]);
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [monthlyExpenses, setMonthlyExpenses] = useState<MonthlyExpense[]>([]);
  const [monthlyPayments, setMonthlyPayments] = useState<MonthlyPayment[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  useEffect(() => {
    if (!user) return;
    const unsubs: (() => void)[] = [];
    let settled = 0;
    const check = () => {
      settled++;
      if (settled >= 5) setLoading(false);
    };

    unsubs.push(
      onSnapshot(
        query(collection(db, "accounts"), where("uid", "==", user.uid)),
        (s) => {
          setAccounts(
            s.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<Account, "id">),
            })),
          );
          check();
        },
      ),
    );
    unsubs.push(
      onSnapshot(
        query(
          collection(db, "income"),
          where("uid", "==", user.uid),
          orderBy("createdAt", "desc"),
        ),
        (s) => {
          setIncome(
            s.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<IncomeEntry, "id">),
            })),
          );
          check();
        },
      ),
    );
    unsubs.push(
      onSnapshot(
        query(
          collection(db, "expenses"),
          where("uid", "==", user.uid),
          orderBy("createdAt", "desc"),
        ),
        (s) => {
          setExpenses(
            s.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<ExpenseEntry, "id">),
            })),
          );
          check();
        },
      ),
    );
    unsubs.push(
      onSnapshot(
        query(collection(db, "monthly_expenses"), where("uid", "==", user.uid)),
        (s) => {
          setMonthlyExpenses(
            s.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<MonthlyExpense, "id">),
            })),
          );
          check();
        },
      ),
    );
    unsubs.push(
      onSnapshot(
        query(
          collection(db, "monthly_payments"),
          where("uid", "==", user.uid),
          where("year", "==", currentYear),
          where("month", "==", currentMonth),
        ),
        (s) => {
          setMonthlyPayments(
            s.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<MonthlyPayment, "id">),
            })),
          );
          check();
        },
      ),
    );

    return () => unsubs.forEach((u) => u());
  }, [user, currentMonth, currentYear]);

  // Per-account balance
  function accountBalance(acc: Account) {
    const totalIncome = income
      .filter((e) => e.accountId === acc.id)
      .reduce((s, e) => s + e.amount, 0);
    const totalExpense = expenses
      .filter((e) => e.accountId === acc.id)
      .reduce((s, e) => s + e.amount, 0);
    return acc.initialBalance + totalIncome - totalExpense;
  }

  // Stats
  const totalBalance = accounts.reduce((sum, a) => sum + accountBalance(a), 0);

  const monthStart = new Date(currentYear, currentMonth - 1, 1);
  const incomeThisMonth = income
    .filter((e) => (e.createdAt?.toMillis() ?? 0) >= monthStart.getTime())
    .reduce((s, e) => s + e.amount, 0);
  const expensesThisMonth = expenses
    .filter((e) => (e.createdAt?.toMillis() ?? 0) >= monthStart.getTime())
    .reduce((s, e) => s + e.amount, 0);
  const monthlyPaidThisMonth = monthlyPayments.reduce(
    (s, p) => s + p.amount,
    0,
  );
  const totalExpensesThisMonth = expensesThisMonth + monthlyPaidThisMonth;

  const unpaidMonthly = monthlyExpenses.filter(
    (me) => !monthlyPayments.some((p) => p.monthlyExpenseId === me.id),
  );

  // Recent transactions (combined, last 8)
  const transactions: Transaction[] = [
    ...income.map(
      (e): Transaction => ({
        id: e.id,
        type: "income",
        label: e.source,
        accountName: accounts.find((a) => a.id === e.accountId)?.name ?? "—",
        amount: e.amount,
        currency: accounts.find((a) => a.id === e.accountId)?.currency ?? "PHP",
        createdAt: e.createdAt,
      }),
    ),
    ...expenses.map(
      (e): Transaction => ({
        id: e.id,
        type: "expense",
        label: e.category,
        accountName: accounts.find((a) => a.id === e.accountId)?.name ?? "—",
        amount: e.amount,
        currency: accounts.find((a) => a.id === e.accountId)?.currency ?? "PHP",
        createdAt: e.createdAt,
      }),
    ),
  ]
    .sort(
      (a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0),
    )
    .slice(0, 8);

  const fmt = (n: number, currency = "PHP") =>
    `${CURRENCIES[currency] ?? currency}${Math.abs(n).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

  const Skeleton = ({ w, h }: { w: string; h: string }) => (
    <div className={`${w} ${h} bg-gray-100 rounded-lg animate-pulse`} />
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Hello, {firstName} 👋
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Here's your financial overview.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Balance */}
        <div className="bg-gradient-to-br from-green-600 to-emerald-700 rounded-2xl p-5 text-white shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
              <Wallet size={18} className="text-white" />
            </div>
            <p className="text-sm font-medium text-green-100">Total Balance</p>
          </div>
          {loading ? (
            <Skeleton w="w-32" h="h-8" />
          ) : (
            <p className="text-3xl font-bold">
              ₱
              {totalBalance.toLocaleString("en-PH", {
                minimumFractionDigits: 2,
              })}
            </p>
          )}
          <p className="text-green-200 text-xs mt-1">
            {accounts.length} account{accounts.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Income this month */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center">
              <TrendingUp size={18} className="text-emerald-500" />
            </div>
            <p className="text-sm font-medium text-gray-500">
              Income · {now.toLocaleString("en-US", { month: "short" })}
            </p>
          </div>
          {loading ? (
            <Skeleton w="w-28" h="h-7" />
          ) : (
            <p className="text-2xl font-bold text-gray-900">
              ₱
              {incomeThisMonth.toLocaleString("en-PH", {
                minimumFractionDigits: 2,
              })}
            </p>
          )}
          <p className="text-gray-400 text-xs mt-1">
            {
              income.filter(
                (e) => (e.createdAt?.toMillis() ?? 0) >= monthStart.getTime(),
              ).length
            }{" "}
            entries
          </p>
        </div>

        {/* Expenses this month */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center">
              <TrendingDown size={18} className="text-red-500" />
            </div>
            <p className="text-sm font-medium text-gray-500">
              Expenses · {now.toLocaleString("en-US", { month: "short" })}
            </p>
          </div>
          {loading ? (
            <Skeleton w="w-28" h="h-7" />
          ) : (
            <p className="text-2xl font-bold text-gray-900">
              ₱
              {totalExpensesThisMonth.toLocaleString("en-PH", {
                minimumFractionDigits: 2,
              })}
            </p>
          )}
          <p className="text-gray-400 text-xs mt-1">
            incl.{" "}
            {monthlyPaidThisMonth > 0
              ? `₱${monthlyPaidThisMonth.toLocaleString("en-PH", { minimumFractionDigits: 2 })} recurring`
              : "recurring"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Accounts */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Accounts</h2>
            <button
              onClick={() => navigate("/income")}
              className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium"
            >
              Manage <ArrowRight size={12} />
            </button>
          </div>

          {loading ? (
            <div className="p-5 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-xl animate-pulse" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 w-28 bg-gray-100 rounded animate-pulse" />
                    <div className="h-3 w-20 bg-gray-50 rounded animate-pulse" />
                  </div>
                  <div className="h-5 w-20 bg-gray-100 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
              <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mb-3">
                <Wallet size={20} className="text-green-500" />
              </div>
              <p className="font-medium text-gray-700 mb-1 text-sm">
                No accounts yet
              </p>
              <button
                onClick={() => navigate("/income")}
                className="text-xs text-green-600 hover:underline mt-1"
              >
                Create your first account →
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {accounts.map((acc) => {
                const bal = accountBalance(acc);
                const sym = CURRENCIES[acc.currency] ?? acc.currency;
                return (
                  <button
                    key={acc.id}
                    onClick={() =>
                      navigate(
                        `/accounts?account=${encodeURIComponent(acc.name)}`,
                      )
                    }
                    className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Wallet size={16} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm truncate">
                        {acc.name}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {acc.type}
                        {acc.currency !== "PHP" && ` · ${acc.currency}`}
                      </p>
                    </div>
                    <p
                      className={`font-bold text-sm flex-shrink-0 ${bal < 0 ? "text-red-500" : "text-green-600"}`}
                    >
                      {bal < 0 ? "-" : ""}
                      {sym}
                      {Math.abs(bal).toLocaleString("en-PH", {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                    <ArrowRight
                      size={14}
                      className="text-gray-300 flex-shrink-0"
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Unpaid monthly + recent transactions stacked */}
        <div className="space-y-6">
          {/* Unpaid monthly expenses */}
          {(loading || unpaidMonthly.length > 0) && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800">
                  Unpaid This Month
                </h2>
                <button
                  onClick={() => navigate("/monthly-expenses")}
                  className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium"
                >
                  View all <ArrowRight size={12} />
                </button>
              </div>
              {loading ? (
                <div className="p-5 space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-gray-100 rounded-xl animate-pulse" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
                        <div className="h-3 w-16 bg-gray-50 rounded animate-pulse" />
                      </div>
                      <div className="h-5 w-16 bg-gray-100 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {unpaidMonthly.slice(0, 5).map((me) => {
                    const acc = accounts.find((a) => a.id === me.accountId);
                    const sym = CURRENCIES[acc?.currency ?? "PHP"] ?? "₱";
                    return (
                      <div
                        key={me.id}
                        className="flex items-center gap-3 px-5 py-3.5"
                      >
                        <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0">
                          <CalendarClock
                            size={15}
                            className="text-orange-500"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-800 text-sm truncate">
                            {me.name}
                          </p>
                          <p className="text-xs text-gray-400">
                            Due day {me.dueDay} · {acc?.name ?? "—"}
                          </p>
                        </div>
                        <p className="font-bold text-red-500 text-sm flex-shrink-0">
                          -{sym}
                          {me.amount.toLocaleString("en-PH", {
                            minimumFractionDigits: 2,
                          })}
                        </p>
                      </div>
                    );
                  })}
                  {unpaidMonthly.length > 5 && (
                    <div className="px-5 py-3 text-xs text-gray-400">
                      +{unpaidMonthly.length - 5} more unpaid
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Recent transactions */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">
                Recent Transactions
              </h2>
            </div>
            {loading ? (
              <div className="p-5 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-gray-100 rounded-xl animate-pulse" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-4 w-28 bg-gray-100 rounded animate-pulse" />
                      <div className="h-3 w-20 bg-gray-50 rounded animate-pulse" />
                    </div>
                    <div className="h-5 w-16 bg-gray-100 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ) : transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mb-3">
                  <Wallet size={20} className="text-green-500" />
                </div>
                <p className="font-medium text-gray-700 mb-1 text-sm">
                  No transactions yet
                </p>
                <p className="text-xs text-gray-400">
                  Add income or expenses to see them here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center gap-3 px-5 py-3.5"
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${tx.type === "income" ? "bg-green-50" : "bg-red-50"}`}
                    >
                      {tx.type === "income" ? (
                        <TrendingUp size={15} className="text-green-600" />
                      ) : (
                        <TrendingDown size={15} className="text-red-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm truncate">
                        {tx.label}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {tx.accountName}
                      </p>
                    </div>
                    <p
                      className={`font-bold text-sm flex-shrink-0 ${tx.type === "income" ? "text-green-600" : "text-red-500"}`}
                    >
                      {tx.type === "income" ? "+" : "-"}
                      {fmt(tx.amount, tx.currency)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

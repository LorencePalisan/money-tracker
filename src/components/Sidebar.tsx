import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import {
  Home,
  ChevronLeft,
  ChevronRight,
  LogOut,
  TrendingUp,
  Banknote,
  CalendarClock,
} from "lucide-react";

const navItems = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/income", icon: Banknote, label: "Income" },
  { to: "/monthly-expenses", icon: CalendarClock, label: "Monthly Expenses" },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut(auth);
    navigate("/login");
  }

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? "MT";

  return (
    <aside
      className={`relative flex flex-col bg-gradient-to-b from-green-700 to-emerald-800 h-screen transition-all duration-300 ease-in-out ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Toggle button */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="absolute -right-3 top-6 z-10 flex items-center justify-center w-6 h-6 bg-white border border-gray-200 rounded-full shadow-md hover:shadow-lg transition-all"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <ChevronRight size={13} className="text-green-700" />
        ) : (
          <ChevronLeft size={13} className="text-green-700" />
        )}
      </button>

      {/* Logo */}
      <div
        className={`flex items-center gap-3 px-4 py-5 border-b border-white/10 ${collapsed ? "justify-center" : ""}`}
      >
        <div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
          <TrendingUp size={16} className="text-white" />
        </div>
        {!collapsed && (
          <span className="font-bold text-white text-sm tracking-tight truncate">
            Money Tracker
          </span>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-4 space-y-0.5 px-2 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? "bg-white/20 text-white shadow-sm"
                  : "text-green-100 hover:bg-white/10 hover:text-white"
              }`
            }
          >
            <Icon size={18} className="flex-shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User + sign out */}
      <div className="border-t border-white/10 p-3 space-y-1">
        {!collapsed && user && (
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl mb-1">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-white text-xs font-bold">{initials}</span>
            </div>
            <span className="text-xs text-green-100 truncate flex-1">
              {user.email}
            </span>
          </div>
        )}
        {collapsed && user && (
          <div className="flex justify-center mb-1">
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-white text-xs font-bold">{initials}</span>
            </div>
          </div>
        )}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-red-300 hover:bg-red-500/20 hover:text-red-200 transition-all"
        >
          <LogOut size={17} className="flex-shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}

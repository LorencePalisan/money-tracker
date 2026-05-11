import { Outlet } from "react-router-dom";
import { Toaster } from "sonner";
import Sidebar from "./Sidebar";

export default function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-green-50">
      <Toaster position="top-center" richColors />
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}

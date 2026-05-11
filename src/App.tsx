import { Routes, Route } from "react-router-dom";
import HomePage from "./pages/Home";
import IncomePage from "./pages/Income";
import AccountsPage from "./pages/Accounts";
import MonthlyExpensesPage from "./pages/MonthlyExpenses";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ProtectedRoute from "./components/ProtectedRoute";
import GuestRoute from "./components/GuestRoute";
import AppLayout from "./components/AppLayout";

function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <GuestRoute>
            <Login />
          </GuestRoute>
        }
      />
      <Route
        path="/register"
        element={
          <GuestRoute>
            <Register />
          </GuestRoute>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <GuestRoute>
            <ForgotPassword />
          </GuestRoute>
        }
      />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<HomePage />} />
        <Route path="/income" element={<IncomePage />} />
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/monthly-expenses" element={<MonthlyExpensesPage />} />
      </Route>
    </Routes>
  );
}

export default App;

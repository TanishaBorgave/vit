import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import SignupPage from './pages/SignupPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import UploadPage from './pages/UploadPage.jsx';
import ReconciliationPage from './pages/ReconciliationPage.jsx';
import PartyListPage from './pages/PartyListPage.jsx';
import PartyDetailPage from './pages/PartyDetailPage.jsx';
import IssuesPage from './pages/IssuesPage.jsx';
import ReturnPreparationPage from './pages/ReturnPreparationPage.jsx';
import ExportCenterPage from './pages/ExportCenterPage.jsx';
import VendorRiskPage from './pages/VendorRiskPage.jsx';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="upload" element={<UploadPage />} />
        <Route path="reconciliation" element={<ReconciliationPage />} />
        <Route path="parties" element={<PartyListPage />} />
        <Route path="parties/:gstin" element={<PartyDetailPage />} />
        <Route path="issues" element={<IssuesPage />} />
        <Route path="returns" element={<ReturnPreparationPage />} />
        <Route path="exports" element={<ExportCenterPage />} />
        <Route path="vendor-risk" element={<VendorRiskPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

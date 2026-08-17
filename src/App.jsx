import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { ThemeProvider } from '@/lib/ThemeContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ProtectedRoute from '@/components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';

// Auth pages
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

// App pages
import AppLayout from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';
import Customers from '@/pages/Customers';
import CustomerDetail from '@/pages/CustomerDetail';
import Billing from '@/pages/Billing';
import MikrotikMonitor from '@/pages/MikrotikMonitor';
import OltOnu from '@/pages/OltOnu';
import NetworkMap from '@/pages/NetworkMap';
import CollectorSetup from '@/pages/CollectorSetup';
import ActiveConnections from '@/pages/ActiveConnections';
import Packages from '@/pages/Packages';
import Support from '@/pages/Support';
import Staff from '@/pages/Staff';
import Reseller from '@/pages/Reseller';
import Management from '@/pages/Management';
import Configuration from '@/pages/Configuration';
import SignupList from '@/pages/SignupList';
import Hotspot from '@/pages/Hotspot';
import WorkReport from '@/pages/WorkReport';
import SMSService from '@/pages/SMSService';
import Accounting from '@/pages/Accounting';
import Payroll from '@/pages/Payroll';
import SuspendedClients from '@/pages/SuspendedClients';
import Payments from '@/pages/Payments';
import HotspotProfiles from '@/pages/HotspotProfiles';
import HotspotVouchers from '@/pages/HotspotVouchers';
import MikrotikProfiles from '@/pages/MikrotikProfiles';
import CableRoutes from '@/pages/CableRoutes';
import ResellerCommissions from '@/pages/ResellerCommissions';
import SupportCategories from '@/pages/SupportCategories';
import AccountingIncome from '@/pages/AccountingIncome';
import AccountingExpenses from '@/pages/AccountingExpenses';
import AccountingReports from '@/pages/AccountingReports';
import Reports from '@/pages/Reports';
import BulkImport from '@/pages/BulkImport';
import PaymentGateways from '@/pages/PaymentGateways';
import SmsProviders from '@/pages/SmsProviders';
import StaffDashboard from '@/pages/StaffDashboard';
import Offices from '@/pages/Offices';
import MapSettings from '@/pages/MapSettings';
import Zones from '@/pages/Zones';

// Customer portal
import Landing from '@/pages/portal/Landing';
import PortalLogin from '@/pages/portal/PortalLogin';
import PortalLayout from '@/pages/portal/PortalLayout';
import PortalDashboard from '@/pages/portal/PortalDashboard';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Customer Portal (public) */}
      <Route path="/portal" element={<Landing />} />
      <Route path="/portal/login" element={<PortalLogin />} />

      {/* Customer Portal (authenticated) */}
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/portal/login" replace />} />}>
        <Route element={<PortalLayout />}>
          <Route path="/portal/dashboard" element={<PortalDashboard />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/customers/:id" element={<CustomerDetail />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/mikrotik" element={<MikrotikMonitor />} />
          <Route path="/olt" element={<OltOnu />} />
          <Route path="/network-map" element={<NetworkMap />} />
          <Route path="/connections" element={<ActiveConnections />} />
          <Route path="/packages" element={<Packages />} />
          <Route path="/support" element={<Support />} />
          <Route path="/staff" element={<Staff />} />
          <Route path="/resellers" element={<Reseller />} />
          <Route path="/management" element={<Management />} />
          <Route path="/configuration" element={<Configuration />} />
          <Route path="/signups" element={<SignupList />} />
          <Route path="/hotspot" element={<Hotspot />} />
          <Route path="/work-report" element={<WorkReport />} />
          <Route path="/sms" element={<SMSService />} />
          <Route path="/accounting" element={<Accounting />} />
          <Route path="/payroll" element={<Payroll />} />
          <Route path="/customers/suspended" element={<SuspendedClients />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/hotspot-profiles" element={<HotspotProfiles />} />
          <Route path="/hotspot-vouchers" element={<HotspotVouchers />} />
          <Route path="/mikrotik-profiles" element={<MikrotikProfiles />} />
          <Route path="/cable-routes" element={<CableRoutes />} />
          <Route path="/reseller-commissions" element={<ResellerCommissions />} />
          <Route path="/support-categories" element={<SupportCategories />} />
          <Route path="/accounting/income" element={<AccountingIncome />} />
          <Route path="/accounting/expenses" element={<AccountingExpenses />} />
          <Route path="/accounting/reports" element={<AccountingReports />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/collector" element={<CollectorSetup />} />
          <Route path="/bulk-import" element={<BulkImport />} />
          <Route path="/payment-gateways" element={<PaymentGateways />} />
          <Route path="/sms-providers" element={<SmsProviders />} />
          <Route path="/staff-dashboard" element={<StaffDashboard />} />
          <Route path="/offices" element={<Offices />} />
          <Route path="/map-settings" element={<MapSettings />} />
          <Route path="/zones" element={<Zones />} />
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <ScrollToTop />
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
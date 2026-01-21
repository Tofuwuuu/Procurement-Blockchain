import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { initZeroCountHiding } from './utils';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Blockchain from './pages/Blockchain';
import Suppliers from './pages/Suppliers';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import Inventory from './pages/Inventory';
import Users from './pages/Users';
import Settings from './pages/Settings';
import AbstractOfCanvass from './pages/AbstractOfCanvass';
import PurchaseRequestCanvasser from './pages/PurchaseRequestCanvasser';
import SupplierSearch from './pages/SupplierSearch';
import Login from './pages/Login';
import ItemManagement from './pages/ItemManagement';
import AuditLogs from './pages/AuditLogs';
import Inspection from './pages/Inspection';
import InventoryCustodianSlip from './pages/InventoryCustodianSlip';
import PropertyAcknowledgementReceipt from './pages/PropertyAcknowledgementReceipt';
import LoadingSpinner from './components/LoadingSpinner';
import './App.css';

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  console.log('🛡️ ProtectedRoute render - isAuthenticated:', isAuthenticated, 'loading:', loading);

  if (loading) {
    console.log('⏳ ProtectedRoute loading, showing spinner');
    return <LoadingSpinner size="lg" text="Loading..." />;
  }

  if (!isAuthenticated) {
    console.log('❌ ProtectedRoute: User not authenticated, redirecting to /login');
    return <Navigate to="/login" replace />;
  }

  console.log('✅ ProtectedRoute: User authenticated, rendering children');
  return <>{children}</>;
};

// Admin Route Component
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return <LoadingSpinner size="lg" text="Loading..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!user?.is_admin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

function App() {
  const { isAuthenticated, loading } = useAuth();

  console.log('🏠 App component render - isAuthenticated:', isAuthenticated, 'loading:', loading);

  // Initialize zero count hiding globally
  useEffect(() => {
    const cleanup = initZeroCountHiding();
    return cleanup;
  }, []);

  if (loading) {
    console.log('⏳ App is loading, showing spinner');
    return <LoadingSpinner size="lg" text="Loading application..." />;
  }

  console.log('✅ App loaded, isAuthenticated:', isAuthenticated);

  return (
    <div className="App">
      <Routes>
        {/* Public Routes */}
        <Route 
          path="/login" 
          element={
            isAuthenticated ? (
              (() => {
                console.log('🔄 User is authenticated, redirecting from /login to /dashboard');
                return <Navigate to="/dashboard" replace />;
              })()
            ) : (
              (() => {
                console.log('📝 User not authenticated, showing Login component');
                return <Login />;
              })()
            )
          } 
        />

        {/* Protected Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/blockchain"
          element={
            <ProtectedRoute>
              <Layout>
                <Blockchain />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/suppliers"
          element={
            <ProtectedRoute>
              <Layout>
                <Suppliers />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/orders"
          element={
            <ProtectedRoute>
              <Layout>
                <Orders />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Canvasser - Purchase Request */}
        <Route
          path="/purchase-request-canvasser"
          element={
            <ProtectedRoute>
              <Layout>
                <PurchaseRequestCanvasser />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Canvasser - Abstract of Canvass */}
        <Route
          path="/abstract-of-canvass"
          element={
            <ProtectedRoute>
              <Layout>
                <AbstractOfCanvass />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Canvasser - Supplier Search */}
        <Route
          path="/supplier-search"
          element={
            <ProtectedRoute>
              <Layout>
                <SupplierSearch />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Canvasser - Purchase Order (reuse Orders view) */}
        <Route
          path="/purchase-order"
          element={
            <ProtectedRoute>
              <Layout>
                <Orders />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/purchase-request"
          element={
            <ProtectedRoute>
              <Layout>
                <Orders />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/purchase-requests"
          element={
            <ProtectedRoute>
              <Layout>
                <Orders />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/orders/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <OrderDetail />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/inventory"
          element={
            <ProtectedRoute>
              <Layout>
                <Inventory />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Admin-Only Routes */}
        <Route
          path="/users"
          element={
            <AdminRoute>
              <Layout>
                <Users />
              </Layout>
            </AdminRoute>
          }
        />

        <Route
          path="/settings"
          element={
            <AdminRoute>
              <Layout>
                <Settings />
              </Layout>
            </AdminRoute>
          }
        />

        <Route
          path="/item-management"
          element={
            <AdminRoute>
              <Layout>
                <ItemManagement />
              </Layout>
            </AdminRoute>
          }
        />

        <Route
          path="/audit-logs"
          element={
            <AdminRoute>
              <Layout>
                <AuditLogs />
              </Layout>
            </AdminRoute>
          }
        />

        <Route
          path="/item-proposal"
          element={
            <ProtectedRoute>
              <Layout>
                <ItemManagement />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/pending-items"
          element={
            <ProtectedRoute>
              <Layout>
                <ItemManagement />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Inspector route - Inspection and Acceptance Report */}
        <Route
          path="/inspection"
          element={
            <ProtectedRoute>
              <Layout>
                <Inspection />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Custodian routes */}
        <Route
          path="/inventory-custodian-slip"
          element={
            <ProtectedRoute>
              <Layout>
                <InventoryCustodianSlip />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/property-acknowledgement-receipt"
          element={
            <ProtectedRoute>
              <Layout>
                <PropertyAcknowledgementReceipt />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Catch-all route */}
        <Route
          path="*"
          element={
            <ProtectedRoute>
              <Navigate to="/dashboard" replace />
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  );
}

export default App;

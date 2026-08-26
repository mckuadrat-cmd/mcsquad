import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import { AuthProvider } from './context/AuthContext';
import { ChatProvider } from './context/ChatContext';
import { AppDataProvider } from './context/AppDataContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { NotificationProvider } from './context/NotificationContext';
import './index.css';

// Lazy Load Pages
const Dashboard = lazy(() => import('./pages/Dashboard/Dashboard'));
const Clients = lazy(() => import('./pages/Clients/Clients'));
const Leads = lazy(() => import('./pages/Leads/Leads'));
const Calendar = lazy(() => import('./pages/Calendar/Calendar'));
const Documents = lazy(() => import('./pages/Documents/Documents'));
const Projects = lazy(() => import('./pages/Projects/Projects'));
const Chat = lazy(() => import('./pages/Chat/Chat'));
const SettingsView = lazy(() => import('./pages/Settings/Settings'));
const DailyActivity = lazy(() => import('./pages/DailyActivity/DailyActivity'));
const ClientDashboard = lazy(() => import('./pages/Clients/ClientDashboard'));
const ReviewReport = lazy(() => import('./pages/Reports/ReviewReport'));
const Login = lazy(() => import('./pages/Auth/Login'));
const ResetPassword = lazy(() => import('./pages/Auth/ResetPassword'));

// Loading Fallback Component
const PageLoader = () => (
  <div style={{ 
    height: '100vh', width: '100%', display: 'flex', alignItems: 'center', 
    justifyContent: 'center', backgroundColor: '#FAFBFC', flexDirection: 'column', gap: '16px'
  }}>
    <div className="animate-spin" style={{ width: '40px', height: '40px', border: '4px solid var(--primary-soft)', borderTopColor: 'var(--primary)', borderRadius: '50%' }}></div>
    <p style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 600 }}>Memuat halaman...</p>
  </div>
);

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <AppDataProvider>
          <ChatProvider>
            <Router>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* Public Route */}
                  <Route path="/login" element={<Login />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  
                  {/* Protected Routes directly under Layout */}
                  <Route path="/" element={
                    <ProtectedRoute>
                      <Layout />
                    </ProtectedRoute>
                  }>
                    <Route index element={<Navigate to="/dashboard" replace />} />
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="clients" element={<Clients />} />

                    <Route path="leads" element={<Leads />} />
                    <Route path="calendar" element={<Calendar />} />
                    <Route path="documents" element={<Documents />} />
                    <Route path="projects" element={<Projects />} />
                    <Route path="chat" element={<Chat />} />
                    <Route path="settings" element={<SettingsView />} />
                    <Route path="activity" element={<DailyActivity />} />
                    {/* New Feature Routes */}
                    <Route path="clients/dashboard/:schoolName" element={<ClientDashboard />} />
                    <Route path="reports/event" element={<ReviewReport />} />
                  </Route>
                </Routes>
              </Suspense>
            </Router>
          </ChatProvider>
        </AppDataProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;

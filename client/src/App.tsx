import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

import { ClientPanelProvider } from '@/contexts/ClientPanelContext';
import { ClientSlideOver } from '@/components/clients/ClientSlideOver';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { MainLayout } from '@/layouts/MainLayout';

// Public pages
import { LoginPage } from '@/pages/LoginPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';
import { SurveyPage } from '@/pages/SurveyPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ForbiddenPage } from '@/pages/ForbiddenPage';

// Protected pages
import { DashboardPage } from '@/pages/DashboardPage';
import { ChangePasswordPage } from '@/pages/ChangePasswordPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { TicketListPage } from '@/pages/tickets/TicketListPage';
import { TicketNewPage } from '@/pages/tickets/TicketNewPage';
import { TicketDetailPage } from '@/pages/tickets/TicketDetailPage';
import { ClientListPage } from '@/pages/clients/ClientListPage';
import { ClientDetailPage } from '@/pages/clients/ClientDetailPage';

// Admin pages
import { AdminSettingsPage } from '@/pages/admin/AdminSettingsPage';
import { AdminCategoriesPage } from '@/pages/admin/AdminCategoriesPage';
import { AdminClientRolesPage } from '@/pages/admin/AdminClientRolesPage';
import { AdminRolesPage } from '@/pages/admin/AdminRolesPage';
import { AdminUsersPage } from '@/pages/admin/AdminUsersPage';
import { AdminSurveysPage } from '@/pages/admin/AdminSurveysPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ClientPanelProvider>
        <BrowserRouter>
          <Routes>
            {/* ── Public routes ─────────────────────────────────────────── */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
            <Route path="/survey/:token" element={<SurveyPage />} />
            <Route path="/403" element={<ForbiddenPage />} />
            <Route path="/404" element={<NotFoundPage />} />

            {/* ── Change password (protected, outside MainLayout) ────────── */}
            <Route
              path="/change-password"
              element={
                <ProtectedRoute>
                  <ChangePasswordPage />
                </ProtectedRoute>
              }
            />

            {/* ── Protected routes (inside MainLayout) ─────────────────── */}
            <Route
              element={
                <ProtectedRoute>
                  <ErrorBoundary>
                    <MainLayout />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/profile" element={<ProfilePage />} />

              {/* Tickets */}
              <Route path="/tickets" element={<TicketListPage />} />
              <Route
                path="/tickets/new"
                element={
                  <ProtectedRoute requiredPermission="tickets.create">
                    <TicketNewPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/tickets/:id" element={<TicketDetailPage />} />

              {/* Clients */}
              <Route
                path="/clients"
                element={
                  <ProtectedRoute requiredPermission="clients.view">
                    <ClientListPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/clients/:id"
                element={
                  <ProtectedRoute requiredPermission="clients.view">
                    <ClientDetailPage />
                  </ProtectedRoute>
                }
              />

              {/* Admin */}
              <Route
                path="/admin/settings"
                element={
                  <ProtectedRoute requiredPermission="admin.settings">
                    <AdminSettingsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/categories"
                element={
                  <ProtectedRoute requiredPermission="admin.categories">
                    <AdminCategoriesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/client-roles"
                element={
                  <ProtectedRoute requiredPermission="admin.clientRoles">
                    <AdminClientRolesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/roles"
                element={
                  <ProtectedRoute requiredPermission="admin.roles">
                    <AdminRolesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <ProtectedRoute requiredPermission="admin.users">
                    <AdminUsersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/surveys"
                element={
                  <ProtectedRoute requiredPermission="surveys.view">
                    <AdminSurveysPage />
                  </ProtectedRoute>
                }
              />
            </Route>

            {/* ── Catch-all ─────────────────────────────────────────────── */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>

        <ClientSlideOver />
        <Toaster
          position="top-right"
          toastOptions={{ duration: 4000 }}
        />
      </ClientPanelProvider>
    </QueryClientProvider>
  );
}

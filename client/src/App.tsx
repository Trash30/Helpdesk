import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

import { ClientPanelProvider } from '@/contexts/ClientPanelContext';
import { ClientSlideOver } from '@/components/clients/ClientSlideOver';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { MainLayout } from '@/layouts/MainLayout';
import { useAuthStore } from '@/stores/authStore';

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
import { BmcCardsPage } from '@/pages/BmcCardsPage';

// Admin pages
import { AdminSettingsPage } from '@/pages/admin/AdminSettingsPage';
import { AdminCategoriesPage } from '@/pages/admin/AdminCategoriesPage';
import { AdminClientRolesPage } from '@/pages/admin/AdminClientRolesPage';
import { AdminRolesPage } from '@/pages/admin/AdminRolesPage';
import { AdminUsersPage } from '@/pages/admin/AdminUsersPage';
import { AdminSurveysPage } from '@/pages/admin/AdminSurveysPage';
import { AdminOrganisationsPage } from '@/pages/admin/AdminOrganisationsPage';
import { AdminClubsPage } from '@/pages/admin/AdminClubsPage';
import { AdminPolesPage } from '@/pages/admin/AdminPolesPage';
import { AdminTicketTypesPage } from '@/pages/admin/AdminTicketTypesPage';
import { TodayEventsPage } from '@/pages/sports/TodayEventsPage';
import { KbListPage } from '@/pages/kb/KbListPage';
import { KbArticlePage } from '@/pages/kb/KbArticlePage';
import { CommercialEventsPage } from '@/pages/commercial/CommercialEventsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
    },
  },
});

function SmartDefaultRedirect() {
  const { permissions } = useAuthStore();
  // Utilisateur avec UNIQUEMENT events.create → page commerciale
  const isCommercialOnly =
    permissions.length > 0 &&
    permissions.every((p) => p === 'events.create');
  return <Navigate to={isCommercialOnly ? '/evenements/commercial' : '/dashboard'} replace />;
}

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
              <Route index element={<SmartDefaultRedirect />} />
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

              {/* Knowledge Base */}
              <Route
                path="/kb"
                element={
                  <ProtectedRoute requiredPermission="kb.read">
                    <KbListPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/kb/new"
                element={
                  <ProtectedRoute requiredPermission="kb.write">
                    <KbArticlePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/kb/:id"
                element={
                  <ProtectedRoute requiredPermission="kb.read">
                    <KbArticlePage />
                  </ProtectedRoute>
                }
              />


              {/* Evenements sportifs */}
              <Route path="/evenements/aujourd-hui" element={<TodayEventsPage />} />

              {/* Evenements commerciaux */}
              <Route
                path="/evenements/commercial"
                element={
                  <ProtectedRoute requiredPermission="events.create">
                    <CommercialEventsPage />
                  </ProtectedRoute>
                }
              />

              {/* Cartes BMC — serveurs LNR */}
              <Route
                path="/bmc-cards"
                element={
                  <ProtectedRoute requiredPermission="bmc.view">
                    <BmcCardsPage />
                  </ProtectedRoute>
                }
              />

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
              <Route
                path="/admin/organisations"
                element={
                  <ProtectedRoute requiredPermission="admin.clientRoles">
                    <AdminOrganisationsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/clubs"
                element={
                  <ProtectedRoute requiredPermission="admin.clientRoles">
                    <AdminClubsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/poles"
                element={
                  <ProtectedRoute requiredPermission="admin.clientRoles">
                    <AdminPolesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/ticket-types"
                element={
                  <ProtectedRoute requiredPermission="admin.clientRoles">
                    <AdminTicketTypesPage />
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

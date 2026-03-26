import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard, Ticket, Users, Settings, Tag, UserCheck,
  Shield, Users2, BarChart2, Plus, Search, LogOut, User,
  ChevronRight, Moon, Sun, Menu, Building2, MapPin, Landmark, FileType,
} from 'lucide-react';
import { useBranding } from '@/hooks/useBranding';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuthStore } from '@/stores/authStore';
import { getInitials, timeAgo } from '@/lib/utils';
import api from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

function useDarkMode() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? saved === 'true' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', String(dark));
  }, [dark]);

  return { dark, toggle: () => setDark(d => !d) };
}

function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debouncedQuery = useDebounce(query, 300);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const enabled = debouncedQuery.length > 0;

  const ticketsQuery = useQuery({
    queryKey: ['search-tickets', debouncedQuery],
    queryFn: () => api.get(`/tickets?search=${encodeURIComponent(debouncedQuery)}&limit=5`).then(r => r.data.data ?? []),
    enabled,
  });

  const clientsQuery = useQuery({
    queryKey: ['search-clients', debouncedQuery],
    queryFn: () => api.get(`/clients?search=${encodeURIComponent(debouncedQuery)}&limit=5`).then(r => r.data.data ?? []),
    enabled,
  });

  const tickets: any[] = ticketsQuery.data ?? [];
  const clients: any[] = clientsQuery.data ?? [];
  const results = [
    ...tickets.map((t: any) => ({ type: 'ticket', item: t })),
    ...clients.map((c: any) => ({ type: 'client', item: c })),
  ];

  useEffect(() => {
    if (enabled) setOpen(true);
    else setOpen(false);
    setActiveIndex(-1);
  }, [debouncedQuery, enabled]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const selectResult = useCallback((r: { type: string; item: any }) => {
    setQuery('');
    setOpen(false);
    if (r.type === 'ticket') navigate(`/tickets/${r.item.id}`);
    else navigate(`/clients/${r.item.id}`);
  }, [navigate]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); setQuery(''); }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && activeIndex >= 0 && results[activeIndex]) {
      selectResult(results[activeIndex]);
    }
  };

  const statusColors: Record<string, string> = {
    OPEN: 'bg-blue-100 text-blue-700',
    IN_PROGRESS: 'bg-orange-100 text-orange-700',
    PENDING: 'bg-pink-100 text-pink-700',
    CLOSED: 'bg-gray-100 text-gray-600',
  };

  return (
    <div ref={containerRef} className="relative w-full sm:w-72">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Rechercher..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => query.length > 0 && setOpen(true)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={open}
          aria-controls="global-search-results"
          aria-autocomplete="list"
          aria-label="Rechercher un ticket ou un client"
          aria-activedescendant={activeIndex >= 0 ? `search-result-${activeIndex}` : undefined}
          className="w-full pl-9 pr-3 h-9 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {open && results.length > 0 && (
        <div id="global-search-results" role="listbox" className="absolute top-full mt-1 w-[calc(100vw-2rem)] sm:w-96 max-h-96 overflow-y-auto rounded-md border bg-popover shadow-lg z-50">
          {tickets.length > 0 && (
            <div>
              <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b">Tickets</p>
              {tickets.map((t: any, i: number) => {
                const idx = i;
                return (
                  <button
                    key={t.id}
                    id={`search-result-${idx}`}
                    role="option"
                    aria-selected={activeIndex === idx}
                    className={`w-full text-left px-3 py-2.5 hover:bg-accent flex items-start gap-3 ${activeIndex === idx ? 'bg-accent' : ''}`}
                    onClick={() => selectResult({ type: 'ticket', item: t })}
                  >
                    <span className="font-mono text-xs text-primary mt-0.5 shrink-0">{t.ticketNumber}</span>
                    <span className="flex-1 text-sm line-clamp-1">{t.title}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${statusColors[t.status] ?? ''}`}>{t.status}</span>
                  </button>
                );
              })}
            </div>
          )}
          {clients.length > 0 && (
            <div>
              <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-t">Clients</p>
              {clients.map((c: any, i: number) => {
                const idx = tickets.length + i;
                return (
                  <button
                    key={c.id}
                    id={`search-result-${idx}`}
                    role="option"
                    aria-selected={activeIndex === idx}
                    className={`w-full text-left px-3 py-2.5 hover:bg-accent flex items-center gap-3 ${activeIndex === idx ? 'bg-accent' : ''}`}
                    onClick={() => selectResult({ type: 'client', item: c })}
                  >
                    <span className="text-sm font-medium">{c.firstName} {c.lastName}</span>
                    {c.company && <span className="text-xs text-muted-foreground">{c.company}</span>}
                    {c.phone && <span className="text-xs text-muted-foreground ml-auto">{c.phone}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  collapsed?: boolean;
  onNavigate?: () => void;
}

function NavItem({ to, icon, label, badge, collapsed, onNavigate }: NavItemProps) {
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <NavLink
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex w-full items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-foreground/70 hover:bg-muted hover:text-foreground'
              } ${collapsed ? 'justify-center' : ''}`
            }
          >
            <span className="shrink-0 inline-flex items-center">{icon}</span>
            {!collapsed && <span className="flex-1 truncate">{label}</span>}
            {!collapsed && badge !== undefined && badge > 0 && (
              <span className="ml-auto bg-destructive text-destructive-foreground text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </NavLink>
        </TooltipTrigger>
        {collapsed && <TooltipContent side="right">{label}</TooltipContent>}
      </Tooltip>
    </TooltipProvider>
  );
}

export function MainLayout() {
  const { logoUrl, companyName } = useBranding();
  const { can } = usePermissions();
  const { user, logout } = useAuthStore();
  const { dark, toggle } = useDarkMode();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  // Fetch open ticket count for sidebar badge
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats-badge'],
    queryFn: () => api.get('/dashboard/stats').then(r => r.data.data),
    refetchInterval: 60000,
  });

  const handleLogout = async () => {
    try { await api.post('/auth/logout'); } catch {}
    logout();
    navigate('/login');
  };

  const sidebarWidth = collapsed ? 'w-16' : 'w-60';
  const closeMobile = () => setMobileOpen(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={closeMobile}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        ${sidebarWidth}
        flex flex-col border-r bg-card transition-all duration-200 shrink-0
        fixed md:static inset-y-0 left-0 z-50 md:z-auto
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Logo */}
        <div className={`flex items-center gap-2 p-4 border-b h-14 ${collapsed ? 'justify-center' : ''}`}>
          {logoUrl ? (
            <img src={logoUrl} alt={companyName} className="max-h-8 max-w-[140px] object-contain" />
          ) : (
            !collapsed && (
              <span className="font-bold text-primary text-sm truncate">{companyName}</span>
            )
          )}
          {collapsed && !logoUrl && (
            <span className="font-bold text-primary text-lg">{companyName.charAt(0)}</span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
          <NavItem to="/dashboard" icon={<LayoutDashboard size={18} />} label="Dashboard" collapsed={collapsed} onNavigate={closeMobile} />
          <NavItem to="/tickets" icon={<Ticket size={18} />} label="Tickets" badge={stats?.openTickets} collapsed={collapsed} onNavigate={closeMobile} />
          {can('clients.view') && (
            <NavItem to="/clients" icon={<Users size={18} />} label="Clients" collapsed={collapsed} onNavigate={closeMobile} />
          )}

          {can('admin.access') && (
            <>
              {!collapsed && (
                <p className="px-3 pt-4 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Administration
                </p>
              )}
              {collapsed && <div className="my-2 border-t" />}
              {can('admin.settings') && (
                <NavItem to="/admin/settings" icon={<Settings size={18} />} label="Paramètres" collapsed={collapsed} onNavigate={closeMobile} />
              )}
              {can('admin.categories') && (
                <NavItem to="/admin/categories" icon={<Tag size={18} />} label="Catégories" collapsed={collapsed} onNavigate={closeMobile} />
              )}
              {can('admin.clientRoles') && (
                <NavItem to="/admin/client-roles" icon={<UserCheck size={18} />} label="Rôles clients" collapsed={collapsed} onNavigate={closeMobile} />
              )}
              {can('admin.roles') && (
                <NavItem to="/admin/roles" icon={<Shield size={18} />} label="Rôles & permissions" collapsed={collapsed} onNavigate={closeMobile} />
              )}
              {can('admin.users') && (
                <NavItem to="/admin/users" icon={<Users2 size={18} />} label="Équipe" collapsed={collapsed} onNavigate={closeMobile} />
              )}
              {can('surveys.view') && (
                <NavItem to="/admin/surveys" icon={<BarChart2 size={18} />} label="Enquêtes" collapsed={collapsed} onNavigate={closeMobile} />
              )}
              {can('admin.clientRoles') && (
                <NavItem to="/admin/organisations" icon={<Building2 size={18} />} label="Organisations" collapsed={collapsed} onNavigate={closeMobile} />
              )}
              {can('admin.clientRoles') && (
                <NavItem to="/admin/clubs" icon={<MapPin size={18} />} label="Clubs / Villes" collapsed={collapsed} onNavigate={closeMobile} />
              )}
              {can('admin.clientRoles') && (
                <NavItem to="/admin/poles" icon={<Landmark size={18} />} label="Pôles" collapsed={collapsed} onNavigate={closeMobile} />
              )}
              {can('admin.clientRoles') && (
                <NavItem to="/admin/ticket-types" icon={<FileType size={18} />} label="Types de demande" collapsed={collapsed} onNavigate={closeMobile} />
              )}
            </>
          )}
        </nav>

        {/* Collapse toggle — desktop only */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="hidden md:flex items-center justify-center p-2 m-2 rounded-md hover:bg-accent text-muted-foreground"
        >
          <ChevronRight size={16} className={`transition-transform ${collapsed ? '' : 'rotate-180'}`} />
        </button>
      </aside>

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Topbar */}
        <header className="flex items-center gap-4 px-4 h-14 border-b bg-card shrink-0">
          <button
            className="md:hidden flex items-center justify-center w-9 h-9 rounded-md hover:bg-accent"
            onClick={() => setMobileOpen(o => !o)}
            aria-label="Ouvrir le menu de navigation"
          >
            <Menu size={18} />
          </button>
          <div className="flex-1 sm:flex-none">
            <GlobalSearch />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={toggle}
              className="flex items-center justify-center w-9 h-9 rounded-md border border-input hover:bg-accent transition-colors"
              title={dark ? 'Mode clair' : 'Mode sombre'}
            >
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            {can('tickets.create') && (
              <Button size="sm" asChild>
                <Link to="/tickets/new">
                  <Plus size={16} />
                  <span className="hidden sm:inline">Nouveau ticket</span>
                </Link>
              </Button>
            )}

            {/* Avatar + user menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center justify-center w-9 h-9 rounded-full bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity">
                  {user ? getInitials(user.firstName, user.lastName) : '?'}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel className="font-normal">
                  <p className="text-sm font-medium truncate">{user?.firstName} {user?.lastName}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="flex items-center gap-2 cursor-pointer">
                    <User size={14} /> Mon profil
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="flex items-center gap-2 text-destructive focus:text-destructive cursor-pointer">
                  <LogOut size={14} /> Déconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6 bg-muted/40">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

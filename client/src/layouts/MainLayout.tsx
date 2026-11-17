import { useState, useEffect } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, Settings, Tag,
  Shield, Users2, LogOut, User,
  ChevronRight, Moon, Sun, Languages, Menu, BookOpen,
  CalendarPlus, Server, MessageCircle,
} from 'lucide-react';
import { useBranding } from '@/hooks/useBranding';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuthStore } from '@/stores/authStore';
import { getInitials } from '@/lib/utils';
import api from '@/lib/axios';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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

function useLocale() {
  const { i18n } = useTranslation();
  const toggle = () => {
    const next = i18n.language === 'en' ? 'fr' : 'en';
    i18n.changeLanguage(next);
    localStorage.setItem('locale', next);
  };
  return { locale: i18n.language, toggle };
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
              `flex w-full items-center gap-3 px-3 py-2.5 sm:py-2 rounded-md text-sm font-medium transition-colors ${
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
  const { t } = useTranslation('common');
  const { logoUrl, companyName } = useBranding();
  const { can } = usePermissions();
  const { user, logout } = useAuthStore();
  const { dark, toggle } = useDarkMode();
  const { locale, toggle: toggleLocale } = useLocale();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try { await api.post('/auth/logout'); } catch {}
    logout();
    navigate('/login');
  };

  const sidebarWidth = collapsed ? 'w-16' : 'w-60';
  const closeMobile = () => setMobileOpen(false);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background">
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
          <NavItem to="/dashboard" icon={<LayoutDashboard size={18} />} label={t('nav.dashboard')} collapsed={collapsed} onNavigate={closeMobile} />
          {can('kb.read') && (
            <NavItem to="/kb" icon={<BookOpen size={18} />} label={t('nav.kb')} collapsed={collapsed} onNavigate={closeMobile} />
          )}
          {can('events.create') && (
            <NavItem to="/evenements/commercial" icon={<CalendarPlus size={18} />} label={t('nav.missionSupport')} collapsed={collapsed} onNavigate={closeMobile} />
          )}
          {can('whatsapp.groups') && (
            <NavItem to="/whatsapp-groupes" icon={<MessageCircle size={18} />} label={t('nav.whatsappGroups')} collapsed={collapsed} onNavigate={closeMobile} />
          )}
          {can('bmc.view') && (
            <NavItem to="/bmc-cards" icon={<Server size={18} />} label={t('nav.bmc')} collapsed={collapsed} onNavigate={closeMobile} />
          )}

          {can('admin.access') && (
            <>
              {!collapsed && (
                <p className="px-3 pt-4 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {t('nav.administration')}
                </p>
              )}
              {collapsed && <div className="my-2 border-t" />}
              {can('admin.settings') && (
                <NavItem to="/admin/settings" icon={<Settings size={18} />} label={t('nav.settings')} collapsed={collapsed} onNavigate={closeMobile} />
              )}
              {can('admin.categories') && (
                <NavItem to="/admin/categories" icon={<Tag size={18} />} label={t('nav.categories')} collapsed={collapsed} onNavigate={closeMobile} />
              )}
              {can('admin.roles') && (
                <NavItem to="/admin/roles" icon={<Shield size={18} />} label={t('nav.roles')} collapsed={collapsed} onNavigate={closeMobile} />
              )}
              {can('admin.users') && (
                <NavItem to="/admin/users" icon={<Users2 size={18} />} label={t('nav.team')} collapsed={collapsed} onNavigate={closeMobile} />
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
        <header className="flex items-center gap-2 sm:gap-4 px-2 sm:px-4 h-14 border-b bg-card shrink-0">
          <button
            className="md:hidden flex items-center justify-center h-11 w-11 rounded-md hover:bg-accent active:bg-accent/80"
            onClick={() => setMobileOpen(o => !o)}
            aria-label={t('header.openMenu')}
          >
            <Menu size={20} />
          </button>
          <div className="flex-1" />

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={toggleLocale}
              className="flex items-center justify-center gap-1 h-10 px-2.5 sm:h-9 rounded-md border border-input hover:bg-accent active:bg-accent/80 transition-colors text-xs font-semibold"
              title={locale === 'en' ? t('header.switchToFrench') : t('header.switchToEnglish')}
            >
              <Languages size={14} />
              {locale === 'en' ? 'FR' : 'EN'}
            </button>
            <button
              onClick={toggle}
              className="flex items-center justify-center h-10 w-10 sm:h-9 sm:w-9 rounded-md border border-input hover:bg-accent active:bg-accent/80 transition-colors"
              title={dark ? t('header.lightMode') : t('header.darkMode')}
            >
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {/* Avatar + user menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center justify-center w-10 h-10 sm:w-9 sm:h-9 rounded-full bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity">
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
                    <User size={14} /> {t('header.myProfile')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="flex items-center gap-2 text-destructive focus:text-destructive cursor-pointer">
                  <LogOut size={14} /> {t('header.logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6 bg-muted/40">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

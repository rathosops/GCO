// src/components/layout/DashboardLayout.tsx
import { useEffect, useMemo, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu,
  Home,
  Users,
  Calendar,
  FileText,
  DollarSign,
  Building2,
  Shield,
  ScrollText,
  UserCog,
  TestTube,
  LogOut,
  Pill,
  ChevronRight,
  BarChart3,
  Bell,
  Search,
  X,
  ClipboardList,
  ClipboardMinus,
  HeartPulse,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import ThemeSwitcher from "@/components/theme/ThemeSwitcher";

const menuItems = [
  { icon: Home, label: "Dashboard", path: "/" },
  { icon: Calendar, label: "Agendamentos", path: "/agendamentos" },
  { icon: Users, label: "Pacientes", path: "/pacientes" },
  { icon: FileText, label: "Consultas", path: "/consultas" },
  { icon: ClipboardMinus, label: "Receituários", path: "/receituarios" },
  { icon: TestTube, label: "Exames", path: "/exames" },
  { icon: DollarSign, label: "Financeiro", path: "/financeiro" },
  { icon: Building2, label: "Empresas", path: "/empresas" },
  { icon: Shield, label: "Convênios", path: "/convenios" },
  { icon: UserCog, label: "Médicos", path: "/medicos" },
  { icon: BarChart3, label: "Relatórios", path: "/relatorios" },
  { icon: ScrollText, label: "Auditoria", path: "/auditoria" },
  { icon: Pill, label: "Farmácia", path: "/farmacia" },
  { icon: HeartPulse, label: "ASO", path: "/aso" },
  { icon: ClipboardList, label: "Perícias IMESC", path: "/pericias-imesc" },
];

function useIsMobile(bp = 1024) {
  const [m, setM] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${bp - 1}px)`);
    const apply = () => setM(Boolean(mq.matches));
    apply();
    mq.addEventListener?.("change", apply) ?? mq.addListener?.(apply);
    return () => {
      mq.removeEventListener?.("change", apply) ?? mq.removeListener?.(apply);
    };
  }, [bp]);
  return m;
}

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const isMobile = useIsMobile(1024);
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const userLabel = String(user?.usuario ?? user?.nome ?? "U").trim();
  const userInitial = (userLabel[0] || "U").toUpperCase();

  const pageTitle = useMemo(
    () =>
      menuItems.find((i) => i.path === location.pathname)?.label || "Dashboard",
    [location.pathname],
  );

  useEffect(() => {
    if (isMobile) setDrawerOpen(false);
  }, [location.pathname, isMobile]);
  useEffect(() => {
    if (!isMobile) setDrawerOpen(false);
  }, [isMobile]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // ─── Sidebar content (compartilhado entre desktop e drawer) ───
  const SidebarContent = (
    <div className="h-full bg-bg-100 border-r border-bg-300 flex flex-col relative z-20">
      {/* Logo */}
      <div className="p-4 border-b border-bg-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-gradient-to-br from-primary-100 to-primary-200 rounded-xl flex items-center justify-center shrink-0">
              <span className="text-base font-bold text-white">C</span>
            </div>
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  className="overflow-hidden"
                >
                  <h2 className="font-bold text-text-100 text-sm whitespace-nowrap">
                    CMI-PCG
                  </h2>
                  <p className="text-[10px] text-text-200 whitespace-nowrap">
                    Gestão Clínica
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={() =>
              isMobile ? setDrawerOpen(false) : setCollapsed((v) => !v)
            }
            className="p-2 hover:bg-bg-200 rounded-lg shrink-0"
            aria-label={
              isMobile ? "Fechar menu" : collapsed ? "Expandir" : "Recolher"
            }
            type="button"
          >
            {isMobile ? (
              <X className="h-5 w-5 text-text-200" />
            ) : (
              <Menu className="h-4 w-4 text-text-200" />
            )}
          </button>
        </div>
      </div>

      {/* User card */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="px-3 py-3 border-b border-bg-300 overflow-hidden"
          >
            <div className="flex items-center gap-3 p-2.5 bg-bg-200 rounded-xl">
              <div className="avatar-md shrink-0">{userInitial}</div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-100 truncate">
                  {user?.usuario || user?.nome}
                </p>
                <p className="text-xs text-text-200 capitalize truncate">
                  {user?.tipo || user?.staff_type}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-150 ${
                isActive
                  ? "bg-primary-100 text-white"
                  : "text-text-200 hover:bg-bg-200 hover:text-text-100"
              }`}
              title={collapsed ? item.label : undefined}
              type="button"
            >
              <div
                className={`p-1.5 rounded-lg shrink-0 ${isActive ? "bg-white/20" : ""}`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    className="flex-1 text-left font-medium text-[13px] whitespace-nowrap overflow-hidden"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
              {isActive && !collapsed && (
                <ChevronRight className="h-3.5 w-3.5 shrink-0" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-2 border-t border-bg-300">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-danger hover:bg-danger-light transition-colors"
          title={collapsed ? "Sair" : undefined}
          type="button"
        >
          <div className="p-1.5 rounded-lg shrink-0">
            <LogOut className="h-4 w-4" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="font-medium text-[13px]"
              >
                Sair
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-bg-200 overflow-hidden">
      {/* Desktop sidebar */}
      {!isMobile && (
        <motion.aside
          initial={false}
          animate={{ width: collapsed ? 72 : 264 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="hidden lg:block shrink-0"
        >
          {SidebarContent}
        </motion.aside>
      )}

      {/* Mobile drawer */}
      <AnimatePresence>
        {isMobile && drawerOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40"
              onClick={() => setDrawerOpen(false)}
            />
            <motion.aside
              key="drawer"
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "tween", duration: 0.2 }}
              className="fixed left-0 top-0 bottom-0 w-[80vw] max-w-[300px] z-50"
            >
              <div className="h-full">{SidebarContent}</div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="bg-bg-100 border-b border-bg-300 px-4 xl:px-6 py-3 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {isMobile && (
                <button
                  onClick={() => setDrawerOpen(true)}
                  className="p-2 hover:bg-bg-200 rounded-xl shrink-0"
                  aria-label="Abrir menu"
                  type="button"
                >
                  <Menu className="h-5 w-5 text-text-200" />
                </button>
              )}
              <h1 className="text-lg xl:text-xl font-bold text-text-100 truncate">
                {pageTitle}
              </h1>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Search (desktop) */}
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-bg-200 rounded-xl">
                <Search className="h-4 w-4 text-text-200" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  className="bg-transparent border-none outline-none text-sm text-text-100 placeholder:text-text-200 w-36 xl:w-48"
                />
                <kbd className="hidden xl:inline-flex items-center px-1.5 py-0.5 text-[10px] text-text-200 bg-bg-100 rounded border border-bg-300">
                  ⌘K
                </kbd>
              </div>

              <ThemeSwitcher />

              <button
                className="relative p-2 hover:bg-bg-200 rounded-xl"
                type="button"
              >
                <Bell className="h-5 w-5 text-text-200" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger rounded-full" />
              </button>

              <div className="flex items-center gap-2 pl-2 ml-1 border-l border-bg-300">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-medium text-text-100 leading-tight">
                    {user?.usuario || user?.nome}
                  </p>
                  <p className="text-[10px] text-text-200 capitalize leading-tight">
                    {user?.tipo || user?.staff_type}
                  </p>
                </div>
                <div className="avatar-sm">{userInitial}</div>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto bg-bg-200 page-padding">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Home, 
  CalendarDays, 
  UserCheck, 
  Truck, 
  Landmark, 
  CheckCircle2,
  FileCheck,
  Wrench, 
  Calculator,
  LogOut,
  Settings,
  FileText,
  ChevronDown,
  ChevronRight,
  PlusCircle,
  LayoutGrid,
  AlertTriangle,
  ArrowRightLeft
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  name: string;
  path?: string;
  icon: any;
  children?: { name: string; path: string; icon: any }[];
}

const navigation: NavItem[] = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  {
    name: 'Gestion',
    icon: Home,
    children: [
      { name: 'Propriétaires', path: '/owners', icon: Users },
      { name: 'Logements', path: '/properties', icon: Home },
    ]
  },
  {
    name: 'Exploitation',
    icon: CalendarDays,
    children: [
      { name: 'Locataires', path: '/tenants', icon: UserCheck },
      { name: 'Réservations', path: '/reservations', icon: CalendarDays },
      { name: 'Baux', path: '/mtr', icon: FileText },
      { name: 'Intervention', path: '/interventions', icon: Wrench },
      { name: 'Fournisseurs', path: '/suppliers', icon: Truck },
      { name: 'Génération Factures', path: '/suppliers?tab=validation', icon: FileCheck },
    ]
  },
  {
    name: 'Outils Comptable',
    icon: Calculator,
    children: [
      { name: 'Saisie OD', path: '/accounting/od/nouvelle', icon: PlusCircle },
    ]
  },
  {
    name: 'Comptabilité',
    icon: Landmark,
    children: [
      { name: 'Décaissements Propriétaires', path: '/accounting/mandant', icon: FileText },
      { name: 'Chiffre d\'Affaires Agence', path: '/accounting/agence', icon: FileText },
      { name: 'Grand Livre Général', path: '/accounting/grand-livre', icon: FileText },
      { name: 'Balance Comptable', path: '/accounting/balance', icon: Calculator },
      { name: 'Journaux Comptables', path: '/accounting/journaux', icon: LayoutGrid },
      { name: 'Opérations Diverses (OD)', path: '/accounting/od', icon: FileText },
      { name: 'Transfert Honoraires', path: '/accounting/transfert-honoraires', icon: ArrowRightLeft },
      { name: 'Banque', path: '/bank', icon: Landmark },
      { name: 'Rapprochement', path: '/reconciliation', icon: CheckCircle2 },
    ]
  },
  {
    name: 'Configuration',
    icon: Settings,
    children: [
      { name: 'Configuration Agence', path: '/configuration/agence', icon: Settings },
      { name: 'Configuration Tiers', path: '/configuration/tiers', icon: Settings },
      { name: 'Mapping OTA', path: '/configuration/ota', icon: Settings },
    ]
  }
];

const CollapsibleNavItem: React.FC<{ item: NavItem }> = ({ item }) => {
  const location = useLocation();
  const isChildActive = item.children?.some(child => location.pathname + location.search === child.path || location.pathname === child.path);
  const [isOpen, setIsOpen] = useState(isChildActive || false);

  if (!item.children) {
    return (
      <li>
        <NavLink
          to={item.path!}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              isActive 
                ? "bg-slate-800 text-white shadow-sm ring-1 ring-slate-700" 
                : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
            )
          }
        >
          <item.icon className="h-4 w-4" />
          {item.name}
        </NavLink>
      </li>
    );
  }

  return (
    <li className="space-y-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex w-full items-center justify-between gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
          isChildActive ? "text-white" : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
        )}
      >
        <div className="flex items-center gap-3">
          <item.icon className="h-4 w-4" />
          {item.name}
        </div>
        {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </button>
      
      {isOpen && (
        <ul className="pl-9 space-y-1">
          {item.children.map((child) => (
            <li key={child.path}>
              <NavLink
                to={child.path}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                    isActive 
                      ? "text-blue-400" 
                      : "text-slate-500 hover:text-white"
                  )
                }
              >
                {child.name}
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default function MainLayout() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const isSupabaseConfigured = !!(supabaseUrl && supabaseKey);

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900">
      {/* Sidebar - Bloomberg Style / Dark Mode */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-bold text-white tracking-tight">PRIMO ERP</h1>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider">Gestion Immobilière</p>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-3">
            {navigation.map((item) => (
              <CollapsibleNavItem key={item.name} item={item} />
            ))}
          </ul>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button className="flex w-full items-center gap-3 px-3 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors">
            <LogOut className="h-4 w-4" />
            Déconnexion
          </button>
        </div>
      </aside>


      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm z-10">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-slate-800">Agence Paris 17</h2>
            <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full border border-emerald-200">
              En ligne
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-100 px-3 py-1.5 rounded-md border border-slate-200">
              <span className="font-medium">Période:</span>
              <select className="bg-transparent border-none focus:ring-0 text-slate-900 font-semibold cursor-pointer">
                <option>Mars 2026</option>
                <option>Février 2026</option>
                <option>Janvier 2026</option>
              </select>
            </div>
            <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs border border-slate-300">
              AP
            </div>
          </div>
        </header>

        {/* Page Content */}
        {!isSupabaseConfigured && (
          <div className="bg-amber-50 border-b border-amber-200 px-8 py-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-amber-800">Configuration Supabase Manquante</h3>
              <p className="text-sm text-amber-700 mt-1">
                Les variables d'environnement <code>VITE_SUPABASE_URL</code> et <code>VITE_SUPABASE_ANON_KEY</code> ne sont pas définies.
                <br />
                Pour reconnecter la base de données, veuillez ajouter ces variables dans le panneau <strong>Secrets</strong> de Google AI Studio, puis redémarrer l'application.
              </p>
            </div>
          </div>
        )}
        <main className="flex-1 overflow-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

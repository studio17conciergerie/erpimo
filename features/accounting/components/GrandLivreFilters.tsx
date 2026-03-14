import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { 
  Search, 
  Users, 
  UserCircle, 
  Truck, 
  Globe, 
  Settings, 
  Calendar,
  ChevronDown,
  ChevronRight,
  Filter,
  LayoutGrid,
  History,
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from 'date-fns';

export interface FilterState {
  compteNumero: string;
  dateDebut: string;
  dateFin: string;
  tiersId?: string;
  journalType: 'TOUS' | 'RESERVATIONS' | 'OD' | 'BANQUE';
  lettrageFilter: 'TOUTES' | 'NON_LETTREES' | 'LETTREES';
  title: string;
}

interface GrandLivreFiltersProps {
  onFilterChange: (filters: FilterState) => void;
  initialFilters?: Partial<FilterState>;
}

type Category = 'tiers' | 'comptes' | 'periode';

export default function GrandLivreFilters({ onFilterChange, initialFilters }: GrandLivreFiltersProps) {
  const [tiers, setTiers] = useState<any[]>([]);
  const [activeCategory, setActiveCategory] = useState<Category>('tiers');
  const [expandedTiersType, setExpandedTiersType] = useState<string | null>('PROPRIETAIRE');
  const [searchTiers, setSearchTiers] = useState('');
  
  const [filters, setFilters] = useState<FilterState>({
    compteNumero: initialFilters?.compteNumero || '404%',
    dateDebut: initialFilters?.dateDebut || format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    dateFin: initialFilters?.dateFin || format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    tiersId: initialFilters?.tiersId,
    journalType: initialFilters?.journalType || 'TOUS',
    lettrageFilter: initialFilters?.lettrageFilter || 'TOUTES',
    title: initialFilters?.title || 'Tous les Propriétaires (404)'
  });

  useEffect(() => {
    if (initialFilters) {
      setFilters(prev => ({ ...prev, ...initialFilters }));
    }
  }, [initialFilters]);

  useEffect(() => {
    fetchTiers();
  }, []);

  async function fetchTiers() {
    const { data, error } = await supabase
      .from('tiers')
      .select('*')
      .order('nom', { ascending: true });
    
    if (error) {
      console.error('Error fetching tiers:', error);
    } else {
      setTiers(data || []);
    }
  }

  const updateFilters = (newFilters: Partial<FilterState>) => {
    const updated = { ...filters, ...newFilters };
    setFilters(updated);
    onFilterChange(updated);
  };

  const handleTiersSelect = (tier: any) => {
    updateFilters({
      compteNumero: tier.code_auxiliaire,
      tiersId: tier.id,
      title: `${tier.nom} (${tier.code_auxiliaire})`
    });
  };

  const setQuickPeriod = (type: string) => {
    const now = new Date();
    let start = startOfMonth(now);
    let end = endOfMonth(now);

    switch (type) {
      case 'prev_month':
        start = startOfMonth(subMonths(now, 1));
        end = endOfMonth(subMonths(now, 1));
        break;
      case 'quarter':
        start = startOfQuarter(now);
        end = endOfQuarter(now);
        break;
      case 'year':
        start = startOfYear(now);
        end = endOfYear(now);
        break;
    }

    updateFilters({
      dateDebut: format(start, 'yyyy-MM-dd'),
      dateFin: format(end, 'yyyy-MM-dd')
    });
  };

  const tiersTypes = [
    { id: 'PROPRIETAIRE', label: 'Propriétaires', icon: <Users className="w-4 h-4" />, color: 'text-blue-600', prefix: '404%' },
    { id: 'VOYAGEUR', label: 'Locataires', icon: <UserCircle className="w-4 h-4" />, color: 'text-emerald-600', prefix: '411%' },
    { id: 'FOURNISSEUR', label: 'Fournisseurs', icon: <Truck className="w-4 h-4" />, color: 'text-orange-600', prefix: '401%' },
    { id: 'PLATEFORME_OTA', label: 'OTA', icon: <Globe className="w-4 h-4" />, color: 'text-indigo-600', prefix: 'OTA%' },
  ];

  const generalAccounts = [
    { code: '512%', label: 'Banque Séquestre (512)' },
    { code: '512100%', label: 'Banque Agence (512100)' },
    { code: '706100', label: 'Honoraires Gestion (706100)' },
    { code: '706200', label: 'Commissions Assur. (706200)' },
    { code: '706300', label: 'Marges Interv. (706300)' },
    { code: '615', label: 'Entretien (615)' },
    { code: '616', label: 'Assurance (616)' },
    { code: '622', label: 'Commissions OTA (622)' },
    { code: '419', label: 'Cautions Locataires (419)' },
    { code: '471', label: 'Compte d\'attente Banque (471)' },
    { code: '467000', label: 'Attente Paiement Ménage (467)' }
  ];

  const filteredTiers = tiers.filter(t => 
    t.type_tiers === expandedTiersType && 
    (t.nom.toLowerCase().includes(searchTiers.toLowerCase()) || 
     t.code_auxiliaire.toLowerCase().includes(searchTiers.toLowerCase()))
  );

  return (
    <div className="w-72 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 bg-blue-50 rounded-lg">
            <Filter className="w-4 h-4 text-blue-600" />
          </div>
          <h2 className="font-bold text-slate-900 text-sm">Filtres</h2>
        </div>

        {/* Category Tabs */}
        <div className="flex p-1 bg-slate-100 rounded-lg mb-4">
          <button 
            onClick={() => setActiveCategory('tiers')}
            className={cn(
              "flex-1 py-1.5 text-[11px] font-medium rounded-md transition-all",
              activeCategory === 'tiers' ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Tiers
          </button>
          <button 
            onClick={() => setActiveCategory('comptes')}
            className={cn(
              "flex-1 py-1.5 text-[11px] font-medium rounded-md transition-all",
              activeCategory === 'comptes' ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Comptes
          </button>
          <button 
            onClick={() => setActiveCategory('periode')}
            className={cn(
              "flex-1 py-1.5 text-[11px] font-medium rounded-md transition-all",
              activeCategory === 'periode' ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Période
          </button>
        </div>

        {activeCategory === 'tiers' && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input 
              placeholder="Rechercher..." 
              className="pl-9 text-xs h-8 bg-slate-50 border-transparent focus:bg-white transition-colors"
              value={searchTiers}
              onChange={(e) => setSearchTiers(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeCategory === 'tiers' && (
          <div className="p-2 space-y-1">
            {tiersTypes.map((type) => (
              <div key={type.id} className="space-y-1">
                <button
                  onClick={() => setExpandedTiersType(expandedTiersType === type.id ? null : type.id)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors",
                    expandedTiersType === type.id ? "bg-slate-50 text-slate-900" : "text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={type.color}>{type.icon}</span>
                    {type.label}
                  </div>
                  {expandedTiersType === type.id ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>
                
                {expandedTiersType === type.id && (
                  <div className="pl-4 pr-1 py-1 space-y-0.5">
                    <Button 
                      variant="ghost" 
                      className={cn(
                        "w-full justify-start text-[11px] h-7 font-normal", 
                        filters.compteNumero === type.prefix && "bg-blue-50 text-blue-700 font-medium"
                      )}
                      onClick={() => updateFilters({ compteNumero: type.prefix, tiersId: undefined, title: `Tous les ${type.label}` })}
                    >
                      Tous les {type.label.toLowerCase()}
                    </Button>
                    <div className="max-h-[300px] overflow-y-auto space-y-0.5 scrollbar-thin">
                      {filteredTiers.map(tier => (
                        <Button 
                          key={tier.id}
                          variant="ghost" 
                          className={cn(
                            "w-full justify-start text-[11px] h-7 font-normal text-left truncate", 
                            filters.compteNumero === tier.code_auxiliaire && "bg-blue-50 text-blue-700 font-medium"
                          )}
                          onClick={() => handleTiersSelect(tier)}
                        >
                          {tier.nom}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeCategory === 'comptes' && (
          <div className="p-2 space-y-1">
            <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Favoris</div>
            {generalAccounts.map(item => (
              <Button 
                key={item.code}
                variant="ghost" 
                className={cn(
                  "w-full justify-start text-xs h-8 px-3 font-normal", 
                  filters.compteNumero === item.code && "bg-slate-100 text-slate-900 font-medium"
                )}
                onClick={() => updateFilters({ compteNumero: item.code, tiersId: undefined, title: item.label })}
              >
                <Settings className="w-3.5 h-3.5 mr-2 text-slate-400" />
                {item.label}
              </Button>
            ))}
            <div className="pt-4 px-3">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Recherche directe</div>
              <Input 
                placeholder="N° de compte..." 
                className="text-xs h-8"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = (e.target as HTMLInputElement).value;
                    if (val) updateFilters({ compteNumero: val, tiersId: undefined, title: `Compte ${val}` });
                  }
                }}
              />
            </div>
          </div>
        )}

        {activeCategory === 'periode' && (
          <div className="p-4 space-y-6">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" /> Date début
                </label>
                <Input 
                  type="date" 
                  className="h-8 text-xs" 
                  value={filters.dateDebut}
                  onChange={(e) => updateFilters({ dateDebut: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" /> Date fin
                </label>
                <Input 
                  type="date" 
                  className="h-8 text-xs" 
                  value={filters.dateFin}
                  onChange={(e) => updateFilters({ dateFin: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <History className="w-3 h-3" /> Raccourcis
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="text-[10px] h-7 px-1 font-normal" onClick={() => setQuickPeriod('month')}>Ce mois</Button>
                <Button variant="outline" className="text-[10px] h-7 px-1 font-normal" onClick={() => setQuickPeriod('prev_month')}>Mois préc.</Button>
                <Button variant="outline" className="text-[10px] h-7 px-1 font-normal" onClick={() => setQuickPeriod('quarter')}>Trimestre</Button>
                <Button variant="outline" className="text-[10px] h-7 px-1 font-normal" onClick={() => setQuickPeriod('year')}>Année</Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <LayoutGrid className="w-3 h-3" /> Journal
              </div>
              <div className="grid grid-cols-1 gap-1">
                {[
                  { id: 'TOUS', label: 'Tous les journaux' },
                  { id: 'RESERVATIONS', label: 'Réservations' },
                  { id: 'OD', label: 'OD' },
                  { id: 'BANQUE', label: 'Banque' }
                ].map(item => (
                  <Button 
                    key={item.id}
                    variant="ghost" 
                    className={cn(
                      "w-full justify-start text-xs h-7 px-2 font-normal", 
                      filters.journalType === item.id && "bg-slate-100 text-slate-900 font-medium"
                    )}
                    onClick={() => updateFilters({ journalType: item.id as any })}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3" /> Lettrage
              </div>
              <div className="grid grid-cols-1 gap-1">
                {[
                  { id: 'TOUTES', label: 'Toutes les écritures' },
                  { id: 'NON_LETTREES', label: 'Non lettrées uniquement' },
                  { id: 'LETTREES', label: 'Lettrées uniquement' }
                ].map(item => (
                  <Button 
                    key={item.id}
                    variant="ghost" 
                    className={cn(
                      "w-full justify-start text-xs h-7 px-2 font-normal", 
                      filters.lettrageFilter === item.id && "bg-slate-100 text-slate-900 font-medium"
                    )}
                    onClick={() => updateFilters({ lettrageFilter: item.id as any })}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Input } from '@/components/Input';
import { Search, User, Landmark, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AccountOption {
  compte_general: string;
  compte_auxiliaire: string | null;
  libelle_compte: string;
  tiers_id: string | null;
  type: 'GENERAL' | 'TIERS';
}

interface CompteSearchSelectProps {
  value: string;
  onChange: (account: AccountOption) => void;
  placeholder?: string;
  disabled?: boolean;
}

const getCompteGeneral = (codeAuxiliaire: string): string => {
  if (!codeAuxiliaire) return '411';
  if (codeAuxiliaire.startsWith('404')) return '404';
  if (codeAuxiliaire.startsWith('401')) return '401';
  if (codeAuxiliaire.startsWith('OTA-')) return '411';
  if (codeAuxiliaire.startsWith('VOY-')) return '411';
  
  const firstThree = codeAuxiliaire.substring(0, 3);
  if (/^\d{3}$/.test(firstThree)) return firstThree;
  
  return '411';
};

export default React.forwardRef<any, CompteSearchSelectProps>(function CompteSearchSelect({ value, onChange, placeholder = "Rechercher un compte...", disabled }, ref) {
  const [searchTerm, setSearchTerm] = useState('');
  const [options, setOptions] = useState<AccountOption[]>([]);
  const [filteredOptions, setFilteredOptions] = useState<AccountOption[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadAccounts();
    
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setSearchTerm(value);
  }, [value]);

  useEffect(() => {
    if (searchTerm.length > 0 && searchTerm !== value) {
      const filtered = options.filter(opt => 
        opt.compte_general.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (opt.compte_auxiliaire && opt.compte_auxiliaire.toLowerCase().includes(searchTerm.toLowerCase())) ||
        opt.libelle_compte.toLowerCase().includes(searchTerm.toLowerCase())
      ).slice(0, 10);
      setFilteredOptions(filtered);
      setIsOpen(true);
    } else {
      setFilteredOptions([]);
      setIsOpen(false);
    }
  }, [searchTerm, options]);

  const loadAccounts = async () => {
    try {
      const [{ data: planData }, { data: tiersData }] = await Promise.all([
        supabase.from('plan_comptable').select('numero, libelle'),
        supabase.from('tiers').select('id, code_auxiliaire, nom')
      ]);

      const generalOptions: AccountOption[] = (planData || []).map(p => ({
        compte_general: p.numero,
        compte_auxiliaire: null,
        libelle_compte: p.libelle,
        tiers_id: null,
        type: 'GENERAL'
      }));

      const tiersOptions: AccountOption[] = (tiersData || []).map(t => ({
        compte_general: getCompteGeneral(t.code_auxiliaire),
        compte_auxiliaire: t.code_auxiliaire,
        libelle_compte: t.nom,
        tiers_id: t.id,
        type: 'TIERS'
      }));

      setOptions([...generalOptions, ...tiersOptions]);
    } catch (error) {
      console.error('Error loading accounts:', error);
    }
  };

  const handleSelect = (opt: AccountOption) => {
    onChange(opt);
    setSearchTerm(opt.compte_auxiliaire || opt.compte_general);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <Input
          ref={ref}
          value={searchTerm || value}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => searchTerm.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="pl-10"
        />
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
      </div>

      {isOpen && filteredOptions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-64 overflow-y-auto">
          {filteredOptions.map((opt, idx) => (
            <button
              key={`${opt.compte_auxiliaire || opt.compte_general}-${idx}`}
              type="button"
              className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-50 text-left transition-colors border-b border-slate-50 last:border-none"
              onClick={() => handleSelect(opt)}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                opt.type === 'TIERS' ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-600"
              )}>
                {opt.type === 'TIERS' ? <User className="h-4 w-4" /> : <Landmark className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  {opt.compte_auxiliaire || opt.compte_general}
                </div>
                <div className="text-xs text-slate-500 truncate">{opt.libelle_compte}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

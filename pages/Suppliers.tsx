import React, { useState, useEffect } from 'react';
import FournisseursList from '@/features/suppliers/components/FournisseursList';
import { ValidationMenagesDashboard } from '@/features/suppliers/components/ValidationMenagesDashboard';
import { ListeFacturesFournisseurs } from '@/features/suppliers/components/ListeFacturesFournisseurs';
import { cn } from '@/lib/utils';
import { Truck, FileCheck, History } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

export default function Suppliers() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'list' | 'validation' | 'history'>((tabParam as any) || 'list');

  useEffect(() => {
    if (tabParam && (tabParam === 'list' || tabParam === 'validation' || tabParam === 'history')) {
      setActiveTab(tabParam as any);
    }
  }, [tabParam]);

  const handleTabChange = (tab: 'list' | 'validation' | 'history') => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  return (
    <div className="space-y-6">
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => handleTabChange('list')}
          className={cn(
            "px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
            activeTab === 'list' 
              ? "border-slate-900 text-slate-900" 
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
          )}
        >
          <Truck className="w-4 h-4" />
          Liste des Fournisseurs
        </button>
        <button
          onClick={() => handleTabChange('validation')}
          className={cn(
            "px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
            activeTab === 'validation' 
              ? "border-slate-900 text-slate-900" 
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
          )}
        >
          <FileCheck className="w-4 h-4" />
          Génération Factures (Ménages)
        </button>
        <button
          onClick={() => handleTabChange('history')}
          className={cn(
            "px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
            activeTab === 'history' 
              ? "border-slate-900 text-slate-900" 
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
          )}
        >
          <History className="w-4 h-4" />
          Historique des Factures
        </button>
      </div>

      <div className="mt-6">
        {activeTab === 'list' && <FournisseursList />}
        {activeTab === 'validation' && <ValidationMenagesDashboard />}
        {activeTab === 'history' && <ListeFacturesFournisseurs />}
      </div>
    </div>
  );
}

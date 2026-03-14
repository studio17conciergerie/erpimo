import React from 'react';
import RapprochementBancaire from '@/features/rapprochement/components/RapprochementBancaire';

export default function Reconciliation() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Rapprochement Bancaire</h1>
        <p className="text-slate-500">Lettrage des mouvements bancaires avec les écritures comptables.</p>
      </div>
      
      <RapprochementBancaire />
    </div>
  );
}

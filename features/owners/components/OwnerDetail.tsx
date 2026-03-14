import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Owner, ownerService } from '../ownerService';
import { OwnerForm } from './OwnerForm';
import { OwnerLedger } from './OwnerLedger';
import { Button } from '@/components/Button';
import { ArrowLeft, User, Home, BookOpen, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/Card';

export default function OwnerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [owner, setOwner] = useState<Owner | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'profile' | 'properties' | 'ledger' | 'documents'>('profile');

  useEffect(() => {
    if (id) fetchData(id);
  }, [id]);

  const fetchData = async (ownerId: string) => {
    try {
      const data = await ownerService.getOwnerById(ownerId);
      setOwner(data);
    } catch (error) {
      console.error('Error fetching owner details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Chargement...</div>;
  if (!owner) return <div className="p-8 text-center">Propriétaire introuvable.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/owners')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{owner.nom} {owner.prenom}</h1>
          <p className="text-slate-500 flex items-center gap-2">
            <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">{owner.code_auxiliaire || 'No Code'}</span>
            • {owner.email || 'Pas d\'email'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('profile')}
            className={cn(
              "whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium flex items-center gap-2",
              activeTab === 'profile'
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            )}
          >
            <User className="h-4 w-4" />
            Profil
          </button>
          <button
            onClick={() => setActiveTab('properties')}
            className={cn(
              "whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium flex items-center gap-2",
              activeTab === 'properties'
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            )}
          >
            <Home className="h-4 w-4" />
            Logements
          </button>
          <button
            onClick={() => setActiveTab('ledger')}
            className={cn(
              "whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium flex items-center gap-2",
              activeTab === 'ledger'
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            )}
          >
            <BookOpen className="h-4 w-4" />
            Grand Livre
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={cn(
              "whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium flex items-center gap-2",
              activeTab === 'documents'
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            )}
          >
            <FileText className="h-4 w-4" />
            Relevés & Documents
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
        {activeTab === 'profile' && (
          <div className="max-w-2xl">
            <OwnerForm 
              owner={owner} 
              onSuccess={() => fetchData(owner.id)} 
            />
          </div>
        )}

        {activeTab === 'properties' && (
          <div className="space-y-4">
             {owner.logements && (owner.logements as any).length > 0 ? (
               <div className="rounded-md border border-slate-200 overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 font-medium">
                    <tr>
                      <th className="px-4 py-3">Nom du bien</th>
                      <th className="px-4 py-3">Adresse</th>
                      <th className="px-4 py-3">Statut</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {(owner.logements as any).map((logement: any) => (
                      <tr key={logement.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium">{logement.nom}</td>
                        <td className="px-4 py-3 text-slate-600">{logement.adresse || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            "px-2 py-1 rounded-full text-xs font-medium border",
                            logement.statut === 'ACTIF' && "bg-emerald-50 text-emerald-700 border-emerald-200",
                            logement.statut === 'INACTIF' && "bg-slate-100 text-slate-500 border-slate-200",
                            logement.statut === 'MAINTENANCE' && "bg-amber-50 text-amber-700 border-amber-200",
                          )}>
                            {logement.statut}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => navigate(`/properties/${logement.id}`)}
                          >
                            Voir
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
             ) : (
               <div className="text-center py-8 text-slate-500">Aucun logement associé.</div>
             )}
          </div>
        )}

        {activeTab === 'ledger' && (
          <OwnerLedger ownerId={owner.id} codeAuxiliaire={owner.code_auxiliaire} />
        )}

        {activeTab === 'documents' && (
          <div className="text-center py-12 text-slate-500">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>Le module de gestion documentaire sera disponible prochainement.</p>
          </div>
        )}
      </div>
    </div>
  );
}

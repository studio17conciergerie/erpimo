import React, { useEffect, useState } from 'react';
import { Tiers, tiersService } from '../tiersService';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import { Plus, Search, Trash2, Edit, User, Briefcase, Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TiersForm } from './TiersForm';

export default function TiersList() {
  const [tiersList, setTiersList] = useState<Tiers[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  
  const [showModal, setShowModal] = useState(false);
  const [editingTiers, setEditingTiers] = useState<Tiers | undefined>(undefined);

  useEffect(() => {
    fetchTiers();
  }, []);

  const fetchTiers = async () => {
    setLoading(true);
    try {
      const data = await tiersService.getTiers();
      setTiersList(data || []);
    } catch (error) {
      console.error('Error fetching tiers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (tiers: Tiers) => {
    setEditingTiers(tiers);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce tiers ?')) {
      try {
        await tiersService.deleteTiers(id);
        fetchTiers();
      } catch (error) {
        console.error('Error deleting tiers:', error);
        alert('Impossible de supprimer ce tiers (probablement lié à des écritures ou logements).');
      }
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTiers(undefined);
  };

  const filteredTiers = tiersList.filter(t => {
    const matchesSearch = 
      t.nom.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (t.prenom && t.prenom.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.code_auxiliaire && t.code_auxiliaire.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesType = typeFilter === 'ALL' || t.type_tiers === typeFilter;
    
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Répertoire des Tiers</h2>
          <p className="text-sm text-slate-500">Gérez tous les contacts (Fournisseurs, Propriétaires, Locataires).</p>
        </div>
        <Button onClick={() => setShowModal(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Nouveau Tiers
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Rechercher par nom, code..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-[200px]">
              <select 
                className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="ALL">Tous les types</option>
                <option value="FOURNISSEUR">Fournisseurs</option>
                <option value="PROPRIETAIRE">Propriétaires</option>
                <option value="LOCATAIRE">Locataires</option>
                <option value="SYSTEME">Système</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-slate-200 overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-medium">
                <tr>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Nom / Raison Sociale</th>
                  <th className="px-4 py-3">Code Aux.</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">Chargement...</td>
                  </tr>
                ) : filteredTiers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">Aucun tiers trouvé.</td>
                  </tr>
                ) : (
                  filteredTiers.map((tiers) => (
                    <tr key={tiers.id} className="hover:bg-slate-50 group">
                      <td className="px-4 py-3">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border",
                          tiers.type_tiers === 'PROPRIETAIRE' && "bg-purple-50 text-purple-700 border-purple-200",
                          tiers.type_tiers === 'FOURNISSEUR' && "bg-blue-50 text-blue-700 border-blue-200",
                          tiers.type_tiers === 'LOCATAIRE' && "bg-emerald-50 text-emerald-700 border-emerald-200",
                          tiers.type_tiers === 'SYSTEME' && "bg-slate-100 text-slate-600 border-slate-200",
                        )}>
                          {tiers.type_tiers === 'PROPRIETAIRE' && <Home className="h-3 w-3" />}
                          {tiers.type_tiers === 'FOURNISSEUR' && <Briefcase className="h-3 w-3" />}
                          {tiers.type_tiers === 'LOCATAIRE' && <User className="h-3 w-3" />}
                          {tiers.type_tiers}
                          {tiers.sous_type && <span className="text-slate-400 mx-1">|</span>}
                          {tiers.sous_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {tiers.nom} {tiers.prenom}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">
                        {tiers.code_auxiliaire || '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <div className="flex flex-col">
                          <span>{tiers.email}</span>
                          <span className="text-xs text-slate-400">{tiers.telephone}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(tiers)}>
                            <Edit className="h-4 w-4 text-slate-500" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(tiers.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-xl font-bold">{editingTiers ? 'Modifier Tiers' : 'Nouveau Tiers'}</h2>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>
            <div className="p-6">
              <TiersForm 
                tiers={editingTiers}
                onSuccess={() => {
                  handleCloseModal();
                  fetchTiers();
                }}
                onCancel={handleCloseModal}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

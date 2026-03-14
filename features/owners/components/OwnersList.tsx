import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Owner, ownerService } from '../ownerService';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Card, CardContent, CardHeader } from '@/components/Card';
import { Plus, Search, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OwnerForm } from './OwnerForm';

export default function OwnersList() {
  const navigate = useNavigate();
  const [owners, setOwners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const data = await ownerService.getOwners();
      setOwners(data || []);
    } catch (error) {
      console.error('Error fetching owners:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredOwners = owners.filter(o => {
    const searchLower = searchTerm.toLowerCase();
    return (
      o.nom.toLowerCase().includes(searchLower) ||
      (o.prenom && o.prenom.toLowerCase().includes(searchLower)) ||
      (o.email && o.email.toLowerCase().includes(searchLower)) ||
      (o.code_auxiliaire && o.code_auxiliaire.toLowerCase().includes(searchLower))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Propriétaires</h1>
          <p className="text-slate-500">Gestion des propriétaires mandants.</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Nouveau Propriétaire
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Rechercher par nom, email ou code..."
              className="pl-9 max-w-md"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-slate-200 overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-medium">
                <tr>
                  <th className="px-4 py-3">Nom Complet</th>
                  <th className="px-4 py-3">Code Comptable</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3 text-center">Logements</th>
                  <th className="px-4 py-3 text-center">IBAN</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">Chargement...</td>
                  </tr>
                ) : filteredOwners.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">Aucun propriétaire trouvé.</td>
                  </tr>
                ) : (
                  filteredOwners.map((owner) => (
                    <tr 
                      key={owner.id} 
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/owners/${owner.id}`)}
                    >
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {owner.nom} {owner.prenom}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600">
                        {owner.code_auxiliaire || '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {owner.email || '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center bg-slate-100 text-slate-700 font-medium rounded-full h-6 w-6 text-xs">
                          {owner.logements_count}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {owner.iban ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle className="h-3 w-3" /> Oui
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                            <XCircle className="h-3 w-3" /> Non
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-xl font-bold">Nouveau Propriétaire</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>
            <div className="p-6">
              <OwnerForm 
                onSuccess={() => {
                  setShowCreateModal(false);
                  fetchData();
                }}
                onCancel={() => setShowCreateModal(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

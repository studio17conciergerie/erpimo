import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Property, propertyService } from '../propertyService';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import { Plus, Search, Home, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PropertyForm } from './PropertyForm';

export default function PropertiesList() {
  const navigate = useNavigate();
  const [properties, setProperties] = useState<Property[]>([]);
  const [owners, setOwners] = useState<{ id: string; nom: string; prenom: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [propsData, ownersData] = await Promise.all([
        propertyService.getProperties(),
        propertyService.getOwners()
      ]);
      setProperties(propsData);
      setOwners(ownersData || []);
    } catch (error) {
      console.error('Error fetching properties:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProperties = properties.filter(p => {
    const matchesSearch = 
      p.nom.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (p.nickname && p.nickname.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.listing_id && p.listing_id.includes(searchTerm));
    
    const matchesOwner = ownerFilter ? p.proprietaire_id === ownerFilter : true;
    
    return matchesSearch && matchesOwner;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Logements</h1>
          <p className="text-slate-500">Gérez votre parc immobilier et les règles financières.</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Nouveau Logement
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Rechercher par nom, surnom ou ID..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-[200px]">
              <select 
                className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={ownerFilter}
                onChange={(e) => setOwnerFilter(e.target.value)}
              >
                <option value="">Tous les propriétaires</option>
                {owners.map(o => (
                  <option key={o.id} value={o.id}>{o.nom} {o.prenom}</option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-slate-200 overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-medium">
                <tr>
                  <th className="px-4 py-3">Logement</th>
                  <th className="px-4 py-3">Propriétaire</th>
                  <th className="px-4 py-3">Listing ID</th>
                  <th className="px-4 py-3">Commission</th>
                  <th className="px-4 py-3">Ménage</th>
                  <th className="px-4 py-3">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">Chargement...</td>
                  </tr>
                ) : filteredProperties.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">Aucun logement trouvé.</td>
                  </tr>
                ) : (
                  filteredProperties.map((property) => (
                    <tr 
                      key={property.id} 
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/properties/${property.id}`)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{property.nom}</div>
                        {property.nickname && <div className="text-xs text-slate-500 font-mono">{property.nickname}</div>}
                      </td>
                      <td className="px-4 py-3">
                        {property.tiers?.nom} {property.tiers?.prenom}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600">
                        {property.listing_id || '-'}
                      </td>
                      <td className="px-4 py-3">
                        {property.regles_financieres_logement?.taux_commission_agence 
                          ? `${property.regles_financieres_logement.taux_commission_agence}%` 
                          : '-'}
                      </td>
                      <td className="px-4 py-3">
                        {property.regles_financieres_logement?.forfait_menage 
                          ? `${property.regles_financieres_logement.forfait_menage}€` 
                          : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "px-2 py-1 rounded-full text-xs font-medium border",
                          property.statut === 'ACTIF' && "bg-emerald-50 text-emerald-700 border-emerald-200",
                          property.statut === 'INACTIF' && "bg-slate-100 text-slate-500 border-slate-200",
                          property.statut === 'MAINTENANCE' && "bg-amber-50 text-amber-700 border-amber-200",
                        )}>
                          {property.statut}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create Modal (Simple overlay for now) */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-xl font-bold">Nouveau Logement</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>
            <div className="p-6">
              <PropertyForm 
                owners={owners} 
                onSuccess={() => {
                  setShowCreateModal(false);
                  fetchData();
                }} 
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

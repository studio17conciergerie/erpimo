import React, { useEffect, useState } from 'react';
import { travelerService, Traveler } from '../travelerService';
import { Button } from '@/components/Button';
import { Card, CardContent } from '@/components/Card';
import { Search, UserPlus, User, Mail, Phone, ShieldAlert, Star, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export default function LocatairesList() {
  const [travelers, setTravelers] = useState<Traveler[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchTravelers();
  }, []);

  const fetchTravelers = async () => {
    try {
      const data = await travelerService.getTravelers();
      setTravelers(data);
    } catch (error) {
      console.error('Error fetching travelers:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTravelers = travelers.filter(t => {
    const searchLower = searchTerm.toLowerCase();
    return (
      t.nom.toLowerCase().includes(searchLower) ||
      (t.prenom?.toLowerCase() || '').includes(searchLower) ||
      (t.email?.toLowerCase() || '').includes(searchLower) ||
      (t.telephone || '').includes(searchLower) ||
      (t.code_auxiliaire?.toLowerCase() || '').includes(searchLower)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Locataires</h1>
          <p className="text-slate-500">Gérez votre base de données voyageurs et leur historique.</p>
        </div>
        <Button className="flex items-center gap-2">
          <UserPlus className="h-4 w-4" />
          Nouveau Locataire
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher un locataire (nom, email, téléphone, code...)"
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-12 text-slate-500">Chargement des locataires...</div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium border-bottom border-slate-200">
              <tr>
                <th className="px-6 py-4">Locataire</th>
                <th className="px-6 py-4">Code CRM</th>
                <th className="px-6 py-4">Séjours</th>
                <th className="px-6 py-4">Contact</th>
                <th className="px-6 py-4">Statut</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredTravelers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    Aucun locataire trouvé.
                  </td>
                </tr>
              ) : (
                filteredTravelers.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "h-10 w-10 rounded-full flex items-center justify-center text-lg font-bold",
                          t.is_blacklisted ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-700"
                        )}>
                          {t.nom.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-2">
                            {t.prenom} {t.nom}
                            {t.is_blacklisted && <ShieldAlert className="h-3.5 w-3.5 text-red-500" />}
                          </div>
                          <div className="text-xs text-slate-500">{t.nationalite || 'Nationalité non renseignée'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <code className="bg-slate-100 px-2 py-0.5 rounded text-xs font-mono text-slate-600">
                        {t.code_auxiliaire || 'NON-GENERE'}
                      </code>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{t.reservations_count}</span>
                        <span className="text-slate-500 text-xs">séjours</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {t.email && (
                          <div className="flex items-center gap-2 text-xs text-slate-600">
                            <Mail className="h-3 w-3" /> {t.email}
                          </div>
                        )}
                        {t.telephone && (
                          <div className="flex items-center gap-2 text-xs text-slate-600">
                            <Phone className="h-3 w-3" /> {t.telephone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {t.is_blacklisted ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                          BLACKLISTÉ
                        </span>
                      ) : t.reservations_count && t.reservations_count > 5 ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">
                          <Star className="h-3 w-3 mr-1 fill-amber-500" /> VIP
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200">
                          STANDARD
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link to={`/tenants/${t.id}`}>
                        <Button variant="ghost" size="sm" className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50">
                          Voir Fiche <ExternalLink className="ml-2 h-3 w-3" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

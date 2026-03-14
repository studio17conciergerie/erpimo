import React, { useState, useEffect } from 'react';
import { suppliersApi, Supplier } from '../suppliersApi';
import { Card, CardContent } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { 
  Plus, 
  Search, 
  Building2, 
  CreditCard, 
  CheckCircle2, 
  XCircle,
  ChevronRight,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import NewFournisseurModal from './NewFournisseurModal';

export default function FournisseursList() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    loadSuppliers();
  }, []);

  async function loadSuppliers() {
    setLoading(true);
    setError(null);
    try {
      const data = await suppliersApi.getFournisseursAvecSolde();
      setSuppliers(data);
    } catch (err: any) {
      console.error('Error loading suppliers:', err);
      setError(err.message || 'Une erreur est survenue lors du chargement des fournisseurs');
    } finally {
      setLoading(false);
    }
  }

  const filteredSuppliers = suppliers.filter(s => 
    s.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.code_auxiliaire.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestion des Fournisseurs</h1>
          <p className="text-slate-500 text-sm">Suivi des comptes 401, factures et règlements</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="gap-2 bg-slate-900 hover:bg-slate-800">
          <Plus className="w-4 h-4" />
          Nouveau Fournisseur
        </Button>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardContent className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Rechercher un fournisseur..." 
              className="pl-9 h-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-[10px] uppercase font-bold text-slate-500 tracking-wider">Nom fournisseur</th>
                <th className="px-6 py-4 text-[10px] uppercase font-bold text-slate-500 tracking-wider">Code comptable</th>
                <th className="px-6 py-4 text-[10px] uppercase font-bold text-slate-500 tracking-wider">IBAN</th>
                <th className="px-6 py-4 text-right text-[10px] uppercase font-bold text-slate-500 tracking-wider">Solde dû</th>
                <th className="px-6 py-4 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-2" />
                    <p className="text-slate-500">Chargement des fournisseurs...</p>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <AlertCircle className="w-12 h-12 mx-auto text-rose-300 mb-4" />
                    <p className="text-rose-600 font-medium">{error}</p>
                    <Button variant="outline" onClick={loadSuppliers} className="mt-4">Réessayer</Button>
                  </td>
                </tr>
              ) : filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <Building2 className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-500 font-medium">Aucun fournisseur trouvé</p>
                    <Button variant="link" onClick={() => setIsModalOpen(true)}>Ajouter votre premier fournisseur</Button>
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map((supplier) => (
                  <tr 
                    key={supplier.id} 
                    className="hover:bg-slate-50 transition-colors cursor-pointer group"
                    onClick={() => navigate(`/suppliers/${supplier.id}`)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-white transition-colors">
                          <Building2 className="w-4 h-4 text-slate-600" />
                        </div>
                        <span className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {supplier.nom} {supplier.prenom}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded">
                        {supplier.code_auxiliaire}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {supplier.iban ? (
                        <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>OK</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-rose-500 text-xs font-medium">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Manquant</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={cn(
                        "text-sm font-bold font-mono",
                        supplier.solde > 0 ? "text-rose-600" : "text-emerald-600"
                      )}>
                        {formatCurrency(supplier.solde)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-400 group-hover:translate-x-1 transition-all" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <NewFournisseurModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={loadSuppliers} 
      />
    </div>
  );
}

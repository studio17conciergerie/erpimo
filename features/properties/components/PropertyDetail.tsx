import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Property, propertyService } from '../propertyService';
import { PropertyForm } from './PropertyForm';
import { FinancialRulesForm } from './FinancialRulesForm';
import { Button } from '@/components/Button';
import { ArrowLeft, Home, FileText, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [property, setProperty] = useState<Property | null>(null);
  const [owners, setOwners] = useState<{ id: string; nom: string; prenom: string | null }[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; nom: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'info' | 'financial' | 'bookings'>('info');

  useEffect(() => {
    if (id) fetchData(id);
  }, [id]);

  const fetchData = async (propId: string) => {
    try {
      const [propData, ownersData, suppliersData] = await Promise.all([
        propertyService.getPropertyById(propId),
        propertyService.getOwners(),
        propertyService.getSuppliers()
      ]);
      setProperty(propData);
      setOwners(ownersData || []);
      setSuppliers(suppliersData || []);
    } catch (error) {
      console.error('Error fetching property details:', error);
      // navigate('/properties'); // Redirect if not found?
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Chargement...</div>;
  if (!property) return <div className="p-8 text-center">Logement introuvable.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/properties')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{property.nom}</h1>
          <p className="text-slate-500 flex items-center gap-2">
            <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">{property.listing_id || 'No ID'}</span>
            • {property.tiers?.nom} {property.tiers?.prenom}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('info')}
            className={cn(
              "whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium flex items-center gap-2",
              activeTab === 'info'
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            )}
          >
            <Home className="h-4 w-4" />
            Informations
          </button>
          <button
            onClick={() => setActiveTab('financial')}
            className={cn(
              "whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium flex items-center gap-2",
              activeTab === 'financial'
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            )}
          >
            <FileText className="h-4 w-4" />
            Business Model
          </button>
          <button
            onClick={() => setActiveTab('bookings')}
            className={cn(
              "whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium flex items-center gap-2",
              activeTab === 'bookings'
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            )}
          >
            <Calendar className="h-4 w-4" />
            Réservations
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
        {activeTab === 'info' && (
          <PropertyForm 
            property={property} 
            owners={owners} 
            onSuccess={() => fetchData(property.id)} 
          />
        )}

        {activeTab === 'financial' && (
          <FinancialRulesForm 
            logementId={property.id}
            rules={property.regles_financieres_logement}
            suppliers={suppliers}
            onSuccess={() => fetchData(property.id)}
          />
        )}

        {activeTab === 'bookings' && (
          <div className="text-center py-12 text-slate-500">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>Le module de réservations sera disponible prochainement.</p>
          </div>
        )}
      </div>
    </div>
  );
}

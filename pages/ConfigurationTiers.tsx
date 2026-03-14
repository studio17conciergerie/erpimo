import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import { seedTiersSysteme } from '@/lib/seedTiersSysteme';
import { CheckCircle, AlertCircle, RefreshCw, Database, Users } from 'lucide-react';
import TiersList from '@/features/configuration/components/TiersList';

export default function ConfigurationTiers() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleReset = async () => {
    if (!window.confirm("Attention : Cette action va réinitialiser les tiers système (Airbnb, Booking, etc.) et le plan comptable par défaut. Continuer ?")) {
      return;
    }

    setLoading(true);
    setStatus('idle');
    try {
      await seedTiersSysteme();
      setStatus('success');
      setMessage('Tiers système et plan comptable réinitialisés avec succès.');
    } catch (error: any) {
      console.error('Seed error:', error);
      setStatus('error');
      setMessage(`Erreur : ${error.message || 'Une erreur est survenue.'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Configuration</h1>
        <p className="text-slate-500">Paramètres généraux, tiers et comptabilité.</p>
      </div>

      {/* Tiers List Section */}
      <TiersList />

      {/* System Actions Section */}
      <Card className="border-slate-200 bg-slate-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-700">
            <Database className="h-5 w-5" />
            Actions Système
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="text-sm text-slate-600 max-w-xl">
              <p className="font-medium text-slate-900 mb-1">Réinitialisation des Tiers Système</p>
              <p>
                Cette action va recréer les tiers indispensables (Airbnb, Booking, URSSAF...) et le plan comptable de base s'ils sont manquants.
                Utile lors de la première installation ou en cas de problème de configuration.
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={handleReset} 
              disabled={loading}
              className="border-slate-300 hover:bg-white min-w-[200px]"
            >
              {loading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Traitement...
                </>
              ) : (
                'Réinitialiser Tiers Système'
              )}
            </Button>
          </div>

          {status === 'success' && (
            <div className="mt-4 p-3 bg-emerald-100 text-emerald-800 rounded-md flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4" />
              {message}
            </div>
          )}

          {status === 'error' && (
            <div className="mt-4 p-3 bg-red-100 text-red-800 rounded-md flex items-center gap-2 text-sm">
              <AlertCircle className="h-4 w-4" />
              {message}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

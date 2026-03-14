import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '@/lib/supabaseClient';
import { format, startOfMonth, endOfMonth, subMonths, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { Loader2, AlertTriangle, ArrowRight, Wallet, Building2, Users, CreditCard, TrendingUp, CheckCircle2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>({
    caMois: 0,
    resCount: 0,
    soldeSequestre: 0,
    ecartHoguet: 0,
    solde471: 0,
    alerts: {
      bankUnreconciled: 0,
      propWithoutIban: 0,
      unpaidSuppliers: 0,
      draftReservations: 0
    },
    chartData: [],
    latestPieces: []
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    setLoading(true);
    try {
      const now = new Date();
      const currentMonthStart = format(startOfMonth(now), 'yyyy-MM-dd');
      const currentMonthEnd = format(endOfMonth(now), 'yyyy-MM-dd');
      const twelveMonthsAgo = format(startOfMonth(subMonths(now, 11)), 'yyyy-MM-dd');
      const sevenDaysAgo = format(subDays(now, 7), 'yyyy-MM-dd');
      const thirtyDaysAgo = format(subDays(now, 30), 'yyyy-MM-dd');
      const threeDaysAgo = format(subDays(now, 3), 'yyyy-MM-dd');

      // 1. CA Agence (Mois en cours)
      const { data: caData } = await supabase
        .from('journal_ecritures')
        .select('montant, compte_credit, compte_debit')
        .gte('date_ecriture', currentMonthStart)
        .lte('date_ecriture', currentMonthEnd)
        .or('compte_credit.ilike.706%,compte_debit.ilike.706%');

      let caMois = 0;
      caData?.forEach(row => {
        if (row.compte_credit?.startsWith('706')) caMois += Number(row.montant);
        if (row.compte_debit?.startsWith('706')) caMois -= Number(row.montant);
      });

      // 2. Réservations du mois
      const { count: resCount } = await supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', currentMonthStart)
        .lte('created_at', currentMonthEnd);

      // 3 & 4. Solde Séquestre & Contrôle Hoguet & Solde 471
      const { data: balanceData } = await supabase
        .from('journal_ecritures')
        .select('montant, compte_debit, compte_credit')
        .or('compte_debit.ilike.512000%,compte_credit.ilike.512000%,compte_debit.ilike.404%,compte_credit.ilike.404%,compte_debit.ilike.401%,compte_credit.ilike.401%,compte_debit.ilike.419%,compte_credit.ilike.419%,compte_debit.ilike.471%,compte_credit.ilike.471%');

      let soldeSequestre = 0;
      let sumTiers = 0;
      let solde471 = 0;

      balanceData?.forEach(row => {
        const montant = Number(row.montant);
        if (row.compte_debit?.startsWith('512000')) soldeSequestre += montant;
        if (row.compte_credit?.startsWith('512000')) soldeSequestre -= montant;

        if (row.compte_credit?.match(/^(404|401|419|471)/)) sumTiers += montant;
        if (row.compte_debit?.match(/^(404|401|419|471)/)) sumTiers -= montant;

        if (row.compte_credit?.startsWith('471')) solde471 += montant;
        if (row.compte_debit?.startsWith('471')) solde471 -= montant;
      });

      const ecartHoguet = soldeSequestre - sumTiers;

      // 5. Mouvements bancaires non rapprochés > 7 jours
      const { count: bankCount } = await supabase
        .from('mouvements_bancaires')
        .select('*', { count: 'exact', head: true })
        .is('rapproche_le', null)
        .lt('date_mouvement', sevenDaysAgo);

      // 6. Propriétaires sans IBAN
      const { count: propCount } = await supabase
        .from('tiers')
        .select('*', { count: 'exact', head: true })
        .eq('type_tiers', 'PROPRIETAIRE')
        .or('iban.is.null,iban.eq.');

      // 7. Fournisseurs impayés > 30 jours
      const { count: unpaidCount } = await supabase
        .from('journal_ecritures')
        .select('*', { count: 'exact', head: true })
        .ilike('compte_credit', '401%')
        .is('lettrage', null)
        .lt('date_ecriture', thirtyDaysAgo);

      // 8. Réservations BROUILLON > 3 jours
      const { count: draftCount } = await supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('statut_workflow', 'BROUILLON')
        .lt('created_at', threeDaysAgo);

      // 9. CA agence par mois (12 derniers mois)
      const { data: caHistoryData } = await supabase
        .from('journal_ecritures')
        .select('montant, compte_credit, compte_debit, date_ecriture')
        .gte('date_ecriture', twelveMonthsAgo)
        .or('compte_credit.ilike.706%,compte_debit.ilike.706%');

      const monthlyDataMap = new Map();
      for (let i = 11; i >= 0; i--) {
        const d = subMonths(now, i);
        const key = format(d, 'yyyy-MM');
        monthlyDataMap.set(key, { 
          name: format(d, 'MMM', { locale: fr }), 
          ca: 0,
          sortKey: key
        });
      }

      caHistoryData?.forEach(row => {
        const monthKey = row.date_ecriture.substring(0, 7);
        if (monthlyDataMap.has(monthKey)) {
          const current = monthlyDataMap.get(monthKey);
          if (row.compte_credit?.startsWith('706')) current.ca += Number(row.montant);
          if (row.compte_debit?.startsWith('706')) current.ca -= Number(row.montant);
        }
      });

      const chartData = Array.from(monthlyDataMap.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey));

      // 10. 5 dernières pièces comptables créées
      const { data: latestPieces } = await supabase
        .from('pieces_comptables')
        .select('id, numero_piece, libelle_piece, date_piece, journal_code, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      setData({
        caMois,
        resCount: resCount || 0,
        soldeSequestre,
        ecartHoguet,
        solde471,
        alerts: {
          bankUnreconciled: bankCount || 0,
          propWithoutIban: propCount || 0,
          unpaidSuppliers: unpaidCount || 0,
          draftReservations: draftCount || 0
        },
        chartData,
        latestPieces: latestPieces || []
      });

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Tableau de Bord</h1>
      
      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link to="/accounting/grand-livre?compte=706" className="block transition-transform hover:scale-[1.02]">
          <Card className="border-l-4 border-l-blue-500 shadow-sm h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider">CA Agence (Mois)</CardTitle>
              <TrendingUp className="w-4 h-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{formatCurrency(data.caMois)}</div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/reservations" className="block transition-transform hover:scale-[1.02]">
          <Card className="border-l-4 border-l-violet-500 shadow-sm h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider">Réservations (Mois)</CardTitle>
              <Users className="w-4 h-4 text-violet-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{data.resCount}</div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/accounting/balance" className="block transition-transform hover:scale-[1.02]">
          <Card className="border-l-4 border-l-emerald-500 shadow-sm h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider">Solde Séquestre</CardTitle>
              <Wallet className="w-4 h-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{formatCurrency(data.soldeSequestre)}</div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/accounting/balance" className="block transition-transform hover:scale-[1.02]">
          <Card className={cn(
            "border-l-4 shadow-sm h-full",
            data.ecartHoguet >= 0 ? "border-l-emerald-500" : "border-l-rose-500"
          )}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider">Contrôle Hoguet</CardTitle>
              {data.ecartHoguet >= 0 ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertTriangle className="w-4 h-4 text-rose-500" />}
            </CardHeader>
            <CardContent>
              <div className={cn(
                "text-2xl font-bold",
                data.ecartHoguet >= 0 ? "text-emerald-600" : "text-rose-600"
              )}>
                {formatCurrency(data.ecartHoguet)}
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Alertes Opérationnelles */}
      <Card className="border-rose-200 bg-rose-50/30 shadow-sm">
        <CardHeader className="pb-3 border-b border-rose-100">
          <CardTitle className="flex items-center gap-2 text-rose-800">
            <AlertTriangle className="w-5 h-5" />
            Alertes Opérationnelles
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-rose-100">
            {data.alerts.bankUnreconciled > 0 && (
              <Link to="/reconciliation" className="flex items-center justify-between p-4 hover:bg-rose-50 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-rose-100 text-rose-600 rounded-full">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 group-hover:text-rose-700 transition-colors">Mouvements bancaires non rapprochés {'>'} 7 jours</p>
                    <p className="text-sm text-slate-500">Nécessite votre attention pour la clôture</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-rose-600">{data.alerts.bankUnreconciled}</span>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-rose-600 transition-colors" />
                </div>
              </Link>
            )}

            {Math.abs(data.solde471) > 0.01 && (
              <Link to="/accounting/grand-livre?compte=471" className="flex items-center justify-between p-4 hover:bg-rose-50 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-rose-100 text-rose-600 rounded-full">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 group-hover:text-rose-700 transition-colors">Solde 471 (Compte d'attente) non nul</p>
                    <p className="text-sm text-slate-500">Des écritures doivent être réaffectées</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-rose-600">{formatCurrency(data.solde471)}</span>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-rose-600 transition-colors" />
                </div>
              </Link>
            )}

            {data.alerts.propWithoutIban > 0 && (
              <Link to="/properties" className="flex items-center justify-between p-4 hover:bg-rose-50 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-rose-100 text-rose-600 rounded-full">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 group-hover:text-rose-700 transition-colors">Propriétaires sans IBAN renseigné</p>
                    <p className="text-sm text-slate-500">Bloquant pour les redditions</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-rose-600">{data.alerts.propWithoutIban}</span>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-rose-600 transition-colors" />
                </div>
              </Link>
            )}

            {data.alerts.unpaidSuppliers > 0 && (
              <Link to="/suppliers" className="flex items-center justify-between p-4 hover:bg-rose-50 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-rose-100 text-rose-600 rounded-full">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 group-hover:text-rose-700 transition-colors">Fournisseurs impayés {'>'} 30 jours</p>
                    <p className="text-sm text-slate-500">Factures en attente de règlement</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-rose-600">{data.alerts.unpaidSuppliers}</span>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-rose-600 transition-colors" />
                </div>
              </Link>
            )}

            {data.alerts.draftReservations > 0 && (
              <Link to="/reservations" className="flex items-center justify-between p-4 hover:bg-rose-50 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-rose-100 text-rose-600 rounded-full">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 group-hover:text-rose-700 transition-colors">Réservations BROUILLON {'>'} 3 jours</p>
                    <p className="text-sm text-slate-500">En attente de validation comptable</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-rose-600">{data.alerts.draftReservations}</span>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-rose-600 transition-colors" />
                </div>
              </Link>
            )}

            {data.alerts.bankUnreconciled === 0 && Math.abs(data.solde471) < 0.01 && data.alerts.propWithoutIban === 0 && data.alerts.unpaidSuppliers === 0 && data.alerts.draftReservations === 0 && (
              <div className="p-6 text-center text-emerald-600 font-medium flex items-center justify-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                Aucune alerte opérationnelle. Tout est à jour !
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 shadow-sm">
          <CardHeader>
            <CardTitle>CA Agence (12 derniers mois)</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="name" 
                    stroke="#64748b" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis 
                    stroke="#64748b" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(value) => `${value}€`} 
                  />
                  <Tooltip 
                    cursor={{fill: '#f1f5f9'}}
                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                    formatter={(value: number) => [formatCurrency(value), 'CA Agence']}
                  />
                  <Bar dataKey="ca" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3 shadow-sm">
          <CardHeader>
            <CardTitle>Dernières opérations comptables</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.latestPieces.length === 0 ? (
                <p className="text-sm text-slate-500 italic text-center py-4">Aucune opération récente</p>
              ) : (
                data.latestPieces.map((piece: any) => (
                  <Link 
                    key={piece.id} 
                    to={`/accounting/piece/${piece.id}`}
                    className="flex items-center p-3 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200 group"
                  >
                    <div className="ml-2 space-y-1 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium leading-none text-slate-900 group-hover:text-blue-600 transition-colors">
                          {piece.libelle_piece}
                        </p>
                        <span className="text-[10px] font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-500">
                          {piece.numero_piece}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {format(new Date(piece.created_at), 'dd/MM/yyyy HH:mm')} • Journal {piece.journal_code}
                      </p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


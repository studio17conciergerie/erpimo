# Traçabilité Voyageur ↔ OTA ↔ Rapprochement Bancaire
## Logique d'articulation entre le payeur réel et le créancier comptable

---

## 1. Le Problème Fondamental : Qui Paie Quoi ?

En location saisonnière gérée par une conciergerie, il y a **deux relations de paiement distinctes** selon le canal :

```
CAS 1 — Réservation via OTA (Airbnb, Booking)
══════════════════════════════════════════════

  Le voyageur paie → Airbnb (la plateforme encaisse)
  Airbnb paie     → L'agence (payout net sur le séquestre)

  Le DÉBITEUR COMPTABLE de l'agence = AIRBNB (pas le voyageur)
  Le voyageur n'a aucun lien financier direct avec l'agence


CAS 2 — Réservation directe (site web, téléphone)
══════════════════════════════════════════════════

  Le voyageur paie → L'agence (virement direct sur le séquestre)

  Le DÉBITEUR COMPTABLE de l'agence = LE VOYAGEUR lui-même
```

Le code actuel ne fait pas cette distinction. Il utilise un compte `411` générique pour tout le monde, sans `tiers_id` cohérent. Résultat : on ne sait pas qui doit de l'argent à l'agence, et on ne peut pas rapprocher un virement bancaire avec le bon débiteur.

---

## 2. Analyse du Code Actuel

### 2.1 Les briques existantes (mais non connectées)

Le système a déjà presque tout ce qu'il faut, mais les pièces ne sont pas assemblées :

```
┌─────────────────────────────────────────────────────────────┐
│  TABLE tiers (type_tiers = 'PLATEFORME_OTA')                │
│                                                             │
│  • Airbnb       code_auxiliaire: OTA-AIRBNB                 │
│  • Booking.com  code_auxiliaire: OTA-BOOKING                │
│  • VRBO         code_auxiliaire: OTA-VRBO                   │
│  • Direct       code_auxiliaire: OTA-DIRECT                 │
│                                                             │
│  → Existent en base (seedTiersSysteme.ts)                   │
│  → JAMAIS UTILISÉS dans le moteur comptable                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  TABLE ota_source_mapping                                   │
│                                                             │
│  • 'airbnb'      → plateforme_tiers_id = id(Airbnb)        │
│  • 'Airbnb'      → plateforme_tiers_id = id(Airbnb)        │
│  • 'booking'     → plateforme_tiers_id = id(Booking)        │
│  • 'Booking.com' → plateforme_tiers_id = id(Booking)        │
│                                                             │
│  → Existent en base (seedTiersSysteme.ts)                   │
│  → JAMAIS REQUÊTÉES par le code applicatif                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  TABLE tiers (type_tiers = 'VOYAGEUR')                      │
│                                                             │
│  • Jean Dupont   code_auxiliaire: VOY-JEA01                 │
│  • Marie Leroy   code_auxiliaire: VOY-MAR01                 │
│                                                             │
│  → Créés automatiquement à l'import CSV (voyageurMatcher)   │
│  → Liés à la réservation via reservations.voyageur_id       │
│  → JAMAIS UTILISÉS dans les écritures comptables            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  reservations.source (champ texte libre)                    │
│                                                             │
│  Contient : 'Airbnb', 'Booking.com', 'Direct', etc.        │
│  → Vient directement du CSV sans normalisation              │
│  → Utilisé uniquement dans le libellé de l'écriture         │
│  → JAMAIS RÉSOLU vers un tiers OTA via ota_source_mapping   │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Ce qui se passe dans le moteur comptable

```typescript
// accountingEngine.ts, ligne 103-110
entries.push({
  compte_debit: '411',           // ← Compte générique, pas de sous-compte
  compte_credit: codeProprio,    // ← 404MAR01 (OK)
  montant: ventilation.payoutNet,
  tiers_id: proprietaire.id      // ← Le PROPRIÉTAIRE, pas le client !
});
```

Trois erreurs dans ces 4 lignes :

1. Le `compte_debit` est `'411'` au lieu de `'OTA-AIRBNB'` ou `'VOY-JEA01'`
2. Le `tiers_id` est celui du propriétaire au lieu de l'OTA ou du voyageur
3. Aucune résolution `reservation.source` → tiers OTA n'est effectuée

### 2.3 Ce qui se passe au rapprochement

```sql
-- rpc_rapprochement.sql, ligne 70-78
INSERT INTO journal_ecritures (...)
SELECT
    '471',                  -- Débit (on vide l'attente)
    '411',                  -- Crédit (on solde le client... lequel ?)
    r.payout_net,
    v_lettrage,
    l.proprietaire_id       -- ← Encore le propriétaire !
FROM reservations r
JOIN logements l ON r.logement_id = l.id
```

Le lettrage du 411 se fait sans savoir qui est le débiteur. Le `tiers_id` est celui du propriétaire, pas du voyageur ni de l'OTA. Si un comptable ouvre le grand livre du 411, il voit des propriétaires au lieu de clients.

---

## 3. Architecture Cible : Le Modèle à Deux Niveaux

### 3.1 Principe : Séparer le payeur du bénéficiaire du séjour

```
NIVEAU 1 — RELATION COMMERCIALE (qui séjourne)
═══════════════════════════════════════════════
  Réservation ←→ Voyageur (tiers VOYAGEUR)
  
  Le voyageur est le bénéficiaire du séjour.
  Il est identifié, ses documents sont vérifiés.
  Il peut avoir plusieurs réservations.
  → Traçabilité : fiche client, historique, blacklist


NIVEAU 2 — RELATION FINANCIÈRE (qui paie l'agence)
═══════════════════════════════════════════════════
  Réservation ←→ Payeur (tiers PLATEFORME_OTA ou VOYAGEUR)
  
  Le payeur est celui qui verse les fonds sur le séquestre.
  Ce peut être une OTA (Airbnb verse le payout) ou le
  voyageur lui-même (réservation directe).
  → Traçabilité : compte 411, lettrage, rapprochement bancaire
```

### 3.2 Le champ `reservation.source` comme clé de résolution

La table `ota_source_mapping` existe déjà. Il suffit de l'utiliser :

```
reservation.source = 'Airbnb'
        │
        ▼
ota_source_mapping.label_csv = 'Airbnb'
        │
        ▼
plateforme_tiers_id = uuid(Airbnb)
        │
        ▼
tiers.code_auxiliaire = 'OTA-AIRBNB'    ← Compte comptable 411
tiers.id = uuid(Airbnb)                 ← tiers_id pour les écritures
```

Pour les réservations directes :

```
reservation.source = 'Direct'
        │
        ▼
ota_source_mapping.label_csv = 'Direct'
        │
        ▼
Pas de plateforme intermédiaire
        │
        ▼
Le payeur = le voyageur lui-même
tiers.code_auxiliaire = 'VOY-JEA01'     ← Compte comptable 411
tiers.id = uuid(Jean Dupont)            ← tiers_id pour les écritures
```

### 3.3 Nouveau champ sur la réservation

```sql
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS 
    payeur_tiers_id UUID REFERENCES tiers(id);
-- Le payeur effectif : OTA tiers_id ou voyageur tiers_id
-- Résolu à l'import ou à la comptabilisation
```

Ce champ permet de répondre instantanément à la question : "Qui doit payer cette réservation ?"

---

## 4. Nouveau Workflow Détaillé

### 4.1 Étape 1 — Import CSV : Résolution du payeur

```typescript
// reservationsService.ts — generateAccountingForReservations()

// NOUVEAU : Résoudre le tiers payeur à partir de reservation.source
async function resolvePayeurTiers(
  reservation: Reservation
): Promise<{ id: string; code_auxiliaire: string; type: 'OTA' | 'VOYAGEUR' }> {
  
  // 1. Chercher dans ota_source_mapping
  const { data: mapping } = await supabase
    .from('ota_source_mapping')
    .select('plateforme_tiers_id, tiers:plateforme_tiers_id(id, code_auxiliaire, sous_type)')
    .eq('label_csv', reservation.source)
    .single();
  
  if (mapping?.tiers) {
    const ota = mapping.tiers;
    
    // Cas spécial : source "Direct" → le payeur est le voyageur
    if (ota.sous_type === 'DIRECT') {
      return await resolveVoyageurAsPayeur(reservation);
    }
    
    // Cas normal : le payeur est l'OTA
    return {
      id: ota.id,
      code_auxiliaire: ota.code_auxiliaire, // 'OTA-AIRBNB'
      type: 'OTA'
    };
  }
  
  // 2. Fallback : source non mappée → traiter comme direct
  console.warn(`Source non mappée: "${reservation.source}" → fallback voyageur`);
  return await resolveVoyageurAsPayeur(reservation);
}

async function resolveVoyageurAsPayeur(reservation: Reservation) {
  if (!reservation.voyageur_id) {
    throw new Error(
      `Réservation directe ${reservation.confirmation_code} sans voyageur lié`
    );
  }
  
  const { data: voyageur } = await supabase
    .from('tiers')
    .select('id, code_auxiliaire')
    .eq('id', reservation.voyageur_id)
    .single();
  
  if (!voyageur?.code_auxiliaire) {
    throw new Error(
      `Voyageur sans code auxiliaire pour ${reservation.confirmation_code}`
    );
  }
  
  return {
    id: voyageur.id,
    code_auxiliaire: voyageur.code_auxiliaire, // 'VOY-JEA01'
    type: 'VOYAGEUR' as const
  };
}
```

### 4.2 Étape 2 — Comptabilisation : Écritures avec le bon payeur

```
CAS A — Réservation Airbnb (payeur = OTA)
════════════════════════════════════════════

PIÈCE JR-2603-0001
────────────────────────────────────────────────────────────────
Payout Airbnb - HM3X7K - Jean Dupont - 15/03 au 20/03
  Débit  OTA-AIRBNB   (411 auxiliaire OTA)     1 250,00
  Crédit 404MAR01     (Propriétaire Martin)    1 250,00
  tiers_id = uuid(Airbnb)       ← L'OTA est le débiteur
────────────────────────────────────────────────────────────────
Ménage - Apt Montmartre - HM3X7K
  Débit  404MAR01     (Propriétaire Martin)       80,00
  Crédit 401CLE01     (Fournisseur Clean&Co)      80,00
────────────────────────────────────────────────────────────────
Honoraires 20% - Apt Montmartre - HM3X7K
  Débit  404MAR01     (Propriétaire Martin)      192,50
  Crédit 706100       (Honoraires gestion HT)    192,50
────────────────────────────────────────────────────────────────
TVA Collectée - Apt Montmartre - HM3X7K
  Débit  404MAR01     (Propriétaire Martin)       38,50
  Crédit 445710       (TVA collectée)              38,50
────────────────────────────────────────────────────────────────


CAS B — Réservation Directe (payeur = Voyageur)
════════════════════════════════════════════════

PIÈCE JR-2603-0002
────────────────────────────────────────────────────────────────
Réservation Directe - ZZ9942 - Marie Leroy - 22/03 au 25/03
  Débit  VOY-MAR01   (411 auxiliaire Voyageur)    650,00
  Crédit 404DUB01    (Propriétaire Dubois)        650,00
  tiers_id = uuid(Marie Leroy)  ← Le voyageur est le débiteur
────────────────────────────────────────────────────────────────
  (... même ventilation ménage/commission/TVA ...)
```

**La différence clé** : le compte au débit de la première ligne et le `tiers_id` changent selon le canal.

### 4.3 Étape 3 — Rapprochement bancaire : Pointer le bon compte

```
CAS A — Encaissement OTA
═════════════════════════

Mouvement bancaire : +1 250,00 € | AIRBNB PAYMENTS | 18/03/2026
Compte banque : 512000 (Séquestre)

L'interface de rapprochement montre dans la catégorie "Encaissements" :

  ┌─────────────────────────────────────────────────────────┐
  │ ☐  HM3X7K - Jean Dupont      +1 250,00 €   AIRBNB    │
  │     Payeur : OTA-AIRBNB (Airbnb)                       │
  │     Voyageur : Jean Dupont (VOY-JEA01)                 │
  │     Propriétaire : Martin                               │
  └─────────────────────────────────────────────────────────┘

Validation → Écriture :
────────────────────────────────────────────────────────────────
  Débit  512000       (Banque Séquestre)         1 250,00
  Crédit OTA-AIRBNB   (411 auxiliaire OTA)       1 250,00
  tiers_id = uuid(Airbnb)
  lettrage = LET-20260318-001
────────────────────────────────────────────────────────────────

→ Le compte OTA-AIRBNB est SOLDÉ (débit 1250 à la vente, crédit 1250 ici)
→ Lettrage croisé avec la pièce JR-2603-0001


CAS B — Encaissement Direct (le voyageur paie lui-même)
═══════════════════════════════════════════════════════

Mouvement bancaire : +650,00 € | VIR LEROY MARIE | 21/03/2026
Compte banque : 512000 (Séquestre)

L'interface montre :

  ┌─────────────────────────────────────────────────────────┐
  │ ☐  ZZ9942 - Marie Leroy       +650,00 €    DIRECT     │
  │     Payeur : VOY-MAR01 (Marie Leroy)                   │
  │     Voyageur : Marie Leroy                              │
  │     Propriétaire : Dubois                               │
  └─────────────────────────────────────────────────────────┘

Validation → Écriture :
────────────────────────────────────────────────────────────────
  Débit  512000       (Banque Séquestre)           650,00
  Crédit VOY-MAR01   (411 auxiliaire Voyageur)     650,00
  tiers_id = uuid(Marie Leroy)
  lettrage = LET-20260321-002
────────────────────────────────────────────────────────────────

→ Le compte VOY-MAR01 est SOLDÉ
```

### 4.4 Cas particulier : Virement groupé Airbnb

Airbnb envoie souvent un **seul virement** pour **plusieurs réservations** :

```
Mouvement bancaire : +3 890,00 € | AIRBNB PAYMENTS | 18/03/2026

L'interface permet de sélectionner PLUSIEURS réservations :

  ┌─────────────────────────────────────────────────────────┐
  │ ☑  HM3X7K - Jean Dupont      +1 250,00 €   AIRBNB    │
  │ ☑  KR2P9L - Sophie Martin    +1 890,00 €   AIRBNB    │
  │ ☑  QW5T3M - Paul Bernard     +  750,00 €   AIRBNB    │
  │                                                         │
  │  Total sélection : 3 890,00 €                          │
  │  Écart : 0,00 €  ✓                                     │
  └─────────────────────────────────────────────────────────┘

Validation → UNE pièce, TROIS écritures :
────────────────────────────────────────────────────────────────
PIÈCE BQ-2603-0018

  D 512000 / C OTA-AIRBNB   1 250,00  (HM3X7K - Dupont)
  D 512000 / C OTA-AIRBNB   1 890,00  (KR2P9L - Martin)
  D 512000 / C OTA-AIRBNB     750,00  (QW5T3M - Bernard)
  
  Lettrage commun : LET-20260318-003
────────────────────────────────────────────────────────────────
```

Toutes les écritures utilisent le même compte `OTA-AIRBNB` car c'est Airbnb qui a payé les trois. Mais chaque ligne est liée à une réservation différente (via la pièce comptable `source_id`), ce qui préserve la traçabilité jusqu'au voyageur.

### 4.5 Cas particulier : Booking.com (commission différente)

Booking.com fonctionne différemment d'Airbnb : le voyageur paie parfois Booking, parfois directement l'hôtel/agence. Le champ `reservation.source` et la table `ota_source_mapping` gèrent cette distinction :

```
Si source = 'Booking.com'  → payeur = OTA-BOOKING  (Booking verse le payout)
Si source = 'Booking Pay'  → payeur = OTA-BOOKING  (idem, variante de libellé)
Si source = 'Direct'       → payeur = VOY-xxx       (voyageur paie en direct)

La table ota_source_mapping doit couvrir toutes les variantes :

  'Booking.com'  → OTA-BOOKING
  'Booking Pay'  → OTA-BOOKING
  'booking'      → OTA-BOOKING
  'Direct'       → OTA-DIRECT (résolu ensuite en voyageur)
  'Site Web'     → OTA-DIRECT
  'Téléphone'    → OTA-DIRECT
```

---

## 5. Traçabilité Complète : De la Fiche Voyageur au Relevé Bancaire

### 5.1 Vue depuis la fiche voyageur

Quand on ouvre la fiche de Jean Dupont (`VOY-JEA01`), on doit pouvoir voir :

```
╔═══════════════════════════════════════════════════════════════╗
║  FICHE VOYAGEUR : Jean Dupont (VOY-JEA01)                   ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  RÉSERVATIONS                                                 ║
║  ┌────────┬────────────┬──────────┬──────────┬──────────────┐║
║  │ Code   │ Dates      │ Logement │ Montant  │ Statut       │║
║  ├────────┼────────────┼──────────┼──────────┼──────────────┤║
║  │ HM3X7K │ 15→20/03   │ Apt Mont │ 1 250,00 │ ENCAISSÉ     │║
║  │ PP42LQ │ 10→14/06   │ Apt Mont │   890,00 │ ATT. PAIMENT │║
║  └────────┴────────────┴──────────┴──────────┴──────────────┘║
║                                                               ║
║  PAIEMENTS REÇUS (via le payeur associé)                      ║
║  ┌────────────────┬────────────┬──────────┬──────────────────┐║
║  │ Date           │ Payeur     │ Montant  │ Rapprochement    │║
║  ├────────────────┼────────────┼──────────┼──────────────────┤║
║  │ 18/03/2026     │ Airbnb     │ 1 250,00 │ ✓ Pointé (BQ-18)│║
║  │ (en attente)   │ Airbnb     │   890,00 │ ○ Non pointé     │║
║  └────────────────┴────────────┴──────────┴──────────────────┘║
║                                                               ║
║  Note : Jean Dupont ne paie pas directement l'agence.         ║
║  Les fonds sont versés par Airbnb sur le compte séquestre.    ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

### 5.2 Vue depuis le grand livre du compte OTA-AIRBNB

```
╔═══════════════════════════════════════════════════════════════╗
║  GRAND LIVRE : OTA-AIRBNB (Airbnb)                           ║
║  Compte 411 auxiliaire — Classe 4 — Débiteur                  ║
╠════════╦═══════════════════════════════╦════════╦════════╦════╣
║  Date  ║  Libellé                      ║ Débit  ║ Crédit ║ S ║
╠════════╬═══════════════════════════════╬════════╬════════╬════╣
║ 09/03  ║ Payout HM3X7K Dupont (JR-01)║1 250,00║        ║  D ║
║ 09/03  ║ Payout KR2P9L Martin (JR-02)║1 890,00║        ║  D ║
║ 09/03  ║ Payout QW5T3M Bernard(JR-03)║  750,00║        ║  D ║
║ 10/03  ║ Payout PP42LQ Leroy  (JR-04)║  890,00║        ║  D ║
╠════════╬═══════════════════════════════╬════════╬════════╬════╣
║ 18/03  ║ Encaissement BQ-18  LET-001 ║        ║3 890,00║  L ║
╠════════╬═══════════════════════════════╬════════╬════════╬════╣
║        ║  SOLDE                        ║  890,00║        ║  D ║
╚════════╩═══════════════════════════════╩════════╩════════╩════╝

  L = Lettré   D = Débiteur (créance)

  Lecture : Airbnb doit encore 890,00 € à l'agence
            (réservation PP42LQ de Leroy pas encore payée)
```

### 5.3 Vue depuis le grand livre d'un voyageur direct

```
╔═══════════════════════════════════════════════════════════════╗
║  GRAND LIVRE : VOY-MAR01 (Marie Leroy)                       ║
║  Compte 411 auxiliaire — Classe 4 — Débiteur                  ║
╠════════╦═══════════════════════════════╦════════╦════════╦════╣
║  Date  ║  Libellé                      ║ Débit  ║ Crédit ║ S ║
╠════════╬═══════════════════════════════╬════════╬════════╬════╣
║ 15/03  ║ Résa Directe ZZ9942  (JR-02)║  650,00║        ║  D ║
║ 21/03  ║ Encaissement BQ-21  LET-002 ║        ║  650,00║  L ║
╠════════╬═══════════════════════════════╬════════╬════════╬════╣
║        ║  SOLDE                        ║   0,00 ║        ║  = ║
╚════════╩═══════════════════════════════╩════════╩════════╩════╝

  Soldé : Marie Leroy a tout payé directement.
```

### 5.4 La chaîne de traçabilité complète

Pour n'importe quel mouvement bancaire, on peut remonter toute la chaîne :

```
Mouvement Bancaire
  └→ mouvements_bancaires.id
      └→ piece_comptable_id (lien direct)
          └→ journal_ecritures (écriture BQ)
              ├→ compte_credit = OTA-AIRBNB (qui a payé)
              ├→ tiers_id = uuid(Airbnb) (confirmation du payeur)
              └→ lettrage = LET-xxx
                  └→ journal_ecritures lettrées (écriture JR)
                      ├→ piece_comptable_id
                      │   └→ pieces_comptables.source_id = uuid(reservation)
                      │       └→ reservations
                      │           ├→ guest_name = "Jean Dupont"
                      │           ├→ voyageur_id = uuid(Jean Dupont)
                      │           ├→ payeur_tiers_id = uuid(Airbnb)
                      │           └→ logement_id → proprietaire_id
                      └→ tiers_id = uuid(Airbnb) (cohérent)
```

En une requête SQL :

```sql
SELECT
    mb.date_operation,
    mb.montant,
    mb.libelle_banque,
    r.confirmation_code,
    r.guest_name,
    voyageur.nom AS voyageur_nom,
    payeur.nom AS payeur_nom,
    payeur.code_auxiliaire AS payeur_compte,
    proprio.nom AS proprietaire_nom,
    je_bq.lettrage
FROM mouvements_bancaires mb
JOIN pieces_comptables pc_bq ON pc_bq.id = mb.piece_comptable_id
JOIN journal_ecritures je_bq ON je_bq.piece_comptable_id = pc_bq.id
JOIN journal_ecritures je_jr ON je_jr.lettrage = je_bq.lettrage
    AND je_jr.piece_comptable_id != pc_bq.id
JOIN pieces_comptables pc_jr ON pc_jr.id = je_jr.piece_comptable_id
    AND pc_jr.source_type = 'RESERVATION'
JOIN reservations r ON r.id = pc_jr.source_id
LEFT JOIN tiers voyageur ON voyageur.id = r.voyageur_id
LEFT JOIN tiers payeur ON payeur.id = r.payeur_tiers_id
LEFT JOIN logements l ON l.id = r.logement_id
LEFT JOIN tiers proprio ON proprio.id = l.proprietaire_id
WHERE mb.id = 'uuid-mouvement';
```

---

## 6. Implémentation Technique

### 6.1 Modification de la table `reservations`

```sql
-- Nouveau champ : le payeur effectif
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS payeur_tiers_id UUID REFERENCES tiers(id);

-- Index pour la performance
CREATE INDEX IF NOT EXISTS idx_reservations_payeur
ON reservations(payeur_tiers_id);
```

### 6.2 Fonction de résolution du payeur (RPC SQL)

```sql
CREATE OR REPLACE FUNCTION fn_resolve_payeur_tiers(
    p_source TEXT,
    p_voyageur_id UUID
) RETURNS TABLE(tiers_id UUID, code_auxiliaire TEXT, payeur_type TEXT) AS $$
BEGIN
    -- 1. Chercher dans ota_source_mapping
    RETURN QUERY
    SELECT 
        t.id,
        t.code_auxiliaire,
        CASE 
            WHEN t.sous_type = 'DIRECT' THEN 'VOYAGEUR'
            ELSE 'OTA'
        END AS payeur_type
    FROM ota_source_mapping osm
    JOIN tiers t ON t.id = osm.plateforme_tiers_id
    WHERE osm.label_csv = p_source
    LIMIT 1;
    
    -- 2. Si trouvé et type = DIRECT → retourner le voyageur
    IF FOUND AND (SELECT pt.payeur_type FROM fn_resolve_payeur_tiers(p_source, p_voyageur_id) pt LIMIT 1) = 'VOYAGEUR' THEN
        RETURN QUERY
        SELECT 
            t.id,
            t.code_auxiliaire,
            'VOYAGEUR'::TEXT
        FROM tiers t
        WHERE t.id = p_voyageur_id;
        RETURN;
    END IF;
    
    -- 3. Si pas trouvé → fallback voyageur
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT 
            t.id,
            t.code_auxiliaire,
            'VOYAGEUR'::TEXT
        FROM tiers t
        WHERE t.id = p_voyageur_id;
    END IF;
END;
$$ LANGUAGE plpgsql;
```

Version TypeScript plus simple et maintenable :

```typescript
// payeurResolver.ts
import { supabase } from '@/lib/supabaseClient';

export type PayeurResolution = {
  tiers_id: string;
  code_auxiliaire: string;
  type: 'OTA' | 'VOYAGEUR';
  nom: string;
};

export async function resolvePayeur(
  source: string,
  voyageurId: string | null
): Promise<PayeurResolution> {

  // 1. Chercher le mapping OTA
  const { data: mapping } = await supabase
    .from('ota_source_mapping')
    .select(`
      plateforme_tiers_id,
      tiers:plateforme_tiers_id (
        id, nom, code_auxiliaire, sous_type
      )
    `)
    .eq('label_csv', source)
    .maybeSingle();

  const otaTiers = (mapping as any)?.tiers;

  // 2. Si OTA trouvée et ce n'est pas "Direct"
  if (otaTiers && otaTiers.sous_type !== 'DIRECT') {
    return {
      tiers_id: otaTiers.id,
      code_auxiliaire: otaTiers.code_auxiliaire,
      type: 'OTA',
      nom: otaTiers.nom
    };
  }

  // 3. Sinon → le voyageur est le payeur
  if (!voyageurId) {
    throw new Error(
      `Impossible de résoudre le payeur : source "${source}" ` +
      `non mappée et pas de voyageur_id`
    );
  }

  const { data: voyageur } = await supabase
    .from('tiers')
    .select('id, nom, code_auxiliaire')
    .eq('id', voyageurId)
    .single();

  if (!voyageur?.code_auxiliaire) {
    throw new Error(
      `Voyageur ${voyageurId} sans code_auxiliaire`
    );
  }

  return {
    tiers_id: voyageur.id,
    code_auxiliaire: voyageur.code_auxiliaire,
    type: 'VOYAGEUR',
    nom: voyageur.nom
  };
}
```

### 6.3 Modification du moteur comptable

```typescript
// accountingEngine.ts — genererEcrituresComptables

async genererEcrituresComptables(
  reservation: any,
  logement: any,
  reglesFinancieres: any,
  proprietaire: any,
  fournisseurMenage: any,
  payeur: PayeurResolution          // ← NOUVEAU PARAMÈTRE
): Promise<{ entries: JournalEntry[], ventilation: AccountingResult }> {
  
  // ...ventilation inchangée...

  // Ligne 1 — Créance sur le PAYEUR (OTA ou Voyageur)
  entries.push({
    date_ecriture: dateEcriture,
    libelle: `Payout ${reservation.source} - ${reservation.confirmation_code} - ${reservation.guest_name}`,
    compte_debit: payeur.code_auxiliaire,   // 'OTA-AIRBNB' ou 'VOY-JEA01'
    compte_credit: codeProprio,             // '404MAR01'
    montant: ventilation.payoutNet,
    tiers_id: payeur.tiers_id              // uuid(Airbnb) ou uuid(Jean Dupont)
  });

  // ...reste inchangé (ménage, commission, TVA)...
}
```

### 6.4 Modification du service réservations

```typescript
// reservationsService.ts — generateAccountingForReservations

async generateAccountingForReservations(reservationIds: string[]) {
  // ... fetch réservations et context existant ...

  for (const res of reservations) {
    const context = contextMap.get(res.logement_id);
    const rules = /* ... */;
    const owner = context.owner;
    const supplierMenage = rules?.fournisseur;

    // NOUVEAU : Résoudre le payeur
    const payeur = await resolvePayeur(res.source, res.voyageur_id);

    const { entries, ventilation } = await accountingEngine
      .genererEcrituresComptables(
        res, context, rules, owner, supplierMenage,
        payeur                              // ← PASSER LE PAYEUR
      );

    if (entries.length > 0) {
      await accountingEngine.createPieceAndEntries(/* ... */);
      
      await supabase.from('reservations').update({
        montant_menage: ventilation.forfaitMenage,
        montant_commission_agence: ventilation.montantCommission,
        loyer_net_proprietaire: ventilation.loyerNetProprietaire,
        statut_workflow: 'ATTENTE_PAIEMENT',
        payeur_tiers_id: payeur.tiers_id    // ← STOCKER LE PAYEUR
      }).eq('id', res.id);
    }
  }
}
```

### 6.5 Modification du rapprochement

```typescript
// rapprochementService.ts — getPendingReservations (enrichi)

async getPendingReservations(): Promise<PendingReservation[]> {
  const { data, error } = await supabase
    .from('reservations')
    .select(`
      *,
      voyageur:voyageur_id (id, nom, code_auxiliaire),
      payeur:payeur_tiers_id (id, nom, code_auxiliaire, sous_type)
    `)
    .eq('statut_workflow', 'ATTENTE_PAIEMENT')
    .order('check_in', { ascending: true });

  return data?.map(r => ({
    ...r,
    // Info affichée dans l'interface de rapprochement
    payeur_nom: r.payeur?.nom || 'Inconnu',
    payeur_code: r.payeur?.code_auxiliaire || '411',
    payeur_type: r.payeur?.sous_type === 'DIRECT' ? 'VOYAGEUR' : 'OTA',
    voyageur_nom: r.voyageur?.nom || r.guest_name,
  })) || [];
}
```

Le RPC de rapprochement utilise le `payeur_tiers_id` :

```sql
-- Dans validate_bank_reconciliation_v2, section ENCAISSEMENT_OTA

FOREACH res_id IN ARRAY p_reservation_ids LOOP
    INSERT INTO journal_ecritures (
        piece_comptable_id, date_ecriture, libelle,
        compte_debit, compte_credit, montant, lettrage, tiers_id
    )
    SELECT
        v_piece_id,
        v_movement.date_operation,
        'Encaissement ' || r.confirmation_code || ' - ' || r.guest_name,
        v_compte_banque,                    -- '512000'
        payeur.code_auxiliaire,             -- 'OTA-AIRBNB' ou 'VOY-xxx'
        r.payout_net,
        v_lettrage,
        r.payeur_tiers_id                   -- uuid du payeur
    FROM reservations r
    JOIN tiers payeur ON payeur.id = r.payeur_tiers_id
    WHERE r.id = res_id;

    UPDATE reservations 
    SET statut_workflow = 'ENCAISSE' 
    WHERE id = res_id;
    
    -- Lettrer l'écriture de vente (même code payeur)
    UPDATE journal_ecritures je
    SET lettrage = v_lettrage
    FROM pieces_comptables pc
    WHERE je.piece_comptable_id = pc.id
      AND pc.source_type = 'RESERVATION'
      AND pc.source_id = res_id
      AND je.compte_debit = payeur.code_auxiliaire  -- Match sur le code payeur
      AND je.lettrage IS NULL;
END LOOP;
```

---

## 7. Gestion de la Table `ota_source_mapping`

### 7.1 Étendre les mappings existants

```sql
-- Compléter les variantes courantes
INSERT INTO ota_source_mapping (plateforme_tiers_id, label_csv) VALUES
  -- Airbnb
  ((SELECT id FROM tiers WHERE code_auxiliaire = 'OTA-AIRBNB'), 'airbnb'),
  ((SELECT id FROM tiers WHERE code_auxiliaire = 'OTA-AIRBNB'), 'Airbnb'),
  ((SELECT id FROM tiers WHERE code_auxiliaire = 'OTA-AIRBNB'), 'AIRBNB'),
  
  -- Booking
  ((SELECT id FROM tiers WHERE code_auxiliaire = 'OTA-BOOKING'), 'booking'),
  ((SELECT id FROM tiers WHERE code_auxiliaire = 'OTA-BOOKING'), 'Booking.com'),
  ((SELECT id FROM tiers WHERE code_auxiliaire = 'OTA-BOOKING'), 'BOOKING'),
  ((SELECT id FROM tiers WHERE code_auxiliaire = 'OTA-BOOKING'), 'Booking Pay'),
  
  -- VRBO / Abritel
  ((SELECT id FROM tiers WHERE code_auxiliaire = 'OTA-VRBO'), 'vrbo'),
  ((SELECT id FROM tiers WHERE code_auxiliaire = 'OTA-VRBO'), 'VRBO'),
  ((SELECT id FROM tiers WHERE code_auxiliaire = 'OTA-VRBO'), 'Abritel'),
  
  -- Direct
  ((SELECT id FROM tiers WHERE code_auxiliaire = 'OTA-DIRECT'), 'Direct'),
  ((SELECT id FROM tiers WHERE code_auxiliaire = 'OTA-DIRECT'), 'direct'),
  ((SELECT id FROM tiers WHERE code_auxiliaire = 'OTA-DIRECT'), 'Site Web'),
  ((SELECT id FROM tiers WHERE code_auxiliaire = 'OTA-DIRECT'), 'Téléphone'),
  ((SELECT id FROM tiers WHERE code_auxiliaire = 'OTA-DIRECT'), 'Email')
ON CONFLICT (label_csv) DO NOTHING;
```

### 7.2 Interface d'administration des mappings

Ajouter dans la page Configuration un écran permettant de :

```
┌─────────────────────────────────────────────────────────────┐
│  CONFIGURATION — Mapping Sources CSV → Plateformes           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Libellé CSV      │  Plateforme OTA      │  Compte 411     │
│  ─────────────────┼──────────────────────┼─────────────────│
│  Airbnb           │  Airbnb              │  OTA-AIRBNB     │
│  airbnb           │  Airbnb              │  OTA-AIRBNB     │
│  Booking.com      │  Booking.com         │  OTA-BOOKING    │
│  Direct           │  Réservation Directe │  → Voyageur     │
│  ─────────────────┼──────────────────────┼─────────────────│
│  [+ Ajouter un mapping]                                     │
│                                                             │
│  Sources non mappées détectées :                             │
│  ⚠ "Expedia" (3 réservations) → [Créer le mapping]         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

Avec une alerte quand une source importée n'a pas de mapping (pour éviter les fallbacks silencieux).

---

## 8. Résumé : Qui est sur Quel Compte

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│  COMPTE 411 — CLIENTS / DÉBITEURS                              │
│  ════════════════════════════════                              │
│                                                                │
│  Sous-comptes OTA (tiers système, peu nombreux) :              │
│    OTA-AIRBNB    → Airbnb Ireland UC                           │
│    OTA-BOOKING   → Booking.com B.V.                            │
│    OTA-VRBO      → VRBO / Abritel                              │
│                                                                │
│  Sous-comptes Voyageurs (tiers individuels, nombreux) :        │
│    VOY-JEA01     → Jean Dupont (réservations directes)         │
│    VOY-MAR01     → Marie Leroy (réservations directes)         │
│    VOY-PAU01     → Paul Bernard (réservations directes)        │
│                                                                │
│  Règle :                                                       │
│  • Réservation OTA   → débit sur OTA-xxx                       │
│  • Réservation directe → débit sur VOY-xxx                     │
│  • Le voyageur est TOUJOURS sur la réservation (voyageur_id)   │
│  • Le payeur est TOUJOURS sur la réservation (payeur_tiers_id) │
│                                                                │
│  Conséquence sur le grand livre :                              │
│  • Le GL du OTA-AIRBNB montre TOUTES les créances Airbnb       │
│    → 1 débit par réservation, 1 crédit groupé au rapprochement │
│    → Le solde = ce que Airbnb doit encore                      │
│  • Le GL du VOY-JEA01 montre TOUTES les créances directes      │
│    → Le solde = ce que le voyageur doit encore                 │
│                                                                │
│  Le lien voyageur ↔ paiement se fait via :                     │
│    reservation.voyageur_id  → qui a séjourné                   │
│    reservation.payeur_tiers_id → qui a payé                    │
│    Fiche voyageur → liste des réservations → payeur associé    │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

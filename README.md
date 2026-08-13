# FER SIG — Entretien routier

MVP de pilotage géographique, opérationnel et financier du Fonds d’entretien routier.

## Architecture

- Next.js App Router
- Vercel pour l’hébergement
- Supabase pour PostgreSQL et l’authentification
- Leaflet / OpenStreetMap pour la cartographie

## Installation locale

```bash
npm install
cp .env.example .env.local
npm run dev
```

Renseigner dans `.env.local` :

```env
NEXT_PUBLIC_SUPABASE_URL=https://VOTRE_PROJET.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=VOTRE_CLE_PUBLIQUE
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## Préparation de Supabase

1. Créer un projet Supabase.
2. Ouvrir **SQL Editor**.
3. Exécuter le contenu de `supabase/schema.sql`.
4. Créer les utilisateurs FER dans **Authentication**.
5. Insérer leurs profils dans `public.profiles` avec le rôle `direction` ou `agent`.
6. Les utilisateurs FER se connectent sur `/login`.
7. Les citoyens créent leur propre compte sur `/citoyen/inscription`. Un trigger sécurisé crée toujours leur profil avec le rôle `citoyen`.

Dans **Authentication → URL Configuration**, configurer :

- Site URL : `https://fer-ci.vercel.app`
- Redirect URL : `https://fer-ci.vercel.app/auth/callback`

Pour une ouverture publique, activer également la protection contre les mots de passe compromis dans les paramètres Auth Supabase.

Exemple à adapter avec l’identifiant d’un utilisateur Supabase :

```sql
insert into public.profiles (id, full_name, role)
values ('UUID_AUTH_USER', 'Amadou Koné', 'direction');
```

## Déploiement Vercel

1. Importer le dépôt GitHub dans Vercel.
2. Ajouter les trois variables de `.env.example` dans **Settings → Environment Variables**.
3. Déployer. Les prochains `git push` déclencheront automatiquement un nouveau déploiement.

La clé secrète Supabase et la clé `service_role` ne doivent jamais être placées dans les variables `NEXT_PUBLIC_*` ni envoyées sur GitHub.

## Contrôles de sécurité inclus

- Toutes les tables publiques utilisent RLS.
- La Direction peut gérer les données financières.
- Un citoyen voit uniquement ses propres signalements et ne peut pas modifier leur statut.
- Les agents et la Direction peuvent qualifier les signalements citoyens.
- Les citoyens n’accèdent jamais aux finances, interventions ou données patrimoniales internes.
- Les écritures API vérifient la session et valident les coordonnées et catégories.
- Un identifiant de requête empêche les doublons lors d’un nouvel envoi réseau.
- Une écriture échouée n’est plus affichée comme réussie dans l’interface.

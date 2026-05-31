# BCCO — Badminton Club Chambly Oise

Site du **Badminton Club Chambly Oise** (BCCO), 8× Champion de France Top 12.  
Site statique (HTML + CSS + JS), sans backend, données pilotées via des fichiers CSV dans le dépôt.

Projet commencé le lundi 20 avril 2026, présenté le jeudi 28 mai au bureau.

---

## Pages

| Fichier | Contenu |
|---------|---------|
| `index.html` | Accueil : actualités, rencontres, équipes Top 12, salle, horaires |
| `equipes.html` | Effectifs des équipes interclubs |
| `galerie.html` | Galerie photos |
| `reservations.html` | Réservation de terrains (9 terrains, tarifs, créneaux) |
| `mentions-legales.html` | Mentions légales |
| `politique-confidentialite.html` | Politique de confidentialité |
| `admin-bcco-fe732ff3.html` | Interface admin (URL privée) |

---

## Architecture

Site **100 % statique** — aucun serveur, aucune base de données côté production.  
Tous les contenus dynamiques sont lus depuis des **fichiers CSV dans `data/`**, servis directement par Cloudflare Pages (ou OVH en test).

### Modifier le contenu

Éditer directement les fichiers CSV sur GitHub (bouton ✏️ "Edit this file") → le déploiement est automatique en ~30 secondes.

| Contenu | Fichier à éditer |
|---------|-----------------|
| Actualités | `data/actualites.csv` |
| Résultats / prochains matchs | `data/rencontres.csv` |
| Classement Top 12 | `data/classement.csv` |
| Métadonnées classement (saison, lien officiel) | `data/classement-meta.csv` |
| Effectifs équipes | `data/effectifs.csv` |
| Palmarès | `data/palmares.csv` |
| Créneaux réservables | `data/reservations/creneaux_ouverts.csv` |
| Créneaux bloqués (événements club) | `data/reservations/creneaux_bloques.csv` |
| Réservations confirmées | `data/reservations/reservations.csv` |
| Licenciés (vérification réduction) | `data/reservations/licencies.csv` |
| Config réservation (tarifs, nb terrains…) | `data/reservations/config.csv` |
| Comptes admin | `data/admins.json` |

---

## Structure du dépôt

```
ChamblyBad/
├── index.html
├── equipes.html
├── galerie.html
├── reservations.html
├── mentions-legales.html
├── politique-confidentialite.html
├── admin-bcco-fe732ff3.html       # URL privée — ne pas partager
├── styles.css                     # Import de tous les CSS modulaires
├── sw.js                          # Service Worker (cache PWA)
├── manifest.json                  # PWA manifest
├── pwa.js                         # Enregistrement du SW
├── sitemap.xml
├── robots.txt
│
├── css/                           # CSS modulaires (importés par styles.css)
│   ├── _base.css                  # Variables, reset, typographie
│   ├── _layout.css                # Nav, footer, grille principale
│   ├── _home-sections.css         # Sections de la page d'accueil
│   ├── _section-equipes.css       # Section équipes interclubs
│   ├── _actualites-roster.css     # Cartes actualités + roster Top 12
│   ├── _salle.css                 # Section salle
│   ├── _salle-editorial.css       # Bloc éditorial salle
│   ├── _flamme-paralympique.css   # Bloc Marie-Amélie Le Fur
│   ├── _bottom-nav.css            # Navigation mobile bas de page
│   ├── _planning-mobile.css       # Vue mobile créneaux réservation
│   ├── _animations.css            # Keyframes et transitions
│   └── _responsive.css            # Media queries globales
│
├── js/                            # JavaScript par fonctionnalité
│   ├── nav-mega.js                # Menu desktop (mega menu)
│   ├── nav-pill.js                # Navigation mobile (bottom nav)
│   ├── animations.js              # Animations au scroll (GSAP-like)
│   ├── actualites.js              # Cartes actualités + modal détail
│   ├── rencontres.js              # Prochains matchs et résultats
│   ├── roster.js                  # Roster joueurs Top 12
│   ├── home-init.js               # Init page d'accueil (année, burger)
│   ├── home-voir-plus.js          # Bouton "Voir plus" actus mobile
│   ├── home-scroll-reveal.js      # Apparition au scroll (accueil)
│   ├── equipes.js                 # Effectifs équipes interclubs
│   ├── galerie-init.js            # Init page galerie
│   ├── galerie-bn.js              # Bottom nav plus (galerie)
│   ├── reservations.js            # Réservation terrains (grille + modal)
│   └── admin.js                   # Interface admin
│
├── data/                          # Données du site (éditables sur GitHub)
│   ├── actualites.csv
│   ├── rencontres.csv
│   ├── classement.csv
│   ├── classement-meta.csv
│   ├── effectifs.csv
│   ├── palmares.csv
│   ├── admins.json
│   └── reservations/
│       ├── config.csv
│       ├── creneaux_ouverts.csv
│       ├── creneaux_bloques.csv
│       ├── reservations.csv
│       └── licencies.csv
│
├── media/                         # Images et icônes (WebP optimisé)
├── docs/                          # PDFs (formulaires, règlement…)
├── partials/                      # Fragments HTML partagés
└── scripts/                       # Scripts de build et utilitaires
    ├── build.js
    ├── sync-head.py
    └── google-apps-script/
        └── inscription-backend.gs
```

---

## Déploiement

### Production — Cloudflare Pages
Le site est connecté au dépôt GitHub. Chaque push sur `main` déclenche un déploiement automatique.

### Test — OVH FTP (shootbytheo.fr)
Un workflow GitHub Actions ([`.github/workflows/build.yml`](.github/workflows/build.yml)) synchronise le dépôt vers l'hébergement OVH via FTP à chaque push sur `main`.

### Lancer en local
```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000/
```
Alternatives : `npx serve`, `php -S localhost:8000`, Live Server (VS Code).

> **Note :** ouvrir les fichiers directement (`file://`) peut bloquer le chargement des CSV locaux à cause des règles CORS du navigateur.

---

## Interface admin

**URL** : `admin-bcco-fe732ff3.html` (slug privé — ne pas publier)  
**Protection** : PBKDF2(SHA-256, 200 000 itérations) + blocage 30 min après 5 tentatives

L'admin permet de :
- Prévisualiser les actualités, rencontres, classement et réservations
- Accéder aux liens d'édition GitHub de chaque fichier CSV
- Gérer les créneaux bloqués

> La sécurité réelle repose sur le slug secret + le fait qu'il n'y a aucune donnée sensible derrière. Pour une vraie auth, utiliser Cloudflare Access.

---

## PWA

Le site est installable en tant qu'application (PWA) sur iOS et Android grâce au `manifest.json` et au service worker `sw.js`.  
Le SW utilise une stratégie **cache-first** pour les assets et **network-first** pour les navigations.  
Version du cache : `bcco-v23` (à incrémenter dans `sw.js` après chaque déploiement majeur).

---

## ⚠️ RGPD — Licenciés

Le fichier `data/reservations/licencies.csv` est **accessible publiquement** (fichier statique).  
Il ne doit contenir que des données de démonstration tant qu'il n'est pas protégé par un backend authentifié.  
Voir `politique-confidentialite.html` et les recommandations dans l'ancienne version du README pour la mise en conformité.

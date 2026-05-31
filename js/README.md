# js/ — Scripts JavaScript

Chaque fichier correspond à une fonctionnalité ou une page.  
Chargés directement via `<script defer>` dans le HTML — aucun bundler.

## Partagés (toutes les pages)

| Fichier | Rôle |
|---------|------|
| `nav-mega.js` | Menu desktop (mega menu déroulant) |
| `nav-pill.js` | Navigation mobile (bottom nav) |
| `animations.js` | Animations au scroll |

## Page d'accueil (`index.html`)

| Fichier | Rôle |
|---------|------|
| `actualites.js` | Cartes actualités (CSV) + modal détail |
| `rencontres.js` | Prochains matchs et résultats Top 12 / N2 |
| `roster.js` | Roster des joueurs Top 12 |
| `home-init.js` | Init (année en pied de page, burger menu) |
| `home-voir-plus.js` | Bouton "Voir plus" actualités sur mobile |
| `home-scroll-reveal.js` | Apparition des sections au scroll |

## Pages secondaires

| Fichier | Page | Rôle |
|---------|------|------|
| `equipes.js` | `equipes.html` | Effectifs des équipes interclubs |
| `galerie-init.js` | `galerie.html` | Init (année, shadow nav) |
| `galerie-bn.js` | `galerie.html` | Menu "+" de la bottom nav |
| `reservations.js` | `reservations.html` | Grille créneaux, calcul places, modal réservation |
| `admin.js` | `admin-bcco-*.html` | Interface d'administration |

## Pourquoi des fichiers externes ?

- **Cache navigateur** : non re-téléchargés à chaque navigation entre pages
- **Maintenance** : éditer un `.js` dédié plutôt que de naviguer dans 2000 lignes de HTML
- **Diffs Git lisibles** : les modifications JS ne polluent pas les diffs HTML

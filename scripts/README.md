# Scripts de build

## `build.js` — Minification HTML/CSS/JS

Produit un dossier `dist/` minifié, prêt pour la production.

### Lancer en local

Prérequis : **Node.js 20+** (à installer via [nodejs.org](https://nodejs.org)).

```bash
npm install     # installe html-minifier-terser et clean-css (1ʳᵉ fois)
npm run build   # crée dist/ avec tout le site minifié
npm run clean   # supprime dist/
```

### Ce que ça fait

- `*.html` → minifie HTML, CSS inline et JS inline en un seul passage
- `styles.css` → minifie via clean-css niveau 2
- `*.json`, `*.csv`, `media/*`, `docs/*` → copiés tels quels
- Skip : `node_modules/`, `dist/`, `.git/`, `.claude/`, le PDF de doc, etc.

### CI

Le workflow `.github/workflows/build.yml` lance ce build à chaque push/PR
sur `main`. Il publie le dossier `dist/` comme artifact GitHub (téléchargeable
14 jours).

### Branchement avec un déploiement

Quand le déploiement vers o2switch sera mis en place, le workflow de
déploiement utilisera `dist/` comme source FTP au lieu de la racine du repo.

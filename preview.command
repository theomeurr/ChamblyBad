#!/bin/bash
# ============================================================
# preview.command — Lance le site BCCO en local
# Double-cliquer depuis le Finder pour démarrer.
# ============================================================

set -e
cd "$(dirname "$0")"

PORT=8000

clear
echo ""
echo "🏸  BCCO ChamblyBad — preview locale"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Affiche la branche git si on est dans un repo
if git rev-parse --git-dir > /dev/null 2>&1; then
  CURRENT=$(git branch --show-current 2>/dev/null || echo "?")
  echo "🌿  Branche  : $CURRENT"
fi

# Trouve un port libre (8000, sinon 8001, 8002...)
while lsof -i :$PORT > /dev/null 2>&1; do
  PORT=$((PORT + 1))
done

URL="http://localhost:$PORT"
echo "🌐  URL      : $URL"
echo "📁  Dossier  : $(pwd)"
echo ""
echo "Pour arrêter le serveur : ferme cette fenêtre"
echo "                          ou appuie sur Ctrl+C"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Ouvre le navigateur après 1s (laisse le serveur démarrer)
( sleep 1; open "$URL" ) &

# Lance le serveur HTTP statique
python3 -m http.server "$PORT"

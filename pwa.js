// Enregistrement du service worker BCCO.
// Auto-update : dès qu'une nouvelle version est détectée, on l'active
// et on recharge la page automatiquement → plus besoin de vider le cache.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./sw.js').then(function (reg) {
      // Lorsqu'un nouveau SW est trouvé en arrière-plan
      reg.addEventListener('updatefound', function () {
        var nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', function () {
          // Nouveau SW installé alors qu'un ancien contrôle déjà la page
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            // On lui demande de prendre le relais immédiatement
            nw.postMessage('SKIP_WAITING');
          }
        });
      });

      // Vérifie les mises à jour à chaque navigation/visite (au-delà du check natif du navigateur)
      try { reg.update(); } catch (_) {}
    }).catch(function () {});

    // Quand le nouveau SW prend le contrôle, on recharge une seule fois
    var hasReloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (hasReloaded) return;
      hasReloaded = true;
      window.location.reload();
    });
  });
}

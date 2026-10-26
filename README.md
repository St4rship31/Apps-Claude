# Apps-Claude

## Mes tâches — to-do list mobile (`todo/`)

Une application de to-do list installable sur téléphone (PWA) : elle s'ouvre en plein écran
comme une app native, fonctionne hors ligne et garde vos tâches sur l'appareil.

### Fonctionnalités

- Ajouter une tâche en un geste, avec échéance et priorité en option (icône calendrier)
- Cocher pour terminer, toucher une tâche pour la modifier (titre, notes, échéance, priorité)
- Glisser vers la gauche pour supprimer, avec bouton « Annuler »
- Filtres : À faire, Aujourd'hui (en retard, du jour ou prioritaires), Terminées, Toutes
- Tri automatique : en retard d'abord, puis prioritaires, puis par échéance
- Mode sombre automatique, fonctionnement hors ligne
- Sauvegarde / restauration en fichier JSON (menu ⋮) pour changer de téléphone

### Mise en ligne

L'app est publiée par GitHub Pages depuis la branche `main` (**Settings → Pages → Deploy from a branch → `main` / `(root)`**).
Chaque modification fusionnée dans `main` est mise en ligne automatiquement en une à deux minutes.

- Adresse de l'app : https://st4rship31.github.io/Apps-Claude/todo/
- https://st4rship31.github.io/Apps-Claude/ redirige vers l'app.

### Installer sur le téléphone

- **iPhone (Safari)** : ouvrir l'adresse → bouton Partager → « Sur l'écran d'accueil ».
- **Android (Chrome)** : ouvrir l'adresse → menu ⋮ → « Installer l'application ».

### Données

Les tâches sont stockées localement sur le téléphone (aucun compte, aucun serveur).
Pensez à exporter une sauvegarde de temps en temps depuis le menu ⋮.

### Tester en local

```sh
cd todo && python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

Après une modification des fichiers, incrémenter `CACHE` dans `todo/sw.js` pour que
les téléphones récupèrent la nouvelle version.

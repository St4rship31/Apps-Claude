# Apps-Claude

## Tâches — to-do list mobile (`todo/`)

Une app de listes de tâches inspirée de Google Tasks, installable sur téléphone (PWA) :
elle s'ouvre en plein écran comme une app native, fonctionne hors ligne et garde vos
tâches sur l'appareil.

### Fonctionnalités

**Listes**
- Plusieurs listes (Perso, Travail, Courses…) affichées en onglets, chacune avec son icône
- Créer, renommer et supprimer une liste (avec confirmation et « Annuler »)
- Onglet ⭐ **Suivies** : toutes les tâches marquées d'une étoile, toutes listes confondues

**Tâches**
- Saisie rapide en langage naturel : « Appeler Paul demain 18h » crée la tâche avec la date et l'heure
  (comprend aujourd'hui, demain, après-demain, les jours de la semaine et les heures « 18h », « 9h30 », « 14:00 »)
- Détails, date, heure, étoile, sous-tâches
- Répétition : tous les jours, en semaine, chaque semaine, chaque mois, chaque année.
  En cochant une tâche répétitive, la suivante est créée automatiquement
- Déplacer une tâche vers une autre liste
- Cocher pour terminer ; section « Terminées » repliable
- Glisser vers la gauche pour supprimer ; « Annuler » après chaque action importante

**Organisation**
- Tri par liste : Mon ordre (réorganisation par glisser-déposer avec la poignée ⋮⋮),
  Date (regroupé par En retard / Aujourd'hui / Demain / … / Sans date), ou Suivies en premier
- Recherche dans toutes les listes
- Mode sombre automatique, fonctionnement hors ligne
- Sauvegarde / restauration en fichier JSON (menu ⋮ en haut) pour changer de téléphone

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

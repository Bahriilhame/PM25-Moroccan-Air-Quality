# Guide de déploiement A→Z
## PM2.5 Moroccan Air Quality — Tout tourne sur HuggingFace

---

## VUE D'ENSEMBLE

```
Ta machine (1 seule fois)
  │
  ├── Upload deployment_package/ + history.csv → HF Dataset
  │       (script scripts/upload_initial.py)
  │
  └── git push → GitHub
                   │
                   └── GitHub Actions (CI/CD)
                          ├── Tests Python
                          ├── Build React
                          └── Deploy → HF Space
                                        │
                                        └── HF Space démarre :
                                             ├── Pull models depuis HF Dataset
                                             ├── Pull history.csv
                                             ├── Prédictions initiales
                                             └── Scheduler (toutes les heures)
```

---

## ÉTAPE 1 — Préparer les comptes

### 1.1 OpenWeatherMap
- Va sur https://openweathermap.org → créé un compte gratuit
- Dashboard → **API Keys** → copie la clé (ex: `a1b2c3d4...`)
- Active **"Air Pollution API"** et **"One Call API 3.0"** (gratuits)
- La clé met 5-10 min à s'activer

### 1.2 HuggingFace
- Va sur https://huggingface.co → créé un compte
- **Settings → Access Tokens → New token**
  - Nom : `pm25-space`
  - Type : **Write**
  - Copie le token : `hf_xxxxxxxxxxxxxxxxxxxx`

### 1.3 Vérifier que tes deux repos HF existent
- Dataset : https://huggingface.co/datasets/bahriilhame/pm25-moroccan-data
  → Si absent : https://huggingface.co/new-dataset → Nom: `pm25-moroccan-data`
- Space : https://huggingface.co/spaces/bahriilhame/PM2.5-Moroccan-Air-Quality
  → Si absent : https://huggingface.co/new-space → Nom: `PM2.5-Moroccan-Air-Quality` → SDK: **Docker**

---

## ÉTAPE 2 — Upload initial des modèles + historique (UNE SEULE FOIS)

Tu as besoin de :
- ton dossier `deployment_package/` avec les artefacts Blend Enrichi V2
- ton fichier `history.csv` (3 ans de données)

### 2.1 Installer huggingface_hub sur ta machine
```bash
pip install huggingface_hub
```

### 2.2 Lancer le script d'upload
```bash
python scripts/upload_initial.py \
  --models-dir /chemin/vers/ton/deployment_package \
  --history    /chemin/vers/ton/history.csv \
  --token      hf_xxxxxxxxxxxxxxxxxxxx
```

**Exemples concrets selon ton OS :**
```bash
# Windows
python scripts/upload_initial.py --models-dir "C:\Users\toi\deployment_package" --history "C:\Users\toi\history.csv" --token hf_xxx

# macOS / Linux
python scripts/upload_initial.py --models-dir ~/Desktop/deployment_package --history ~/data/history.csv --token hf_xxx
```

**Ce que tu verras :**
```
============================================================
  Upload initial → bahriilhame/pm25-moroccan-data
============================================================
[1/3] Vérification du dataset... ✅ Dataset trouvé
[2/3] Compression deployment_package/ → models.tar.gz...
      Archive créée : 245.3 MB
      Upload vers HF Dataset...
      ✅ models.tar.gz uploadé
[3/3] Upload history.csv...
      2,628,000 lignes, 185.4 MB
      Upload...
      ✅ data/history.csv uploadé
============================================================
  ✅ UPLOAD TERMINÉ
============================================================
```

**Vérifie sur :** https://huggingface.co/datasets/bahriilhame/pm25-moroccan-data
- Tu dois voir `models.tar.gz` et `data/history.csv`

---

## ÉTAPE 3 — Configurer GitHub

### 3.1 Créer le repo GitHub
- Va sur https://github.com/new
- Nom : `pm25-moroccan-air-quality`
- Visibilité : **Private** (recommandé — contient le code)
- Ne pas initialiser avec README

### 3.2 Pousser le code
```bash
# Dans le dossier pm25-final/
git init
git add .
git commit -m "Initial commit — PM2.5 MLOps"
git branch -M main
git remote add origin https://github.com/TON_USERNAME/pm25-moroccan-air-quality.git
git push -u origin main
```

### 3.3 Configurer les secrets GitHub
Va sur : `https://github.com/TON_USERNAME/pm25-moroccan-air-quality/settings/secrets/actions`

Clic **"New repository secret"** pour chacun :

| Nom du secret | Valeur |
|---|---|
| `HF_TOKEN` | `hf_xxxxxxxxxxxxxxxxxxxx` (ton token HuggingFace Write) |
| `OWM_API_KEY` | `a1b2c3d4...` (ta clé OpenWeatherMap) |

> ⚠️ Ces deux secrets sont les SEULES choses à configurer manuellement.

### 3.4 Configurer les secrets HuggingFace Space
Va sur : https://huggingface.co/spaces/bahriilhame/PM2.5-Moroccan-Air-Quality/settings

Scroll jusqu'à **"Repository secrets"** → Ajoute :

| Nom | Valeur |
|---|---|
| `OWM_API_KEY` | Ta clé OWM |
| `HF_TOKEN` | Ton token HF |

Ces variables sont injectées dans le container Docker du Space au runtime.

---

## ÉTAPE 4 — Premier déploiement

### 4.1 Déclencher le CI/CD
Le push de l'étape 3.2 a automatiquement déclenché le workflow GitHub Actions.

Pour voir l'avancement :
- Va sur : `https://github.com/TON_USERNAME/pm25-moroccan-air-quality/actions`
- Tu verras le workflow **"Deploy → HuggingFace Space"** tourner

**3 étapes du CI/CD :**
1. **Tests Python** (1-2 min) — vérifie que le code est correct
2. **Build React** (2-3 min) — compile le frontend
3. **Deploy HF Space** (1-2 min) — pousse le code vers HF

### 4.2 Suivre le démarrage du Space
Après le deploy, va sur : https://huggingface.co/spaces/bahriilhame/PM2.5-Moroccan-Air-Quality

- Clique sur **"Logs"** pour voir ce qui se passe
- Tu verras :
```
PM2.5 Moroccan Air Quality — HuggingFace Space
Pull depuis HF Dataset...
Modèles extraits dans /app/models
Historique téléchargé: 2,628,000 lignes
✅ Artefacts Blend Enrichi V2 chargés
Génération prédictions initiales...
predict_all_cities: 1272 prédictions pour 2024-...
🚀 Startup terminé — Space opérationnel
```

- Premier démarrage : **3-8 minutes** (téléchargement modèles + historique)
- Démarrages suivants : **30-60 secondes** (cache HF)

---

## ÉTAPE 5 — Vérification

### 5.1 API health check
```
https://bahriilhame-PM2-5-Moroccan-Air-Quality.hf.space/api/health/
```
Doit retourner :
```json
{"status":"ok","model_loaded":true,"predictions_available":true,"n_predictions":1272}
```

### 5.2 Application web
```
https://bahriilhame-PM2-5-Moroccan-Air-Quality.hf.space/
```
Tu dois voir la carte du Maroc avec les bulles colorées PM2.5.

### 5.3 Documentation API
```
https://bahriilhame-PM2-5-Moroccan-Air-Quality.hf.space/api/docs
```

---

## ÉTAPE 6 — Fonctionnement automatique (rien à faire)

Une fois déployé, le scheduler tourne en permanence dans le Space :

```
Toutes les heures à H:00  → Collecte OWM (53 villes)
Toutes les heures à H:05  → Prédictions Blend Enrichi V2
Toutes les heures à H:06  → Push history.csv → HF Dataset
Chaque jour à 03:30 UTC   → Fine-tune (30 derniers jours)
Chaque dimanche à 02:00   → Full retrain (tout l'historique)
```

---

## MISES À JOUR DU CODE

Quand tu modifies du code :
```bash
git add .
git commit -m "ta description"
git push
```
→ GitHub Actions se déclenche automatiquement → nouveau deploy HF Space.

---

## PROBLÈMES COURANTS

### Space affiche "Building" depuis longtemps (> 15 min)
- Va dans les logs du Space
- Si erreur `models not found` → vérifie que l'upload initial a bien fonctionné
- Si erreur `HF_TOKEN` → vérifie les secrets dans HF Space Settings

### API retourne 503 "Prédictions non disponibles"
- Normal au premier démarrage — attends 5 min
- Sinon : onglet Admin de l'app → bouton "Générer prédictions"

### Erreur "OWM 401 Unauthorized"
- La clé OWM n'est pas encore active (attends 10 min après création)
- Ou le secret `OWM_API_KEY` mal configuré dans HF Space Settings

### Le Space se met en veille (plan gratuit HF)
- HF met les Spaces gratuits en veille après inactivité
- Le redémarrage prend ~2 min (pull HF Dataset + prédictions)
- Pour éviter : upgrade vers HF Pro ou utilise un Space persistant

#!/usr/bin/env python3
"""
=============================================================
  SCRIPT D'UPLOAD INITIAL vers HF Dataset
  bahriilhame/pm25-moroccan-data
=============================================================

Ce script fait UNE SEULE CHOSE : uploader tes fichiers locaux
vers le HuggingFace Dataset pour que le Space puisse les télécharger.

À lancer UNE SEULE FOIS depuis ta machine locale avant le premier deploy.

Usage :
    pip install huggingface_hub
    python scripts/upload_initial.py

Structure uploadée sur HF Dataset :
  models.tar.gz                    ← deployment_package/ compressé
  data/history.csv                 ← ton historique 3 ans

Arguments :
  --models-dir   Chemin vers ton deployment_package/ local
  --history      Chemin vers ton history.csv local
  --token        HF token (ou variable env HF_TOKEN)
  --repo         ID du dataset HF (défaut: bahriilhame/pm25-moroccan-data)
=============================================================
"""

import argparse
import os
import sys
import tarfile
from pathlib import Path

import tempfile

def main():
    parser = argparse.ArgumentParser(description="Upload initial vers HF Dataset")
    parser.add_argument("--models-dir", required=True,
                        help="Chemin vers ton deployment_package/ local")
    parser.add_argument("--history",    required=True,
                        help="Chemin vers ton history.csv (3 ans de données)")
    parser.add_argument("--token",      default=os.environ.get("HF_TOKEN", ""),
                        help="HuggingFace token (ou env HF_TOKEN)")
    parser.add_argument("--repo",       default="bahriilhame/pm25-moroccan-data",
                        help="ID du dataset HF")
    args = parser.parse_args()

    # Vérifications
    models_dir = Path(args.models_dir)
    history    = Path(args.history)

    if not models_dir.exists():
        print(f"❌ models-dir introuvable : {models_dir}")
        sys.exit(1)
    if not history.exists():
        print(f"❌ history introuvable : {history}")
        sys.exit(1)
    if not args.token:
        print("❌ HF_TOKEN manquant. Passe --token ou export HF_TOKEN=...")
        sys.exit(1)

    print("=" * 60)
    print(f"  Upload initial → {args.repo}")
    print("=" * 60)

    try:
        from huggingface_hub import HfApi
    except ImportError:
        print("❌ huggingface_hub non installé. Lance : pip install huggingface_hub")
        sys.exit(1)

    api = HfApi(token=args.token)

    # ── Étape 1 : Vérifier que le dataset existe ──────────────────────────
    print(f"\n[1/3] Vérification du dataset {args.repo}...")
    try:
        api.repo_info(repo_id=args.repo, repo_type="dataset")
        print(f"      ✅ Dataset trouvé")
    except Exception as e:
        print(f"      ❌ Dataset non trouvé : {e}")
        print(f"      → Va sur https://huggingface.co/new-dataset et crée '{args.repo}'")
        sys.exit(1)

    # ── Étape 2 : Compresser et uploader les modèles ──────────────────────
    print(f"\n[2/3] Compression de {models_dir} → models.tar.gz...")

    # Vérifie les fichiers clés du deployment_package
    required = [
        "blend_weights_v2.npy", "label_encoder.pkl",
        "feat_enriched.pkl", "feat_cb_enriched.pkl",
        "cat_features.pkl", "weather_horizons.pkl",
    ]
    missing = [f for f in required if not (models_dir / f).exists()]
    if missing:
        print(f"      ⚠️  Fichiers manquants dans {models_dir} : {missing}")
        print(f"      → Continue quand même...")

    tar_path = Path(tempfile.gettempdir()) / "models.tar.gz"
    with tarfile.open(tar_path, "w:gz") as tar:
        # Archive sous le nom "models/" pour cohérence avec hf_storage.py
        tar.add(models_dir, arcname="models")

    size_mb = tar_path.stat().st_size / 1024 / 1024
    print(f"      Archive créée : {size_mb:.1f} MB")
    print(f"      Upload vers HF Dataset (peut prendre quelques minutes)...")

    api.upload_file(
        path_or_fileobj=str(tar_path),
        path_in_repo="models.tar.gz",
        repo_id=args.repo,
        repo_type="dataset",
        commit_message="Initial upload: deployment_package Blend Enrichi V2",
    )
    tar_path.unlink(missing_ok=True)
    print(f"      ✅ models.tar.gz uploadé")

    # ── Étape 3 : Uploader l'historique ──────────────────────────────────
    print(f"\n[3/3] Upload de {history}...")
    lines = sum(1 for _ in open(history)) - 1  # -1 pour header
    size_mb = history.stat().st_size / 1024 / 1024
    print(f"      {lines:,} lignes, {size_mb:.1f} MB")
    print(f"      Upload vers HF Dataset...")

    api.upload_file(
        path_or_fileobj=str(history),
        path_in_repo="data/history.csv",
        repo_id=args.repo,
        repo_type="dataset",
        commit_message=f"Initial upload: history.csv ({lines:,} lignes)",
    )
    print(f"      ✅ data/history.csv uploadé")

    # ── Résumé ────────────────────────────────────────────────────────────
    print()
    print("=" * 60)
    print("  ✅ UPLOAD TERMINÉ")
    print(f"  Dataset : https://huggingface.co/datasets/{args.repo}")
    print()
    print("  Prochaines étapes :")
    print("  1. Configure les secrets GitHub (voir README)")
    print("  2. git push → CI/CD deploy automatiquement sur HF Space")
    print("  3. Le Space démarre, pull les modèles, génère les prédictions")
    print("=" * 60)


if __name__ == "__main__":
    main()

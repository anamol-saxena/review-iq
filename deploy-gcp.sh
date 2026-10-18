#!/usr/bin/env bash
# ============================================================
# Deploy Review Analyzer to Google Cloud Run
# ============================================================
set -e

echo "=== Review Analyzer — Google Cloud Run Deployment ==="

# 1. Check for gcloud CLI
if ! command -v gcloud &> /dev/null; then
  echo "Error: Google Cloud CLI ('gcloud') is not installed."
  echo "Install it with: brew install --cask google-cloud-sdk"
  echo "Or download from: https://cloud.google.com/sdk/docs/install"
  exit 1
fi

# 2. Check Authentication
CURRENT_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null || true)
if [ -z "$CURRENT_ACCOUNT" ]; then
  echo "Logging in to Google Cloud..."
  gcloud auth login
fi

# 3. Check or prompt for Project ID
CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null || true)
if [ -z "$CURRENT_PROJECT" ] || [ "$CURRENT_PROJECT" = "(unset)" ]; then
  read -rp "Enter your Google Cloud Project ID: " CURRENT_PROJECT
  gcloud config set project "$CURRENT_PROJECT"
else
  echo "Using current Google Cloud Project: $CURRENT_PROJECT"
fi

# 4. Region selection
REGION="${GCP_REGION:-us-central1}"
echo "Deploying to region: $REGION"

# 5. Enable necessary Google Cloud APIs
echo "Enabling required APIs (Cloud Run, Cloud Build, Artifact Registry)..."
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com

# 6. Extract environment variables from .env if present
ENV_FILE=".env"
GEMINI_KEY=""
APIFY_TOKEN=""
YELP_KEY=""

if [ -f "$ENV_FILE" ]; then
  GEMINI_KEY=$(grep -E '^GEMINI_API_KEY=' "$ENV_FILE" | cut -d '=' -f2- | tr -d '\r"')
  APIFY_TOKEN=$(grep -E '^APIFY_TOKEN=' "$ENV_FILE" | cut -d '=' -f2- | tr -d '\r"')
  YELP_KEY=$(grep -E '^YELP_API_KEY=' "$ENV_FILE" | cut -d '=' -f2- | tr -d '\r"')
fi

ENV_VARS=""
if [ -n "$GEMINI_KEY" ]; then
  ENV_VARS="GEMINI_API_KEY=${GEMINI_KEY}"
fi
if [ -n "$APIFY_TOKEN" ]; then
  if [ -n "$ENV_VARS" ]; then
    ENV_VARS="${ENV_VARS},APIFY_TOKEN=${APIFY_TOKEN}"
  else
    ENV_VARS="APIFY_TOKEN=${APIFY_TOKEN}"
  fi
fi
if [ -n "$YELP_KEY" ]; then
  if [ -n "$ENV_VARS" ]; then
    ENV_VARS="${ENV_VARS},YELP_API_KEY=${YELP_KEY}"
  else
    ENV_VARS="YELP_API_KEY=${YELP_KEY}"
  fi
fi


# 7. Deploy to Cloud Run using source deploy (Cloud Build builds the container)
echo "Building and deploying to Google Cloud Run..."
gcloud run deploy review-analyzer \
  --source . \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 120 \
  --set-env-vars "$ENV_VARS" \
  --quiet


echo ""
echo "=== Deployment Complete! ==="
gcloud run services describe review-analyzer --region "$REGION" --format="value(status.url)"

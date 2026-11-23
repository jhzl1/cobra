#!/usr/bin/env bash
# Copies one service's variables from the job environment into Railway, without
# deploying. deploy.yml maps the GitHub Environment into the job environment;
# this file decides which of those names each service gets.
#
# The lists mirror apps/<service>/.env.example and apps/<service>/src/config/env.ts.
# A name added there has to be added here, in deploy.yml's `env:` block, and as
# `preserve()` in .railway/railway.ts, or `railway config apply` deletes it.
#
# Usage: sync-railway-variables.sh <api|worker> <railway-environment>
set -euo pipefail

service="${1:?service name required}"
railway_environment="${2:?Railway environment required}"

# PORT is never set: Railway assigns it and the api listens on whatever it says.
case "$service" in
  api)
    required=(
      NODE_ENV
      APP_VERSION
      SUPABASE_URL
      SUPABASE_PUBLISHABLE_KEY
      SUPABASE_SECRET_KEY
      SUPABASE_JWKS_URL
      DATABASE_URL
      CREDENTIALS_MASTER_KEY
      CORS_ORIGINS
    )
    optional=(PUBLIC_URL)
    ;;
  worker)
    required=(
      NODE_ENV
      APP_VERSION
      SUPABASE_URL
      SUPABASE_SECRET_KEY
      DATABASE_URL
      CREDENTIALS_MASTER_KEY
    )
    optional=(TURN_CONCURRENCY)
    ;;
  *)
    echo "::error::Unknown service: $service"
    exit 1
    ;;
esac

# Checked up front because a GitHub Environment that never defined a value hands
# the job an empty string, and the service would then boot and die on env
# validation after the deploy had already replaced the healthy one.
missing=()
for name in "${required[@]}"; do
  [ -n "${!name:-}" ] || missing+=("$name")
done

if [ ${#missing[@]} -gt 0 ]; then
  echo "::error::Missing for $service in the GitHub Environment: ${missing[*]}"
  exit 1
fi

# An optional variable left empty in GitHub is skipped, not written as "": the
# api validates PUBLIC_URL as a URL when present, and an empty string fails it.
# Removing one that Railway already holds is done by hand, because
# `railway variable delete` has no --skip-deploys and would start a deploy of
# the previous build.
names=("${required[@]}")
for name in "${optional[@]}"; do
  if [ -n "${!name:-}" ]; then
    names+=("$name")
  else
    echo "$name is empty for $service: left as it is in Railway."
  fi
done

# One variable per call through stdin, so no value ever sits in a process's
# arguments. --skip-deploys because the deploy comes right after, from
# `railway up`, with every variable already in place.
for name in "${names[@]}"; do
  printf '%s' "${!name}" | railway variable set "$name" \
    --stdin \
    --service "$service" \
    --environment "$railway_environment" \
    --skip-deploys \
    >/dev/null
  echo "Set $name on $service."
done

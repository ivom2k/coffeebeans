#!/usr/bin/env bash
# Deploys one commit of main. The GitHub Actions key may run nothing but this script (a forced
# command in authorized_keys), and the SHA it sends arrives in SSH_ORIGINAL_COMMAND.
# By hand on the server, e.g. for a rollback:  /opt/kohvioad/deploy/deploy.sh <full commit sha>
set -euo pipefail

# All of it inside a function: bash reads a script while running it, and the checkout below can
# rewrite this file. A function is parsed in full before it starts.
main() {
  local sha="${1:-${SSH_ORIGINAL_COMMAND:-}}"
  if [[ ! "$sha" =~ ^[0-9a-f]{40}$ ]]; then
    echo "Usage: deploy.sh <40-character commit sha>" >&2
    exit 2
  fi

  # One deploy at a time, whether it came from CI or by hand.
  exec 9>/tmp/kohvioad-deploy.lock
  flock --nonblock 9 || { echo "Another deploy is running." >&2; exit 1; }

  cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")"

  # The compose file and Caddyfile come from the same commit as the images.
  git fetch --quiet origin main
  if ! git merge-base --is-ancestor "$sha" origin/main; then
    echo "$sha is not a commit on main." >&2
    exit 1
  fi
  git checkout --quiet --detach "$sha"

  # Overrides IMAGE_TAG from .env, which keeps the running version until this one is up.
  export IMAGE_TAG="$sha"
  # Only our images: Postgres and Caddy are updated deliberately (README.md).
  docker compose pull --quiet app migrate
  docker compose up --detach --remove-orphans
  # Applies a changed Caddyfile without a restart. An invalid one fails here, and Caddy keeps
  # serving with the previous config.
  docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile

  # Record what runs, so plain `docker compose` commands afterwards use the same images.
  if grep --quiet '^IMAGE_TAG=' .env; then
    sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=$sha/" .env
  else
    echo "IMAGE_TAG=$sha" >> .env
  fi

  # Unused images built over a week ago. A rollback further back pulls them from GHCR again.
  docker image prune --all --force --filter "until=168h" > /dev/null

  echo "Deployed $sha"
}

main "$@"

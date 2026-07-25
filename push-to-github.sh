#!/usr/bin/env bash
#
# Push Atelier to a GitHub repository.
#
#   1. Create an EMPTY repo on GitHub (no README, no .gitignore, no licence).
#   2. Run:  ./push-to-github.sh git@github.com:your-org/atelier.git
#      or:   ./push-to-github.sh https://github.com/your-org/atelier.git
#
# The commit history is already written. This only adds the remote and pushes.

set -euo pipefail

REMOTE="${1:-}"

if [ -z "$REMOTE" ]; then
  echo "Usage: ./push-to-github.sh <git-remote-url>"
  echo
  echo "  SSH:   git@github.com:your-org/atelier.git"
  echo "  HTTPS: https://github.com/your-org/atelier.git"
  exit 1
fi

if [ ! -d .git ]; then
  echo "No .git directory here. Run this from the project root."
  exit 1
fi

# .env must never reach GitHub. It is in .gitignore; this is the belt to that's braces.
if git ls-files --error-unmatch .env >/dev/null 2>&1; then
  echo "Refusing to push: .env is tracked by git. Run 'git rm --cached .env' first."
  exit 1
fi

if git remote | grep -qx origin; then
  echo "Updating existing 'origin' remote…"
  git remote set-url origin "$REMOTE"
else
  git remote add origin "$REMOTE"
fi

git push -u origin main

echo
echo "Pushed. Next steps:"
echo "  1. Import the repo at https://vercel.com/new"
echo "  2. Add every variable from .env.example to the Vercel project"
echo "  3. Set AUTH_URL to your production URL"
echo "  4. Add https://<your-domain>/api/auth/callback/google to the Google OAuth client"
echo "  5. Run 'npm run db:deploy' against the production database"

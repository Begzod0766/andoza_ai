#!/usr/bin/env bash
# Checks remote-deploy.sh's prune_old_images with a stand-in `docker`: it keeps the newest
# KEEP_IMAGES tags of each andoza_ai image (and always the one just deployed) and removes the rest.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
work="$(mktemp -d)"; trap 'rm -rf "$work"' EXIT

# The function alone, out of the script (the script itself deploys when run).
sed -n '/^prune_old_images() {/,/^}/p' "$here/../remote-deploy.sh" > "$work/fn.sh"
[ -s "$work/fn.sh" ] || { echo "FAIL: prune_old_images not found in remote-deploy.sh"; exit 1; }

cat > "$work/docker" <<'STUB'
#!/usr/bin/env bash
if [ "$1" = images ]; then
  case "$2" in
    */andoza_ai-backend)  printf '2026-11-15 10:0%s +0500\tb%s\n' 1 1 2 2 3 3 4 4 5 5 6 6 ;;
    */andoza_ai-frontend) printf '2026-11-15 10:0%s +0500\tf%s\n' 1 1 2 2 ;;
  esac
  exit 0
fi
if [ "$1" = image ] && [ "$2" = rm ]; then echo "$3" >> "$REMOVED"; exit 0; fi
echo "unexpected docker $*" >&2; exit 2
STUB
chmod +x "$work/docker"

run() { # run <IMAGE_TAG>
  : > "$work/removed"
  PATH="$work:$PATH" REMOVED="$work/removed" IMAGE_OWNER=me IMAGE_TAG="$1" KEEP_IMAGES=4 \
    bash -c "set -euo pipefail; source '$work/fn.sh'; prune_old_images"
  sort "$work/removed" | tr '\n' ' '
}

got="$(run b6)"
want="ghcr.io/me/andoza_ai-backend:b1 ghcr.io/me/andoza_ai-backend:b2 "
[ "$got" = "$want" ] || { echo "FAIL keep newest 4: got [$got] want [$want]"; exit 1; }

# The deployed tag is never removed, even when it is not among the newest.
got="$(run b1)"
want="ghcr.io/me/andoza_ai-backend:b2 "
[ "$got" = "$want" ] || { echo "FAIL keep deployed: got [$got] want [$want]"; exit 1; }

echo "PASS"

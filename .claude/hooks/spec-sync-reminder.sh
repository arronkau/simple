#!/usr/bin/env bash
# Stop hook for the `simple` repo.
# Reminds to keep spec docs in sync when src/model/** changed in the working
# tree without a matching spec edit. NON-BLOCKING: it only ever prints an
# informational systemMessage and always exits 0, so it can never block a stop
# or cause a loop. A pure refactor with no behavior change can ignore it.
set -u

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0

changed="$(git status --porcelain 2>/dev/null)" || exit 0
[ -n "$changed" ] || exit 0

model_changed=0
spec_changed=0
while IFS= read -r line; do
  path="${line:3}"          # strip the 2-char status code + space
  path="${path##* -> }"      # for renames, keep the destination path
  case "$path" in
    src/model/*) model_changed=1 ;;
    MODEL_SPEC.md|ENCUMBRANCE_SPEC.md|APP_SPEC.md|TASKS.md) spec_changed=1 ;;
  esac
done <<< "$changed"

if [ "$model_changed" -eq 1 ] && [ "$spec_changed" -eq 0 ]; then
  printf '%s\n' '{"systemMessage":"spec-sync: src/model/** changed but no spec doc (MODEL_SPEC / ENCUMBRANCE_SPEC / APP_SPEC / TASKS) was edited. If this changed behavior, run the spec-sync skill checklist before finishing. Pure refactors can ignore this."}'
fi

exit 0

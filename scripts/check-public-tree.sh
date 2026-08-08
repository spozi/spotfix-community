#!/usr/bin/env bash
set -euo pipefail

forbidden_files="$(
  git ls-files | rg \
    '(^|/)(node_modules|dist|build|\.gradle)/|\.(pem|key|p12|jks|keystore)$|(^|/)google-services\.json$|firebase-adminsdk|service-account|(^|/)(cleaner|supervisor)\.csv$' \
    || true
)"

if [[ -n "${forbidden_files}" ]]; then
  echo "Public-tree check failed: forbidden tracked files:" >&2
  echo "${forbidden_files}" >&2
  exit 1
fi

forbidden_text_files="$(
  rg -l --hidden \
    --glob '!.git/**' \
    --glob '!.gitignore' \
    --glob '!scripts/check-public-tree.sh' \
    --glob '!LICENSE' \
    '(BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|firebase-adminsdk|service[_ -]?account[_ -]?json[^=]*=.+|api\.uumspotfix\.izzus\.dev|uumspotfix\.izzus\.dev|869634719192|my\.uum\.spotfix|com\.uum\.spotfix|uum-fmd|\bUUM\b)' \
    . || true
)"

if [[ -n "${forbidden_text_files}" ]]; then
  echo "Public-tree check failed: private identifiers or secret markers found in:" >&2
  echo "${forbidden_text_files}" >&2
  exit 1
fi

echo "Public-tree check passed."

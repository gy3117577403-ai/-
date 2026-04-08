#!/usr/bin/env bash
# 仅用于更新 workflow 内时间戳注释并 push，强制触发 GitHub Actions 全新构建
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

WF=".github/workflows/deploy.yml"
if [[ ! -f "$WF" ]]; then
  echo "error: missing $WF" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "error: need node in PATH" >&2
  exit 1
fi

export STAMP="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

node -e "
const fs = require('fs');
const stamp = process.env.STAMP;
const p = '.github/workflows/deploy.yml';
let s = fs.readFileSync(p, 'utf8');
if (!/^# redeploy-stamp:/m.test(s)) {
  console.error('error: deploy.yml missing # redeploy-stamp line');
  process.exit(1);
}
s = s.replace(/^# redeploy-stamp:.*$/m, '# redeploy-stamp: ' + stamp);
fs.writeFileSync(p, s);
"

git add "$WF"
git commit -m "chore(ci): trigger redeploy ${STAMP}"
git push origin HEAD

echo "OK: pushed redeploy bump; open GitHub → Actions to watch the run."

#!/usr/bin/env bash
# 一键静默构建并推送（无交互）
set -euo pipefail

readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly BLUE='\033[0;34m'
readonly RESET='\033[0m'

readonly IMAGE="crpi-2acb2dabuutklbx4.cn-hangzhou.personal.cr.aliyuncs.com/zhiju-b/uss-app:latest"
readonly COMMIT_MSG='feat: auto-deploy from Agent'

trap 'echo -e "${RED}[✗] 发布脚本因错误终止，请查看上方日志。${RESET}" >&2' ERR

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

git add .
git commit -m "$COMMIT_MSG" || true

echo -e "${BLUE}[+] 正在执行云原生跨平台打包与推送，请死守终端...${RESET}"

if docker buildx version >/dev/null 2>&1; then
  if ! docker buildx build --platform linux/amd64 -t "$IMAGE" --push .; then
    echo -e "${RED}[!] buildx 失败，降级为 docker build + docker push${RESET}" >&2
    docker build -t "$IMAGE" .
    docker push "$IMAGE"
  fi
else
  echo -e "${RED}[!] 未检测到 buildx，使用 docker build + docker push${RESET}" >&2
  docker build -t "$IMAGE" .
  docker push "$IMAGE"
fi

echo -e "${GREEN}✅ 镜像推送彻底成功！请前往 Sealos 重启容器！${RESET}"

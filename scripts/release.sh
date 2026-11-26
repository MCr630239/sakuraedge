#!/usr/bin/env bash
# 樱刃工坊三件套 · GitHub Release 发版脚本
#
# 用法：
#   scripts/release.sh <工坊版本> <建模器版本> [zip 所在目录]
#
# 例：
#   scripts/release.sh 1.14.3 0.18.1
#   scripts/release.sh 1.14.3 0.18.1 /home/user/Doubao/chats/38456044449975554
#
# 前置：gh 已登录（gh auth status），仓库根有对应 zip：
#   SakuraEdgeStudio-<工坊版本>-Windows-x64.zip
#   BladeForge-<建模器版本>-Windows-x64.zip
#
# tag 用工坊版本：v1.14.3；附件命名就是客户端自动更新匹配的依据，别改。

set -euo pipefail

REPO="${REPO:-MCr630239/sakuraedge}"
STUDIO="${1:?用法: scripts/release.sh <工坊版本> <建模器版本> [zip目录]}"
FORGE="${2:?用法: scripts/release.sh <工坊版本> <建模器版本> [zip目录]}"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ZIP_DIR="${3:-$(dirname "$REPO_DIR")}"

TAG="v${STUDIO}"
SE_ZIP="${ZIP_DIR}/SakuraEdgeStudio-${STUDIO}-Windows-x64.zip"
BF_ZIP="${ZIP_DIR}/BladeForge-${FORGE}-Windows-x64.zip"

for f in "$SE_ZIP" "$BF_ZIP"; do
  if [ ! -f "$f" ]; then
    echo "缺少安装包: $f" >&2
    exit 1
  fi
done

if gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
  echo "Release $TAG 已存在，改为补传附件 / 更新说明" >&2
  gh release upload "$TAG" "$SE_ZIP" "$BF_ZIP" --repo "$REPO" --clobber
else
  gh release create "$TAG" --repo "$REPO" --target main \
    --title "${TAG} · 樱刃工坊 ${STUDIO} & Blade Forge ${FORGE}" \
    --notes "樱刃工坊 SakuraEdgeStudio ${STUDIO}、Blade Forge ${FORGE}。

客户端更新源可填 github:${REPO}（或 github:${REPO}@${TAG} 固定版本）。
附件命名必须保持：

- 工坊：SakuraEdgeStudio-版本-Windows-x64.zip
- 建模器：BladeForge-版本-Windows-x64.zip" \
    "$SE_ZIP" "$BF_ZIP"
fi

echo "完成：https://github.com/${REPO}/releases/tag/${TAG}"

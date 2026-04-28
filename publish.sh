#!/bin/bash

set -e
set +x

# 获取环境参数，默认为 prod
ENV=${1:-prod}

# 根据环境设置目标目录
if [ "$ENV" = "test" ]; then
  TARGET_DIR="/etc/caddy/html/wechat-stickers-test"
else
  TARGET_DIR="/etc/caddy/html/wechat-stickers"
fi

pnpm build
rm -rf ${TARGET_DIR}-new
cp -r dist ${TARGET_DIR}-new
if [ -d ${TARGET_DIR} ]; then
  mv ${TARGET_DIR} ${TARGET_DIR}-old
fi
mv ${TARGET_DIR}-new ${TARGET_DIR}
rm -rf ${TARGET_DIR}-old

echo "Build and deployment to ${TARGET_DIR} completed successfully."

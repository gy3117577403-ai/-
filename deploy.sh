#!/bin/bash

# 一键推送部署脚本
# 运行方式: ./deploy.sh "你的提交信息"

MESSAGE=${1:-"fix: 自动同步与部署修复"}

echo "📦 开始一键发布流程..."

echo "1. 添加文件到暂存区"
git add .

echo "2. 提交代码: $MESSAGE"
git commit -m "$MESSAGE"

echo "3. 推送到 GitHub (将触发云端自动部署)"
git push origin main

echo "✨ 部署推送完成！请前往云端监控构建状态。"

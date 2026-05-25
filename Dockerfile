# ---- Stage 1: Build ----
FROM docker.1ms.run/node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# 复制全部源码（先复制再安装，避免 COPY 覆盖 pnpm 符号链接）
COPY . .

# 国内 npm 镜像 + 添加 simple-git-hooks 到构建白名单
RUN printf 'registry=https://registry.npmmirror.com\n' > .npmrc \
    && node -e "const p=require('./package.json');p.pnpm.onlyBuiltDependencies.push('simple-git-hooks');require('fs').writeFileSync('package.json',JSON.stringify(p,null,2)+'\n')" \
    && pnpm install

# 按依赖顺序构建库包，再构建 docs
RUN pnpm -r --filter='./packages/core' --filter='./packages/vue' --filter='./packages/markdown' run build \
    && pnpm -C packages/docs run build

# ---- Stage 2: Production ----
FROM docker.1ms.run/nginx:alpine

COPY --from=builder /app/packages/docs/dist /usr/share/nginx/html

# SPA 路由 fallback
COPY <<'EOF' /etc/nginx/conf.d/default.conf
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
EOF

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

# Container image for the Gitalk 2.0 token endpoint.
#
# `dist/server.js` is built by esbuild before the image is assembled, and the
# bundle inlines @gitalk/proxy-core, which has no runtime dependencies. So the
# image needs nothing but a Node binary — no `npm install`, no node_modules.
#
#   pnpm --filter @gitalk/proxy-node build
#   docker build -t gitalk-proxy packages/proxy-node
#   docker run --rm -p 8787:8787 --env-file packages/proxy-worker/.env gitalk-proxy
#
# Secrets are passed as environment variables at run time; nothing is baked in.

FROM node:22-alpine

WORKDIR /app
COPY dist/server.js ./server.js

# Run unprivileged — the process needs no filesystem access beyond its own code.
USER node

ENV PORT=8787
EXPOSE 8787

CMD ["node", "server.js"]

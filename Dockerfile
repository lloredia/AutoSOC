FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8787
ENV HOST=0.0.0.0
ENV DEMO_MODE=true
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/lib ./lib
COPY --from=build /app/data ./data
RUN addgroup -S autosoc && adduser -S autosoc -G autosoc && chown -R autosoc:autosoc /app
USER autosoc
EXPOSE 8787
CMD ["node", "server/index.js"]

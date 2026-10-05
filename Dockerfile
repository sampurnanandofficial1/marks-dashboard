FROM node:24-alpine
WORKDIR /app
COPY backend/ ./backend/
COPY lib/grades.ts lib/seed.json ./lib/
ENV NODE_ENV=production
CMD ["node","--experimental-strip-types","backend/server.mjs"]

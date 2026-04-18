---
title: "Prisma vs Drizzle"
date: 2026-04-18
tags: [orm, database, typescript]
---

# Prisma vs Drizzle 비교

Prisma는 schema-first ORM. Schema 파일을 따로 두고 generate 명령으로 타입 생성.
Drizzle은 TypeScript-first ORM. Schema를 .ts 파일로 정의하면 타입이 바로 따라옴.

| | Prisma | Drizzle |
|---|---|---|
| Schema | .prisma DSL | .ts 파일 |
| Generate step | 필수 | 불필요 |
| Edge runtime | 제한적 | 잘 됨 |
| Migration | 자동 + manual | 자동 + manual |

PostgreSQL, MySQL, SQLite 모두 지원. 최근 Vercel/Cloudflare edge 환경에서는 Drizzle 선호도 증가.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Theses tab (ThesesVault API)

The **Theses** tab (`?tab=theses`) draws charts from the ThesesVault API (`https://thesesvault.palawansulibrary.com/api/v1`).
The browser never sees the key: it calls `/api/theses/[dataset]`, which adds the key on the server.

Set these in Vercel (Project → Settings → Environment Variables), then redeploy:

| Variable | Value |
|---|---|
| `THESESVAULT_API_KEY` | A key made in ThesesVault → Settings → API access (permissions: insights, demand, collection) |
| `THESESVAULT_API_URL` | Optional. Defaults to the address above. |

New charts added to the ThesesVault API (`insights.datasets`) appear here automatically: each one describes its own type
(`bar`, `hbar`, `line`, `doughnut`, `stacked`), labels and series, and `components/ThesesTab.tsx` draws it.

## Attendance tab (library attendance API)

The **Attendance** tab (`?tab=attendance`) draws visits, trends, breakdowns by college/program/facility/purpose, yearly
comparison and peak hours from `https://stat.palawansulibrary.com/api/v1` (aggregates only, no visitor names or IDs).
It calls `/api/stat/[dataset]`, which adds the key on the server. Set in Vercel, then redeploy:

| Variable | Value |
|---|---|
| `STAT_API_KEY` | A key made on stat.palawansulibrary.com → API Access (super-admin) |
| `STAT_API_URL` | Optional. Defaults to the address above. |

## Reservations tab (room reservation analytics API)

The **Reservations** tab (`?tab=reservations`) shows room usage, demand, cancellations, approvals backlog and recommendations from
`https://reserve.palawansulibrary.com/Web/analytics-api.php` (totals only: no names, e-mails or event titles).
It calls `/api/reservations/[report]`, which adds the key on the server. Set in Vercel, then redeploy:

| Variable | Value |
|---|---|
| `RESERVE_API_KEY` | A key made on the reservation site → Analytics → "Connect other apps (API)" (application admin) |
| `RESERVE_API_URL` | Optional. Defaults to the address above. |

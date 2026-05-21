# Farmers Dashboard

Dashboard de qualificação de leads para o time de Farmers.

## Tech Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Recharts
- Supabase Auth (@supabase/ssr)
- date-fns

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

Copy `.env.local` and fill in your credentials:

```
HUBSPOT_PAT=your_hubspot_pat
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

## Deployment to Vercel

1. Push this repository to GitHub
2. Go to [vercel.com](https://vercel.com) and import the GitHub repository
3. In the Vercel project settings, add all environment variables from `.env.local`:
   - `HUBSPOT_PAT`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Deploy

The app will be live at your Vercel URL. Authentication is handled by Supabase — create users in your Supabase project dashboard under Authentication > Users.

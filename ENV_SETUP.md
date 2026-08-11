# Environment Variables Setup

## Required Supabase Variables

Add these to your `.env.local` file:

```bash
# Supabase Configuration (Server-side)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here

# Supabase Configuration (Client-side - must match server values)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Site URL (for email redirects)
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## How to Get Your Supabase Credentials

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project (or create a new one)
3. Go to **Settings** → **API**
4. Copy:
   - **Project URL** → Use for both `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → Use for both `SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Example `.env.local`

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname
POSTGRES_URL=postgresql://user:password@host:5432/dbname

# Supabase
SUPABASE_URL=https://abcdefghijklmnop.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYzODk2NzI5MCwiZXhwIjoxOTU0NTQzMjkwfQ.example
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYzODk2NzI5MCwiZXhwIjoxOTU0NTQzMjkwfQ.example

# Site URL
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Auth Secret (for sessions)
AUTH_SECRET=your-random-secret-here

# Web Push (closed-tab /orders alerts)
# Generate with: npx web-push generate-vapid-keys --json
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_SUBJECT=mailto:hello@example.com
```

## After Adding Variables

1. **Restart your dev server** (stop and start `pnpm dev`)
2. **Test the connection**: Visit `http://localhost:3000/api/auth/test-connection`
3. All environment variables should show ✅ Set

## Web Push notes

- Run `npm run db:migrate:0020` once to create `staff_push_subscriptions`
- Run `npm run db:migrate:0021` once to create `guest_push_subscriptions` (order-confirmation alerts)
- Staff `/orders`: Enable alerts for closed-tab incoming orders
- Guest order confirmation: **Enable alerts** for accepted / kitchen started / ready / delay / complete
- On iPhone: Add the menu (or Orders) to Home Screen, open that app, then enable alerts
- On Mac Safari: use **HTTPS**. Plain `http://localhost` delivers pushes but **Show will not open the site** (Safari/WebKit). Run `npm run dev:https`, accept the cert, then re-enable alerts
- Optional: **File → Add to Dock** for more reliable notification clicks
- Push only works on HTTPS (or localhost) after VAPID keys are set — but Safari **open-on-click** needs real HTTPS
- `VAPID_SUBJECT` must be a valid `mailto:` address (Apple rejects domains like `*.local`)

## Important Notes

- **Never commit `.env.local` to git** (it's already in `.gitignore`)
- The `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL` should be **identical**
- The `SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` should be **identical**
- Use the **anon/public** key, NOT the service_role key (for security)


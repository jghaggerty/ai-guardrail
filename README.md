# AI Guardrail

AI Guardrail is a Vite + React application for diagnosing cognitive biases and heuristics in AI systems. It combines a Supabase backend (auth, database tables, and an `evaluate` Edge Function) with an interactive dashboard that lets teams run evaluations, review findings, and plan mitigation steps.

## Features
- Email/password authentication backed by Supabase.
- Guided configuration panel to choose heuristic types, system name, and iteration counts before starting an evaluation.
- Uses the `evaluate` Supabase Edge Function to generate findings, recommendations, and longitudinal trend data for bias analysis.
- Technical and simplified result views, downloadable report action, and ability to reset and rerun analyses quickly.
- History panel for reloading past evaluations along with a heuristics chart and recommendation list for each run.
- Built with shadcn/ui components, Tailwind CSS theming, and TanStack Query for API state.

## Tech stack
- Vite + React + TypeScript
- Supabase (authentication, database, Edge Functions)
- shadcn/ui, Tailwind CSS, Lucide icons
- TanStack Query, React Hook Form, Zod

## Getting started

### Prerequisites
- Node.js 18+ and npm installed.
- A Supabase project with URL and anon publishable key.
- Supabase CLI if you want to run the local Edge Function or database migrations (`supabase start`).

### Installation
1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env.local` file in the project root and provide your Supabase credentials:
   ```bash
   VITE_SUPABASE_URL=<your-supabase-url>
   VITE_SUPABASE_PUBLISHABLE_KEY=<your-supabase-anon-key>
   ```
3. (Optional) Start Supabase locally to exercise the `supabase/functions/evaluate` Edge Function and database tables:
   ```bash
   supabase start
   ```

### Development server
Run the Vite dev server at http://localhost:5173:
```bash
npm run dev
```

### Linting
Check code quality with ESLint:
```bash
npm run lint
```

### Project structure highlights
- `src/pages` contains the landing, auth, dashboard, and settings routes.
- `src/components` hosts UI for configuration, heuristics cards, charts, recommendations, and dialogs.
- `src/lib/api.ts` orchestrates calls to Supabase (including the `evaluate` function) and maps responses into frontend-friendly types.
- `supabase/` holds the project configuration, migrations, and edge function source.

## Deployment
You can deploy using your preferred static hosting for the Vite build output or publish directly via Lovable. For Supabase, deploy the `evaluate` Edge Function and database migrations to your project before serving the frontend.

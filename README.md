# PlanMyKids 🎯

A Next.js application for discovering extracurricular enrichment programs in San Francisco. Parents can search, filter, and review programs for swimming, art, chess, soccer, music, and more!

## Features ✨

- **Search & Filter**: Find programs by category, neighborhood, age range, and price
- **Program Details**: View comprehensive information about each program
- **Reviews & Ratings**: Read and write reviews for programs
- **Family Planner**: Track programs, set reminders, and manage your kids' activities
- **Add Programs**: Community-driven platform where anyone can add new programs
- **Responsive Design**: Works beautifully on mobile, tablet, and desktop

## Tech Stack 🛠

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Payments**: Stripe
- **Email**: Mailgun
- **Deployment**: Vercel (recommended)

## Prerequisites 📋

Before you begin, ensure you have:

- Node.js 18+ installed ([Download](https://nodejs.org/))
- npm or yarn package manager
- A Supabase account ([Sign up free](https://supabase.com))

## Local Setup 🚀

### 1. Clone & Install

```bash
cd sf-enrichment-hub
npm install
```

### 2. Set Up Supabase

1. **Create a new Supabase project**:
   - Go to [supabase.com](https://supabase.com)
   - Click "New Project"
   - Name it (e.g., "planmykids")
   - Choose a secure database password
   - Select a region close to you

2. **Run the database migration**:
   - In your Supabase project, go to the **SQL Editor**
   - Copy the contents of `supabase/migrations/20240101000000_initial_schema.sql`
   - Paste and run it to create the tables

3. **Load seed data** (optional but recommended):
   - In the SQL Editor, copy the contents of `supabase/seed.sql`
   - Paste and run it to add sample programs

4. **Get your API credentials**:
   - Go to **Settings** → **API**
   - Copy your `Project URL` and `anon/public` key

### 3. Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add your credentials:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser!

## Project Structure 📁

```
sf-enrichment-hub/
├── app/                      # Next.js App Router pages
│   ├── layout.tsx           # Root layout with navigation
│   ├── page.tsx             # Homepage
│   ├── programs/[id]/       # Program detail page
│   ├── camps/               # Camp listings
│   ├── birthday-venues/     # Birthday venue listings
│   ├── familyplanning/      # Family planner dashboard
│   ├── add-provider/        # Add new program page
│   └── api/                 # API routes
├── components/              # Reusable React components
├── lib/                     # Utility functions
│   ├── supabase.ts          # Supabase client
│   └── mailgun.ts           # Email sending
├── types/                   # TypeScript type definitions
├── supabase/                # Database files
│   ├── migrations/          # SQL migration files
│   ├── functions/           # Edge functions
│   └── seed.sql             # Sample data
└── public/                  # Static assets
```

## Deployment 🌐

### Deploy to Vercel (Recommended)

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "Import Project"
4. Select your repository
5. Add environment variables (same as `.env.local`)
6. Click "Deploy"

### Environment Variables for Production

Make sure to add these in your Vercel project settings:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `MAILGUN_API_KEY`
- `MAILGUN_DOMAIN`

## License 📄

MIT License - feel free to use this project however you like!

---

Built with ❤️ for SF families. Happy enriching!

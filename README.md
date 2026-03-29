# Milko Frontend

Milk delivery subscription platform frontend built with Next.js.

## Features

- Customer portal for browsing products and managing subscriptions
- Admin panel for managing products, customers, and subscriptions
- JWT-based authentication
- Role-based route protection
- Responsive design

## Tech Stack

- Next.js 14 (App Router)
- React 18
- TypeScript
- Axios for API calls

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Copy environment variables:
```bash
cp .env.example .env.local
```

3. Update `.env.local` with your configuration:
   - `NEXT_PUBLIC_API_BASE_URL` - Your backend API URL
   - `NEXT_PUBLIC_ADMIN_PANEL_PASSWORD` - **REQUIRED**: Set a strong password for admin panel access
     - This is an additional security layer - even users with admin role must enter this password
     - Default: `Admin@123!` (change this in production!)

4. Run development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
milko-frontend/
├── app/                    # Next.js App Router
│   ├── (customer)/        # Customer routes (grouped)
│   ├── admin/             # Admin routes
│   ├── auth/              # Authentication pages
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # Reusable components
│   ├── customer/         # Customer-specific components
│   ├── admin/            # Admin-specific components
│   └── shared/           # Shared components
├── lib/                   # Utilities and services
│   ├── api/              # API service layer
│   └── utils/            # Helper functions
├── hooks/                 # Custom React hooks
├── types/                 # TypeScript type definitions
└── middleware.ts          # Route protection middleware
```

## Routing Strategy

- **Customer Routes**: `/`, `/products`, `/subscribe`, `/dashboard`
- **Admin Routes**: `/admin/*` (all admin routes prefixed)
- **Auth Routes**: `/auth/login`, `/auth/signup`
- **Route Protection**: Middleware checks JWT and role before allowing access

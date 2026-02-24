# Add User Feature - Setup Instructions

## Step 1: Run Database Migration

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → select project `ciktllfgjablxwkheutw`
2. Go to **SQL Editor** → **New query**
3. Copy the contents of `supabase/add-user-setup.sql` and paste
4. Click **Run** (or Cmd+Enter)

## Step 2: Deploy the Edge Function

The Add User feature uses an Edge Function (requires Supabase service role). Deploy it:

```bash
# Install Supabase CLI (if not installed)
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project (project ref: ciktllfgjablxwkheutw)
supabase link --project-ref ciktllfgjablxwkheutw

# Deploy the create-user function (verify_jwt=false to avoid "Invalid JWT" with ES256 tokens)
supabase functions deploy create-user --no-verify-jwt
```

**Why `--no-verify-jwt`?** Supabase's gateway can reject valid JWTs (e.g. with ES256 signing). Our function still validates the user via `getUser()` inside the function, so it remains secure.

The service role key is automatically available to Edge Functions in your project.

## Step 3: Verify

1. Log in as admin at your app
2. Click **Add new user**
3. Fill the form (email, password, full name, role) and submit
4. Check **Supabase → Authentication → Users** for the new user
5. Check **Supabase → Table Editor → profiles** for the profile row with `employee_id` and `role`

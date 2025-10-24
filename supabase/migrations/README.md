# Database Migration

## Setup Instructions

Run the complete database setup file to create all tables, functions, triggers, and RLS policies.

### Using Supabase Dashboard (Recommended)

1. Go to https://supabase.com/dashboard
2. Select your project
3. Navigate to **SQL Editor**
4. Click **New Query**
5. Copy and paste contents of `00_complete_database_setup.sql`
6. Click **Run**
7. Check for success message: "✅ DATABASE SETUP COMPLETE!"

### What This Migration Creates

**Tables:**
- `profiles` - User profiles and subscription info
- `subscription_plans` - Available subscription tiers (free, basic, pro, enterprise)
- `user_tokens` - Token usage tracking
- `invoices` - Invoice data and extracted fields
- `ai_provider_usage` - AI API usage tracking

**Functions:**
- `is_user_admin()` - Check if user is admin (avoids RLS recursion)
- `handle_new_user()` - Auto-create profile when user signs up
- `protect_profile_fields()` - Prevent non-admins from changing sensitive fields
- `update_updated_at_column()` - Auto-update timestamps

**Triggers:**
- Auto-create profiles for new users
- Protect sensitive profile fields
- Update `updated_at` timestamps

**RLS Policies:**
- Users can view/update own data
- Admins can view/update all data
- Public can view subscription plans

### Verification

After running the migration, you should see:

```
✅ DATABASE SETUP COMPLETE!

Table Counts:
  - Profiles: X
  - Subscription Plans: 4
  - User Tokens: X
  - Invoices: X
  - AI Provider Usage: X

All tables, indexes, functions, triggers, and RLS policies created successfully!
```

Then a table showing all active RLS policies.

### Troubleshooting

**Error: "relation already exists"**
- The migration handles this with `CREATE TABLE IF NOT EXISTS`
- Safe to run even if tables already exist

**Error: "policy already exists"**
- The migration drops all existing policies first
- Safe to re-run

**Error: "infinite recursion detected"**
- This is fixed by the `is_user_admin()` function with `SECURITY DEFINER`
- If you still see this, re-run the migration

### Need Help?

See the main [SETUP.md](../../SETUP.md) for detailed setup instructions.

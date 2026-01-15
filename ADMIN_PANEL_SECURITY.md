# Admin Panel Security Setup

## Overview

The admin panel has **two layers of security**:

1. **Role-based access**: User must have `admin` role in the database
2. **Password gate**: Even admin users must enter an additional password to access the panel

This provides extra protection against unauthorized access, even if someone somehow gets admin role.

## Setting the Admin Panel Password

### Option 1: Environment Variable (Recommended)

Create a `.env.local` file in the `milko-frontend` directory:

```bash
NEXT_PUBLIC_ADMIN_PANEL_PASSWORD=YourStrongPasswordHere!
```

**Important**: 
- Use a strong, unique password
- Never commit `.env.local` to version control (it's already in `.gitignore`)
- Change the default password in production!

### Option 2: Default Password

If no environment variable is set, the default password is: `Admin@123!`

**⚠️ WARNING**: Always set a custom password in production using the environment variable!

## How It Works

1. User logs in with admin credentials
2. Gets redirected to `/admin`
3. **Password gate appears** - user must enter the admin panel password
4. If correct, access is granted for the current browser session
5. Password verification is stored in `sessionStorage` (clears when browser closes)

## Security Features

- ✅ Password verification is session-based (clears on browser close)
- ✅ Password is checked client-side (fast, but visible in code)
- ✅ Combined with role-based access for double protection
- ✅ "Return to website" link allows easy exit
- ✅ Failed attempts show error message

## Changing the Password

To change the admin panel password:

1. Update `NEXT_PUBLIC_ADMIN_PANEL_PASSWORD` in `.env.local`
2. Restart the Next.js development server
3. All existing sessions will need to re-enter the new password

## Production Deployment

When deploying to production:

1. Set `NEXT_PUBLIC_ADMIN_PANEL_PASSWORD` in your hosting platform's environment variables
2. Use a strong, randomly generated password
3. Share the password securely with authorized admin users only
4. Consider rotating the password periodically

## Troubleshooting

**Password not working?**
- Check that `NEXT_PUBLIC_ADMIN_PANEL_PASSWORD` is set correctly
- Restart the development server after changing the environment variable
- Clear browser sessionStorage: Open DevTools → Application → Session Storage → Clear

**Want to reset verification?**
- Close and reopen the browser, OR
- Clear sessionStorage manually in browser DevTools

const { supabase, supabaseAdmin } = require('../config/supabase');
const { query } = require('../config/database');
const { ValidationError, AuthenticationError } = require('../utils/errors');
const { transformUser } = require('../utils/transform');
const { generateToken } = require('../utils/jwt');

/**
 * Auth Service - SIMPLIFIED
 * Use Supabase Auth + database role, with proper fallback
 */

/**
 * Register a new customer
 */
const register = async (userData) => {
  const { name, email, password } = userData;

  console.log('[AUTH] Signup for:', email);

  if (!supabase) {
    throw new Error('Supabase is not configured');
  }

  // Sign up with Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        role: 'customer', // Default role
      },
    },
  });

  if (authError) {
    console.error('[AUTH] Signup error:', authError.message);
    
    if (authError.message?.includes('already registered') || 
        authError.message?.includes('already exists')) {
      throw new ValidationError('Email already registered. Please login instead.');
    }
    
    throw new ValidationError(authError.message || 'Registration failed');
  }

  if (!authData.user) {
    throw new ValidationError('Failed to create user');
  }

  // Try to create database profile (non-blocking)
  const userId = authData.user.id;
  try {
    await query(
      `INSERT INTO users (id, name, email, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [userId, name, email, 'customer']
    );
    console.log('[AUTH] User profile created in database');
  } catch (dbError) {
    console.warn('[AUTH] Database profile creation failed (non-critical):', dbError.message);
  }

  const user = {
    id: userId,
    name,
    email,
    role: 'customer',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Generate our own JWT token with 700-day expiration for production
  const jwtToken = generateToken({
    id: userId,
    email,
    role: 'customer',
  });

  return {
    user,
    token: jwtToken,
  };
};

/**
 * Login user - SIMPLE VERSION
 * 1. Authenticate with Supabase
 * 2. Try to get role from database
 * 3. If database fails, use Supabase metadata (but log warning)
 */
const login = async (email, password) => {
  console.log('[AUTH] Login for:', email);

  if (!supabase) {
    throw new Error('Supabase is not configured');
  }

  // 1. Authenticate with Supabase
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) {
    console.error('[AUTH] Login error:', authError.message);
    throw new AuthenticationError('Invalid email or password');
  }

  if (!authData.user) {
    throw new AuthenticationError('Invalid email or password');
  }

  if (!authData.session || !authData.session.access_token) {
    console.error('[AUTH] Login error: No session or access token received from Supabase');
    throw new AuthenticationError('Authentication failed. Please try again.');
  }

  const userId = authData.user.id;
  const name = authData.user.user_metadata?.name || authData.user.user_metadata?.full_name || email.split('@')[0] || 'User';
  
  // 2. Try to get role from database FIRST (with timeout)
  // Database is the source of truth - if it's available, use it
  let role = 'customer'; // Default
  let roleSource = 'default';
  
  try {
    console.log('[AUTH] Attempting to fetch role from database (source of truth)...');
    const profileResult = await Promise.race([
      query('SELECT role FROM users WHERE id = $1', [userId]),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout')), 5000) // 5 second timeout
      )
    ]);

    if (profileResult && profileResult.rows && profileResult.rows.length > 0) {
      role = profileResult.rows[0].role || 'customer';
      roleSource = 'database';
      console.log('[AUTH] ✅ Role from database (source of truth):', role);
      
      // IMPORTANT: Sync role to Supabase Auth metadata so it's available as fallback
      if (supabaseAdmin && role !== authData.user.user_metadata?.role) {
        setImmediate(async () => {
          try {
            await supabaseAdmin.auth.admin.updateUserById(userId, {
              user_metadata: {
                ...authData.user.user_metadata,
                role: role,
              },
            });
            console.log('[AUTH] ✅ Synced role to Supabase Auth metadata');
          } catch (syncError) {
            console.warn('[AUTH] Failed to sync role to metadata:', syncError.message);
          }
        });
      }
    } else {
      console.warn('[AUTH] ⚠️  User not found in database, using Supabase metadata');
      role = authData.user.user_metadata?.role || 'customer';
      roleSource = 'supabase-metadata';
    }
  } catch (dbError) {
    console.warn('[AUTH] ⚠️  Database query failed/timed out, using Supabase metadata as fallback');
    console.warn('[AUTH] Error:', dbError.message);
    role = authData.user.user_metadata?.role || 'customer';
    roleSource = 'supabase-metadata-fallback';
    
    // Try to sync database in background (non-blocking)
    setImmediate(async () => {
      try {
        await query(
          `INSERT INTO users (id, name, email, role, created_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW())
           ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, updated_at = NOW()`,
          [userId, name, email, role]
        );
        console.log('[AUTH] Background profile sync completed');
      } catch (bgError) {
        console.error('[AUTH] Background profile sync failed:', bgError.message);
      }
    });
  }

  // Normalize role to lowercase
  role = role.toLowerCase();
  
  console.log('[AUTH] ✅ Login successful');
  console.log('[AUTH] User ID:', userId);
  console.log('[AUTH] Email:', email);
  console.log('[AUTH] Role:', role, '(source:', roleSource, ')');
  console.log('[AUTH] Token received:', authData.session.access_token ? 'Yes' : 'No');

  const user = {
    id: userId,
    name,
    email,
    role,
    createdAt: authData.user.created_at || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Generate our own JWT token with 700-day expiration for production
  // This ensures users stay logged in for 700 days on milko.in
  const jwtToken = generateToken({
    id: userId,
    email,
    role,
  });

  return {
    user,
    token: jwtToken,
  };
};

/**
 * Get current user - SIMPLE VERSION
 */
const getCurrentUser = async (userId) => {
  console.log('[AUTH] getCurrentUser for:', userId);
  
  // Try database first
  try {
    const result = await Promise.race([
      query('SELECT id, name, email, role, created_at, updated_at FROM users WHERE id = $1', [userId]),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
    ]);

    if (result && result.rows && result.rows.length > 0) {
      const user = transformUser(result.rows[0]);
      console.log('[AUTH] getCurrentUser - Role from database:', user.role);
      return user;
    }
  } catch (error) {
    console.warn('[AUTH] getCurrentUser database query failed:', error.message);
  }

  // Fallback: get from Supabase Auth
  console.warn('[AUTH] Using Supabase Auth as fallback for getCurrentUser');
  const { data: { user: authUser }, error } = await supabase.auth.getUser();
  
  if (error || !authUser) {
    throw new AuthenticationError('User not found');
  }

  return {
    id: authUser.id,
    name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User',
    email: authUser.email,
    role: (authUser.user_metadata?.role || 'customer').toLowerCase(),
    createdAt: authUser.created_at,
    updatedAt: new Date().toISOString(),
  };
};

module.exports = {
  register,
  login,
  getCurrentUser,
};

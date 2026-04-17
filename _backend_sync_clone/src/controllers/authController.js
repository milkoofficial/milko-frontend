const authService = require('../services/authService');
const { ValidationError, AuthenticationError } = require('../utils/errors');

/**
 * Auth Controller
 * Handles authentication HTTP requests
 */

/**
 * Register new customer
 * POST /api/auth/signup
 */
const signup = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Basic validation
    if (!name || !email || !password) {
      throw new ValidationError('Name, email, and password are required');
    }

    if (password.length < 6) {
      throw new ValidationError('Password must be at least 6 characters');
    }

    const result = await authService.register({ name, email, password });

    res.status(201).json({
      success: true,
      data: result,
      message: 'User registered successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login user
 * POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new ValidationError('Email and password are required');
    }

    const result = await authService.login(email, password);

    res.json({
      success: true,
      data: result,
      message: 'Login successful',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user
 * GET /api/auth/me
 */
const getCurrentUser = async (req, res, next) => {
  try {
    const user = await authService.getCurrentUser(req.user.id);

    res.json({
      success: true,
      data: user, // Return user directly, not wrapped in { user }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Exchange Supabase token for our JWT token (for OAuth users)
 * POST /api/auth/exchange-token
 * Body: { token: string } - Supabase access token
 * Returns: { token: string } - Our JWT token with 700-day expiration
 */
const exchangeToken = async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token) {
      throw new ValidationError('Token is required');
    }

    // Verify Supabase token and get user
    const { supabase } = require('../config/supabase');
    if (!supabase) {
      throw new AuthenticationError('Supabase is not configured');
    }
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !authUser) {
      throw new AuthenticationError('Invalid or expired token');
    }

    // Get role from database
    const { query } = require('../config/database');
    let role = 'customer';
    try {
      const result = await query('SELECT role FROM users WHERE id = $1', [authUser.id]);
      if (result.rows.length > 0) {
        role = result.rows[0].role || 'customer';
      } else {
        role = authUser.user_metadata?.role || 'customer';
      }
    } catch {
      role = authUser.user_metadata?.role || 'customer';
    }

    // Generate our JWT token with 700-day expiration
    const { generateToken } = require('../utils/jwt');
    const jwtToken = generateToken({
      id: authUser.id,
      email: authUser.email,
      role: role.toLowerCase(),
    });

    res.json({
      success: true,
      data: { token: jwtToken },
      message: 'Token exchanged successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout user
 * POST /api/auth/logout
 * Note: Since we're using JWT, logout is handled client-side by removing token
 * This endpoint exists for consistency and future session-based auth
 */
const logout = async (req, res, next) => {
  try {
    // In a JWT system, logout is handled client-side
    // This endpoint can be used for logging/logging out events
    res.json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  signup,
  login,
  getCurrentUser,
  exchangeToken,
  logout,
};

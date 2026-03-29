const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const subscriptionRoutes = require('./routes/subscriptions');
const bannerRoutes = require('./routes/banners');
const adminRoutes = require('./routes/admin');
const contentRoutes = require('./routes/content');
const webhookRoutes = require('./routes/webhooks');
const couponRoutes = require('./routes/coupons');
const addressRoutes = require('./routes/addresses');
const orderRoutes = require('./routes/orders');
const walletRoutes = require('./routes/wallet');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
// NOTE:
// This backend is consumed cross-origin by the frontend during development
// (e.g. http://localhost:3000 -> http://localhost:3003). Helmet's default
// Cross-Origin-Resource-Policy: same-origin can make browsers treat API
// requests as "network errors" even when CORS allows them.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS configuration
// Allow both customer domain (milko.in) and admin subdomain (admin.milko.in)
// Also allow Vercel deployments and localhost for development
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  process.env.ADMIN_URL || 'http://localhost:3000',
  'https://milko.in',
  'https://www.milko.in',
  'https://admin.milko.in',
  'http://localhost:3000', // Development
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl requests, or server-to-server)
    if (!origin) {
      console.log('[CORS] Request with no origin - allowing');
      return callback(null, true);
    }
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      console.log('[CORS] ✅ Allowed origin:', origin);
      return callback(null, true);
    }
    
    // Allow localhost for development (any port)
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      console.log('[CORS] ✅ Allowed localhost origin:', origin);
      return callback(null, true);
    }
    
    // Allow .milko.in subdomains
    if (origin.endsWith('.milko.in') || origin === 'milko.in') {
      console.log('[CORS] ✅ Allowed milko.in domain:', origin);
      return callback(null, true);
    }
    
    // Allow Vercel preview deployments (*.vercel.app)
    if (origin.includes('.vercel.app')) {
      console.log('[CORS] ✅ Allowed Vercel deployment:', origin);
      return callback(null, true);
    }
    
    // In production, be more strict - log blocked origins
    console.warn('[CORS] ❌ Blocked origin:', origin);
    console.log('[CORS] Allowed origins:', allowedOrigins);
    callback(new Error(`Not allowed by CORS. Origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Webhooks FIRST: need raw body for Razorpay signature verification (must be before express.json)
app.use('/api/webhooks', webhookRoutes);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler
app.use(notFound);

// Error handler (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;

const express = require('express');
const router = express.Router();
const multer = require('multer');
const adminController = require('../controllers/adminController');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');

/**
 * Admin Routes
 * Base path: /api/admin
 * All routes require authentication AND admin role
 */

// Apply authentication and admin check to all routes
router.use(authenticate);
router.use(requireAdmin);

// Configure multer for image uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

// Products
router.get('/products', adminController.getAllProducts);
router.get('/products/:id', adminController.getProductById);
router.post('/products', upload.single('image'), adminController.createProduct);
router.put('/products/:id', upload.single('image'), adminController.updateProduct);
router.delete('/products/:id', adminController.deleteProduct);

// Product Images
router.post('/products/:id/images', upload.single('image'), adminController.addProductImage);
router.put('/products/:id/images/reorder', adminController.reorderProductImages);
router.delete('/products/:id/images/:imageId', adminController.deleteProductImage);

// Product Variations
router.post('/products/:id/variations', adminController.addProductVariation);
router.put('/products/:id/variations/:variationId', adminController.updateProductVariation);
router.delete('/products/:id/variations/:variationId', adminController.deleteProductVariation);

// Product Reviews
router.post('/products/:id/reviews', adminController.addProductReview);
router.put('/products/:id/reviews/:reviewId', adminController.updateProductReview);
router.delete('/products/:id/reviews/:reviewId', adminController.deleteProductReview);

// Users
router.get('/users', adminController.getAllUsers);
router.get('/users/:id', adminController.getUserById);

// Orders & Customers
router.get('/orders', adminController.getAllOrders);
router.get('/orders/pending-count', adminController.getPendingOrdersCount);
router.get('/orders/:id', adminController.getOrderById);
router.post('/orders/:id/mark-package-prepared', adminController.markOrderAsPackagePrepared);
router.post('/orders/:id/mark-out-for-delivery', adminController.markOrderAsOutForDelivery);
router.post('/orders/:id/mark-delivered', adminController.markOrderAsDelivered);
router.post('/orders/:id/mark-fulfilled', adminController.markOrderAsFulfilled);
router.get('/order-deliveries', adminController.listOrderDeliveries);
router.get('/customers', adminController.getCustomerStats);
router.get('/feedback', adminController.getFeedback);

// Subscriptions
router.get('/subscriptions', adminController.getAllSubscriptions);
router.get('/subscriptions/:id', adminController.getSubscriptionById);
router.post('/subscriptions/:id/pause', adminController.pauseSubscription);
router.post('/subscriptions/:id/resume', adminController.resumeSubscription);

// Deliveries
router.get('/deliveries', adminController.getDeliveries);
router.put('/deliveries/:id', adminController.updateDeliveryStatus);

// Banners
router.get('/banners', adminController.getAllBanners);
router.post('/banners', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'mobileImage', maxCount: 1 }]), adminController.createBanner);
router.put('/banners/:id', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'mobileImage', maxCount: 1 }]), adminController.updateBanner);
router.delete('/banners/:id', adminController.deleteBanner);

// Site Content (Terms, Privacy, About, Contact, Reviews)
router.get('/content', adminController.getAllSiteContent);
router.get('/content/:type', adminController.getSiteContentByType);
router.put('/content/:type', adminController.upsertSiteContent);
router.patch('/content/:type/status', adminController.toggleContentStatus);

// Logo (upload to Cloudinary, store in site_content type 'logo')
router.post('/logo', upload.single('image'), adminController.upsertLogo);

// Categories
router.get('/categories', adminController.getAllCategories);
router.post('/categories', adminController.createCategory);
router.put('/categories/:id', adminController.updateCategory);
router.delete('/categories/:id', adminController.deleteCategory);

// Coupons
router.get('/coupons', adminController.getAllCoupons);
router.get('/coupons/:id', adminController.getCouponById);
router.post('/coupons', adminController.createCoupon);
router.put('/coupons/:id', adminController.updateCoupon);
router.delete('/coupons/:id', adminController.deleteCoupon);

// Analytics
router.get('/analytics/cart-abandonment', adminController.getCartAbandonment);

module.exports = router;


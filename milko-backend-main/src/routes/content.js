const express = require('express');
const router = express.Router();
const siteContentModel = require('../models/siteContent');

/**
 * Public Content Routes
 * Base path: /api/content
 * Public access to site content
 */

/**
 * Get content by type (public)
 * GET /api/content/:type
 * Special case: 'coming_soon' always returns (admin fetch) with enabled = isActive for middleware.
 */
router.get('/:type', async (req, res, next) => {
  try {
    const { type } = req.params;

    if (type === 'coming_soon') {
      const content = await siteContentModel.getContentByTypeAdmin('coming_soon');
      if (!content) {
        return res.json({
          success: true,
          data: { contentType: 'coming_soon', enabled: false, isActive: false },
        });
      }
      return res.json({
        success: true,
        data: { ...content, enabled: content.isActive },
      });
    }

    const content = await siteContentModel.getContentByType(type);

    if (!content) {
      return res.status(404).json({
        success: false,
        error: 'Content not found',
      });
    }

    res.json({
      success: true,
      data: content,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

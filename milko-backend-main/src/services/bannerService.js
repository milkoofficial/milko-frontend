const bannerModel = require('../models/banner');
const { uploadImage, deleteImage } = require('../config/cloudinary');
const { ValidationError, NotFoundError } = require('../utils/errors');

/**
 * Banner Service
 * Handles banner business logic
 */

/**
 * Get all active banners (for homepage)
 * @returns {Promise<Array>} Array of active banners
 */
const getActiveBanners = async () => {
  return await bannerModel.getActiveBanners();
};

/**
 * Get all banners (for admin)
 * @returns {Promise<Array>} Array of all banners
 */
const getAllBanners = async () => {
  return await bannerModel.getAllBanners();
};

/**
 * Get banner by ID
 * @param {string} bannerId - Banner ID
 * @returns {Promise<Object>} Banner object
 */
const getBannerById = async (bannerId) => {
  const banner = await bannerModel.getBannerById(bannerId);
  if (!banner) {
    throw new NotFoundError('Banner');
  }
  return banner;
};

/**
 * Create new banner (admin only)
 * @param {Object} bannerData - Banner data
 * @param {Object} imageFile - Desktop image file (required)
 * @param {Object} mobileImageFile - Mobile image file (optional)
 * @returns {Promise<Object>} Created banner
 */
const createBanner = async (bannerData, imageFile, mobileImageFile = null) => {
  // Parse form data - handle checkbox values (can be string "true"/"false" or boolean)
  const title = bannerData.title || null;
  const description = bannerData.description || null;
  const link = bannerData.link || null; // Optional link URL
  const orderIndex = bannerData.orderIndex ? parseInt(bannerData.orderIndex) : 0;
  
  // Handle isActive checkbox - can be string "true"/"false", boolean, or undefined
  let isActive = true; // Default to true
  if (bannerData.isActive !== undefined) {
    if (typeof bannerData.isActive === 'string') {
      isActive = bannerData.isActive === 'true' || bannerData.isActive === 'on';
    } else {
      isActive = Boolean(bannerData.isActive);
    }
  }

  // Handle adaptToFirstImage checkbox
  let adaptToFirstImage = false;
  if (bannerData.adaptToFirstImage !== undefined) {
    if (typeof bannerData.adaptToFirstImage === 'string') {
      adaptToFirstImage = bannerData.adaptToFirstImage === 'true' || bannerData.adaptToFirstImage === 'on';
    } else {
      adaptToFirstImage = Boolean(bannerData.adaptToFirstImage);
    }
  }

  // Validate desktop image file is required
  if (!imageFile) {
    throw new ValidationError('Desktop image file is required');
  }

  // Validate file size (max 20MB)
  const maxFileSize = 20 * 1024 * 1024; // 20MB
  if (imageFile.size > maxFileSize) {
    throw new ValidationError(`Desktop image file is too large (${(imageFile.size / (1024 * 1024)).toFixed(2)}MB). Maximum size is 20MB. Please compress the image.`);
  }

  if (mobileImageFile && mobileImageFile.size > maxFileSize) {
    throw new ValidationError(`Mobile image file is too large (${(mobileImageFile.size / (1024 * 1024)).toFixed(2)}MB). Maximum size is 20MB. Please compress the image.`);
  }

  // STEP 1: Upload desktop image to Cloudinary FIRST (before database save)
  // This ensures image is in Cloudinary even if database save fails
  let uploadResult;
  try {
    // Debug: Check if file buffer exists
    if (!imageFile.buffer) {
      console.error('[BANNER] ❌ No file buffer found. File object:', {
        fieldname: imageFile.fieldname,
        originalname: imageFile.originalname,
        encoding: imageFile.encoding,
        mimetype: imageFile.mimetype,
        size: imageFile.size,
        hasBuffer: !!imageFile.buffer,
      });
      throw new ValidationError('File buffer is missing. Please ensure the file is properly uploaded.');
    }

    const fileSizeMB = (imageFile.size / (1024 * 1024)).toFixed(2);
    console.log('[BANNER] Uploading desktop image to Cloudinary...', {
      filename: imageFile.originalname,
      size: imageFile.size,
      sizeMB: fileSizeMB,
      mimetype: imageFile.mimetype,
      bufferSize: imageFile.buffer.length,
    });

    uploadResult = await uploadImage(imageFile.buffer, {
      resource_type: 'image',
      folder: 'milko/banners',
      mimeType: imageFile.mimetype, // Pass MIME type for proper data URI
    });
    
    console.log('[BANNER] ✅ Image uploaded to Cloudinary:', {
      url: uploadResult.url,
      publicId: uploadResult.publicId,
    });
  } catch (error) {
    console.error('[BANNER] ❌ Desktop image Cloudinary upload failed:', {
      error: error.message || error.toString(),
      stack: error.stack,
      filename: imageFile?.originalname,
      errorObject: error,
    });
    
    // Extract meaningful error message
    const errorMessage = error.message || error.toString() || 'Unknown error';
    throw new Error(`Failed to upload desktop image to Cloudinary: ${errorMessage}`);
  }

  // STEP 2: Upload mobile image if provided (ONE BY ONE - sequentially)
  let mobileUploadResult = null;
  if (mobileImageFile) {
    try {
      if (!mobileImageFile.buffer) {
        console.error('[BANNER] ❌ No mobile file buffer found');
        throw new ValidationError('Mobile image file buffer is missing');
      }

      const mobileFileSizeMB = (mobileImageFile.size / (1024 * 1024)).toFixed(2);
      console.log('[BANNER] Uploading mobile image to Cloudinary (after desktop image)...', {
        filename: mobileImageFile.originalname,
        size: mobileImageFile.size,
        sizeMB: mobileFileSizeMB,
        mimetype: mobileImageFile.mimetype,
        bufferSize: mobileImageFile.buffer.length,
      });
      
      // Upload mobile image sequentially (one by one)
      mobileUploadResult = await uploadImage(mobileImageFile.buffer, {
        resource_type: 'image',
        folder: 'milko/banners/mobile',
        mimeType: mobileImageFile.mimetype,
      });
      
      console.log('[BANNER] ✅ Mobile image uploaded to Cloudinary:', {
        url: mobileUploadResult.url,
        publicId: mobileUploadResult.publicId,
      });
    } catch (error) {
      console.error('[BANNER] ❌ Mobile image Cloudinary upload failed:', {
        error: error.message || error.toString(),
        stack: error.stack,
        filename: mobileImageFile?.originalname,
        errorObject: error,
      });
      
      // If mobile upload fails, delete the desktop image that was already uploaded
      if (uploadResult && uploadResult.publicId) {
        try {
          console.log('[BANNER] Cleaning up desktop image due to mobile upload failure...');
          await deleteImage(uploadResult.publicId);
          console.log('[BANNER] ✅ Desktop image cleaned up');
        } catch (cleanupError) {
          console.error('[BANNER] ⚠️  Failed to cleanup desktop image:', cleanupError.message);
        }
      }
      
      // Extract meaningful error message
      const errorMessage = error.message || error.toString() || 'Unknown error';
      throw new Error(`Failed to upload mobile image to Cloudinary: ${errorMessage}`);
    }
  }

  // STEP 3: Save banner metadata to database with Cloudinary URLs
  try {
    const banner = await bannerModel.createBanner({
      title,
      description,
      imageUrl: uploadResult.url, // Desktop Cloudinary URL
      imagePublicId: uploadResult.publicId, // Desktop Cloudinary public ID
      mobileImageUrl: mobileUploadResult?.url || null, // Mobile Cloudinary URL
      mobileImagePublicId: mobileUploadResult?.publicId || null, // Mobile Cloudinary public ID
      link: link || null, // Optional link URL
      orderIndex,
      isActive,
      adaptToFirstImage,
    });
    console.log('[BANNER] ✅ Banner saved to database with Cloudinary image URLs');
    return banner;
  } catch (error) {
    // If database save fails, the images are already in Cloudinary
    console.error('[BANNER] ❌ Database save failed, but images are in Cloudinary');
    console.error('[BANNER] Database error:', error.message);
    
    throw new Error(`Images uploaded to Cloudinary successfully, but failed to save banner to database: ${error.message}`);
  }
};

/**
 * Update banner (admin only)
 * @param {string} bannerId - Banner ID
 * @param {Object} updates - Fields to update
 * @param {Object} imageFile - New desktop image file (optional)
 * @param {Object} mobileImageFile - New mobile image file (optional)
 * @returns {Promise<Object>} Updated banner
 */
const updateBanner = async (bannerId, updates, imageFile = null, mobileImageFile = null) => {
  const banner = await bannerModel.getBannerById(bannerId);
  if (!banner) {
    throw new NotFoundError('Banner');
  }

  // Handle desktop image upload if new image provided
  if (imageFile) {
    // Delete old desktop image from Cloudinary
    if (banner.imagePublicId) {
      try {
        await deleteImage(banner.imagePublicId);
      } catch (error) {
        console.error('Failed to delete old desktop banner image:', error);
        // Continue even if deletion fails
      }
    }

    // Upload new desktop image
    const uploadResult = await uploadImage(imageFile.buffer, {
      resource_type: 'image',
      folder: 'milko/banners',
    });

    updates.imageUrl = uploadResult.url;
    updates.imagePublicId = uploadResult.publicId;
  }

  // Handle mobile image upload if new image provided
  if (mobileImageFile) {
    // Delete old mobile image from Cloudinary
    if (banner.mobileImagePublicId) {
      try {
        await deleteImage(banner.mobileImagePublicId);
      } catch (error) {
        console.error('Failed to delete old mobile banner image:', error);
        // Continue even if deletion fails
      }
    }

    // Upload new mobile image
    const mobileUploadResult = await uploadImage(mobileImageFile.buffer, {
      resource_type: 'image',
      folder: 'milko/banners/mobile',
    });

    updates.mobileImageUrl = mobileUploadResult.url;
    updates.mobileImagePublicId = mobileUploadResult.publicId;
  }

  // Handle orderIndex conversion
  if (updates.orderIndex !== undefined) {
    updates.orderIndex = parseInt(updates.orderIndex);
  }

  // Handle link - convert empty string to null
  if (updates.link !== undefined) {
    updates.link = updates.link || null;
  }

  // Handle adaptToFirstImage checkbox
  if (updates.adaptToFirstImage !== undefined) {
    if (typeof updates.adaptToFirstImage === 'string') {
      updates.adaptToFirstImage = updates.adaptToFirstImage === 'true' || updates.adaptToFirstImage === 'on';
    } else {
      updates.adaptToFirstImage = Boolean(updates.adaptToFirstImage);
    }
  }

  return await bannerModel.updateBanner(bannerId, updates);
};

/**
 * Delete banner (admin only)
 * @param {string} bannerId - Banner ID
 * @returns {Promise<Object>} Deleted banner
 */
const deleteBanner = async (bannerId) => {
  const banner = await bannerModel.getBannerById(bannerId);
  if (!banner) {
    throw new NotFoundError('Banner');
  }

  // Delete desktop image from Cloudinary
  if (banner.imagePublicId) {
    try {
      await deleteImage(banner.imagePublicId);
    } catch (error) {
      console.error('Failed to delete desktop banner image from Cloudinary:', error);
      // Continue even if deletion fails
    }
  }

  // Delete mobile image from Cloudinary
  if (banner.mobileImagePublicId) {
    try {
      await deleteImage(banner.mobileImagePublicId);
    } catch (error) {
      console.error('Failed to delete mobile banner image from Cloudinary:', error);
      // Continue even if deletion fails
    }
  }

  // Delete from database
  return await bannerModel.deleteBanner(bannerId);
};

module.exports = {
  getActiveBanners,
  getAllBanners,
  getBannerById,
  createBanner,
  updateBanner,
  deleteBanner,
};




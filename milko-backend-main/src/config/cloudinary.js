const cloudinary = require('cloudinary').v2;
require('dotenv').config();

/**
 * Cloudinary Configuration
 * Used for image uploads (product images)
 */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  timeout: 60000, // 60 seconds timeout for uploads
  secure: true,
});

/**
 * Upload image to Cloudinary
 * @param {Buffer|string} file - File buffer or file path
 * @param {Object} options - Upload options
 * @returns {Promise<Object>} Upload result with URL
 */
const uploadImage = async (file, options = {}) => {
  try {
    // Check if Cloudinary is configured
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      const missing = [];
      if (!process.env.CLOUDINARY_CLOUD_NAME) missing.push('CLOUDINARY_CLOUD_NAME');
      if (!process.env.CLOUDINARY_API_KEY) missing.push('CLOUDINARY_API_KEY');
      if (!process.env.CLOUDINARY_API_SECRET) missing.push('CLOUDINARY_API_SECRET');
      throw new Error(`Cloudinary credentials are not configured. Missing: ${missing.join(', ')}. Please add these to your .env file.`);
    }

    console.log('[CLOUDINARY] Starting upload...', {
      hasBuffer: Buffer.isBuffer(file),
      bufferSize: Buffer.isBuffer(file) ? file.length : 'N/A',
      folder: options.folder || 'milko/products',
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      hasApiKey: !!process.env.CLOUDINARY_API_KEY,
      hasApiSecret: !!process.env.CLOUDINARY_API_SECRET,
    });

    // Handle both buffer and file path
    if (Buffer.isBuffer(file)) {
      // For large files (>5MB), use upload_stream instead of data URI to avoid timeout
      const fileSizeMB = file.length / (1024 * 1024);
      const useStream = fileSizeMB > 5;
      
      console.log('[CLOUDINARY] File info:', {
        bufferSize: file.length,
        fileSizeMB: fileSizeMB.toFixed(2),
        useStream: useStream,
        folder: options.folder || 'milko/products',
      });
      
      try {
        // Remove mimeType from options as it's not a Cloudinary option
        const { mimeType: _, ...uploadOptions } = {
          folder: options.folder || 'milko/products',
          resource_type: options.resource_type || 'image',
          ...options,
        };
        delete uploadOptions.mimeType; // Ensure it's removed
        
        let result;
        
        // Always use upload_stream for better reliability and timeout handling
        // This works better than data URI for all file sizes
        console.log('[CLOUDINARY] Using upload_stream for reliable upload...');
        const timeoutDuration = useStream ? 120000 : 90000; // 120s for large, 90s for small
        
        result = await new Promise((resolve, reject) => {
          let timeoutId;
          let isResolved = false;
          
          const uploadStream = cloudinary.uploader.upload_stream(
            uploadOptions,
            (error, uploadResult) => {
              if (isResolved) return; // Prevent multiple calls
              isResolved = true;
              
              if (timeoutId) clearTimeout(timeoutId);
              
              if (error) {
                console.error('[CLOUDINARY] Stream upload error:', {
                  message: error.message,
                  http_code: error.http_code,
                  name: error.name,
                });
                reject(error);
              } else {
                resolve(uploadResult);
              }
            }
          );
          
          // Handle stream errors
          uploadStream.on('error', (streamError) => {
            if (isResolved) return;
            isResolved = true;
            if (timeoutId) clearTimeout(timeoutId);
            console.error('[CLOUDINARY] Stream error:', streamError);
            reject(streamError);
          });
          
          // Add timeout protection
          timeoutId = setTimeout(() => {
            if (isResolved) return;
            isResolved = true;
            uploadStream.destroy();
            reject(new Error(`Upload timeout after ${timeoutDuration / 1000} seconds. The image may be too large or network connection is slow.`));
          }, timeoutDuration);
          
          // Write buffer to stream
          uploadStream.end(file);
        });
        
        console.log('[CLOUDINARY] ✅ Upload successful:', {
          url: result.secure_url,
          publicId: result.public_id,
          format: result.format,
          width: result.width,
          height: result.height,
        });
        
        return {
          url: result.secure_url,
          publicId: result.public_id,
        };
      } catch (uploadError) {
        console.error('[CLOUDINARY] Upload error:', {
          message: uploadError.message,
          http_code: uploadError.http_code,
          name: uploadError.name,
          error: uploadError,
        });
        
        // Extract meaningful error message
        let errorMessage = 'Unknown Cloudinary error';
        
        // Handle timeout errors specifically
        if (uploadError.http_code === 499 || uploadError.name === 'TimeoutError' || uploadError.message?.includes('timeout')) {
          errorMessage = 'Upload timeout - the image file may be too large or network connection is slow. Please try again or use a smaller image.';
        } else if (uploadError.message) {
          errorMessage = uploadError.message;
        } else if (uploadError.http_code) {
          errorMessage = `Cloudinary upload failed with HTTP ${uploadError.http_code}`;
        } else if (typeof uploadError === 'string') {
          errorMessage = uploadError;
        } else if (uploadError.error && typeof uploadError.error === 'object') {
          // Handle nested error objects
          errorMessage = uploadError.error.message || JSON.stringify(uploadError.error);
        } else {
          errorMessage = JSON.stringify(uploadError);
        }
        
        throw new Error(errorMessage);
      }
    } else {
      // If it's a file path or data URI
      console.log('[CLOUDINARY] Uploading file path/data URI...');
      const result = await cloudinary.uploader.upload(file, {
        folder: options.folder || 'milko/products',
        resource_type: options.resource_type || 'image',
        ...options,
      });
      console.log('[CLOUDINARY] ✅ Upload successful:', {
        url: result.secure_url,
        publicId: result.public_id,
      });
      return {
        url: result.secure_url,
        publicId: result.public_id,
      };
    }
  } catch (error) {
    console.error('[CLOUDINARY] Upload error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      http_code: error.http_code,
      error: error,
    });
    
    // Extract meaningful error message
    let errorMessage = 'Unknown Cloudinary error';
    
    // Handle timeout errors specifically
    if (error.http_code === 499 || error.name === 'TimeoutError' || error.message?.includes('timeout')) {
      errorMessage = 'Upload timeout - the image file may be too large or network connection is slow. Please try again or use a smaller image.';
    } else if (error.message) {
      errorMessage = error.message;
    } else if (error.http_code) {
      errorMessage = `Cloudinary upload failed with HTTP ${error.http_code}`;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error.error && typeof error.error === 'object') {
      // Handle nested error objects (like {"error":{"message":"..."}})
      errorMessage = error.error.message || JSON.stringify(error.error);
    } else {
      // Try to extract useful info from error object
      errorMessage = error.toString() || JSON.stringify(error);
    }
    
    throw new Error(`Failed to upload image to Cloudinary: ${errorMessage}`);
  }
};

/**
 * Delete image from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise<Object>} Deletion result
 */
const deleteImage = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw new Error('Failed to delete image');
  }
};

module.exports = {
  uploadImage,
  deleteImage,
  cloudinary,
};


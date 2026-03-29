-- Site Content Table
-- Stores editable content like Terms, Privacy, About, Contact, etc.

CREATE TABLE IF NOT EXISTS site_content (
  id SERIAL PRIMARY KEY,
  content_type VARCHAR(50) UNIQUE NOT NULL, -- 'terms', 'privacy', 'about', 'contact', 'reviews'
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB, -- For storing additional data like contact details, review settings, etc.
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_site_content_type ON site_content(content_type);
CREATE INDEX IF NOT EXISTS idx_site_content_active ON site_content(is_active);

-- Insert default content
INSERT INTO site_content (content_type, title, content, metadata) VALUES
  ('terms', 'Terms and Conditions', 'Default terms and conditions content. Please update this content.', '{}'),
  ('privacy', 'Privacy Policy', 'Default privacy policy content. Please update this content.', '{}'),
  ('about', 'About Us', 'Default about us content. Please update this content.', '{}'),
  ('contact', 'Contact Us', 'Contact information', '{"email": "contact@milko.in", "phone": "+91 1234567890", "address": "Your Address Here"}'),
  ('reviews', 'Reviews Settings', 'Reviews management settings', '{"allowPublicReviews": true, "requireApproval": true}'),
  -- pincodes: metadata.serviceablePincodes = [{"pincode":"110001","deliveryTime":"1h"}, ...]
  -- deliveryTime: "1h", "2h", "15m", "30m" etc. (displayed as 1hr, 2hr, 15m in header)
  ('pincodes', 'Pincode Settings', 'Delivery pincode settings', '{"serviceablePincodes": []}'),
  -- logo: metadata.imageUrl (Cloudinary), metadata.imagePublicId, metadata.widthPx (40–320)
  ('logo', 'Logo', '', '{"widthPx": 120}')
ON CONFLICT (content_type) DO NOTHING;

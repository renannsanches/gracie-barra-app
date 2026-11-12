-- Fotos do feed também em JPEG: o Safari (iPhone) não gera WebP a partir do canvas.
UPDATE storage.buckets SET allowed_mime_types = ARRAY['image/webp','image/jpeg'] WHERE id = 'feed';

export const ALLOWED_ARTICLE_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/jpg',
]

export const ALLOWED_ARTICLE_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif']

export const MAX_ARTICLE_IMAGE_BYTES = 10 * 1024 * 1024 // 10 MB

export const ARTICLE_IMAGE_ACCEPT =
  'image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif'

export const SUPPORTED_FORMATS_LABEL = 'JPEG, JPG, PNG, WebP, or GIF'

/**
 * Validates section image before upload.
 * @param {File} file
 * @returns {{ valid: boolean, message: string }}
 */
export function validateArticleImageFile(file) {
  if (!file) {
    return { valid: false, message: 'Please select an image file to upload.' }
  }

  const fileName = file.name || ''
  const ext = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')).toLowerCase() : ''
  const mimeType = (file.type || '').toLowerCase()

  const isTypeValid = mimeType ? ALLOWED_ARTICLE_IMAGE_TYPES.includes(mimeType) : false
  const isExtValid = ext ? ALLOWED_ARTICLE_IMAGE_EXTENSIONS.includes(ext) : false

  // If neither declared MIME type nor extension is supported, reject
  if (!isTypeValid && !isExtValid) {
    return {
      valid: false,
      message: `Unsupported image format. Please upload an image in ${SUPPORTED_FORMATS_LABEL} format (up to 10 MB).`,
    }
  }

  // Size limit validation (10 MB)
  if (file.size > MAX_ARTICLE_IMAGE_BYTES) {
    return {
      valid: false,
      message: 'The selected image exceeds the 10 MB limit. Please upload an image smaller than 10 MB.',
    }
  }

  return { valid: true, message: '' }
}

/**
 * Transforms raw backend or network error into a user-friendly message
 * informing the user about supported image formats.
 * @param {string|Error} rawError
 * @returns {string}
 */
export function formatImageUploadError(rawError) {
  const message = typeof rawError === 'string' ? rawError : rawError?.message || ''
  const lower = message.toLowerCase()

  if (
    lower.includes('jpeg') ||
    lower.includes('unsupported') ||
    lower.includes('415') ||
    lower.includes('media type')
  ) {
    return `Unsupported image format. Please upload an image in ${SUPPORTED_FORMATS_LABEL} format.`
  }

  if (
    lower.includes('does not match') ||
    lower.includes('invalid webp') ||
    lower.includes('corrupted') ||
    lower.includes('invalid image')
  ) {
    return `The selected file is not a valid image. Please provide a valid ${SUPPORTED_FORMATS_LABEL} file.`
  }

  if (
    lower.includes('10 mb') ||
    lower.includes('too large') ||
    lower.includes('413') ||
    lower.includes('exceeds')
  ) {
    return 'The image exceeds the 10 MB limit. Please upload an image smaller than 10 MB.'
  }

  return message
    ? `Upload failed: ${message}. Supported formats: ${SUPPORTED_FORMATS_LABEL}.`
    : `Unable to upload image. Please ensure your file is a valid ${SUPPORTED_FORMATS_LABEL} image (up to 10 MB).`
}


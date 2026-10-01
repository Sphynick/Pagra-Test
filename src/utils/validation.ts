/**
 * Validation & Sanitization Constraints
 * Synchronized verbatim with /firebase-blueprint.json and /firestore.rules
 */

export const VALIDATION_RULES = {
  ID_REGEX: /^[a-zA-Z0-9_\-]+$/,
  EMAIL_REGEX: /^[^@\s]+@[^@\s]+\.[^@\s]+$/,
  ID_MAX_LENGTH: 128,
  FurnitureItem: {
    name: { minLength: 2, maxLength: 120 },
    description: { minLength: 10, maxLength: 2000 },
    price: { min: 1, max: 100000000 },
    category: { minLength: 2, maxLength: 80 },
    imageUrl: { minLength: 5, maxLength: 600000 },
    dimensions: { minLength: 2, maxLength: 120 },
    material: { minLength: 2, maxLength: 120 },
    salePrice: { min: 0, max: 100000000 },
    saleLabel: { minLength: 0, maxLength: 60 },
  },
  Category: {
    name: { minLength: 2, maxLength: 80 },
    slug: { minLength: 2, maxLength: 80, pattern: /^[a-zA-Z0-9_\-]+$/ },
    description: { minLength: 2, maxLength: 300 },
  },
  AdminGrant: {
    uid: { minLength: 1, maxLength: 128, pattern: /^[a-zA-Z0-9_\-]+$/ },
    email: { minLength: 5, maxLength: 254, pattern: /^[^@\s]+@[^@\s]+\.[^@\s]+$/ },
    role: 'admin' as const,
  },
  CustomerReview: {
    authorName: { minLength: 2, maxLength: 80 },
    authorLocation: { minLength: 2, maxLength: 80 },
    itemName: { minLength: 2, maxLength: 120 },
    rating: { min: 1, max: 5 },
    comment: { minLength: 10, maxLength: 1000 },
  },
};

export function validateCustomerReviewInput(input: {
  authorName: string;
  authorLocation: string;
  itemName: string;
  rating: number;
  comment: string;
}): string | null {
  const { CustomerReview } = VALIDATION_RULES;
  if (
    input.authorName.trim().length < CustomerReview.authorName.minLength ||
    input.authorName.trim().length > CustomerReview.authorName.maxLength
  ) {
    return `Your name must be between ${CustomerReview.authorName.minLength} and ${CustomerReview.authorName.maxLength} characters.`;
  }
  if (
    input.authorLocation.trim().length < CustomerReview.authorLocation.minLength ||
    input.authorLocation.trim().length > CustomerReview.authorLocation.maxLength
  ) {
    return `Location must be between ${CustomerReview.authorLocation.minLength} and ${CustomerReview.authorLocation.maxLength} characters.`;
  }
  if (
    input.itemName.trim().length < CustomerReview.itemName.minLength ||
    input.itemName.trim().length > CustomerReview.itemName.maxLength
  ) {
    return 'Please select or enter a valid furniture piece.';
  }
  if (
    !Number.isFinite(input.rating) ||
    input.rating < CustomerReview.rating.min ||
    input.rating > CustomerReview.rating.max
  ) {
    return 'Rating must be between 1 and 5 stars.';
  }
  if (
    input.comment.trim().length < CustomerReview.comment.minLength ||
    input.comment.trim().length > CustomerReview.comment.maxLength
  ) {
    return `Review comment must be between ${CustomerReview.comment.minLength} and ${CustomerReview.comment.maxLength} characters.`;
  }
  return null;
}

export function toValidDocId(input: string, prefix = 'doc'): string {
  const cleaned = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_\-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const candidate = cleaned.length >= 2 ? cleaned : `${prefix}_${Date.now()}`;
  return candidate.slice(0, VALIDATION_RULES.ID_MAX_LENGTH);
}

export function validateFurnitureItemInput(input: {
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl: string;
  dimensions: string;
  material: string;
  isOnSale: boolean;
  salePrice: number;
  saleLabel: string;
}): string | null {
  const { FurnitureItem } = VALIDATION_RULES;
  if (
    input.name.trim().length < FurnitureItem.name.minLength ||
    input.name.trim().length > FurnitureItem.name.maxLength
  ) {
    return `Item name must be between ${FurnitureItem.name.minLength} and ${FurnitureItem.name.maxLength} characters.`;
  }
  if (
    input.description.trim().length < FurnitureItem.description.minLength ||
    input.description.trim().length > FurnitureItem.description.maxLength
  ) {
    return `Description must be between ${FurnitureItem.description.minLength} and ${FurnitureItem.description.maxLength} characters.`;
  }
  if (
    !Number.isFinite(input.price) ||
    input.price < FurnitureItem.price.min ||
    input.price > FurnitureItem.price.max
  ) {
    return 'Please enter a valid retail price greater than 0.';
  }
  if (
    input.category.trim().length < FurnitureItem.category.minLength ||
    input.category.trim().length > FurnitureItem.category.maxLength
  ) {
    return 'Please select a valid category.';
  }
  if (
    input.imageUrl.trim().length < FurnitureItem.imageUrl.minLength ||
    input.imageUrl.trim().length > FurnitureItem.imageUrl.maxLength
  ) {
    return 'Please provide a valid image (under 450KB if uploaded).';
  }
  if (
    input.dimensions.trim().length < FurnitureItem.dimensions.minLength ||
    input.dimensions.trim().length > FurnitureItem.dimensions.maxLength
  ) {
    return `Dimensions must be between ${FurnitureItem.dimensions.minLength} and ${FurnitureItem.dimensions.maxLength} characters.`;
  }
  if (
    input.material.trim().length < FurnitureItem.material.minLength ||
    input.material.trim().length > FurnitureItem.material.maxLength
  ) {
    return `Material must be between ${FurnitureItem.material.minLength} and ${FurnitureItem.material.maxLength} characters.`;
  }
  if (
    !Number.isFinite(input.salePrice) ||
    input.salePrice < FurnitureItem.salePrice.min ||
    input.salePrice > FurnitureItem.salePrice.max
  ) {
    return 'Sale price must be a non-negative number.';
  }
  if (input.isOnSale && input.salePrice >= input.price) {
    return 'Promotional sale price should be lower than the regular retail price.';
  }
  if (input.saleLabel.trim().length > FurnitureItem.saleLabel.maxLength) {
    return `Sale label cannot exceed ${FurnitureItem.saleLabel.maxLength} characters.`;
  }
  return null;
}

export function validateCategoryInput(input: {
  name: string;
  description: string;
}): { error: string | null; slug: string } {
  const { Category } = VALIDATION_RULES;
  const name = input.name.trim();
  const description = input.description.trim();
  const slug = toValidDocId(name, 'cat').slice(0, Category.slug.maxLength);

  if (name.length < Category.name.minLength || name.length > Category.name.maxLength) {
    return {
      error: `Category name must be between ${Category.name.minLength} and ${Category.name.maxLength} characters.`,
      slug,
    };
  }
  if (
    description.length < Category.description.minLength ||
    description.length > Category.description.maxLength
  ) {
    return {
      error: `Category description must be between ${Category.description.minLength} and ${Category.description.maxLength} characters.`,
      slug,
    };
  }
  if (!Category.slug.pattern.test(slug)) {
    return { error: 'Category name must contain alphanumeric characters.', slug };
  }
  return { error: null, slug };
}

/**
 * Compresses an uploaded image file on the client using an HTML5 Canvas
 * so that it safely fits within Firestore's 1MB document limit and the 600,000 char schema rule.
 */
export function compressImageFileToDataUrl(file: File, maxWidth = 1000): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image format.'));
      img.onload = () => {
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable.'));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.78);
        if (dataUrl.length > VALIDATION_RULES.FurnitureItem.imageUrl.maxLength) {
          const smallerUrl = canvas.toDataURL('image/jpeg', 0.55);
          resolve(smallerUrl);
        } else {
          resolve(dataUrl);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

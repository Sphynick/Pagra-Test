export interface FurnitureItem {
  id: string;
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
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AdminGrant {
  id: string;
  uid: string;
  email: string;
  role: 'admin';
  addedBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CustomerReview {
  id: string;
  authorName: string;
  authorLocation: string;
  itemName: string;
  rating: number;
  comment: string;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

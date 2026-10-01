/**
 * Firestore Security Rules Test Specification (Phase 0 TDD)
 * Verifies that all "Dirty Dozen" adversarial payloads return PERMISSION_DENIED.
 */

export interface TestCase {
  id: string;
  name: string;
  collection: string;
  docId: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  auth: {
    uid: string;
    email: string;
    email_verified: boolean;
  } | null;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED' | 'ALLOWED';
}

export const DIRTY_DOZEN_TESTS: TestCase[] = [
  {
    id: 'DD-01',
    name: 'Unauthenticated visitor cannot create furniture item',
    collection: 'items',
    docId: 'sofa_01',
    operation: 'create',
    auth: null,
    payload: {
      name: 'Arch Sofa',
      description: 'Minimalist three-seater sofa in Belgian linen.',
      price: 125000,
      category: 'Sofas',
      imageUrl: '/src/assets/images/sofa.jpg',
      dimensions: '220cm x 95cm x 80cm',
      material: 'Belgian Linen',
      isOnSale: false,
      salePrice: 125000,
      saleLabel: '',
      createdBy: 'anon',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-02',
    name: 'Non-admin customer cannot self-assign admin role',
    collection: 'admins',
    docId: 'cust_1',
    operation: 'create',
    auth: { uid: 'cust_1', email: 'customer@example.com', email_verified: true },
    payload: {
      uid: 'cust_1',
      email: 'customer@example.com',
      role: 'admin',
      addedBy: 'cust_1',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-03',
    name: 'Unverified bootstrap admin email is rejected (Email Spoofing Test)',
    collection: 'categories',
    docId: 'sofas',
    operation: 'create',
    auth: { uid: 'spoof_uid', email: 'nicholasnjau22@gmail.com', email_verified: false },
    payload: {
      name: 'Sofas',
      slug: 'sofas',
      description: 'Architectural sofas and sectionals',
      createdBy: 'spoof_uid',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-04',
    name: 'Shadow field injection on item creation is rejected',
    collection: 'items',
    docId: 'sofa_02',
    operation: 'create',
    auth: { uid: 'admin_1', email: 'nicholasnjau22@gmail.com', email_verified: true },
    payload: {
      name: 'Arch Sofa',
      description: 'Minimalist three-seater sofa in Belgian linen.',
      price: 125000,
      category: 'Sofas',
      imageUrl: '/src/assets/images/sofa.jpg',
      dimensions: '220cm x 95cm x 80cm',
      material: 'Belgian Linen',
      isOnSale: false,
      salePrice: 125000,
      saleLabel: '',
      createdBy: 'admin_1',
      ghostField: true,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-05',
    name: 'Identity spoofing (mismatched createdBy) on item creation is rejected',
    collection: 'items',
    docId: 'sofa_03',
    operation: 'create',
    auth: { uid: 'admin_1', email: 'nicholasnjau22@gmail.com', email_verified: true },
    payload: {
      name: 'Arch Sofa',
      description: 'Minimalist three-seater sofa in Belgian linen.',
      price: 125000,
      category: 'Sofas',
      imageUrl: '/src/assets/images/sofa.jpg',
      dimensions: '220cm x 95cm x 80cm',
      material: 'Belgian Linen',
      isOnSale: false,
      salePrice: 125000,
      saleLabel: '',
      createdBy: 'different_admin_uid',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-06',
    name: 'Mutating immutable createdBy field during item update is rejected',
    collection: 'items',
    docId: 'sofa_01',
    operation: 'update',
    auth: { uid: 'admin_1', email: 'nicholasnjau22@gmail.com', email_verified: true },
    payload: {
      createdBy: 'hijacked_owner',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-07',
    name: 'Value poisoning (negative salePrice) during sale update is rejected',
    collection: 'items',
    docId: 'sofa_01',
    operation: 'update',
    auth: { uid: 'admin_1', email: 'nicholasnjau22@gmail.com', email_verified: true },
    payload: {
      isOnSale: true,
      salePrice: -100,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-08',
    name: 'ID poisoning with special characters is rejected',
    collection: 'items',
    docId: 'invalid$id!@#',
    operation: 'create',
    auth: { uid: 'admin_1', email: 'nicholasnjau22@gmail.com', email_verified: true },
    payload: {},
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-09',
    name: 'Oversized category description exceeding 300 chars is rejected',
    collection: 'categories',
    docId: 'oversized_cat',
    operation: 'create',
    auth: { uid: 'admin_1', email: 'nicholasnjau22@gmail.com', email_verified: true },
    payload: {
      name: 'Luxury Sectionals',
      slug: 'luxury-sectionals',
      description: 'A'.repeat(350),
      createdBy: 'admin_1',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-10',
    name: 'Non-owner customer cannot GET another user admin grant (PII Isolation)',
    collection: 'admins',
    docId: 'other_admin_uid',
    operation: 'get',
    auth: { uid: 'cust_1', email: 'customer@example.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-11',
    name: 'Non-admin customer cannot LIST admin records (PII Scraping Prevention)',
    collection: 'admins',
    docId: '*',
    operation: 'list',
    auth: { uid: 'cust_1', email: 'customer@example.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-12',
    name: 'Forged client timestamp on update is rejected',
    collection: 'items',
    docId: 'sofa_01',
    operation: 'update',
    auth: { uid: 'admin_1', email: 'nicholasnjau22@gmail.com', email_verified: true },
    payload: {
      isOnSale: true,
      salePrice: 95000,
      updatedAt: '1999-01-01T00:00:00Z',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
];

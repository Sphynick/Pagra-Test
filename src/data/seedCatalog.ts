import { CategoryItem, CustomerReview, FurnitureItem } from '../types/catalog';

export const HERO_SOFA_IMAGE = '/src/assets/images/hero_pagra_sofa_1790837222865.jpg';

export const PAGRA_LOCATION_MAPS_URL = 'https://maps.app.goo.gl/e63qJXdAXNcJYYJq9';
export const PAGRA_LOCATION_ADDRESS = 'Ngecha, near Tilisi Road, Limuru / Nairobi';
export const PAGRA_LOCATION_HOURS = 'Mon–Sat, 8:00 AM – 6:00 PM';
export const PAGRA_LOCATION_EMBED_URL =
  'https://www.google.com/maps?q=Ngecha,+Tilisi+Road,+Kenya&output=embed';

export const DEFAULT_CUSTOMER_REVIEWS: Omit<
  CustomerReview,
  'createdBy' | 'createdAt' | 'updatedAt'
>[] = [
  {
    id: 'review-wanjiku-serengeti',
    authorName: 'Dr. Wanjiku Njoroge',
    authorLocation: 'Runda, Nairobi',
    itemName: 'The Serengeti Bouclé Cloud Sofa',
    rating: 5,
    comment:
      'Before visiting PAGRA near Tilisi Road, we struggled to find a deep-seated bouclé sofa that did not sag after a few months. The kiln-dried mahogany frame and high-density cushion construction exceeded our expectations—delivered on time to Runda.',
  },
  {
    id: 'review-david-karen-sectional',
    authorName: 'Arch. David Ochieng',
    authorLocation: 'Karen, Nairobi',
    itemName: 'The Karen Olive Velvet L-Sectional',
    rating: 5,
    comment:
      'Specified the Olive Velvet L-Sectional for a residential client project in Karen. The tailoring along the seams, blackened steel plinth, and fabric weight rival imported European pieces at a fraction of the lead time.',
  },
  {
    id: 'review-amina-rift-valley',
    authorName: 'Amina Hassan',
    authorLocation: 'Kilimani, Nairobi',
    itemName: 'The Rift Valley Cognac Saddle Sofa',
    rating: 5,
    comment:
      'Ordered directly via WhatsApp (0769504732) after inspecting the saddle leather swatches. The walnut joinery is rock solid and the leather already has a warm, rich character in our living room.',
  },
];

export const STUDIO_IMAGE_PRESETS = [
  {
    label: 'Ivory Bouclé Cloud Sofa',
    url: '/src/assets/images/sofa_boucle_cloud_1790837235795.jpg',
  },
  {
    label: 'Cognac Saddle Leather Sofa',
    url: '/src/assets/images/sofa_cognac_leather_1790837247404.jpg',
  },
  {
    label: 'Olive-Emerald Velvet L-Sectional',
    url: '/src/assets/images/sofa_emerald_velvet_1790837258233.jpg',
  },
  {
    label: 'White Oak & Linen Lounge Set',
    url: '/src/assets/images/chair_oak_lounge_1790837269021.jpg',
  },
  {
    label: 'Travertine Modular Grand Sectional',
    url: '/src/assets/images/hero_pagra_sofa_1790837222865.jpg',
  },
];

export const DEFAULT_CATEGORIES: Omit<CategoryItem, 'createdBy' | 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'modular-sectionals',
    name: 'Modular Sectionals',
    slug: 'modular-sectionals',
    description: 'Deep-seated architectural L-shaped and modular sofa systems for expansive living spaces.',
  },
  {
    id: 'three-seater-sofas',
    name: 'Three-Seater Sofas',
    slug: 'three-seater-sofas',
    description: 'Sculptural bouclé, linen, and full-grain saddle leather statement sofas.',
  },
  {
    id: 'leather-chesterfields',
    name: 'Leather Sofas',
    slug: 'leather-chesterfields',
    description: 'Hand-tufted and mid-century full-grain leather sofas framed in kiln-dried hardwood.',
  },
  {
    id: 'lounge-accent-chairs',
    name: 'Lounge & Accent',
    slug: 'lounge-accent-chairs',
    description: 'Solid timber lounge armchairs, ottomans, and travertine living room companions.',
  },
];

export const DEFAULT_FURNITURE_ITEMS: Omit<FurnitureItem, 'createdBy' | 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'serengeti-boucle-cloud-sofa',
    name: 'The Serengeti Bouclé Cloud Sofa',
    description:
      'Hand-upholstered in heavyweight 720gsm ivory Belgian bouclé over a kiln-dried solid mahogany plinth. Engineered with triple-density feather-down wrapped cushions for effortless architectural comfort.',
    price: 185000,
    category: 'Three-Seater Sofas',
    imageUrl: '/src/assets/images/sofa_boucle_cloud_1790837235795.jpg',
    dimensions: '245cm W × 102cm D × 76cm H',
    material: 'Ivory Bouclé & Kiln-Dried Mahogany',
    isOnSale: true,
    salePrice: 154000,
    saleLabel: 'Showroom Archive Event',
  },
  {
    id: 'rift-valley-cognac-leather-sofa',
    name: 'The Rift Valley Cognac Saddle Sofa',
    description:
      'Full-grain vegetable-tanned cognac leather that develops a rich patina over decades. Supported by an exposed solid walnut base with mortise-and-tenon joinery and high-resilience pocketed coil seating.',
    price: 225000,
    category: 'Leather Sofas',
    imageUrl: '/src/assets/images/sofa_cognac_leather_1790837247404.jpg',
    dimensions: '230cm W × 94cm D × 80cm H',
    material: 'Full-Grain Aniline Leather & Solid Walnut',
    isOnSale: false,
    salePrice: 225000,
    saleLabel: '',
  },
  {
    id: 'karen-emerald-velvet-sectional',
    name: 'The Karen Olive Velvet L-Sectional',
    description:
      'Generously proportioned L-shaped architectural sectional with a reversible wide chaise lounge. Upholstered in stain-resistant cotton-pile olive emerald velvet with slender matte blackened steel legs.',
    price: 265000,
    category: 'Modular Sectionals',
    imageUrl: '/src/assets/images/sofa_emerald_velvet_1790837258233.jpg',
    dimensions: '310cm W × 175cm Chaise × 78cm H',
    material: 'Performance Cotton Velvet & Blackened Steel',
    isOnSale: true,
    salePrice: 228000,
    saleLabel: 'Seasonal Atelier Offer',
  },
  {
    id: 'lamu-oak-lounge-ensemble',
    name: 'The Lamu White Oak Lounge Chair & Table',
    description:
      'Sculptural low-profile lounge armchair crafted from sustainably harvested white oak with oatmeal linen cushions, paired with a honed travertine plinth coffee table.',
    price: 115000,
    category: 'Lounge & Accent',
    imageUrl: '/src/assets/images/chair_oak_lounge_1790837269021.jpg',
    dimensions: '86cm W × 88cm D × 74cm H',
    material: 'Solid White Oak, Belgian Linen & Travertine',
    isOnSale: false,
    salePrice: 115000,
    saleLabel: '',
  },
  {
    id: 'travertine-horizon-modular-sofa',
    name: 'The Horizon Sand Linen Grand Sectional',
    description:
      'Our flagship 5-seater modular corner sofa system in warm sand-toned woven flax linen. Configurable modules allow seamless adaptation to open-plan contemporary living rooms.',
    price: 310000,
    category: 'Modular Sectionals',
    imageUrl: '/src/assets/images/hero_pagra_sofa_1790837222865.jpg',
    dimensions: '340cm W × 210cm D × 75cm H',
    material: 'Heavyweight Flax Linen & Solid Ash Frame',
    isOnSale: false,
    salePrice: 310000,
    saleLabel: '',
  },
];

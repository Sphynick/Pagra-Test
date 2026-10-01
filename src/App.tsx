/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import {
  MapPin,
  MessageCircle,
  Moon,
  Percent,
  Search,
  Shield,
  Smartphone,
  Sofa,
  Star,
  Sun,
  User as UserIcon,
} from 'lucide-react';
import {
  auth,
  BOOTSTRAP_ADMIN_EMAIL,
  db,
  handleFirestoreError,
  OperationType,
} from './firebase';
import { CategoryItem, CustomerReview, FurnitureItem } from './types/catalog';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_CUSTOMER_REVIEWS,
  DEFAULT_FURNITURE_ITEMS,
  HERO_SOFA_IMAGE,
  PAGRA_LOCATION_ADDRESS,
  PAGRA_LOCATION_HOURS,
  PAGRA_LOCATION_MAPS_URL,
} from './data/seedCatalog';
import {
  buildWhatsAppOrderUrl,
  formatKES,
  getEffectivePrice,
  PAGRA_WHATSAPP_DISPLAY,
} from './utils/whatsapp';
import { ResilientImage } from './components/ResilientImage';
import { ProductDetailModal } from './components/ProductDetailModal';
import { MpesaModal } from './components/MpesaModal';
import { AuthModal } from './components/AuthModal';
import { AdminDashboard } from './components/AdminDashboard';
import { ReviewsAndLocationSection } from './components/ReviewsAndLocationSection';

const LIGHT_THEME_VARS: Record<string, string> = {
  '--bg': '#F2F1EC',
  '--ink': '#1B2421',
  '--mute': '#5E6965',
  '--line': '#D9D8D0',
  '--accent': '#1F4D43',
  '--on-accent': '#ffffff',
  '--sale': '#B3261E',
  '--card': '#FBFBF8',
  '--wa': '#1E8E4E',
};

const DARK_THEME_VARS: Record<string, string> = {
  '--bg': '#141A18',
  '--ink': '#EDEEE8',
  '--mute': '#9AA5A0',
  '--line': '#2B3532',
  '--accent': '#7FC4B1',
  '--on-accent': '#0E1513',
  '--sale': '#FF8A80',
  '--card': '#1A2220',
  '--wa': '#1E8E4E',
};

export default function App() {
  // Theme state (Light vs Dark)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = window.localStorage.getItem('pagra-theme');
        if (saved === 'dark' || saved === 'light') return saved;
      } catch {
        // Ignore storage read errors
      }
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    }
    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const activeVars = theme === 'dark' ? DARK_THEME_VARS : LIGHT_THEME_VARS;

    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('light', theme === 'light');
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;

    body.classList.toggle('dark', theme === 'dark');
    body.classList.toggle('light', theme === 'light');

    Object.entries(activeVars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', activeVars['--bg']);
    }

    try {
      window.localStorage.setItem('pagra-theme', theme);
    } catch {
      // Ignore storage errors in restricted environments
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Navigation & View state
  const [currentView, setCurrentView] = useState<'storefront' | 'admin'>('storefront');

  // Auth & RBAC state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [hasAdminDoc, setHasAdminDoc] = useState<boolean>(false);
  const [authReady, setAuthReady] = useState<boolean>(false);

  // Firestore Catalog & Reviews state
  const [firestoreItems, setFirestoreItems] = useState<FurnitureItem[]>([]);
  const [firestoreCategories, setFirestoreCategories] = useState<CategoryItem[]>([]);
  const [firestoreReviews, setFirestoreReviews] = useState<CustomerReview[]>([]);
  const [catalogLoaded, setCatalogLoaded] = useState<boolean>(false);
  const [autoSeedAttempted, setAutoSeedAttempted] = useState<boolean>(false);

  // Storefront Filter state
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [onlyOnSale, setOnlyOnSale] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal state
  const [detailItem, setDetailItem] = useState<FurnitureItem | null>(null);
  const [mpesaItem, setMpesaItem] = useState<FurnitureItem | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'customer' | 'admin'>('customer');

  // 1. Track Firebase Authentication state & URL hash (#/admin)
  useEffect(() => {
    const syncHash = () => {
      if (window.location.hash === '#/admin' || window.location.hash === '#admin') {
        setCurrentView('admin');
      }
    };
    syncHash();
    window.addEventListener('hashchange', syncHash);
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthReady(true);
    });
    return () => {
      window.removeEventListener('hashchange', syncHash);
      unsubscribe();
    };
  }, []);

  // 2. Check /admins/{uid} document for RBAC Admin Verification
  useEffect(() => {
    if (!currentUser) {
      setHasAdminDoc(false);
      return;
    }

    const adminDocRef = doc(db, 'admins', currentUser.uid);
    const unsubscribe = onSnapshot(
      adminDocRef,
      (snap) => {
        setHasAdminDoc(snap.exists() && snap.data()?.role === 'admin');
      },
      () => {
        setHasAdminDoc(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  const isAdmin = useMemo(() => {
    if (!currentUser || !currentUser.emailVerified) return false;
    if (currentUser.email === BOOTSTRAP_ADMIN_EMAIL) return true;
    return hasAdminDoc;
  }, [currentUser, hasAdminDoc]);

  // 3. Subscribe to public /categories, /items, and /reviews collections
  useEffect(() => {
    const unsubCategories = onSnapshot(
      collection(db, 'categories'),
      (snapshot) => {
        const list: CategoryItem[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            name: String(d.name || ''),
            slug: String(d.slug || docSnap.id),
            description: String(d.description || ''),
            createdBy: String(d.createdBy || ''),
            createdAt: d.createdAt,
            updatedAt: d.updatedAt,
          };
        });
        setFirestoreCategories(list);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'categories');
        } catch {
          // Logged by handleFirestoreError
        }
      }
    );

    const unsubItems = onSnapshot(
      collection(db, 'items'),
      (snapshot) => {
        const list: FurnitureItem[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            name: String(d.name || ''),
            description: String(d.description || ''),
            price: Number(d.price || 0),
            category: String(d.category || 'Sofas'),
            imageUrl: String(d.imageUrl || '').replace('/src/assets/images/', '/images/'),
            dimensions: String(d.dimensions || '230cm × 95cm × 78cm'),
            material: String(d.material || 'Belgian Linen & Hardwood'),
            isOnSale: Boolean(d.isOnSale),
            salePrice: Number(d.salePrice ?? d.price ?? 0),
            saleLabel: String(d.saleLabel || ''),
            createdBy: String(d.createdBy || ''),
            createdAt: d.createdAt,
            updatedAt: d.updatedAt,
          };
        });
        setFirestoreItems(list);
        setCatalogLoaded(true);
      },
      (err) => {
        setCatalogLoaded(true);
        try {
          handleFirestoreError(err, OperationType.LIST, 'items');
        } catch {
          // Logged by handleFirestoreError
        }
      }
    );

    const unsubReviews = onSnapshot(
      collection(db, 'reviews'),
      (snapshot) => {
        const list: CustomerReview[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            authorName: String(d.authorName || 'Verified Customer'),
            authorLocation: String(d.authorLocation || 'Nairobi, Kenya'),
            itemName: String(d.itemName || 'PAGRA Sofa'),
            rating: Number(d.rating || 5),
            comment: String(d.comment || ''),
            createdBy: String(d.createdBy || ''),
            createdAt: d.createdAt,
            updatedAt: d.updatedAt,
          };
        });
        setFirestoreReviews(list);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'reviews');
        } catch {
          // Logged by handleFirestoreError
        }
      }
    );

    return () => {
      unsubCategories();
      unsubItems();
      unsubReviews();
    };
  }, []);

  // 4. Auto-seed initial catalog & reviews into Firestore when a verified Admin signs in to an empty DB
  useEffect(() => {
    if (
      !authReady ||
      !catalogLoaded ||
      !currentUser ||
      !isAdmin ||
      autoSeedAttempted ||
      firestoreItems.length > 0
    ) {
      return;
    }

    setAutoSeedAttempted(true);
    (async () => {
      try {
        if (firestoreCategories.length === 0) {
          for (const cat of DEFAULT_CATEGORIES) {
            await setDoc(doc(db, 'categories', cat.id), {
              name: cat.name,
              slug: cat.slug,
              description: cat.description,
              createdBy: currentUser.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        }
        if (firestoreItems.length === 0) {
          for (const item of DEFAULT_FURNITURE_ITEMS) {
            await setDoc(doc(db, 'items', item.id), {
              name: item.name,
              description: item.description,
              price: item.price,
              category: item.category,
              imageUrl: item.imageUrl,
              dimensions: item.dimensions,
              material: item.material,
              isOnSale: item.isOnSale,
              salePrice: item.salePrice,
              saleLabel: item.saleLabel,
              createdBy: currentUser.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        }
        if (firestoreReviews.length === 0) {
          for (const rev of DEFAULT_CUSTOMER_REVIEWS) {
            await setDoc(doc(db, 'reviews', rev.id), {
              authorName: rev.authorName,
              authorLocation: rev.authorLocation,
              itemName: rev.itemName,
              rating: rev.rating,
              comment: rev.comment,
              createdBy: currentUser.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        }
      } catch {
        // Silent fallback if seeding already occurred
      }
    })();
  }, [
    authReady,
    catalogLoaded,
    currentUser,
    isAdmin,
    autoSeedAttempted,
    firestoreCategories.length,
    firestoreItems.length,
    firestoreReviews.length,
  ]);

  const isUsingFallbackCatalog = firestoreItems.length === 0;
  const isUsingFallbackReviews = firestoreReviews.length === 0;

  const activeCategories: CategoryItem[] = useMemo(() => {
    if (firestoreCategories.length > 0) return firestoreCategories;
    return DEFAULT_CATEGORIES.map((c) => ({ ...c, createdBy: 'system' }));
  }, [firestoreCategories]);

  const activeItems: FurnitureItem[] = useMemo(() => {
    if (firestoreItems.length > 0) return firestoreItems;
    return DEFAULT_FURNITURE_ITEMS.map((i) => ({ ...i, createdBy: 'system' }));
  }, [firestoreItems]);

  const activeReviews: CustomerReview[] = useMemo(() => {
    if (firestoreReviews.length > 0) return firestoreReviews;
    return DEFAULT_CUSTOMER_REVIEWS.map((r) => ({ ...r, createdBy: 'system' }));
  }, [firestoreReviews]);

  const filteredItems = useMemo(() => {
    return activeItems.filter((item) => {
      const matchesCategory =
        selectedCategory === 'ALL' || item.category.toLowerCase() === selectedCategory.toLowerCase();
      const matchesSale = !onlyOnSale || (item.isOnSale && item.salePrice < item.price);
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.material.toLowerCase().includes(q);
      return matchesCategory && matchesSale && matchesSearch;
    });
  }, [activeItems, selectedCategory, onlyOnSale, searchQuery]);

  const onSaleCount = useMemo(
    () => activeItems.filter((i) => i.isOnSale && i.salePrice < i.price).length,
    [activeItems]
  );


  // Smooth-scroll to a section without adding "#section" to the address bar
  const goTo = (id: string) => {
    setCurrentView('storefront');
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  return (
    <div
      data-theme={theme}
      className={`${theme} min-h-screen flex flex-col bg-[var(--bg)] text-[var(--ink)] transition-colors duration-150`}
    >
      {/* Top Bar Contract: Compact 1-row, 3-zone header */}
      <header className="sticky top-0 z-30 bg-[var(--bg)]/95 backdrop-blur-md border-b border-[var(--line)] h-14 sm:h-16 flex items-center">
        <div className="w-full max-w-6xl mx-auto flex items-center justify-between px-4 sm:px-6">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setCurrentView('storefront');
              setSelectedCategory('ALL');
              setOnlyOnSale(false);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="font-display text-2xl font-extrabold tracking-tight text-[var(--ink)] whitespace-nowrap"
          >
            PAGRA
          </a>

          {/* Zone 2: Clean desktop navigation links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[var(--mute)]">
            <a
              href="#browse"
              onClick={(e) => {
                e.preventDefault();
                setSelectedCategory('ALL');
                setOnlyOnSale(false);
                goTo('browse');
              }}
              className="hover:text-[var(--ink)] transition-colors whitespace-nowrap"
            >
              Browse
            </a>
            <a
              href="#browse"
              onClick={(e) => {
                e.preventDefault();
                setSelectedCategory('ALL');
                setOnlyOnSale(true);
                goTo('browse');
              }}
              className="hover:text-[var(--ink)] transition-colors whitespace-nowrap"
            >
              On sale ({onSaleCount})
            </a>
            <a
              href="#reviews"
              onClick={(e) => {
                e.preventDefault();
                goTo('reviews');
              }}
              className="hover:text-[var(--ink)] transition-colors whitespace-nowrap"
            >
              Reviews
            </a>
            <a
              href="#location"
              onClick={(e) => {
                e.preventDefault();
                goTo('location');
              }}
              className="hover:text-[var(--ink)] transition-colors whitespace-nowrap"
            >
              Location
            </a>
            {isAdmin && (
              <button
                type="button"
                onClick={() =>
                  setCurrentView((prev) => (prev === 'admin' ? 'storefront' : 'admin'))
                }
                className={`hover:text-[var(--ink)] transition-colors whitespace-nowrap cursor-pointer ${
                  currentView === 'admin'
                    ? 'text-[var(--ink)] font-semibold underline underline-offset-4'
                    : ''
                }`}
              >
                Dashboard
              </button>
            )}
          </nav>

          {/* Zone 3: Theme Toggle + Auth / Dashboard Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              aria-pressed={theme === 'dark'}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              className="min-h-[40px] flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-[var(--ink)] bg-[var(--card)] border border-[var(--line)] hover:border-[var(--ink)] rounded-md transition-colors whitespace-nowrap cursor-pointer"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 text-[var(--accent)] shrink-0" />
                  <span>Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-[var(--accent)] shrink-0" />
                  <span>Dark</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setAuthModalMode('customer');
                setAuthModalOpen(true);
              }}
              className="min-h-[40px] flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[var(--ink)] bg-[var(--card)] border border-[var(--ink)] rounded-md transition-colors whitespace-nowrap cursor-pointer"
            >
              {isAdmin ? (
                <Shield className="w-3.5 h-3.5 text-[var(--accent)]" />
              ) : (
                <UserIcon className="w-3.5 h-3.5" />
              )}
              <span className="max-w-[110px] truncate">
                {currentUser
                  ? currentUser.displayName || currentUser.email?.split('@')[0]
                  : 'Sign in'}
              </span>
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={() =>
                  setCurrentView((prev) => (prev === 'admin' ? 'storefront' : 'admin'))
                }
                className="hidden sm:inline-flex min-h-[40px] items-center px-3.5 py-1.5 text-xs font-semibold text-[var(--on-accent)] bg-[var(--accent)] rounded-md transition-opacity hover:opacity-95 whitespace-nowrap cursor-pointer"
              >
                {currentView === 'admin' ? 'Shop' : 'Dashboard'}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Switcher */}
      {currentView === 'admin' ? (
        <main className="flex-1">
          <AdminDashboard
            currentUser={currentUser}
            isAdmin={isAdmin}
            items={activeItems}
            categories={activeCategories}
            isUsingFallbackCatalog={isUsingFallbackCatalog}
            onBackToStorefront={() => setCurrentView('storefront')}
          />
        </main>
      ) : (
        <main id="top" className="flex-1 pb-20 md:pb-0">
          {/* SECTION 1: HERO SHOWCASE */}
          <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 pb-8 sm:pb-12">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 items-center">
              <div className="md:col-span-6 space-y-4">
                <h1 className="font-display text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-[var(--ink)]">
                  PAGRA
                </h1>
                <p className="text-base sm:text-lg text-[var(--mute)] max-w-md leading-relaxed">
                  ONE STOP FURNITURE SHOP. Sofas first, everything else for the room after.
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <a
                    href="#browse"
                    onClick={(e) => {
                      e.preventDefault();
                      setSelectedCategory('ALL');
                      setOnlyOnSale(false);
                      goTo('browse');
                    }}
                    className="min-h-[48px] inline-flex items-center justify-center px-6 py-3 text-sm font-semibold text-[var(--on-accent)] bg-[var(--accent)] hover:opacity-95 rounded-lg transition-opacity whitespace-nowrap"
                  >
                    Shop sofas
                  </a>
                  <a
                    href={PAGRA_LOCATION_MAPS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[48px] inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-[var(--ink)] bg-[var(--card)] border border-[var(--ink)] rounded-lg transition-colors whitespace-nowrap"
                  >
                    <MapPin className="w-4 h-4 text-[var(--accent)]" />
                    <span>Visit Showroom</span>
                  </a>
                </div>
              </div>

              <div className="md:col-span-6">
                <div className="relative rounded-2xl overflow-hidden border border-[var(--line)] bg-[var(--card)] aspect-16/10 shadow-xs">
                  <ResilientImage
                    src={HERO_SOFA_IMAGE}
                    alt="PAGRA architectural sofa showcase"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 2: BROWSE CATALOG */}
          <section id="browse" className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-[var(--ink)]">
                  Browse
                </h2>
                <p className="text-xs text-[var(--mute)] mt-0.5">
                  Tap any piece for full photos, WhatsApp inquiry ({PAGRA_WHATSAPP_DISPLAY}), or
                  M-Pesa checkout.
                </p>
              </div>

              {/* Search Input */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-[var(--mute)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search sofas, leather..."
                  className="w-full min-h-[44px] pl-10 pr-4 py-2 text-xs bg-[var(--card)] text-[var(--ink)] border border-[var(--line)] rounded-lg focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>

            {/* Horizontal Touch-Scrollable Filter Strip for Mobile & Desktop */}
            <div
              role="group"
              aria-label="Filter by category"
              className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 pb-1"
            >
              <button
                type="button"
                aria-pressed={selectedCategory === 'ALL' && !onlyOnSale}
                onClick={() => {
                  setSelectedCategory('ALL');
                  setOnlyOnSale(false);
                }}
                className={`min-h-[42px] px-4 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedCategory === 'ALL' && !onlyOnSale
                    ? 'bg-[var(--ink)] text-[var(--bg)] border-[var(--ink)]'
                    : 'bg-[var(--card)] text-[var(--ink)] border-[var(--line)]'
                }`}
              >
                All ({activeItems.length})
              </button>

              <button
                type="button"
                aria-pressed={onlyOnSale}
                onClick={() => setOnlyOnSale((prev) => !prev)}
                className={`min-h-[42px] px-4 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  onlyOnSale
                    ? 'bg-[var(--sale)] text-[var(--bg)] border-[var(--sale)]'
                    : 'bg-[var(--card)] text-[var(--sale)] border-[var(--line)]'
                }`}
              >
                On sale ({onSaleCount})
              </button>

              {activeCategories.map((cat) => {
                const isSelected =
                  !onlyOnSale && selectedCategory.toLowerCase() === cat.name.toLowerCase();
                return (
                  <button
                    key={cat.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => {
                      setSelectedCategory(cat.name);
                      setOnlyOnSale(false);
                    }}
                    className={`min-h-[42px] px-4 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--ink)] text-[var(--bg)] border-[var(--ink)]'
                        : 'bg-[var(--card)] text-[var(--ink)] border-[var(--line)]'
                    }`}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>

            {/* Product Grid */}
            {filteredItems.length === 0 ? (
              <div className="py-12 text-center bg-[var(--card)] border border-[var(--line)] rounded-xl space-y-3">
                <p className="font-display text-xl font-bold text-[var(--ink)]">
                  No items in this category yet.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('ALL');
                    setOnlyOnSale(false);
                    setSearchQuery('');
                  }}
                  className="min-h-[44px] px-4 py-2 text-xs font-semibold text-[var(--on-accent)] bg-[var(--accent)] rounded-lg cursor-pointer"
                >
                  Show all items
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredItems.map((item) => {
                  const effectivePrice = getEffectivePrice(item);
                  const isDiscounted =
                    item.isOnSale && item.salePrice > 0 && item.salePrice < item.price;

                  return (
                    <article
                      key={item.id}
                      className="bg-[var(--card)] border border-[var(--line)] rounded-xl overflow-hidden flex flex-col justify-between transition-transform duration-150 hover:-translate-y-0.5"
                    >
                      <div>
                        <div
                          onClick={() => setDetailItem(item)}
                          className="aspect-4/3 w-full bg-[var(--line)] overflow-hidden cursor-pointer relative"
                        >
                          <ResilientImage
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        </div>

                        <div className="p-4 space-y-1.5">
                          <div className="flex items-center gap-2 text-xs text-[var(--mute)] truncate">
                            <span>{item.category}</span>
                            {isDiscounted && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-[var(--sale)] font-semibold">On sale</span>
                              </>
                            )}
                          </div>

                          <h3
                            onClick={() => setDetailItem(item)}
                            className="font-display text-lg font-bold text-[var(--ink)] hover:underline cursor-pointer line-clamp-1"
                          >
                            {item.name}
                          </h3>

                          <p className="text-xs text-[var(--mute)] line-clamp-2 leading-relaxed">
                            {item.description}
                          </p>

                          <div className="pt-1 flex items-baseline gap-2">
                            <span
                              className={`font-mono-tabular text-base font-bold ${
                                isDiscounted ? 'text-[var(--sale)]' : 'text-[var(--ink)]'
                              }`}
                            >
                              {formatKES(effectivePrice)}
                            </span>
                            {isDiscounted && (
                              <s className="font-mono-tabular text-xs text-[var(--mute)]">
                                {formatKES(item.price)}
                              </s>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Mobile-First Touch Action Buttons */}
                      <div className="px-4 pb-4 pt-2 border-t border-[var(--line)]/60 flex flex-col gap-2">
                        <a
                          href={buildWhatsAppOrderUrl(item)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[var(--wa)] hover:opacity-95 rounded-lg transition-opacity whitespace-nowrap"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>Chat on WhatsApp</span>
                        </a>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setMpesaItem(item)}
                            className="min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-[var(--on-accent)] bg-[var(--accent)] hover:opacity-95 rounded-lg transition-opacity whitespace-nowrap cursor-pointer"
                          >
                            <Smartphone className="w-3.5 h-3.5 shrink-0" />
                            <span>Order via M-Pesa</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setDetailItem(item)}
                            className="min-h-[44px] px-3 py-2 text-xs font-semibold text-[var(--ink)] bg-[var(--bg)] hover:opacity-90 border border-[var(--ink)] rounded-lg transition-opacity whitespace-nowrap cursor-pointer"
                          >
                            Details
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {/* SECTION 3: CUSTOMER REVIEWS & SHOWROOM LOCATION */}
          <ReviewsAndLocationSection
            reviews={activeReviews}
            items={activeItems}
            currentUser={currentUser}
            isAdmin={isAdmin}
            isUsingFallbackReviews={isUsingFallbackReviews}
            onRequestSignIn={() => {
              setAuthModalMode('customer');
              setAuthModalOpen(true);
            }}
          />
        </main>
      )}

      {/* SECTION 4: FOOTER */}
      <footer className="border-t border-[var(--line)] bg-[var(--bg)] py-8 pb-24 md:pb-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[var(--mute)]">
          <div className="space-y-1">
            <strong className="font-display text-base text-[var(--ink)] block">
              PAGRA · One Stop Furniture Shop
            </strong>
            <p>
              Visit us: {PAGRA_LOCATION_ADDRESS} · {PAGRA_LOCATION_HOURS} · Call/WhatsApp{' '}
              <span className="font-mono-tabular font-semibold text-[var(--ink)]">
                {PAGRA_WHATSAPP_DISPLAY}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-5">
            <a
              href={PAGRA_LOCATION_MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[var(--ink)] font-medium transition-colors"
            >
              Google Maps
            </a>
            <button
              type="button"
              onClick={() => setCurrentView('storefront')}
              className="hover:text-[var(--ink)] font-medium transition-colors cursor-pointer"
            >
              Shop
            </button>
            <button
              type="button"
              onClick={() => setCurrentView('admin')}
              className="hover:text-[var(--ink)] font-medium transition-colors cursor-pointer"
            >
              Admin
            </button>
          </div>
        </div>
      </footer>

      {/* Fixed Mobile Bottom Navigation Bar (Natural Thumb Zone, hidden on desktop) */}
      <nav
        aria-label="Mobile bottom navigation"
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-[var(--card)]/95 backdrop-blur-md border-t border-[var(--line)] grid grid-cols-5 items-center h-16 px-1"
      >
        <button
          type="button"
          onClick={() => {
            setCurrentView('storefront');
            setSelectedCategory('ALL');
            setOnlyOnSale(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center justify-center h-full cursor-pointer ${
            currentView === 'storefront' && !onlyOnSale
              ? 'text-[var(--accent)] font-semibold'
              : 'text-[var(--mute)]'
          }`}
        >
          <Sofa className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Shop</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setCurrentView('storefront');
            setSelectedCategory('ALL');
            setOnlyOnSale(true);
            document.getElementById('browse')?.scrollIntoView({ behavior: 'smooth' });
          }}
          className={`flex flex-col items-center justify-center h-full cursor-pointer ${
            currentView === 'storefront' && onlyOnSale
              ? 'text-[var(--sale)] font-semibold'
              : 'text-[var(--mute)]'
          }`}
        >
          <Percent className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">On Sale</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setCurrentView('storefront');
            setTimeout(() => {
              document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth' });
            }, 50);
          }}
          className="flex flex-col items-center justify-center h-full text-[var(--mute)] hover:text-[var(--ink)] cursor-pointer"
        >
          <Star className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Reviews</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setCurrentView('storefront');
            setTimeout(() => {
              document.getElementById('location')?.scrollIntoView({ behavior: 'smooth' });
            }, 50);
          }}
          className="flex flex-col items-center justify-center h-full text-[var(--mute)] hover:text-[var(--ink)] cursor-pointer"
        >
          <MapPin className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Location</span>
        </button>

        {isAdmin ? (
          <button
            type="button"
            onClick={() =>
              setCurrentView((prev) => (prev === 'admin' ? 'storefront' : 'admin'))
            }
            className={`flex flex-col items-center justify-center h-full cursor-pointer ${
              currentView === 'admin' ? 'text-[var(--accent)] font-semibold' : 'text-[var(--mute)]'
            }`}
          >
            <Shield className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">
              {currentView === 'admin' ? 'Shop' : 'Dashboard'}
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setAuthModalMode('customer');
              setAuthModalOpen(true);
            }}
            className="flex flex-col items-center justify-center h-full text-[var(--mute)] hover:text-[var(--ink)] cursor-pointer"
          >
            <UserIcon className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">
              {currentUser ? 'Account' : 'Sign in'}
            </span>
          </button>
        )}
      </nav>

      {/* Modals */}
      <ProductDetailModal
        item={detailItem}
        onClose={() => setDetailItem(null)}
        onOrderMpesa={(item) => setMpesaItem(item)}
      />

      <MpesaModal
        item={mpesaItem}
        userEmail={currentUser?.email}
        onClose={() => setMpesaItem(null)}
      />

      <AuthModal
        isOpen={authModalOpen}
        initialMode={authModalMode}
        currentUser={currentUser}
        isAdmin={isAdmin}
        onClose={() => setAuthModalOpen(false)}
        onSuccessAdminRedirect={() => setCurrentView('admin')}
      />
    </div>
  );
}

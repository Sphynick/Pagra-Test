import React, { useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { signInWithEmailAndPassword, signInWithPopup, signOut, User } from 'firebase/auth';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Database,
  FolderPlus,
  ImagePlus,
  Loader2,
  Lock,
  Percent,
  Plus,
  Shield,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
} from 'lucide-react';
import {
  auth,
  BOOTSTRAP_ADMIN_EMAIL,
  db,
  firebaseConfig,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import { AdminGrant, CategoryItem, FurnitureItem } from '../types/catalog';
import {
  compressImageFileToDataUrl,
  toValidDocId,
  validateCategoryInput,
  validateFurnitureItemInput,
  VALIDATION_RULES,
} from '../utils/validation';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_FURNITURE_ITEMS,
  STUDIO_IMAGE_PRESETS,
} from '../data/seedCatalog';
import { formatKES } from '../utils/whatsapp';
import { ResilientImage } from './ResilientImage';

interface AdminDashboardProps {
  currentUser: User | null;
  isAdmin: boolean;
  items: FurnitureItem[];
  categories: CategoryItem[];
  isUsingFallbackCatalog: boolean;
  onBackToStorefront: () => void;
}

type AdminSection = 'items' | 'categories' | 'sales' | 'admins' | 'security';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  isAdmin,
  items,
  categories,
  isUsingFallbackCatalog,
  onBackToStorefront,
}) => {
  const [activeSection, setActiveSection] = useState<AdminSection>('items');
  const [bannerStatus, setBannerStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Admin Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [copiedMyUid, setCopiedMyUid] = useState(false);

  // 1. Upload / Delete Item state
  const [itemName, setItemName] = useState('');
  const [itemCategory, setItemCategory] = useState(categories[0]?.name || 'Three-Seater Sofas');
  const [itemPrice, setItemPrice] = useState('');
  const [itemDimensions, setItemDimensions] = useState('230cm W × 96cm D × 78cm H');
  const [itemMaterial, setItemMaterial] = useState('Belgian Linen & Kiln-Dried Hardwood');
  const [itemDescription, setItemDescription] = useState('');
  const [itemImageUrl, setItemImageUrl] = useState(STUDIO_IMAGE_PRESETS[0].url);
  const [isCompressingImage, setIsCompressingImage] = useState(false);
  const [isSavingItem, setIsSavingItem] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  // 2. Create Category state
  const [catName, setCatName] = useState('');
  const [catDescription, setCatDescription] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  // 3. Set Item on Sale state
  const [selectedSaleItemId, setSelectedSaleItemId] = useState<string>(items[0]?.id || '');
  const [saleEnabled, setSaleEnabled] = useState<boolean>(false);
  const [salePriceInput, setSalePriceInput] = useState<string>('');
  const [saleLabelInput, setSaleLabelInput] = useState<string>('');
  const [isSavingSale, setIsSavingSale] = useState<boolean>(false);

  // 4. Add Admin state
  const [adminsList, setAdminsList] = useState<AdminGrant[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminUid, setNewAdminUid] = useState('');
  const [isSavingAdmin, setIsSavingAdmin] = useState(false);

  useEffect(() => {
    if (categories.length > 0 && !categories.some((c) => c.name === itemCategory)) {
      setItemCategory(categories[0].name);
    }
  }, [categories, itemCategory]);

  useEffect(() => {
    if (items.length > 0 && !items.some((i) => i.id === selectedSaleItemId)) {
      setSelectedSaleItemId(items[0].id);
    }
    const found = items.find((i) => i.id === selectedSaleItemId);
    if (found) {
      setSaleEnabled(found.isOnSale);
      setSalePriceInput(
        String(
          found.isOnSale && found.salePrice < found.price
            ? found.salePrice
            : Math.round(found.price * 0.85)
        )
      );
      setSaleLabelInput(found.saleLabel || 'Showroom Archive Event');
    }
  }, [items, selectedSaleItemId]);

  useEffect(() => {
    if (!currentUser || !isAdmin) {
      setAdminsList([]);
      return;
    }

    const isBootstrap =
      currentUser.emailVerified && currentUser.email === BOOTSTRAP_ADMIN_EMAIL;

    const adminsQuery = isBootstrap
      ? collection(db, 'admins')
      : query(collection(db, 'admins'), where('addedBy', '==', currentUser.uid));

    const unsubscribe = onSnapshot(
      adminsQuery,
      (snapshot) => {
        const records: AdminGrant[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            uid: String(data.uid || docSnap.id),
            email: String(data.email || ''),
            role: 'admin',
            addedBy: String(data.addedBy || ''),
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          };
        });
        setAdminsList(records);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'admins');
        } catch {
          // Logged via handleFirestoreError
        }
      }
    );

    return () => unsubscribe();
  }, [currentUser, isAdmin]);

  const showNotice = (type: 'success' | 'error', message: string) => {
    setBannerStatus({ type, message });
    setTimeout(() => {
      setBannerStatus((prev) => (prev?.message === message ? null : prev));
    }, 5000);
  };

  const handleSeedShowroomToFirestore = async () => {
    if (!currentUser || !isAdmin) return;
    setIsSeeding(true);
    try {
      const existingCatIds = new Set(
        categories.filter((c) => c.createdBy !== 'system').map((c) => c.id)
      );
      for (const cat of DEFAULT_CATEGORIES) {
        if (!existingCatIds.has(cat.id)) {
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
      const existingItemIds = new Set(
        items.filter((i) => i.createdBy !== 'system').map((i) => i.id)
      );
      for (const item of DEFAULT_FURNITURE_ITEMS) {
        if (!existingItemIds.has(item.id)) {
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
      showNotice('success', 'Default categories and furniture items synced to Firestore.');
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.WRITE, 'items');
      } catch (e) {
        showNotice('error', e instanceof Error ? e.message : 'Failed to sync catalog.');
      }
    } finally {
      setIsSeeding(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsCompressingImage(true);
      const dataUrl = await compressImageFileToDataUrl(file, 960);
      setItemImageUrl(dataUrl);
      showNotice('success', `Image "${file.name}" compressed and ready.`);
    } catch (err) {
      showNotice('error', err instanceof Error ? err.message : 'Failed to process image.');
    } finally {
      setIsCompressingImage(false);
    }
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !isAdmin) return;

    const numericPrice = Number(itemPrice);
    const payload = {
      name: itemName.trim(),
      description: itemDescription.trim(),
      price: numericPrice,
      category: itemCategory.trim(),
      imageUrl: itemImageUrl.trim(),
      dimensions: itemDimensions.trim(),
      material: itemMaterial.trim(),
      isOnSale: false,
      salePrice: numericPrice,
      saleLabel: '',
    };

    const validationError = validateFurnitureItemInput(payload);
    if (validationError) {
      showNotice('error', validationError);
      return;
    }

    const docId = toValidDocId(`${payload.name}-${Date.now().toString().slice(-4)}`, 'item');

    try {
      setIsSavingItem(true);
      await setDoc(doc(db, 'items', docId), {
        ...payload,
        createdBy: currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setItemName('');
      setItemPrice('');
      setItemDescription('');
      showNotice('success', `"${payload.name}" uploaded.`);
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.CREATE, `items/${docId}`);
      } catch (e) {
        showNotice('error', e instanceof Error ? e.message : 'Failed to upload item.');
      }
    } finally {
      setIsSavingItem(false);
    }
  };

  const handleDeleteItem = async (item: FurnitureItem) => {
    if (!currentUser || !isAdmin) return;
    if (isUsingFallbackCatalog) {
      showNotice('error', 'Sync the default catalog to Firestore first to delete items.');
      return;
    }
    try {
      await deleteDoc(doc(db, 'items', item.id));
      showNotice('success', `"${item.name}" deleted.`);
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.DELETE, `items/${item.id}`);
      } catch (e) {
        showNotice('error', e instanceof Error ? e.message : 'Failed to delete item.');
      }
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !isAdmin) return;

    const { error, slug } = validateCategoryInput({
      name: catName,
      description: catDescription || `${catName.trim()} collection at PAGRA.`,
    });
    if (error) {
      showNotice('error', error);
      return;
    }

    try {
      setIsSavingCategory(true);
      await setDoc(doc(db, 'categories', slug), {
        name: catName.trim(),
        slug,
        description: (catDescription.trim() || `${catName.trim()} collection at PAGRA.`).slice(
          0,
          300
        ),
        createdBy: currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setCatName('');
      setCatDescription('');
      showNotice('success', `Category "${catName.trim()}" added.`);
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.CREATE, `categories/${slug}`);
      } catch (e) {
        showNotice('error', e instanceof Error ? e.message : 'Failed to add category.');
      }
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (cat: CategoryItem) => {
    if (!currentUser || !isAdmin) return;
    if (isUsingFallbackCatalog) {
      showNotice('error', 'Sync the default catalog to Firestore first to modify categories.');
      return;
    }
    try {
      await deleteDoc(doc(db, 'categories', cat.id));
      showNotice('success', `Category "${cat.name}" removed.`);
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.DELETE, `categories/${cat.id}`);
      } catch (e) {
        showNotice('error', e instanceof Error ? e.message : 'Failed to delete category.');
      }
    }
  };

  const handleSaveSaleConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !isAdmin) return;

    const targetItem = items.find((i) => i.id === selectedSaleItemId);
    if (!targetItem) {
      showNotice('error', 'Please select an item.');
      return;
    }

    if (isUsingFallbackCatalog) {
      showNotice('error', 'Click "Sync Default Catalog" first before saving sale settings.');
      return;
    }

    const numericSalePrice = saleEnabled ? Number(salePriceInput) : targetItem.price;
    const trimmedLabel = saleEnabled ? saleLabelInput.trim().slice(0, 60) : '';

    if (saleEnabled && (!Number.isFinite(numericSalePrice) || numericSalePrice <= 0)) {
      showNotice('error', 'Enter a valid sale price above 0.');
      return;
    }
    if (saleEnabled && numericSalePrice >= targetItem.price) {
      showNotice(
        'error',
        `Sale price (${formatKES(numericSalePrice)}) must be below the normal price (${formatKES(targetItem.price)}).`
      );
      return;
    }

    try {
      setIsSavingSale(true);
      await updateDoc(doc(db, 'items', targetItem.id), {
        isOnSale: saleEnabled,
        salePrice: numericSalePrice,
        saleLabel: trimmedLabel,
        updatedAt: serverTimestamp(),
      });
      showNotice('success', 'Sale settings saved.');
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.UPDATE, `items/${targetItem.id}`);
      } catch (e) {
        showNotice('error', e instanceof Error ? e.message : 'Failed to update sale status.');
      }
    } finally {
      setIsSavingSale(false);
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !isAdmin) return;

    const cleanEmail = newAdminEmail.trim().toLowerCase();
    if (!VALIDATION_RULES.EMAIL_REGEX.test(cleanEmail)) {
      showNotice('error', 'Please enter a valid email address.');
      return;
    }

    const targetUid = newAdminUid.trim()
      ? newAdminUid.trim()
      : toValidDocId(`admin_${cleanEmail}`, 'admin');

    if (!VALIDATION_RULES.ID_REGEX.test(targetUid)) {
      showNotice('error', 'UID may only contain letters, numbers, hyphens, and underscores.');
      return;
    }

    try {
      setIsSavingAdmin(true);
      await setDoc(doc(db, 'admins', targetUid), {
        uid: targetUid,
        email: cleanEmail,
        role: 'admin',
        addedBy: currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNewAdminEmail('');
      setNewAdminUid('');
      showNotice('success', `Admin privileges granted to ${cleanEmail}.`);
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.CREATE, `admins/${targetUid}`);
      } catch (e) {
        showNotice('error', e instanceof Error ? e.message : 'Failed to grant admin.');
      }
    } finally {
      setIsSavingAdmin(false);
    }
  };

  const handleRevokeAdmin = async (adminRecord: AdminGrant) => {
    if (!currentUser || !isAdmin) return;
    try {
      await deleteDoc(doc(db, 'admins', adminRecord.id));
      showNotice('success', `Removed admin ${adminRecord.email}.`);
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.DELETE, `admins/${adminRecord.id}`);
      } catch (e) {
        showNotice('error', e instanceof Error ? e.message : 'Failed to remove admin.');
      }
    }
  };

  // ROUTE GUARD 1: Unauthenticated
  if (!currentUser) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md bg-[var(--card)] border border-[var(--line)] rounded-2xl p-6 sm:p-8 space-y-5">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--mute)]">Admin area</span>
              <Lock className="w-4 h-4 text-[var(--accent)]" />
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[var(--ink)]">
              Admin Sign In
            </h1>
            <p className="text-xs text-[var(--mute)] leading-relaxed">
              Sign in with a verified admin account to manage items, categories, sales, and admins.
            </p>
          </div>

          <button
            type="button"
            disabled={loginLoading}
            onClick={async () => {
              setLoginError(null);
              try {
                setLoginLoading(true);
                await signInWithPopup(auth, googleProvider);
              } catch (err) {
                setLoginError(err instanceof Error ? err.message : 'Google Sign-In failed.');
              } finally {
                setLoginLoading(false);
              }
            }}
            className="w-full min-h-[48px] flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-[var(--on-accent)] bg-[var(--accent)] hover:opacity-95 rounded-lg transition-opacity cursor-pointer"
          >
            {loginLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Shield className="w-4 h-4" />
            )}
            <span>Continue with Google</span>
          </button>

          <div className="relative flex py-1 items-center">
            <div className="grow border-t border-[var(--line)]"></div>
            <span className="shrink mx-3 text-xs text-[var(--mute)]">or Admin Email</span>
            <div className="grow border-t border-[var(--line)]"></div>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setLoginError(null);
              try {
                setLoginLoading(true);
                await signInWithEmailAndPassword(auth, loginEmail.trim(), loginPassword);
              } catch (err) {
                setLoginError(
                  err instanceof Error ? err.message : 'Invalid administrator credentials.'
                );
              } finally {
                setLoginLoading(false);
              }
            }}
            className="space-y-3.5"
          >
            <div>
              <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Email</label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="admin@pagra.co.ke"
                className="w-full min-h-[44px] px-3.5 py-2.5 text-sm bg-[var(--bg)] text-[var(--ink)] border border-[var(--line)] rounded-lg focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Password</label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full min-h-[44px] px-3.5 py-2.5 text-sm bg-[var(--bg)] text-[var(--ink)] border border-[var(--line)] rounded-lg focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            {loginError && (
              <div className="p-3 bg-[var(--bg)] border border-[var(--sale)] rounded-lg text-xs text-[var(--sale)]">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full min-h-[48px] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] bg-[var(--bg)] border border-[var(--ink)] rounded-lg transition-colors cursor-pointer"
            >
              Sign in
            </button>
          </form>

          <div className="pt-3 border-t border-[var(--line)]">
            <button
              type="button"
              onClick={onBackToStorefront}
              className="min-h-[44px] text-xs font-semibold text-[var(--mute)] hover:text-[var(--ink)] flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to shop</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ROUTE GUARD 2: Non-Admin Customer
  if (!isAdmin) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg bg-[var(--card)] border border-[var(--line)] rounded-2xl p-6 sm:p-8 space-y-5">
          <div className="flex items-center gap-2 text-[var(--sale)] text-xs font-semibold">
            <AlertCircle className="w-4 h-4" />
            <span>Admin Area Restricted</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[var(--ink)]">
            Admin Rights Required
          </h1>
          <p className="text-sm text-[var(--mute)] leading-relaxed">
            This account (<strong>{currentUser.email}</strong>) is not an admin, or its email is not
            verified. Share your UID below with an existing admin to be granted access.
          </p>

          <div className="p-4 bg-[var(--bg)] border border-[var(--line)] rounded-xl flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="block text-xs text-[var(--mute)]">Your Firebase UID</span>
              <span className="block text-xs font-mono-tabular text-[var(--ink)] truncate">
                {currentUser.uid}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(currentUser.uid);
                setCopiedMyUid(true);
                setTimeout(() => setCopiedMyUid(false), 2000);
              }}
              className="min-h-[40px] px-3 py-1.5 text-xs font-semibold bg-[var(--card)] text-[var(--ink)] border border-[var(--line)] rounded-lg flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              {copiedMyUid ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy UID</span>
                </>
              )}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onBackToStorefront}
              className="min-h-[44px] px-5 py-2.5 text-xs font-semibold text-[var(--on-accent)] bg-[var(--accent)] rounded-lg cursor-pointer"
            >
              Back to shop
            </button>
            <button
              type="button"
              onClick={() => signOut(auth)}
              className="min-h-[44px] px-4 py-2.5 text-xs font-semibold text-[var(--sale)] border border-[var(--sale)] rounded-lg cursor-pointer"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentSaleItem = items.find((i) => i.id === selectedSaleItemId);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6 pb-24 md:pb-12">
      {/* Top Admin Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[var(--line)]">
        <div>
          <div className="flex items-center gap-2 text-xs text-[var(--mute)]">
            <span>PAGRA Admin</span>
            <span aria-hidden="true">·</span>
            <span className="text-[var(--accent)] font-semibold truncate">{currentUser.email}</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[var(--ink)] mt-1">
            Dashboard
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isUsingFallbackCatalog && (
            <button
              type="button"
              onClick={handleSeedShowroomToFirestore}
              disabled={isSeeding}
              className="min-h-[44px] flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[var(--on-accent)] bg-[var(--accent)] rounded-lg whitespace-nowrap cursor-pointer"
            >
              {isSeeding ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>Sync Default Catalog</span>
            </button>
          )}
          <button
            type="button"
            onClick={onBackToStorefront}
            className="min-h-[44px] flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[var(--ink)] bg-[var(--card)] border border-[var(--ink)] rounded-lg whitespace-nowrap cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to shop</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {bannerStatus && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs ${
            bannerStatus.type === 'success'
              ? 'bg-[var(--card)] border-[var(--accent)] text-[var(--accent)]'
              : 'bg-[var(--card)] border-[var(--sale)] text-[var(--sale)]'
          }`}
        >
          <div className="flex items-center gap-2">
            {bannerStatus.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[var(--accent)] shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-[var(--sale)] shrink-0" />
            )}
            <span className="font-medium">{bannerStatus.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setBannerStatus(null)}
            className="text-[var(--mute)] hover:text-[var(--ink)] font-semibold ml-4 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Horizontal Touch-Scrollable Admin Tabs */}
      <div
        role="tablist"
        className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 pb-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeSection === 'items'}
          onClick={() => setActiveSection('items')}
          className={`min-h-[44px] flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeSection === 'items'
              ? 'bg-[var(--ink)] text-[var(--bg)] border-[var(--ink)]'
              : 'bg-[var(--card)] text-[var(--ink)] border-[var(--line)]'
          }`}
        >
          <ImagePlus className="w-4 h-4" />
          <span>Upload / Delete item</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeSection === 'categories'}
          onClick={() => setActiveSection('categories')}
          className={`min-h-[44px] flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeSection === 'categories'
              ? 'bg-[var(--ink)] text-[var(--bg)] border-[var(--ink)]'
              : 'bg-[var(--card)] text-[var(--ink)] border-[var(--line)]'
          }`}
        >
          <FolderPlus className="w-4 h-4" />
          <span>Create category</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeSection === 'sales'}
          onClick={() => setActiveSection('sales')}
          className={`min-h-[44px] flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeSection === 'sales'
              ? 'bg-[var(--ink)] text-[var(--bg)] border-[var(--ink)]'
              : 'bg-[var(--card)] text-[var(--ink)] border-[var(--line)]'
          }`}
        >
          <Percent className="w-4 h-4" />
          <span>Set item on sale</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeSection === 'admins'}
          onClick={() => setActiveSection('admins')}
          className={`min-h-[44px] flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeSection === 'admins'
              ? 'bg-[var(--ink)] text-[var(--bg)] border-[var(--ink)]'
              : 'bg-[var(--card)] text-[var(--ink)] border-[var(--line)]'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          <span>Add admin</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeSection === 'security'}
          onClick={() => setActiveSection('security')}
          className={`min-h-[44px] flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeSection === 'security'
              ? 'bg-[var(--ink)] text-[var(--bg)] border-[var(--ink)]'
              : 'bg-[var(--card)] text-[var(--ink)] border-[var(--line)]'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Config & Rules</span>
        </button>
      </div>

      {/* SECTION 1: UPLOAD / DELETE ITEM */}
      {activeSection === 'items' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
          <div className="lg:col-span-5 bg-[var(--card)] border border-[var(--line)] rounded-xl p-5 sm:p-6 space-y-4 h-fit">
            <h2 className="font-display text-xl font-bold text-[var(--ink)]">Upload Item</h2>

            <form onSubmit={handleCreateItem} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Name</label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={120}
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="e.g. The Serengeti Bouclé Sofa"
                  className="w-full min-h-[44px] px-3.5 py-2.5 text-sm bg-[var(--bg)] text-[var(--ink)] border border-[var(--line)] rounded-lg focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  required
                  minLength={10}
                  maxLength={2000}
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  placeholder="Sofa materials, dimensions, and cushion comfort..."
                  className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg)] text-[var(--ink)] border border-[var(--line)] rounded-lg focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                    Price (KES)
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={100000000}
                    value={itemPrice}
                    onChange={(e) => setItemPrice(e.target.value)}
                    placeholder="165000"
                    className="w-full min-h-[44px] px-3.5 py-2.5 text-sm font-mono-tabular bg-[var(--bg)] text-[var(--ink)] border border-[var(--line)] rounded-lg focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                    Category
                  </label>
                  <select
                    value={itemCategory}
                    onChange={(e) => setItemCategory(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 text-sm bg-[var(--bg)] text-[var(--ink)] border border-[var(--line)] rounded-lg focus:outline-none focus:border-[var(--accent)]"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                    Dimensions
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={120}
                    value={itemDimensions}
                    onChange={(e) => setItemDimensions(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-[var(--bg)] text-[var(--ink)] border border-[var(--line)] rounded-lg focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                    Material
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={120}
                    value={itemMaterial}
                    onChange={(e) => setItemMaterial(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-[var(--bg)] text-[var(--ink)] border border-[var(--line)] rounded-lg focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>

              <div className="space-y-2.5 pt-1">
                <label className="block text-xs font-semibold text-[var(--ink)]">
                  Image (Upload from device or choose preset)
                </label>

                <label className="min-h-[44px] flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-[var(--ink)] bg-[var(--bg)] border border-[var(--ink)] rounded-lg cursor-pointer">
                  {isCompressingImage ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  <span>Choose Image File</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                <select
                  value={
                    STUDIO_IMAGE_PRESETS.some((p) => p.url === itemImageUrl)
                      ? itemImageUrl
                      : 'custom'
                  }
                  onChange={(e) => {
                    if (e.target.value !== 'custom') {
                      setItemImageUrl(e.target.value);
                    }
                  }}
                  className="w-full min-h-[40px] px-3 py-1.5 text-xs bg-[var(--bg)] text-[var(--ink)] border border-[var(--line)] rounded-lg"
                >
                  {STUDIO_IMAGE_PRESETS.map((preset) => (
                    <option key={preset.url} value={preset.url}>
                      Preset: {preset.label}
                    </option>
                  ))}
                  <option value="custom">Custom Uploaded / URL Image</option>
                </select>

                <div className="aspect-4/3 w-full rounded-lg overflow-hidden border border-[var(--line)] bg-[var(--bg)]">
                  <ResilientImage
                    src={itemImageUrl}
                    alt="Upload preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSavingItem || isCompressingImage}
                className="w-full min-h-[48px] flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-[var(--on-accent)] bg-[var(--accent)] hover:opacity-95 disabled:opacity-60 rounded-lg transition-opacity cursor-pointer"
              >
                {isSavingItem ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                <span>Upload item</span>
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 space-y-3">
            <h2 className="font-display text-xl font-bold text-[var(--ink)]">
              Existing items ({items.length})
            </h2>

            <div className="space-y-2.5">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[var(--card)] border border-[var(--line)] rounded-xl"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-16 h-14 rounded-lg overflow-hidden bg-[var(--line)] shrink-0">
                      <ResilientImage
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-[var(--ink)] truncate">
                        {item.name}
                      </h3>
                      <p className="text-xs text-[var(--mute)] font-mono-tabular">
                        {item.category} · {formatKES(item.isOnSale ? item.salePrice : item.price)}
                        {item.isOnSale ? ' (On sale)' : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSaleItemId(item.id);
                        setActiveSection('sales');
                      }}
                      className="flex-1 sm:flex-initial min-h-[40px] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] bg-[var(--bg)] border border-[var(--line)] rounded-lg cursor-pointer"
                    >
                      Sale settings
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(item)}
                      className="min-h-[40px] px-3 py-1.5 text-xs font-semibold text-[var(--sale)] border border-[var(--sale)] rounded-lg flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: CREATE CATEGORY */}
      {activeSection === 'categories' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
          <div className="lg:col-span-5 bg-[var(--card)] border border-[var(--line)] rounded-xl p-5 sm:p-6 space-y-4 h-fit">
            <h2 className="font-display text-xl font-bold text-[var(--ink)]">Create Category</h2>

            <form onSubmit={handleCreateCategory} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                  Category name
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={80}
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="e.g. Sofas"
                  className="w-full min-h-[44px] px-3.5 py-2.5 text-sm bg-[var(--bg)] text-[var(--ink)] border border-[var(--line)] rounded-lg focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  maxLength={300}
                  value={catDescription}
                  onChange={(e) => setCatDescription(e.target.value)}
                  placeholder="Short summary of this furniture category..."
                  className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg)] text-[var(--ink)] border border-[var(--line)] rounded-lg focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <button
                type="submit"
                disabled={isSavingCategory}
                className="w-full min-h-[48px] flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-[var(--on-accent)] bg-[var(--accent)] rounded-lg cursor-pointer"
              >
                {isSavingCategory ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FolderPlus className="w-4 h-4" />
                )}
                <span>Add category</span>
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 space-y-3">
            <h2 className="font-display text-xl font-bold text-[var(--ink)]">
              Categories ({categories.length})
            </h2>
            <div className="space-y-2">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="p-4 bg-[var(--card)] border border-[var(--line)] rounded-xl flex items-center justify-between gap-4"
                >
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--ink)]">{cat.name}</h3>
                    <p className="text-xs text-[var(--mute)]">{cat.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteCategory(cat)}
                    className="min-h-[38px] px-3 py-1.5 text-xs font-semibold text-[var(--sale)] border border-[var(--sale)] rounded-lg shrink-0 cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: SET ITEM ON SALE */}
      {activeSection === 'sales' && (
        <div className="max-w-xl bg-[var(--card)] border border-[var(--line)] rounded-xl p-5 sm:p-6 space-y-5">
          <h2 className="font-display text-xl font-bold text-[var(--ink)]">Set Item on Sale</h2>

          <form onSubmit={handleSaveSaleConfig} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Item</label>
              <select
                value={selectedSaleItemId}
                onChange={(e) => setSelectedSaleItemId(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2.5 text-sm bg-[var(--bg)] text-[var(--ink)] border border-[var(--line)] rounded-lg focus:outline-none focus:border-[var(--accent)]"
              >
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({formatKES(item.price)})
                  </option>
                ))}
              </select>
            </div>

            <label className="min-h-[48px] flex items-center gap-3 p-3.5 bg-[var(--bg)] border border-[var(--line)] rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={saleEnabled}
                onChange={(e) => setSaleEnabled(e.target.checked)}
                className="w-5 h-5 accent-[var(--accent)]"
              />
              <span className="text-sm font-semibold text-[var(--ink)]">
                This item is on sale
              </span>
            </label>

            {saleEnabled && currentSaleItem && (
              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                    Sale price (KES) — Normal: {formatKES(currentSaleItem.price)}
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={currentSaleItem.price - 1}
                    value={salePriceInput}
                    onChange={(e) => setSalePriceInput(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2.5 text-sm font-mono-tabular bg-[var(--bg)] text-[var(--ink)] border border-[var(--line)] rounded-lg focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                    Sale Label (Optional)
                  </label>
                  <input
                    type="text"
                    maxLength={60}
                    value={saleLabelInput}
                    onChange={(e) => setSaleLabelInput(e.target.value)}
                    placeholder="e.g. Showroom Offer"
                    className="w-full min-h-[44px] px-3.5 py-2.5 text-sm bg-[var(--bg)] text-[var(--ink)] border border-[var(--line)] rounded-lg focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSavingSale}
              className="w-full min-h-[48px] flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-[var(--on-accent)] bg-[var(--accent)] rounded-lg cursor-pointer"
            >
              {isSavingSale ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>Save</span>
            </button>
          </form>
        </div>
      )}

      {/* SECTION 4: ADD ADMIN */}
      {activeSection === 'admins' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
          <div className="lg:col-span-5 bg-[var(--card)] border border-[var(--line)] rounded-xl p-5 sm:p-6 space-y-4 h-fit">
            <h2 className="font-display text-xl font-bold text-[var(--ink)]">Add Admin</h2>

            <form onSubmit={handleAddAdmin} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                  Email to make admin
                </label>
                <input
                  type="email"
                  required
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="colleague@pagra.co.ke"
                  className="w-full min-h-[44px] px-3.5 py-2.5 text-sm bg-[var(--bg)] text-[var(--ink)] border border-[var(--line)] rounded-lg focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                  User Firebase UID (Optional)
                </label>
                <input
                  type="text"
                  value={newAdminUid}
                  onChange={(e) => setNewAdminUid(e.target.value)}
                  placeholder="Paste user UID from Account Profile"
                  className="w-full min-h-[44px] px-3.5 py-2.5 text-sm font-mono-tabular bg-[var(--bg)] text-[var(--ink)] border border-[var(--line)] rounded-lg focus:outline-none focus:border-[var(--accent)]"
                />
                <p className="text-xs text-[var(--mute)] mt-1">
                  They must sign in with a verified email (Google works) to use admin rights.
                </p>
              </div>

              <button
                type="submit"
                disabled={isSavingAdmin}
                className="w-full min-h-[48px] flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-[var(--on-accent)] bg-[var(--accent)] rounded-lg cursor-pointer"
              >
                {isSavingAdmin ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                <span>Grant admin</span>
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 space-y-3">
            <h2 className="font-display text-xl font-bold text-[var(--ink)]">Current Admins</h2>
            <div className="space-y-2">
              <div className="p-4 bg-[var(--card)] border border-[var(--line)] rounded-xl flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[var(--ink)]">{BOOTSTRAP_ADMIN_EMAIL}</p>
                  <p className="text-xs text-[var(--mute)]">Primary Admin (you)</p>
                </div>
                <span className="text-xs text-[var(--mute)] font-mono-tabular">Root</span>
              </div>

              {adminsList.map((adm) => (
                <div
                  key={adm.id}
                  className="p-4 bg-[var(--card)] border border-[var(--line)] rounded-xl flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--ink)] truncate">{adm.email}</p>
                    <p className="text-xs text-[var(--mute)] font-mono-tabular truncate">
                      ID: {adm.uid}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRevokeAdmin(adm)}
                    className="min-h-[38px] px-3 py-1.5 text-xs font-semibold text-[var(--sale)] border border-[var(--sale)] rounded-lg shrink-0 cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 5: FIREBASE CONFIG & SECURITY RULES */}
      {activeSection === 'security' && (
        <div className="space-y-5">
          <div className="bg-[var(--card)] border border-[var(--line)] rounded-xl p-5 sm:p-6 space-y-4">
            <h2 className="font-display text-xl font-bold text-[var(--ink)]">
              Firebase Configuration (`pagra-shop-test`) & Collections
            </h2>
            <pre className="p-4 bg-black/90 text-emerald-100 rounded-lg text-xs font-mono-tabular overflow-x-auto leading-relaxed">
              {JSON.stringify(firebaseConfig, null, 2)}
            </pre>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 bg-[var(--bg)] border border-[var(--line)] rounded-lg">
                <p className="font-mono-tabular font-bold text-[var(--ink)]">/items/{'{itemId}'}</p>
                <p className="text-[var(--mute)] mt-1">Public read · Admin write</p>
              </div>
              <div className="p-3.5 bg-[var(--bg)] border border-[var(--line)] rounded-lg">
                <p className="font-mono-tabular font-bold text-[var(--ink)]">
                  /categories/{'{categoryId}'}
                </p>
                <p className="text-[var(--mute)] mt-1">Public read · Admin write</p>
              </div>
              <div className="p-3.5 bg-[var(--bg)] border border-[var(--line)] rounded-lg">
                <p className="font-mono-tabular font-bold text-[var(--ink)]">
                  /reviews/{'{reviewId}'}
                </p>
                <p className="text-[var(--mute)] mt-1">Public read · Verified user write</p>
              </div>
              <div className="p-3.5 bg-[var(--bg)] border border-[var(--line)] rounded-lg">
                <p className="font-mono-tabular font-bold text-[var(--ink)]">/admins/{'{adminId}'}</p>
                <p className="text-[var(--mute)] mt-1">Owner/Admin read · Admin write</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

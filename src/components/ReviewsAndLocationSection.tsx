import React, { useState } from 'react';
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  MapPin,
  MessageCircle,
  MessageSquarePlus,
  Phone,
  Star,
  Trash2,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { CustomerReview, FurnitureItem } from '../types/catalog';
import {
  PAGRA_LOCATION_ADDRESS,
  PAGRA_LOCATION_EMBED_URL,
  PAGRA_LOCATION_HOURS,
  PAGRA_LOCATION_MAPS_URL,
} from '../data/seedCatalog';
import { PAGRA_WHATSAPP_DISPLAY, PAGRA_WHATSAPP_E164 } from '../utils/whatsapp';
import { toValidDocId, validateCustomerReviewInput } from '../utils/validation';

interface ReviewsAndLocationSectionProps {
  reviews: CustomerReview[];
  items: FurnitureItem[];
  currentUser: User | null;
  isAdmin: boolean;
  isUsingFallbackReviews: boolean;
  onRequestSignIn: () => void;
}

export const ReviewsAndLocationSection: React.FC<ReviewsAndLocationSectionProps> = ({
  reviews,
  items,
  currentUser,
  isAdmin,
  isUsingFallbackReviews,
  onRequestSignIn,
}) => {
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [authorName, setAuthorName] = useState(
    currentUser?.displayName || (currentUser?.email ? currentUser.email.split('@')[0] : '')
  );
  const [authorLocation, setAuthorLocation] = useState('Nairobi, Kenya');
  const [itemName, setItemName] = useState(items[0]?.name || 'The Serengeti Bouclé Cloud Sofa');
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const averageRating =
    reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : '5.0';

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!currentUser) {
      onRequestSignIn();
      return;
    }

    if (!currentUser.emailVerified) {
      setFeedback({
        type: 'error',
        message:
          'Your email must be verified to publish a public review. Sign in with Google or verify your email link.',
      });
      return;
    }

    const payload = {
      authorName: authorName.trim(),
      authorLocation: authorLocation.trim(),
      itemName: itemName.trim(),
      rating: Number(rating),
      comment: comment.trim(),
    };

    const validationError = validateCustomerReviewInput(payload);
    if (validationError) {
      setFeedback({ type: 'error', message: validationError });
      return;
    }

    const reviewId = toValidDocId(
      `rev_${payload.authorName}_${Date.now().toString().slice(-5)}`,
      'rev'
    );

    try {
      setIsSubmitting(true);
      await setDoc(doc(db, 'reviews', reviewId), {
        ...payload,
        createdBy: currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setComment('');
      setShowReviewForm(false);
      setFeedback({
        type: 'success',
        message: 'Thank you! Your review has been published to the PAGRA showroom.',
      });
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.CREATE, `reviews/${reviewId}`);
      } catch (e) {
        setFeedback({
          type: 'error',
          message: e instanceof Error ? e.message : 'Unable to submit review.',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteReview = async (review: CustomerReview) => {
    if (!currentUser || isUsingFallbackReviews) return;
    try {
      await deleteDoc(doc(db, 'reviews', review.id));
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.DELETE, `reviews/${review.id}`);
      } catch {
        // Logged via handleFirestoreError
      }
    }
  };

  return (
    <div className="border-t border-[var(--line)] bg-[var(--bg)]">
      {/* PART 1: CUSTOMER REVIEWS */}
      <section id="reviews" className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-7">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-[var(--line)]">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-[var(--mute)]">
              <span>Customer Reviews</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular font-semibold text-[var(--ink)]">
                {averageRating} / 5.0 ({reviews.length} Reviews)
              </span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[var(--ink)]">
              What Our Customers Say
            </h2>
          </div>

          <div>
            {currentUser ? (
              <button
                type="button"
                onClick={() => {
                  if (!authorName && currentUser.email) {
                    setAuthorName(currentUser.displayName || currentUser.email.split('@')[0]);
                  }
                  setShowReviewForm((prev) => !prev);
                }}
                className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-[var(--on-accent)] bg-[var(--accent)] hover:opacity-95 rounded-lg transition-opacity whitespace-nowrap cursor-pointer"
              >
                <MessageSquarePlus className="w-4 h-4" />
                <span>{showReviewForm ? 'Close Review Form' : 'Write a Review'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onRequestSignIn}
                className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-[var(--ink)] bg-[var(--card)] hover:bg-[var(--bg)] border border-[var(--ink)] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                <MessageSquarePlus className="w-4 h-4" />
                <span>Sign in to Leave a Review</span>
              </button>
            )}
          </div>
        </div>

        {feedback && (
          <div
            className={`p-4 rounded-xl border flex items-center justify-between text-xs ${
              feedback.type === 'success'
                ? 'bg-[var(--card)] border-[var(--accent)] text-[var(--accent)]'
                : 'bg-[var(--card)] border-[var(--sale)] text-[var(--sale)]'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'success' && (
                <CheckCircle2 className="w-4 h-4 text-[var(--accent)] shrink-0" />
              )}
              <span className="font-medium">{feedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-[var(--mute)] hover:text-[var(--ink)] font-semibold ml-4 cursor-pointer"
            >
              Close
            </button>
          </div>
        )}

        {/* Submit Review Form */}
        {showReviewForm && currentUser && (
          <form
            onSubmit={handleSubmitReview}
            className="p-5 sm:p-6 bg-[var(--card)] border border-[var(--line)] rounded-xl space-y-4 max-w-2xl"
          >
            <h3 className="font-display text-xl font-bold text-[var(--ink)]">
              Share Your PAGRA Experience
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                  Your Name
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={80}
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="e.g. Wanjiku Njoroge"
                  className="w-full min-h-[44px] px-3.5 py-2.5 text-sm bg-[var(--bg)] text-[var(--ink)] border border-[var(--line)] rounded-lg focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                  Location
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={80}
                  value={authorLocation}
                  onChange={(e) => setAuthorLocation(e.target.value)}
                  placeholder="e.g. Karen, Nairobi"
                  className="w-full min-h-[44px] px-3.5 py-2.5 text-sm bg-[var(--bg)] text-[var(--ink)] border border-[var(--line)] rounded-lg focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                  Item Purchased
                </label>
                <select
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 text-sm bg-[var(--bg)] text-[var(--ink)] border border-[var(--line)] rounded-lg focus:outline-none focus:border-[var(--accent)]"
                >
                  {items.map((item) => (
                    <option key={item.id} value={item.name}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                  Rating (1–5)
                </label>
                <div className="flex items-center gap-1 pt-1">
                  {[1, 2, 3, 4, 5].map((starVal) => (
                    <button
                      key={starVal}
                      type="button"
                      onClick={() => setRating(starVal)}
                      className="min-h-[44px] min-w-[40px] flex items-center justify-center text-[var(--ink)] cursor-pointer"
                      aria-label={`Rate ${starVal} out of 5 stars`}
                    >
                      <Star
                        className={`w-5 h-5 ${
                          starVal <= rating
                            ? 'fill-[var(--accent)] text-[var(--accent)]'
                            : 'text-[var(--line)]'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-xs font-mono-tabular text-[var(--mute)] ml-1">
                    {rating}.0 / 5.0
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                Review Comment
              </label>
              <textarea
                rows={3}
                required
                minLength={10}
                maxLength={1000}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Tell us about your sofa quality and delivery experience..."
                className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg)] text-[var(--ink)] border border-[var(--line)] rounded-lg focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2.5">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-[var(--on-accent)] bg-[var(--accent)] hover:opacity-95 disabled:opacity-60 rounded-lg transition-opacity cursor-pointer"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Publish Review</span>
              </button>
              <button
                type="button"
                onClick={() => setShowReviewForm(false)}
                className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 text-sm font-semibold text-[var(--mute)] hover:text-[var(--ink)] cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Reviews Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
          {reviews.map((rev) => {
            const canDelete =
              !isUsingFallbackReviews &&
              currentUser &&
              (isAdmin || rev.createdBy === currentUser.uid);

            return (
              <article
                key={rev.id}
                className="p-5 bg-[var(--card)] border border-[var(--line)] rounded-xl flex flex-col justify-between gap-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div
                      className="flex items-center gap-0.5"
                      aria-label={`${rev.rating} out of 5 stars`}
                    >
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          className={`w-4 h-4 ${
                            n <= rev.rating
                              ? 'fill-[var(--accent)] text-[var(--accent)]'
                              : 'text-[var(--line)]'
                          }`}
                        />
                      ))}
                    </div>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => handleDeleteReview(rev)}
                        className="min-h-[36px] min-w-[36px] flex items-center justify-center text-[var(--mute)] hover:text-[var(--sale)] cursor-pointer"
                        title="Delete review"
                        aria-label={`Delete review by ${rev.authorName}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-[var(--mute)] truncate">
                    Item: <span className="font-semibold text-[var(--ink)]">{rev.itemName}</span>
                  </p>

                  <p className="text-sm text-[var(--ink)] leading-relaxed">"{rev.comment}"</p>
                </div>

                <div className="pt-3 border-t border-[var(--line)] flex items-center justify-between text-xs text-[var(--mute)]">
                  <span className="font-semibold text-[var(--ink)]">{rev.authorName}</span>
                  <span>{rev.authorLocation}</span>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* PART 2: SHOWROOM LOCATION & DIRECTIONS */}
      <section
        id="location"
        className="border-t border-[var(--line)] bg-[var(--card)] py-10 sm:py-14"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Showroom Address, Hours, & Direct Actions */}
          <div className="lg:col-span-5 space-y-5">
            <div className="space-y-1.5">
              <p className="text-xs text-[var(--mute)]">Visit Our Showroom</p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[var(--ink)]">
                PAGRA Showroom Location
              </h2>
              <p className="text-sm text-[var(--mute)] leading-relaxed">
                Test our sofa comfort, inspect hardwood frames, and browse fabric and leather
                swatches in person.
              </p>
            </div>

            <div className="space-y-3 text-sm border-t border-b border-[var(--line)] py-4">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-[var(--accent)] shrink-0 mt-1" />
                <div>
                  <span className="block text-xs text-[var(--mute)]">Location</span>
                  <span className="font-semibold text-[var(--ink)]">{PAGRA_LOCATION_ADDRESS}</span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-[var(--accent)] shrink-0 mt-1" />
                <div>
                  <span className="block text-xs text-[var(--mute)]">Hours</span>
                  <span className="font-semibold text-[var(--ink)]">{PAGRA_LOCATION_HOURS}</span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-[var(--accent)] shrink-0 mt-1" />
                <div>
                  <span className="block text-xs text-[var(--mute)]">Call / WhatsApp</span>
                  <span className="font-mono-tabular font-semibold text-[var(--ink)]">
                    {PAGRA_WHATSAPP_DISPLAY}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <a
                href={PAGRA_LOCATION_MAPS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[48px] flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-[var(--on-accent)] bg-[var(--accent)] hover:opacity-95 rounded-lg transition-opacity whitespace-nowrap"
              >
                <MapPin className="w-4 h-4" />
                <span>Open in Google Maps</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-85" />
              </a>

              <a
                href={`https://wa.me/${PAGRA_WHATSAPP_E164}?text=${encodeURIComponent(
                  `Hello PAGRA (${PAGRA_WHATSAPP_DISPLAY}), I would like directions to visit your showroom (${PAGRA_LOCATION_MAPS_URL}).`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[48px] flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-[var(--wa)] hover:opacity-95 rounded-lg transition-opacity whitespace-nowrap"
              >
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp Directions</span>
              </a>
            </div>
          </div>

          {/* Right Column: Interactive Map Embed + Direct Pin Link */}
          <div className="lg:col-span-7">
            <div className="bg-[var(--bg)] border border-[var(--line)] rounded-xl overflow-hidden">
              <div className="aspect-16/10 sm:aspect-16/9 w-full bg-[var(--line)] relative">
                <iframe
                  title="PAGRA shop location"
                  src={PAGRA_LOCATION_EMBED_URL}
                  width="100%"
                  height="100%"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="w-full h-full border-0"
                />
              </div>
              <div className="px-4 py-3 bg-[var(--card)] border-t border-[var(--line)] flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-[var(--mute)] truncate">{PAGRA_LOCATION_ADDRESS}</span>
                <a
                  href={PAGRA_LOCATION_MAPS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-[var(--accent)] hover:underline flex items-center gap-1 whitespace-nowrap"
                >
                  <span>Google Maps Pin</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

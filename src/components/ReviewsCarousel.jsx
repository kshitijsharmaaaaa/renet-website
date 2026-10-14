import { useEffect, useState } from "react";
import useDriftCarousel from "../hooks/useDriftCarousel";
import "./ReviewsCarousel.css";

// Cards per second — one review roughly every 7 seconds.
const DRIFT_SPEED = 0.14;
// Cards rendered beyond each visible edge; enough to cover the edges mid-drift.
const BUFFER = 2;

const wrap = (value, length) => ((value % length) + length) % length;

// 3 reviews on desktop, 2 on tablet, 1 on mobile.
const PER_VIEW_QUERIES = [
  ["(max-width: 640px)", 1],
  ["(max-width: 1024px)", 2],
];

function getPerView() {
  const match = PER_VIEW_QUERIES.find(([query]) => window.matchMedia(query).matches);
  return match ? match[1] : 3;
}

function usePerView() {
  const [perView, setPerView] = useState(getPerView);
  useEffect(() => {
    const lists = PER_VIEW_QUERIES.map(([query]) => window.matchMedia(query));
    const update = () => setPerView(getPerView());
    lists.forEach((list) => list.addEventListener("change", update));
    return () => lists.forEach((list) => list.removeEventListener("change", update));
  }, []);
  return perView;
}

function Stars({ rating }) {
  return (
    <span className="review-stars" role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={star <= rating ? "review-star filled" : "review-star"} aria-hidden="true">
          ★
        </span>
      ))}
    </span>
  );
}

/*
  Same engine as ScooterCarousel (useDriftCarousel): a slow continuous drift,
  every card keyed by its virtual index and moved with transforms only, so the
  loop from review 8 back to 1 never jumps. Arrows and dots glide to a card.
*/
export default function ReviewsCarousel({ reviews }) {
  const perView = usePerView();
  const count = reviews.length;
  const { base, dragging, registerSlide, next, previous, goTo, shellProps, viewportProps } =
    useDriftCarousel({ count, speed: DRIFT_SPEED });

  const active = wrap(base, count);

  const slides = [];
  for (let offset = -BUFFER; offset < perView + BUFFER; offset += 1) {
    const virtualIndex = base + offset;
    slides.push({ virtualIndex, offset, review: reviews[wrap(virtualIndex, count)] });
  }

  return (
    <div className="reviews-carousel" {...shellProps}>
      <div
        {...viewportProps}
        className={dragging ? "reviews-track is-dragging" : "reviews-track"}
        style={{ "--per-view": perView }}
        role="region"
        aria-roledescription="carousel"
        aria-label="Customer reviews"
      >
        {slides.map(({ virtualIndex, offset, review }) => {
          const visible = offset >= 0 && offset < perView;
          return (
            <div
              key={virtualIndex}
              ref={registerSlide(virtualIndex)}
              data-index={virtualIndex}
              className="review-slide"
              aria-hidden={!visible}
            >
              <figure className="review-card">
                <div className="review-card-top">
                  <Stars rating={review.rating} />
                  {review.placeholder && <span className="review-sample-badge">Sample</span>}
                </div>

                <blockquote className="review-text">
                  <p>{review.text}</p>
                </blockquote>

                <figcaption className="review-author">
                  <span className="review-avatar" aria-hidden="true">
                    {review.initials}
                  </span>
                  <span className="review-author-copy">
                    <strong>{review.name}</strong>
                    <span>{review.detail}</span>
                  </span>
                </figcaption>
              </figure>
            </div>
          );
        })}
      </div>

      <div className="reviews-controls">
        <button
          type="button"
          className="reviews-arrow"
          onClick={previous}
          aria-label="Previous review"
        >
          ←
        </button>

        <div className="reviews-dots">
          {reviews.map((review, index) => (
            <button
              type="button"
              key={review.id}
              className={index === active ? "reviews-dot selected" : "reviews-dot"}
              onClick={() => goTo(index)}
              aria-label={`Show review ${index + 1} of ${count}`}
              aria-pressed={index === active}
            />
          ))}
        </div>

        <button
          type="button"
          className="reviews-arrow"
          onClick={next}
          aria-label="Next review"
        >
          →
        </button>
      </div>
    </div>
  );
}

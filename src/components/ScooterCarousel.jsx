import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useDriftCarousel from "../hooks/useDriftCarousel";
import { responsiveImage } from "../lib/images";

// Cards per second — one card roughly every 9 seconds.
const DRIFT_SPEED = 0.11;
// Cards rendered either side of the centre; enough to cover the edges mid-drift.
const RANGE = 3;

const wrap = (value, length) => ((value % length) + length) % length;

/*
  The lineup drifts slowly and continuously (see useDriftCarousel). Every card
  is keyed by its virtual index, so cards are never remounted while moving and
  the loop from the last model back to the first is seamless. The centre
  "spotlight" (lift, scale, shadow) follows the `--focus` CSS variable, so it
  transitions smoothly as each card passes through the middle.
*/
export default function ScooterCarousel({ models, onActiveChange }) {
  const navigate = useNavigate();
  const count = models.length;
  const { base, dragging, registerSlide, next, previous, goTo, goToVirtual, shellProps, viewportProps } =
    useDriftCarousel({ count, speed: DRIFT_SPEED });

  const active = wrap(base, count);

  useEffect(() => {
    onActiveChange?.(active);
  }, [active, onActiveChange]);

  const slides = [];
  for (let offset = -RANGE; offset <= RANGE; offset += 1) {
    const virtualIndex = base + offset;
    const index = wrap(virtualIndex, count);
    slides.push({ virtualIndex, offset, index, item: models[index] });
  }

  return (
    <div className="scooter-carousel-shell" {...shellProps}>
      <div
        {...viewportProps}
        className={dragging ? "scooter-carousel is-dragging" : "scooter-carousel"}
        role="region"
        aria-roledescription="carousel"
        aria-label="RENET scooter lineup"
      >
        {slides.map(({ virtualIndex, offset, index, item }) => {
          const isActive = offset === 0;

          return (
            <div
              key={virtualIndex}
              ref={registerSlide(virtualIndex)}
              data-index={virtualIndex}
              className={isActive ? "carousel-slide is-active" : "carousel-slide"}
              aria-hidden={Math.abs(offset) > 1}
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${count}: ${item.name}`}
            >
              <article
                className={isActive ? "scooter-card active-card" : "scooter-card side-card"}
                onClick={() => {
                  if (!isActive) goToVirtual(virtualIndex);
                }}
              >
                <div className={`scooter-photo scooter-photo-${index}`}>
                  <div className="scooter-photo-glow" />
                  <span className="scooter-photo-label">RENET / {item.id}</span>
                  <img
                    className="scooter-product-image"
                    {...responsiveImage(item.image, "(max-width: 768px) 100vw, 34vw")}
                    alt={`RENET ${item.name} electric scooter`}
                    loading="lazy"
                    decoding="async"
                    draggable="false"
                  />
                  <span className="scooter-photo-bottom">ELECTRIC MOBILITY · INDIA</span>
                </div>

                <div className="scooter-card-content">
                  <span className="scooter-category">{item.category}</span>
                  <h3>{item.name}</h3>
                  <p>{item.tagline}</p>

                  <div className="scooter-card-actions">
                    <a href="#contact" onClick={(event) => event.stopPropagation()}>
                      Enquire <span>↗</span>
                    </a>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        navigate(item.color === "white" ? "/scooters/d8-white" : "/scooters/d8-black");
                      }}
                    >
                      Explore model ↗
                    </button>
                  </div>
                </div>
              </article>
            </div>
          );
        })}
      </div>

      <div className="scooter-carousel-controls">
        <button type="button" className="carousel-arrow" onClick={previous} aria-label="Previous scooter">
          ←
        </button>

        <div className="carousel-dots">
          {models.map((item, index) => (
            <button
              type="button"
              key={item.id}
              onClick={() => goTo(index)}
              className={index === active ? "carousel-dot selected" : "carousel-dot"}
              aria-label={`Select ${item.name}`}
              aria-pressed={index === active}
            />
          ))}
        </div>

        <button type="button" className="carousel-arrow" onClick={next} aria-label="Next scooter">
          →
        </button>
      </div>
    </div>
  );
}

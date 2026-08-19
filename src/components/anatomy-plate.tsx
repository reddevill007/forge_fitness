"use client";

import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import {
  ANATOMY_CHAPTERS,
  ANATOMY_PLATES,
  anatomyPageLabel,
  anatomyPlateSrc,
  childrenFor,
  overviewFor,
  type AnatomyPlate as AnatomyPlateData,
} from "@/src/lib/body-anatomy";

function PlateImage({
  plate,
  className,
}: {
  plate: AnatomyPlateData;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={className}
      src={anatomyPlateSrc(plate)}
      alt={`${plate.label} anatomy notebook plate`}
    />
  );
}

export function AnatomyPlate({
  plate,
  variant = "card",
  caption,
}: {
  plate: AnatomyPlateData;
  variant?: "card" | "reader" | "compact" | "page";
  caption?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={`anatomy-plate is-${variant}`}
        onClick={() => setOpen(true)}
        aria-label={`Open ${plate.label} anatomy plate`}
      >
        {caption ? <span className="anatomy-plate-kicker">{caption}</span> : null}
        <span className="anatomy-plate-frame">
          <PlateImage plate={plate} />
        </span>
        <span className="anatomy-plate-zoom">
          <Expand size={14} />
          Full page
        </span>
      </button>
      {open ? (
        <AnatomyLightbox plate={plate} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

export function AnatomySpread({
  plate,
  onOpenPage,
}: {
  plate: AnatomyPlateData;
  onOpenPage?: (next: AnatomyPlateData) => void;
}) {
  const map = overviewFor(plate);
  const children = plate.kind === "overview" ? childrenFor(plate) : [];
  const showMap = Boolean(map && map.id !== plate.id);
  const showBreakdowns = children.length > 0;

  return (
    <div className="anatomy-spread">
      {showMap && map ? (
        <figure className="anatomy-sheet is-map">
          <figcaption>
            <em>Map</em>
            <strong>{map.label}</strong>
            <span>p.{anatomyPageLabel(map)}</span>
          </figcaption>
          <AnatomyPlate
            plate={map}
            variant="page"
            caption={`Map · ${map.label}`}
          />
        </figure>
      ) : null}

      <figure className={`anatomy-sheet ${plate.kind === "breakdown" ? "is-breakdown" : "is-map"}`}>
        <figcaption>
          <em>{plate.kind === "breakdown" ? "Breakdown" : "Map"}</em>
          <strong>{plate.label}</strong>
          <span>p.{anatomyPageLabel(plate)}</span>
        </figcaption>
        <AnatomyPlate
          plate={plate}
          variant="page"
          caption={`${plate.kind === "breakdown" ? "Breakdown" : "Map"} · ${plate.label}`}
        />
      </figure>

      {showBreakdowns ? (
        <div className="anatomy-breakdown-index">
          <div className="anatomy-breakdown-copy">
            <span className="eyebrow">Breakdown plates</span>
            <p>Separate studies for each muscle in this map.</p>
          </div>
          <div className="anatomy-breakdown-grid">
            {children.map((item) => (
              <button
                key={item.id}
                type="button"
                className="anatomy-breakdown-card"
                onClick={() => onOpenPage?.(item)}
              >
                <span className="anatomy-plate-frame is-thumb">
                  <PlateImage plate={item} />
                </span>
                <span>
                  <small>p.{anatomyPageLabel(item)} · {item.kind === "breakdown" ? "Breakdown" : "Map"}</small>
                  <strong>{item.label}</strong>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AnatomyLightbox({
  plate,
  onClose,
}: {
  plate: AnatomyPlateData;
  onClose: () => void;
}) {
  const titleId = useId();
  const [index, setIndex] = useState(() => Math.max(0, ANATOMY_PLATES.findIndex((item) => item.id === plate.id)));
  const current = ANATOMY_PLATES[index] ?? plate;
  const map = overviewFor(current);
  const showMap = Boolean(map && map.id !== current.id);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") setIndex((value) => Math.max(0, value - 1));
      if (event.key === "ArrowRight") setIndex((value) => Math.min(ANATOMY_PLATES.length - 1, value + 1));
    }
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div className="anatomy-lightbox" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={onClose}>
      <div className="anatomy-lightbox-sheet is-pdf" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span className="eyebrow">Physique notebook · p.{anatomyPageLabel(current)} / {String(ANATOMY_PLATES.length).padStart(2, "0")}</span>
            <h3 id={titleId}>{current.label}</h3>
            <p>{current.blurb}</p>
          </div>
          <div className="anatomy-pager">
            <button type="button" className="icon-button" aria-label="Previous page" disabled={index === 0} onClick={() => setIndex((value) => Math.max(0, value - 1))}>
              <ChevronLeft size={18} />
            </button>
            <button type="button" className="icon-button" aria-label="Next page" disabled={index === ANATOMY_PLATES.length - 1} onClick={() => setIndex((value) => Math.min(ANATOMY_PLATES.length - 1, value + 1))}>
              <ChevronRight size={18} />
            </button>
            <button type="button" className="icon-button" aria-label="Close notebook" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </header>
        <div className="anatomy-lightbox-scroll">
          {showMap && map ? (
            <figure className="anatomy-pdf-page is-map">
              <figcaption>Map · {map.label}</figcaption>
              <PlateImage plate={map} />
            </figure>
          ) : null}
          <figure className={`anatomy-pdf-page ${current.kind === "breakdown" ? "is-breakdown" : "is-map"}`}>
            <figcaption>{current.kind === "breakdown" ? "Breakdown" : "Map"} · {current.label}</figcaption>
            <PlateImage plate={current} />
          </figure>
        </div>
      </div>
    </div>
  );
}

export function AnatomyAtlas({
  activeId,
  onSelect,
}: {
  activeId?: string;
  onSelect?: (plate: AnatomyPlateData) => void;
}) {
  const [picked, setPicked] = useState(activeId ?? "full-body");
  const plate = useMemo(
    () => ANATOMY_PLATES.find((item) => item.id === (activeId ?? picked)) ?? ANATOMY_PLATES[0],
    [activeId, picked],
  );
  const index = ANATOMY_PLATES.findIndex((item) => item.id === plate.id);
  const total = ANATOMY_PLATES.length;

  function choose(next: AnatomyPlateData) {
    setPicked(next.id);
    onSelect?.(next);
  }

  function step(delta: number) {
    const next = ANATOMY_PLATES[index + delta];
    if (next) choose(next);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (event.key === "ArrowLeft") {
        const next = ANATOMY_PLATES[index - 1];
        if (next) setPicked(next.id);
      }
      if (event.key === "ArrowRight") {
        const next = ANATOMY_PLATES[index + 1];
        if (next) setPicked(next.id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index]);

  return (
    <div className="anatomy-doc">
      <aside className="anatomy-toc" aria-label="Notebook contents">
        <div className="anatomy-toc-head">
          <span className="eyebrow">Contents</span>
          <strong>17 plates</strong>
        </div>
        {ANATOMY_CHAPTERS.map((chapter) => (
          <div key={chapter.title} className="anatomy-toc-chapter">
            <small>{chapter.title}</small>
            {chapter.plates.map((item) => (
              <button
                key={item.id}
                type="button"
                className={item.id === plate.id ? "active" : ""}
                aria-current={item.id === plate.id ? "page" : undefined}
                onClick={() => choose(item)}
              >
                <b>{anatomyPageLabel(item)}</b>
                <span>{item.label}</span>
                <em>{item.kind === "breakdown" ? "BD" : "MAP"}</em>
              </button>
            ))}
          </div>
        ))}
      </aside>

      <div className="anatomy-doc-stage">
        <header className="anatomy-doc-bar">
          <div>
            <span className="eyebrow">{plate.chapter}</span>
            <h3>{plate.label}</h3>
            <p>{plate.blurb}</p>
          </div>
          <div className="anatomy-pager">
            <button type="button" className="outline-button" disabled={index <= 0} onClick={() => step(-1)}>
              <ChevronLeft size={16} /> Prev
            </button>
            <span className="anatomy-page-num">{anatomyPageLabel(plate)} / {String(total).padStart(2, "0")}</span>
            <button type="button" className="outline-button" disabled={index >= total - 1} onClick={() => step(1)}>
              Next <ChevronRight size={16} />
            </button>
          </div>
        </header>
        <AnatomySpread plate={plate} onOpenPage={choose} />
      </div>
    </div>
  );
}

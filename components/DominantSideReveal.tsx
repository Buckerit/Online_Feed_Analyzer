"use client";

import { useEffect, useState } from "react";

type DominantSideRevealProps = {
  dominantSide?: string;
  dominantSideDescription?: string;
};

export function DominantSideReveal({
  dominantSide,
  dominantSideDescription
}: DominantSideRevealProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!dominantSide) {
      return;
    }

    setOpen(true);
  }, [dominantSide]);

  function closeModal() {
    setOpen(false);
  }

  if (!dominantSide || !open) {
    return null;
  }

  return (
    <div
      className="dominant-side-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dominant-side-title"
    >
      <div className="dominant-side-modal">
        <span className="eyebrow">Side reveal</span>
        <h2 id="dominant-side-title">The side of Instagram that showed up most was:</h2>
        <p className="dominant-side-modal-value">{dominantSide}</p>
        {dominantSideDescription ? (
          <p className="dominant-side-modal-copy">{dominantSideDescription}</p>
        ) : null}
        <button className="button" type="button" onClick={closeModal}>
          See reflection
        </button>
      </div>
    </div>
  );
}

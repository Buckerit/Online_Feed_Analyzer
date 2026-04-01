"use client";

export function AnalysisLoadingModal({
  open,
  title = "Analyzing your session",
  description = "Reading images, notes, and recurring patterns..."
}: {
  open: boolean;
  title?: string;
  description?: string;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="analysis-overlay" role="presentation" aria-hidden={false}>
      <div
        className="analysis-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="analysis-modal-title"
        aria-describedby="analysis-modal-description"
      >
        <div className="analysis-spinner" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <h2 id="analysis-modal-title">{title}</h2>
        <p id="analysis-modal-description">{description}</p>
      </div>
    </div>
  );
}

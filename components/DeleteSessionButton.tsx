"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteSessionButton({
  sessionId,
  label = "Delete session",
  className = "button-danger"
}: {
  sessionId: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setError("");
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Could not delete the session.");
      }

      router.push("/");
      router.refresh();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Something went wrong while deleting."
      );
      setIsDeleting(false);
    }
  }

  return (
    <>
      <button className={className} type="button" onClick={() => setIsOpen(true)}>
        {label}
      </button>
      {isOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="delete-title">
            <h2 id="delete-title">Delete this reflection?</h2>
            <p className="section-copy">
              This removes the saved reflection and any screenshots stored with it.
            </p>
            {error ? <div className="error-box">{error}</div> : null}
            <div className="action-row" style={{ marginTop: 18 }}>
              <button className="button-secondary" type="button" onClick={() => setIsOpen(false)}>
                Cancel
              </button>
              <button className="button-danger" type="button" onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? "Deleting..." : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

"use client";

import { AnalysisLoadingModal } from "@/components/AnalysisLoadingModal";
import { useRouter } from "next/navigation";
import {
  ChangeEvent,
  ClipboardEvent as ReactClipboardEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

const MAX_IMAGE_COUNT = 24;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const RESIZE_THRESHOLD_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 2200;

type QueuedImage = {
  id: string;
  file: File;
  previewUrl: string;
  signature: string;
  note: string;
};

export function CreateSessionForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadZoneRef = useRef<HTMLDivElement>(null);
  const isUploadZoneHoveredRef = useRef(false);
  const queuedImagesRef = useRef<QueuedImage[]>([]);
  const [descriptions, setDescriptions] = useState("");
  const [queuedImages, setQueuedImages] = useState<QueuedImage[]>([]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [pasteHint, setPasteHint] = useState("");

  const queuedCountLabel = useMemo(() => {
    if (queuedImages.length === 1) {
      return "1 image queued";
    }

    return `${queuedImages.length} images queued`;
  }, [queuedImages.length]);

  useEffect(() => {
    queuedImagesRef.current = queuedImages;
  }, [queuedImages]);

  useEffect(() => {
    if (!isSubmitting) {
      document.body.style.overflow = "";
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isSubmitting]);

  useEffect(() => {
    return () => {
      queuedImagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    };
  }, []);

  useEffect(() => {
    function handleWindowPaste(event: globalThis.ClipboardEvent) {
      const uploadZone = uploadZoneRef.current;

      if (!isUploadZoneHoveredRef.current || !uploadZone) {
        return;
      }

      if (document.activeElement === uploadZone) {
        return;
      }

      const clipboardFiles = extractClipboardImageFiles(event.clipboardData?.items);

      if (clipboardFiles.length === 0) {
        setError("Clipboard does not contain an image.");
        return;
      }

      event.preventDefault();
      uploadZone.focus();
      void addFilesToQueue(clipboardFiles);
      setPasteHint("");
    }

    window.addEventListener("paste", handleWindowPaste);

    return () => {
      window.removeEventListener("paste", handleWindowPaste);
    };
  }, [queuedImages]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPasteHint("");
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.set("descriptions", descriptions);

      queuedImages.forEach((image) => {
        formData.append("images", image.file, image.file.name);
        formData.append("imageNotes", image.note.trim());
      });

      const response = await fetch("/api/sessions/draft", {
        method: "POST",
        body: formData
      });
      const data = (await response.json()) as { id?: string; error?: string };

      if (!response.ok || !data.id) {
        throw new Error(
          response.status === 429
            ? data.error ?? "Please wait a moment before starting another reflection."
            : data.error ?? "Could not analyze the session."
        );
      }

      router.push(`/sessions/${data.id}?justAnalyzed=true`);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Something went wrong while generating the session."
      );
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
  }

  async function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files ? Array.from(event.target.files) : [];
    await addFilesToQueue(files);
    event.target.value = "";
  }

  async function handlePaste(event: ReactClipboardEvent<HTMLDivElement>) {
    const clipboardFiles = extractClipboardImageFiles(event.clipboardData.items);

    if (clipboardFiles.length === 0) {
      setError("Clipboard does not contain an image.");
      return;
    }

    event.preventDefault();
    await addFilesToQueue(clipboardFiles);
    setPasteHint("");
  }

  async function handlePasteButton() {
    setError("");
    setPasteHint("Paste directly into the upload area with Ctrl+V.");
    uploadZoneRef.current?.focus();

    if (!navigator.clipboard?.read) {
      return;
    }

    try {
      const clipboardItems = await navigator.clipboard.read();
      const clipboardFiles: File[] = [];

      for (const item of clipboardItems) {
        const imageType = item.types.find((type) => type.startsWith("image/"));

        if (!imageType) {
          continue;
        }

        const blob = await item.getType(imageType);
        const extension = imageType.split("/")[1] ?? "png";
        clipboardFiles.push(
          new File([blob], `clipboard-${Date.now()}.${extension}`, { type: imageType })
        );
      }

      if (clipboardFiles.length > 0) {
        await addFilesToQueue(clipboardFiles);
        setPasteHint("");
      }
    } catch {
      setPasteHint(
        "Clipboard access may require permission. You can still focus the upload area and paste with Ctrl+V."
      );
    }
  }

  async function addFilesToQueue(incomingFiles: File[]) {
    setError("");

    const existingSignatures = new Set(queuedImages.map((image) => image.signature));
    const availableSlots = Math.max(0, MAX_IMAGE_COUNT - queuedImages.length);
    let hadPreparationError = false;

    if (availableSlots === 0) {
      setError(`You can queue up to ${MAX_IMAGE_COUNT} screenshots at once.`);
      return;
    }

    const nextImages: QueuedImage[] = [];
    const normalizedFiles = incomingFiles.filter((file) => file.type.startsWith("image/"));

    for (const file of normalizedFiles) {
      if (nextImages.length >= availableSlots) {
        setError(`Only the first ${MAX_IMAGE_COUNT} screenshots were kept in the queue.`);
        break;
      }

      try {
        const preparedFile = await prepareImageFile(file);
        const signature = buildFileSignature(preparedFile);

        if (
          existingSignatures.has(signature) ||
          nextImages.some((image) => image.signature === signature)
        ) {
          continue;
        }

        existingSignatures.add(signature);
        nextImages.push({
          id: signature,
          file: preparedFile,
          previewUrl: URL.createObjectURL(preparedFile),
          signature,
          note: ""
        });
      } catch (preparationError) {
        hadPreparationError = true;
        setError(
          preparationError instanceof Error
            ? preparationError.message
            : "One of the screenshots could not be prepared."
        );
      }
    }

    if (nextImages.length === 0 && normalizedFiles.length > 0 && !hadPreparationError) {
      setError("No new screenshots were added. Duplicate images are skipped automatically.");
    }

    if (nextImages.length > 0) {
      setQueuedImages((current) => [...current, ...nextImages]);
    }
  }

  function removeQueuedImage(id: string) {
    setQueuedImages((current) => {
      const match = current.find((image) => image.id === id);

      if (match) {
        URL.revokeObjectURL(match.previewUrl);
      }

      return current.filter((image) => image.id !== id);
    });
  }

  function clearQueuedImages() {
    setQueuedImages((current) => {
      current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      return [];
    });
    setError("");
    setPasteHint("");
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <div className="field">
        <div className="upload-heading">
          <label>Add screenshots</label>
        </div>

        <input
          ref={fileInputRef}
          className="sr-only-input"
          id="images"
          name="images"
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelection}
          tabIndex={-1}
        />

        <div
          ref={uploadZoneRef}
          className={isDragging ? "upload-zone upload-zone-active" : "upload-zone"}
          role="group"
          aria-label="Screenshot upload area"
          tabIndex={0}
          onMouseEnter={() => {
            isUploadZoneHoveredRef.current = true;
          }}
          onMouseLeave={() => {
            isUploadZoneHoveredRef.current = false;
          }}
          onPaste={handlePaste}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setIsDragging(false);
          }}
          onDrop={async (event) => {
            event.preventDefault();
            setIsDragging(false);
            await addFilesToQueue(Array.from(event.dataTransfer.files));
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
            }
          }}
        >
          {queuedImages.length > 0 ? (
            <div className="upload-zone-gallery" aria-live="polite">
              {queuedImages.map((image) => (
                <article className="upload-zone-thumb" key={image.id}>
                  <div className="upload-zone-thumb-frame">
                    <img src={image.previewUrl} alt={image.file.name} />
                  </div>
                  <button
                    className="upload-zone-thumb-remove"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      removeQueuedImage(image.id);
                    }}
                    aria-label={`Remove ${image.file.name}`}
                  >
                    Remove
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <>
              <div className="upload-zone-icon" aria-hidden="true" />
              <div className="upload-zone-copy">
                <p className="upload-zone-title">Paste screenshots here</p>
                <p className="upload-zone-text">or drag in images (Ctrl+V works too)</p>
                <p className="upload-zone-meta">PNG, JPG, WEBP · up to 24 images</p>
              </div>
            </>
          )}
        </div>

        <div className="upload-action-bar">
          <button
            className="button-tertiary upload-bar-button"
            type="button"
            onClick={() => fileInputRef.current?.click()}
          >
            Upload
          </button>
          <button className="button upload-bar-button" type="button" onClick={handlePasteButton}>
            Paste
          </button>
        </div>

        <div className="upload-actions upload-utility-actions">
          {queuedImages.length > 0 ? (
            <button
              className="button-tertiary upload-action-muted upload-clear-button"
              type="button"
              onClick={clearQueuedImages}
            >
              Clear all
            </button>
          ) : null}
        </div>

        {pasteHint ? <p className="helper">{pasteHint}</p> : null}

        <div className="upload-footer">
          {queuedImages.length > 0 ? <p className="helper upload-count">{queuedCountLabel}</p> : null}
          <button
            className="button upload-submit-button"
            type="submit"
            disabled={isSubmitting || (queuedImages.length === 0 && descriptions.trim().length === 0)}
          >
            {isSubmitting ? "Analyzing session..." : "Analyze session"}
          </button>
        </div>
      </div>

      <div className="field">
        <div className="notes-heading">
          <label htmlFor="descriptions">Additional posts or reels</label>
        </div>
        <textarea
          id="descriptions"
          name="descriptions"
          value={descriptions}
          onChange={(event) => setDescriptions(event.target.value)}
          placeholder={[
            "One note per line",
            "surreal cat meme",
            "headline about layoffs",
            "AI thread and a routine reel"
          ].join("\n")}
        />
      </div>

      {error ? <div className="error-box">{error}</div> : null}
      <AnalysisLoadingModal open={isSubmitting} />
    </form>
  );
}

function buildFileSignature(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}-${file.type}`;
}

function extractClipboardImageFiles(items?: DataTransferItemList | null) {
  if (!items) {
    return [];
  }

  return Array.from(items)
    .filter((item) => item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file));
}

async function prepareImageFile(file: File) {
  if (file.size <= RESIZE_THRESHOLD_BYTES && file.size <= MAX_IMAGE_BYTES) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      bitmap.close();
      return validateImageSize(file);
    }

    canvas.width = width;
    canvas.height = height;
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, outputType, 0.88);
    });

    if (!blob) {
      return validateImageSize(file);
    }

    const extension = outputType === "image/png" ? "png" : "jpg";
    const normalized = new File([blob], replaceExtension(file.name, extension), {
      type: outputType,
      lastModified: file.lastModified
    });

    return validateImageSize(normalized);
  } catch {
    return validateImageSize(file);
  }
}

function validateImageSize(file: File) {
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(
      `${file.name} is too large. Keep each screenshot under ${formatBytes(MAX_IMAGE_BYTES)}.`
    );
  }

  return file;
}

function replaceExtension(fileName: string, extension: string) {
  return fileName.replace(/\.[^.]+$/, "") + `.${extension}`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

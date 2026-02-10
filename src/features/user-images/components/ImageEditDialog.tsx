/**
 * Image Edit Dialog
 *
 * Full-screen overlay for editing image title and description.
 * Two-column layout: image + inputs on left, tabbed palette on right.
 */

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ColorPaletteDisplay } from "./ColorPaletteDisplay";
import type { UserImage, ColorPalette } from "../types";

interface ImageEditDialogProps {
  image: UserImage | null;
  imageUrl: string;
  open: boolean;
  onClose: () => void;
  onSave: (id: string, title: string, description: string | null) => Promise<void>;
  onNext: () => void;
  userId: string;
}

/**
 * Full-screen image editor with keyboard shortcuts
 */
export function ImageEditDialog({
  image,
  imageUrl,
  open,
  onClose,
  onSave,
  onNext,
  userId,
}: ImageEditDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [localPalette, setLocalPalette] = useState<ColorPalette | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (image) {
      setTitle(image.title);
      setDescription(image.description ?? "");
      setLocalPalette(image.color_palette as ColorPalette | null);
    }
  }, [image]);

  useEffect(() => {
    if (open && titleInputRef.current) {
      setTimeout(() => {
        titleInputRef.current?.select();
        titleInputRef.current?.focus();
      }, 100);
    }
  }, [open, image?.id]);

  // Handle escape key at overlay level
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Prevent body scroll when overlay is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const save = async () => {
    if (!image) return;

    setIsSaving(true);
    try {
      await onSave(image.id, title, description || null);
    } finally {
      setIsSaving(false);
    }
  };

  const saveAndClose = async () => {
    await save();
    onClose();
  };

  const saveAndNext = async () => {
    await save();
    onNext();
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveAndClose();
    } else if (e.key === "Tab") {
      e.preventDefault();
      saveAndNext();
    }
  };

  const handleDescriptionKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      saveAndNext();
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      saveAndClose();
    }
  };

  if (!open || !image) return null;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 lg:p-[90px]"
    >
      {/* Modal container - min 800px, always side-by-side */}
      <div className="relative w-full h-full min-w-[800px] bg-background rounded-lg border border-border shadow-2xl overflow-hidden">
        {/* Two-column layout - always side-by-side */}
        <div className="h-full grid grid-cols-2 gap-0">
        {/* Left column: Image + Title + Description */}
        <div className="flex flex-col p-6 overflow-y-auto">
          {/* Image */}
          <div className="flex-1 min-h-0 flex items-center justify-center mb-6">
            <img
              src={imageUrl}
              alt={title}
              className="max-h-full max-w-full object-contain rounded-lg"
            />
          </div>

          {/* Title Input */}
          <div className="space-y-2 mb-4">
            <label
              htmlFor="title"
              className="text-sm font-medium text-foreground"
            >
              Title
            </label>
            <Input
              ref={titleInputRef}
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleTitleKeyDown}
              placeholder="Image title"
              maxLength={200}
              disabled={isSaving}
              className="bg-background"
            />
          </div>

          {/* Description Textarea */}
          <div className="space-y-2">
            <label
              htmlFor="description"
              className="text-sm font-medium text-foreground"
            >
              Description (optional)
            </label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={handleDescriptionKeyDown}
              placeholder="Image description"
              maxLength={1000}
              rows={3}
              disabled={isSaving}
              className="bg-background"
            />
          </div>
        </div>

        {/* Right column: Tabbed palette */}
        <div className="border-l border-border bg-card flex flex-col min-h-0 overflow-hidden">
          <ColorPaletteDisplay
            palette={localPalette}
            imageId={image.id}
            imageUrl={imageUrl}
            userId={userId}
            onPaletteGenerated={setLocalPalette}
            onClose={onClose}
          />
        </div>
      </div>
      </div>
    </div>
  );
}

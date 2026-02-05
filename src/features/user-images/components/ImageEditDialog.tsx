/**
 * Image Edit Dialog
 *
 * Dialog for editing image title and description.
 */

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { UserImage } from "../types";

interface ImageEditDialogProps {
  image: UserImage | null;
  imageUrl: string;
  open: boolean;
  onClose: () => void;
  onSave: (id: string, title: string, description: string | null) => Promise<void>;
  onNext: () => void;
}

/**
 * Image edit dialog with keyboard shortcuts
 */
export function ImageEditDialog({
  image,
  imageUrl,
  open,
  onClose,
  onSave,
  onNext,
}: ImageEditDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (image) {
      setTitle(image.title);
      setDescription(image.description ?? "");
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
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Tab") {
      e.preventDefault();
      saveAndNext();
    }
  };

  const handleDescriptionKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      saveAndNext();
    }
  };

  const handleOpenChange = async (newOpen: boolean) => {
    if (!newOpen) {
      await saveAndClose();
    }
  };

  if (!image) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Edit Image</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Image Preview */}
          <div className="aspect-video overflow-hidden rounded-lg bg-sidebar-hover">
            <img
              src={imageUrl}
              alt={title}
              className="h-full w-full object-contain"
            />
          </div>

          {/* Title Input */}
          <div className="space-y-2">
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
      </DialogContent>
    </Dialog>
  );
}

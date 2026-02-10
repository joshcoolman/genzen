/**
 * Color Swatch
 *
 * Renders a color square that copies hex to clipboard on click.
 */

import { useState } from "react";
import { Check, Copy } from "lucide-react";

interface ColorSwatchProps {
  hex: string;
  size?: "sm" | "md" | "lg" | "xl" | "fixed" | "fill";
  label?: string;
}

const sizeClasses = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-10 w-10",
  xl: "h-16 w-16",
  fixed: "h-[100px] w-[100px]", // Fixed size for palette grids
  fill: "w-full aspect-square",
};

export function ColorSwatch({ hex, size = "md", label }: ColorSwatchProps) {
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(hex);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Determine if label text should be light or dark based on background
  const getLabelColor = (hexColor: string) => {
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    // Luminance formula
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? "text-black/60" : "text-white/60";
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`
        ${sizeClasses[size]}
        relative
        cursor-pointer transition-transform hover:scale-105
        focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1
        group
      `}
      style={{ backgroundColor: hex }}
      title={`${hex} - Click to copy`}
    >
      <span className="sr-only">Copy {hex}</span>
      {label && (
        <span className={`absolute top-1 left-1 text-[10px] font-medium ${getLabelColor(hex)}`}>
          {label}
        </span>
      )}
      <span
        className={`
          absolute inset-0 flex items-center justify-center
          bg-black/50 opacity-0 group-hover:opacity-100
          transition-opacity
        `}
      >
        {copied ? (
          <Check className="h-3 w-3 text-white" />
        ) : (
          <Copy className="h-3 w-3 text-white" />
        )}
      </span>
    </button>
  );
}

/**
 * Color Adjust Popover
 *
 * Popover with HSL sliders for full color control.
 * Positioned to left or right of column to keep column visible.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Pipette } from "lucide-react";
import { HueSlider } from "./HueSlider";

interface HueShiftPopoverProps {
  currentHue: number;
  currentSaturation: number;
  currentLightness: number;
  columnIndex: number; // 0-5, used for positioning
  disabled?: boolean;
  onColorChange: (hue: number, saturation: number, lightness: number) => void;
  onClose?: () => void;
}

const POPOVER_WIDTH = 208; // w-52 = 13rem = 208px
const POPOVER_GAP = 12;

export function HueShiftPopover({
  currentHue,
  currentSaturation,
  currentLightness,
  columnIndex,
  disabled,
  onColorChange,
  onClose,
}: HueShiftPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localHue, setLocalHue] = useState(currentHue);
  const [localSaturation, setLocalSaturation] = useState(currentSaturation);
  const [localLightness, setLocalLightness] = useState(currentLightness);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Columns 0-2: popover to the right; Columns 3-5: popover to the left
  const positionRight = columnIndex < 3;

  // Sync local values when props change externally
  useEffect(() => {
    setLocalHue(currentHue);
  }, [currentHue]);

  useEffect(() => {
    setLocalSaturation(currentSaturation);
  }, [currentSaturation]);

  useEffect(() => {
    setLocalLightness(currentLightness);
  }, [currentLightness]);

  // Calculate and update position
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    // Find the parent column element
    const columnEl = triggerRef.current.closest('[data-column]');
    const columnRect = columnEl?.getBoundingClientRect() ?? triggerRect;

    let left: number;
    if (positionRight) {
      // Position to the right of the column
      left = columnRect.right + POPOVER_GAP;
    } else {
      // Position to the left of the column
      left = columnRect.left - POPOVER_WIDTH - POPOVER_GAP;
    }

    // Clamp to viewport
    const viewportWidth = window.innerWidth;
    if (left + POPOVER_WIDTH > viewportWidth - 16) {
      left = viewportWidth - POPOVER_WIDTH - 16;
    }
    if (left < 16) {
      left = 16;
    }

    // Vertically align with top of column
    let top = columnRect.top;
    // Clamp to viewport
    if (top < 16) top = 16;

    setPosition({ top, left });
  }, [positionRight]);

  // Update position when opening and on scroll/resize
  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, updatePosition]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current && !popoverRef.current.contains(target) &&
        triggerRef.current && !triggerRef.current.contains(target)
      ) {
        setIsOpen(false);
        onClose?.();
      }
    };

    // Use setTimeout to avoid immediate close from the click that opened it
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Debounced color change for DB update
  const triggerUpdate = useCallback((hue: number, saturation: number, lightness: number) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      onColorChange(hue, saturation, lightness);
    }, 150);
  }, [onColorChange]);

  const handleHueChange = useCallback((newHue: number) => {
    setLocalHue(newHue);
    triggerUpdate(newHue, localSaturation, localLightness);
  }, [triggerUpdate, localSaturation, localLightness]);

  const handleSaturationChange = useCallback((newSat: number) => {
    setLocalSaturation(newSat);
    triggerUpdate(localHue, newSat, localLightness);
  }, [triggerUpdate, localHue, localLightness]);

  const handleLightnessChange = useCallback((newLight: number) => {
    setLocalLightness(newLight);
    triggerUpdate(localHue, localSaturation, newLight);
  }, [triggerUpdate, localHue, localSaturation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!disabled) {
      if (!isOpen) {
        // Calculate position before opening
        updatePosition();
      }
      setIsOpen(!isOpen);
    }
  };

  return (
    <>
      {/* Trigger button */}
      <button
        ref={triggerRef}
        onClick={handleToggle}
        disabled={disabled}
        className={`p-0.5 rounded transition-colors ${
          disabled
            ? "opacity-30 cursor-not-allowed"
            : "hover:bg-white/20 cursor-pointer"
        }`}
        title={disabled ? "Unlock to adjust color" : "Adjust color"}
      >
        <Pipette className="h-3 w-3 text-white/70" />
      </button>

      {/* Popover content - rendered via portal to document.body */}
      {isOpen && createPortal(
        <div
          ref={popoverRef}
          className="fixed w-52 p-3 bg-popover border border-border rounded-md shadow-xl"
          style={{
            zIndex: 99999,
            top: position.top,
            left: position.left,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Hue slider */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">Hue</span>
              <span className="text-xs text-muted-foreground">{Math.round(localHue)}°</span>
            </div>
            <HueSlider currentHue={localHue} onChange={handleHueChange} />
          </div>

          {/* Saturation slider */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">Saturation</span>
              <span className="text-xs text-muted-foreground">{Math.round(localSaturation)}%</span>
            </div>
            <GradientSlider
              value={localSaturation}
              max={100}
              hue={localHue}
              type="saturation"
              lightness={localLightness}
              onChange={handleSaturationChange}
            />
          </div>

          {/* Lightness slider */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">Lightness</span>
              <span className="text-xs text-muted-foreground">{Math.round(localLightness)}%</span>
            </div>
            <GradientSlider
              value={localLightness}
              max={100}
              hue={localHue}
              type="lightness"
              saturation={localSaturation}
              onChange={handleLightnessChange}
            />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// Generic gradient slider for saturation/lightness
interface GradientSliderProps {
  value: number;
  max: number;
  hue: number;
  type: "saturation" | "lightness";
  saturation?: number;
  lightness?: number;
  onChange: (value: number) => void;
}

function GradientSlider({ value, max, hue, type, saturation = 100, lightness = 50, onChange }: GradientSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const getValueFromPosition = useCallback((clientX: number) => {
    if (!trackRef.current) return value;
    const rect = trackRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    return (x / rect.width) * max;
  }, [value, max]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    onChange(getValueFromPosition(e.clientX));
  }, [getValueFromPosition, onChange]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    onChange(getValueFromPosition(e.clientX));
  }, [isDragging, getValueFromPosition, onChange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const thumbPosition = (value / max) * 100;

  // Build gradient based on type
  const gradient = type === "saturation"
    ? `linear-gradient(to right, hsl(${hue}, 0%, ${lightness}%), hsl(${hue}, 100%, ${lightness}%))`
    : `linear-gradient(to right, hsl(${hue}, ${saturation}%, 0%), hsl(${hue}, ${saturation}%, 50%), hsl(${hue}, ${saturation}%, 100%))`;

  return (
    <div className="w-full py-2">
      <div
        ref={trackRef}
        onMouseDown={handleMouseDown}
        className="relative h-4 rounded-sm cursor-pointer"
        style={{ background: gradient }}
      >
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-6 bg-white rounded-sm border-2 border-gray-800 shadow-md pointer-events-none"
          style={{ left: `${thumbPosition}%` }}
        />
      </div>
    </div>
  );
}

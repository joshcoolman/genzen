## Overview

A secondary navigation area that hosts experimental and utility features. Collapses the main dashboard sidebar on entry, provides its own left nav with links to sub-features.

## How It Works

1. Layout collapses dashboard sidebar on entry, restores on exit
2. Base route redirects to outpaint (no standalone page)
3. Most sub-routes delegate to their own feature module in `src/features/`

## Usage

- Navigate to Dev Workspace from the sidebar
- Use the secondary left nav to switch between sub-features

## Key Files

- `src/features/dev-workspace/components/DevWorkspacePage.tsx` -- Component testing sandbox (ModelSelector, ImageSourceButtons, AspectRatioSelect)
- `src/routes/dashboard/dev-workspace.tsx` -- Layout with secondary left nav, sidebar collapse/restore
- `src/routes/dashboard/dev-workspace.index.tsx` -- Redirects to outpaint

### Sub-Routes

All nested under `/dashboard/dev-workspace/`:

| Route            | Feature                                                  |
| ---------------- | -------------------------------------------------------- |
| `outpaint`       | Image outpainting (`@/features/outpaint`)                |
| `prompt-studio`  | Multi-LLM prompt comparison (`@/features/prompt-studio`) |
| `models`         | FAL model catalog (`@/features/models`)                  |
| `model-selector` | Component testing (uses DevWorkspacePage)                |
| `multi-model`    | Multi-model comparison grid (`@/features/multi-model`)   |

## Dependencies

- `@/features/outpaint`, `@/features/prompt-studio`, `@/features/models`, `@/features/multi-model`

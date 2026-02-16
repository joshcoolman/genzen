/**
 * Keyword banks for AI prompt generation
 * Based on ai-prompt-generator-spec.md
 */

import type { Medium, AspectRatioEntry } from './prompt-types'

// ============================================================================
// SUBJECT SYSTEM (Adjective-Subject Multiplier)
// ============================================================================

export const SUBJECT_MODIFIERS = [
  'Ethereal',
  'Mechanical',
  'Crystalline',
  'Weathered',
  'Luminous',
  'Overgrown',
  'Rusted',
  'Floating',
  'Mirrored',
  'Ancient',
  'Futuristic',
  'Organic',
  'Geometric',
  'Translucent',
  'Molten',
  'Frozen',
  'Spiral',
  'Fractured',
  'Celestial',
  'Submerged',
] as const

export const SUBJECT_NOUNS = [
  'cathedral',
  'lighthouse',
  'marketplace',
  'observatory',
  'greenhouse',
  'library',
  'temple',
  'workshop',
  'garden',
  'fortress',
  'archive',
  'shipyard',
  'clocktower',
  'bridge',
  'pavilion',
  'courtyard',
  'conservatory',
  'station',
  'plaza',
  'monument',
] as const

export const SUBJECTS_PEOPLE = [
  'A nomadic merchant carrying lanterns',
  'A blind cartographer mapping by touch',
  'A child made of starlight',
  'An elderly clockmaker with gear-tattoos',
  'A knight in armor of ice',
  'A dancer mid-leap, frozen in time',
  'A scholar reading from a floating book',
  'A pilot wearing moth-wing goggles',
  'A gardener tending glowing plants',
  'A musician playing an instrument of light',
  'A warrior with a blade of water',
  'A healer channeling golden energy',
  'A thief dissolving into shadows',
  'An oracle with eyes like galaxies',
  'A chef conjuring flavors from thin air',
] as const

export const SUBJECTS_PLACES = [
  'An overgrown lighthouse on a floating island',
  'A library where books fly like birds',
  'A marketplace suspended in the clouds',
  'A cathedral made entirely of ice',
  'A greenhouse containing impossible flowers',
  'A clocktower that runs backwards',
  'A bridge connecting two moons',
  'A temple carved from a single crystal',
  'A workshop where stars are forged',
  'A garden where seasons change by the hour',
  'An observatory viewing parallel universes',
  'A station between dimensions',
  'A courtyard where gravity reverses',
  'A conservatory of extinct species',
  'A plaza paved with liquid gold',
] as const

export const SUBJECTS_CREATURES = [
  'A glass frog containing a miniature forest',
  'A mechanical owl with telescope eyes',
  'A dragon made of origami paper',
  'A whale swimming through clouds',
  'A phoenix mid-rebirth',
  'A deer with antlers of coral',
  'A serpent of flowing water',
  'A butterfly with wings of stained glass',
  'A wolf made of smoke and embers',
  'A hawk carrying a lantern',
  'A tortoise with a city on its shell',
  'A jellyfish trailing constellations',
  'A lion with a mane of fire',
  'A cat phasing between dimensions',
  'A bear carved from living wood',
] as const

// ============================================================================
// ACTIONS / STATES
// ============================================================================

export const ACTIONS = [
  'dissolving into particles',
  'reading by candlelight',
  'emerging from fog',
  'casting long shadows',
  'frozen mid-transformation',
  'reflecting in still water',
  'illuminated from within',
  'suspended in zero gravity',
  'shattering into fragments',
  'blooming with bioluminescence',
  'trailing wisps of smoke',
  'surrounded by floating debris',
  'phasing between states',
  'catching golden hour light',
  'wreathed in morning mist',
  'silhouetted against the horizon',
  'dripping with liquid light',
  'crackling with energy',
  'weathering a cosmic storm',
  'resting in perfect stillness',
  'ascending toward the sky',
  'descending into darkness',
  'bathed in ethereal glow',
  'fragmenting into echoes',
] as const

// ============================================================================
// MEDIUMS (with type classification)
// ============================================================================

export const MEDIUMS: readonly Medium[] = [
  // Photography
  { text: '35mm street photography', type: 'photography' },
  { text: 'Medium format film photography', type: 'photography' },
  { text: 'Large format view camera', type: 'photography' },
  { text: 'Instant film photography', type: 'photography' },
  { text: 'Tintype photograph', type: 'photography' },
  { text: 'Infrared film photography', type: 'photography' },
  { text: 'Double exposure photography', type: 'photography' },
  { text: 'Long exposure photography', type: 'photography' },
  { text: 'Tilt-shift photography', type: 'photography' },
  { text: 'Documentary photography', type: 'photography' },

  // Art - Traditional
  { text: 'Oil painting on canvas', type: 'art' },
  { text: 'Watercolor on textured paper', type: 'art' },
  { text: 'Acrylic painting', type: 'art' },
  { text: 'Gouache illustration', type: 'art' },
  { text: 'Ink wash painting', type: 'art' },
  { text: 'Charcoal drawing', type: 'art' },
  { text: 'Graphite pencil sketch', type: 'art' },
  { text: 'Pastel drawing', type: 'art' },
  { text: 'Mixed media collage', type: 'art' },
  { text: 'Woodcut print', type: 'art' },
  { text: 'Linocut print', type: 'art' },
  { text: 'Etching', type: 'art' },
  { text: 'Lithograph', type: 'art' },

  // Art - Stylized
  { text: 'Art Nouveau poster', type: 'art' },
  { text: 'Art Deco illustration', type: 'art' },
  { text: 'Ukiyo-e woodblock print', type: 'art' },
  { text: 'Medieval illuminated manuscript', type: 'art' },
  { text: 'Renaissance fresco', type: 'art' },
  { text: 'Baroque oil painting', type: 'art' },
  { text: 'Impressionist painting', type: 'art' },
  { text: 'Cubist painting', type: 'art' },
  { text: 'Surrealist painting', type: 'art' },
  { text: 'Abstract expressionist painting', type: 'art' },

  // 3D Render
  { text: 'Unreal Engine 5 cinematic render', type: '3d' },
  { text: 'Octane Render', type: '3d' },
  { text: 'Blender Cycles render', type: '3d' },
  { text: 'Cinema 4D render', type: '3d' },
  { text: 'V-Ray architectural visualization', type: '3d' },
  { text: 'Substance 3D render', type: '3d' },
  { text: 'Houdini procedural render', type: '3d' },
  { text: 'Redshift render', type: '3d' },
  { text: 'Arnold render', type: '3d' },
  { text: 'KeyShot product render', type: '3d' },
] as const

// ============================================================================
// ATMOSPHERE
// ============================================================================

export const ATMOSPHERES = [
  // Natural Light
  'Golden hour warmth',
  'Blue hour twilight',
  'Harsh midday sun',
  'Overcast soft light',
  'Dappled forest light',
  'Backlit translucency',
  'Rim-lit silhouette',
  'Window light streaming',
  'Firelight flicker',
  'Candlelit intimacy',

  // Studio Light
  'Three-point studio lighting',
  'High-key bright lighting',
  'Low-key dramatic lighting',
  'Rembrandt lighting',
  'Split lighting',
  'Butterfly lighting',
  'Rim lighting',
  'Motivated practical lighting',

  // Atmospheric / Stylized
  'Volumetric god rays',
  'Fog-diffused atmosphere',
  'Neon-lit cityscape glow',
  'Bioluminescent radiance',
  'Lens flare bloom',
  'Chromatic aberration edges',
  'Film grain texture',
  'Hazy dream-like softness',
  'Stark high-contrast shadows',
  'Color-graded cinematic look',
  'Desaturated muted tones',
  'Hyper-saturated vibrance',
  'Monochromatic mood',
  'Split-toned color grading',
] as const

// ============================================================================
// TECHNICAL DETAILS (Photography)
// ============================================================================

export const CAMERA_LENSES = [
  '85mm f/1.8 portrait lens',
  '50mm f/1.4 prime',
  '35mm f/2 wide angle',
  '24mm f/1.4 ultra-wide',
  '135mm f/2 telephoto',
  '200mm f/2.8 telephoto',
  '70-200mm f/2.8 zoom',
  '24-70mm f/2.8 standard zoom',
  '14mm f/2.8 ultra-wide',
  '100mm f/2.8 macro',
  '400mm f/5.6 super-telephoto',
  '16mm f/1.4 wide angle',
  '105mm f/1.4 portrait',
] as const

export const CAMERA_FRAMING = [
  'Extreme Close-Up (ECU)',
  'Close-Up (CU)',
  'Medium Close-Up (MCU)',
  'Medium Shot (MS)',
  'Medium Wide Shot (MWS)',
  'Wide Shot (WS)',
  'Extreme Wide Shot (EWS)',
  "Bird's-Eye View",
  "Worm's-Eye View",
  'Dutch Angle',
  'Over-the-Shoulder',
  'Point-of-View (POV)',
  'Two-Shot',
  'Rule of Thirds composition',
  'Centered composition',
  'Golden ratio composition',
  'Leading lines composition',
  'Framing within a frame',
  'Negative space composition',
  'Symmetrical composition',
] as const

export const FILM_STOCKS = [
  'Kodak Portra 400',
  'Kodak Ektar 100',
  'Kodak Tri-X 400',
  'Fujifilm Velvia 50',
  'Fujifilm Pro 400H',
  'Ilford HP5 Plus',
  'Cinestill 800T',
  'Kodak Gold 200',
  'Ilford Delta 3200',
  'Kodak Ektachrome E100',
] as const

// ============================================================================
// TECHNICAL DETAILS (Art)
// ============================================================================

export const ART_TECHNIQUES = [
  'Thick impasto texture',
  'Glazing layers',
  'Dry brush technique',
  'Wet-on-wet blending',
  'Stippling dots',
  'Cross-hatching',
  'Sgraffito scratching',
  'Scumbling texture',
  'Gold leaf accents',
  'Chiaroscuro lighting',
  'Tenebrism drama',
  'Atmospheric perspective',
  'Loose gestural strokes',
  'Tight hyperrealistic detail',
  'Visible canvas texture',
  'Craquelure aging',
  'Pentimento underlayers',
  'Vignette darkening',
  'Halftone dots',
  'Screen print texture',
] as const

// ============================================================================
// TECHNICAL DETAILS (3D Render)
// ============================================================================

export const RENDER_ENGINES = [
  'Path-traced global illumination',
  'Ray-traced reflections',
  'Subsurface scattering',
  'Volumetric fog',
  'Caustics lighting',
  'HDRI environment lighting',
  'Depth of field blur',
  'Motion blur',
  'Ambient occlusion',
  'Physical-based rendering (PBR)',
  '8K resolution',
  'Photorealistic materials',
  'Procedural textures',
  'Displacement mapping',
  'Normal map detail',
] as const

// ============================================================================
// SURPRISE MECHANISMS
// ============================================================================

export const WILDCARDS = [
  'Liminal space',
  'Tilt-shift miniaturization',
  'Chiaroscuro drama',
  'Trompe-l\'oeil illusion',
  'Anamorphic lens flare',
  'Bokeh light orbs',
  'Chromatic aberration',
  'Film grain texture',
  'Vignette darkening',
  'Cross-processing color shift',
  'Solarization effect',
  'Double exposure overlay',
  'Lens distortion',
  'Halation glow',
  'Light leak streaks',
  'Infrared false color',
  'Kaleidoscope symmetry',
  'Mosaic fragmentation',
  'Glitch art corruption',
  'Datamosh artifacts',
] as const

// ============================================================================
// ASPECT RATIOS (Weighted Distribution)
// ============================================================================

export const ASPECT_RATIOS: readonly AspectRatioEntry[] = [
  // Landscape (preferred)
  { value: '16:9', weight: 25, use: 'cinematic standard' },
  { value: '3:2', weight: 20, use: 'classic photography' },
  { value: '4:3', weight: 10, use: 'traditional' },
  { value: '21:9', weight: 8, use: 'ultra-wide cinematic' },
  { value: '2.39:1', weight: 5, use: 'anamorphic cinema' },

  // Portrait
  { value: '2:3', weight: 15, use: 'portrait photography' },
  { value: '9:16', weight: 10, use: 'vertical video' },
  { value: '4:5', weight: 5, use: 'social media portrait' },

  // Square
  { value: '1:1', weight: 7, use: 'square format' },

  // Unusual
  { value: '5:4', weight: 3, use: 'large format' },
  { value: '65:24', weight: 2, use: 'ultra-panoramic' },
] as const

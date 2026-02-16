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

// Photography-focused subjects (diverse ages, genders, ethnicities)
export const SUBJECTS_PEOPLE = [
  // Children (diverse)
  'Two Chinese children playing in a field',
  'A young Black girl with a telescope',
  'A boy building a sandcastle',
  'A toddler covered in paint',
  'A group of kids from different backgrounds laughing',

  // Teenagers
  'A teenage skateboarder mid-trick',
  'A young woman with headphones dancing',
  'A Latino student reading in a library',
  'A surfer carrying a board',
  'A hot young cheerleader cheering on the team',

  // Young adults (20s)
  'A young Asian woman in a coffee shop',
  'A handsome young Black man in a suit',
  'A beautiful Indian woman in traditional dress',
  'A sexy young male executive preening in front of a mirror',
  'A Korean woman shopping with her Polish boyfriend at the market',
  'A Middle Eastern chef plating a dish',
  'A tattooed woman bartender mixing a cocktail',
  'A fit young man rock climbing',
  'An attractive woman photographer with vintage camera',

  // 30s-40s
  'A man in his 30s working at a laptop',
  'A confident businesswoman presenting',
  'An African-American pilot in the cockpit',
  'A handsome bearded man reading',
  'A beautiful woman scientist in a lab coat',
  'A Latino mechanic under a car hood',

  // Couples & Groups
  'An older couple from Asia walking hand-in-hand',
  'A mixed-race couple laughing together',
  'Two friends from different backgrounds',
  'A diverse group of young professionals',

  // Older adults
  'An elderly Black woman gardening',
  'A distinguished older gentleman with glasses',
  'A silver-haired Asian man painting',
  'A weathered fisherman mending nets',

  // Diverse professions
  'A hijab-wearing doctor examining charts',
  'A drag performer applying makeup',
  'A Indigenous artist creating traditional art',
  'A plus-size model posing confidently',
  'A disabled athlete competing',
] as const

export const SUBJECTS_PLACES = [
  // Urban
  'A neon-lit Tokyo street',
  'A busy New York crosswalk',
  'A Parisian cafe terrace',
  'A London Underground platform',
  'A rooftop garden in Singapore',
  'A Venice canal at dawn',

  // Nature
  'A misty forest path',
  'A desert sand dune',
  'A frozen waterfall',
  'A coral reef',
  'A mountain peak at sunrise',
  'A lavender field in Provence',

  // Interiors
  'A dimly lit jazz club',
  'A vintage record store',
  'A modern art gallery',
  'A cozy bookshop',
  'A neon arcade',
  'A industrial loft',

  // Fantasy/Surreal
  'A floating island',
  'A glass pyramid in the desert',
  'A abandoned amusement park',
  'A underwater cave',
  'A cyberpunk alleyway',
] as const

export const SUBJECTS_ANIMALS = [
  // Domestic/Pets
  'A cat sitting in a window',
  'A dog catching a frisbee',
  'A parrot on a perch',
  'A goldfish in a bowl',

  // Wildlife
  'A wolf in the snow',
  'A lion yawning',
  'A elephant at a watering hole',
  'A eagle in flight',
  'A deer in morning mist',
  'A fox in autumn leaves',
  'A bear catching salmon',
  'A owl perched on a branch',

  // Marine life
  'A jellyfish floating in darkness',
  'A sea turtle swimming',
  'A whale breaching',
  'A octopus camouflaging',
  'A school of fish',

  // Insects/Small
  'A butterfly on a flower',
  'A bee collecting pollen',
  'A dragonfly hovering',
  'A ladybug on a leaf',

  // Fantasy/Unusual
  'A glass frog on a lily pad',
  'A bioluminescent jellyfish',
  'A mechanical bird',
  'A crystal beetle',
] as const

// ============================================================================
// OBJECTS / STILL LIFE
// ============================================================================

export const SUBJECTS_OBJECTS = [
  // Food & Drink
  'A steaming cup of coffee',
  'A fresh croissant on a plate',
  'A wine bottle and glass',
  'A bowl of ramen',
  'A stack of pancakes',
  'A espresso machine brewing',

  // Technology
  'A vintage typewriter',
  'A vinyl record spinning',
  'A analog camera',
  'A guitar leaning against a wall',
  'A pair of headphones',
  'A mechanical watch',

  // Vehicles
  'A vintage motorcycle',
  'A classic car in a garage',
  'A bicycle against a wall',
  'A skateboard on concrete',

  // Abstract/Artistic
  'Light refracting through a prism',
  'Smoke patterns in darkness',
  'Water droplets on glass',
  'Ink dispersing in water',
  'Shattered mirror fragments',
  'Neon signs reflecting in puddles',
] as const

// ============================================================================
// ACTIONS / STATES (Photography-focused)
// ============================================================================

export const ACTIONS = [
  'mid-jump',
  'in motion',
  'at rest',
  'in flight',
  'emerging from shadow',
  'catching light',
  'reflected in water',
  'silhouetted against sky',
  'in sharp focus',
  'motion-blurred',
  'frozen in time',
  'dissolving into mist',
  'backlit',
  'at golden hour',
  'in harsh sunlight',
  'under neon lights',
  'in candlelight',
  'during blue hour',
  'at dawn',
  'at dusk',
  'in the rain',
  'through a window',
  'in soft focus',
  'perfectly still',
] as const

// ============================================================================
// ENVIRONMENTS / SETTINGS
// ============================================================================

export const ENVIRONMENTS = [
  // Time of day
  'at sunrise',
  'at sunset',
  'at golden hour',
  'at blue hour',
  'at noon',
  'at midnight',
  'at dawn',
  'at dusk',

  // Weather
  'in the rain',
  'in the snow',
  'in the fog',
  'in harsh sunlight',
  'on a cloudy day',
  'during a storm',

  // Indoor
  'in a dimly lit room',
  'by a window',
  'in a studio',
  'in a garage',
  'in a cafe',
  'in a library',

  // Outdoor
  'in a forest',
  'on a beach',
  'in the desert',
  'on a mountain',
  'in the city',
  'in an alley',
  'on a rooftop',
  'in a park',

  // Special
  'under neon lights',
  'in bioluminescent glow',
  'through colored glass',
  'in mirror reflections',
  'underwater',
  'in darkness',
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

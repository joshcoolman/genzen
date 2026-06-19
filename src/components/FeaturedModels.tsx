const FEATURED = [
  {
    name: 'GPT Image 2',
    category: 'Image',
    badge: 'New',
    blurb: 'Quality tiers, inpainting, and 32k-char prompts',
    gradient: 'from-blue-500 via-violet-500 to-purple-700',
    shine: 'from-white/20 to-transparent',
  },
  {
    name: 'Nano Banana 2',
    category: 'Image',
    badge: 'Google',
    blurb: 'Reasoning-guided imagery with unmatched reference fidelity',
    gradient: 'from-emerald-400 via-teal-500 to-cyan-600',
    shine: 'from-white/20 to-transparent',
  },
] as const

export function FeaturedModels() {
  return (
    <section className="w-full space-y-4">
      <h2 className="text-center text-sm font-medium text-muted-foreground uppercase tracking-widest">
        Top-Tier Models
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {FEATURED.map((model) => (
          <div
            key={model.name}
            className={`relative rounded-2xl bg-gradient-to-br ${model.gradient} p-5 overflow-hidden`}
          >
            {/* shine */}
            <div
              className={`pointer-events-none absolute inset-0 bg-gradient-to-b ${model.shine}`}
            />
            {/* noise grain */}
            <div className="pointer-events-none absolute inset-0 opacity-[0.03] [background-image:url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E')]" />

            <div className="relative space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-white/60">
                  {model.category}
                </span>
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                  {model.badge}
                </span>
              </div>
              <h3 className="text-lg font-bold leading-tight text-white">
                {model.name}
              </h3>
              <p className="text-xs leading-relaxed text-white/75">
                {model.blurb}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

---
name: enterprise-aerospace-ui
description: Professional organization-level UI and UX guidelines for aerospace, defense, orbital telemetry, and developer infrastructure consoles (Palantir Foundry, Linear, SpaceX Dragon Avionics, Vercel design aesthetics). Eliminates AI-generated prototype clichés (no defensive authenticity banners, no fake checksum audits, no radioactive cyan glows, no robotic buzzwords) in favor of restrained, high-density, mission-critical engineering design.
---

# Enterprise Aerospace & Mission-Control UI Design System

## 1. Core Philosophy: Restrained Engineering Reality
Real-world aerospace consoles (NASA JPL, ESA Mission Operations, SpaceX Dragon Avionics, Palantir) and executive developer platforms (Linear, Vercel, Datadog) project **quiet competence, extreme information density, and absolute factual clarity**. They never use theatrical sci-fi gimmicks, cyberpunk neon glows, or defensive claims.

---

## 2. The Anti-AI Design Checklist (Banned Patterns)

### ❌ BANNED: Defensive Authenticity Slogans
- **Never say:** *"100% REAL LIVE DATA GUARANTEED"*, *"No synthetic mock datasets active"*, *"Guaranteed live SQL queries"*.
- **Why:** Real software never pleads with the user to believe its data. It simply displays the metrics cleanly.
- **Replacement:** Direct, factual service status badges: `● Operational`, `Query Latency: 0.38 ms`, `Pool: 3 / 10 active`.

### ❌ BANNED: Pseudo-Security Theater
- **Never render:** Fake SHA-256 checksums (`AUDIT CHECKSUM: EA0E2EA...`), *"Anti-Mock Audit: PASSED"*, or arbitrary hex hashes to "prove" legitimacy.
- **Replacement:** Standard operational metadata: `Engine: SGP4 / Skyfield`, `Epoch: 2026-10-29 18:30:00 UTC`, `Host: localhost:8000`.

### ❌ BANNED: Radioactive Cyberpunk Glows
- **Never use:** `shadow-[0_0_25px_rgba(6,182,212,0.5)]` or saturated neon cyan borders around every container.
- **Replacement:** Clean matte dark zinc surfaces (`bg-zinc-900/60`), 1px hairline borders (`border-white/[0.08]` or `border-zinc-800`), and subtle backdrop blur (`backdrop-blur-xl`).

### ❌ BANNED: Robotic / Dramatic Buzzwords
- **Never use:** *"Autonomous multi-service probe"*, *"PROBE NOW"*, *"WARNTEDLY CUT SERVICE"*, *"Calculate doom scenario"*.
- **Replacement:** Standard developer engineering terminology:
  - `PROBE NOW` $\rightarrow$ `Refresh Diagnostics` or `Sync`
  - `WARNTEDLY CUT SERVICE` $\rightarrow$ `Simulate DB Disconnect` or `Fault Injection`
  - `Autonomous multi-service probe` $\rightarrow$ `Infrastructure & Services`

### ❌ BANNED: Awkward Formatting & Text Truncation
- **Never render:** Missing spaces (`Endpoint:http://localhost:8000`) or half-baked ellipsis (`Architecture:In-Memory Resil..`).
- **Replacement:** Structured key-value grids with explicit margins and full readable names.

---

## 3. Color Palette & Semantic System

| Purpose | Tailwind Classes | Hex / Alpha | Usage |
| :--- | :--- | :--- | :--- |
| **Canvas Background** | `bg-zinc-950` or `#09090b` | `#09090B` | Deep obsidian backdrop |
| **Card Surface** | `bg-zinc-900/60` | `rgba(24, 24, 27, 0.6)` | Matte translucent elevated panels |
| **Borders** | `border-white/[0.08]` or `border-zinc-800` | `rgba(255, 255, 255, 0.08)` | Crisp 1px hairline framing |
| **Primary Text** | `text-zinc-100` | `#F4F4F5` | Headings, active values, high contrast |
| **Secondary Text** | `text-zinc-400` | `#A1A1AA` | Field labels, units, explanations |
| **Muted Metadata** | `text-zinc-500` | `#71717A` | Timestamps, footnote indices |
| **Operational (Green)**| `text-emerald-400 bg-emerald-500/10 border-emerald-500/20` | `#34D399` | Service online, healthy, 0 errors |
| **Degraded (Amber)** | `text-amber-400 bg-amber-500/10 border-amber-500/20` | `#FBBF24` | High latency, warning threshold, sync pending |
| **Disconnected (Red)** | `text-rose-400 bg-rose-500/10 border-rose-500/20` | `#FB7185` | Database down, socket closed, critical risk |
| **Accent / Focus** | `text-cyan-400 bg-cyan-500/10 border-cyan-500/30` | `#22D3EE` | Active selection, primary callouts |

---

## 4. Typography & Number Precision

1. **Labels & Body:** Clean geometric sans (`Inter`, `system-ui`). Clean letter spacing (`tracking-tight` for headings, `tracking-wide` for small uppercase section tags).
2. **Numbers & Telemetry:** Always use `font-mono` with `tabular-nums` so live streaming digits never cause layout shift or horizontal jitter.
3. **Key-Value Pair Layout:**
   ```tsx
   <div className="flex items-center justify-between py-1 text-xs">
     <span className="text-zinc-400">Query Latency</span>
     <span className="font-mono font-medium text-zinc-100 tabular-nums">0.38 ms</span>
   </div>
   ```

---

## 5. Standard Component Patterns

### A. Executive Service Health Card
```tsx
<div className="rounded-xl border border-white/[0.08] bg-zinc-900/60 p-4 backdrop-blur-xl">
  <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
    <div className="flex items-center gap-2">
      <Database className="w-4 h-4 text-zinc-400" />
      <span className="text-xs font-semibold tracking-tight text-zinc-100">Oracle 21c XE</span>
    </div>
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border border-emerald-500/25 bg-emerald-500/10 text-emerald-400">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
      Operational
    </span>
  </div>
  <div className="mt-3 space-y-1.5 text-xs">
    <div className="flex justify-between">
      <span className="text-zinc-400">Connection Pool</span>
      <span className="font-mono text-zinc-200">3 / 10 active</span>
    </div>
    <div className="flex justify-between">
      <span className="text-zinc-400">Query Ping</span>
      <span className="font-mono text-emerald-400">0.38 ms</span>
    </div>
  </div>
</div>
```

### B. Precision Numeric Stepper / Segmented Pills (Replacing Sliders)
```tsx
<div className="flex items-center gap-1.5 p-1 rounded-lg bg-zinc-950 border border-white/[0.08]">
  {[10, 25, 50, 100].map((count) => (
    <button
      key={count}
      onClick={() => setSatelliteLimit(count)}
      className={`px-3 py-1 rounded-md text-xs font-mono font-medium transition-all cursor-pointer ${
        satelliteLimit === count
          ? 'bg-zinc-800 text-cyan-300 border border-cyan-500/30 shadow-sm'
          : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
      }`}
    >
      {count} sats
    </button>
  ))}
</div>
```

### C. Clean Diagnostic Fault Injection (Replacing Dramatic Banners)
```tsx
<div className="flex items-center justify-between p-3 rounded-xl border border-white/[0.08] bg-zinc-950/50">
  <div>
    <div className="text-xs font-medium text-zinc-200">Fault Injection Mode</div>
    <div className="text-[11px] text-zinc-500">Sever live database connection to test client-side resilience</div>
  </div>
  <button
    type="button"
    onClick={toggleDbCut}
    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all border cursor-pointer ${
      isDisconnected
        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
        : 'border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20'
    }`}
  >
    {isDisconnected ? 'Restore Connection' : 'Sever Connection'}
  </button>
</div>
```

---

## 6. Execution Mandatory
Whenever reviewing, building, or modifying frontend modals, dashboards, telemetry cards, tables, or buttons in this project, **always apply this skill**. Reject generic AI buzzwords, fluorescent glows, and defensive guarantee claims on sight.


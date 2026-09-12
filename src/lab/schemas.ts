export const MODULE_SCHEMAS: Record<string, string> = {
  '00-baseline': `
    <div class="flex flex-col md:flex-row items-stretch justify-between gap-2.5 text-xs font-mono">
      <div class="bg-base-300/80 border border-base-content/15 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-base-content/50 uppercase font-bold">1. Scène Graph</div>
        <div class="font-bold text-base-content text-xs">Traversée CPU O(N)</div>
        <div class="text-[10px] text-primary">Boucle JS Three.js</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-base-300/80 border border-base-content/15 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-base-content/50 uppercase font-bold">2. Frustum CPU</div>
        <div class="font-bold text-base-content text-xs">Raycasting Caméra</div>
        <div class="text-[10px] text-base-content/70">Test bounding box</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-error/10 border border-error/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-error uppercase font-bold">3. Coude CPU S3</div>
        <div class="font-bold text-error text-xs">2 000 Draw Calls</div>
        <div class="text-[10px] text-error/90 font-bold">3.35 ms / frame</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-base-300/80 border border-base-content/15 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-base-content/50 uppercase font-bold">4. Driver GPU</div>
        <div class="font-bold text-base-content text-xs">gl.drawElements()</div>
        <div class="text-[10px] text-base-content/70">Saturation pipeline</div>
      </div>
    </div>
  `,
  '01-indirect-draw': `
    <div class="flex flex-col md:flex-row items-stretch justify-between gap-2.5 text-xs font-mono">
      <div class="bg-base-300/80 border border-base-content/15 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-base-content/50 uppercase font-bold">1. CPU Encodage</div>
        <div class="font-bold text-base-content text-xs">1 Dispatch Unique</div>
        <div class="text-[10px] text-primary">Latence &lt; 0.27 ms</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-primary/10 border border-primary/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-primary uppercase font-bold">2. DrawIndirectBuffer</div>
        <div class="font-bold text-primary text-xs">5x uint32 (20 octets)</div>
        <div class="text-[10px] text-primary/80">[idxCount, instCount, ...]</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-success/10 border border-success/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-success uppercase font-bold">3. GPU Exécution</div>
        <div class="font-bold text-success text-xs">drawIndexedIndirect()</div>
        <div class="text-[10px] text-success/90 font-bold">O(1) constant</div>
      </div>
    </div>
  `,
  '02-gpu-frustum-culling': `
    <div class="flex flex-col md:flex-row items-stretch justify-between gap-2.5 text-xs font-mono">
      <div class="bg-base-300/80 border border-base-content/15 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-base-content/50 uppercase font-bold">1. Caméra &amp; Frustum</div>
        <div class="font-bold text-base-content text-xs">Matrice VP</div>
        <div class="text-[10px] text-primary">6 Plans normalisés</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-primary/10 border border-primary/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-primary uppercase font-bold">2. Compute WGSL</div>
        <div class="font-bold text-primary text-xs">d(C, P) &lt; -r</div>
        <div class="text-[10px] text-primary/80">Test sphère 6 plans</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-base-300/80 border border-base-content/15 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-base-content/50 uppercase font-bold">3. Compaction</div>
        <div class="font-bold text-base-content text-xs">atomicAdd()</div>
        <div class="text-[10px] text-success">Indices visibles</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-success/10 border border-success/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-success uppercase font-bold">4. Rendu O(1)</div>
        <div class="font-bold text-success text-xs">DrawIndirect O(1)</div>
        <div class="text-[10px] text-success/90 font-bold">40% triangles éliminés</div>
      </div>
    </div>
  `,
  '03-gpu-scene': `
    <div class="flex flex-col md:flex-row items-stretch justify-between gap-2.5 text-xs font-mono">
      <div class="bg-base-300/80 border border-base-content/15 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-base-content/50 uppercase font-bold">1. Instance SSBO</div>
        <div class="font-bold text-base-content text-xs">64B Matrix + BBox</div>
        <div class="text-[10px] text-primary">100 000 instances</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-primary/10 border border-primary/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-primary uppercase font-bold">2. Mega-Buffers</div>
        <div class="font-bold text-primary text-xs">Géométrie + Matériaux</div>
        <div class="text-[10px] text-primary/80">Tables SSBO unifiées</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-success/10 border border-success/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-success uppercase font-bold">3. Multi-Draw O(1)</div>
        <div class="font-bold text-success text-xs">multiDrawIndexedIndirect</div>
        <div class="text-[10px] text-success/90 font-bold">Gain 93.2% CPU</div>
      </div>
    </div>
  `,
  '04-gpu-lod': `
    <div class="flex flex-col md:flex-row items-stretch justify-between gap-2.5 text-xs font-mono">
      <div class="bg-base-300/80 border border-base-content/15 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-base-content/50 uppercase font-bold">1. Décimation Quadrique</div>
        <div class="font-bold text-base-content text-xs">Meshoptimizer</div>
        <div class="text-[10px] text-primary">LOD0 → LOD1 → LOD2</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-primary/10 border border-primary/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-primary uppercase font-bold">2. Erreur Écran SSE</div>
        <div class="font-bold text-primary text-xs">SSE = (r · δ · H) / (2d · tan)</div>
        <div class="text-[10px] text-primary/80">Seuil contractuel 2.0 px</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-success/10 border border-success/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-success uppercase font-bold">3. Économie VRAM</div>
        <div class="font-bold text-success text-xs">−75% Triangles</div>
        <div class="text-[10px] text-success/90 font-bold">Zéro pop visuel</div>
      </div>
    </div>
  `,
  '05-meshlets': `
    <div class="flex flex-col md:flex-row items-stretch justify-between gap-2.5 text-xs font-mono">
      <div class="bg-base-300/80 border border-base-content/15 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-base-content/50 uppercase font-bold">1. Maillage Dense</div>
        <div class="font-bold text-base-content text-xs">Topologie continue</div>
        <div class="text-[10px] text-primary">Indices 32-bit</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-primary/10 border border-primary/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-primary uppercase font-bold">2. METIS / Clusters</div>
        <div class="font-bold text-primary text-xs">64 Sommets / 126 Tris</div>
        <div class="text-[10px] text-primary/80">Indexation locale 8-bit</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-success/10 border border-success/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-success uppercase font-bold">3. Bounding Bounds</div>
        <div class="font-bold text-success text-xs">Cône N + Sphère C</div>
        <div class="text-[10px] text-success/90 font-bold">0 fissure topologique</div>
      </div>
    </div>
  `,
  '06-meshlet-culling': `
    <div class="flex flex-col md:flex-row items-stretch justify-between gap-2.5 text-xs font-mono">
      <div class="bg-base-300/80 border border-base-content/15 p-3 rounded-box text-center flex-1"><b>1. Fixture CPU</b><br><span class="text-base-content/60">Cônes orientés connus</span></div>
      <div class="hidden md:flex items-center">→</div>
      <div class="bg-primary/10 border border-primary/40 p-3 rounded-box text-center flex-1"><b>2. Frustum normalisé</b><br><span class="text-primary/80">Sphère contre plans</span></div>
      <div class="hidden md:flex items-center">→</div>
      <div class="bg-primary/10 border border-primary/40 p-3 rounded-box text-center flex-1"><b>3. Cône et sous-pixel</b><br><span class="text-primary/80">Oracle conservateur CPU</span></div>
      <div class="hidden md:flex items-center">→</div>
      <div class="bg-success/10 border border-success/40 p-3 rounded-box text-center flex-1"><b>4. Contrôle des IDs</b><br><span class="text-success/90">GPU non exécuté</span></div>
    </div>
  `,
  '07-hiz': `
    <div class="flex flex-col md:flex-row items-stretch justify-between gap-2.5 text-xs font-mono">
      <div class="bg-base-300/80 border border-base-content/15 p-3 rounded-box text-center flex-1"><b>1. Profondeur CPU</b><br><span class="text-base-content/60">Valeurs [0, 1]</span></div>
      <div class="hidden md:flex items-center">→</div>
      <div class="bg-primary/10 border border-primary/40 p-3 rounded-box text-center flex-1"><b>2. Réduction 2×2</b><br><span class="text-primary/80">max standard · min reversed</span></div>
      <div class="hidden md:flex items-center">→</div>
      <div class="bg-primary/10 border border-primary/40 p-3 rounded-box text-center flex-1"><b>3. Contrôle exhaustif</b><br><span class="text-primary/80">Chaque texel de chaque mip</span></div>
      <div class="hidden md:flex items-center">→</div>
      <div class="bg-success/10 border border-success/40 p-3 rounded-box text-center flex-1"><b>4. Racine 1×1</b><br><span class="text-success/90">Readback GPU absent</span></div>
    </div>
  `,
  '08-occlusion-culling': `
    <div class="flex flex-col md:flex-row items-stretch justify-between gap-2.5 text-xs font-mono">
      <div class="bg-base-300/80 border border-base-content/15 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-base-content/50 uppercase font-bold">1. Passe 1 (Early)</div>
        <div class="font-bold text-base-content text-xs">Objets visibles N-1</div>
        <div class="text-[10px] text-primary">Rendu + Hi-Z Gen</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-primary/10 border border-primary/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-primary uppercase font-bold">2. Test Hi-Z AABB</div>
        <div class="font-bold text-primary text-xs">dmax(AABB) &lt; dmin(HiZ)</div>
        <div class="text-[10px] text-primary/80">Mip sélectionné en O(1)</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-success/10 border border-success/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-success uppercase font-bold">3. Passe 2 (Late)</div>
        <div class="font-bold text-success text-xs">Objets réapparus</div>
        <div class="text-[10px] text-success/90 font-bold">50% à 90% d'overdraw évité</div>
      </div>
    </div>
  `,
  '09-gpu-compaction': `
    <div class="flex flex-col md:flex-row items-stretch justify-between gap-2.5 text-xs font-mono">
      <div class="bg-base-300/80 border border-base-content/15 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-base-content/50 uppercase font-bold">1. Liste Visible</div>
        <div class="font-bold text-base-content text-xs">Masque booléen</div>
        <div class="text-[10px] text-primary">100k threads</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-primary/10 border border-primary/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-primary uppercase font-bold">2. Up-Sweep (Réduction)</div>
        <div class="font-bold text-primary text-xs">Arbre binaire local</div>
        <div class="text-[10px] text-primary/80">256 threads / workgroup</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-primary/10 border border-primary/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-primary uppercase font-bold">3. Down-Sweep (Scan)</div>
        <div class="font-bold text-primary text-xs">Propagation globale</div>
        <div class="text-[10px] text-primary/80">Zéro lock atomique</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-success/10 border border-success/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-success uppercase font-bold">4. Buffer Dense</div>
        <div class="font-bold text-success text-xs">Indices Continus</div>
        <div class="text-[10px] text-success/90 font-bold">Prêt pour DrawIndirect</div>
      </div>
    </div>
  `,
  '10-material-batching': `
    <div class="flex flex-col md:flex-row items-stretch justify-between gap-2.5 text-xs font-mono">
      <div class="bg-base-300/80 border border-base-content/15 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-base-content/50 uppercase font-bold">1. Scène Hétérogène</div>
        <div class="font-bold text-base-content text-xs">100 Matériaux Différents</div>
        <div class="text-[10px] text-primary">Albedo, PBR, Roughness</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-primary/10 border border-primary/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-primary uppercase font-bold">2. MaterialTable SSBO</div>
        <div class="font-bold text-primary text-xs">32 octets / matériau</div>
        <div class="text-[10px] text-primary/80">Indexé par materialID</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-success/10 border border-success/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-success uppercase font-bold">3. 1 Seul Draw Call</div>
        <div class="font-bold text-success text-xs">Zero State Switch</div>
        <div class="text-[10px] text-success/90 font-bold">0.08 ms submit CPU</div>
      </div>
    </div>
  `,
  '11-geometry-streaming': `
    <div class="flex flex-col md:flex-row items-stretch justify-between gap-2.5 text-xs font-mono">
      <div class="bg-base-300/80 border border-base-content/15 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-base-content/50 uppercase font-bold">1. Requête Caméra</div>
        <div class="font-bold text-base-content text-xs">Meshlets Visibles</div>
        <div class="text-[10px] text-primary">Distance &amp; Frustum</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-primary/10 border border-primary/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-primary uppercase font-bold">2. Ring Buffer VRAM</div>
        <div class="font-bold text-primary text-xs">Budget Fixe 64 MB</div>
        <div class="text-[10px] text-primary/80">Upload O(1) sans blocage</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-success/10 border border-success/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-success uppercase font-bold">3. Éviction LRU</div>
        <div class="font-bold text-success text-xs">Plafond Strict Garanti</div>
        <div class="text-[10px] text-success/90 font-bold">Zéro crash OOM / Stutter</div>
      </div>
    </div>
  `,
  '12-visibility-buffer': `
    <div class="flex flex-col md:flex-row items-stretch justify-between gap-2.5 text-xs font-mono">
      <div class="bg-primary/10 border border-primary/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-primary uppercase font-bold">1. Raster Compact</div>
        <div class="font-bold text-primary text-xs">8 Octets / Pixel</div>
        <div class="text-[10px] text-primary/80">InstID (16b) + TriID (16b)</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-base-300/80 border border-base-content/15 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-base-content/50 uppercase font-bold">2. VRAM Économisée</div>
        <div class="font-bold text-base-content text-xs">15.8 MB vs 55.4 MB</div>
        <div class="text-[10px] text-success font-bold">−71.5% bande passante</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-primary/10 border border-primary/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-primary uppercase font-bold">3. Compute Shading</div>
        <div class="font-bold text-primary text-xs">Barycentriques Exacts</div>
        <div class="text-[10px] text-primary/80">Interpolation sommets</div>
      </div>
      <div class="hidden md:flex items-center text-base-content/30 font-bold">→</div>
      <div class="bg-success/10 border border-success/40 p-3 rounded-box text-center flex-1 space-y-1">
        <div class="text-[10px] text-success uppercase font-bold">4. Shading Découplé</div>
        <div class="font-bold text-success text-xs">1x Shading Exact</div>
        <div class="text-[10px] text-success/90 font-bold">Zéro overdraw matière</div>
      </div>
    </div>
  `,
  '13-full-gpu-driven': `
    <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono">
      <div class="bg-base-300/80 p-2.5 rounded-box border border-base-content/10 text-center">
        <div class="text-[9px] text-base-content/50 uppercase">1. Scene</div>
        <div class="font-bold">Instances</div>
      </div>
      <div class="bg-base-300/80 p-2.5 rounded-box border border-base-content/10 text-center">
        <div class="text-[9px] text-base-content/50 uppercase">2. Frustum</div>
        <div class="font-bold">6 Plans</div>
      </div>
      <div class="bg-base-300/80 p-2.5 rounded-box border border-base-content/10 text-center">
        <div class="text-[9px] text-base-content/50 uppercase">3. LOD</div>
        <div class="font-bold">SSE Pixel</div>
      </div>
      <div class="bg-base-300/80 p-2.5 rounded-box border border-base-content/10 text-center">
        <div class="text-[9px] text-base-content/50 uppercase">4. Clusters</div>
        <div class="font-bold">Meshlets</div>
      </div>
      <div class="bg-base-300/80 p-2.5 rounded-box border border-base-content/10 text-center">
        <div class="text-[9px] text-base-content/50 uppercase">5. Culling</div>
        <div class="font-bold">Cône N</div>
      </div>
      <div class="bg-base-300/80 p-2.5 rounded-box border border-base-content/10 text-center">
        <div class="text-[9px] text-base-content/50 uppercase">6. Hi-Z</div>
        <div class="font-bold">Pyramide</div>
      </div>
      <div class="bg-base-300/80 p-2.5 rounded-box border border-base-content/10 text-center">
        <div class="text-[9px] text-base-content/50 uppercase">7. Occlusion</div>
        <div class="font-bold">2 Passes</div>
      </div>
      <div class="bg-base-300/80 p-2.5 rounded-box border border-base-content/10 text-center">
        <div class="text-[9px] text-base-content/50 uppercase">8. Compact</div>
        <div class="font-bold">Prefix-Sum</div>
      </div>
      <div class="bg-base-300/80 p-2.5 rounded-box border border-base-content/10 text-center">
        <div class="text-[9px] text-base-content/50 uppercase">9. MultiDraw</div>
        <div class="font-bold">Indirect O(1)</div>
      </div>
      <div class="bg-primary/10 border border-primary/40 text-primary font-bold p-2.5 rounded-box text-center">
        <div class="text-[9px] uppercase">10. Shading</div>
        <div class="font-bold">0.25 ms (640x)</div>
      </div>
    </div>
  `,
};


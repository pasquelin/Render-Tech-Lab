# Matériaux, listes compactes et vues

```text
cle_raster(m):
  return (m.double_face, m.masque, m.deformation, m.profondeur)

cle_nuanceur(m):
  return (m.programme, m.textures, m.derivees, m.eclairage)

indices(x):
  return range(len(x))

produit_scalaire(a, b):
  return a.x × b.x + a.y × b.y + a.z × b.z

id_cle(cles, cle):
  for i in indices(cles):
    if cles[i] == cle:
      return i
  cles.append(cle)
  return len(cles) - 1

classer(elements, champ):
  cles = []
  bins = []
  for e in elements:
    id = id_cle(cles, champ(e.materiau))
    bins.append(id)
  return cles, bins
```

```text
histogramme(bins, nombre):
  h = [0 for i in range(nombre)]
  for b in bins:
    require 0 <= b < nombre
    h[b] = h[b] + 1
  return h

scan_exclusif(h):
  offsets = []
  total = 0
  for x in h:
    offsets.append(total)
    total = total + x
  return offsets, total

disperser(elements, bins, offsets, comptes, total):
  sortie = [aucun for i in range(total)]
  curseurs = [x for x in offsets]
  for i in indices(elements):
    b = bins[i]
    require curseurs[b] < offsets[b] + comptes[b]
    sortie[curseurs[b]] = elements[i]
    curseurs[b] = curseurs[b] + 1
  return sortie
```

```text
lots(cles, comptes, offsets):
  sortie = []
  for b in indices(cles):
    if comptes[b] > 0:
      sortie.append((cles[b], offsets[b], comptes[b]))
  return sortie

preparer_raster(elements):
  cles, bins = classer(elements, cle_raster)
  comptes = histogramme(bins, len(cles))
  offsets, total = scan_exclusif(comptes)
  ordre = disperser(elements, bins, offsets, comptes, total)
  return ordre, lots(cles, comptes, offsets)

preparer_nuanceur(pixels):
  cles, bins = classer(pixels, cle_nuanceur)
  comptes = histogramme(bins, len(cles))
  offsets, total = scan_exclusif(comptes)
  ordre = disperser(pixels, bins, offsets, comptes, total)
  return ordre, lots(cles, comptes, offsets)
```

```text
Vue:
  id
  largeur
  hauteur
  near
  plans
  version

valider_vue(v):
  require v.largeur > 0 and v.hauteur > 0
  require v.near > 0
  require 5 <= len(v.plans) <= 6
  return v

visible(s, v):
  valider_vue(v)
  for p in v.plans:
    norme_plan = sqrt(produit_scalaire(p.normale, p.normale))
    require norme_plan > 0
    if produit_scalaire(p.normale, s.centre) + p.d < -s.rayon × norme_plan:
      return false
  return true

preparer_vues(vues, objets):
  listes = {}
  for v in vues:
    listes[v.id] = [o for o in objets if visible(o.borne, v)]
  return listes
```

```text
Ressource:
  id
  gen
  etat
  refs
  derniere_frame

creer(r):
  require r.etat == "absent"
  r.gen = r.gen + 1
  r.etat = "pret"
  r.refs = 0
  return r.gen

retenir(r, frame):
  require r.etat == "pret"
  r.refs = r.refs + 1
  r.derniere_frame = max(r.derniere_frame, frame)
  return (r.id, r.gen)

relacher(r):
  require r.refs > 0
  r.refs = r.refs - 1

retirer(r, frame_terminee):
  require r.etat == "pret"
  require r.refs == 0
  require r.derniere_frame <= frame_terminee
  r.etat = "absent"
  r.gen = r.gen + 1
```

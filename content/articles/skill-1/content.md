#Skill
# Process — Créer un site « scroll-driven video »

Ce document décrit, étape par étape, **comment fabriquer une nouvelle maquette** une fois
que la (ou les) vidéo(s) sont prêtes. Le principe : la position du scroll pilote la vidéo
image par image (technique « façon Apple »), puis des sections éditoriales prolongent
l'expérience.

> TL;DR : on découpe la vidéo en images → on les pose dans `assets/frames/<univers>/`
> → on duplique une page HTML → on cale les textes sur les bons moments → on habille
> avec une charte dédiée → on teste dans le navigateur.

---

## 1. Vue d'ensemble du projet

```
Site web maquette/
├── index.html                ← galerie : une carte par maquette
├── <univers>.html            ← une page par site (immobilier, cosmetique, rooftop…)
├── videos/                    ← vidéos sources (.mp4)
├── assets/
│   ├── frames/<univers>/      ← images extraites (001.jpg, 002.jpg, …)
│   ├── css/
│   │   ├── base.css           ← socle commun : nav, scène, canvas, panneaux, loader
│   │   ├── sections.css       ← bibliothèque de sections éditoriales + thèmes
│   │   └── <univers>.css      ← charte graphique propre au site (police, couleurs)
│   └── js/
│       └── scroll-video.js    ← moteur unique (préchargement + scrub + reveals)
└── PROCESS.md                 ← ce document
```

**Trois briques réutilisables, jamais à réécrire :**

- `assets/js/scroll-video.js` — le moteur. Un seul appel `initScrollVideo({…})` par page.
- `assets/css/base.css` — la scène vidéo, la nav, les panneaux de texte, le loader.
- `assets/css/sections.css` — les composants éditoriaux (manifeste, stats, split, cartes,
  étapes, marquee, showcase, footer…) thématisables via des variables CSS.

Pour un nouveau site, on ne touche normalement **qu'à 3 choses** : les frames, le HTML de
la page, et un petit fichier `<univers>.css` pour la charte.

---

## 2. Pré-requis (une seule fois)

- **ffmpeg / ffprobe** installés (extraction et analyse des vidéos).
- Un **serveur local** pour servir les pages (le préchargement des frames ne marche pas en
  `file://`) :

```bash
cd "Site web maquette"
python3 -m http.server 8000
# puis ouvrir http://localhost:8000/<univers>.html
```

---

## 3. Le process, étape par étape

### Étape 0 — Recevoir la/les vidéo(s)
Déposer le(s) fichier(s) dans `videos/`. Une scène peut être faite **d'une seule vidéo**
ou de **plusieurs vidéos mises bout à bout** (ex. le rooftop = `rooftop1.mp4` +
`rooftop2.mp4`).

### Étape 1 — Analyser la vidéo
On regarde la résolution, le frame rate, la durée et le nombre d'images :

```bash
ffprobe -v error -select_streams v:0 \
  -show_entries stream=codec_name,width,height,r_frame_rate,nb_frames,duration \
  -of default=noprint_wrappers=1 videos/<fichier>.mp4
```

À retenir : le **nombre total de frames** (= `frameCount`) et la **résolution**.

### Étape 2 — Extraire les images
On découpe la vidéo en une séquence d'images numérotées, dans un dossier dédié :

```bash
mkdir -p assets/frames/<univers>
ffmpeg -hide_banner -loglevel error -i videos/<fichier>.mp4 \
  -q:v 4 -start_number 1 "assets/frames/<univers>/%03d.jpg"
```

**Plusieurs vidéos à enchaîner ?** On continue la numérotation avec `-start_number` :

```bash
# vidéo 1 → 001..145
ffmpeg … -i videos/rooftop1.mp4 -q:v 4 -start_number 1   "assets/frames/rooftop/%03d.jpg"
# vidéo 2 → 146..410 (repart juste après la dernière frame de la 1)
ffmpeg … -i videos/rooftop2.mp4 -q:v 4 -start_number 146 "assets/frames/rooftop/%03d.jpg"
```

> `%03d` = numéro sur 3 chiffres (`001.jpg`). Si une séquence dépasse 999 frames,
> passer à `%04d` et mettre `pad: 4` dans la config (voir étape 6).

### Étape 3 — Repérer les moments clés
C'est **l'étape la plus importante** visuellement. On génère des planches-contact pour
voir toute la vidéo d'un coup d'œil :

```bash
# une mosaïque 5x4, une image toutes les 16 frames
ffmpeg -hide_banner -loglevel error -i videos/<fichier>.mp4 \
  -vf "select='not(mod(n\,16))',scale=240:-1,tile=5x4" -frames:v 1 -y /tmp/sheet.png
```

On note les **frames qui correspondent à un moment fort** (un reveal, une plongée, le
produit qui se pose, un gros plan…). Exemple rooftop :

| Frame (sur 410) | Moment                       | Où poser le texte |
| --------------- | ---------------------------- | ----------------- |
| 1–40            | Survol de Paris              | hero, bas-gauche  |
| ~130            | Arrivée terrasse / T. Eiffel | bas-centre        |
| ~300            | Cocktail (verre à gauche)    | **à droite**      |
| ~360            | Planche (au centre-bas)      | **haut-droite**   |
| ~410            | Carafe/verres (à gauche)     | **à droite**      |

> Règle d'or : on pose le texte **du côté vide de l'image**, là où le sujet ne se trouve
> pas, pour ne pas gâcher le visuel.

On convertit ces numéros de frame en **progression 0 → 1** : `progress = frame / frameCount`.
Ex. frame 300 sur 410 → `0.73`.

### Étape 4 — Dupliquer une page existante
Le plus simple : copier une page proche (`glow.html` ou `rooftop.html`) et la renommer
`<univers>.html`. La structure est toujours la même :

1. `<head>` : polices Google + `base.css` + `sections.css` + `<univers>.css`
2. Loader
3. Nav (statique)
4. `.scroll-track > .scene` : le canvas + les **panneaux de texte**
5. `<main class="content theme-<univers>">` : les **sections éditoriales**
6. Les scripts + l'appel `initScrollVideo({…})`

### Étape 5 — Caler les panneaux de texte sur la vidéo
Chaque panneau est un bloc HTML piloté par des **attributs `data-`** (le moteur s'occupe
du reste : fade + translation à l'entrée et à la sortie).

```html
<div class="panel panel--center panel--right"
     data-reveal-start="0.62" data-reveal-end="0.79" data-reveal-from="right">
  <div class="panel__inner">
    <span class="eyebrow">La carte</span>
    <h2 class="title">Cocktails <em>d'auteur</em></h2>
    <p class="lede">Signés par nos barmen, du crépuscule à la nuit.</p>
  </div>
</div>
```

**Attributs disponibles :**

| Attribut             | Rôle                                                    |
|----------------------|---------------------------------------------------------|
| `data-reveal-start`  | progression (0→1) où le texte **apparaît**              |
| `data-reveal-end`    | progression où il **disparaît** (`1` = reste jusqu'au bout) |
| `data-reveal-from`   | direction d'entrée : `up` · `down` · `left` · `right`   |

**Positionnement (classes CSS) :**

- Vertical : `panel--top` · `panel--center` · `panel--bottom`
- Horizontal : `panel--left` · `panel--mid` · `panel--right`
- Lisibilité : ajouter `panel--glass` pour un fond flouté translucide derrière le texte.

> Le premier panneau (`data-reveal-start="0"`) est visible dès le haut de page : on n'anime
> que sa sortie.

### Étape 6 — Lancer le moteur
En bas de page, un seul appel configure tout :

```html
<script src="…/gsap.min.js"></script>
<script src="…/ScrollTrigger.min.js"></script>
<script src="…/lenis.min.js"></script>
<script src="assets/js/scroll-video.js"></script>
<script>
  initScrollVideo({
    framesPath: "assets/frames/rooftop/",
    frameCount: 410,   // = nb d'images extraites
    pad: 3,            // 3 chiffres (001.jpg)
    ext: "jpg",
    scrollVh: 1100,    // longueur de scrubbing (voir ci-dessous)
  });
</script>
```

**Régler `scrollVh`** = la « longueur » de scroll consacrée à la vidéo (en `vh`).
Règle pratique : **~2,7 vh par frame**.
- 314 frames → ~850 vh
- 410 frames → ~1100 vh

Plus la valeur est haute, plus la vidéo défile lentement (plus de scroll pour la même
séquence).

### Étape 7 — Construire le « ventre » du site (sections éditoriales)
Après la vidéo, le `<main class="content theme-<univers>">` enchaîne des sections prêtes à
l'emploi (dans `sections.css`). Elles s'animent au scroll via `data-anim` :

| `data-anim`   | Effet                                             |
|---------------|---------------------------------------------------|
| `fade`        | apparition simple (opacité)                       |
| `fade-up`     | apparition + montée                               |
| `zoom`        | image qui se dézoome doucement (sur un `.split__media` / `.showcase`) |
| `stagger`     | les enfants apparaissent en cascade               |
| `data-count`  | compteur chiffré animé (ex. `data-count="120"`)   |
| `data-delay`  | retard en secondes (ex. `data-delay="0.08"`)      |

Composants disponibles : `manifesto`, `stats`, `split` (image + texte), `cards`,
`steps`, `marquee`, `showcase` (grande image parallax), `shop` (produits), `site-footer`.
On peut réutiliser des **frames de la vidéo** comme visuels (ex. la frame 130 en showcase).

### Étape 8 — Habiller avec la charte (`<univers>.css`)
C'est ce qui rend chaque site unique **sans toucher aux autres**. Dans
`assets/css/<univers>.css` on redéfinit surtout les polices, puis dans `sections.css` on
ajoute une ligne de thème :

```css
/* dans sections.css */
.content.theme-rooftop { --accent:#e0a85a; --bg:#0c0e13; --bg-soft:#141821; }
```

```css
/* dans rooftop.css : polices + accents propres au site */
:root {
  --font-display: "Marcellus", serif;   /* titres */
  --font-body: "Jost", sans-serif;       /* textes */
}
```

Variables thématiques principales : `--accent` (couleur d'accent), `--bg` / `--bg-soft`
(fonds), `--line` (filets), `--muted` (texte secondaire), `--font-display`, `--font-body`.

Penser à **charger les polices** dans le `<head>` (Google Fonts).

### Étape 9 — Ajouter la carte à la galerie d'accueil
Dans `index.html`, dupliquer une carte et pointer vers la nouvelle page + une frame
représentative :

```html
<a class="card" href="rooftop.html">
  <img src="assets/frames/rooftop/130.jpg" alt="Le Relais Bellevue" />
  <div class="card__body">
    <div class="card__tag">Rooftop bar · Paris</div>
    <div class="card__title">Le Relais Bellevue</div>
    <div class="card__go">Monter sur le toit <span>→</span></div>
  </div>
</a>
```

### Étape 10 — Tester
Servir en local (`python3 -m http.server 8000`) puis vérifier :

- [ ] Le loader part une fois les frames chargées.
- [ ] La vidéo scrubbe **fluide** dans les deux sens.
- [ ] Chaque texte apparaît **au bon moment** et **du bon côté**.
- [ ] La transition vidéo → sections éditoriales est nette.
- [ ] Les animations `data-anim` se déclenchent au scroll.
- [ ] Aucune erreur dans la console.
- [ ] Rendu correct sur mobile (la nav se simplifie sous 760px).

---

## 4. Check-list express (à copier pour chaque nouveau site)

```
[ ] 0. Vidéo(s) dans videos/
[ ] 1. ffprobe → noter frameCount + résolution
[ ] 2. ffmpeg → extraire dans assets/frames/<univers>/ (start_number si plusieurs vidéos)
[ ] 3. Planches-contact → repérer les frames clés → convertir en progress (frame/frameCount)
[ ] 4. Dupliquer une page en <univers>.html
[ ] 5. Caler les panels (data-reveal-start / end / from) + positions (panel--…)
[ ] 6. initScrollVideo({ framesPath, frameCount, pad, ext, scrollVh ≈ 2,7×frames })
[ ] 7. Construire les sections éditoriales (data-anim)
[ ] 8. Charte : <univers>.css (polices) + .content.theme-<univers> (couleurs)
[ ] 9. Ajouter la carte dans index.html
[ ] 10. Tester en local + check-list visuelle
```

---

## 5. Réglages utiles & pièges

- **Frames lourdes / chargement lent** : baisser la qualité (`-q:v 6`) ou la résolution
  (`-vf scale=1280:-1`) à l'extraction. ~150–400 frames est un bon compromis.
- **> 999 frames** : numéroter en `%04d` à l'extraction **et** mettre `pad: 4` dans la config.
- **Texte illisible sur fond clair** : ajouter `panel--glass`, ou s'appuyer sur le voile
  (`.scene__veil`) déjà présent dans `base.css`.
- **La page « saute » à la jonction vidéo/sections** : vérifier que `scrollVh` est cohérent
  (ni trop court, ni trop long) et relancer le serveur après modif.
- **Toujours servir via HTTP** (pas en double-clic `file://`), sinon les frames ne se
  préchargent pas.
```
# Cognitive Shift

Site statique pour publier des articles/documents avec une page d'accueil (`home.html`), une page article, une page Manifest et un CLI de publication.

Production: https://cognitiveshift.vercel.app

Figma: [Cognitive shift website](https://www.figma.com/design/zM6WaLxg5vJlJdGf6qc213/Cognitive-shift-website?node-id=0-1&t=O8KGVyqAvmdCj8KE-1)

## Installation locale du CLI

Depuis la racine du projet:

```bash
npm link
```

Ensuite la commande globale `cognitiveshift` est disponible depuis le terminal.

## Commandes CLI

Chaque commande reconstruit `data/articles.json` et `data/categories.json`, puis fait par defaut:

1. `git add`
2. `git commit`
3. `git push`
4. `vercel --prod --yes`
5. `vercel alias set <deployment-url> cognitiveshift.vercel.app`

Le domaine de production utilise `cognitiveshift.vercel.app` par defaut. Pour publier vers un autre alias:

```bash
COGNITIVE_SHIFT_DOMAIN=autre-domaine.vercel.app cognitiveshift -- update-general
```

```bash
# Cmd 1: ajouter un nouvel article et pousser GitHub + Vercel
cognitiveshift -- push-article article-1

# Cmd 2: update un article deja existant et pousser GitHub + Vercel
cognitiveshift -- update-article article-1

# Cmd 3: supprimer un article deja existant et pousser GitHub + Vercel
cognitiveshift -- delete-article article-1

# Cmd 4: ajouter une category au site et pousser GitHub + Vercel
cognitiveshift -- add-category category_skill_ai

# Cmd 5: supprimer une category au site et pousser GitHub + Vercel
cognitiveshift -- del-category category_skill_ai

# Cmd 6: update une category au site et pousser GitHub + Vercel
cognitiveshift -- update-category category_skill_ai

# Cmd 7: update generale, par exemple apres modification du manifeste
cognitiveshift -- update-general
```

Options utiles:

```bash
cognitiveshift -- update-general --no-git
cognitiveshift -- update-general --no-vercel
cognitiveshift -- push-article article-1 --dry-run
```

## Format d'un article

Pour publier ou updater un article, preparer un dossier a la racine du projet. Le nom du dossier doit etre le slug de l'article.

Exemple:

```text
article-1/
  article.json
  content.pdf
  cover.pdf
```

Pour un contenu non prévisualisable, `content` peut aussi être un dossier:

```text
skill-pack/
  article.json
  content/
    ...
  cover.png
```

Regles:

- `article.json` est obligatoire.
- Le document doit s'appeler `content`, avec n'importe quelle extension utile: `content.pdf`, `content.md`, `content.zip`, etc.
- Si `content` est un dossier, la page article affiche l'etat "no preview available" avec une icone dossier.
- La cover doit s'appeler `cover`, avec extension `cover.png`, `cover.jpg`, `cover.webp` ou `cover.pdf`.
- Si `cover.pdf` est utilise, le CLI genere automatiquement `cover-preview.png` dans `content/articles/<slug>/`.

## Format de `article.json`

```json
{
  "type": "pdf",
  "category": "agentic",
  "name": "Language Model",
  "shortDescription": "Skill optimization process",
  "description": "Cognitive Shift transforms cutting-edge AI research from MIT and the best practices developed by leading Silicon Valley companies into directly applicable frameworks.",
  "keywords": ["agentic", "llm", "security", "skill"]
}
```

Champs:

| Champ | Obligatoire | Maximum | Notes |
| --- | --- | ---: | --- |
| `type` | oui | 12 caracteres | `pdf`, `md`, `folder`, `file` ou `other` |
| `category` | oui | 40 caracteres | slug d'une categorie existante |
| `name` | oui | 18 caracteres | titre affiche sur la page article |
| `shortDescription` | oui | 42 caracteres | texte court sous la cover sur l'accueil |
| `description` | oui | 260 caracteres | texte long sur la page article |
| `keywords` | oui | 12 items | recherche par mots-cles; 24 caracteres max par mot |

Le champ legacy `"key words"` est accepte, mais il est normalise en `"keywords"`.

## Format d'une categorie

Pour ajouter une categorie avec:

```bash
cognitiveshift -- add-category category_skill_ai
```

le CLI cherche automatiquement un des fichiers suivants:

```text
category_skill_ai.json
category_skill_ai/category.json
categories/category_skill_ai.json
```

Il est aussi possible de donner le fichier explicitement:

```bash
cognitiveshift -- add-category category_skill_ai --json ./category.json
```

Format du JSON:

```json
{
  "name": "Skill AI",
  "description": "Articles about agentic systems, LLM tooling and security."
}
```

Limites:

| Champ | Obligatoire | Maximum |
| --- | --- | ---: |
| slug de categorie | oui | 40 caracteres |
| `name` | oui | 28 caracteres |
| `description` | oui | 500 caracteres |

## Structure generee

Le CLI copie les contenus dans:

```text
content/articles/<slug>/article.json
content/articles/<slug>/content.<ext>
content/articles/<slug>/cover.<ext>
content/categories/<slug>.json
```

Puis il regenere:

```text
data/articles.json
data/categories.json
```

Ces deux fichiers `data/` sont lus par le site dans le navigateur.

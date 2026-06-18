#!/usr/bin/env node
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

const root = process.cwd();
const contentRoot = path.join(root, "content");
const articleRoot = path.join(contentRoot, "articles");
const categoryRoot = path.join(contentRoot, "categories");
const dataRoot = path.join(root, "data");
const validTypes = new Set(["pdf", "readme", "file", "other"]);
const limits = {
  article: {
    type: 12,
    category: 40,
    name: 18,
    shortDescription: 42,
    description: 260,
    keyword: 24,
    keywords: 12
  },
  category: {
    slug: 40,
    name: 28,
    description: 220
  }
};

main();

function main() {
  try {
    const parsed = parseArgs(process.argv.slice(2));
    if (parsed.help || !parsed.command) {
      printUsage();
      return;
    }

    const shouldGit = !parsed.options.noGit && !parsed.options.dryRun;
    if (shouldGit) {
      ensureGitReady();
    }

    dispatch(parsed);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

function dispatch(parsed) {
  const [resource, action, ...rest] = parsed.positionals;
  const options = parsed.options;

  if (parsed.command === "push-article") {
    const slug = requireSlug(action, "Article slug is required.");
    upsertArticle(slug, slug, { dryRun: options.dryRun });
    rebuildIndexes({ dryRun: options.dryRun });
    maybeGit(`Push article ${slug}`, options);
    return;
  }

  if (parsed.command === "update-article") {
    const slug = requireSlug(action, "Article slug is required.");
    upsertArticle(slug, slug, { dryRun: options.dryRun });
    rebuildIndexes({ dryRun: options.dryRun });
    maybeGit(`Update article ${slug}`, options);
    return;
  }

  if (parsed.command === "delete-article") {
    const slug = requireSlug(action, "Article slug is required.");
    deleteArticle(slug, { dryRun: options.dryRun });
    rebuildIndexes({ dryRun: options.dryRun });
    maybeGit(`Delete article ${slug}`, options);
    return;
  }

  if (parsed.command === "add-category" || parsed.command === "update-category") {
    const slug = requireSlug(action, "Category slug is required.");
    const jsonPath = resolveCategoryJson(slug, options.json, parsed.command === "update-category");
    upsertCategory(slug, jsonPath, { dryRun: options.dryRun });
    rebuildIndexes({ dryRun: options.dryRun });
    maybeGit(`${parsed.command === "add-category" ? "Add" : "Update"} category ${slug}`, options);
    return;
  }

  if (parsed.command === "del-category" || parsed.command === "delete-category") {
    const slug = requireSlug(action, "Category slug is required.");
    deleteCategory(slug, { dryRun: options.dryRun });
    rebuildIndexes({ dryRun: options.dryRun });
    maybeGit(`Delete category ${slug}`, options);
    return;
  }

  if (parsed.command === "update-general") {
    rebuildIndexes({ dryRun: options.dryRun });
    maybeGit("Update site", options, ["."]);
    return;
  }

  if (parsed.command === "rebuild") {
    rebuildIndexes({ dryRun: options.dryRun });
    maybeGit("Rebuild content indexes", options);
    return;
  }

  if (resource === "article") {
    if (action === "push" || action === "update") {
      const sourceDir = action === "update" ? rest[1] : rest[0];
      const slug = action === "update" ? rest[0] : options.slug;
      upsertArticle(sourceDir, slug, { dryRun: options.dryRun });
      rebuildIndexes({ dryRun: options.dryRun });
      maybeGit(`${capitalize(action)} article ${slug || path.basename(sourceDir || "")}`, options);
      return;
    }

    if (action === "delete") {
      deleteArticle(rest[0], { dryRun: options.dryRun });
      rebuildIndexes({ dryRun: options.dryRun });
      maybeGit(`Delete article ${rest[0]}`, options);
      return;
    }
  }

  if (resource === "category") {
    if (action === "push" || action === "update") {
      upsertCategory(rest[0], options.json, { dryRun: options.dryRun });
      rebuildIndexes({ dryRun: options.dryRun });
      maybeGit(`${capitalize(action)} category ${rest[0]}`, options);
      return;
    }

    if (action === "delete") {
      deleteCategory(rest[0], { dryRun: options.dryRun });
      rebuildIndexes({ dryRun: options.dryRun });
      maybeGit(`Delete category ${rest[0]}`, options);
      return;
    }
  }

  throw new Error("Unknown command. Run `npm run content -- --help`.");
}

function parseArgs(args) {
  const options = { dryRun: false, noGit: false };
  const positionals = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      return { help: true, options, positionals };
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--") {
      continue;
    }

    if (arg === "--no-git") {
      options.noGit = true;
      continue;
    }

    if (arg === "--no-vercel") {
      options.noVercel = true;
      continue;
    }

    if (arg === "--slug") {
      options.slug = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--json") {
      options.json = args[index + 1];
      index += 1;
      continue;
    }

    positionals.push(arg);
  }

  return {
    command: positionals[0],
    options,
    positionals
  };
}

function printUsage() {
  console.log(`Usage:
  cognitiveshift -- push-article <slug> [--no-git] [--no-vercel] [--dry-run]
  cognitiveshift -- update-article <slug> [--no-git] [--no-vercel] [--dry-run]
  cognitiveshift -- delete-article <slug> [--no-git] [--no-vercel] [--dry-run]
  cognitiveshift -- add-category <slug> [--json <file>] [--no-git] [--no-vercel] [--dry-run]
  cognitiveshift -- update-category <slug> [--json <file>] [--no-git] [--no-vercel] [--dry-run]
  cognitiveshift -- del-category <slug> [--no-git] [--no-vercel] [--dry-run]
  cognitiveshift -- update-general [--no-git] [--no-vercel] [--dry-run]

Legacy:
  npm run content -- article push <source-dir> --slug <slug> [--no-git] [--dry-run]
  npm run content -- article update <slug> <source-dir> [--no-git] [--dry-run]
  npm run content -- article delete <slug> [--no-git] [--dry-run]
  npm run content -- category push <slug> --json <file> [--no-git] [--dry-run]
  npm run content -- category update <slug> --json <file> [--no-git] [--dry-run]
  npm run content -- category delete <slug> [--no-git] [--dry-run]
  npm run content -- rebuild [--no-git] [--dry-run]`);
}

function upsertArticle(sourceDirArg, slugArg, { dryRun }) {
  const sourceDir = resolveRequiredPath(sourceDirArg, "Article source directory is required.");
  const slug = slugify(slugArg || path.basename(sourceDir));
  const metadataPath = path.join(sourceDir, "article.json");
  const metadata = normalizeArticleMetadata(readJson(metadataPath));

  validateArticleMetadata(metadata);

  const contentFile = findNamedFile(sourceDir, "content", ["cover-preview"]);
  const coverFile = findNamedFile(sourceDir, "cover", []);
  const destination = path.join(articleRoot, slug);
  const contentDestination = path.join(destination, `content${path.extname(contentFile)}`);
  const coverDestination = path.join(destination, `cover${path.extname(coverFile)}`);
  const metadataDestination = path.join(destination, "article.json");

  if (dryRun) {
    console.log(`[dry-run] Would write article ${slug}`);
    return;
  }

  fs.mkdirSync(destination, { recursive: true });
  fs.copyFileSync(contentFile, contentDestination);
  fs.copyFileSync(coverFile, coverDestination);
  fs.writeFileSync(metadataDestination, `${JSON.stringify(metadata, null, 2)}\n`);
  console.log(`Article ${slug} written.`);
}

function deleteArticle(slugArg, { dryRun }) {
  const slug = requireSlug(slugArg, "Article slug is required.");
  const destination = path.join(articleRoot, slug);
  if (!fs.existsSync(destination)) {
    throw new Error(`Article ${slug} does not exist.`);
  }

  if (dryRun) {
    console.log(`[dry-run] Would delete article ${slug}`);
    return;
  }

  fs.rmSync(destination, { recursive: true, force: true });
  console.log(`Article ${slug} deleted.`);
}

function upsertCategory(slugArg, jsonArg, { dryRun }) {
  const slug = requireSlug(slugArg, "Category slug is required.");
  const jsonPath = resolveRequiredPath(jsonArg, "Category JSON path is required.");
  const metadata = readJson(jsonPath);
  validateCategoryMetadata(metadata);

  if (dryRun) {
    console.log(`[dry-run] Would write category ${slug}`);
    return;
  }

  fs.mkdirSync(categoryRoot, { recursive: true });
  fs.writeFileSync(path.join(categoryRoot, `${slug}.json`), `${JSON.stringify(metadata, null, 2)}\n`);
  console.log(`Category ${slug} written.`);
}

function deleteCategory(slugArg, { dryRun }) {
  const slug = requireSlug(slugArg, "Category slug is required.");
  const categoryPath = path.join(categoryRoot, `${slug}.json`);
  if (!fs.existsSync(categoryPath)) {
    throw new Error(`Category ${slug} does not exist.`);
  }

  const articles = readArticlesFromDisk(false);
  const used = articles.some((article) => article.category === slug);
  if (used) {
    throw new Error(`Category ${slug} is still used by at least one article.`);
  }

  if (dryRun) {
    console.log(`[dry-run] Would delete category ${slug}`);
    return;
  }

  fs.rmSync(categoryPath);
  console.log(`Category ${slug} deleted.`);
}

function rebuildIndexes({ dryRun }) {
  const categories = readCategoriesFromDisk();
  const articles = readArticlesFromDisk(!dryRun);
  const categorySlugs = new Set(categories.map((category) => category.slug));

  articles.forEach((article) => {
    if (!categorySlugs.has(article.category)) {
      throw new Error(`Article ${article.slug} references missing category ${article.category}.`);
    }
  });

  if (dryRun) {
    console.log(`[dry-run] Would rebuild ${articles.length} articles and ${categories.length} categories.`);
    return;
  }

  fs.mkdirSync(dataRoot, { recursive: true });
  fs.writeFileSync(path.join(dataRoot, "categories.json"), `${JSON.stringify(categories, null, 2)}\n`);
  fs.writeFileSync(path.join(dataRoot, "articles.json"), `${JSON.stringify(articles, null, 2)}\n`);
  console.log(`Indexes rebuilt: ${articles.length} articles, ${categories.length} categories.`);
}

function readCategoriesFromDisk() {
  if (!fs.existsSync(categoryRoot)) return [];

  return fs.readdirSync(categoryRoot)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => {
      const slug = path.basename(name, ".json");
      const metadata = readJson(path.join(categoryRoot, name));
      validateCategoryMetadata(metadata);
      return { slug, ...metadata };
    });
}

function readArticlesFromDisk(generatePreviews) {
  if (!fs.existsSync(articleRoot)) return [];

  return fs.readdirSync(articleRoot)
    .filter((name) => !name.startsWith("."))
    .sort()
    .map((slug) => {
      const directory = path.join(articleRoot, slug);
      if (!fs.statSync(directory).isDirectory()) return null;

      const metadataPath = path.join(directory, "article.json");
      const metadata = normalizeArticleMetadata(readJson(metadataPath));
      validateArticleMetadata(metadata);

      const contentFile = findNamedFile(directory, "content", ["cover-preview"]);
      const coverFile = findNamedFile(directory, "cover", ["cover-preview"]);
      const previewFile = buildCoverPreview(directory, coverFile, generatePreviews);

      return {
        slug,
        ...metadata,
        contentPath: toPublicPath(contentFile),
        coverPath: toPublicPath(coverFile),
        coverPreviewPath: toPublicPath(previewFile)
      };
    })
    .filter(Boolean);
}

function buildCoverPreview(directory, coverFile, generate) {
  const ext = path.extname(coverFile).toLowerCase();
  if (ext !== ".pdf") {
    return coverFile;
  }

  const previewFile = path.join(directory, "cover-preview.png");
  if (!generate) {
    return previewFile;
  }

  const needsPreview = !fs.existsSync(previewFile) || fs.statSync(previewFile).mtimeMs < fs.statSync(coverFile).mtimeMs;
  if (!needsPreview) {
    return previewFile;
  }

  const pdftoppm = findPdfToPpm();
  if (!pdftoppm) {
    throw new Error("cover.pdf needs a preview, but pdftoppm was not found. Install Poppler or set PDFTOPPM=/path/to/pdftoppm.");
  }

  const prefix = path.join(directory, "cover-preview");
  execFileSync(pdftoppm, ["-png", "-singlefile", "-r", "144", coverFile, prefix], { stdio: "pipe" });
  return previewFile;
}

function findPdfToPpm() {
  if (process.env.PDFTOPPM && fs.existsSync(process.env.PDFTOPPM)) {
    return process.env.PDFTOPPM;
  }

  const system = spawnSync("command", ["-v", "pdftoppm"], { shell: true, encoding: "utf8" });
  const found = system.stdout && system.stdout.trim();
  if (found) return found;

  const bundled = path.join(
    os.homedir(),
    ".cache/codex-runtimes/codex-primary-runtime/dependencies/bin/pdftoppm"
  );
  return fs.existsSync(bundled) ? bundled : null;
}

function findCommand(name) {
  const found = spawnSync("command", ["-v", name], { shell: true, encoding: "utf8" });
  return found.stdout && found.stdout.trim() ? found.stdout.trim() : null;
}

function resolveCategoryJson(slug, jsonArg, allowExistingTarget) {
  if (jsonArg) {
    return resolveRequiredPath(jsonArg, "Category JSON path is required.");
  }

  const candidates = [
    path.join(root, `${slug}.json`),
    path.join(root, slug, "category.json"),
    path.join(root, "categories", `${slug}.json`)
  ];

  if (allowExistingTarget) {
    candidates.push(path.join(categoryRoot, `${slug}.json`));
  }

  const match = candidates.find((candidate) => fs.existsSync(candidate));
  if (!match) {
    throw new Error(`Category JSON not found for ${slug}. Expected ${slug}.json or ${slug}/category.json, or pass --json <file>.`);
  }

  return match;
}

function enforceMaxLength(value, max, label) {
  if (String(value).length > max) {
    throw new Error(`${label} must be ${max} characters or fewer.`);
  }
}

function maybeGit(message, options, paths = ["content", "data"]) {
  if (options.dryRun) return;
  if (options.noGit) {
    console.log("Git commit/push skipped because --no-git was provided.");
    maybeVercel(options);
    return;
  }

  execFileSync("git", ["add", ...paths], { stdio: "inherit" });

  const status = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim();
  if (!status) {
    console.log("No changes to commit.");
    maybeVercel(options);
    return;
  }

  execFileSync("git", ["commit", "-m", message], { stdio: "inherit" });
  execFileSync("git", ["push"], { stdio: "inherit" });
  maybeVercel(options);
}

function maybeVercel(options) {
  if (options.noVercel) {
    console.log("Vercel deploy skipped because --no-vercel was provided.");
    return;
  }

  const vercel = findCommand("vercel");
  if (!vercel) {
    throw new Error("Vercel deploy requested, but the Vercel CLI was not found. Install it with `npm i -g vercel`, or re-run with --no-vercel.");
  }

  execFileSync(vercel, ["--prod", "--yes"], { stdio: "inherit" });
}

function ensureGitReady() {
  try {
    execFileSync("git", ["rev-parse", "--is-inside-work-tree"], { stdio: "pipe" });
  } catch {
    throw new Error("Git push requested, but this folder is not a Git repository. Re-run with --no-git or initialize/link the repository first.");
  }

  try {
    execFileSync("git", ["remote", "get-url", "origin"], { stdio: "pipe" });
  } catch {
    throw new Error("Git push requested, but no origin remote is configured. Re-run with --no-git or add a GitHub origin first.");
  }
}

function validateArticleMetadata(metadata) {
  const required = ["type", "category", "name", "shortDescription", "description"];
  required.forEach((key) => {
    if (!metadata[key] || typeof metadata[key] !== "string") {
      throw new Error(`article.json must include string field "${key}".`);
    }
  });

  enforceMaxLength(metadata.type, limits.article.type, "article.json type");
  enforceMaxLength(metadata.category, limits.article.category, "article.json category");
  enforceMaxLength(metadata.name, limits.article.name, "article.json name");
  enforceMaxLength(metadata.shortDescription, limits.article.shortDescription, "article.json shortDescription");
  enforceMaxLength(metadata.description, limits.article.description, "article.json description");

  if (!validTypes.has(metadata.type)) {
    throw new Error(`article.json type must be one of: ${Array.from(validTypes).join(", ")}.`);
  }

  if (!Array.isArray(metadata.keywords)) {
    throw new Error('article.json must include "keywords" as an array of strings.');
  }

  if (metadata.keywords.length > limits.article.keywords) {
    throw new Error(`article.json "keywords" must contain at most ${limits.article.keywords} items.`);
  }

  metadata.keywords.forEach((keyword) => {
    if (!keyword || typeof keyword !== "string") {
      throw new Error('article.json "keywords" must contain only non-empty strings.');
    }
    enforceMaxLength(keyword, limits.article.keyword, "article.json keyword");
  });
}

function validateCategoryMetadata(metadata) {
  if (!metadata.name || typeof metadata.name !== "string") {
    throw new Error('Category JSON must include string field "name".');
  }

  if (typeof metadata.description !== "string") {
    throw new Error('Category JSON must include string field "description".');
  }

  enforceMaxLength(metadata.name, limits.category.name, "Category name");
  enforceMaxLength(metadata.description, limits.category.description, "Category description");
}

function normalizeArticleMetadata(metadata) {
  const normalized = { ...metadata };
  if (!normalized.keywords && Array.isArray(normalized["key words"])) {
    normalized.keywords = normalized["key words"];
  }
  delete normalized["key words"];
  if (!normalized.keywords) {
    normalized.keywords = [];
  }
  return normalized;
}

function findNamedFile(directory, baseName, ignoredPrefixes) {
  if (!fs.existsSync(directory)) {
    throw new Error(`Directory not found: ${directory}`);
  }

  const matches = fs.readdirSync(directory)
    .filter((name) => !name.startsWith("."))
    .filter((name) => path.basename(name, path.extname(name)) === baseName)
    .filter((name) => !ignoredPrefixes.some((prefix) => name.startsWith(prefix)))
    .map((name) => path.join(directory, name));

  if (matches.length !== 1) {
    throw new Error(`Expected exactly one ${baseName} file in ${directory}.`);
  }

  return matches[0];
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`JSON file not found: ${filePath}`);
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Invalid JSON in ${filePath}: ${error.message}`);
  }
}

function resolveRequiredPath(value, message) {
  if (!value) throw new Error(message);
  return path.resolve(root, value);
}

function requireSlug(value, message) {
  if (!value) throw new Error(message);
  const slug = slugify(value);
  if (!slug) throw new Error(message);
  enforceMaxLength(slug, limits.category.slug, "Slug");
  return slug;
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
}

function toPublicPath(filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

function capitalize(value) {
  return String(value || "").charAt(0).toUpperCase() + String(value || "").slice(1);
}

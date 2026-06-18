(function () {
  const page = document.body.dataset.page;

  if (page === "home") {
    initHome();
  }

  if (page === "article") {
    initArticlePage();
  }

  async function fetchJson(path) {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Unable to load ${path}`);
    }
    return response.json();
  }

  async function initHome() {
    const sectionsEl = document.getElementById("article-sections");
    const emptyEl = document.getElementById("empty-state");
    const searchInput = document.getElementById("article-search");
    const searchClear = document.querySelector(".search-clear");

    try {
      const [categories, articles] = await Promise.all([
        fetchJson("data/categories.json"),
        fetchJson("data/articles.json")
      ]);

      const render = () => {
        const query = searchInput.value.trim().toLowerCase();
        const filtered = articles.filter((article) => {
          if (!query) return true;
          const category = categories.find((item) => item.slug === article.category);
          const haystack = [
            article.name,
            article.shortDescription,
            article.description,
            article.category,
            category && category.name,
            ...(Array.isArray(article.keywords) ? article.keywords : [])
          ].filter(Boolean).join(" ").toLowerCase();
          return haystack.includes(query);
        });

        renderSections(sectionsEl, categories, filtered, { showEmptyCategories: !query });
        emptyEl.hidden = filtered.length !== 0;
        if (searchClear) searchClear.hidden = query.length === 0;
      };

      searchInput.addEventListener("input", render);
      if (searchClear) {
        searchClear.addEventListener("click", () => {
          searchInput.value = "";
          searchInput.focus();
          render();
        });
      }
      render();
    } catch (error) {
      sectionsEl.innerHTML = `<p class="status-message">${escapeHtml(error.message)}</p>`;
    }
  }

  function renderSections(container, categories, articles, { showEmptyCategories = false } = {}) {
    container.innerHTML = "";

    categories.forEach((category) => {
      const categoryArticles = articles.filter((article) => article.category === category.slug);
      if (categoryArticles.length === 0 && !showEmptyCategories) return;

      const section = document.createElement("section");
      section.className = "category-section";
      section.innerHTML = `
        <header class="category-header">
          <h2>${escapeHtml(category.name)}</h2>
          ${category.description ? `<p>${escapeHtml(category.description)}</p>` : ""}
        </header>
        ${categoryArticles.length > 0 ? `
          <div class="article-grid">
            ${categoryArticles.map(renderArticleCard).join("")}
          </div>
        ` : ""}
      `;
      container.appendChild(section);
    });
  }

  function renderArticleCard(article) {
    const coverPath = article.coverPreviewPath || article.coverPath;
    return `
      <article class="article-card">
        <a class="article-cover-link" href="article.html?id=${encodeURIComponent(article.slug)}" aria-label="Open ${escapeHtml(article.name)}">
          <img src="${escapeAttribute(coverPath)}" alt="">
        </a>
        <div class="article-meta-row">
          <p class="article-short">${escapeHtml(article.shortDescription || article.name)}</p>
          <a class="download-dot" href="${escapeAttribute(article.contentPath)}" download aria-label="Download ${escapeHtml(article.name)}">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 6.5v11m0 0 5-5m-5 5-5-5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
          </a>
        </div>
      </article>
    `;
  }

  async function initArticlePage() {
    const target = document.getElementById("article-detail");
    const slug = new URLSearchParams(window.location.search).get("id");

    if (!slug) {
      target.innerHTML = '<p class="status-message">Article missing.</p>';
      return;
    }

    try {
      const articles = await fetchJson("data/articles.json");
      const article = articles.find((item) => item.slug === slug);
      if (!article) {
        target.innerHTML = '<p class="status-message">Article not found.</p>';
        return;
      }

      document.title = `${article.name} - Cognitive Shift`;
      target.innerHTML = renderArticleDetail(article);

      if (article.type === "md") {
        const markdownTarget = target.querySelector("[data-markdown-target]");
        const response = await fetch(article.contentPath, { cache: "no-store" });
        markdownTarget.innerHTML = response.ok
          ? markdownToHtml(await response.text())
          : "<p>Markdown preview unavailable.</p>";
      }
    } catch (error) {
      target.innerHTML = `<p class="status-message">${escapeHtml(error.message)}</p>`;
    }
  }

  function renderArticleDetail(article) {
    const coverPath = article.coverPreviewPath || article.coverPath;
    return `
      <article class="article-layout" data-article-type="${escapeAttribute(article.type)}">
        <div class="article-media">
          ${renderViewer(article)}
        </div>
        <aside class="article-sidebar">
          <img class="article-sidebar-cover" src="${escapeAttribute(coverPath)}" alt="">
          <h1>${escapeHtml(article.name)}</h1>
          <p>${escapeHtml(article.description || article.shortDescription || "")}</p>
          <a class="download-button" href="${escapeAttribute(article.contentPath)}" download>download</a>
        </aside>
      </article>
    `;
  }

  function renderViewer(article) {
    if (article.type === "pdf") {
      const pdfSrc = `${article.contentPath}#toolbar=0&navpanes=0&scrollbar=0&view=FitH&pagemode=none`;
      return `
        <div class="pdf-viewer-shell">
          <iframe class="viewer-frame" src="${escapeAttribute(pdfSrc)}" title="${escapeAttribute(article.name)} PDF"></iframe>
        </div>
      `;
    }

    if (article.type === "md") {
      return '<div class="markdown-preview" data-markdown-target><p>Loading markdown...</p></div>';
    }

    return `
      <div class="file-preview">
        <p>This document type is available as a download.</p>
        <p><a href="${escapeAttribute(article.contentPath)}" download>Download ${escapeHtml(article.name)}</a></p>
      </div>
    `;
  }

  function markdownToHtml(markdown) {
    const lines = markdown.replace(/\r\n/g, "\n").split("\n");
    let html = "";
    let inList = false;

    lines.forEach((line) => {
      if (/^\s*[-*]\s+/.test(line)) {
        if (!inList) {
          html += "<ul>";
          inList = true;
        }
        html += `<li>${escapeHtml(line.replace(/^\s*[-*]\s+/, ""))}</li>`;
        return;
      }

      if (inList) {
        html += "</ul>";
        inList = false;
      }

      if (/^###\s+/.test(line)) {
        html += `<h3>${escapeHtml(line.replace(/^###\s+/, ""))}</h3>`;
      } else if (/^##\s+/.test(line)) {
        html += `<h2>${escapeHtml(line.replace(/^##\s+/, ""))}</h2>`;
      } else if (/^#\s+/.test(line)) {
        html += `<h1>${escapeHtml(line.replace(/^#\s+/, ""))}</h1>`;
      } else if (line.trim()) {
        html += `<p>${escapeHtml(line)}</p>`;
      }
    });

    if (inList) html += "</ul>";
    return html || "<p>No markdown content.</p>";
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
  }
})();

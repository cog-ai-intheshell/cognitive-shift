(function () {
  const page = document.body.dataset.page;

  if (page === "home") {
    initHome();
  }

  if (page === "article") {
    initArticlePage();
  }

  if (page === "library") {
    initLibraryPage();
  }

  if (page === "updates") {
    initUpdatesPage();
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

      renderSections(sectionsEl, categories, articles, { showEmptyCategories: true });

      const allFilterLink = document.querySelector(".category-filter-all");
      const categoryLinks = Array.from(document.querySelectorAll(".category-nav a:not(.category-filter-all)"));
      const categoryIds = new Set(categoryLinks.map((link) => link.getAttribute("href").slice(1)));
      const libraryToolbar = document.querySelector(".library-toolbar");
      const toolbarSpacer = document.querySelector(".library-toolbar-spacer");
      let toolbarFlowHeight = 0;
      let toolbarThreshold = 0;
      let isSearchMode = false;
      let activeSearchCategory = "all";

      const measureToolbar = () => {
        const toolbarStyle = getComputedStyle(libraryToolbar);
        toolbarFlowHeight = libraryToolbar.getBoundingClientRect().height
          + parseFloat(toolbarStyle.marginTop || 0)
          + parseFloat(toolbarStyle.marginBottom || 0);
        toolbarThreshold = libraryToolbar.getBoundingClientRect().top + window.scrollY;
      };

      const syncSearchCategory = () => {
        if (!isSearchMode) return;
        allFilterLink.classList.toggle("is-active", activeSearchCategory === "all");
        categoryLinks.forEach((link) => {
          link.classList.toggle("is-active", link.getAttribute("href") === `#${activeSearchCategory}`);
        });
      };

      const updateActiveCategory = () => {
        const shouldStick = window.scrollY >= toolbarThreshold;
        libraryToolbar.classList.toggle("is-stuck", shouldStick);
        toolbarSpacer.style.height = shouldStick ? `${toolbarFlowHeight}px` : "0px";

        if (isSearchMode) {
          syncSearchCategory();
          return;
        }

        let activeId = categoryLinks[0].getAttribute("href").slice(1);
        sectionsEl.querySelectorAll(".category-section").forEach((section) => {
          if (categoryIds.has(section.id) && section.getBoundingClientRect().top <= 110) activeId = section.id;
        });
        categoryLinks.forEach((link) => {
          link.classList.toggle("is-active", link.getAttribute("href") === `#${activeId}`);
        });
      };

      const recalculateToolbar = ({ preservePosition = false } = {}) => {
        const wasSticky = libraryToolbar.classList.contains("is-stuck");
        const previousThreshold = toolbarThreshold;

        libraryToolbar.classList.remove("is-stuck");
        toolbarSpacer.style.height = "0px";
        measureToolbar();

        if (preservePosition && wasSticky && previousThreshold) {
          window.scrollBy({ top: toolbarThreshold - previousThreshold, behavior: "auto" });
          measureToolbar();
        }

        updateActiveCategory();
      };

      const applySearchVisibility = () => {
        const query = searchInput.value.trim().toLowerCase();
        const visibleSections = [];

        sectionsEl.querySelectorAll(".category-section").forEach((section) => {
          section.classList.remove("is-search-first");

          if (section.id === "project-management") {
            section.hidden = true;
            return;
          }

          const matchesCategory = activeSearchCategory === "all" || section.id === activeSearchCategory;
          const matchesQuery = !query || section.textContent.toLowerCase().includes(query);
          const shouldShow = matchesCategory && matchesQuery;
          section.hidden = !shouldShow;
          if (shouldShow) visibleSections.push(section);
        });

        if (visibleSections[0]) visibleSections[0].classList.add("is-search-first");
        emptyEl.hidden = visibleSections.length !== 0;
        searchClear.hidden = false;
        syncSearchCategory();
      };

      const enterSearchMode = () => {
        if (isSearchMode) return;
        isSearchMode = true;
        activeSearchCategory = "all";
        document.body.classList.add("is-search-mode");
        allFilterLink.hidden = false;
        applySearchVisibility();
        recalculateToolbar({ preservePosition: true });
      };

      const exitSearchMode = () => {
        if (!isSearchMode) return;
        isSearchMode = false;
        activeSearchCategory = "all";
        searchInput.value = "";
        document.body.classList.remove("is-search-mode");
        allFilterLink.hidden = true;
        allFilterLink.classList.remove("is-active");
        sectionsEl.querySelectorAll(".category-section").forEach((section) => {
          section.hidden = false;
          section.classList.remove("is-search-first");
        });
        emptyEl.hidden = true;
        searchClear.hidden = true;
        recalculateToolbar({ preservePosition: true });
        updateActiveCategory();
      };

      searchInput.addEventListener("focus", enterSearchMode);
      searchInput.addEventListener("input", () => {
        if (!isSearchMode) enterSearchMode();
        applySearchVisibility();
      });
      searchInput.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        exitSearchMode();
        searchInput.blur();
      });

      searchClear.addEventListener("click", () => {
        if (searchInput.value) {
          searchInput.value = "";
          activeSearchCategory = "all";
          applySearchVisibility();
          searchInput.focus();
          return;
        }

        exitSearchMode();
        searchInput.blur();
      });

      allFilterLink.addEventListener("click", (event) => {
        if (!isSearchMode) return;
        event.preventDefault();
        activeSearchCategory = "all";
        searchInput.value = "";
        applySearchVisibility();
      });

      categoryLinks.forEach((link) => link.addEventListener("click", (event) => {
        if (isSearchMode) {
          event.preventDefault();
          activeSearchCategory = link.getAttribute("href").slice(1);
          searchInput.value = "";
          applySearchVisibility();
          return;
        }

        categoryLinks.forEach((item) => item.classList.toggle("is-active", item === link));
      }));

      measureToolbar();
      window.addEventListener("scroll", updateActiveCategory, { passive: true });
      window.addEventListener("resize", () => {
        recalculateToolbar();
      }, { passive: true });
      updateActiveCategory();
    } catch (error) {
      sectionsEl.innerHTML = `<p class="status-message">${escapeHtml(error.message)}</p>`;
    }
  }

  function renderSections(container, categories, articles, { showEmptyCategories = false } = {}) {
    const libraryToolbar = document.querySelector(".library-toolbar");
    let toolbarSpacer = document.querySelector(".library-toolbar-spacer");
    if (!toolbarSpacer) {
      toolbarSpacer = document.createElement("div");
      toolbarSpacer.className = "library-toolbar-spacer";
      toolbarSpacer.setAttribute("aria-hidden", "true");
    }
    if (libraryToolbar && container.contains(libraryToolbar)) libraryToolbar.remove();
    if (container.contains(toolbarSpacer)) toolbarSpacer.remove();
    container.innerHTML = "";
    let toolbarPlaced = false;

    const designCategories = getDesignCategories();

    designCategories.forEach((designCategory, categoryIndex) => {
      const source = categories.find((item) => item.slug === designCategory.slug) || {};
      const category = { ...source, ...designCategory };
      const queryHasResults = showEmptyCategories || articles.length > 0;
      if (!queryHasResults) return;

      const section = document.createElement("section");
      section.id = category.slug;
      section.className = `category-section category-section--${category.slug}${category.featured ? " category-section--featured" : ""}`;
      section.innerHTML = `
        <div class="category-inner">
          <header class="category-header">
            <h2>${escapeHtml(category.name)}</h2>
            ${category.description ? `<p>${escapeHtml(category.description)}</p>` : ""}
          </header>
          <div class="article-grid">
            ${Array.from({ length: category.cardCount || 8 }, (_, index) => renderDesignCard(category, index)).join("")}
          </div>
          <a class="see-all-link section-link" href="library.html?category=${encodeURIComponent(category.slug)}">see more</a>
        </div>
      `;
      container.appendChild(section);
      if (categoryIndex === 0 && libraryToolbar) {
        container.appendChild(toolbarSpacer);
        container.appendChild(libraryToolbar);
        toolbarPlaced = true;
      }
    });

    if (libraryToolbar && !toolbarPlaced) {
      container.appendChild(toolbarSpacer);
      container.appendChild(libraryToolbar);
    }
  }

  function getDesignCategories() {
    return [
      { slug: "project-management", name: "Project Management", cardCount: 5 },
      { slug: "agent-library", name: "Agent library" },
      { slug: "code-library", name: "Code Library" },
      { slug: "knowledge-library", name: "Knowledge Librairy" },
      { slug: "mcp-library", name: "MCP Library" },
      { slug: "model-library", name: "Model Library" },
      {
        slug: "ios-ready",
        name: "iOS Librairy",
        featured: true,
        description: "Lean Design reduces every application to its core value moment: the screen that creates understanding, the action that validates the use case, and the metric that determines what happens next."
      }
    ];
  }

  function renderDesignCard(category, index, { uniform = false } = {}) {
    const isHero = !uniform && category.slug === "project-management" && index === 0;
    const searchText = `${category.name} lorem ipsum item ${index + 1}`.toLowerCase();
    return `
      <article class="article-card design-card${isHero ? " design-card--hero" : ""}" data-search="${escapeAttribute(searchText)}" aria-label="${escapeAttribute(category.name)} example ${index + 1}">
        <div class="article-cover-link design-card-cover">
          <img src="assets/library-card-cover.png" alt="">
          <div class="design-card-label" aria-hidden="true">
            <span class="design-card-mark"></span>
            <strong>Lorem</strong>
            <span>Ipsum exfrasis</span>
          </div>
        </div>
        <div class="article-meta-row">
          <p class="article-short">lorem ipsum</p>
          <a class="download-dot" href="assets/library-card-cover.png" download aria-label="Download ${escapeAttribute(category.name)} example ${index + 1}">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 6.5v11m0 0 5-5m-5 5-5-5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
          </a>
        </div>
      </article>
    `;
  }

  async function initLibraryPage() {
    const titleEl = document.getElementById("library-page-title");
    const descriptionEl = document.getElementById("library-page-description");
    const gridEl = document.getElementById("library-page-grid");
    const emptyEl = document.getElementById("library-page-empty");
    const searchInput = document.getElementById("library-search");
    const searchClear = document.querySelector(".library-search-clear");
    const slug = new URLSearchParams(window.location.search).get("category");

    try {
      const categories = await fetchJson("data/categories.json");
      const designCategory = getDesignCategories().find((item) => item.slug === slug);

      if (!designCategory) {
        document.title = "Library not found - Cognitive Shift";
        titleEl.textContent = "Library not found";
        descriptionEl.textContent = "This library does not exist or is no longer available.";
        gridEl.hidden = true;
        searchInput.closest(".library-search-pill").hidden = true;
        return;
      }

      const source = categories.find((item) => item.slug === designCategory.slug) || {};
      const category = { ...source, ...designCategory };
      const fallbackDescription = "Cognitive shift is an independant platform built on continuous exposure to advanced AI research from MIT and the latest industry practices from leading Silicon Valley companies, transforming complex ideas into directly applicable frameworks.";

      document.title = `${category.name} - Cognitive Shift`;
      titleEl.textContent = category.name;
      descriptionEl.textContent = category.description || fallbackDescription;
      gridEl.innerHTML = Array.from(
        { length: 16 },
        (_, index) => renderDesignCard(category, index, { uniform: true })
      ).join("");

      const filterCards = () => {
        const query = searchInput.value.trim().toLowerCase();
        let visibleCount = 0;

        gridEl.querySelectorAll(".article-card").forEach((card) => {
          const isVisible = !query || card.dataset.search.includes(query);
          card.hidden = !isVisible;
          if (isVisible) visibleCount += 1;
        });

        emptyEl.hidden = visibleCount !== 0;
        searchClear.hidden = query.length === 0;
      };

      searchInput.addEventListener("input", filterCards);
      searchClear.addEventListener("click", () => {
        searchInput.value = "";
        searchInput.focus();
        filterCards();
      });
      filterCards();
    } catch (error) {
      gridEl.innerHTML = `<p class="status-message">${escapeHtml(error.message)}</p>`;
    }
  }

  function initUpdatesPage() {
    const groupsEl = document.getElementById("updates-groups");
    const historyNav = document.getElementById("updates-history-nav");
    const emptyEl = document.getElementById("updates-empty");
    const searchInput = document.getElementById("updates-search-input");
    const searchClear = document.querySelector(".updates-search-clear");
    const filterButtons = Array.from(document.querySelectorAll("[data-update-filter]"));
    const libraryNames = new Map(
      getDesignCategories()
        .filter((category) => category.slug !== "project-management")
        .map((category) => [category.slug, category.name])
    );
    const categorySequence = [
      "agent-library",
      "code-library",
      "knowledge-library",
      "mcp-library",
      "model-library",
      "ios-ready"
    ];
    const updateGroups = [
      { id: "updates-17-jun", date: "17 Jun", title: "This week", count: 10 },
      { id: "updates-10-jun", date: "10 Jun", title: "Previous week", count: 8 },
      { id: "updates-03-jun", date: "03 Jun", title: "Earlier", count: 7 }
    ];
    let activeFilter = "all";

    groupsEl.innerHTML = updateGroups.map((group, groupIndex) => {
      const cards = Array.from({ length: group.count }, (_, cardIndex) => {
        const categorySlug = categorySequence[(groupIndex * 2 + cardIndex) % categorySequence.length];
        const categoryName = libraryNames.get(categorySlug) || "Library";
        return renderUpdateCard({ categorySlug, categoryName, date: group.date }, cardIndex);
      }).join("");

      return `
        <section class="updates-group" id="${escapeAttribute(group.id)}" data-history-date="${escapeAttribute(group.date)}">
          <header class="updates-group-header">
            <h2>${escapeHtml(group.title)}</h2>
            <p>${escapeHtml(group.date)} · ${group.count} new blocks</p>
          </header>
          <div class="updates-grid">${cards}</div>
        </section>
      `;
    }).join("");

    historyNav.innerHTML = updateGroups.map((group, index) => `
      <a class="${index === 0 ? "is-active" : ""}" href="#${escapeAttribute(group.id)}" data-history-target="${escapeAttribute(group.id)}">${escapeHtml(group.date)}</a>
    `).join("");

    const syncFilters = () => {
      filterButtons.forEach((button) => {
        const isActive = button.dataset.updateFilter === activeFilter;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
      });
    };

    const updateActiveHistory = () => {
      const visibleGroups = Array.from(groupsEl.querySelectorAll(".updates-group:not([hidden])"));
      if (!visibleGroups.length) return;
      let activeId = visibleGroups[0].id;
      visibleGroups.forEach((group) => {
        if (group.getBoundingClientRect().top <= 150) activeId = group.id;
      });
      historyNav.querySelectorAll("[data-history-target]").forEach((link) => {
        link.classList.toggle("is-active", link.dataset.historyTarget === activeId);
      });
    };

    const applyFilters = () => {
      const query = searchInput.value.trim().toLowerCase();
      let totalVisible = 0;

      groupsEl.querySelectorAll(".updates-group").forEach((group) => {
        let groupVisible = 0;
        group.querySelectorAll(".article-card").forEach((card) => {
          const matchesCategory = activeFilter === "all" || card.dataset.category === activeFilter;
          const matchesQuery = !query || card.dataset.search.includes(query);
          const shouldShow = matchesCategory && matchesQuery;
          card.hidden = !shouldShow;
          if (shouldShow) groupVisible += 1;
        });
        group.hidden = groupVisible === 0;
        totalVisible += groupVisible;
        const historyLink = historyNav.querySelector(`[data-history-target="${group.id}"]`);
        if (historyLink) historyLink.hidden = groupVisible === 0;
      });

      emptyEl.hidden = totalVisible !== 0;
      searchClear.hidden = query.length === 0;
      syncFilters();
      updateActiveHistory();
    };

    filterButtons.forEach((button) => {
      button.addEventListener("click", () => {
        activeFilter = button.dataset.updateFilter;
        applyFilters();
      });
    });

    searchInput.addEventListener("input", applyFilters);
    searchClear.addEventListener("click", () => {
      searchInput.value = "";
      searchInput.focus();
      applyFilters();
    });

    historyNav.querySelectorAll("[data-history-target]").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const target = document.getElementById(link.dataset.historyTarget);
        if (target && !target.hidden) target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    window.addEventListener("scroll", updateActiveHistory, { passive: true });
    applyFilters();
  }

  function renderUpdateCard({ categorySlug, categoryName, date }, index) {
    const searchText = `${categoryName} ${categorySlug} ${date} lorem ipsum block ${index + 1}`.toLowerCase();
    return `
      <article class="article-card design-card" data-category="${escapeAttribute(categorySlug)}" data-search="${escapeAttribute(searchText)}" aria-label="${escapeAttribute(categoryName)} update ${index + 1}">
        <div class="article-cover-link design-card-cover">
          <img src="assets/library-card-cover.png" alt="">
          <div class="design-card-label" aria-hidden="true">
            <span class="design-card-mark"></span>
            <strong>Lorem</strong>
            <span>Ipsum exfrasis</span>
          </div>
        </div>
        <div class="article-meta-row">
          <p class="article-short">lorem ipsum</p>
          <a class="download-dot" href="assets/library-card-cover.png" download aria-label="Download ${escapeAttribute(categoryName)} update ${index + 1}">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 6.5v11m0 0 5-5m-5 5-5-5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
          </a>
        </div>
      </article>
    `;
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

      const contentKind = getContentKind(article);

      document.title = `${article.name} - Cognitive Shift`;
      target.innerHTML = renderArticleDetail(article, contentKind);

      if (contentKind === "md") {
        const markdownTarget = target.querySelector("[data-markdown-target]");
        const response = await fetch(article.contentPath, { cache: "no-store" });
        markdownTarget.textContent = response.ok
          ? await response.text()
          : "Markdown preview unavailable.";
      }
    } catch (error) {
      target.innerHTML = `<p class="status-message">${escapeHtml(error.message)}</p>`;
    }
  }

  function renderArticleDetail(article, contentKind) {
    const coverPath = article.coverPreviewPath || article.coverPath;
    return `
      <article class="article-layout" data-article-type="${escapeAttribute(contentKind)}" data-content-kind="${escapeAttribute(contentKind)}">
        <div class="article-media">
          ${renderViewer(article, contentKind)}
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

  function renderViewer(article, contentKind) {
    if (contentKind === "pdf") {
      const pdfSrc = `${article.contentPath}#toolbar=0&navpanes=0&scrollbar=0&view=FitH&pagemode=none`;
      return `
        <div class="pdf-viewer-shell">
          <iframe class="viewer-frame" src="${escapeAttribute(pdfSrc)}" title="${escapeAttribute(article.name)} PDF"></iframe>
        </div>
      `;
    }

    if (contentKind === "md") {
      return '<pre class="markdown-preview" data-markdown-target>Loading markdown...</pre>';
    }

    if (contentKind === "folder") {
      return `
        <div class="file-preview file-preview--folder">
          <span class="folder-preview-icon" aria-hidden="true"></span>
          <p>no preview available</p>
        </div>
      `;
    }

    return `
      <div class="file-preview">
        <p>This document type is available as a download.</p>
        <p><a href="${escapeAttribute(article.contentPath)}" download>Download ${escapeHtml(article.name)}</a></p>
      </div>
    `;
  }

  function getContentKind(article) {
    const contentPath = String(article.contentPath || "").split(/[?#]/)[0].replace(/\/+$/, "").toLowerCase();
    const declaredType = String(article.type || "").toLowerCase();

    if (contentPath.endsWith(".pdf")) return "pdf";
    if (contentPath.endsWith(".md")) return "md";
    if (contentPath.endsWith("/content") || contentPath === "content") return "folder";
    if (declaredType === "pdf" || declaredType === "md" || declaredType === "folder") return declaredType;
    return declaredType || "file";
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

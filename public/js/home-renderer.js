import { escapeHtml, showToast } from "./utils.js";

const tabs = [
  ["announcements", "公告"],
  ["prices", "价目表"],
  ["companions", "陪陪音卡"],
  ["trial", "趣味单游戏区"],
  ["rights", "老板须知"],
  ["about", "关于"]
];

export class HomeRenderer {
  constructor(data) {
    const announcements = Array.isArray(data.announcements)
      ? data.announcements
      : (data.announcement ? [data.announcement] : []);
    this.data = {
      ...data,
      announcements,
      rights: (data.rights || []).map((item) => typeof item === "string"
        ? { title: item, body: "这里是老板须知占位内容。后续可替换为图片、文字规则或完整说明。", imageUrl: "", fileUrl: "" }
        : item)
    };
    this.brand = {
      siteName: data.brand?.siteName || "雪烬电竞",
      tagline: data.brand?.tagline || "霜火集结，开局即燃",
      logoUrl: data.brand?.logoUrl || "./assets/xuejin-logo.jpg",
      contactHours: data.brand?.contactHours || "营业时间: 待填写",
      contactChannel: data.brand?.contactChannel || "联系渠道: 待填写",
      footerText: data.brand?.footerText || "雪烬电竞 · 独立门户"
    };
    this.state = { tab: "announcements", slide: 0, priceCat: "mobile", soundCat: "" };
    this.content = document.querySelector("#content");
    this.modal = document.querySelector("#modal");
    this.modalContent = document.querySelector("#modalContent");
    this.toast = document.querySelector("#toast");
  }

  init() {
    this.renderStaticContent();
    this.initTheme();
    this.initCarousel();
    this.renderTabs();
    this.render();
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !this.modal.hidden) this.closeModal();
    });
    this.modal.addEventListener("click", (event) => {
      if (event.target.hasAttribute("data-close-modal")) this.closeModal();
    });
  }

  renderStaticContent() {
    document.title = this.brand.siteName;
    const logo = document.querySelector("#brandLogo");
    logo.src = this.brand.logoUrl;
    logo.alt = this.brand.siteName;
    document.querySelector("#brandName").textContent = this.brand.siteName;
    document.querySelector("#brandTagline").textContent = this.brand.tagline;
    document.querySelector("#contactHours").textContent = this.brand.contactHours;
    document.querySelector("#contactChannel").textContent = this.brand.contactChannel;
    document.querySelector("#footerText").textContent = this.brand.footerText;
  }

  initTheme() {
    document.documentElement.setAttribute("data-theme", "dark");
    localStorage.setItem("theme", "dark");
  }

  initCarousel() {
    const stage = document.querySelector("#carouselStage");
    const dots = document.querySelector("#carouselDots");
    stage.innerHTML = this.data.banners.map((item, index) => `
      <section class="slide ${index === 0 ? "active" : ""}">
        <div class="hero-card">
          <div class="hero-mark"><img src="${escapeHtml(this.brand.logoUrl)}" alt=""></div>
          <div class="hero-copy">
            <span>${escapeHtml(item.kicker)}</span>
            <strong>${escapeHtml(item.title)}</strong>
            <p>${escapeHtml(item.desc)}</p>
          </div>
          <div class="hero-chip">${escapeHtml(item.tag)}</div>
        </div>
      </section>
    `).join("");
    dots.innerHTML = this.data.banners.map((_, index) => `<button class="dot ${index === 0 ? "active" : ""}" type="button" data-slide="${index}" aria-label="第 ${index + 1} 张"></button>`).join("");
    document.querySelector(".prev").addEventListener("click", () => this.setSlide(this.state.slide - 1));
    document.querySelector(".next").addEventListener("click", () => this.setSlide(this.state.slide + 1));
    dots.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-slide]");
      if (btn) this.setSlide(Number(btn.dataset.slide));
    });
    setInterval(() => this.setSlide(this.state.slide + 1), 5000);
  }

  setSlide(index) {
    const total = this.data.banners.length;
    this.state.slide = (index + total) % total;
    document.querySelectorAll(".slide").forEach((el, i) => el.classList.toggle("active", i === this.state.slide));
    document.querySelectorAll(".dot").forEach((el, i) => el.classList.toggle("active", i === this.state.slide));
  }

  renderTabs() {
    const nav = document.querySelector("#tabs");
    nav.innerHTML = tabs.map(([key, label]) => `<button class="tab-btn ${key === this.state.tab ? "active" : ""}" type="button" data-tab="${key}">${label}</button>`).join("");
    nav.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-tab]");
      if (!btn) return;
      this.state.tab = btn.dataset.tab;
      nav.querySelectorAll(".tab-btn").forEach((el) => el.classList.toggle("active", el.dataset.tab === this.state.tab));
      this.render();
    });
  }

  render() {
    const views = {
      announcements: () => this.renderAnnouncements(),
      prices: () => this.renderPrices(),
      companions: () => this.renderCompanions(),
      trial: () => this.renderTrial(),
      rights: () => this.renderRights(),
      about: () => this.renderAbout()
    };
    this.content.innerHTML = views[this.state.tab]();
    this.bindViewEvents();
  }

  renderAnnouncements() {
    return `
      <section class="ann-list">
        ${this.data.announcements.map((ann, index) => `
          <article class="ann-row" data-announcement="${index}">
            <div class="ann-thumb brand-tile"><img src="${escapeHtml(ann.imageUrl || this.brand.logoUrl)}" alt=""></div>
            <div class="ann-body">
              <div class="ann-meta"><span class="badge">${index === 0 ? "置顶" : "公告"}</span><span class="badge ice">公告</span><span>${escapeHtml(ann.date)}</span></div>
              <div class="ann-title">${escapeHtml(ann.title)}</div>
              <p class="ann-summary">${escapeHtml(ann.summary)}</p>
            </div>
          </article>
        `).join("")}
      </section>
    `;
  }

  renderPrices() {
    const current = this.data.categories.find((cat) => cat.id === this.state.priceCat);
    return `
      <div class="price-layout">
        <aside class="side-nav">
          ${this.data.categories.map((cat) => `
            <button class="side-btn ${cat.id === this.state.priceCat ? "active" : ""}" type="button" data-price-cat="${cat.id}">
              <span class="side-dot" style="color:${cat.color}"></span><span>${escapeHtml(cat.name)}</span>
            </button>
          `).join("")}
        </aside>
        <section class="price-main">
          <div class="section-head">
            <span>${escapeHtml(current?.name || "价目表")}</span>
            <p>这里展示${escapeHtml(current?.name || "")}项目，后续可直接替换成正式内容。</p>
          </div>
          <div class="price-grid">
            ${this.data.prices.filter((item) => item.cat === this.state.priceCat).map((item) => this.renderPriceCard(item)).join("")}
          </div>
        </section>
      </div>
    `;
  }

  renderPriceCard(item) {
    const category = this.data.categories.find((cat) => cat.id === item.cat);
    return `
      <article class="price-card" data-price="${this.data.prices.indexOf(item)}">
        <div class="price-art ${item.imageUrl ? "with-media" : ""}">
          ${item.imageUrl ? `<img src="${escapeHtml(item.imageUrl)}" alt="">` : ""}
          <span>${escapeHtml(category?.name || "价目")}</span><strong>${escapeHtml(item.name)}</strong>
        </div>
        <div class="price-head">
          <div class="price-name">${escapeHtml(item.name)}</div>
          ${item.featured ? `<span class="badge ice">推荐</span>` : ""}
        </div>
        <div class="price-body">
          <div class="price-money">${escapeHtml(item.price)} <span>${escapeHtml(item.guarantee)}</span></div>
          <div class="tag-row">${(item.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
          ${item.note ? `<div class="note"><div class="note-title">说明</div>${escapeHtml(item.note).replaceAll("\n", "<br>")}</div>` : ""}
        </div>
      </article>
    `;
  }

  renderCompanions() {
    const cats = [...new Set(this.data.companions.map((item) => item.category).filter(Boolean))];
    const filtered = this.state.soundCat ? this.data.companions.filter((c) => c.category === this.state.soundCat) : this.data.companions;
    return `
      <div class="sound-tabs">
        <button class="pill ${this.state.soundCat === "" ? "active" : ""}" type="button" data-sound-cat="">全部</button>
        ${cats.map((cat) => `<button class="pill ${this.state.soundCat === cat ? "active" : ""}" type="button" data-sound-cat="${cat}">${cat}</button>`).join("")}
      </div>
      <section class="sound-grid">
        ${filtered.map((item) => `
          <article class="sound-card" data-companion="${this.data.companions.indexOf(item)}">
            <div class="sound-cover placeholder-cover"><img src="${escapeHtml(item.imageUrl || this.brand.logoUrl)}" alt=""><span class="recommend">${item.videoUrl ? "可播放" : "待上传"}</span></div>
            <div class="sound-body">
              <div class="sound-name"><span class="gender">${escapeHtml(item.gender)}</span>${escapeHtml(item.name)}</div>
              <p>${escapeHtml(item.level)}</p>
              <div class="tag-row">${item.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
            </div>
          </article>
        `).join("")}
      </section>
    `;
  }

  renderTrial() {
    return `
      <section class="trial-grid">
        ${this.data.games.map((game) => `
          <article class="trial-card ${game.href ? "ready" : "disabled"}" data-trial ${game.href ? `data-href="${escapeHtml(game.href)}"` : ""}>
            <div class="trial-cover game-placeholder ${game.imageUrl ? "with-media" : ""}">
              ${game.imageUrl ? `<img src="${escapeHtml(game.imageUrl)}" alt="">` : ""}
              <span>${escapeHtml(game.name)}</span>
            </div>
            <div class="trial-body">
              <div class="trial-name">${escapeHtml(game.name)}</div>
              <div class="trial-desc">${escapeHtml(game.desc)}</div>
            </div>
          </article>
        `).join("")}
      </section>
    `;
  }

  renderRights() {
    return `
      <section class="right-grid">
        ${this.data.rights.map((item) => `
          <article class="right-card" data-right="${this.data.rights.indexOf(item)}">
            <div class="right-placeholder ${item.imageUrl ? "with-media" : ""}">
              ${item.imageUrl ? `<img src="${escapeHtml(item.imageUrl)}" alt="">` : ""}
              <span>须知</span><strong>${escapeHtml(item.title)}</strong>
            </div>
          </article>
        `).join("")}
      </section>
    `;
  }

  renderAbout() {
    return `<section class="about-box">${escapeHtml(this.data.about)}</section>`;
  }

  bindViewEvents() {
    this.content.querySelectorAll("[data-price-cat]").forEach((btn) => btn.addEventListener("click", () => {
      this.state.priceCat = btn.dataset.priceCat;
      this.render();
    }));

    this.content.querySelectorAll("[data-sound-cat]").forEach((btn) => btn.addEventListener("click", () => {
      this.state.soundCat = btn.dataset.soundCat;
      this.render();
    }));

    this.content.querySelectorAll("[data-price]").forEach((card) => card.addEventListener("click", () => this.openPrice(this.data.prices[Number(card.dataset.price)])));
    this.content.querySelectorAll("[data-announcement]").forEach((ann) => ann.addEventListener("click", () => this.openAnnouncement(Number(ann.dataset.announcement))));
    this.content.querySelectorAll("[data-companion]").forEach((card) => card.addEventListener("click", () => this.openCompanion(this.data.companions[Number(card.dataset.companion)])));
    this.content.querySelectorAll("[data-trial]").forEach((card) => card.addEventListener("click", () => {
      if (card.dataset.href) {
        window.open(card.dataset.href, "_blank", "noopener");
        return;
      }
      showToast(this.toast, "试玩游戏入口已预留，具体游戏内容等待后续填充。");
    }));
    this.content.querySelectorAll("[data-right]").forEach((card) => card.addEventListener("click", () => this.openModal(`
      <div class="modal-inner">
        ${this.renderModalMedia(this.data.rights[Number(card.dataset.right)]?.fileUrl || this.data.rights[Number(card.dataset.right)]?.imageUrl)}
        <h2 id="modalTitle">${escapeHtml(this.data.rights[Number(card.dataset.right)]?.title || "老板须知")}</h2>
        <p>${escapeHtml(this.data.rights[Number(card.dataset.right)]?.body || "").replaceAll("\n", "<br>")}</p>
      </div>
    `)));
  }

  renderModalMedia(url) {
    if (!url) return "";
    if (/\.(mp4|webm|mov)(\?|#|$)/i.test(url)) {
      return `<video class="modal-media" src="${escapeHtml(url)}" controls></video>`;
    }
    return `<img class="modal-media" src="${escapeHtml(url)}" alt="">`;
  }

  openAnnouncement(index) {
    const ann = this.data.announcements[index] || this.data.announcements[0];
    const pieces = (ann.details || []).map((part) => `<p ${part.strong ? `class="strong-line"` : ""}>${escapeHtml(part.text)}</p>`).join("");
    this.openModal(`<div class="modal-inner">${this.renderModalMedia(ann.imageUrl)}<h2 id="modalTitle">${escapeHtml(ann.title)}</h2>${pieces}</div>`);
  }

  openPrice(item) {
    const category = this.data.categories.find((cat) => cat.id === item.cat);
    this.openModal(`
      <div class="modal-inner">
        ${this.renderModalMedia(item.imageUrl)}
        <h2 id="modalTitle">${escapeHtml(item.name)}</h2>
        <p>${escapeHtml(category?.name || "价目表")} · ${escapeHtml(item.price)} · ${escapeHtml(item.guarantee)}</p>
        ${(item.tags || []).length ? `<div class="tag-row modal-tags">${item.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
        ${item.note ? `<p>${escapeHtml(item.note).replaceAll("\n", "<br>")}</p>` : "<p>当前套餐详情待补充，可在后台继续填写备注内容。</p>"}
      </div>
    `);
  }

  openCompanion(item) {
    this.openModal(`
      <div class="modal-inner">
        ${this.renderModalMedia(item.videoUrl || item.imageUrl)}
        <h2 id="modalTitle">${escapeHtml(item.name)}</h2>
        <p>${escapeHtml(item.gender)} · ${escapeHtml(item.level)} · 成交 ${escapeHtml(item.orders)} 单</p>
        <p>${item.videoUrl ? "当前音卡视频已上传，可直接播放。" : "音卡视频暂未上传，后续可在后台补充。"}</p>
      </div>
    `);
  }

  openModal(html) {
    this.modalContent.innerHTML = html;
    this.modal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  closeModal() {
    this.modal.hidden = true;
    this.modalContent.innerHTML = "";
    document.body.style.overflow = "";
  }
}

(function () {
  document.documentElement.classList.add("js");
  const body = document.body;
  const csrfMeta = document.querySelector('meta[name="csrf-token"]');
  const csrfToken = csrfMeta ? csrfMeta.getAttribute("content") : "";
  const isLoggedIn = Boolean(window.CURRENT_USER);
  const catalog = Array.isArray(window.CATALOG_MINI) ? window.CATALOG_MINI : [];

  function showToast(message, type) {
    const container = document.querySelector(".toast-container") || createToastContainer();
    const toast = document.createElement("div");
    toast.className = "toast toast-" + (type || "success");
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(function () {
      toast.classList.add("fade");
      setTimeout(function () {
        toast.remove();
      }, 280);
    }, 5000);
  }

  function createToastContainer() {
    const container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
    return container;
  }

  function setTheme(theme) {
    body.setAttribute("data-theme", theme);
    localStorage.setItem("lux-theme", theme);
  }

  function initTheme() {
    const saved = localStorage.getItem("lux-theme") || "light";
    setTheme(saved);
    const toggle = document.querySelector("[data-theme-toggle]");
    if (!toggle) return;
    toggle.addEventListener("click", function () {
      const current = body.getAttribute("data-theme");
      setTheme(current === "dark" ? "light" : "dark");
    });
  }

  function initMobileMenu() {
    var btn = document.querySelector("[data-mobile-menu-toggle]");
    var nav = document.querySelector("[data-mobile-menu]");
    if (!btn || !nav) return;
    btn.addEventListener("click", function () {
      nav.classList.toggle("open");
      btn.classList.toggle("open");
    });
  }

  function initBackButton() {
    var backBtn = document.querySelector("[data-back-button]");
    if (!backBtn) return;
    backBtn.addEventListener("click", function () {
      var fromSameOrigin = document.referrer && document.referrer.startsWith(location.origin);
      if (window.history.length > 1 && fromSameOrigin) {
        window.history.back();
        return;
      }
      location.href = "/";
    });
  }

  function updateCartCount(nextCount) {
    var node = document.querySelector("[data-cart-count]");
    if (!node || typeof nextCount !== "number") return;
    node.textContent = "(" + nextCount + ")";
  }

  async function postForm(url, data) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Requested-With": "XMLHttpRequest",
        "Accept": "application/json",
      },
      body: new URLSearchParams(data),
    });
    const payload = await response.json().catch(function () {
      return { ok: false, message: "Unexpected server response." };
    });
    return { ok: response.ok && payload.ok !== false, payload: payload };
  }

  function initAjaxCartForms() {
    var forms = document.querySelectorAll("form[data-ajax-cart]");
    forms.forEach(function (form) {
      if (form.dataset.ajaxCartBound === "true") return;
      form.dataset.ajaxCartBound = "true";
      form.addEventListener("submit", async function (event) {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(form).entries());
        if (!data._csrf && csrfToken) data._csrf = csrfToken;
        const result = await postForm(form.action, data);
        if (!result.ok) {
          showToast(result.payload.message || "Could not add to cart.", "error");
          return;
        }
        if (typeof result.payload.cartCount === "number") {
          updateCartCount(result.payload.cartCount);
        }
        showToast(result.payload.message || "Added to cart.", "success");
      });
    });
  }

  function bindWishlistButton(btn) {
    btn.addEventListener("click", async function () {
      if (!isLoggedIn) {
        location.href = "/login";
        return;
      }
      const productId = btn.getAttribute("data-product-id");
      const color = btn.getAttribute("data-color") || "Default";
      const result = await postForm("/wishlist/toggle", {
        _csrf: csrfToken,
        productId: productId,
        color: color,
      });
      if (!result.ok) {
        showToast(result.payload.message || "Could not update wishlist.", "error");
        return;
      }
      const saved = result.payload.wishlisted || result.payload.action === "added";
      btn.classList.toggle("saved", saved);
      btn.textContent = saved ? "♥" : "♡";
      if (btn.classList.contains("wishlist-main-btn")) {
        btn.textContent = saved ? "♥ Saved" : "♡ Save to Wishlist";
      }
      showToast(result.payload.message || "Wishlist updated.", "success");
    });
  }

  function initWishlistToggles() {
    var buttons = document.querySelectorAll("[data-wishlist-toggle]");
    buttons.forEach(bindWishlistButton);
  }

  function initQuickView() {
    var triggers = document.querySelectorAll("[data-quick-view]");
    if (!triggers.length) return;

    var modal = document.createElement("div");
    modal.className = "modal quick-view-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML =
      '<div class="modal-content glass-card">' +
      '<button class="modal-close" type="button">x</button>' +
      '<div class="quick-view-layout">' +
      '<img alt="Preview" data-qv-image />' +
      '<div><h3 data-qv-name></h3><p class="price" data-qv-price></p><p data-qv-color></p>' +
      '<form action="/cart/add" method="post" data-ajax-cart><input type="hidden" name="_csrf" value="' + csrfToken + '" /><input type="hidden" name="productId" data-qv-id /><input type="hidden" name="color" data-qv-form-color /><input type="hidden" name="quantity" value="1" /><button class="button button-primary" type="submit">Add to Cart</button></form>' +
      '</div></div></div>';
    document.body.appendChild(modal);

    var close = modal.querySelector(".modal-close");
    close.addEventListener("click", function () {
      modal.classList.remove("open");
      modal.setAttribute("aria-hidden", "true");
    });

    triggers.forEach(function (trigger) {
      trigger.addEventListener("click", function () {
        modal.querySelector("[data-qv-image]").src = trigger.getAttribute("data-image");
        modal.querySelector("[data-qv-name]").textContent = trigger.getAttribute("data-name");
        modal.querySelector("[data-qv-price]").textContent = "N" + trigger.getAttribute("data-price");
        modal.querySelector("[data-qv-color]").textContent = "Color: " + trigger.getAttribute("data-color");
        modal.querySelector("[data-qv-id]").value = trigger.getAttribute("data-product-id");
        modal.querySelector("[data-qv-form-color]").value = trigger.getAttribute("data-color");
        modal.classList.add("open");
        modal.setAttribute("aria-hidden", "false");
      });
    });

    initAjaxCartForms();
  }

  function initHeroCarousel() {
    var slides = document.querySelectorAll("[data-testimonial-carousel] .carousel-slide");
    var dotsContainer = document.querySelector("[data-carousel-dots]");
    var nextBtn = document.querySelector("[data-carousel-next]");
    var prevBtn = document.querySelector("[data-carousel-prev]");
    if (!slides.length || !dotsContainer) return;

    var index = 0;
    slides.forEach(function (_, i) {
      var dot = document.createElement("button");
      dot.className = "dot" + (i === 0 ? " active" : "");
      dot.type = "button";
      dot.addEventListener("click", function () {
        index = i;
        update();
      });
      dotsContainer.appendChild(dot);
    });

    function update() {
      var dots = dotsContainer.querySelectorAll(".dot");
      slides.forEach(function (slide, i) {
        slide.classList.toggle("active", i === index);
      });
      dots.forEach(function (dot, i) {
        dot.classList.toggle("active", i === index);
      });
    }

    function move(step) {
      index += step;
      if (index < 0) index = slides.length - 1;
      if (index >= slides.length) index = 0;
      update();
    }

    if (nextBtn) nextBtn.addEventListener("click", function () { move(1); });
    if (prevBtn) prevBtn.addEventListener("click", function () { move(-1); });
    setInterval(function () { move(1); }, 5200);
  }

  function initReviewCarousel() {
    var track = document.querySelector("[data-review-carousel]");
    if (!track) return;
    var canRun = window.matchMedia("(max-width: 900px)").matches;
    if (!canRun) return;
    var x = 0;
    setInterval(function () {
      x = x <= -66 ? 0 : x - 33;
      track.style.transform = "translateX(" + x + "%)";
    }, 4200);
  }

  function initReveals() {
    var elements = document.querySelectorAll("[data-reveal]");
    if (!elements.length) return;

    function isNearViewport(node) {
      var rect = node.getBoundingClientRect();
      var viewHeight = window.innerHeight || document.documentElement.clientHeight;
      return rect.top <= viewHeight * 0.92 && rect.bottom >= viewHeight * 0.08;
    }

    elements.forEach(function (node) {
      node.classList.add("reveal-ready");
    });

    if (typeof IntersectionObserver !== "function") {
      elements.forEach(function (node) {
        node.classList.add("visible");
      });
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.16 });
    elements.forEach(function (node) {
      if (isNearViewport(node)) {
        node.classList.add("visible");
        return;
      }
      observer.observe(node);
    });
  }

  function initSearch() {
    var shell = document.querySelector("[data-live-search]");
    var input = document.querySelector("[data-search-input]");
    var panel = document.querySelector("[data-search-results]");
    if (!shell || !input || !panel) return;

    input.addEventListener("input", function () {
      var value = input.value.trim().toLowerCase();
      if (!value) {
        panel.innerHTML = "";
        shell.classList.remove("open");
        return;
      }
      var matches = catalog.filter(function (item) {
        return item.name.toLowerCase().includes(value) || item.category.toLowerCase().includes(value);
      }).slice(0, 6);
      if (!matches.length) {
        panel.innerHTML = '<p class="search-empty">No matches found</p>';
        shell.classList.add("open");
        return;
      }
      panel.innerHTML = matches.map(function (item) {
        return '<a href="/product/' + item.id + '"><img src="' + item.image + '" alt="' + item.name + '" /><span><strong>' + item.name + '</strong><small>N' + Number(item.price).toFixed(2) + '</small></span></a>';
      }).join("");
      shell.classList.add("open");
    });

    document.addEventListener("click", function (event) {
      if (!shell.contains(event.target)) shell.classList.remove("open");
    });
  }

  function initProductPage() {
    if (!window.PRODUCT_COLORS || !Array.isArray(window.PRODUCT_COLORS)) return;
    var slideshow = document.getElementById("slideshow");
    var indicators = document.getElementById("indicators");
    var swatches = document.querySelectorAll(".color-swatch");
    var selectedColorInput = document.getElementById("selectedColor");
    var wishlistColorInput = document.getElementById("wishlistColor");
    var stickyBar = document.querySelector("[data-sticky-atc]");
    var stickyTrigger = document.querySelector("[data-sticky-source]");
    var stickySubmit = document.querySelector("[data-sticky-submit]");
    var openGuide = document.querySelector("[data-open-size-guide]");
    var closeGuide = document.querySelector("[data-close-size-guide]");
    var guideModal = document.getElementById("sizeGuideModal");

    var colorIndex = 0;
    var slideIndex = 0;

    function renderSlides() {
      var images = window.PRODUCT_COLORS[colorIndex].images;
      slideshow.innerHTML = images.map(function (src, i) {
        return '<div class="slide ' + (i === 0 ? 'active' : '') + '"><img src="' + src + '" alt="Product view" /></div>';
      }).join("") +
      '<button class="slide-nav prev" type="button">&#10094;</button><button class="slide-nav next" type="button">&#10095;</button>';

      indicators.innerHTML = images.map(function (_, i) {
        return '<button type="button" class="indicator ' + (i === 0 ? 'active' : '') + '" data-slide-index="' + i + '"></button>';
      }).join("");

      slideIndex = 0;
      bindSlideControls();
    }

    function getStockLabel(variant) {
      var qty = Number(variant.stock || 0);
      if (variant.availability === 'Out of Stock' || qty <= 0) return 'Out of Stock';
      if (qty < 5) return qty + ' unit' + (qty === 1 ? '' : 's') + ' left';
      return 'In Stock';
    }

    function updateSlides() {
      var slides = slideshow.querySelectorAll(".slide");
      var dots = indicators.querySelectorAll(".indicator");
      slides.forEach(function (slide, i) {
        slide.classList.toggle("active", i === slideIndex);
      });
      dots.forEach(function (dot, i) {
        dot.classList.toggle("active", i === slideIndex);
      });
    }

    function bindSlideControls() {
      var prev = slideshow.querySelector(".slide-nav.prev");
      var next = slideshow.querySelector(".slide-nav.next");
      if (prev) prev.addEventListener("click", function () {
        var total = window.PRODUCT_COLORS[colorIndex].images.length;
        slideIndex = (slideIndex - 1 + total) % total;
        updateSlides();
      });
      if (next) next.addEventListener("click", function () {
        var total = window.PRODUCT_COLORS[colorIndex].images.length;
        slideIndex = (slideIndex + 1) % total;
        updateSlides();
      });
      indicators.querySelectorAll(".indicator").forEach(function (dot) {
        dot.addEventListener("click", function () {
          slideIndex = Number(dot.getAttribute("data-slide-index"));
          updateSlides();
        });
      });
    }

    swatches.forEach(function (swatch) {
      swatch.addEventListener("click", function () {
        colorIndex = Number(swatch.getAttribute("data-color-index"));
        swatches.forEach(function (item) { item.classList.remove("active"); });
        swatch.classList.add("active");
        var nextColor = window.PRODUCT_COLORS[colorIndex].name;
        if (selectedColorInput) selectedColorInput.value = nextColor;
        if (wishlistColorInput) wishlistColorInput.value = nextColor;
        var wishBtn = document.querySelector(".wishlist-main-btn");
        if (wishBtn) wishBtn.setAttribute("data-color", nextColor);
        var nextLabel = getStockLabel(window.PRODUCT_COLORS[colorIndex]);
        var stockEl = document.getElementById("stockStatus");
        var addBtn = document.getElementById("addToCartBtn");
        if (stockEl) {
          stockEl.textContent = nextLabel;
          stockEl.className = "stock-info " + (nextLabel === "In Stock" ? "stock-in-stock" : nextLabel === "Out of Stock" ? "stock-out-of-stock" : "stock-low-stock");
        }
        if (addBtn) {
          var qty = Number(window.PRODUCT_COLORS[colorIndex].stock || 0);
          addBtn.disabled = qty <= 0;
          addBtn.textContent = qty <= 0 ? "Out of Stock" : "Add to Cart";
        }
        if (stickySubmit) {
          var qtySticky = Number(window.PRODUCT_COLORS[colorIndex].stock || 0);
          stickySubmit.disabled = qtySticky <= 0;
          stickySubmit.textContent = qtySticky <= 0 ? "Out of Stock" : "Add to Cart";
        }
        renderSlides();
      });
    });

    renderSlides();

    if (stickyBar && stickyTrigger) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          stickyBar.classList.toggle("visible", !entry.isIntersecting);
        });
      }, { threshold: 0.15 });
      observer.observe(stickyTrigger);
    }

    if (stickySubmit) {
      stickySubmit.addEventListener("click", function () {
        var form = document.querySelector("form[data-sticky-source]");
        if (form) form.requestSubmit();
      });
    }

    if (openGuide && closeGuide && guideModal) {
      openGuide.addEventListener("click", function () {
        guideModal.classList.add("open");
      });
      closeGuide.addEventListener("click", function () {
        guideModal.classList.remove("open");
      });
    }
  }

  function initRecentlyViewed() {
    var key = "recent-products";
    var viewed = [];
    try {
      viewed = JSON.parse(localStorage.getItem(key) || "[]");
    } catch (error) {
      viewed = [];
    }

    if (window.PRODUCT_VIEW) {
      viewed = viewed.filter(function (item) { return item.id !== window.PRODUCT_VIEW.id; });
      viewed.unshift(window.PRODUCT_VIEW);
      viewed = viewed.slice(0, 6);
      localStorage.setItem(key, JSON.stringify(viewed));
    }

    var grids = document.querySelectorAll("[data-recent-grid]");
    grids.forEach(function (grid) {
      if (!viewed.length) {
        grid.innerHTML = '<div class="recent-empty">No recently viewed products yet.</div>';
        return;
      }
      grid.innerHTML = viewed.map(function (item) {
        return '<a class="recent-card" href="/product/' + item.id + '"><img src="' + item.image + '" alt="' + item.name + '" /><h4>' + item.name + '</h4><p>N' + Number(item.price).toFixed(2) + '</p></a>';
      }).join("");
    });
  }

  function initParallax() {
    var hero = document.querySelector("[data-parallax]");
    if (!hero) return;
    window.addEventListener("scroll", function () {
      var offset = window.scrollY * 0.12;
      hero.style.backgroundPositionY = offset + "px";
    });
  }

  function initFloatingCtaVisibility() {
    var cta = document.querySelector(".floating-whatsapp-cta");
    var footer = document.querySelector(".site-footer");
    if (!cta || !footer) return;

    if (typeof IntersectionObserver !== "function") {
      function syncVisibility() {
        var footerRect = footer.getBoundingClientRect();
        var viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        var isFooterVisible = footerRect.top < viewportHeight && footerRect.bottom > 0;
        cta.classList.toggle("is-hidden", isFooterVisible);
      }
      syncVisibility();
      window.addEventListener("scroll", syncVisibility, { passive: true });
      window.addEventListener("resize", syncVisibility);
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        cta.classList.toggle("is-hidden", entry.isIntersecting);
      });
    }, { threshold: 0.02 });

    observer.observe(footer);
  }

  initTheme();
  initBackButton();
  initMobileMenu();
  initAjaxCartForms();
  initWishlistToggles();
  initQuickView();
  initHeroCarousel();
  initReviewCarousel();
  initSearch();
  initReveals();
  initProductPage();
  initRecentlyViewed();
  initParallax();
  initFloatingCtaVisibility();
})();
class QuickView {
  constructor() {
    this.modal = new MinimogTheme.Modal();
    this.isOpen = false;
    this.target = null;

    addEventDelegate({
      selector: ".m-product-quickview-button",
      handler: (e, t) => {
        e.preventDefault();
        e.stopPropagation();
        this.target = t;
        this.toggleLoading(this.target, true);
        const handle = t.dataset.productHandle;
        if (handle) {
          this.fetchHtml(handle);
        } else {
          this.toggleLoading(this.target, false);
        }
      }
    });

    if (window.MinimogEvents && window.MinimogTheme && window.MinimogTheme.pubSubEvents) {
      window.MinimogEvents.subscribe(window.MinimogTheme.pubSubEvents.cartUpdate, () => {
        this.close();
      });
    }
  }

  async fetchHtml(handle) {
    try {
      const styles = [
        window.MinimogThemeStyles && window.MinimogThemeStyles.product,
        window.MinimogThemeStyles && window.MinimogThemeStyles.productInventory
      ].filter(Boolean);

      if (typeof loadAssetsNew === "function" && styles.length) {
        loadAssetsNew(styles, "quick-view-assets");
      }

      const baseUrl = window.MinimogSettings && window.MinimogSettings.base_url 
        ? window.MinimogSettings.base_url 
        : (window.location.origin + (window.Shopify && window.Shopify.routes ? window.Shopify.routes.root : "/"));
      const targetUrl = `${baseUrl.replace(/\/$/, '')}/products/${handle}`;

      const dom = await fetchSection("product-quickview", { url: targetUrl });
      if (!dom) throw new Error("fetchSection returned empty result");

      const modalContent = dom.querySelector(".m-product-quickview");
      if (!modalContent) throw new Error("Missing .m-product-quickview element");

      this.modalContent = modalContent;
      const colorScheme = modalContent.dataset.colorScheme || "";

      // Load variants picker and inventory scripts if available
      if (typeof loadAssetsNew === "function") {
        const scripts = [
          window.MinimogThemeScripts && window.MinimogThemeScripts.variantsPicker,
          window.MinimogThemeScripts && window.MinimogThemeScripts.productInventory
        ].filter(Boolean);
        if (scripts.length) {
          loadAssetsNew(scripts, "variants-picker");
        }
      }

      // Reset modal inner container before appending new content
      if (this.modal.modalContentInner) {
        this.modal.modalContentInner.innerHTML = "";
      }

      this.modal.appendChild(this.modalContent);
      this.modal.setWidth("760px");
      this.modal.setSizes(`m-gradient ${colorScheme}`);
      this.modal.open();
      this.isOpen = true;

      // Initialize fast gallery inside modal if present
      const gallery = this.modalContent.querySelector(".fast-media-gallery");
      if (gallery && typeof window.initFastGallery === "function") {
        window.initFastGallery(gallery);
      }

    } catch (err) {
      console.error("QuickView fetchHtml error:", err);
    } finally {
      if (this.target) {
        this.toggleLoading(this.target, false);
      }
    }
  }

  close(e) {
    if (this.modal) {
      this.modal.close(e);
    }
    this.isOpen = false;
  }

  toggleLoading(el, isLoading) {
    if (!el) return;
    if (isLoading) {
      el.classList.add("m-spinner-loading");
    } else {
      el.classList.remove("m-spinner-loading");
    }
  }
}

if (!window.MinimogTheme) window.MinimogTheme = {};
window.MinimogTheme.ProductQuickView = new QuickView();
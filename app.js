/* ==========================================================
   Stoyan's Wardrobe — app logic
   - Loads items from data.json and renders the catalog
   - Hash routing (#item-id) for the item detail view (SPA)
   - Image carousel, custom music player, navigation
   ========================================================== */

// Your Instagram profile link — change it here, it updates the whole site.
const INSTAGRAM_URL = "#";

// Short explanation shown next to the worn count, based on its color.
const WORN_NOTES = {
  blue: "Brand new / never worn",
  green: "Barely worn (1–5 times)",
  orange: "Worn 5–20 times",
  red: "Well used (20+ times)",
};

// ---------- App state ----------
let items = [];               // all items from data.json
let currentItem = null;       // item open in the detail view (or null)
let currentImageIndex = 0;    // active photo in the carousel
let catalogScrollY = 0;       // scroll position to restore when going back
let openedFromCatalog = false; // true if the user clicked a card (so "Back" can use history)

// ---------- DOM references ----------
const catalogView = document.getElementById("catalog-view");
const itemView = document.getElementById("item-view");
const itemsGrid = document.getElementById("items-grid");
const itemsCount = document.getElementById("items-count");

const galleryFrame = document.getElementById("gallery-frame");
const galleryImage = document.getElementById("gallery-image");
const galleryPrev = document.getElementById("gallery-prev");
const galleryNext = document.getElementById("gallery-next");
const galleryDots = document.getElementById("gallery-dots");
const galleryCounter = document.getElementById("gallery-counter");

const audio = document.getElementById("audio");
const player = document.querySelector(".player");
const playerToggle = document.getElementById("player-toggle");
const playerTrack = document.getElementById("player-track");
const playerProgress = document.getElementById("player-progress");
const playerCurrent = document.getElementById("player-current");
const playerDuration = document.getElementById("player-duration");

/* ==========================================================
   Helpers
   ========================================================== */

// Escapes text from data.json before putting it into HTML (prevents broken markup).
function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Turns seconds into "m:ss" (e.g. 75 -> "1:15").
function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

// Returns the item whose id matches the current URL hash (e.g. #cargo-jeans), or undefined.
function getItemFromHash() {
  const id = decodeURIComponent(window.location.hash.slice(1));
  return items.find((item) => item.id === id);
}

// Sets the Instagram link on every element marked with .js-instagram-link.
function applyInstagramLinks() {
  document.querySelectorAll(".js-instagram-link").forEach((link) => {
    link.href = INSTAGRAM_URL;
  });
}

/* ==========================================================
   Catalog (Items section)
   ========================================================== */

// Loads data.json and starts the app. Needs a web server (GitHub Pages or a local one).
async function loadItems() {
  try {
    const response = await fetch("./data.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    items = await response.json();
    renderCatalog();
    handleRoute();
  } catch (error) {
    console.error("Could not load data.json:", error);
    itemsGrid.innerHTML =
      '<p class="items__error">Items could not be loaded. Please try again later.</p>';
  }
}

// Builds one card per item and updates the "X available · Y total" counter.
function renderCatalog() {
  itemsGrid.innerHTML = items.map(createCardHTML).join("");

  const available = items.filter((item) => !item.isSold).length;
  itemsCount.textContent = `${available} available · ${items.length} total`;
}

// Returns the HTML for a single catalog card (photo, SOLD badge, title, price, size).
function createCardHTML(item) {
  const soldClass = item.isSold ? " is-sold" : "";
  const soldBadge = item.isSold ? '<span class="sold-badge">SOLD</span>' : "";
  const firstImage = item.images?.[0] || "";

  return `
    <a class="card${soldClass}" href="#${encodeURIComponent(item.id)}" data-id="${escapeHTML(item.id)}">
      <div class="card__media">
        ${soldBadge}
        <img src="${escapeHTML(firstImage)}" alt="${escapeHTML(item.title)}" loading="lazy">
      </div>
      <h3 class="card__title">${escapeHTML(item.title)}</h3>
      <div class="card__meta">
        <span class="card__price">${escapeHTML(item.price)}</span>
        <span class="card__size">Size ${escapeHTML(item.size)}</span>
      </div>
    </a>`;
}

/* ==========================================================
   Routing (hash based) — #item-id opens the item, no hash shows the catalog
   ========================================================== */

// Decides which view to show based on the URL hash. Runs on load and on every hash change.
function handleRoute() {
  const item = getItemFromHash();
  if (item) {
    showItem(item);
  } else {
    showCatalog();
  }
}

// Shows the catalog, hides the detail view and restores the previous scroll position.
function showCatalog() {
  const wasInItemView = currentItem !== null;
  resetAudio();
  currentItem = null;

  itemView.hidden = true;
  catalogView.hidden = false;
  document.title = "Stoyan's Wardrobe";

  if (wasInItemView) {
    window.scrollTo({ top: catalogScrollY, behavior: "instant" });
  }
}

// Shows the detail view for the given item and fills it with the item's data.
function showItem(item) {
  if (currentItem === null) {
    catalogScrollY = window.scrollY; // remember where the user was in the catalog
  }
  resetAudio();
  currentItem = item;
  currentImageIndex = 0;

  fillItemDetails(item);
  renderGallery();

  catalogView.hidden = true;
  itemView.hidden = false;
  document.title = `${item.title} — Stoyan's Wardrobe`;
  window.scrollTo({ top: 0, behavior: "instant" });
}

// Fills title, price, description, size, worn count, sold state and CTA in the detail view.
function fillItemDetails(item) {
  document.getElementById("item-title").textContent = item.title;
  document.getElementById("item-price").textContent = item.price;
  document.getElementById("item-description").textContent = item.description;
  document.getElementById("item-size").textContent = item.size;

  // Worn count: the color comes from data.json ("wornCountColor"), the note is based on it
  const color = String(item.wornCountColor || "").toLowerCase();
  document.getElementById("item-worn").innerHTML = `
    <span class="worn__dot worn__dot--${escapeHTML(color)}"></span>
    <span class="worn__count">${escapeHTML(item.wornCount)}</span>
    <span class="worn__note">${escapeHTML(WORN_NOTES[color] || "")}</span>`;

  // SOLD overlay on the gallery photo
  galleryFrame.classList.toggle("is-sold", Boolean(item.isSold));
  galleryFrame.querySelector(".sold-badge")?.remove();
  if (item.isSold) {
    galleryFrame.insertAdjacentHTML("afterbegin", '<span class="sold-badge">SOLD</span>');
  }

  // Call to action: Instagram DM button, or a "sold" message instead
  const cta = document.getElementById("item-cta");
  cta.classList.toggle("cta--sold", Boolean(item.isSold));
  if (item.isSold) {
    cta.innerHTML = "<p>This item has been sold</p>";
  } else {
    cta.innerHTML = `
      <p>If you like this item, drop me a DM on Instagram.</p>
      <a class="btn btn--dark" href="${escapeHTML(INSTAGRAM_URL)}" target="_blank" rel="noopener">
        <img src="./assets/icons/instagram.png" alt="" width="18" height="18">
        DM me on Instagram
      </a>`;
  }

  // Audio source is set now, but nothing downloads until Play (preload="none")
  audio.src = item.audio || "";
  player.hidden = !item.audio;
}

// Leaves the detail view: uses browser history if possible, otherwise just clears the hash.
function closeItem() {
  if (openedFromCatalog) {
    openedFromCatalog = false;
    history.back(); // triggers "hashchange" -> handleRoute -> showCatalog
  } else {
    // User landed directly on an item link (e.g. shared URL) — no catalog page behind it
    history.pushState(null, "", window.location.pathname + window.location.search);
    showCatalog();
  }
}

/* ==========================================================
   Image carousel
   ========================================================== */

// Shows the active photo, updates dots and "1 / 3" counter, hides arrows for single photos.
function renderGallery() {
  const images = currentItem.images || [];
  const total = images.length;

  galleryImage.src = images[currentImageIndex] || "";
  galleryImage.alt = `${currentItem.title} — photo ${currentImageIndex + 1} of ${total}`;

  const hasMany = total > 1;
  galleryPrev.hidden = !hasMany;
  galleryNext.hidden = !hasMany;
  galleryCounter.textContent = total ? `${currentImageIndex + 1} / ${total}` : "";

  galleryDots.innerHTML = hasMany
    ? images
        .map((_, i) => `<span class="gallery__dot${i === currentImageIndex ? " is-active" : ""}"></span>`)
        .join("")
    : "";
}

// Moves the carousel by +1 / -1 and wraps around at the ends.
function changeImage(step) {
  const total = currentItem?.images?.length || 0;
  if (total < 2) return;
  currentImageIndex = (currentImageIndex + step + total) % total;
  renderGallery();
}

/* ==========================================================
   Music player (hidden <audio> + custom controls)
   ========================================================== */

// Plays or pauses the current item's track.
function togglePlay() {
  if (!audio.src) return;
  if (audio.paused) {
    audio.play().catch((error) => console.error("Audio could not play:", error));
  } else {
    audio.pause();
  }
}

// Stops the track and resets the player UI (used when switching items or going back).
function resetAudio() {
  audio.pause();
  if (audio.src) audio.currentTime = 0;
  player.classList.remove("is-playing");
  playerToggle.setAttribute("aria-label", "Play track");
  playerProgress.style.width = "0%";
  playerCurrent.textContent = "0:00";
  playerDuration.textContent = "0:00";
}

// Updates the progress line and the time labels while the track plays.
function updateProgress() {
  const { currentTime, duration } = audio;
  const percent = duration ? (currentTime / duration) * 100 : 0;
  playerProgress.style.width = `${percent}%`;
  playerCurrent.textContent = formatTime(currentTime);
  playerDuration.textContent = formatTime(duration);
}

// Jumps to the clicked position on the progress line.
function seek(event) {
  if (!audio.duration) return;
  const rect = playerTrack.getBoundingClientRect();
  const ratio = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
  audio.currentTime = ratio * audio.duration;
}

/* ==========================================================
   Navigation bar
   ========================================================== */

// Scrolls to "top", "about" or "items". Closes the detail view first if it is open.
function navigateTo(target) {
  if (currentItem) {
    openedFromCatalog = false;
    history.pushState(null, "", window.location.pathname + window.location.search);
    showCatalog();
  }

  if (target === "top") {
    window.scrollTo({ top: 0, behavior: "smooth" });
  } else {
    document.getElementById(target)?.scrollIntoView({ behavior: "smooth" });
  }
}

/* ==========================================================
   Event listeners
   ========================================================== */

// Sets up all click, keyboard, swipe and audio listeners.
function bindEvents() {
  // Navbar: brand -> top, About -> about section, Items -> items section
  document.querySelectorAll("[data-scroll]").forEach((button) => {
    button.addEventListener("click", () => navigateTo(button.dataset.scroll));
  });

  // Clicking a card only changes the hash; handleRoute does the rest
  itemsGrid.addEventListener("click", (event) => {
    if (event.target.closest(".card")) openedFromCatalog = true;
  });

  // Browser / phone "Back" button and any hash change
  window.addEventListener("hashchange", handleRoute);

  // Detail view: back + close
  document.getElementById("back-button").addEventListener("click", closeItem);
  document.getElementById("close-button").addEventListener("click", closeItem);

  // Carousel arrows
  galleryPrev.addEventListener("click", () => changeImage(-1));
  galleryNext.addEventListener("click", () => changeImage(1));

  // Keyboard: left/right arrows change photo, Escape closes the item
  document.addEventListener("keydown", (event) => {
    if (!currentItem) return;
    if (event.key === "ArrowLeft") changeImage(-1);
    if (event.key === "ArrowRight") changeImage(1);
    if (event.key === "Escape") closeItem();
  });

  // Touch swipe on the photo (phones)
  let touchStartX = null;
  galleryFrame.addEventListener("touchstart", (event) => {
    touchStartX = event.touches[0].clientX;
  }, { passive: true });
  galleryFrame.addEventListener("touchend", (event) => {
    if (touchStartX === null) return;
    const deltaX = event.changedTouches[0].clientX - touchStartX;
    if (Math.abs(deltaX) > 40) changeImage(deltaX < 0 ? 1 : -1);
    touchStartX = null;
  });

  // Music player
  playerToggle.addEventListener("click", togglePlay);
  playerTrack.addEventListener("click", seek);
  audio.addEventListener("timeupdate", updateProgress);
  audio.addEventListener("loadedmetadata", updateProgress);
  audio.addEventListener("play", () => {
    player.classList.add("is-playing");
    playerToggle.setAttribute("aria-label", "Pause track");
  });
  audio.addEventListener("pause", () => {
    player.classList.remove("is-playing");
    playerToggle.setAttribute("aria-label", "Play track");
  });
  audio.addEventListener("ended", () => {
    audio.currentTime = 0;
    updateProgress();
  });
}

/* ==========================================================
   Start
   ========================================================== */

// We restore the catalog scroll position ourselves when going back from an item.
if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

applyInstagramLinks();
bindEvents();
loadItems();

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import { authStore } from "../store/auth";
import { langStore } from "../store/lang";
import {
  Activity,
  Target,
  Medal,
  UsersRound,
  CircleUserRound,
  ShieldCheck,
  Languages,
} from "lucide-vue-next";

const router = useRouter();
const route = useRoute();
const activeIndex = ref(-1);
const isScrolled = ref(false);

// ── Navigation items (reactive to language) ──────────────────────────────────
const navigation = computed(() => [
  { name: langStore.t('nav_activities'),  icon: Activity,        path: "/" },
  { name: langStore.t('nav_missions'),    icon: Target,          path: "/missions" },
  { name: langStore.t('nav_rankings'),    icon: Medal,           path: "/rankings" },
  { name: langStore.t('nav_create_team'), icon: UsersRound,      path: "/create-teams" },
  { name: langStore.t('nav_profile'),     icon: CircleUserRound, path: "/profile" },
]);

const isAdmin = computed(() => authStore.user?.role?.toLowerCase() === "admin");

const hideNavbar = computed(() => {
  const hiddenPaths = ["/register", "/body-composition"];
  return hiddenPaths.includes(route.path);
});

const toggleAdminMode = () => {
  authStore.toggleAdminMode();
  if (authStore.isAdminMode) {
    router.push("/admin");
  } else {
    router.push("/");
  }
};

const setActive = (index: number) => {
  activeIndex.value = index;
};

watch(
  () => route.path,
  (newPath) => {
    const index = navigation.value.findIndex((item) => item.path === newPath);
    if (index !== -1) {
      activeIndex.value = index;
    } else {
      const subIndex = navigation.value.findIndex((item) => {
        if (item.path === '/') return false;
        return newPath.startsWith(item.path);
      });
      activeIndex.value = subIndex;
    }
  },
  { immediate: true },
);

const isMobile = ref(false);
const checkMobile = () => {
  isMobile.value = window.innerWidth <= 767;
};

const handleScroll = () => {
  isScrolled.value = window.scrollY > 10;
};

onMounted(() => {
  checkMobile();
  window.addEventListener("resize", checkMobile, { passive: true });
  window.addEventListener("scroll", handleScroll, { passive: true });
});

onUnmounted(() => {
  window.removeEventListener("resize", checkMobile);
  window.removeEventListener("scroll", handleScroll);
});
</script>

<template>
  <!-- ===== DESKTOP / TABLET NAVBAR (Top Bar) ===== -->
  <nav v-if="!hideNavbar && !isMobile" class="navbar-top" :class="{ 'is-scrolled': isScrolled }">
    <div class="container-nav">
      <router-link to="/" class="brand">
        <img src="/logo.png" class="logo" alt="VitalCare" />
        <span class="brand-text">VitalCare</span>
      </router-link>

      <div class="nav-links">
        <router-link
          v-for="(item, index) in navigation"
          :key="index"
          :to="item.path"
          class="nav-item"
          :class="{ active: activeIndex === index }"
          @click="setActive(index)"
        >
          <component :is="item.icon" class="icon-nav" />
          <span class="label">{{ item.name }}</span>
        </router-link>

        <button
          v-if="isAdmin"
          @click="toggleAdminMode"
          class="nav-item admin-btn"
        >
          <ShieldCheck class="icon-nav" />
          <span class="label">{{ langStore.t('nav_admin') }}</span>
        </button>
      </div>

      <div class="user-section">
        <!-- Language Toggle (Desktop) -->
        <button
          class="lang-toggle"
          @click="langStore.toggle()"
          :title="langStore.locale === 'th' ? 'Switch to English' : 'เปลี่ยนเป็นภาษาไทย'"
          :aria-label="langStore.locale === 'th' ? 'Switch to English' : 'Switch to Thai'"
        >
          <Languages :size="16" class="lang-icon" />
          <span class="lang-label">{{ langStore.locale === 'th' ? 'EN' : 'ไทย' }}</span>
        </button>

        <router-link to="/profile" class="avatar-link">
          <img
            v-if="authStore.user?.picture_url"
            :src="authStore.user.picture_url"
            alt="Profile"
          />
          <CircleUserRound v-else class="fallback-avatar" />
        </router-link>
      </div>
    </div>
  </nav>

  <!-- ===== MOBILE NAVBAR (Bottom Tab Bar) ===== -->
  <nav v-if="!hideNavbar && isMobile" class="navbar-mobile">
    <!-- Language Toggle Pill (Mobile — top of the bottom bar) -->
    <div class="mobile-lang-strip">
      <button
        class="lang-toggle-mobile"
        @click="langStore.toggle()"
        :aria-label="langStore.locale === 'th' ? 'Switch to English' : 'Switch to Thai'"
      >
        <Languages :size="13" />
        <span>{{ langStore.locale === 'th' ? 'EN' : 'ไทย' }}</span>
      </button>
    </div>

    <div class="mobile-grid">
      <router-link
        v-for="(item, index) in navigation"
        :key="index"
        :to="item.path"
        class="tab-item"
        :class="{ active: activeIndex === index }"
        @click="setActive(index)"
      >
        <div class="tab-icon-wrapper">
          <component :is="item.icon" class="tab-icon" />
        </div>
        <span class="tab-label">{{ item.name }}</span>
      </router-link>

      <button
        v-if="isAdmin"
        class="tab-item admin-tab"
        @click="toggleAdminMode"
      >
        <div class="tab-icon-wrapper">
          <ShieldCheck class="tab-icon" />
        </div>
        <span class="tab-label">{{ langStore.t('nav_admin') }}</span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
:global(:root) {
  --orange-primary: #FF6B00;
  --orange-soft: #FFF4ED;
  --gray-main: #111827;
  --gray-muted: #6B7280;
  --white-pure: #FFFFFF;
  --border-color: #F3F4F6;
  --font-thai: "Sarabun", "Inter", sans-serif;
}

/* ========== NAVBAR TOP (Desktop/Tablet) ========== */
.navbar-top {
  display: none;
  position: sticky;
  top: 0;
  z-index: 100;
  width: 100%;
  background-color: var(--white-pure);
  border-bottom: 1px solid var(--border-color);
  transition: all 0.3s ease;
}
@media (min-width: 768px) {
  .navbar-top { display: block; }
}
.navbar-top.is-scrolled {
  background-color: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
}
.container-nav {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 24px;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* Brand */
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
}
.logo {
  width: 38px;
  height: 38px;
  object-fit: contain;
}
.brand-text {
  font-size: 1.3rem;
  font-weight: 800;
  color: var(--gray-main);
  letter-spacing: -0.03em;
}

/* Nav Links */
.nav-links {
  display: flex;
  align-items: center;
  height: 100%;
  gap: 4px;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  height: 100%;
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--gray-muted);
  text-decoration: none;
  background: transparent;
  border: none;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
  position: relative;
}
.nav-item::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  width: 100%;
  height: 3px;
  background-color: var(--orange-primary);
  transform: scaleX(0);
  transition: transform 0.2s ease;
}
.nav-item:hover { color: var(--orange-primary); }
.nav-item.active {
  color: var(--orange-primary);
  font-weight: 700;
}
.nav-item.active::after { transform: scaleX(1); }
.icon-nav {
  width: 20px;
  height: 20px;
  stroke-width: 2.2;
}

/* User Section */
.user-section {
  display: flex;
  align-items: center;
  gap: 10px;
}
.avatar-link {
  width: 44px;
  height: 44px;
  min-width: 44px;
  min-height: 44px;
  aspect-ratio: 1 / 1;
  flex-shrink: 0;
  border-radius: 50%;
  background-color: var(--border-color);
  overflow: hidden;
  border: 2px solid transparent;
  transition: border-color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.avatar-link:hover { border-color: var(--orange-primary); }
.avatar-link img { width: 100%; height: 100%; object-fit: cover; }
.fallback-avatar { width: 26px; height: 26px; color: var(--gray-muted); }

/* ── Language Toggle (Desktop) ─────────────────────────────────────────── */
.lang-toggle {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border-radius: 20px;
  border: 1.5px solid var(--border-color);
  background: transparent;
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--gray-muted);
  transition: all 0.2s ease;
  white-space: nowrap;
}
.lang-toggle:hover {
  border-color: var(--orange-primary);
  color: var(--orange-primary);
  background: var(--orange-soft);
}
.lang-icon { flex-shrink: 0; }
.lang-label { line-height: 1; }

/* ========== TABLET SPECIFIC (768px - 1024px) ========== */
@media (min-width: 768px) and (max-width: 1024px) {
  .container-nav { padding: 0 16px; }
  .brand-text { display: none; }
  .nav-item { padding: 0 10px; font-size: 0.9rem; }
  .nav-links { gap: 0; }
  .lang-label { display: none; } /* แท็บเล็ต: แสดงแค่ไอคอน ไม่แสดงข้อความ */
  .lang-toggle { padding: 6px 10px; }
}

/* ========== NAVBAR MOBILE (Bottom Nav) ========== */
.navbar-mobile {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  background: var(--white-pure);
  border-top: 1px solid var(--border-color);
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.05);
  z-index: 200;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

/* ── Language strip above tab bar (Mobile) ─────────────────────────────── */
.mobile-lang-strip {
  display: flex;
  justify-content: flex-end;
  padding: 4px 12px 0;
  border-bottom: 1px solid var(--border-color);
}
.lang-toggle-mobile {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 20px;
  border: 1.5px solid var(--border-color);
  background: transparent;
  cursor: pointer;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--gray-muted);
  transition: all 0.2s ease;
  margin-bottom: 2px;
}
.lang-toggle-mobile:active {
  background: var(--orange-soft);
  border-color: var(--orange-primary);
  color: var(--orange-primary);
}

.mobile-grid {
  display: flex;
  height: 60px;
  align-items: center;
  justify-content: space-around;
  padding: 0 4px;
}
.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  background: transparent;
  border: none;
  text-decoration: none;
  color: var(--gray-muted);
  -webkit-tap-highlight-color: transparent;
}
.tab-icon-wrapper {
  width: 48px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 15px;
  transition: background-color 0.2s;
}
.tab-icon {
  width: 22px;
  height: 22px;
  stroke-width: 1.8;
}
.tab-label {
  font-size: 0.68rem;
  font-weight: 600;
  white-space: nowrap;
}
.tab-item.active { color: var(--orange-primary); }
.tab-item.active .tab-icon-wrapper { background-color: transparent; }
.tab-item.active .tab-icon { stroke-width: 2.5; }

/* Push app content up */
@media (max-width: 767px) {
  :global(#app) {
    padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px));
  }
}
</style>
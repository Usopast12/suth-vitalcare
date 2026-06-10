<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import {
  Search, X, ArrowRight,
  Heart, Sparkles, ImageIcon,
  CalendarDays, Users, MapPin, Award, 
  ChevronLeft, ChevronRight, Filter, Loader2
} from 'lucide-vue-next';
import { useActivities } from '../composables/useActivities';
import AppPagination from '../components/common/AppPagination.vue';
import MultiSelectFilter from '../components/common/MultiSelectFilter.vue';
import { langStore } from '../store/lang';
const {
  searchQuery, debouncedQuery, activeBanners, currentBannerIndex, loadingBanners,
  sortBy, filterContinuousReg, filterHasGoals, filterFavorites,
  filterCert, filterRegistered, filterSection, loadingMore, sentinelEl, filterStatus,
  filterRoleStudent, filterRoleUni, filterRoleStaff, filterRolePublic,
  visibleCards, isMobileScreen, loadingActivities, activitiesError,
  flashSaleRemaining, viewSections, totalFiltered, hasActiveFilters,
  favoriteIds, clearFilters, clearSearch, observeCard, formatDateThai,
  goToDetail, onBannerClick, toggleFavorite, getActivityStatus, setSection,
  fetchActivities, prefetchDetailPages, hasMore, currentPage, totalPages, changePage
} = useActivities();
const selectedFilterIds = computed({
  get: () => {
    const active = [];
    if (filterRegistered.value) active.push('registered');
    if (filterFavorites.value) active.push('favorites');
    if (filterCert.value) active.push('cert');
    if (filterStatus.value === 'open') active.push('open');
    if (filterRoleStudent.value) active.push('role_student');
    if (filterRoleUni.value) active.push('role_uni');
    if (filterRoleStaff.value) active.push('role_staff');
    if (filterRolePublic.value) active.push('role_public');
    if (filterContinuousReg.value) active.push('continuous');
    if (filterHasGoals.value) active.push('goals');
    return active;
  },
  set: (newVal: string[]) => {
    filterRegistered.value = newVal.includes('registered');
    filterFavorites.value = newVal.includes('favorites');
    filterCert.value = newVal.includes('cert');
    filterStatus.value = newVal.includes('open') ? 'open' : 'all';
    filterRoleStudent.value = newVal.includes('role_student');
    filterRoleUni.value = newVal.includes('role_uni');
    filterRoleStaff.value = newVal.includes('role_staff');
    filterRolePublic.value = newVal.includes('role_public');
    filterContinuousReg.value = newVal.includes('continuous');
    filterHasGoals.value = newVal.includes('goals');
  }
});

const filterOptions = computed(() => [
  { id: 'registered', label: langStore.locale === 'th' ? 'สมัครแล้ว' : 'Registered' },
  { id: 'favorites', label: langStore.locale === 'th' ? 'รายการโปรด' : 'Favorites' },
  { id: 'open', label: langStore.locale === 'th' ? 'กำลังเปิดรับสมัคร' : 'Open' },
  { id: 'continuous', label: langStore.locale === 'th' ? 'รับสมัครต่อเนื่อง' : 'Continuous' },
  { id: 'goals', label: langStore.locale === 'th' ? 'มีเป้าหมาย/ภารกิจ' : 'With Goals' },
  { id: 'cert', label: langStore.locale === 'th' ? 'มีใบประกาศ' : 'Certificate' },
  { id: 'role_student', label: langStore.locale === 'th' ? 'นักศึกษา' : 'Student' },
  { id: 'role_uni', label: langStore.locale === 'th' ? 'บุคลากร มทส.' : 'University Staff' },
  { id: 'role_staff', label: langStore.locale === 'th' ? 'บุคลากร รพ.' : 'Hospital Staff' },
  { id: 'role_public', label: langStore.locale === 'th' ? 'บุคคลทั่วไป' : 'Public' }
]);

const sortOptions = computed(() => [
  { value: 'newest', label: langStore.locale === 'th' ? 'มาใหม่' : 'Newest' },
  { value: 'popular', label: langStore.locale === 'th' ? 'ยอดนิยม' : 'Popular' },
  { value: 'closest', label: langStore.locale === 'th' ? 'ใกล้ถึงวันจัด' : 'Closest' }
]);

// ==========================================
// 🌟 ระบบ Carousel ลื่นๆ + เมาส์ลาก (Grab) 🌟
// ==========================================
const bannerTrack = ref<HTMLElement | null>(null);
// 1. ระบบ Auto Slide
let slideInterval: any = null;
const startAutoSlide = () => {
  // 🛡️ ป้องกันการสร้าง Interval ซ้อนกัน (Fix: Slider เร็วขึ้นเรื่อยๆ)
  stopAutoSlide(); 
  if (activeBanners.value.length <= 1) return;
  slideInterval = setInterval(() => {
    currentBannerIndex.value = (currentBannerIndex.value + 1) % activeBanners.value.length;
  }, 4000); // ปรับเป็น 4 วินาทีให้ดูพรีเมียมขึ้น
};
const stopAutoSlide = () => {
  if (slideInterval) {
    clearInterval(slideInterval);
    slideInterval = null;
  }
};
// 2. ดักการเปลี่ยน Index เพื่อสั่งให้รางเลื่อนสมูทๆ (คำนวณให้อยู่กึ่งกลางเป๊ะๆ)
watch(currentBannerIndex, (newIdx) => {
  if (!bannerTrack.value || isDragging.value) return;
  const track = bannerTrack.value;
  const cards = track.children;
  if (cards[newIdx]) {
    const card = cards[newIdx] as HTMLElement;
    // คำนวณให้การ์ดอยู่ตรงกลาง
    const targetLeft = card.offsetLeft - track.offsetLeft - (track.clientWidth - card.clientWidth) / 2;
    track.scrollTo({ left: targetLeft, behavior: 'smooth' });
  }
});
// 3. ฟังก์ชันปุ่มลูกศร
const scrollNext = () => {
  if (activeBanners.value.length > 0) {
    currentBannerIndex.value = (currentBannerIndex.value + 1) % activeBanners.value.length;
  }
};
const scrollPrev = () => {
  if (activeBanners.value.length > 0) {
    currentBannerIndex.value = (currentBannerIndex.value - 1 + activeBanners.value.length) % activeBanners.value.length;
  }
};
// 4. 🌟 ฟังก์ชัน Grab to Scroll (ลากเมาส์ในคอม) 🌟
const isDragging = ref(false);
const startX = ref(0);
const startScrollLeft = ref(0);
const startDrag = (e: MouseEvent) => {
  isDragging.value = true;
  stopAutoSlide(); // หยุดออโต้ชั่วคราวตอนคนกำลังลาก
  if (bannerTrack.value) {
    startX.value = e.pageX - bannerTrack.value.offsetLeft;
    startScrollLeft.value = bannerTrack.value.scrollLeft;
  }
};
const doDrag = (e: MouseEvent) => {
  if (!isDragging.value || !bannerTrack.value) return;
  e.preventDefault();
  const x = e.pageX - bannerTrack.value.offsetLeft;
  const walk = (x - startX.value) * 1.5; // เลข 1.5 คือความหนืดของการลาก
  bannerTrack.value.scrollLeft = startScrollLeft.value - walk;
};
const stopDrag = () => {
  isDragging.value = false;
  startAutoSlide(); // กลับมาเลื่อนออโต้ต่อ
};
onMounted(() => {
  startAutoSlide();
});
onUnmounted(() => {
  stopAutoSlide();
});
// ==========================================
// 🌟 Filter Chips Scroll Logic 🌟
// ==========================================
const chipsScrollEl = ref<HTMLElement | null>(null);
const chipsCanScrollLeft = ref(false);
const chipsCanScrollRight = ref(false);

const updateChipsScroll = () => {
  const el = chipsScrollEl.value;
  if (!el) return;
  chipsCanScrollLeft.value = el.scrollLeft > 2;
  chipsCanScrollRight.value = el.scrollLeft < el.scrollWidth - el.clientWidth - 2;
};

const scrollChipsLeft = () => {
  if (chipsScrollEl.value) {
    chipsScrollEl.value.scrollBy({ left: -200, behavior: 'smooth' });
  }
};

const scrollChipsRight = () => {
  if (chipsScrollEl.value) {
    chipsScrollEl.value.scrollBy({ left: 200, behavior: 'smooth' });
  }
};

onMounted(() => {
  startAutoSlide();
  setTimeout(updateChipsScroll, 100);
});
</script>
<template>
  <div class="shop-layout">
    <header class="shop-header">
      <div class="brand-title">
        <h1>{{ langStore.t('search_activities').replace('...', '') || langStore.t('activities') }}</h1>
      </div>
    </header>
    <div class="shop-search-section">
      <div class="search-and-sort">
        <div class="search-pill-container">
          <Search class="search-icon" :size="20" />
          <input 
            v-model="searchQuery" 
            type="text" 
            :placeholder="langStore.t('search_activities')" 
          />
          <button v-if="searchQuery" @click="clearSearch" class="btn-clear-search">
            <X :size="18" />
          </button>
        </div>
      </div>
      <div class="filter-chips-wrapper">
        <div class="chips-scroll-container">
          <button 
            v-if="chipsCanScrollLeft" 
            class="chips-nav-arrow chips-nav-left" 
            @click="scrollChipsLeft"
          >
            <ChevronLeft :size="18" />
          </button>
          
          <div 
            class="chips-scroll-main"
            ref="chipsScrollEl"
            @scroll="updateChipsScroll"
          >
            <button 
              v-for="opt in filterOptions" 
              :key="opt.id"
              class="flat-chip"
              :class="{ 'active': selectedFilterIds.includes(opt.id) }"
              @click="selectedFilterIds = selectedFilterIds.includes(opt.id) ? selectedFilterIds.filter(id => id !== opt.id) : [...selectedFilterIds, opt.id]"
            >
              {{ opt.label }}
            </button>
            <span class="chips-end-spacer" aria-hidden="true"></span>
          </div>

          <button 
            v-if="chipsCanScrollRight" 
            class="chips-nav-arrow chips-nav-right" 
            @click="scrollChipsRight"
          >
            <ChevronRight :size="18" />
          </button>
        </div>
      </div>
    </div>
    <main class="shop-main">
      <section class="shop-hero-wrapper" v-if="filterSection === 'all' && !debouncedQuery && activeBanners.length > 0 && !hasActiveFilters">
        <div class="carousel-container" @mouseenter="stopAutoSlide" @mouseleave="startAutoSlide">
          <button class="carousel-arrow left-arrow" @click="scrollPrev" v-if="activeBanners.length > 1">
            <ChevronLeft :size="24" />
          </button>
          <div class="banner-track" 
               :class="{ 'is-dragging': isDragging, 'justify-center': activeBanners.length === 1 }"
               ref="bannerTrack"
               @mousedown="startDrag"
               @mousemove="doDrag"
               @mouseup="stopDrag"
               @mouseleave="stopDrag"
          >
            <div v-for="banner in activeBanners" :key="banner.id" class="hero-card">
              <div class="hero-image-side">
                <img :src="banner.image_url" :alt="banner.title" draggable="false" />
              </div>
              <div class="hero-content-side">
                <h2 class="hero-title" v-auto-translate="(langStore.locale === 'en' && banner.title_en) ? banner.title_en : (banner.title || langStore.t('no_banner_title'))"></h2>
                <p class="hero-subtitle" v-if="banner.subtitle_en || banner.subtitle" v-auto-translate="(langStore.locale === 'en' && banner.subtitle_en) ? banner.subtitle_en : banner.subtitle"></p>
                <div class="hero-actions" v-if="banner.link_type !== 'none'">
                  <button class="btn-hero-solid" @click="onBannerClick(banner)">
                    {{ langStore.t('view_detail') }} <ArrowRight :size="16" class="ml-1"/>
                  </button>
                </div>
              </div>
            </div>
          </div>
          <button class="carousel-arrow right-arrow" @click="scrollNext" v-if="activeBanners.length > 1">
            <ChevronRight :size="24" />
          </button>
        </div>
      </section>
      <section class="shop-categories" v-if="hasActiveFilters">
        <div class="section-title-row">
          <h3>{{ langStore.t('active_filters') }}</h3>
          <button class="text-btn" @click="clearFilters">
            {{ langStore.t('clear_all') }} <X :size="16"/>
          </button>
        </div>
        <div class="chips-scroll">
          <div v-for="id in selectedFilterIds" :key="id" class="flat-chip active">
            {{ filterOptions.find(o => o.id === id)?.label }}
            <X :size="14" class="ml-1 cursor-pointer" @click="selectedFilterIds = selectedFilterIds.filter(f => f !== id)" />
          </div>
          <div v-if="sortBy !== 'newest'" class="flat-chip active">
            {{ langStore.t('sort_label') }} {{ sortOptions.find(o => o.value === sortBy)?.label }}
            <X :size="14" class="ml-1 cursor-pointer" @click="sortBy = 'newest'" />
          </div>
        </div>
      </section>
      <div v-if="loadingActivities" class="flat-grid">
        <div v-for="n in 4" :key="n" class="flat-skel">
          <div class="skel-img"></div>
          <div class="skel-line w-full mt-3"></div>
          <div class="skel-line w-half mt-2"></div>
        </div>
      </div>
      <div v-else-if="totalFiltered === 0" class="shop-empty">
        <div class="empty-icon"><Search :size="48" /></div>
        <h3>{{ langStore.t('no_search_results') }}</h3>
        <p>{{ langStore.t('try_change_search') }}</p>
      </div>
      <div v-else class="shop-feed">
        <section v-for="sec in viewSections" :key="sec.id" class="feed-section">
          <div class="section-title-row" v-if="sec.title">
            <h3 v-if="!sec.isFlash">
              {{ sec.title }}
              <span v-if="hasActiveFilters || searchQuery" class="text-gray-400 font-normal ml-1" style="font-size: 0.8em;">
                ({{ totalFiltered }} {{ langStore.t('items_unit') }})
              </span>
            </h3>
            <h3 v-else class="text-primary flex items-center gap-2">
              <Sparkles :size="18"/> {{ sec.title }}
              <span v-if="hasActiveFilters || searchQuery" class="text-gray-400 font-normal ml-1" style="font-size: 0.8em;">
                ({{ totalFiltered }} {{ langStore.t('items_unit') }})
              </span>
            </h3>
            <button class="text-btn" v-if="sec.isFiltered" @click="setSection('all')">
              {{ langStore.t('back') }} <X :size="16"/>
            </button>
            <button class="text-btn" v-if="!sec.isFiltered && !['all', 'all-home'].includes(sec.id)" @click="setSection(sec.id)">
              {{ langStore.t('view_all') }} <ArrowRight :size="16"/>
            </button>
          </div>
          <div class="flat-grid" :class="{'is-horizontal': !sec.isFiltered && sec.id !== 'all-home' && isMobileScreen}">
            <div 
              v-for="act in sec.items" 
              :key="act.id"
              :ref="el => observeCard(el, act.id)"
              class="flat-card"
              :class="{'is-visible': visibleCards.has(act.id), 'is-ended': getActivityStatus(act) === 'ended'}"
              @click="goToDetail(act.id)"
              @mouseenter="prefetchDetailPages([act])"
            >
              <div class="img-box">
                <img v-if="act.poster" :src="act.poster" :alt="act.title" />
                <div v-else class="img-fallback">
                  <ImageIcon :size="32" class="fallback-icon" />
                </div>
                <div class="dark-badge" :class="getActivityStatus(act)">
                  <template v-if="getActivityStatus(act) === 'ended'">{{ langStore.t('status_ended') }}</template>
                  <template v-else-if="getActivityStatus(act) === 'ongoing'">{{ langStore.t('status_ongoing') }}</template>
                  <template v-else-if="getActivityStatus(act) === 'registered'">{{ langStore.t('status_registered') }}</template>
                  <template v-else-if="getActivityStatus(act) === 'full'">{{ langStore.t('status_full') }}</template>
                  <template v-else>{{ langStore.t('registration_open') }}</template>
                </div>
                <button class="heart-btn" :class="{'active': favoriteIds.has(act.id)}" @click.stop="toggleFavorite($event, act.id)">
                  <Heart :size="18" :fill="favoriteIds.has(act.id) ? '#FF6A00' : 'none'" />
                </button>
              </div>
              <div class="info-box">
                <h4 class="title" v-auto-translate-title="act.title" v-auto-translate="act.title"></h4>
                <div class="meta-row text-primary">
                  <CalendarDays :size="14" />
                  <span>{{ langStore.t('register_label') }} {{ act.is_continuous_registration ? langStore.t('always_open') : (act.registration_end_date ? formatDateThai(act.registration_end_date) : langStore.t('not_specified')) }}</span>
                </div>
                <div class="meta-row text-gray">
                  <CalendarDays :size="14" />
                  <span>{{ langStore.t('activity_date_label') }} {{ act.is_continuous_event ? langStore.t('reg_open_forever') : (act.start_date ? formatDateThai(act.start_date) : langStore.t('not_specified')) }}</span>
                </div>
                <div class="meta-row text-gray mt-1">
                  <Users :size="14" />
                  <span v-if="act.is_unlimited_max_slots">{{ langStore.t('unlimited_slots') }}</span>
                  <span v-else>{{ langStore.t('joined_label') }} {{ act.registration_count || 0 }} / {{ act.max_slots || langStore.t('unlimited') }} {{ langStore.t('participants_unit') }}</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
      <!-- Infinite Scroll (On Search / Filtered / Section Views) -->
      <div v-if="(filterSection !== 'all' || searchQuery || hasActiveFilters) && hasMore" ref="sentinelEl" class="infinite-scroll-trigger">
        <div v-if="loadingMore" class="loading-more">
          <Loader2 class="spin" :size="24" />
          <span>{{ langStore.t('loading_activities') }}</span>
        </div>
      </div>
      <!-- Pagination (Only on Home Discovery Feed) -->
      <div class="pagination-wrap" v-if="filterSection === 'all' && !searchQuery && !hasActiveFilters && totalPages > 1">
        <AppPagination 
          :currentPage="currentPage" 
          :totalPages="totalPages" 
          @change="changePage"
        />
      </div>
    </main>
  </div>
</template>
<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700;800&display=swap');
.shop-layout {
  --primary: #FF6A00;
  --bg-main: #FFFFFF;
  --text-dark: #111827;
  --text-gray: #6B7280;
  --surface: #F9FAFB;
  --border-light: #E5E7EB;
  background-color: var(--bg-main);
  min-height: 100vh;
  font-family: 'Sarabun', sans-serif;
  color: var(--text-dark);
  padding-bottom: 80px;
  overflow-x: hidden;
  width: 100%;
}
.ml-1 { margin-left: 4px; }
.mt-1 { margin-top: 4px; }
.shop-header {
  display: flex; justify-content: center; align-items: center;
  padding: 20px 24px 12px; background: var(--bg-main);
  position: sticky; top: 0; z-index: 50;
}
.brand-title h1 { font-size: 18px; font-weight: 800; margin: 0; text-transform: uppercase; color: var(--text-dark); }
.shop-search-section { 
  padding: 0 0 24px; 
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.search-pill-container { 
  display: flex; 
  align-items: center; 
  background: white; 
  padding: 0 20px; 
  height: 44px;
  width: 100%;
  max-width: 1200px;
  flex: 1;
  border-radius: 99px; 
  border: 1.5px solid #E2E8F0; 
  box-shadow: 0 4px 15px rgba(0,0,0,0.04);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  gap: 12px;
}
.search-pill-container:focus-within { 
  border-color: var(--primary); 
  box-shadow: 0 8px 25px rgba(255, 106, 0, 0.12);
}
.search-icon { color: #9CA3AF; flex-shrink: 0; }
.search-pill-container input { 
  flex: 1; 
  border: none; 
  background: transparent; 
  outline: none; 
  font-family: inherit; 
  font-size: 0.95rem; 
  font-weight: 500; 
  color: var(--text-dark); 
}
.search-pill-container input::placeholder { color: #9CA3AF; }
.btn-clear-search { 
  background: transparent; 
  border: none; 
  color: #9CA3AF; 
  display: flex; 
  align-items: center; 
  justify-content: center; 
  padding: 4px; 
  border-radius: 50%;
  cursor: pointer; 
  flex-shrink: 0; 
  width: 28px;
  height: 28px;
  min-width: 28px;
  aspect-ratio: 1 / 1;
  transition: all 0.2s;
}
.btn-clear-search:hover {
  color: var(--text-dark);
  background: rgba(0,0,0,0.05);
}
.search-and-sort {
  display: flex;
  gap: 12px;
  width: 100%;
  max-width: 1200px;
  padding: 0 24px;
  align-items: center;
}
.filter-chips-wrapper {
  width: 100%;
  margin-top: 12px;
  overflow: hidden;
}
.chips-scroll-container {
  position: relative;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
}
.chips-nav-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  width: 32px;
  height: 32px;
  min-width: 32px;
  min-height: 32px;
  aspect-ratio: 1 / 1;
  flex-shrink: 0;
  padding: 0;
  border-radius: 50%;
  background: white;
  border: 1px solid var(--border-light);
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-dark);
  transition: all 0.2s;
}
.chips-nav-arrow:hover {
  color: var(--primary);
  border-color: var(--primary);
}
.chips-nav-left {
  left: 8px;
}
.chips-nav-right {
  right: 8px;
}
.chips-scroll-main {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  /* Left padding aligns with search bar; right padding intentionally small
     so the last chip peeks ~30px — the universal "swipe to see more" cue */
  padding: 6px 24px 6px 24px;
  scroll-padding-left: 24px;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-x: contain;
}
.chips-scroll-main::-webkit-scrollbar { display: none; }
/* Invisible spacer ensures ~30px of peek at the end without overflow */
.chips-end-spacer { flex: 0 0 8px; min-width: 8px; }
@media (max-width: 768px) {
  .chips-scroll-main {
    padding: 6px 16px;
    scroll-padding-left: 16px;
  }
  .chips-end-spacer { flex: 0 0 6px; min-width: 6px; }
  /* Notice: chips-nav-arrow is now explicitly shown on mobile per user request */
}
/* =====================================
   3. 🌟 HERO BANNER CAROUSEL (GRAB TO SCROLL) 🌟
===================================== */
.shop-main { max-width: 1200px; margin: 0 auto; }
.shop-hero-wrapper { margin: 0 0 32px 0; overflow: hidden; }
.carousel-container {
  position: relative;
  display: flex;
  align-items: center;
}
/* รางเลื่อน */
.banner-track {
  display: flex;
  gap: 24px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  padding: 10px 24px; 
  scroll-behavior: smooth;
  cursor: grab; /* ไอคอนมือตอนเอาเมาส์ชี้ */
}
.banner-track::-webkit-scrollbar { display: none; }
.banner-track.is-dragging {
  cursor: grabbing; /* ไอคอนมือกำตอนลาก */
  scroll-behavior: auto; /* ปิด smooth ชั่วคราวตอนมือลากให้ติดนิ้ว */
  scroll-snap-type: none; 
}
.banner-track.justify-center {
  justify-content: center;
  padding: 10px 0;
  overflow-x: hidden;
  width: 100%;
}
.banner-track.justify-center .hero-card {
  flex: 0 1 min(95%, 1100px);
  scroll-snap-align: none;
  margin: 0 auto;
}
/* การ์ดแบนเนอร์แต่ละใบ */
.hero-card {
  flex: 0 0 85%; 
  scroll-snap-align: center;
  display: flex;
  flex-direction: row;
  background: #fff;
  border-radius: 24px; /* 🌟 ขอบการ์ดโค้งมนเเล้วตามสั่ง */
  box-shadow: 0 4px 20px rgba(0,0,0,0.06);
  border: 1px solid var(--border-light);
  overflow: hidden;
  user-select: none; /* ห้ามคลุมดำตอนลาก */
}
/* ปุ่มลูกศรซ้ายขวา (ในคอม) */
.carousel-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  width: 44px; height: 44px; min-width: 44px; min-height: 44px;
  background: #fff;
  border: 1px solid var(--border-light);
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; aspect-ratio: 1 / 1;
  color: var(--text-dark);
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(0,0,0,0.1);
  transition: 0.2s;
}
.carousel-arrow:hover { color: var(--primary); border-color: var(--primary); }
.left-arrow { left: 10px; }
.right-arrow { right: 10px; }
/* ฝั่งรูปภาพแบนเนอร์ */
.hero-image-side {
  width: 55%;
  background: transparent; /* 🌟 ปรับเป็นโปร่งใสเพื่อลบ "เงา" หรือขอบสีเทาหลังรูปออก 🌟 */
  aspect-ratio: 8/5; /* 🌟 สัดส่วน 800x500 🌟 */
  padding: 16px; /* 🌟 ลดขนาดรูปลงเพื่อให้ขอบการ์ดที่โค้งไม่บังรูป 🌟 */
  box-sizing: border-box;
  display: flex;
}
.hero-image-side img {
  width: 100%; height: 100%; object-fit: cover; pointer-events: none;
  border-radius: 4px; /* 🌟 รักษาความเหลี่ยมเเบบเดิม (เเต่ใส่โค้งนิดเดียวให้ดูพรีเมียม) 🌟 */
}
/* ฝั่งข้อความและปุ่ม */
.hero-content-side {
  width: 45%;
  padding: 32px;
  display: flex; flex-direction: column; justify-content: center;
}
.hero-title { font-size: 22px; font-weight: 800; color: var(--text-dark); margin: 0 0 12px 0; line-height: 1.3; }
.hero-subtitle { font-size: 15px; color: var(--text-gray); margin: 0 0 24px 0; line-height: 1.5; }
.hero-actions { display: flex; gap: 12px; margin-top: auto; }
.btn-hero-solid {
  flex: 1; display: flex; align-items: center; justify-content: center; background: var(--primary); color: #fff; border: none; border-radius: 8px; padding: 12px 16px; font-size: 15px; font-weight: 700; cursor: pointer; transition: 0.2s;
}
.btn-hero-solid:hover { background: #E65F00; }
@media (max-width: 768px) {
  .shop-search-section { padding: 0 16px 20px; }
  .search-pill-container { height: 38px; padding: 0 12px; gap: 8px; }
  .search-icon { width: 16px; height: 16px; }
  .search-pill-container input { font-size: 0.9rem; }
  .carousel-arrow { display: none; } 
  .hero-card { flex: 0 0 92%; flex-direction: column; scroll-snap-align: center; } 
  .hero-image-side { width: 100%; aspect-ratio: 8/5; padding: 12px; }
  .hero-content-side { width: 100%; padding: 16px; }
  .hero-title { font-size: 17px; margin-bottom: 6px; }
  .hero-subtitle { font-size: 13px; margin-bottom: 16px; }
  .btn-hero-solid { width: 100%; padding: 10px; font-size: 14px; }
}
/* =====================================
   4. Categories (Chips)
===================================== */
.shop-categories { padding: 0 24px 24px; }
.section-title-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.section-title-row h3 { font-size: 18px; font-weight: 700; margin: 0; color: var(--text-dark); }
.text-btn { background: none; border: none; color: var(--text-gray); font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 4px; cursor: pointer; transition: color 0.2s; }
.text-btn:hover { color: var(--primary); }
.chips-scroll { display: flex; gap: 12px; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; -webkit-overflow-scrolling: touch; overscroll-behavior-x: contain; }
.chips-scroll::-webkit-scrollbar { display: none; }
.flat-chip { 
  display: inline-flex; 
  align-items: center; 
  background: #fff; 
  border: 1px solid var(--border-light); 
  padding: 0 20px; 
  border-radius: 999px; 
  font-size: 14px; 
  font-weight: 500; 
  color: var(--text-dark); 
  white-space: nowrap; 
  cursor: pointer; 
  transition: all 0.2s ease; 
  flex-shrink: 0; 
  height: 44px;
}
.flat-chip:hover { border-color: #D1D5DB; }
.flat-chip.active { background: var(--primary); color: #fff; border-color: var(--primary); font-weight: 600; }
/* =====================================
   5. Flat Cards Feed
===================================== */
.shop-feed { padding: 0 24px 40px; }
.feed-section { margin-bottom: 40px; }
.flat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 24px 20px; }
.flat-card { display: flex; flex-direction: column; cursor: pointer; opacity: 0; transform: translateY(10px); transition: all 0.4s ease; }
.flat-card.is-visible { opacity: 1; transform: translateY(0); }
.flat-card.is-ended { filter: grayscale(1); opacity: 0.7; }
/* 🌟 Image Container ปรับเป็น 1:1 จัตุรัส 🌟 */
.img-box {
  position: relative; width: 100%; aspect-ratio: 1/1; 
  background: var(--surface); border-radius: 16px; overflow: hidden; margin-bottom: 12px;
}
.img-box img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s ease; }
.flat-card:hover .img-box img { transform: scale(1.05); }
.img-fallback { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: var(--surface); }
.fallback-icon { color: #D1D5DB; }
.dark-badge {
  position: absolute; top: 12px; left: 12px; background: rgba(17, 24, 39, 0.85); backdrop-filter: blur(4px);
  color: #fff; font-size: 11px; font-weight: 600; padding: 6px 12px; border-radius: 8px; letter-spacing: 0.5px;
  z-index: 2;
}
.dark-badge.open { background: rgba(16, 185, 129, 0.9); } /* Green */
.dark-badge.ongoing { background: rgba(59, 130, 246, 0.9); } /* Blue */
.dark-badge.registered { background: rgba(255, 106, 0, 0.9); } /* Primary Orange */
.dark-badge.full { background: rgba(239, 68, 68, 0.9); } /* Red */
.dark-badge.ended { background: rgba(107, 114, 128, 0.9); } /* Gray */
.heart-btn {
  position: absolute; top: 10px; right: 10px;
  width: 32px; height: 32px; min-width: 32px; min-height: 32px; 
  flex-shrink: 0; aspect-ratio: 1 / 1;
  background: white; border-radius: 50%; border: none;
  display: flex; align-items: center; justify-content: center;
  color: var(--text-gray); cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.08); transition: transform 0.2s;
  z-index: 10;
}
.heart-btn:active { transform: scale(0.9); }
.heart-btn.active { color: var(--primary); }
.info-box { padding: 0 4px; }
.title {
  font-size: 14px; font-weight: 600; color: var(--text-dark); margin: 0 0 8px 0; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.meta-row { display: flex; align-items: center; gap: 6px; font-size: 13px; margin-bottom: 4px; }
.meta-row.text-primary { color: var(--primary); font-weight: 600; }
.meta-row.text-gray { color: var(--text-gray); font-weight: 500; }
/* =====================================
   6. Mobile Horizontal Scroll
===================================== */
@media (max-width: 768px) {
  .shop-header { padding: 16px; }
  .shop-search-section { padding: 0 16px 20px; }
  .search-pill-container { padding: 6px 16px; }
  .shop-categories { padding: 0 16px 24px; }
  .shop-feed { padding: 0 0 40px; }
  .section-title-row { padding: 0 16px; }
  .flat-grid.is-horizontal {
    display: flex; overflow-x: auto; overflow-y: hidden;
    scroll-snap-type: x mandatory; gap: 16px; padding: 0 16px; margin: 0;
    scrollbar-width: none; -webkit-overflow-scrolling: touch; overscroll-behavior-x: contain; scroll-padding-left: 16px;
  }
  .flat-grid.is-horizontal::-webkit-scrollbar { display: none; }
  /* ล็อคให้เป็น 2 คอลัมน์ (2x2) สำหรับมือถือทุกรุ่น */
  .flat-grid:not(.is-horizontal) {
    grid-template-columns: repeat(2, 1fr) !important;
    gap: 20px 12px;
    padding: 0 16px;
  }
  .flat-grid.is-horizontal .flat-card { width: 65vw; min-width: 65vw; scroll-snap-align: start; scroll-snap-stop: always; flex-shrink: 0; }
  .flat-grid.is-horizontal::after { content: ''; min-width: 16px; padding-right: 1px; }
  /* Responsive Adjustments for Card Content */
  .title { font-size: 13px; margin-bottom: 6px; }
  .meta-row { font-size: 11px; gap: 4px; margin-bottom: 2px; }
  .meta-row span { line-height: 1.3; }
  .dark-badge { top: 8px; left: 8px; padding: 4px 8px; font-size: 10px; border-radius: 6px; }
  .heart-btn { top: 8px; right: 8px; width: 28px; height: 28px; min-width: 28px; min-height: 28px; }
  .heart-btn svg { width: 14px; height: 14px; }
}
/* =====================================
   7. Utilities (Skeleton, Empty)
===================================== */
.shop-empty { text-align: center; padding: 60px 20px; }
.empty-icon { color: var(--text-gray); margin-bottom: 16px; display: flex; justify-content: center; }
.shop-empty h3 { font-size: 18px; margin: 0 0 8px; }
.shop-empty p { color: var(--text-gray); font-size: 14px; }
.flat-skel { width: 100%; }
.skel-img { aspect-ratio: 1/1; background: var(--surface); border-radius: 16px; animation: pulse 1.5s infinite; }
.skel-line { height: 16px; background: var(--surface); border-radius: 4px; animation: pulse 1.5s infinite; }
.w-full { width: 100%; } .w-half { width: 50%; } .mt-2 { margin-top: 8px; } .mt-3 { margin-top: 12px; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
.loading-dot { width: 8px; height: 8px; background: var(--text-dark); border-radius: 50%; margin: 0 auto; animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite; }
@keyframes ping { 75%, 100% { transform: scale(2); opacity: 0; } }
.infinite-scroll-trigger {
  padding: 48px 0;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  min-height: 100px;
}
.loading-more {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: var(--text-gray);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
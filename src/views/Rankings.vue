<template>
    <div class="rank-app">
        <div
            v-if="isDropdownOpen"
            class="dropdown-backdrop"
            @click="isDropdownOpen = false"
        ></div>
        <div class="detail-view">
            <div class="layout-wrapper">
                <header class="detail-header">
                    <div class="breadcrumb-container relative">
                        <div class="breadcrumb-flat">
                            <ChevronRight
                                class="bc-separator-flat"
                                :size="14"
                            />
                            <div class="bc-dropdown-wrapper">
                                <button
                                    class="bc-active-flat"
                                    @click="isDropdownOpen = !isDropdownOpen"
                                    :class="{ 'is-open': isDropdownOpen }"
                                >
                                    <span class="bc-text-flat">{{
                                        currentActivityTitle
                                    }}</span>
                                    <ChevronDown
                                        class="bc-chevron-flat"
                                        :size="14"
                                        :class="{
                                            'rotate-180': isDropdownOpen,
                                        }"
                                    />
                                </button>
                                <transition name="dropdown-fade">
                                    <div
                                        v-if="isDropdownOpen"
                                        class="activity-dropdown-card"
                                    >
                                        <div class="dropdown-search">
                                            <Search
                                                class="search-icon"
                                                :size="16"
                                            />
                                            <input
                                                type="text"
                                                v-model="activitySearch"
                                                :placeholder="langStore.t('search_activity')"
                                                class="dropdown-search-input"
                                            />
                                        </div>
                                        <div
                                            class="dropdown-list"
                                            @scroll="handleDropdownScroll"
                                        >
                                            <div
                                                class="dropdown-item"
                                                :class="{
                                                    'is-selected':
                                                        !selectedActivityId,
                                                }"
                                                @click="
                                                    handleSelectActivity(null)
                                                "
                                            >
                                                <div
                                                    class="di-name text-primary font-bold"
                                                >
                                                    {{ langStore.t('rank_overall') }}
                                                </div>
                                                <div class="di-desc">
                                                    VitalCare System
                                                </div>
                                            </div>
                                            <div
                                                v-for="act in visibleActivities"
                                                :key="act.id"
                                                class="dropdown-item"
                                                :class="{
                                                    'is-selected':
                                                        String(act.id) ===
                                                        String(
                                                            selectedActivityId,
                                                        ),
                                                }"
                                                @click="
                                                    handleSelectActivity(act.id)
                                                "
                                            >
                                                <div class="di-name">
                                                    {{ act.title }}
                                                </div>
                                                <div class="di-desc">
                                                    {{ langStore.t('challenge_activity') }}
                                                </div>
                                            </div>
                                            <div
                                                v-if="
                                                    filteredActivities.length ===
                                                        0 && activitySearch
                                                "
                                                class="empty-search"
                                            >
                                                {{ langStore.t('no_activity_found') }}
                                            </div>
                                            <div
                                                v-if="
                                                    visibleActivities.length <
                                                    filteredActivities.length
                                                "
                                                class="loading-more"
                                            >
                                                {{ langStore.t('loading_more') }}
                                            </div>
                                        </div>
                                    </div>
                                </transition>
                            </div>
                        </div>
                    </div>
                </header>
                <main class="main-content">
                    <div class="page-banner">
                        <div class="banner-text">
                            <h2>{{ currentActivityTitle }}</h2>
                            <p>{{ langStore.t('rank_subtitle') }}</p>
                        </div>
                    </div>
                    <div class="tabs-container">
                        <button
                            class="tab-btn"
                            :class="{ active: activeTab === 'individual' }"
                            @click="switchTab('individual')"
                        >
                            {{ langStore.t('rank_individual') }}
                        </button>
                        <button
                            class="tab-btn"
                            :class="{ active: activeTab === 'team' }"
                            @click="switchTab('team')"
                        >
                            {{ langStore.t('rank_team') }}
                        </button>
                    </div>


                    <div class="leaderboard-card">
                        <div class="list-header">
                            <div class="col-rank">{{ langStore.t('rank_col') }}</div>
                            <div class="col-name">
                                {{ activeTab === 'individual' ? langStore.t('rank_username') : langStore.t('rank_teamname') }}
                            </div>
                            <div class="col-score">
                                {{ isPoints ? langStore.t('points') : rankingUnitLong }}
                            </div>
                        </div>
                        <div v-if="loading" class="loading-state">
                            <div class="spinner"></div>
                            <p>{{ langStore.t('loading_data') }}</p>
                        </div>
                        <div
                            v-else-if="tableRows.length === 0 || !tableRows[0]"
                            class="empty-state"
                        >
                            <div class="empty-icon">
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="1.5"
                                    width="48"
                                    height="48"
                                >
                                    <path
                                        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                                    />
                                </svg>
                            </div>
                            <p>{{ langStore.t('rank_no_data') }}</p>
                        </div>
                        <div v-else class="list-body">
                            <template
                                v-for="(item, idx) in tableRows"
                                :key="idx"
                            >
                                <div
                                    v-if="item"
                                    class="list-row"
                                    :class="{
                                        'is-me': isCurrentUser(item),
                                        'top-3': item.rank <= 3,
                                    }"
                                    @click="handleItemClick(item)"
                                >
                                    <div class="col-rank">
                                        <span
                                            v-if="item.rank === 1"
                                            class="medal gold"
                                            >1</span
                                        >
                                        <span
                                            v-else-if="item.rank === 2"
                                            class="medal silver"
                                            >2</span
                                        >
                                        <span
                                            v-else-if="item.rank === 3"
                                            class="medal bronze"
                                            >3</span
                                        >
                                        <span v-else class="rank-num">{{
                                            item.rank ||
                                            (currentPage - 1) * PAGE_SIZE +
                                                Number(idx) +
                                                1
                                        }}</span>
                                    </div>
                                    <div class="col-name">
                                        <div
                                            v-if="activeTab === 'individual'"
                                            class="avatar"
                                        >
                                            <img
                                                v-if="getImage(item)"
                                                :src="getImage(item)"
                                            />
                                            <span v-else>{{
                                                getInitial(item)
                                            }}</span>
                                        </div>
                                        <div class="name-text flex items-center gap-2">
                                            <span>{{ getName(item) }}</span>
                                            <UserTitle 
                                                v-if="item.equipped_title_name"
                                                :name="item.equipped_title_name"
                                                :rarity="item.equipped_title_rarity"
                                                :color="item.equipped_title_color"
                                                size="sm"
                                            />
                                            <!-- 🔥 Streak Badge (individual tab only) -->
                                            <span
                                                v-if="activeTab === 'individual' && item.streak >= 1"
                                                class="streak-badge"
                                                :class="{
                                                    'streak-hot': item.streak >= 7,
                                                    'streak-warm': item.streak >= 3 && item.streak < 7,
                                                    'streak-cool': item.streak < 3
                                                }"
                                                :title="`${item.streak} วันติดต่อกัน`"
                                            >🔥 {{ item.streak }}</span>
                                        </div>
                                    </div>
                                    <div class="col-score">
                                        <span class="score-val">{{
                                            formatDist(getDistance(item))
                                        }}</span>
                                        <span class="score-unit">{{ isPoints ? langStore.t('points') : rankingUnitShort }}</span>
                                    </div>
                                </div>
                            </template>
                        </div>
                        <div
                            v-if="!loading && tableRows[0]"
                            class="flex justify-center pt-6 pb-6 border-t border-slate-100"
                        >
                            <AppPagination
                                :currentPage="currentPage"
                                :totalPages="
                                    hasMore ? currentPage + 1 : currentPage
                                "
                                @change="changePage"
                            />
                        </div>
                    </div>
                </main>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useRankings } from "../composables/useRankings";
import { ChevronRight, ChevronDown, Search } from "lucide-vue-next";
import AppPagination from "../components/common/AppPagination.vue";
import UserTitle from "../components/UserTitle.vue";
import { langStore } from "../store/lang";

const {
    PAGE_SIZE,
    authStore,
    activitySearch,
    selectedActivityId,
    filteredActivities,
    visibleActivities,
    activeTab,
    loading,
    rankingUnitLong,
    rankingUnitShort,
    isPoints,
    currentPage,
    currentList,
    tableRows,
    hasMore,
    userRank,
    userActivityScore,
    userTeamActivityScore,
    selectActivity,
    formatDist,
    getName,
    getInitial,
    getDistance,
    getImage,
    isCurrentUser,
    changePage,
    switchTab,
    handleItemClick,
    scrollToMyRank,
    loadMoreActivities,
} = useRankings();

const isDropdownOpen = ref(false);

const handleDropdownScroll = (e) => {
    const target = e.target;
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 20) {
        loadMoreActivities();
    }
};

const currentActivityTitle = computed(() => {
    if (!selectedActivityId.value) return langStore.t('rank_overall');
    const act = filteredActivities.value.find(
        (a) => String(a.id) === String(selectedActivityId.value),
    );
    return act ? act.title : langStore.t('rankings');
});

const handleSelectActivity = (id) => {
    selectActivity(id);
    isDropdownOpen.value = false;
};
</script>

<style scoped>
/* นำเข้าฟอนต์ Sarabun จาก Google Fonts */
@import url("https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap");

/* 🔥 Streak Badge */
.streak-badge {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 2px 8px;
    border-radius: 99px;
    font-size: 0.72rem;
    font-weight: 700;
    white-space: nowrap;
    flex-shrink: 0;
    transition: transform 0.2s;
}
.streak-badge:hover { transform: scale(1.08); }
.streak-hot {
    background: linear-gradient(135deg, #ff6a00, #ee0979);
    color: #fff;
    box-shadow: 0 2px 8px rgba(255,106,0,0.4);
    animation: streak-pulse 1.8s infinite;
}
.streak-warm {
    background: #fff0e6;
    color: #ea580c;
    border: 1px solid #fed7aa;
}
.streak-cool {
    background: #f1f5f9;
    color: #64748b;
    border: 1px solid #e2e8f0;
}
@keyframes streak-pulse {
    0%, 100% { box-shadow: 0 2px 8px rgba(255,106,0,0.4); }
    50% { box-shadow: 0 4px 16px rgba(238,9,121,0.5); }
}

.rank-app {
    --primary: #ff6a00;
    --primary-light: #fff0e6;
    --primary-hover: #e65f00;
    --bg-color: #ffffff;
    --surface: #ffffff;
    --text-main: #1e293b;
    --text-muted: #64748b;
    --border: #e2e8f0;
    --radius-lg: 16px;
    --radius-md: 12px;
}

* {
    box-sizing: border-box;
}

.rank-app {
    background-color: var(--bg-color);
    min-height: 100vh;
    color: var(--text-main);
    /* เปลี่ยนให้ใช้ฟอนต์ Sarabun เป็นหลัก */
    font-family: "Sarabun", sans-serif;
}

.dropdown-backdrop {
    position: fixed;
    inset: 0;
    z-index: 30; /* Changed from 90 to 30 so it sits behind the header (z-index 40) */
    cursor: default;
}

.relative {
    position: relative;
}

.detail-view {
    background-color: var(--bg-color);
    min-height: 100vh;
}

.layout-wrapper {
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    padding: 24px;
    min-height: 100vh;
}

/* 🌟 Alignment Sync with Profile.vue & Activities.vue 🌟 */
@media (min-width: 768px) {
    .layout-wrapper {
        max-width: 1440px;
        padding: 40px 24px;
    }
}

/* Breadcrumb Styling - Flat style matching image */
.detail-header {
    padding: 12px 0 24px 0;
    position: relative;
    z-index: 40;
}

.breadcrumb-container {
    display: flex;
    align-items: center;
}

.breadcrumb-flat {
    display: flex;
    align-items: center;
    gap: 8px;
    width: max-content;
}

.bc-root-flat {
    font-weight: 500;
    color: #3b82f6; /* Blueish color like the image */
    font-size: 0.95rem;
}

.bc-separator-flat {
    color: #94a3b8;
}

.bc-dropdown-wrapper {
    position: relative;
}

.bc-active-flat {
    display: flex;
    align-items: center;
    gap: 4px;
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 2px 0;
    transition: all 0.2s;
    color: #111827; /* Dark slate */
}

.bc-active-flat:hover {
    opacity: 0.8;
}

.bc-text-flat {
    font-weight: 700;
    font-size: 1rem;
    max-width: 250px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.bc-chevron-flat {
    transition: transform 0.3s;
    color: #6b7280;
    margin-top: 1px;
}

.rotate-180 {
    transform: rotate(180deg);
}

/* Dropdown Menu Styling */
.activity-dropdown-card {
    position: absolute;
    top: calc(100% + 12px);
    left: 0;
    width: 320px;
    background: white;
    border-radius: 16px;
    box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.15);
    border: 1px solid var(--border);
    z-index: 100;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

/* Transitions */
.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
    transition:
        opacity 0.2s,
        transform 0.2s;
}

.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
    opacity: 0;
    transform: translateY(-10px);
}

.dropdown-search {
    padding: 12px 16px;
    border-bottom: 1px solid #f1f5f9;
    display: flex;
    align-items: center;
    gap: 8px;
}

.search-icon {
    color: #94a3b8;
}

.dropdown-search-input {
    flex: 1;
    border: none;
    outline: none;
    font-size: 0.95rem;
    font-family: inherit;
    color: var(--text-main);
}

.dropdown-search-input::placeholder {
    color: #94a3b8;
}

.dropdown-list {
    max-height: 350px;
    overflow-y: auto;
    padding: 8px;
    overscroll-behavior: contain; /* Prevents scrolling the main page when reaching the end */
}

/* Scrollbar for dropdown */
.dropdown-list::-webkit-scrollbar {
    width: 6px;
}

.dropdown-list::-webkit-scrollbar-track {
    background: transparent;
}

.dropdown-list::-webkit-scrollbar-thumb {
    background: #e2e8f0;
    border-radius: 4px;
}

.dropdown-item {
    padding: 10px 12px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    margin-bottom: 2px;
}

.dropdown-item:hover {
    background: #f8fafc;
}

.dropdown-item.is-selected {
    background: var(--primary-light);
}

.di-name {
    font-weight: 600;
    color: var(--text-main);
    font-size: 0.95rem;
    margin-bottom: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.dropdown-item.is-selected .di-name {
    color: var(--primary);
}

.di-desc {
    font-size: 0.8rem;
    color: var(--text-muted);
}

.empty-search {
    padding: 24px;
    text-align: center;
    color: var(--text-muted);
    font-size: 0.9rem;
}

.loading-more {
    padding: 12px;
    text-align: center;
    font-size: 0.85rem;
    color: #94a3b8;
}

.hamburger-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: #ffffff;
    border: 1.5px solid var(--border);
    border-radius: 99px;
    padding: 8px 24px;
    color: var(--text-muted);
    font-size: 1rem;
    font-family: inherit;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
}

.hamburger-btn:hover {
    border-color: var(--primary);
    box-shadow: 0 4px 12px rgba(255, 106, 0, 0.1);
}

.hamburger-btn svg {
    width: 20px;
    height: 20px;
}

.hamburger-text {
    margin-top: 2px;
}

.main-content {
    min-width: 0;
}

.page-banner {
    background: linear-gradient(135deg, #ff9a44 0%, #ff6a00 100%);
    border-radius: var(--radius-lg);
    padding: 32px;
    color: white;
    margin-bottom: 24px;
}

.banner-text h2 {
    margin: 0 0 8px 0;
    font-size: 1.8rem;
    font-weight: 700;
    color: #ffffff;
}

.banner-text p {
    margin: 0;
    opacity: 0.9;
    font-size: 1.05rem;
}

.tabs-container {
    display: flex;
    background: var(--surface);
    padding: 6px;
    border-radius: var(--radius-md);
    margin-bottom: 20px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.02);
}

.tab-btn {
    flex: 1;
    padding: 12px;
    border: none;
    background: transparent;
    border-radius: 8px;
    font-family: inherit;
    font-weight: 600;
    font-size: 1rem;
    color: var(--text-muted);
    cursor: pointer;
    transition: 0.3s;
}

.tab-btn.active {
    background: var(--primary);
    color: white;
    box-shadow: 0 4px 12px rgba(255, 106, 0, 0.3);
}

.leaderboard-card {
    background: var(--surface);
    border-radius: var(--radius-lg);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
    overflow: hidden;
}

.list-header {
    display: flex;
    padding: 16px 20px;
    background: #f8fafc;
    border-bottom: 1px solid var(--border);
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
}

.col-rank {
    width: 60px;
    text-align: center;
    flex-shrink: 0;
}

.col-name {
    flex: 1;
    min-width: 0;
}

.col-score {
    width: 120px;
    text-align: right;
    flex-shrink: 0;
}

.list-row {
    display: flex;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
    transition: 0.2s;
}

.list-row:hover {
    background: #f8fafc;
}

.list-row.is-me {
    background: #fff7ed;
    border-left: 4px solid var(--primary);
}

.list-row.is-me:hover {
    background: #ffedd5;
}

.medal {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    min-width: 28px;
    min-height: 28px;
    border-radius: 50%;
    font-weight: 700;
    font-size: 0.85rem;
    color: white;
    flex-shrink: 0;
    aspect-ratio: 1/1;
}

.medal.gold {
    background: #f59e0b;
    box-shadow: 0 2px 4px rgba(245, 158, 11, 0.3);
}

.medal.silver {
    background: #9ca3af;
    box-shadow: 0 2px 4px rgba(156, 163, 175, 0.3);
}

.medal.bronze {
    background: #d97706;
    box-shadow: 0 2px 4px rgba(217, 119, 6, 0.3);
}

.rank-num {
    font-weight: 600;
    color: var(--text-muted);
}

.col-name {
    display: flex;
    align-items: center;
    gap: 16px;
    overflow: hidden;
}

.avatar {
    width: 40px;
    height: 40px;
    min-width: 40px;
    min-height: 40px;
    border-radius: 50%;
    background: #e2e8f0;
    display: flex;
    justify-content: center;
    align-items: center;
    font-weight: bold;
    overflow: hidden;
    color: var(--text-muted);
    flex-shrink: 0;
    aspect-ratio: 1/1;
}

.avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.name-text {
    font-weight: 500;
    font-size: 1.05rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.col-score {
    display: flex;
    justify-content: flex-end;
    align-items: baseline;
    gap: 4px;
}

.score-val {
    font-weight: 700;
    font-size: 1.1rem;
}

.score-unit {
    font-size: 0.85rem;
    color: var(--text-muted);
}

.loading-state,
.empty-state {
    padding: 60px 20px;
    text-align: center;
    color: var(--text-muted);
}

.spinner {
    width: 30px;
    height: 30px;
    min-width: 30px;
    min-height: 30px;
    border: 3px solid var(--border);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 16px;
    flex-shrink: 0;
    aspect-ratio: 1/1;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

.empty-icon {
    color: var(--text-muted);
    opacity: 0.5;
    margin-bottom: 12px;
    display: flex;
    justify-content: center;
}

/* --- Responsive Adjustments --- */
@media (max-width: 768px) {
    .layout-wrapper {
        padding: 16px 16px 100px 16px;
    }
    .page-banner {
        padding: 24px 16px;
    }
    .banner-text h2 {
        font-size: 1.5rem;
    }
    .col-rank {
        width: 50px;
    }
    .col-score {
        width: 90px;
    }
    .score-val {
        font-size: 1.05rem;
    }
    .activity-dropdown-card {
        position: fixed;
        top: 72px; /* right below header */
        left: 16px;
        right: 16px;
        width: auto;
        max-width: none;
    }
}

@media (max-width: 480px) {
    .list-header {
        padding: 12px 16px;
        font-size: 0.8rem;
    }
    .list-row {
        padding: 12px 16px;
    }
    .col-rank {
        width: 40px;
    }
    .col-name {
        gap: 10px;
    }
    .avatar {
        width: 32px;
        height: 32px;
        min-width: 32px;
        min-height: 32px;
    }
    .name-text {
        font-size: 0.95rem;
    }
    .col-score {
        width: auto;
        min-width: 70px;
    }
    .score-val {
        font-size: 1rem;
    }
    .score-unit {
        font-size: 0.75rem;
    }
    .tab-btn {
        font-size: 0.9rem;
        padding: 10px;
    }
    .bc-root-flat {
        display: none;
    } /* Hide "VitalCare" on very small screens */
    .bc-separator-flat {
        display: none;
    }
}
</style>
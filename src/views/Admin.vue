<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from "vue";
import {
    Users,
    LayoutDashboard,
    PlusCircle,
    LogOut,
    ChevronLeft,
    Menu,
    Image,
    Clock,
    ShieldAlert,
    Users2,
    ArrowLeft,
    ShieldCheck,
    Settings,
    BookOpen,
    ExternalLink,
    Medal,
} from "lucide-vue-next";
import { useRoute, useRouter } from "vue-router";
import { authStore } from "../store/auth";
import { uiStore } from "../store/ui";
import { langStore } from "../store/lang";
import AdminOverview from "../components/admin/AdminOverview.vue";
import AdminUsers from "../components/admin/AdminUsers.vue";
import AdminActivities from "../components/admin/AdminActivities.vue";
import AdminBanners from "../components/admin/AdminBanners.vue";
import AdminTeam from "../components/admin/AdminTeam.vue";
import AdminLogs from "../components/admin/AdminLogs.vue";
import AdminTitle from "../components/admin/AdminTitle.vue";
const route = useRoute();
const router = useRouter();
const activeTab = ref("");
const resetCounter = ref(0);
const isSidebarOpen = ref(true);
const isMobile = ref(false);
const isMobileMenuOpen = ref(false);
const checkMobile = () => {
    isMobile.value = window.innerWidth <= 768;
    if (!isMobile.value) isMobileMenuOpen.value = false;
};
// ─── Organized Grouped Tabs ───────────────────────────────────────────────
const ADMIN_GROUPS = computed(() => [
    {
        title: "Dashboard",
        items: [
            { id: "overview", label: langStore.locale === 'th' ? "แดชบอร์ดภาพรวม" : "Overview", icon: LayoutDashboard },
        ],
    },
    {
        title: langStore.locale === 'th' ? "การจัดการ" : "Management",
        items: [
            { id: "users", label: langStore.locale === 'th' ? "จัดการสมาชิก" : "Manage Users", icon: Users },
            { id: "activities", label: langStore.locale === 'th' ? "จัดการกิจกรรม" : "Manage Activities", icon: PlusCircle },
            { id: "teams", label: langStore.locale === 'th' ? "จัดการทีม" : "Manage Teams", icon: Users2 },
            { id: "banners", label: langStore.locale === 'th' ? "จัดการแบนเนอร์" : "Manage Banners", icon: Image },
            { id: "titles", label: langStore.locale === 'th' ? "จัดการฉายา" : "Manage Titles", icon: Medal },
        ],
    },
    {
        title: langStore.locale === 'th' ? "การตั้งค่าระบบ" : "System Settings",
        items: [
            { id: "logs", label: langStore.locale === 'th' ? "Logs ระบบ" : "System Logs", icon: ShieldCheck },
            { id: "docs", label: langStore.locale === 'th' ? "คู่มือผู้ดูแลระบบ" : "Admin Manual", icon: BookOpen },
        ],
    },
]);
const HOST_GROUPS = computed(() => [
    {
        title: langStore.locale === 'th' ? "การจัดการ" : "Management",
        items: [{ id: "activities", label: langStore.locale === 'th' ? "กิจกรรมของฉัน" : "My Activities", icon: Users2 }],
    },
]);
const currentGroups = computed(() => {
    const role = authStore.user?.role?.toLowerCase();
    return role === "admin" ? ADMIN_GROUPS.value : HOST_GROUPS.value;
});

const ADMIN_DOCS = computed(() => [
    { label: langStore.locale === 'th' ? "คู่มือผู้ดูแลระบบ (ไทย)" : "Admin Manual (TH)", path: "/docs/คู่มือผู้ดูแลระบบ.pdf" },
    { label: "Admin Manual", path: "/docs/manual_3O2S.pdf" },
]);

const selectedDocPath = ref(ADMIN_DOCS.value[0].path);
const selectedDocUrl = computed(() => encodeURI(selectedDocPath.value));
const openDocInNewTab = () => window.open(selectedDocUrl.value, "_blank");
// ─── Lifecycle ────────────────────────────────────────────────────────────
onMounted(() => {
    const user = authStore.user;
    const isAdmin = user?.role?.toLowerCase() === "admin";
    if (!user || !isAdmin) {
        router.push("/");
        return;
    }
    if (route?.query?.tab) {
        activeTab.value = String(route.query.tab);
    } else {
        activeTab.value = "overview";
    }
    checkMobile();
    window.addEventListener("resize", checkMobile);
});
onUnmounted(() => {
    window.removeEventListener("resize", checkMobile);
});
watch(
    () => route?.query?.tab,
    (newTab) => {
        if (newTab) activeTab.value = String(newTab);
    },
);
watch(
    () => authStore.user?.role,
    (newRole) => {
        const role = newRole?.toLowerCase();
        activeTab.value = role === "admin" ? "overview" : "activities";
    },
);

watch(activeTab, (tab) => {
    if (tab === "docs" && !selectedDocPath.value) {
        selectedDocPath.value = ADMIN_DOCS.value[0].path;
    }
});
// ─── Actions ─────────────────────────────────────────────────────────────
const selectTab = (id: string) => {
    if (activeTab.value === id) {
        // Increment counter to force component re-mount via :key
        resetCounter.value++;
        // Force clear all other query params to return to base state
        router.replace({
            path: "/admin",
            query: { tab: id, _r: resetCounter.value },
        });
    } else {
        activeTab.value = id;
        resetCounter.value = 0; // Reset counter for new tab
        router.replace({ path: "/admin", query: { tab: id } });
    }
    isMobileMenuOpen.value = false;
    const viewport = document.querySelector(".content-viewport");
    if (viewport) viewport.scrollTo({ top: 0, behavior: "smooth" });
};
const exitAdmin = () => {
    authStore.isAdminMode = false;
    router.push("/");
};
</script>
<template>
    <div
        class="admin-layout"
        :class="{ 'is-mobile': isMobile }"
        :style="{
            '--sidebar-width': isMobile
                ? '0px'
                : isSidebarOpen
                  ? '260px'
                  : '72px',
        }"
    >
        <!-- ── SIDEBAR ─────────────────────────────────────── -->
        <aside
            v-if="!isMobile"
            class="admin-sidebar"
            :class="{ collapsed: !isSidebarOpen }"
        >
            <div class="sidebar-header" :class="{ center: !isSidebarOpen }">
                <div class="sidebar-logo">
                    <img src="/logo.png" class="logo-img" alt="Logo" />
                    <span v-if="isSidebarOpen" class="logo-text"
                        >VitalCare</span
                    >
                </div>
                <button
                    class="sidebar-toggle-btn-inner"
                    @click="isSidebarOpen = !isSidebarOpen"
                >
                    <ChevronLeft v-if="isSidebarOpen" :size="16" />
                    <Menu v-else :size="16" />
                </button>
            </div>
            <nav class="sidebar-nav scrollbar-hidden">
                <div
                    v-for="group in currentGroups"
                    :key="group.title"
                    class="nav-group"
                >
                    <p v-if="isSidebarOpen" class="sidebar-section-title">
                        {{ group.title }}
                    </p>
                    <div class="group-items">
                        <button
                            v-for="tab in group.items"
                            :key="tab.id"
                            :class="[
                                'nav-item',
                                { active: activeTab === tab.id },
                            ]"
                            @click="selectTab(tab.id)"
                            :title="!isSidebarOpen ? tab.label : ''"
                        >
                            <div class="item-icon">
                                <component :is="tab.icon" :size="20" />
                            </div>
                            <span v-if="isSidebarOpen" class="item-label">{{
                                tab.label
                            }}</span>
                        </button>
                    </div>
                </div>
                <div class="nav-spacer" />
                <div class="sidebar-footer">
                    <button class="nav-item exit-btn" @click="exitAdmin">
                        <LogOut :size="20" />
                        <span v-if="isSidebarOpen">{{ langStore.locale === 'th' ? 'ออกจากโหมดจัดการ' : 'Exit Admin Mode' }}</span>
                    </button>
                </div>
            </nav>
        </aside>
        <!-- ── MAIN CONTENT ──────────────────────────────────────────── -->
        <main class="admin-main">
            <!-- Mobile Header -->
            <header v-if="isMobile" class="admin-header">
                <div class="header-inner">
                    <div class="header-left mobile-brand">
                        <img
                            src="/logo.png"
                            alt="Logo"
                            class="mobile-logo-img"
                        />
                        <div class="mobile-brand-text">
                            <span class="brand-name">VitalCare</span>
                            <span class="brand-badge">Admin</span>
                        </div>
                    </div>
                    <div class="header-right gap-3">
                        <button
                            class="hamburger-btn"
                            :class="{ 'is-active': isMobileMenuOpen }"
                            @click="isMobileMenuOpen = !isMobileMenuOpen"
                        >
                            <span class="line" />
                            <span class="line" />
                        </button>
                    </div>
                </div>
            </header>
            <!-- Mobile Menu Overlay -->
            <transition name="mobile-menu-fade">
                <div
                    v-if="isMobile && isMobileMenuOpen"
                    class="mobile-fullscreen-menu"
                >
                    <div class="mobile-menu-content">
                        <div
                            v-for="group in currentGroups"
                            :key="group.title"
                            class="mobile-group"
                        >
                            <p class="mobile-group-title">{{ group.title }}</p>
                            <div class="mobile-group-card">
                                <button
                                    v-for="tab in group.items"
                                    :key="tab.id"
                                    class="mobile-nav-item"
                                    :class="{ active: activeTab === tab.id }"
                                    @click="selectTab(tab.id)"
                                >
                                    <component
                                        :is="tab.icon"
                                        :size="20"
                                        :stroke-width="
                                            activeTab === tab.id ? 2.5 : 2
                                        "
                                    />
                                    <span>{{ tab.label }}</span>
                                </button>
                            </div>
                        </div>
                        <div class="mobile-group mt-2">
                            <div class="mobile-group-card">
                                <button
                                    class="mobile-nav-item mobile-logout-btn"
                                    @click="exitAdmin"
                                >
                                    <LogOut :size="20" />
                                    <span>{{ langStore.locale === 'th' ? 'ออกจากโหมดจัดการ' : 'Exit Admin Mode' }}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </transition>
            <!-- Content Viewport -->
            <div class="content-viewport scrollbar-custom">
                <transition name="view-fade" mode="out-in">
                    <div :key="activeTab + resetCounter">
                        <AdminOverview
                            v-if="activeTab === 'overview'"
                            @change-tab="selectTab"
                        />
                        <AdminUsers v-else-if="activeTab === 'users'" />
                        <AdminActivities
                            v-else-if="activeTab === 'activities'"
                        />
                        <AdminTeam v-else-if="activeTab === 'teams'" />
                        <AdminBanners v-else-if="activeTab === 'banners'" />
                        <AdminLogs v-else-if="activeTab === 'logs'" />
                        <AdminTitle v-else-if="activeTab === 'titles'" />
                        <div
                            v-else-if="activeTab === 'docs'"
                            class="p-4 sm:p-6 lg:p-8"
                        >
                            <div
                                class="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 mb-4 sm:mb-5"
                            >
                                <div
                                    class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                                >
                                    <div>
                                        <h2
                                            class="text-lg sm:text-xl font-bold text-slate-800"
                                        >
                                            {{ langStore.locale === 'th' ? 'คู่มือผู้ดูแลระบบ' : 'Admin Manual' }}
                                        </h2>
                                        <p class="text-sm text-slate-500 mt-1">
                                            {{ langStore.locale === 'th' ? 'เลือกไฟล์คู่มือและอ่าน PDF ได้จากหน้านี้' : 'Select a manual and read PDF from this page' }}
                                        </p>
                                    </div>
                                    <button
                                        @click="openDocInNewTab"
                                        class="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 text-white text-sm font-semibold hover:bg-slate-900 transition-colors"
                                    >
                                        <ExternalLink :size="16" />
                                        {{ langStore.locale === 'th' ? 'เปิดในแท็บใหม่' : 'Open in new tab' }}
                                    </button>
                                </div>
                            </div>

                            <div
                                class="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 mb-4 sm:mb-5"
                            >
                                <label
                                    class="text-sm font-semibold text-slate-700"
                                    >{{ langStore.locale === 'th' ? 'เลือกเอกสาร' : 'Select Document' }}</label
                                >
                                <select
                                    v-model="selectedDocPath"
                                    class="mt-2 w-full sm:max-w-md px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                                >
                                    <option
                                        v-for="doc in ADMIN_DOCS"
                                        :key="doc.path"
                                        :value="doc.path"
                                    >
                                        {{ doc.label }}
                                    </option>
                                </select>
                            </div>

                            <div
                                class="bg-white border border-slate-200 rounded-2xl overflow-hidden"
                                style="
                                    height: calc(100vh - 300px);
                                    min-height: 500px;
                                "
                            >
                                <iframe
                                    :src="selectedDocUrl"
                                    title="Admin Documentation PDF"
                                    class="w-full h-full"
                                />
                            </div>
                        </div>
                    </div>
                </transition>
            </div>
        </main>
    </div>
</template>
<style scoped>
.admin-layout {
    display: flex;
    height: 100vh;
    background: #ffffff;
    color: #0f172a;
    overflow: hidden;
}
/* ── Sidebar ────────────────────────────────────── */
.admin-sidebar {
    width: 260px;
    background: #fff;
    border-right: 1px solid #e2e8f0;
    display: flex;
    flex-direction: column;
    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 100;
    position: relative;
}
.admin-sidebar.collapsed {
    width: 72px;
}
.sidebar-header {
    height: 72px;
    padding: 0 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid #f1f5f9;
}
.admin-sidebar.collapsed .sidebar-header {
    justify-content: center;
    padding: 0;
}
.sidebar-logo {
    display: flex;
    align-items: center;
    gap: 10px;
    overflow: hidden;
}
.logo-img {
    width: 32px;
    height: 32px;
    object-fit: contain;
}
.logo-text {
    font-weight: 900;
    color: #1e293b;
    font-size: 1.25rem;
    letter-spacing: -0.04em;
    white-space: nowrap;
}
.sidebar-toggle-btn-inner {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: #64748b;
    transition: all 0.2s;
    border-radius: 8px;
}
.sidebar-toggle-btn-inner:hover {
    background: #f97316;
    color: #fff;
    border-color: #f97316;
}
.admin-sidebar.collapsed .sidebar-toggle-btn-inner {
    width: 40px;
    height: 40px;
    border-radius: 12px;
}
.admin-sidebar.collapsed .sidebar-logo {
    display: none;
}
.sidebar-nav {
    flex: 1;
    padding: 20px 12px;
    display: flex;
    flex-direction: column;
    gap: 24px;
    overflow-y: auto;
}
.nav-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
}
.sidebar-section-title {
    font-size: 0.65rem;
    font-weight: 800;
    color: #475569;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin: 0 12px 6px;
}
.group-items {
    display: flex;
    flex-direction: column;
    gap: 2px;
}
.nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border: none;
    background: transparent;
    color: #334155;
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;
    font-weight: 800;
    border-radius: 10px;
    text-align: left;
    width: 100%;
    justify-content: flex-start;
}
.nav-item:hover {
    background: #f1f5f9;
    color: #0f172a;
}
.nav-item.active {
    background: #fff7ed;
    color: #f97316;
    font-weight: 900;
}
.item-icon {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
}
.badge-dot {
    position: absolute;
    top: -2px;
    right: -2px;
    width: 8px;
    height: 8px;
    background: #ef4444;
    border-radius: 50%;
    border: 2px solid #fff;
}
.item-label {
    flex: 1;
    font-size: 0.9rem;
}
.badge-count {
    background: #ef4444;
    color: #fff;
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 99px;
    font-weight: 700;
}
.admin-sidebar.collapsed .nav-item {
    justify-content: center;
    padding: 12px 0;
}
.admin-sidebar.collapsed .sidebar-section-title {
    display: none;
}
.nav-spacer {
    flex: 1;
}
.sidebar-footer {
    border-top: 1px solid #f1f5f9;
    padding-top: 12px;
}
.exit-btn {
    color: #dc2626;
}
.exit-btn:hover {
    background: #fef2f2;
}
/* ── Main ───────────────────────────────────────── */
.admin-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    background: #ffffff;
}
.admin-header {
    background: #fff;
    border-bottom: 1px solid #e2e8f0;
    flex-shrink: 0;
    z-index: 50;
}
.header-inner {
    height: 64px;
    padding: 0 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
}
.mobile-brand {
    display: flex;
    align-items: center;
    gap: 8px;
}
.mobile-logo-img {
    width: 30px;
    height: 30px;
    object-fit: contain;
}
.mobile-brand-text {
    display: flex;
    align-items: baseline;
    gap: 6px;
}
.brand-name {
    font-weight: 900;
    color: #1e293b;
    font-size: 1.15rem;
    letter-spacing: -0.02em;
}
.brand-badge {
    background: #f97316;
    color: white;
    font-size: 0.65rem;
    font-weight: 800;
    padding: 2px 6px;
    border-radius: 6px;
    text-transform: uppercase;
}
.hamburger-btn {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 6px;
    width: 40px;
    height: 40px;
    background: transparent;
    border: none;
    cursor: pointer;
}
.hamburger-btn .line {
    width: 20px;
    height: 2px;
    background: #475569;
    transition: transform 0.3s;
    border-radius: 2px;
}
.hamburger-btn.is-active .line:nth-child(1) {
    transform: translateY(4px) rotate(45deg);
}
.hamburger-btn.is-active .line:nth-child(2) {
    transform: translateY(-4px) rotate(-45deg);
}
.content-viewport {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
    background: #ffffff;
}
@media (max-width: 768px) {
    .content-viewport {
        padding: 16px;
    }
}
.mobile-fullscreen-menu {
    position: absolute;
    top: 64px;
    left: 0;
    width: 100%;
    height: calc(100vh - 64px);
    background: #f8fafc;
    z-index: 999;
    display: flex;
    flex-direction: column;
    padding: 24px 16px;
    overflow-y: auto;
}
.mobile-menu-content {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding-bottom: 40px;
}
/* ── รูปแบบเมนูมือถือสไตล์ Grouped Card (เรียบหรู) ── */
.mobile-group-title {
    font-size: 0.75rem;
    font-weight: 800;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 8px 16px;
}
.mobile-group-card {
    background: #ffffff;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.03);
    border: 1px solid #f1f5f9;
    display: flex;
    flex-direction: column;
}
.mobile-nav-item {
    position: relative;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 20px;
    background: transparent;
    border: none;
    border-bottom: 1px solid #f1f5f9;
    font-size: 1rem;
    font-weight: 600;
    color: #334155;
    cursor: pointer;
    transition: all 0.2s;
    width: 100%;
    justify-content: flex-start;
}
.mobile-nav-item:last-child {
    border-bottom: none;
}
.mobile-nav-item:active {
    background: #f8fafc;
}
.mobile-nav-item.active {
    color: #f97316;
    background: #fffaf5;
    font-weight: 700;
}
.mobile-nav-item.active::before {
    content: "";
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 4px;
    height: 20px;
    background: #f97316;
    border-radius: 0 4px 4px 0;
}
.mobile-logout-btn {
    color: #dc2626;
    font-weight: 700;
}
.mobile-logout-btn:active {
    background: #fef2f2;
}
/* ── สไตล์สำหรับการแจ้งเตือน (Badge) ── */
.badge {
    background-color: #ef4444; /* สีแดง */
    color: #ffffff; /* ตัวหนังสือสีขาว */
    font-size: 0.85rem;
    font-weight: 700;
    padding: 2px 10px; /* ระยะห่างกรอบ */
    border-radius: 999px; /* ทำให้ขอบโค้งมนเป็นวงกลม/แคปซูล */
    margin-left: auto; /* ดันให้อยู่ชิดขวาของเมนูเสมอ */
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 28px; /* กำหนดความกว้างขั้นต่ำให้เป็นทรงกลมสวยๆ แม้จะเป็นเลขตัวเดียว */
}
.scrollbar-hidden::-webkit-scrollbar {
    display: none;
}
.scrollbar-custom::-webkit-scrollbar {
    width: 5px;
}
.scrollbar-custom::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 10px;
}
.view-fade-enter-active,
.view-fade-leave-active {
    transition:
        opacity 0.2s,
        transform 0.2s;
}
.view-fade-enter-from {
    opacity: 0;
    transform: translateY(10px);
}
.view-fade-leave-to {
    opacity: 0;
    transform: translateY(-10px);
}
</style>

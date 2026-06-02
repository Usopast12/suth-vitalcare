import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { authStore } from '../store/auth';
import { uiStore } from '../store/ui';
import { langStore } from '../store/lang';
import { useSWR } from '../composables/useSWR';
import { useFavorites } from '../composables/useFavorites';
export function useActivities() {
    const router = useRouter();
    const route = useRoute();
    const searchQuery = ref('');
    const debouncedQuery = ref('');
    const activities = ref<any[]>([]);
    const activeBanners = ref<any[]>([]);
    const currentBannerIndex = ref(0);
    const loadingBanners = ref(true);
    const bannersError = ref<any>(null);
    const rolesMaster = ref<any[]>([]);
    const availableCertEvents = ref<Set<number>>(new Set());
    const registeredEventIds = ref<Set<number>>(new Set());
    const viewMode = ref<'grid' | 'list'>('grid');
    const activeTab = ref<'all' | 'registered' | 'bookmarked'>('all');
    const sortBy = ref<'newest' | 'oldest' | 'date' | 'popular' | 'least_popular' | 'az' | 'za' | 'reg_far' | 'reg_near' | 'duration_long' | 'start_soonest'>('newest');
    const filterContinuousReg = ref(false);
    const filterContinuousEvent = ref(false);
    const filterHasAssessment = ref(false);
    const filterHasGoals = ref(false);
    const filterFavorites = ref(false);
    const filterMaxSlots = ref(100);
    const filterMissionCount = ref(100);
    const filterDateFrom = ref('');
    const filterDateTo = ref('');
    const filterStatus = ref<'all' | 'open' | 'closed'>('all');
    const filterTaskType = ref('all');
    const filterRoles = ref<string[]>([]);
    const filterCert = ref(false);
    const filterRegistered = ref(false);
    const filterRoleStudent = ref(false);
    const filterRoleUni = ref(false);
    const filterRoleStaff = ref(false);
    const filterRolePublic = ref(false);
    const filterSection = ref('all');
    const showFilterPanel = ref(false);
    const ITEMS_PER_PAGE = 24;
    const currentPage = ref(1);
    const PAGE_SIZE = 12;
    const visibleCount = ref(PAGE_SIZE);
    const loadingMore = ref(false);
    const sentinelEl = ref<HTMLElement | null>(null);
    let infiniteObserver: IntersectionObserver | null = null;
    const visibleCards = ref<Set<number>>(new Set());
    let cardObserver: IntersectionObserver | null = null;
    let countdownTimer: ReturnType<typeof setInterval> | null = null;
    const now = ref(Date.now());
    const isMobileScreen = ref(false);
    function checkScreen() {
        isMobileScreen.value = window.innerWidth <= 768;
    }
    let searchDebounce: ReturnType<typeof setTimeout> | null = null;
    watch(searchQuery, (v) => {
        if (searchDebounce) clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => {
            debouncedQuery.value = v;
            visibleCount.value = PAGE_SIZE;
            scrollToTop();
        }, 400);
    });
    watch([
        activeTab, sortBy, filterDateFrom, filterDateTo, filterStatus, filterTaskType,
        filterRoles, filterCert, filterContinuousReg, filterContinuousEvent,
        filterHasAssessment, filterHasGoals, filterFavorites, filterMaxSlots, filterMissionCount,
        filterRoleStudent, filterRoleUni, filterRoleStaff, filterRolePublic
    ], () => {
        visibleCount.value = PAGE_SIZE;
        updateUrlQuery();
    });
    // 🔗 Deep Linking & Navigation History
    function updateUrlQuery(isPush = false) {
        const query: any = { ...route.query };
        if (currentPage.value > 1) query.page = String(currentPage.value);
        else delete query.page;
        if (filterSection.value !== 'all') query.section = filterSection.value;
        else delete query.section;
        if (searchQuery.value) query.q = searchQuery.value;
        else delete query.q;
        if (sortBy.value !== 'newest') query.sort = sortBy.value;
        else delete query.sort;
        // Sync other filters if needed...
        if (isPush) {
            router.replace({ query }).catch(() => { });
        } else {
            router.replace({ query }).catch(() => { });
        }
    }
    // Read from URL on Init
    watch(() => route.query, (q) => {
        if (q.page) currentPage.value = Number(q.page);
        if (q.section) filterSection.value = String(q.section);
        if (q.q && q.q !== searchQuery.value) searchQuery.value = String(q.q);
        if (q.sort) sortBy.value = q.sort as any;
    }, { immediate: true });
    async function fetchBanners() {
        loadingBanners.value = true;
        try {
            // 🌟 1. ลองยิงดึงทั้งหมดก่อน
            let res = await fetch('/api/banners');
            // 🌟 2. ถ้าดึงแบบไม่มีเงื่อนไขแล้วพัง (Route ไม่มี/ติด Auth) ให้ถอยกลับไปใช้ท่าเดิมที่มี
            if (!res.ok) {
                res = await fetch('/api/banners?active=true&position=activity');
            }
            if (res.ok) {
                const data = await res.json();
                // 🌟 3. แกะกล่องข้อมูล (ครอบคลุมทุกท่าที่ Backend จะคายมา)
                let allBanners: any[] = [];
                if (Array.isArray(data)) {
                    allBanners = data;
                } else if (data && Array.isArray(data.data)) {
                    allBanners = data.data; // กรณี Backend ห่อ { data: [...] } มาให้
                } else if (data && Array.isArray(data.items)) {
                    allBanners = data.items;
                } else {
                    allBanners = [data]; // กรณี API ส่งมาแค่ object ก้อนเดียวเพียวๆ
                }
                // 🌟 4. กรองให้ชัวร์ เอาเฉพาะแบนเนอร์ที่เปิดใช้งานและอยู่หน้า activity
                const nv = allBanners.filter((b: any) => {
                    if (!b || !b.image_url) return false; // ป้องกันข้อมูลขยะ ต้องมีรูปถึงจะโชว์
                    const isActive = b.is_active === true || b.is_active === 1 || String(b.is_active) === 'true' || String(b.is_active) === '1' || b.is_active === undefined;
                    const isActivityPos = !b.position || String(b.position).toLowerCase() === 'activity';
                    return isActive && isActivityPos;
                });
                if (JSON.stringify(nv) !== JSON.stringify(activeBanners.value)) {
                    activeBanners.value = nv;
                }
            }
        } catch (err: any) {
            bannersError.value = err;
        } finally {
            loadingBanners.value = false;
        }
    }
    const { data: swrMaster } = useSWR<any[]>(
        () => authStore.user?.id ? '/api/master' : null,
        {
            revalidateOnFocus: false,
            fetcher: async (url) => {
                const res = await fetch(url, { headers: { 'x-user-id': String(authStore.user?.id) } });
                const all = await res.json();
                return Array.isArray(all) ? all.filter((m: any) => m.category === 'role') : [];
            }
        }
    );
    watch(swrMaster, (nv) => { if (nv) rolesMaster.value = nv; }, { immediate: true });
    const loadingActivities = ref(true);
    const activitiesError = ref<any>(null);
    const fetchActivities = async (silent = false) => {
        if (!silent && activities.value.length === 0) loadingActivities.value = true;
        const safetyTimer = setTimeout(() => {
            if (loadingActivities.value) {
                loadingActivities.value = false;
            }
        }, 5000);
        try {
            const res = await fetch('/api/activities');
            if (!res.ok) throw new Error('Fetch failed');
            const rawData = await res.json();
            // 🚀 PERFORMANCE BOOST: แปลง JSON และเวลาเก็บไว้ใช้งานเลย จะได้ไม่ต้องทำซ้ำใน computed
            const nv = rawData.map((act: any) => ({
                ...act,
                _tasks: typeof act.tasks === 'string' ? JSON.parse(act.tasks || '[]') : (act.tasks || []),
                _visibility: typeof act.visibility === 'string' ? JSON.parse(act.visibility || '[]') : (act.visibility || []),
                _certConfig: typeof act.certificate_config === 'string' ? JSON.parse(act.certificate_config || '{}') : (act.certificate_config || {}),
                _assessConfig: typeof act.assessment_config === 'string' ? JSON.parse(act.assessment_config || '{}') : (act.assessment_config || {}),
                _goalConfig: typeof act.goal_config === 'string' ? JSON.parse(act.goal_config || '{}') : (act.goal_config || {}),
                _startMs: act.start_date ? new Date(act.start_date).getTime() : 0,
                _createdMs: (act.created_at || act.id) ? new Date(act.created_at || act.id).getTime() : 0,
                _regStartMs: (act.registration_start_date || act.start_date) ? new Date(act.registration_start_date || act.start_date).getTime() : 0,
                _endMs: act.end_date ? new Date(act.end_date).getTime() : 0,
                _regDeadlineMs: (act.registration_end_date || act.registration_deadline) ? new Date(act.registration_end_date || act.registration_deadline).getTime() : 0
            }));
            if (JSON.stringify(nv) !== JSON.stringify(activities.value)) {
                activities.value = nv;
                nextTick(() => prefetchDetailPages(nv.slice(0, 6)));
            }
            activitiesError.value = null;
        } catch (err: any) {
            if (!activities.value.length) activitiesError.value = err;
        } finally {
            clearTimeout(safetyTimer);
            loadingActivities.value = false;
        }
    };
    const { data: swrAvailableCerts, mutate: mutateCerts } = useSWR<any[]>(
        () => authStore.user?.id ? `/api/certificates/available/${authStore.user.id}` : null,
        { revalidateOnFocus: false }
    );
    watch(swrAvailableCerts, (nv) => {
        if (nv) {
            const set = new Set<number>();
            nv.forEach((item: any) => {
                const id = typeof item === 'number' ? item : (item.event_id ?? item.id);
                if (id) set.add(id);
            });
            availableCertEvents.value = set;
        }
    }, { immediate: true });
    const { data: swrMyRegistrations } = useSWR<any[]>(
        () => authStore.user?.id ? `/api/activities/user/${authStore.user.id}/registered` : null,
        { revalidateOnFocus: false }
    );
    watch(swrMyRegistrations, (nv) => {
        if (nv) {
            const set = new Set<number>();
            nv.forEach((r: any) => {
                const id = r.id ?? r.event_id;
                if (id) set.add(id);
            });
            registeredEventIds.value = set;
        }
    }, { immediate: true });
    function prefetchDetailPages(acts: any[]) {
        if (!('requestIdleCallback' in window)) return;
        (window as any).requestIdleCallback(() => {
            acts.forEach(act => {
                const link = document.createElement('link');
                link.rel = 'prefetch'; link.href = `/activities/${act.id}`; link.as = 'document';
                document.head.appendChild(link);
            });
        });
    }
    watch(activeBanners, (banners) => {
        if (!banners.length) return;
        const link = document.createElement('link');
        link.rel = 'preload'; link.as = 'image'; link.href = banners[0].image_url;
        document.head.appendChild(link);
    }, { immediate: true });
    const { favoriteIds, fetchFavorites, toggleFavorite: syncToggleFavorite } = useFavorites();
    function toggleFavorite(e: Event, id: number) {
        e.stopPropagation();
        syncToggleFavorite(id);
    }
    type ActivityStatus = 'registered' | 'full' | 'closed' | 'open' | 'ongoing' | 'ended';
    const getActivityStatus = (act: any): ActivityStatus => {
        const nowMs = now.value;
        // 1. สิ้นสุดกิจกรรม (Operational end date passed)
        const isEnded = !act.is_continuous_event && act._endMs && act._endMs < nowMs;
        if (isEnded) return 'ended';
        // 2. ลงทะเบียนแล้ว (User is registered)
        if (registeredEventIds.value.has(act.id)) return 'registered';
        // 3. ปิดรับสมัครแต่กำลังดำเนินการ (Registration closed/full but operation not ended)
        const isFull = !act.is_unlimited_max_slots && act.max_slots && (act.registration_count || 0) >= act.max_slots;
        if (isFull) return 'full';
        const regClosed = (!act.is_continuous_registration && act._regDeadlineMs && act._regDeadlineMs < nowMs) || act.status === 'closed' || act.registration_closed;
        if (regClosed) return 'ongoing';
        // 4. เปิดรับสมัคร (Registration is still open)
        return 'open';
    };
    function getCountdown(act: any): string | null {
        if (!!act.is_continuous_registration) return langStore.t('always_open');
        if (!act.registration_deadline) return null;
        const diff = act._regDeadlineMs - now.value;
        const isEn = langStore.locale === 'en';
        if (diff <= 0) return isEn ? 'Expired' : 'หมดเวลา';
        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        if (d > 0) return isEn ? `${d}d ${h}h` : `${d}วัน ${h}ชม.`;
        if (h > 0) return isEn ? `${h}h ${m}m` : `${h}ชม. ${m}น.`;
        return isEn ? `${m}min` : `${m}นาที`;
    }
    function isCountdownUrgent(act: any): boolean {
        if (!act.registration_deadline) return false;
        return act._regDeadlineMs - now.value < 86400000 * 3;
    }
    const publicActivities = computed(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return activities.value.filter(act => {
            if (act.status === 'closed' && !registeredEventIds.value.has(act.id)) return false;
            if (act.publish_start_date && act.status === 'published') {
                const publishDate = new Date(act.publish_start_date);
                publishDate.setHours(0, 0, 0, 0);
                if (publishDate > today && !registeredEventIds.value.has(act.id)) return false;
            }
            return true;
        });
    });
    const filteredAndSortedActivities = computed(() => {
        const q = debouncedQuery.value.toLowerCase();
        let pool = publicActivities.value.filter(act => {
            if (filterStatus.value === 'open' && getActivityStatus(act) !== 'open') return false;
            if (filterStatus.value === 'closed' && getActivityStatus(act) !== 'closed' && getActivityStatus(act) !== 'full') return false;
            if (filterTaskType.value !== 'all') {
                if (!act._tasks.some((t: any) => t.type === filterTaskType.value)) return false;
            }
            if (filterRoles.value.length > 0) {
                if (act._visibility.length > 0) {
                    if (!act._visibility.some((v: string) => filterRoles.value.includes(v))) return false;
                }
            }
            if (filterCert.value) {
                if (!act._certConfig.enabled) return false;
            }
            if (filterContinuousReg.value && !act.is_continuous_registration) return false;
            if (filterContinuousEvent.value && !act.is_continuous_event) return false;
            if (filterHasAssessment.value) {
                if (!(act._assessConfig.pre_test?.enabled || act._assessConfig.post_test?.enabled)) return false;
            }
            if (filterHasGoals.value) {
                if (!act._goalConfig.enabled) return false;
            }
            if (filterFavorites.value && !favoriteIds.value.has(act.id)) return false;
            if (filterRegistered.value && !registeredEventIds.value.has(act.id)) return false;
            const activeRoles: string[] = [];
            if (filterRoleStudent.value) activeRoles.push('นักเรียน');
            if (filterRoleUni.value) activeRoles.push('นักศึกษา');
            if (filterRoleStaff.value) activeRoles.push('บุคลากร');
            if (filterRolePublic.value) activeRoles.push('บุคคลทั่วไป');
            if (activeRoles.length > 0) {
                // OR Logic: Activity must have at least one of the selected roles
                if (!act._visibility?.some((v: string) => activeRoles.includes(v))) return false;
            }
            if (filterMaxSlots.value < 100) {
                if (act.is_unlimited_max_slots) return false;
                if (act.max_slots > filterMaxSlots.value) return false;
            }
            if (filterMissionCount.value < 100) {
                if (act._tasks.length > filterMissionCount.value) return false;
            }
            if (activeTab.value === 'registered' && !registeredEventIds.value.has(act.id)) return false;
            if (activeTab.value === 'bookmarked' && !favoriteIds.value.has(act.id)) return false;
            if (q && !act.title.toLowerCase().includes(q) && !act.location_name?.toLowerCase().includes(q)) return false;
            return true;
        });
        pool.sort((a, b) => {
            if (sortBy.value === 'date') return a._startMs - b._startMs;
            if (sortBy.value === 'popular') return (b.registration_count || 0) - (a.registration_count || 0);
            if (sortBy.value === 'least_popular') return (a.registration_count || 0) - (b.registration_count || 0);
            if (sortBy.value === 'az') return a.title.localeCompare(b.title, 'th');
            if (sortBy.value === 'za') return b.title.localeCompare(a.title, 'th');
            if (sortBy.value === 'reg_far') return a._regStartMs - b._regStartMs;
            if (sortBy.value === 'reg_near') return b._regStartMs - a._regStartMs;
            if (sortBy.value === 'duration_long') return (b._endMs - b._startMs) - (a._endMs - a._startMs);
            if (sortBy.value === 'start_soonest') return a._startMs - b._startMs;
            if (sortBy.value === 'oldest') return a._createdMs - b._createdMs;
            return b._createdMs - a._createdMs; // Default: newest
        });
        return pool;
    });
    const sectionFilteredActivities = computed(() => {
        let pool = filteredAndSortedActivities.value;
        const nowMs = now.value;
        if (filterSection.value === 'mine') {
            pool = publicActivities.value
                .filter(a => registeredEventIds.value.has(a.id))
                .sort((a, b) => a._startMs - b._startMs);
        } else if (filterSection.value === 'ending-soon') {
            pool = publicActivities.value
                .filter(a => getActivityStatus(a) === 'open' && a.registration_deadline && (a._regDeadlineMs - nowMs < 86400000 * 3) && (a._regDeadlineMs - nowMs > 0))
                .sort((a, b) => a._regDeadlineMs - b._regDeadlineMs);
        } else if (filterSection.value === 'popular') {
            pool = [...publicActivities.value]
                .filter(a => getActivityStatus(a) === 'open')
                .sort((a, b) => (b.registration_count || 0) - (a.registration_count || 0));
        } else if (filterSection.value === 'newest') {
            pool = [...publicActivities.value]
                .filter(a => getActivityStatus(a) === 'open')
                .sort((a, b) => b._createdMs - a._createdMs);
        } else if (filterSection.value === 'solo') {
            pool = publicActivities.value.filter(a => !a.team_mode);
        } else if (filterSection.value === 'team') {
            pool = publicActivities.value.filter(a => !!a.team_mode);
        } else if (filterSection.value === 'ongoing') {
            pool = publicActivities.value.filter(a => {
                const status = getActivityStatus(a);
                return (status === 'full' || status === 'closed') && a._endMs > nowMs;
            });
        } else if (filterSection.value === 'favorites') {
            pool = publicActivities.value
                .filter(a => favoriteIds.value.has(a.id))
                .sort((a, b) => b._createdMs - a._createdMs);
        }
        return pool;
    });
    const paginatedActivities = computed(() => {
        if (filterSection.value === 'all' && !debouncedQuery.value && !hasActiveFilters.value) {
            // Home: Use traditional Pagination (Limited)
            const start = (currentPage.value - 1) * ITEMS_PER_PAGE;
            return publicActivities.value.slice(start, start + ITEMS_PER_PAGE);
        }
        // Search / Filter / View All: Use Infinite Scroll (Unlimited)
        return sectionFilteredActivities.value.slice(0, visibleCount.value);
    });
    const totalPages = computed(() => {
        const pool = (filterSection.value === 'all' && !debouncedQuery.value && !hasActiveFilters.value)
            ? publicActivities.value
            : sectionFilteredActivities.value;
        return Math.ceil(pool.length / ITEMS_PER_PAGE);
    });
    function setSection(section: string) {
        filterSection.value = section;
        currentPage.value = 1;
        visibleCount.value = PAGE_SIZE;
        scrollToTop();
    }
    function changePage(p: number) {
        currentPage.value = p;
        scrollToTop();
        updateUrlQuery(true);
    }
    function prevPage() {
        if (currentPage.value > 1) {
            currentPage.value--;
            scrollToTop();
            updateUrlQuery(true);
        }
    }
    function nextPage() {
        if (currentPage.value < totalPages.value) {
            currentPage.value++;
            scrollToTop();
            updateUrlQuery(true);
        }
    }
    function scrollToTop() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    const flashSaleRemaining = computed(() => {
        const endingAct = publicActivities.value
            .filter(a => getActivityStatus(a) === 'open' && a.registration_deadline && (a._regDeadlineMs - now.value < 86400000 * 3) && (a._regDeadlineMs - now.value > 0))
            .sort((a, b) => a._regDeadlineMs - b._regDeadlineMs)[0];
        if (!endingAct) return { h: '00', m: '00', s: '00' };
        const diff = Math.max(0, endingAct._regDeadlineMs - now.value);
        const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
        const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
        const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
        return { h, m, s };
    });
    const totalFiltered = computed(() => filteredAndSortedActivities.value.length);
    const hasMore = computed(() => visibleCount.value < totalFiltered.value);
    const hasActiveFilters = computed(() =>
        filterDateFrom.value || filterDateTo.value ||
        sortBy.value !== 'newest' || filterStatus.value !== 'all' ||
        filterTaskType.value !== 'all' || filterRoles.value.length > 0 ||
        filterCert.value || filterRegistered.value || filterContinuousReg.value || filterContinuousEvent.value ||
        filterHasAssessment.value || filterHasGoals.value || filterFavorites.value ||
        filterMaxSlots.value < 100 || filterMissionCount.value < 100 ||
        filterRoleStudent.value || filterRoleUni.value || filterRoleStaff.value || filterRolePublic.value
    );
    const viewSections = computed(() => {
        const allItems = paginatedActivities.value;
        const t = (k: any) => langStore.t(k);
        const allSection = {
            id: 'all',
            title: (activeTab.value === 'all' && !debouncedQuery.value && !hasActiveFilters.value)
                ? (viewMode.value === 'grid' ? t('activities_for_you') : t('activities'))
                : (allItems.length ? t('search_results') : t('no_results_found')),
            items: allItems,
            isFlash: false,
            isFiltered: false
        };
        if (viewMode.value === 'grid' && activeTab.value === 'all' && !debouncedQuery.value && !hasActiveFilters.value) {
            if (filterSection.value !== 'all') {
                const titles: any = {
                    'mine':       t('my_activities'),
                    'ending-soon': t('ending_soon'),
                    'popular':    t('popular_activities'),
                    'newest':     t('newest_activities'),
                    'solo':       t('solo_activities'),
                    'team':       t('team_activities'),
                    'ongoing':    t('ongoing_activities'),
                    'favorites':  langStore.locale === 'en' ? 'Favorites' : 'รายการโปรด'
                };
                return [{ id: 'filtered-' + filterSection.value, title: titles[filterSection.value] || t('search_results'), items: allItems, isFlash: filterSection.value === 'ending-soon', isFiltered: true }];
            }
            const nowMs = now.value;
            const registered: any[] = [];
            const endingSoon: any[] = [];
            const newest: any[] = [];
            const soloActivities: any[] = [];
            const teamActivities: any[] = [];
            const ongoing: any[] = [];
            const favorites: any[] = [];
            const pool = publicActivities.value;
            const favIds = favoriteIds.value;
            const regIds = registeredEventIds.value;
            for (let i = 0; i < pool.length; i++) {
                const a = pool[i];
                const status = getActivityStatus(a);
                const isFav = favIds.has(a.id);
                if (status === 'registered') {
                    if (registered.length < 5) registered.push(a);
                } else if (status === 'open') {
                    if (a.registration_deadline && (a._regDeadlineMs - nowMs < 86400000 * 3) && (a._regDeadlineMs - nowMs > 0)) {
                        if (endingSoon.length < 5) endingSoon.push(a);
                    }
                    if (newest.length < 5) newest.push(a);
                } else if ((status === 'full' || status === 'closed') && a._endMs > nowMs) {
                    if (ongoing.length < 5) ongoing.push(a);
                }
                if (isFav && favorites.length < 5) favorites.push(a);
                if (!a.team_mode && soloActivities.length < 5) soloActivities.push(a);
                if (!!a.team_mode && teamActivities.length < 5) teamActivities.push(a);
            }
            // Sort specialized lists as needed
            registered.sort((a, b) => a._startMs - b._startMs);
            endingSoon.sort((a, b) => a._regDeadlineMs - b._regDeadlineMs);
            newest.sort((a, b) => b._createdMs - a._createdMs);
            favorites.sort((a, b) => b._createdMs - a._createdMs);
            const sections: any[] = [];
            if (registered.length > 0) sections.push({ id: 'mine', title: t('my_activities'), items: registered, isFlash: false, isFiltered: false });
            if (favorites.length > 0) sections.push({ id: 'favorites', title: langStore.locale === 'en' ? 'Favorites' : 'รายการโปรด', items: favorites, isFlash: false, isFiltered: false });
            sections.push({ ...allSection, items: allItems, id: 'all-home', title: t('activities'), isHorizontal: false });
            return sections;
        }
        return [allSection];
    });
    function clearFilters() {
        filterDateFrom.value = ''; filterDateTo.value = ''; filterStatus.value = 'all';
        filterTaskType.value = 'all'; filterRoles.value = [];
        filterCert.value = false; filterRegistered.value = false;
        filterContinuousReg.value = false; filterContinuousEvent.value = false;
        filterHasAssessment.value = false;
        filterHasGoals.value = false; filterFavorites.value = false;
        filterRoleStudent.value = false;
        filterRoleUni.value = false;
        filterRoleStaff.value = false;
        filterRolePublic.value = false;
        filterMaxSlots.value = 100; filterMissionCount.value = 100; sortBy.value = 'newest';
    }
    function clearSearch() {
        searchQuery.value = '';
    }
    function loadMore() {
        if (loadingMore.value || !hasMore.value) return;
        loadingMore.value = true;
        setTimeout(() => { visibleCount.value += PAGE_SIZE; loadingMore.value = false; }, 300);
    }
    watch(sentinelEl, (el) => {
        if (infiniteObserver) { infiniteObserver.disconnect(); infiniteObserver = null; }
        if (el) {
            infiniteObserver = new IntersectionObserver(
                entries => { if (entries[0].isIntersecting) loadMore(); },
                { rootMargin: '200px' }
            );
            infiniteObserver.observe(el);
        }
    });
    function observeCard(el: any, id: number) {
        if (!el || !cardObserver) return;
        (el as HTMLElement).dataset.cardId = String(id);
        cardObserver.observe(el);
    }
    function setupCardObserver() {
        cardObserver = new IntersectionObserver(entries => {
            entries.forEach(e => {
                const id = Number((e.target as HTMLElement).dataset.cardId);
                if (e.isIntersecting) visibleCards.value.add(id);
            });
        }, { rootMargin: '100px' });
    }
    const formatDateThai = (dateStr: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        if (langStore.locale === 'en') {
            return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
        }
        const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
        return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear() + 543}`;
    };
    const getSlotPercent = (used: number, max: number) => max ?
        Math.min(100, Math.round((used / max) * 100)) : 0;
    const goToDetail = (id: number) => router.push(`/activities/${id}`);
    const onBannerClick = (b: any) => {
        if (b.link_type === 'activity' && b.link_activity_id) {
            router.push(`/activities/${b.link_activity_id}`);
        } else if (b.link_type === 'url' && b.link_url) {
            window.open(b.link_url, '_blank');
        }
    };
    let fetchTimeout: any = null;
    watch(() => uiStore.lastRealtimeUpdate, () => {
        if (fetchTimeout) clearTimeout(fetchTimeout);
        fetchTimeout = setTimeout(() => { 
            fetchActivities(true); 
            fetchBanners(); // 🌟 Refresh banners too
            mutateCerts(true); 
        }, 1500);
    });
    onMounted(async () => {
        checkScreen();
        window.addEventListener('resize', checkScreen);
        // 🌟 Read section from query param
        if (route.query.section) {
            filterSection.value = String(route.query.section);
        }
        fetchBanners();
        fetchActivities();
        fetchFavorites();
        if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
        setTimeout(() => {
            window.scrollTo(0, 0);
            window.scrollTo({ top: 0, behavior: 'instant' as any });
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;
        }, 100);
        setupCardObserver();
        await nextTick();
        countdownTimer = setInterval(() => { now.value = Date.now(); }, 1000);
    });
    onUnmounted(() => {
        window.removeEventListener('resize', checkScreen);
        if (searchDebounce) clearTimeout(searchDebounce);
        if (infiniteObserver) infiniteObserver.disconnect();
        if (cardObserver) cardObserver.disconnect();
        if (countdownTimer) clearInterval(countdownTimer);
    });
    return {
        searchQuery,
        debouncedQuery,
        activities,
        activeBanners,
        currentBannerIndex,
        loadingBanners,
        bannersError,
        rolesMaster,
        availableCertEvents,
        registeredEventIds,
        viewMode,
        activeTab,
        sortBy,
        filterContinuousReg,
        filterContinuousEvent,
        filterHasAssessment,
        filterHasGoals,
        filterFavorites,
        filterMaxSlots,
        filterMissionCount,
        filterDateFrom,
        filterDateTo,
        filterStatus,
        filterTaskType,
        filterRoles,
        filterCert,
        filterRegistered,
        filterRoleStudent,
        filterRoleUni,
        filterRoleStaff,
        filterRolePublic,
        filterSection,
        showFilterPanel,
        PAGE_SIZE,
        visibleCount,
        loadingMore,
        sentinelEl,
        visibleCards,
        now,
        isMobileScreen,
        loadingActivities,
        activitiesError,
        currentPage,
        flashSaleRemaining,
        viewSections,
        totalFiltered,
        hasMore,
        hasActiveFilters,
        favoriteIds,
        totalPages,
        clearFilters,
        clearSearch,
        loadMore,
        observeCard,
        formatDateThai,
        getSlotPercent,
        goToDetail,
        onBannerClick,
        toggleFavorite,
        getActivityStatus,
        getCountdown,
        isCountdownUrgent,
        setSection,
        changePage,
        prevPage,
        nextPage,
        fetchActivities,
        prefetchDetailPages
    };
}
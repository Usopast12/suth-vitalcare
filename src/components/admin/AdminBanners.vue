<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed, watch } from "vue";
import {
    Image as ImageIcon,
    Loader2,
    Plus,
    Trash2,
    Edit2,
    ArrowLeft,
    MoreVertical,
    Search,
    LayoutGrid,
    Table2,
    ExternalLink,
    Copy,
    Eye,
    EyeOff,
    Monitor,
    ChevronLeft,
    ChevronRight,
    ArrowRight,
    X,
    Check,
    ChevronDown,
} from "lucide-vue-next";
import Cropper from "cropperjs";
import "cropperjs/dist/cropper.css";
import { authStore } from "../../store/auth";
import { uiStore } from "../../store/ui";
import { useRoute, useRouter } from "vue-router";
import { showSuccess, showError, showConfirm } from "../../lib/swal";

const route = useRoute();
const router = useRouter();

const banners = ref<any[]>([]);
const activities = ref<any[]>([]);
const loading = ref(true);
const uploading = ref(false);

// ควบคุมการแสดงผลฟอร์ม
const showForm = ref(false);

// สถานะสำหรับ Toolbar (ค้นหา, มุมมอง)
const searchQuery = ref("");
const viewMode = ref("grid");

const form = ref({
    id: null,
    title: "",
    subtitle: "",
    image_url: "",
    link_url: "",
    link_type: "none",
    link_activity_id: null as number | null,
    position: "activity",
    is_active: true,
});
const isEditing = ref(false);

const activeDropdown = ref<string | null>(null);
const dropdownDirection = ref<"down" | "up">("down");
const toggleDropdown = (id: string, event?: Event) => {
    if (event) event.stopPropagation();
    if (activeDropdown.value === id) {
        activeDropdown.value = null;
    } else {
        activeDropdown.value = id;
        if (event) {
            const btn = event.currentTarget as HTMLElement;
            const rect = btn.getBoundingClientRect();
            dropdownDirection.value =
                window.innerHeight - rect.bottom < 200 && rect.top > 200
                    ? "up"
                    : "down";
        }
    }
};
const handleDocumentClick = () => {
    activeDropdown.value = null;
};

// --- Sync Form with URL ---
watch(
    () => [route.query.sub, route.query.id, banners.value],
    ([newSub, newId, bannerList]) => {
        const sub = String(newSub || "");
        const validSub = sub === "form";

        if (validSub) {
            showForm.value = true;
            if (newId && Array.isArray(bannerList) && bannerList.length > 0) {
                const found = bannerList.find(
                    (b: any) => b.id === Number(newId),
                ) as any;
                if (found && (!form.value.id || form.value.id !== found.id)) {
                    form.value = { ...found };
                    isEditing.value = true;
                }
            } else if (!newId && isEditing.value) {
                // This handles the case where we were editing but URL changed to just sub=form (Create mode)
                resetFormState();
                showForm.value = true;
            }
        } else if (!sub && showForm.value) {
            showForm.value = false;
            resetFormState();
        }
    },
    { immediate: true },
);

const resetFormState = () => {
    form.value = {
        id: null,
        title: "",
        subtitle: "",
        image_url: "",
        link_url: "",
        link_type: "none",
        link_activity_id: null,
        position: "activity",
        is_active: true,
    };
    originalImageUrl.value = "";
    isEditing.value = false;
};

const showCropper = ref(false);
const cropperTarget = ref<"banner">("banner");
const cropperRawFile = ref<File | null>(null);
const cropperImgUrl = ref("");
const originalImageUrl = ref(""); // Track DB image to avoid deleting it before Save
const cropperEl = ref<HTMLImageElement | null>(null);
let cropperInstance: Cropper | null = null;

// Smart Dropdown Menu
const activeMenuId = ref<number | null>(null);
const menuPos = ref({ top: 0, right: 0, transform: "none" });
const activeMenuBanner = computed(
    () => banners.value.find((b) => b.id === activeMenuId.value) || null,
);

// --- State สำหรับระบบ Preview มุมมองผู้ใช้ (Carousel) ---
const currentPreviewIndex = ref(0);
const activePreviewBanners = computed(() =>
    banners.value.filter((b) => b.is_active),
);
const bannerTrackRef = ref<HTMLElement | null>(null);
let slideInterval: any = null;

const startAutoSlide = () => {
    stopAutoSlide();
    if (activePreviewBanners.value.length <= 1) return;
    slideInterval = setInterval(() => {
        scrollNext();
    }, 4000);
};

const stopAutoSlide = () => {
    if (slideInterval) {
        clearInterval(slideInterval);
        slideInterval = null;
    }
};

const scrollNext = () => {
    if (activePreviewBanners.value.length > 0) {
        currentPreviewIndex.value =
            (currentPreviewIndex.value + 1) % activePreviewBanners.value.length;
    }
};

const scrollPrev = () => {
    if (activePreviewBanners.value.length > 0) {
        currentPreviewIndex.value =
            (currentPreviewIndex.value -
                1 +
                activePreviewBanners.value.length) %
            activePreviewBanners.value.length;
    }
};

// ดักการเปลี่ยน Index เพื่อสั่งให้รางเลื่อนสมูทๆ
watch(currentPreviewIndex, (newIdx) => {
    if (!bannerTrackRef.value || isDraggingBanner.value) return;
    const track = bannerTrackRef.value;
    const cards = track.children;
    if (cards[newIdx]) {
        const card = cards[newIdx] as HTMLElement;
        const targetLeft =
            card.offsetLeft -
            track.offsetLeft -
            (track.clientWidth - card.clientWidth) / 2;
        track.scrollTo({ left: targetLeft, behavior: "smooth" });
    }
});

// ฟังก์ชัน Grab to Scroll (ลากเมาส์)
const isDraggingBanner = ref(false);
const startX = ref(0);
const startScrollLeft = ref(0);

const startDrag = (e: MouseEvent) => {
    isDraggingBanner.value = true;
    stopAutoSlide();
    if (bannerTrackRef.value) {
        startX.value = e.pageX - bannerTrackRef.value.offsetLeft;
        startScrollLeft.value = bannerTrackRef.value.scrollLeft;
    }
};

const doDrag = (e: MouseEvent) => {
    if (!isDraggingBanner.value || !bannerTrackRef.value) return;
    e.preventDefault();
    const x = e.pageX - bannerTrackRef.value.offsetLeft;
    const walk = (x - startX.value) * 1.5;
    bannerTrackRef.value.scrollLeft = startScrollLeft.value - walk;
};

const stopDrag = () => {
    isDraggingBanner.value = false;
    startAutoSlide();
};

watch(viewMode, (newMode) => {
    if (newMode === "preview") {
        nextTick(() => {
            startAutoSlide();
        });
    } else {
        stopAutoSlide();
    }
});

// --- State สำหรับ Modal Preview (Carousel แบบเดียวกับ User View) ---
const showPreviewModal = ref(false);
const previewData = ref<any>(null);
const modalPreviewIndex = ref(0);
const modalTrackRef = ref<HTMLElement | null>(null);

const openBannerPreview = (b: any) => {
    previewData.value = b;
    const index = sortedBanners.value.findIndex((x) => x.id === b.id);
    modalPreviewIndex.value = index !== -1 ? index : 0;
    showPreviewModal.value = true;
};

const modalScrollNext = () => {
    if (sortedBanners.value.length > 0) {
        modalPreviewIndex.value =
            (modalPreviewIndex.value + 1) % sortedBanners.value.length;
    }
};

const modalScrollPrev = () => {
    if (sortedBanners.value.length > 0) {
        modalPreviewIndex.value =
            (modalPreviewIndex.value - 1 + sortedBanners.value.length) %
            sortedBanners.value.length;
    }
};

watch(modalPreviewIndex, (newIdx) => {
    if (!modalTrackRef.value) return;
    const track = modalTrackRef.value;
    const cards = track.children;
    if (cards[newIdx]) {
        const card = cards[newIdx] as HTMLElement;
        const targetLeft =
            card.offsetLeft -
            track.offsetLeft -
            (track.clientWidth - card.clientWidth) / 2;
        track.scrollTo({ left: targetLeft, behavior: "smooth" });
    }
});

// --- ฟังก์ชันสำหรับเปิดดูหน้าเว็บผู้ใช้จริง ---
const viewOnFrontend = () => {
    window.open("/", "_blank");
};
// ----------------------------------------

const toggleMenu = (id: number, event: MouseEvent) => {
    if (activeMenuId.value === id) {
        activeMenuId.value = null;
        return;
    }
    activeMenuId.value = id;
    if (event) {
        const btn = event.currentTarget as HTMLElement;
        const rect = btn.getBoundingClientRect();
        const menuHeight = 300;
        const spaceBelow = window.innerHeight - rect.bottom;
        const right = Math.max(8, window.innerWidth - rect.right);

        if (spaceBelow < menuHeight && rect.top > menuHeight) {
            menuPos.value = {
                top: rect.top - menuHeight - 4,
                right,
                transform: "none",
            };
        } else {
            menuPos.value = {
                top: Math.min(
                    rect.bottom + 4,
                    window.innerHeight - menuHeight - 8,
                ),
                right,
                transform: "none",
            };
        }
    }
};

const handleScroll = () => {
    activeMenuId.value = null;
};

const fetchBanners = async () => {
    loading.value = true;
    try {
        const res = await fetch("/api/banners");
        if (res.ok) banners.value = await res.json();
    } catch (error) {
        console.error("Failed to fetch banners:", error);
    } finally {
        loading.value = false;
    }
};

const fetchActivities = async () => {
    try {
        const res = await fetch("/api/activities");
        if (res.ok) activities.value = await res.json();
    } catch (error) {}
};

onMounted(() => {
    fetchBanners();
    fetchActivities();
    window.addEventListener("scroll", handleScroll);
    window.addEventListener("click", handleDocumentClick);
});

onUnmounted(() => {
    window.removeEventListener("scroll", handleScroll);
    window.removeEventListener("click", handleDocumentClick);
    stopAutoSlide();
});

// Pagination & Sorting State
const dtSortKey = ref("title");
const dtSortDir = ref<"asc" | "desc">("asc");
const dtCurrentPage = ref(1);
const dtPerPage = 10;

const toggleDtSort = (key: string) => {
    if (dtSortKey.value === key) {
        dtSortDir.value = dtSortDir.value === "asc" ? "desc" : "asc";
    } else {
        dtSortKey.value = key;
        dtSortDir.value = "asc";
    }
};

const sortedBanners = computed(() => {
    const result = [...banners.value].filter((b) => {
        const searchLower = searchQuery.value.toLowerCase();
        return (
            (b.title || "").toLowerCase().includes(searchLower) ||
            (b.subtitle || "").toLowerCase().includes(searchLower)
        );
    });

    return result.sort((a, b) => {
        let valA = a[dtSortKey.value] || "";
        let valB = b[dtSortKey.value] || "";

        if (typeof valA === "string") valA = valA.toLowerCase();
        if (typeof valB === "string") valB = valB.toLowerCase();

        if (valA < valB) return dtSortDir.value === "asc" ? -1 : 1;
        if (valA > valB) return dtSortDir.value === "asc" ? 1 : -1;
        return 0;
    });
});

const totalPages = computed(
    () => Math.ceil(sortedBanners.value.length / dtPerPage) || 1,
);
const paginatedBanners = computed(() => {
    const start = (dtCurrentPage.value - 1) * dtPerPage;
    return sortedBanners.value.slice(start, start + dtPerPage);
});

const visiblePages = computed(() => {
    const current = dtCurrentPage.value;
    const total = totalPages.value;
    const delta = 2;
    const range = [];
    const rangeWithDots = [];
    let l;

    for (let i = 1; i <= total; i++) {
        if (
            i === 1 ||
            i === total ||
            (i >= current - delta && i <= current + delta)
        ) {
            range.push(i);
        }
    }

    for (let i of range) {
        if (l) {
            if (i - l === 2) {
                rangeWithDots.push(l + 1);
            } else if (i - l !== 1) {
                rangeWithDots.push("...");
            }
        }
        rangeWithDots.push(i);
        l = i;
    }
    return rangeWithDots;
});

const setPage = (p: number | string) => {
    if (typeof p === "number" && p >= 1 && p <= totalPages.value) {
        dtCurrentPage.value = p;
        window.scrollTo({ top: 0, behavior: "smooth" });
    }
};

// เคลียร์การเลือกตอนค้นหาใหม่
watch(searchQuery, () => {
    selectedIds.value = [];
    dtCurrentPage.value = 1;
});

const selectedIds = ref<number[]>([]);
const isAllSelected = computed(() => {
    return (
        sortedBanners.value.length > 0 &&
        selectedIds.value.length === sortedBanners.value.length
    );
});
const toggleOne = (id: number) => {
    if (selectedIds.value.includes(id)) {
        selectedIds.value = selectedIds.value.filter((i) => i !== id);
    } else {
        selectedIds.value.push(id);
    }
};
const toggleAll = () => {
    if (isAllSelected.value) {
        selectedIds.value = [];
    } else {
        selectedIds.value = sortedBanners.value.map((b) => b.id);
    }
};

// ฟังก์ชันลบที่เลือก (Bulk Delete)
const bulkDelete = async () => {
    if (selectedIds.value.length === 0) return;
    if (
        await showConfirm(
            "ยืนยันการลบ",
            `ต้องการลบแบนเนอร์ที่เลือกจำนวน ${selectedIds.value.length} รายการถาวรหรือไม่?`,
            "ยืนยันลบ",
            "warning",
            true,
        )
    ) {
        try {
            loading.value = true;
            for (const id of selectedIds.value) {
                await fetch(`/api/banners/${id}`, {
                    method: "DELETE",
                    headers: { "x-user-id": String(authStore.user?.id) },
                });
            }
            showSuccess("ลบแบนเนอร์เรียบร้อยแล้ว");
            selectedIds.value = [];
            fetchBanners();
        } catch (error) {
            showError("เกิดข้อผิดพลาดในการลบข้อมูล");
        } finally {
            loading.value = false;
        }
    }
};

// ฟังก์ชันเปิด/ปิด สถานะที่เลือกพร้อมกัน (Bulk Status Update)
const bulkStatusUpdate = async (newStatus: boolean) => {
    if (selectedIds.value.length === 0) return;
    const msg = newStatus ? "เปิดใช้งาน" : "ซ่อน";
    if (
        await showConfirm(
            `ยืนยันการ${msg}`,
            `ต้องการ${msg}แบนเนอร์ที่เลือกจำนวน ${selectedIds.value.length} รายการหรือไม่?`,
        )
    ) {
        try {
            loading.value = true;
            for (const id of selectedIds.value) {
                await fetch(`/api/banners/${id}`, {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                        "x-user-id": String(authStore.user?.id),
                    },
                    body: JSON.stringify({ is_active: newStatus }),
                });
            }
            showSuccess(`${msg}แบนเนอร์เรียบร้อยแล้ว`);
            selectedIds.value = [];
            fetchBanners();
        } catch (error) {
            showError(`เกิดข้อผิดพลาดในการ${msg}ข้อมูล`);
        } finally {
            loading.value = false;
        }
    }
};
// ----------------------------------------

const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
};
const handleDragLeave = () => {};
const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer?.files[0];
    if (file && file.type.startsWith("image/")) openCropper(file);
};
const handleUpload = (e: any) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith("image/")) openCropper(file);
};

const openCropper = (file: File) => {
    cropperRawFile.value = file;
    cropperImgUrl.value = URL.createObjectURL(file);
    showCropper.value = true;

    nextTick(() => {
        if (cropperEl.value) {
            if (cropperInstance) cropperInstance.destroy();
            cropperInstance = new Cropper(cropperEl.value, {
                aspectRatio: 16 / 9,
                viewMode: 1,
                dragMode: "move",
                guides: true,
                center: true,
                cropBoxMovable: true,
                cropBoxResizable: true,
            });
        }
    });
};

const confirmCrop = async () => {
    if (!cropperInstance || !cropperRawFile.value) return;
    const canvas = cropperInstance.getCroppedCanvas({
        maxWidth: 1920,
        maxHeight: 1080,
    });
    canvas.toBlob(async (blob) => {
        if (!blob) return;
        uploading.value = true;
        try {
            const titleHint = form.value.title?.trim() || "banner";
            const params = new URLSearchParams({
                type: "banners",
                name: titleHint,
            });
            if (form.value.image_url && form.value.image_url !== originalImageUrl.value) {
                params.append("oldUrl", form.value.image_url);
            }
            const formData = new FormData();
            formData.append("image", blob, "banner.png");
            console.log("[upload:banner:start]", {
                titleHint,
                blobType: blob.type,
                blobSize: blob.size,
                endpoint: `/api/upload?${params}`,
                userId: authStore.user?.id,
            });
            const res = await fetch(`/api/upload?${params}`, {
                method: "POST",
                headers: { "x-user-id": String(authStore.user?.id) },
                body: formData,
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                console.error("[upload:banner:failed]", {
                    status: res.status,
                    statusText: res.statusText,
                    error: err,
                });
                throw new Error(err.error || `Upload failed (${res.status})`);
            }
            const { url } = await res.json();
            console.log("[upload:banner:success]", { url });
            form.value.image_url = url;
        } catch (error: any) {
            console.error("[upload:banner:error]", error);
            uiStore.toast("error", "อัปโหลดรูปล้มเหลว", error.message);
        } finally {
            uploading.value = false;
            closeCropper();
        }
    }, "image/png");
};

const closeCropper = () => {
    showCropper.value = false;
    if (cropperImgUrl.value) URL.revokeObjectURL(cropperImgUrl.value);
    if (cropperInstance) cropperInstance.destroy();
    cropperInstance = null;
};

const saveBanner = async () => {
    if (!form.value.image_url) {
        showError("กรุณาอัปโหลดรูปภาพแบนเนอร์");
        return;
    }
    try {
        const url = form.value.id
            ? `/api/banners/${form.value.id}`
            : "/api/banners";
        const method = form.value.id ? "PATCH" : "POST";
        const response = await fetch(url, {
            method,
            headers: {
                "Content-Type": "application/json",
                "x-user-id": String(authStore.user?.id),
            },
            body: JSON.stringify(form.value),
        });
        if (response.ok) {
            showSuccess("บันทึกข้อมูลเรียบร้อย");
            originalImageUrl.value = form.value.image_url || "";
            resetForm();
            fetchBanners();
        } else {
            showError("ไม่สามารถบันทึกข้อมูลได้");
        }
    } catch (error) {
        showError("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    }
};

const openCreateForm = () => {
    resetFormState();
    showForm.value = true;
    router.push({ query: { ...route.query, sub: "form", id: undefined } });
};

const editBanner = (banner: any) => {
    form.value = { ...banner };
    originalImageUrl.value = banner.image_url || "";
    isEditing.value = true;
    showForm.value = true;
    activeMenuId.value = null;
    router.push({ query: { ...route.query, sub: "form", id: banner.id } });
    window.scrollTo({ top: 0, behavior: "smooth" });
};

const duplicateBanner = async (b: any) => {
    try {
        const copyData = { ...b };
        delete copyData.id;
        copyData.title = copyData.title
            ? `${copyData.title} (สำเนา)`
            : "สำเนาแบนเนอร์";
        copyData.is_active = false;

        const res = await fetch("/api/banners", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-user-id": String(authStore.user?.id),
            },
            body: JSON.stringify(copyData),
        });

        if (res.ok) {
            showSuccess("คัดลอกแบนเนอร์สำเร็จ");
            fetchBanners();
        } else {
            showError("ไม่สามารถคัดลอกได้");
        }
    } catch (error) {
        showError("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    }
};

const toggleStatus = async (id: number) => {
    const b = banners.value.find((x) => x.id === id);
    if (!b) return;
    try {
        const newStatus = !b.is_active;
        const res = await fetch(`/api/banners/${id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "x-user-id": String(authStore.user?.id),
            },
            body: JSON.stringify({ is_active: newStatus }),
        });

        if (res.ok) {
            b.is_active = newStatus;
            showSuccess(
                newStatus ? "เปิดแสดงแบนเนอร์แล้ว" : "ซ่อนแบนเนอร์แล้ว",
            );
        } else {
            showError("ไม่สามารถอัปเดตสถานะได้");
        }
    } catch (error) {
        showError("เกิดข้อผิดพลาดในการอัปเดตสถานะ");
    }
};

const deleteBanner = async (id: number) => {
    activeMenuId.value = null;
    if (
        await showConfirm(
            "ยืนยันการลบ",
            "ต้องการลบแบนเนอร์นี้หรือไม่?",
            "ยืนยันลบ",
            "warning",
            true,
        )
    ) {
        try {
            const res = await fetch(`/api/banners/${id}`, {
                method: "DELETE",
                headers: { "x-user-id": String(authStore.user?.id) },
            });
            if (res.ok) fetchBanners();
        } catch (error) {}
    }
};

const resetForm = async () => {
    // 🧹 Cleanup orphaned file if user uploaded a new image but then cancelled
    if (form.value.image_url && form.value.image_url !== originalImageUrl.value && form.value.image_url.startsWith('/uploads/')) {
        try {
            await fetch(`/api/upload`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    "x-user-id": String(authStore.user?.id || ''),
                },
                body: JSON.stringify({ oldUrl: form.value.image_url }),
            });
            console.log("[cancel] Deleted intermediate upload:", form.value.image_url);
        } catch (e) {
            console.error("Failed to delete intermediate upload:", e);
        }
    }

    if (route.query.sub) {
        router.back();
    } else {
        resetFormState();
        showForm.value = false;
    }
};

const openLink = (url: string) => window.open(url, "_blank");
</script>

<template>
    <div class="p-4 sm:p-6 pb-24 max-w-7xl mx-auto text-slate-800 relative">
        <div
            class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8"
        >
            <div>
                <h1
                    class="text-2xl sm:text-3xl font-extrabold tracking-tight font-sarabun"
                >
                    จัดการแบนเนอร์ (Banners)
                </h1>
            </div>
        </div>

        <div
            v-if="showForm"
            class="bg-white sm:rounded-[32px] sm:border sm:border-slate-200 overflow-hidden mb-10 animate-in fade-in slide-in-from-bottom-6 duration-500 -mx-4 sm:mx-0"
        >
            <!-- Form Header -->
            <div
                class="px-6 sm:px-10 py-8 border-b border-slate-100 flex items-center justify-center sm:justify-between"
            >
                <div class="flex items-center gap-5">
                    <div
                        class="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-500 flex-shrink-0"
                    >
                        <Plus v-if="!isEditing" :size="28" stroke-width="2.5" />
                        <Edit2 v-else :size="28" stroke-width="2.5" />
                    </div>
                    <div>
                        <h2
                            class="text-xl sm:text-2xl font-black text-slate-800 font-sarabun"
                        >
                            {{
                                isEditing
                                    ? "แก้ไขรายละเอียดแบนเนอร์"
                                    : "เพิ่มแบนเนอร์ใหม่"
                            }}
                        </h2>
                        <p
                            class="text-slate-500 text-sm font-medium font-sarabun mt-0.5"
                        >
                            ระบุข้อมูลที่จำเป็นสำหรับการแสดงผลหน้าเว็บไซต์
                        </p>
                    </div>
                </div>
                <button
                    @click="resetForm"
                    class="hidden sm:flex w-10 h-10 items-center justify-center rounded-full hover:bg-slate-100 transition-all text-slate-400 hover:text-slate-600"
                >
                    <X :size="24" stroke-width="2.5" />
                </button>
            </div>

            <div class="p-6 sm:p-10 md:p-12">
                <div class="max-w-4xl mx-auto">
                    <!-- Image Section -->
                    <div class="mb-12">
                        <div class="flex items-center justify-between mb-4">
                            <h3
                                class="text-base font-bold text-slate-800 flex items-center gap-2 font-sarabun"
                            >
                                <ImageIcon :size="20" class="text-orange-500" />
                                รูปภาพแบนเนอร์
                                <span class="text-rose-500 font-bold">*</span>
                            </h3>
                        </div>

                        <div
                            class="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start"
                        >
                            <div class="lg:col-span-3">
                                <label
                                    class="relative block aspect-video w-full bg-white border-2 border-dashed border-slate-200 rounded-[24px] overflow-hidden cursor-pointer hover:border-orange-400 hover:bg-orange-50/30 transition-all group"
                                    @dragover="handleDragOver"
                                    @dragleave="handleDragLeave"
                                    @drop="handleDrop"
                                >
                                    <input
                                        type="file"
                                        class="hidden"
                                        accept="image/*"
                                        @change="handleUpload"
                                    />
                                    <img
                                        v-if="form.image_url"
                                        :src="form.image_url"
                                        class="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                    />

                                    <div
                                        v-else-if="!uploading"
                                        class="absolute inset-0 flex flex-col items-center justify-center p-8"
                                    >
                                        <div
                                            class="w-16 h-16 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-400 group-hover:text-orange-500 group-hover:scale-110 transition-all"
                                        >
                                            <ImageIcon :size="32" />
                                        </div>
                                        <span
                                            class="text-base font-bold text-slate-700 font-sarabun"
                                            >คลิก
                                            หรือลากรูปมาวางเพื่ออัปโหลด</span
                                        >
                                        <span
                                            class="text-xs text-slate-400 mt-2 font-sarabun"
                                            >แนะนำขนาด 1920 × 1080 .png
                                            .jpg</span
                                        >
                                    </div>

                                    <div
                                        v-else
                                        class="absolute inset-0 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm"
                                    >
                                        <div class="relative">
                                            <div
                                                class="w-16 h-16 border-4 border-slate-100 border-t-orange-500 rounded-full animate-spin"
                                            ></div>
                                            <Loader2
                                                class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-orange-500"
                                                :size="24"
                                            />
                                        </div>
                                        <span
                                            class="font-bold text-slate-700 mt-4 font-sarabun"
                                            >กำลังประมวลผลรูปภาพ...</span
                                        >
                                    </div>
                                </label>
                            </div>

                            <div class="lg:col-span-2 space-y-4">
                                <div
                                    class="p-5 bg-orange-50/50 border border-orange-100 rounded-2xl"
                                >
                                    <h4
                                        class="text-sm font-bold text-orange-800 mb-2 font-sarabun"
                                    >
                                        คำแนะนำการอัปโหลด
                                    </h4>
                                    <ul
                                        class="text-[13px] text-orange-700/80 space-y-2 font-sarabun list-disc list-inside"
                                    >
                                        <li>
                                            ใช้อัตราส่วน 1920*1080
                                            เพื่อความสวยงาม
                                        </li>
                                        <li>
                                            ตัวอักษรในภาพควรมีขนาดใหญ่พอสมควร
                                        </li>
                                        <li>พื้นหลังควรมีความสว่างและสะอาด</li>
                                    </ul>
                                </div>
                                <button
                                    v-if="form.image_url && !uploading"
                                    @click.stop
                                    @click="form.image_url = ''"
                                    class="w-full py-3 text-rose-500 hover:bg-rose-50 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 border border-rose-100 font-sarabun"
                                >
                                    <Trash2 :size="16" /> ลบรูปภาพปัจจุบัน
                                </button>
                            </div>
                        </div>
                    </div>

                    <div
                        class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 mb-12"
                    >
                        <div class="flex flex-col gap-2 md:col-span-2">
                            <label
                                class="text-sm font-bold text-slate-700 px-1 font-sarabun"
                                >หัวข้อแบนเนอร์ (หลัก)</label
                            >
                            <input
                                v-model="form.title"
                                type="text"
                                class="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none transition-all font-sarabun text-slate-700 font-medium"
                                placeholder="เช่น กิจกรรมวิ่งมาราธอน 2024"
                            />
                        </div>

                        <div class="flex flex-col gap-2 md:col-span-2">
                            <label
                                class="text-sm font-bold text-slate-700 px-1 font-sarabun"
                                >ข้อความเสริม (Subtitle)</label
                            >
                            <input
                                v-model="form.subtitle"
                                type="text"
                                class="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none transition-all font-sarabun text-slate-700 font-medium"
                                placeholder="เช่น ร่วมชิงรางวัลกว่า 10,000 บาท"
                            />
                        </div>

                        <div class="flex flex-col gap-2">
                            <label
                                class="text-sm font-bold text-slate-700 px-1 font-sarabun"
                                >ประเภทการลิงก์</label
                            >
                            <div
                                class="custom-dropdown relative bg-white border border-slate-200 rounded-2xl"
                            >
                                <button
                                    type="button"
                                    @click="toggleDropdown('link_type', $event)"
                                    class="w-full px-5 py-3.5 text-left text-sm font-bold text-slate-700 flex items-center justify-between hover:bg-slate-50 transition-all rounded-2xl font-sarabun"
                                >
                                    <span class="flex items-center gap-2">
                                        {{
                                            form.link_type === "activity"
                                                ? "ลิงก์ไปยังกิจกรรมในระบบ"
                                                : form.link_type === "url"
                                                  ? "ลิงก์ไปยังเว็บภายนอก (URL)"
                                                  : "ไม่มี (แสดงรูปอย่างเดียว)"
                                        }}
                                    </span>
                                    <ChevronDown
                                        :size="18"
                                        class="text-slate-400 transition-transform duration-300"
                                        :class="{
                                            'rotate-180':
                                                activeDropdown === 'link_type',
                                        }"
                                    />
                                </button>
                                <div
                                    v-if="activeDropdown === 'link_type'"
                                    :class="
                                        dropdownDirection === 'up'
                                            ? 'bottom-full mb-1'
                                            : 'top-full mt-1'
                                    "
                                    class="absolute left-0 right-0 z-[100] bg-white border border-slate-200 rounded-2xl overflow-hidden animate-in"
                                >
                                    <div
                                        @click="
                                            form.link_type = 'none';
                                            activeDropdown = null;
                                        "
                                        class="px-5 py-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-orange-600 cursor-pointer transition-all border-b border-slate-50 flex items-center justify-between font-sarabun"
                                        :class="{
                                            'text-orange-600 font-bold':
                                                form.link_type === 'none',
                                        }"
                                    >
                                        ไม่มี (แสดงรูปอย่างเดียว)
                                        <Check
                                            v-if="form.link_type === 'none'"
                                            :size="16"
                                            stroke-width="3"
                                        />
                                    </div>
                                    <div
                                        @click="
                                            form.link_type = 'activity';
                                            activeDropdown = null;
                                        "
                                        class="px-5 py-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-orange-600 cursor-pointer transition-all border-b border-slate-50 flex items-center justify-between font-sarabun"
                                        :class="{
                                            'text-orange-600 font-bold':
                                                form.link_type === 'activity',
                                        }"
                                    >
                                        ลิงก์ไปยังกิจกรรมในระบบ
                                        <Check
                                            v-if="form.link_type === 'activity'"
                                            :size="16"
                                            stroke-width="3"
                                        />
                                    </div>
                                    <div
                                        @click="
                                            form.link_type = 'url';
                                            activeDropdown = null;
                                        "
                                        class="px-5 py-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-orange-600 cursor-pointer transition-all flex items-center justify-between font-sarabun"
                                        :class="{
                                            'text-orange-600 font-bold':
                                                form.link_type === 'url',
                                        }"
                                    >
                                        ลิงก์ไปยังเว็บภายนอก (URL)
                                        <Check
                                            v-if="form.link_type === 'url'"
                                            :size="16"
                                            stroke-width="3"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div
                            class="flex flex-col gap-2"
                            v-if="form.link_type === 'activity'"
                        >
                            <label
                                class="text-sm font-bold text-slate-700 px-1 font-sarabun"
                                >เลือกกิจกรรมที่ต้องการลิงก์</label
                            >
                            <div
                                class="custom-dropdown relative bg-white border border-slate-200 rounded-2xl"
                            >
                                <button
                                    type="button"
                                    @click="
                                        toggleDropdown(
                                            'link_activity_id',
                                            $event,
                                        )
                                    "
                                    class="w-full px-5 py-3.5 text-left text-sm font-bold text-slate-700 flex items-center justify-between hover:bg-slate-50 transition-all rounded-2xl font-sarabun"
                                >
                                    <span class="flex items-center gap-2">
                                        {{
                                            activities.find(
                                                (a) =>
                                                    a.id ===
                                                    form.link_activity_id,
                                            )?.title ||
                                            "-- กรุณาเลือกกิจกรรม --"
                                        }}
                                    </span>
                                    <ChevronDown
                                        :size="18"
                                        class="text-slate-400 transition-transform duration-300"
                                        :class="{
                                            'rotate-180':
                                                activeDropdown ===
                                                'link_activity_id',
                                        }"
                                    />
                                </button>
                                <div
                                    v-if="activeDropdown === 'link_activity_id'"
                                    :class="
                                        dropdownDirection === 'up'
                                            ? 'bottom-full mb-1'
                                            : 'top-full mt-1'
                                    "
                                    class="absolute left-0 right-0 z-[100] bg-white border border-slate-200 rounded-2xl overflow-y-auto max-h-60 custom-scrollbar animate-in"
                                >
                                    <div
                                        @click="
                                            form.link_activity_id = null;
                                            activeDropdown = null;
                                        "
                                        class="px-5 py-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-orange-600 cursor-pointer transition-all border-b border-slate-50 flex items-center justify-between font-sarabun"
                                        :class="{
                                            'text-orange-600 font-bold':
                                                form.link_activity_id === null,
                                        }"
                                    >
                                        -- กรุณาเลือกกิจกรรม --
                                        <Check
                                            v-if="
                                                form.link_activity_id === null
                                            "
                                            :size="16"
                                            stroke-width="3"
                                        />
                                    </div>
                                    <div
                                        v-for="act in activities"
                                        :key="act.id"
                                        @click="
                                            form.link_activity_id = act.id;
                                            activeDropdown = null;
                                        "
                                        class="px-5 py-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-orange-600 cursor-pointer transition-all border-b border-slate-50 flex items-center justify-between font-sarabun"
                                        :class="{
                                            'text-orange-600 font-bold':
                                                form.link_activity_id ===
                                                act.id,
                                        }"
                                    >
                                        {{ act.title }}
                                        <Check
                                            v-if="
                                                form.link_activity_id === act.id
                                            "
                                            :size="16"
                                            stroke-width="3"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div
                            class="flex flex-col gap-2"
                            v-if="form.link_type === 'url'"
                        >
                            <label
                                class="text-sm font-bold text-slate-700 px-1 font-sarabun"
                                >ระบุ URL ภายนอก</label
                            >
                            <div class="relative">
                                <div
                                    class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                                >
                                    <ExternalLink :size="18" />
                                </div>
                                <input
                                    v-model="form.link_url"
                                    type="url"
                                    class="w-full pl-12 pr-5 py-3.5 bg-white border border-slate-200 rounded-2xl focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none transition-all font-sarabun text-slate-700 font-medium"
                                    placeholder="https://www.example.com"
                                />
                            </div>
                        </div>

                        <div class="flex flex-col gap-2 md:col-span-2 mt-4">
                            <label
                                class="text-sm font-bold text-slate-700 px-1 font-sarabun"
                                >สถานะการแสดงผล</label
                            >
                            <div
                                class="flex items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 w-full sm:w-max transition-all hover:border-[#F05A23]/30 hover:bg-[#F05A23]/5 group"
                            >
                                <!-- ส่วนของสวิตช์เปิด/ปิด (ปรับปรุงให้รองรับข้อมูลทุกรูปแบบ) -->
                                <label
                                    class="relative inline-flex items-center cursor-pointer scale-110"
                                >
                                    <input
                                        type="checkbox"
                                        :checked="!!form.is_active"
                                        @change="
                                            form.is_active =
                                                ($event.target as HTMLInputElement).checked
                                        "
                                        class="sr-only peer"
                                    />
                                    <div
                                        class="w-12 h-6.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5.5 after:w-5.5 after:transition-all peer-checked:bg-[#F05A23] shadow-inner"
                                    ></div>
                                </label>

                                <!-- ส่วนของข้อความแสดงสถานะ -->
                                <div class="flex flex-col">
                                    <span
                                        class="text-[15px] font-bold font-sarabun"
                                        :class="
                                            !!form.is_active
                                                ? 'text-[#F05A23]'
                                                : 'text-slate-500'
                                        "
                                    >
                                        {{
                                            form.is_active
                                                ? "เปิดการใช้งาน"
                                                : "ซ่อนไว้"
                                        }}
                                    </span>
                                    <span
                                        class="text-[11px] text-slate-400 font-sarabun leading-tight"
                                    >
                                        {{
                                            form.is_active
                                                ? "แบนเนอร์จะปรากฏในหน้าผู้ใช้งานทันที"
                                                : "ผู้ใช้งานจะไม่เห็นแบนเนอร์รายการนี้"
                                        }}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Actions -->
                    <div
                        class="flex flex-col-reverse sm:flex-row justify-end items-center gap-4 pt-10 border-t border-slate-100"
                    >
                        <button
                            @click="resetForm"
                            class="w-full sm:w-auto px-8 py-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-2xl transition-all font-sarabun active:scale-95"
                        >
                            ยกเลิกและย้อนกลับ
                        </button>
                        <button
                            @click="saveBanner"
                            class="w-full sm:w-auto px-12 py-4 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-2xl transition-all hover:scale-[1.02] active:scale-95 font-sarabun flex items-center justify-center gap-2"
                        >
                            <Check :size="20" stroke-width="3" />
                            {{
                                isEditing
                                    ? "บันทึกการเปลี่ยนแปลง"
                                    : "ยืนยันการสร้างแบนเนอร์"
                            }}
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div v-if="!showForm" class="animate-in fade-in duration-300">
            <div
                class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6"
            >
                <div class="flex items-center gap-2 sm:gap-4 w-full">
                    <!-- Search Pill -->
                    <div class="search-pill-container flex-1 min-w-0">
                        <Search class="search-icon flex-shrink-0" :size="18" />
                        <input
                            v-model="searchQuery"
                            type="text"
                            placeholder="ค้นหาแบนเนอร์..."
                            class="w-full bg-transparent outline-none text-sm font-bold font-sarabun"
                        />
                        <button
                            v-if="searchQuery"
                            @click="searchQuery = ''"
                            class="btn-clear-search flex-shrink-0"
                        >
                            <X :size="14" />
                        </button>
                    </div>

                    <!-- Sliding Toggle (ลอกมาจาก AdminActivities) -->
                    <div
                        class="view-toggle-switch flex-shrink-0"
                        @click="
                            viewMode = viewMode === 'table' ? 'grid' : 'table'
                        "
                    >
                        <div
                            class="toggle-slider"
                            :class="{ 'is-right': viewMode === 'table' }"
                        ></div>
                        <div class="toggle-icon-area">
                            <LayoutGrid
                                v-if="viewMode === 'table'"
                                :size="16"
                                class="text-[#ff6b00]"
                            />
                            <Table2 v-else :size="16" class="text-[#ff6b00]" />
                        </div>
                    </div>
                </div>
            </div>

            <div class="flex items-center justify-between px-1 mb-6">
                <p
                    class="text-[11px] font-bold text-slate-400 uppercase tracking-widest font-sarabun"
                >
                    แสดง {{ paginatedBanners.length }} /
                    {{ sortedBanners.length }} รายการแบนเนอร์
                </p>
            </div>

            <div v-if="loading" class="flex justify-center py-10">
                <Loader2 class="animate-spin text-slate-300" :size="40" />
            </div>

            <div
                v-else-if="sortedBanners.length === 0"
                class="text-center py-16 px-4 flex flex-col items-center justify-center bg-white m-4 sm:m-6 border-2 border-dashed border-slate-200 rounded-xl"
            >
                <div
                    class="w-20 h-20 bg-white border border-slate-100 rounded-full flex items-center justify-center mb-6"
                >
                    <ImageIcon class="text-slate-300" :size="32" />
                </div>
                <h3 class="text-lg font-bold text-slate-700 mb-1 font-sarabun">
                    ไม่พบแบนเนอร์
                </h3>
                <p class="text-slate-500 mb-6 text-sm font-sarabun">
                    ยังไม่มีแบนเนอร์ หรือไม่มีข้อมูลตรงกับที่ค้นหา
                </p>
                <button
                    v-if="searchQuery"
                    @click="searchQuery = ''"
                    class="text-sm font-bold text-[#ff6b00] hover:underline font-sarabun"
                >
                    ล้างการค้นหา
                </button>
                <button
                    v-else
                    @click="openCreateForm"
                    class="w-full sm:w-auto px-5 py-2.5 bg-[#ff6b00] hover:bg-[#e66000] text-white font-bold rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2 shrink-0 whitespace-nowrap font-sarabun"
                >
                    <Plus :size="20" />
                    สร้างแบนเนอร์แรกของคุณ
                </button>
            </div>

            <div v-else-if="viewMode === 'grid' || viewMode === 'table'">
                <div
                    v-if="viewMode === 'grid'"
                    class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 p-4 sm:p-6"
                >
                    <div
                        v-for="b in paginatedBanners"
                        :key="b.id"
                        class="border border-slate-200 rounded-2xl transition-all group flex flex-col relative bg-white"
                        :class="[
                            activeMenuId === b.id
                                ? 'z-50 ring-2 ring-[#ff6b00]/20'
                                : 'z-10',
                            !b.is_active ? 'opacity-70' : '',
                        ]"
                    >
                        <div
                            class="aspect-video relative bg-slate-100 rounded-t-2xl overflow-hidden"
                        >
                            <div
                                @click.stop="toggleOne(b.id)"
                                class="absolute top-3 left-3 z-30 w-6 h-6 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all"
                                :class="
                                    selectedIds.includes(b.id)
                                        ? 'bg-orange-500 border-orange-500'
                                        : 'bg-white/90 backdrop-blur-sm border-slate-300 hover:bg-white'
                                "
                            >
                                <Check
                                    v-if="selectedIds.includes(b.id)"
                                    :size="14"
                                    class="text-white"
                                    stroke-width="4"
                                />
                            </div>

                            <div
                                v-if="!b.is_active"
                                class="absolute bottom-2 left-2 z-20 bg-slate-900/80 text-white text-[10px] font-bold px-2.5 py-1 rounded-md backdrop-blur-sm flex items-center gap-1 font-sarabun"
                            >
                                <EyeOff :size="12" /> ซ่อนอยู่
                            </div>

                            <img
                                :src="b.image_url"
                                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                        </div>

                        <div
                            class="p-4 flex-1 flex flex-col relative bg-white rounded-b-2xl"
                        >
                            <div
                                class="flex justify-between items-start mb-1 gap-2"
                            >
                                <h3
                                    class="font-bold text-slate-800 truncate flex-1 font-sarabun text-sm sm:text-base"
                                    :title="b.title"
                                >
                                    {{ b.title || "ไม่มีหัวข้อ" }}
                                </h3>

                                <div class="relative z-20 shrink-0">
                                    <button
                                        @click.stop="toggleMenu(b.id, $event)"
                                        class="p-1.5 -mr-2 -mt-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                                    >
                                        <MoreVertical :size="20" />
                                    </button>
                                </div>
                            </div>

                            <p
                                class="text-xs text-slate-400 truncate font-sarabun"
                                :title="b.subtitle"
                            >
                                {{ b.subtitle || "ไม่มีข้อมูลเสริม" }}
                            </p>
                        </div>
                    </div>
                </div>

                <div v-else-if="viewMode === 'table'" class="w-full">
                    <div class="overflow-x-auto custom-scrollbar">
                        <table
                            class="w-full text-left border-collapse whitespace-nowrap text-sm"
                        >
                            <thead
                                class="bg-white text-slate-600 font-black border-b border-slate-200"
                            >
                                <tr>
                                    <th
                                        class="p-3 sm:p-4 w-12 text-center sticky left-0 bg-white z-20 border-r border-slate-100"
                                    >
                                        <div
                                            @click="toggleAll"
                                            class="w-5 h-5 mx-auto rounded-full border-2 flex items-center justify-center cursor-pointer transition-all"
                                            :class="
                                                isAllSelected
                                                    ? 'bg-orange-500 border-orange-500'
                                                    : 'bg-white border-slate-300'
                                            "
                                        >
                                            <Check
                                                v-if="isAllSelected"
                                                :size="12"
                                                class="text-white"
                                                stroke-width="4"
                                            />
                                        </div>
                                    </th>
                                    <th
                                        class="p-3 sm:p-4 w-20 sm:w-24 text-center sticky left-12 bg-white z-20 border-r border-slate-100 font-sarabun"
                                    >
                                        รูปภาพ
                                    </th>
                                    <th
                                        class="p-3 sm:p-4 min-w-[220px] sticky left-[128px] sm:left-[144px] bg-white z-20 border-r border-slate-100 font-sarabun cursor-pointer group"
                                        @click="toggleDtSort('title')"
                                    >
                                        <div class="flex items-center gap-2">
                                            หัวข้อแบนเนอร์
                                            <ArrowUpDown
                                                :size="14"
                                                class="text-slate-400 group-hover:text-orange-500 transition-colors"
                                            />
                                        </div>
                                    </th>
                                    <th
                                        class="p-3 sm:p-4 min-w-[130px] sm:min-w-[150px] font-sarabun"
                                    >
                                        ประเภทการลิงก์
                                    </th>
                                    <th
                                        class="p-3 sm:p-4 min-w-[150px] sm:min-w-[200px] font-sarabun"
                                    >
                                        เลือกกิจกรรม
                                    </th>
                                    <th
                                        class="p-3 sm:p-4 min-w-[130px] sm:min-w-[150px] font-sarabun"
                                    >
                                        ข้อความเสริม
                                    </th>
                                    <th
                                        class="p-3 sm:p-4 min-w-[120px] text-center font-sarabun"
                                    >
                                        สถานะแบนเนอร์
                                    </th>
                                    <th
                                        class="p-3 sm:p-4 w-16 sm:w-20 text-center sticky right-0 bg-white z-20 border-l border-slate-100 font-sarabun"
                                    >
                                        จัดการ
                                    </th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100">
                                <tr
                                    v-for="b in paginatedBanners"
                                    :key="b.id"
                                    class="transition-colors group"
                                >
                                    <td
                                        class="p-3 sm:p-4 text-center sticky left-0 z-10 border-r border-slate-50 transition-colors bg-white"
                                    >
                                        <div
                                            @click.stop="toggleOne(b.id)"
                                            class="w-5 h-5 mx-auto rounded-full border-2 flex items-center justify-center cursor-pointer transition-all"
                                            :class="
                                                selectedIds.includes(b.id)
                                                    ? 'bg-orange-500 border-orange-500'
                                                    : 'bg-white border-slate-300'
                                            "
                                        >
                                            <Check
                                                v-if="
                                                    selectedIds.includes(b.id)
                                                "
                                                :size="12"
                                                class="text-white"
                                                stroke-width="4"
                                            />
                                        </div>
                                    </td>
                                    <td
                                        class="p-3 sm:p-4 text-center sticky left-12 z-10 border-r border-slate-50 transition-colors bg-white"
                                    >
                                        <div
                                            class="w-16 sm:w-24 aspect-video rounded-lg bg-slate-100 overflow-hidden border border-slate-200 mx-auto relative"
                                            :class="
                                                !b.is_active ? 'opacity-60' : ''
                                            "
                                        >
                                            <img
                                                :src="b.image_url"
                                                class="w-full h-full object-cover"
                                            />
                                        </div>
                                    </td>
                                    <td
                                        class="p-3 sm:p-4 sticky left-[128px] sm:left-[144px] z-10 border-r border-slate-50 transition-colors bg-white"
                                    >
                                        <div
                                            class="flex flex-col min-w-0"
                                            :class="
                                                !b.is_active ? 'opacity-60' : ''
                                            "
                                        >
                                            <p
                                                class="font-bold text-slate-900 truncate text-[13px] sm:text-[14px] font-sarabun"
                                                :title="b.title"
                                            >
                                                {{ b.title || "ไม่มีหัวข้อ" }}
                                            </p>
                                        </div>
                                    </td>
                                    <td class="p-3 sm:p-4">
                                        <div
                                            class="flex flex-col text-[11px] sm:text-[12px] font-sarabun"
                                            :class="
                                                !b.is_active ? 'opacity-60' : ''
                                            "
                                        >
                                            <span
                                                class="font-bold text-slate-700"
                                            >
                                                {{
                                                    b.link_type === "activity"
                                                        ? "กิจกรรมในระบบ"
                                                        : b.link_type === "url"
                                                          ? "เว็บไซต์ภายนอก (URL)"
                                                          : "ไม่มีลิงก์ (แสดงรูปเฉยๆ)"
                                                }}
                                            </span>
                                        </div>
                                    </td>
                                    <td class="p-3 sm:p-4">
                                        <div
                                            class="flex flex-col text-[11px] sm:text-[12px] text-slate-500 max-w-[150px] sm:max-w-[200px] truncate font-sarabun"
                                            :class="
                                                !b.is_active ? 'opacity-60' : ''
                                            "
                                        >
                                            <span
                                                v-if="
                                                    b.link_type === 'activity'
                                                "
                                                class="truncate"
                                                :title="
                                                    activities.find(
                                                        (a) =>
                                                            a.id ===
                                                            b.link_activity_id,
                                                    )?.title
                                                "
                                            >
                                                {{
                                                    activities.find(
                                                        (a) =>
                                                            a.id ===
                                                            b.link_activity_id,
                                                    )?.title ||
                                                    "ไม่พบข้อมูลกิจกรรม"
                                                }}
                                            </span>
                                            <span
                                                v-else-if="
                                                    b.link_type === 'url'
                                                "
                                                class="truncate text-blue-500 hover:underline cursor-pointer"
                                                @click="openLink(b.link_url)"
                                                :title="b.link_url"
                                            >
                                                {{
                                                    b.link_url ||
                                                    "ไม่มีข้อมูล URL"
                                                }}
                                            </span>
                                            <span v-else class="text-slate-300"
                                                >ไม่มีข้อมูล</span
                                            >
                                        </div>
                                    </td>
                                    <td class="p-3 sm:p-4">
                                        <div
                                            class="flex flex-col text-[11px] sm:text-[12px] text-slate-500 max-w-[150px] sm:max-w-[200px] truncate font-sarabun"
                                            :class="
                                                !b.is_active ? 'opacity-60' : ''
                                            "
                                            :title="b.subtitle"
                                        >
                                            {{ b.subtitle || "ไม่มีข้อมูล" }}
                                        </div>
                                    </td>
                                    <td class="p-3 sm:p-4 text-center">
                                        <div
                                            class="flex justify-center"
                                            :class="
                                                !b.is_active ? 'opacity-60' : ''
                                            "
                                        >
                                            <span
                                                v-if="b.is_active"
                                                class="px-2.5 py-1 rounded-md text-[10px] sm:text-[11px] font-bold border tracking-tight bg-emerald-50 text-emerald-600 border-emerald-100 w-max font-sarabun"
                                            >
                                                เปิดใช้งาน
                                            </span>
                                            <span
                                                v-else
                                                class="px-2.5 py-1 rounded-md text-[10px] sm:text-[11px] font-bold border tracking-tight bg-slate-100 text-slate-500 border-slate-200 w-max font-sarabun"
                                            >
                                                ซ่อนอยู่
                                            </span>
                                        </div>
                                    </td>
                                    <td
                                        class="p-3 sm:p-4 text-center sticky right-0 z-10 border-l border-slate-50 transition-colors bg-white"
                                    >
                                        <button
                                            @click.stop="
                                                toggleMenu(b.id, $event)
                                            "
                                            class="p-2 text-slate-400 hover:text-[#ff6b00] transition-colors rounded-xl"
                                            :class="
                                                selectedIds.includes(b.id)
                                                    ? 'hover:bg-orange-100/50'
                                                    : 'hover:bg-slate-100'
                                            "
                                        >
                                            <MoreVertical :size="18" />
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Smart Pagination (ลอกมาจาก AdminActivities) -->
                <div
                    v-if="totalPages > 1"
                    class="flex items-center justify-center gap-2 pt-6 pb-6 border-t border-slate-100 font-sarabun"
                >
                    <button
                        @click="setPage(dtCurrentPage - 1)"
                        :disabled="dtCurrentPage === 1"
                        class="rounded-full border border-slate-200 bg-white text-slate-500 hover:text-orange-500 hover:border-orange-500 disabled:opacity-30 disabled:hover:text-slate-500 disabled:hover:border-slate-200 transition-all shadow-sm flex items-center justify-center flex-shrink-0"
                        style="width: 40px; height: 40px"
                    >
                        <ChevronLeft :size="18" />
                    </button>

                    <div class="flex items-center gap-1.5">
                        <button
                            v-for="(p, idx) in visiblePages"
                            :key="idx"
                            @click="setPage(p)"
                            class="rounded-full text-sm font-bold transition-all flex items-center justify-center flex-shrink-0"
                            :class="[
                                dtCurrentPage === p
                                    ? 'bg-orange-500 border-orange-500 text-white'
                                    : p === '...'
                                      ? 'text-slate-400 cursor-default border-transparent'
                                      : 'bg-white border border-slate-200 text-slate-600 hover:border-orange-300 hover:text-orange-600',
                            ]"
                            style="width: 40px; height: 40px"
                        >
                            {{ p }}
                        </button>
                    </div>

                    <button
                        @click="setPage(dtCurrentPage + 1)"
                        :disabled="dtCurrentPage === totalPages"
                        class="rounded-full border border-slate-200 bg-white text-slate-500 hover:text-orange-500 hover:border-orange-500 disabled:opacity-30 disabled:hover:text-slate-500 disabled:hover:border-slate-200 transition-all shadow-sm flex items-center justify-center flex-shrink-0"
                        style="width: 40px; height: 40px"
                    >
                        <ChevronRight :size="18" />
                    </button>
                </div>
            </div>

            <div
                v-else-if="viewMode === 'preview'"
                class="bg-white border border-slate-200 rounded-[32px] p-8 sm:p-12 flex flex-col items-center justify-center relative min-h-[500px] shadow-xl shadow-slate-200/40 animate-in fade-in duration-500"
            >
                <div class="w-full flex items-center justify-between mb-4 px-2">
                    <h3
                        class="font-bold text-slate-700 flex items-center gap-2"
                    >
                        <Monitor class="text-[#ff6b00]" :size="20" />
                        จำลองหน้าเว็บผู้ใช้งาน (User Preview)
                    </h3>
                </div>

                <div
                    v-if="activePreviewBanners.length === 0"
                    class="w-full text-center text-slate-500 flex flex-col items-center py-20 bg-white rounded-2xl border border-slate-100"
                >
                    <div
                        class="w-20 h-20 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center mb-6 shadow-sm"
                    >
                        <Monitor class="text-slate-300" :size="32" />
                    </div>
                    <h3 class="text-lg font-bold text-slate-700 mb-1">
                        ยังไม่มีแบนเนอร์แสดงผล
                    </h3>
                    <p class="text-sm">
                        ต้องมีแบนเนอร์ที่ "เปิดใช้งาน" อย่างน้อย 1
                        รายการเพื่อดูตัวอย่าง
                    </p>
                </div>

                <div
                    v-else
                    class="w-full relative overflow-hidden bg-transparent"
                >
                    <div
                        class="carousel-container"
                        @mouseenter="stopAutoSlide"
                        @mouseleave="startAutoSlide"
                    >
                        <button
                            class="carousel-arrow left-arrow"
                            @click="scrollPrev"
                            v-if="activePreviewBanners.length > 1"
                        >
                            <ChevronLeft :size="24" />
                        </button>

                        <div
                            class="banner-track"
                            :class="{ 'is-dragging': isDraggingBanner }"
                            ref="bannerTrackRef"
                            @mousedown="startDrag"
                            @mousemove="doDrag"
                            @mouseup="stopDrag"
                            @mouseleave="stopDrag"
                        >
                            <div
                                v-for="banner in activePreviewBanners"
                                :key="banner.id"
                                class="hero-card"
                            >
                                <div class="hero-image-side">
                                    <img
                                        :src="banner.image_url"
                                        :alt="banner.title"
                                        draggable="false"
                                    />
                                </div>
                                <div class="hero-content-side">
                                    <h2 class="hero-title">
                                        {{ banner.title || "ไม่มีหัวข้อ" }}
                                    </h2>
                                    <p
                                        class="hero-subtitle"
                                        v-if="banner.subtitle"
                                    >
                                        {{ banner.subtitle }}
                                    </p>
                                    <div
                                        class="hero-actions"
                                        v-if="banner.link_type !== 'none'"
                                    >
                                        <button
                                            class="btn-hero-solid pointer-events-none"
                                        >
                                            {{
                                                banner.link_type === "url"
                                                    ? "เปิดลิงก์"
                                                    : "ดูรายละเอียด"
                                            }}
                                            <ExternalLink
                                                v-if="
                                                    banner.link_type === 'url'
                                                "
                                                :size="16"
                                                class="ml-1"
                                            />
                                            <ArrowRight
                                                v-else
                                                :size="16"
                                                class="ml-1"
                                            />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button
                            class="carousel-arrow right-arrow"
                            @click="scrollNext"
                            v-if="activePreviewBanners.length > 1"
                        >
                            <ChevronRight :size="24" />
                        </button>
                    </div>

                    <div
                        v-if="activePreviewBanners.length > 1"
                        class="flex justify-center gap-2 mt-4"
                    >
                        <button
                            v-for="(b, idx) in activePreviewBanners"
                            :key="b.id"
                            @click="currentPreviewIndex = idx"
                            class="w-2.5 h-2.5 rounded-full transition-all duration-300"
                            :class="
                                idx === currentPreviewIndex
                                    ? 'bg-[#ff6b00] w-8'
                                    : 'bg-slate-300 hover:bg-slate-400'
                            "
                        ></button>
                    </div>
                </div>
            </div>
        </div>

        <div
            v-if="!showForm && selectedIds.length === 0"
            class="fixed bottom-0 right-0 z-[40] flex items-center justify-end gap-3 p-4 sm:p-6"
        >
            <button
                @click="openCreateForm"
                class="bg-orange-500 text-white w-48 py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-orange-600 shadow-none font-sarabun"
            >
                <Plus :size="20" stroke-width="3" />
                เพิ่มแบนเนอร์ใหม่
            </button>
        </div>

        <div
            v-if="selectedIds.length > 0 && !showForm"
            class="fixed bottom-0 right-0 z-[40] flex items-center gap-3 p-4 sm:p-6"
            style="left: var(--sidebar-width, 0)"
        >
            <div
                class="flex items-center gap-3 w-full justify-between bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl px-4 py-3 max-w-7xl mx-auto"
            >
                <div class="flex items-center gap-3">
                    <div
                        class="bg-orange-500 text-white px-5 py-2.5 rounded-xl font-black text-sm font-sarabun"
                    >
                        เลือกไว้ {{ selectedIds.length }} รายการ
                    </div>
                    <button
                        @click="selectedIds = []"
                        class="px-5 py-2.5 bg-slate-100 text-slate-600 font-bold text-sm rounded-xl hover:bg-slate-200 transition-all font-sarabun"
                    >
                        ยกเลิก
                    </button>
                </div>

                <div class="flex items-center gap-2">
                    <!-- Bulk Enable -->
                    <button
                        @click="bulkStatusUpdate(true)"
                        class="bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-emerald-600 transition-all font-sarabun"
                    >
                        <Eye :size="18" />
                        <span class="hidden sm:inline">เปิดใช้งานทั้งหมด</span>
                        <span class="sm:hidden">เปิด</span>
                    </button>

                    <!-- Bulk Disable -->
                    <button
                        @click="bulkStatusUpdate(false)"
                        class="bg-slate-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-slate-600 transition-all font-sarabun"
                    >
                        <EyeOff :size="18" />
                        <span class="hidden sm:inline">ซ่อนทั้งหมด</span>
                        <span class="sm:hidden">ซ่อน</span>
                    </button>

                    <!-- Bulk Delete -->
                    <button
                        @click="bulkDelete"
                        class="bg-rose-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-rose-600 transition-all font-sarabun"
                    >
                        <Trash2 :size="18" />
                        <span class="hidden sm:inline">ลบที่เลือก</span>
                        <span class="sm:hidden">ลบ</span>
                    </button>
                </div>
            </div>
        </div>

        <Teleport to="body">
            <div v-if="activeMenuId !== null && activeMenuBanner">
                <div
                    @click="activeMenuId = null"
                    class="fixed inset-0 z-[9998]"
                ></div>

                <div
                    class="fixed z-[9999] w-64 bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden transition-all duration-200 animate-in fade-in zoom-in-95"
                    :style="{
                        top: menuPos.top + 'px',
                        right: menuPos.right + 'px',
                        transform: menuPos.transform,
                    }"
                    @click.stop
                >
                    <div
                        class="overflow-y-auto max-h-[350px] custom-scrollbar py-2"
                    >
                        <div class="px-4 py-2 mb-1 border-b border-slate-50">
                            <p
                                class="text-[10px] font-bold text-slate-400 uppercase tracking-wider"
                            >
                                จัดการทั่วไป
                            </p>
                        </div>

                        <button
                            @click="
                                editBanner(activeMenuBanner);
                                activeMenuId = null;
                            "
                            class="w-full px-4 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-3"
                        >
                            <div
                                class="p-1.5 bg-slate-100 rounded-lg text-slate-500"
                            >
                                <Edit2 :size="16" />
                            </div>
                            แก้ไขข้อมูล
                        </button>

                        <button
                            @click="
                                viewOnFrontend();
                                activeMenuId = null;
                            "
                            class="w-full px-4 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-3"
                        >
                            <div
                                class="p-1.5 bg-slate-100 rounded-lg text-slate-500"
                            >
                                <ExternalLink :size="16" />
                            </div>
                            ดูหน้าเว็บผู้ใช้
                        </button>

                        <button
                            @click="
                                openBannerPreview(activeMenuBanner);
                                activeMenuId = null;
                            "
                            class="w-full px-4 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-3"
                        >
                            <div
                                class="p-1.5 bg-slate-100 rounded-lg text-slate-500"
                            >
                                <Eye :size="16" />
                            </div>
                            ดูตัวอย่างแบนเนอร์
                        </button>

                        <div
                            class="px-4 py-2 mt-2 mb-1 border-b border-slate-50"
                        >
                            <p
                                class="text-[10px] font-bold text-slate-400 uppercase tracking-wider"
                            >
                                เครื่องมือด่วน
                            </p>
                        </div>

                        <button
                            @click="
                                duplicateBanner(activeMenuBanner);
                                activeMenuId = null;
                            "
                            class="w-full px-4 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-orange-50 hover:text-[#ff6b00] transition-colors flex items-center gap-3"
                        >
                            <div
                                class="p-1.5 bg-orange-100/50 rounded-lg text-[#ff6b00]"
                            >
                                <Copy :size="16" />
                            </div>
                            คัดลอกแบนเนอร์
                        </button>

                        <button
                            @click="
                                toggleStatus(activeMenuBanner.id);
                                activeMenuId = null;
                            "
                            class="w-full px-4 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-600 transition-colors flex items-center gap-3"
                        >
                            <div
                                class="p-1.5 bg-emerald-100/50 rounded-lg text-emerald-500"
                            >
                                <Eye
                                    v-if="!activeMenuBanner.is_active"
                                    :size="16"
                                />
                                <EyeOff v-else :size="16" />
                            </div>
                            {{
                                activeMenuBanner.is_active
                                    ? "ซ่อนแบนเนอร์"
                                    : "เปิดแสดงแบนเนอร์"
                            }}
                        </button>

                        <div class="h-px bg-slate-100 my-2 mx-4"></div>

                        <button
                            @click="
                                deleteBanner(activeMenuBanner.id);
                                activeMenuId = null;
                            "
                            class="w-full px-4 py-2.5 text-left text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-3"
                        >
                            <div
                                class="p-1.5 bg-rose-100/50 rounded-lg text-rose-500"
                            >
                                <Trash2 :size="16" />
                            </div>
                            ลบแบนเนอร์ถาวร
                        </button>
                    </div>
                </div>
            </div>
        </Teleport>

        <Teleport to="body">
            <div
                v-if="showPreviewModal && previewData"
                class="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6 animate-in fade-in"
            >
                <div
                    class="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"
                    @click="showPreviewModal = false"
                ></div>

                <div
                    class="relative w-full max-w-5xl bg-slate-50 rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] md:max-h-[90vh]"
                >
                    <div
                        class="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between z-10 shrink-0"
                    >
                        <div class="flex items-center gap-3">
                            <div
                                class="w-10 h-10 bg-orange-50 rounded-full flex items-center justify-center text-[#ff6b00]"
                            >
                                <Monitor :size="20" />
                            </div>
                            <div>
                                <h3
                                    class="font-bold text-lg text-slate-900 leading-tight"
                                >
                                    ตัวอย่างแบนเนอร์ (User View)
                                </h3>
                                <p
                                    class="text-[11px] font-medium text-slate-500"
                                >
                                    นี่คือมุมมองการ์ดที่ผู้ใช้งานจะเห็นบนหน้าแรกของเว็บไซต์
                                </p>
                            </div>
                        </div>
                        <button
                            @click="showPreviewModal = false"
                            class="p-2.5 bg-slate-100 hover:bg-rose-100 hover:text-rose-600 rounded-full transition-colors flex-shrink-0"
                        >
                            <X :size="20" />
                        </button>
                    </div>

                    <div
                        class="p-6 md:p-12 overflow-y-auto flex flex-col items-center custom-scrollbar flex-1 bg-gradient-to-b from-slate-50 to-slate-100"
                    >
                        <div
                            v-if="activePreviewBanners.length === 0"
                            class="w-full text-center text-slate-500 flex flex-col items-center py-20 bg-white rounded-2xl border border-slate-100 max-w-2xl"
                        >
                            <div
                                class="w-20 h-20 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center mb-6 shadow-sm"
                            >
                                <Monitor class="text-slate-300" :size="32" />
                            </div>
                            <h3 class="text-lg font-bold text-slate-700 mb-1">
                                ยังไม่มีแบนเนอร์แสดงผล
                            </h3>
                            <p class="text-sm">
                                ต้องมีแบนเนอร์ที่ "เปิดใช้งาน" อย่างน้อย 1
                                รายการเพื่อดูตัวอย่าง
                            </p>
                        </div>

                        <div
                            v-else
                            class="w-full relative overflow-hidden bg-transparent max-w-[1000px]"
                        >
                            <div class="carousel-container">
                                <button
                                    class="carousel-arrow left-arrow"
                                    @click="modalScrollPrev"
                                    v-if="sortedBanners.length > 1"
                                >
                                    <ChevronLeft :size="24" />
                                </button>

                                <div class="banner-track" ref="modalTrackRef">
                                    <div
                                        v-for="banner in sortedBanners"
                                        :key="banner.id"
                                        class="hero-card shadow-2xl border-none"
                                        :class="{
                                            'opacity-60 grayscale-[0.5]':
                                                !banner.is_active,
                                        }"
                                    >
                                        <div class="hero-image-side">
                                            <img
                                                :src="banner.image_url"
                                                :alt="banner.title"
                                                draggable="false"
                                            />
                                            <div
                                                v-if="!banner.is_active"
                                                class="absolute top-4 left-4 bg-slate-900/80 text-white text-[10px] font-bold px-3 py-1.5 rounded-full backdrop-blur-md flex items-center gap-1.5 z-30"
                                            >
                                                <EyeOff :size="12" /> ซ่อนอยู่
                                                (Draft)
                                            </div>
                                        </div>
                                        <div class="hero-content-side">
                                            <h2 class="hero-title">
                                                {{
                                                    banner.title ||
                                                    "ไม่มีหัวข้อ"
                                                }}
                                            </h2>
                                            <p
                                                class="hero-subtitle"
                                                v-if="banner.subtitle"
                                            >
                                                {{ banner.subtitle }}
                                            </p>
                                            <div
                                                class="hero-actions"
                                                v-if="
                                                    banner.link_type !== 'none'
                                                "
                                            >
                                                <button
                                                    class="btn-hero-solid pointer-events-none"
                                                >
                                                    {{
                                                        banner.link_type ===
                                                        "url"
                                                            ? "เปิดลิงก์"
                                                            : "ดูรายละเอียด"
                                                    }}
                                                    <ExternalLink
                                                        v-if="
                                                            banner.link_type ===
                                                            'url'
                                                        "
                                                        :size="16"
                                                        class="ml-1"
                                                    />
                                                    <ArrowRight
                                                        v-else
                                                        :size="16"
                                                        class="ml-1"
                                                    />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    class="carousel-arrow right-arrow"
                                    @click="modalScrollNext"
                                    v-if="sortedBanners.length > 1"
                                >
                                    <ChevronRight :size="24" />
                                </button>
                            </div>

                            <div
                                v-if="sortedBanners.length > 1"
                                class="flex justify-center gap-2 mt-8"
                            >
                                <button
                                    v-for="(b, idx) in sortedBanners"
                                    :key="b.id"
                                    @click="modalPreviewIndex = idx"
                                    class="w-3 h-3 rounded-full transition-all duration-300 border border-white shadow-sm"
                                    :class="
                                        idx === modalPreviewIndex
                                            ? 'bg-[#ff6b00] w-10'
                                            : 'bg-slate-300 hover:bg-slate-400'
                                    "
                                ></button>
                            </div>

                            <!-- Indicator text -->
                            <p
                                class="text-center text-slate-400 font-bold text-sm mt-4 font-sarabun"
                            >
                                แบนเนอร์ที่ {{ modalPreviewIndex + 1 }} จาก
                                {{ sortedBanners.length }} รายการ (รวมทั้งหมด)
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </Teleport>

        <div
            v-if="showCropper"
            class="fixed inset-0 z-[9999] bg-black/90 flex flex-col"
        >
            <div
                class="flex items-center justify-between p-4 border-b border-white/20"
            >
                <h3 class="text-white font-semibold flex items-center gap-2">
                    ตัดรูปภาพ (อัตราส่วน 16:9)
                </h3>
                <div class="flex items-center gap-3">
                    <button
                        @click="closeCropper"
                        class="px-4 py-2 text-white hover:bg-white/10 rounded-lg transition-colors font-medium text-sm"
                    >
                        ยกเลิก
                    </button>
                    <button
                        @click="confirmCrop"
                        class="px-5 py-2 bg-[#ff6b00] hover:bg-[#ff8533] text-white rounded-lg transition-colors font-bold text-sm"
                    >
                        ครอบตัดและอัปโหลด
                    </button>
                </div>
            </div>
            <div
                class="flex-1 min-h-0 bg-black/50 p-4 lg:p-8 flex items-center justify-center"
            >
                <div class="w-full max-w-4xl max-h-[80vh]">
                    <img
                        ref="cropperEl"
                        :src="cropperImgUrl"
                        class="max-w-full max-h-full block"
                    />
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
@keyframes zoomIn {
    from {
        opacity: 0;
        transform: scale(0.98);
    }
    to {
        opacity: 1;
        transform: scale(1);
    }
}
.animate-in {
    animation: zoomIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

/* ─── Search Pill (Copied from Activities.vue style) ─── */
.search-pill-container {
    display: flex;
    align-items: center;
    background: white;
    padding: 0 20px;
    height: 48px;
    border-radius: 99px;
    border: 1.5px solid #e2e8f0;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    gap: 12px;
}
.search-pill-container:focus-within {
    border-color: #ff6b00;
}
.search-icon {
    color: #9ca3af;
    flex-shrink: 0;
}
.search-pill-container input {
    flex: 1;
    border: none;
    background: transparent;
    outline: none;
    font-family: inherit;
    font-size: 0.95rem;
    font-weight: 600;
    color: #1e293b;
}
.search-pill-container input::placeholder {
    color: #9ca3af;
    font-weight: 500;
}
.btn-clear-search {
    background: white;
    border: 1px solid #e2e8f0;
    color: #64748b;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px;
    border-radius: 50%;
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.2s;
}
.btn-clear-search:hover {
    background: #e5e7eb;
    color: #1e293b;
}

/* ─── Sliding Toggle Switch (Physical 'Cover' Style) ─── */
.view-toggle-switch {
    position: relative;
    background: #f1f5f9;
    border: 1.5px solid #e2e8f0;
    border-radius: 99px;
    padding: 4px;
    display: flex;
    width: 82px;
    height: 44px;
    flex-shrink: 0;
    cursor: pointer;
    overflow: hidden;
    transition: all 0.3s ease;
}
.toggle-slider {
    position: absolute;
    top: 4px;
    left: 4px;
    width: 36px;
    height: 36px;
    background: white;
    border-radius: 50%;
    transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    z-index: 10;
}
.toggle-slider.is-right {
    transform: translateX(38px);
}
.toggle-icon-area {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-right: 12px;
    z-index: 5;
}
.view-toggle-switch:has(.is-right) .toggle-icon-area {
    justify-content: flex-start;
    padding-left: 12px;
    padding-right: 0;
}
.view-toggle-switch:hover .toggle-slider {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}

@media (max-width: 640px) {
    .view-toggle-switch {
        width: 80px;
        height: 40px;
        padding: 3px;
    }
    .toggle-slider {
        width: 34px;
        height: 34px;
        top: 3px;
        left: 3px;
    }
    .toggle-slider.is-right {
        transform: translateX(40px);
    }
    .toggle-btn {
        width: 40px;
    }
}

.custom-scrollbar::-webkit-scrollbar {
    width: 8px;
    height: 8px;
}
.custom-scrollbar::-webkit-scrollbar-track {
    background: #f8fafc;
    border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 10px;
    border: 2px solid #f8fafc;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
}

.no-scrollbar::-webkit-scrollbar {
    display: none;
}
.no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
}

/* =====================================
   🌟 HERO BANNER CAROUSEL
===================================== */
.carousel-container {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
}

.banner-track {
    display: flex;
    gap: 24px;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
    padding: 10px 24px;
    scroll-behavior: smooth;
    cursor: grab;
    width: 100%;
}
.banner-track::-webkit-scrollbar {
    display: none;
}
.banner-track.is-dragging {
    cursor: grabbing;
    scroll-behavior: auto;
    scroll-snap-type: none;
}

.hero-card {
    flex: 0 0 85%;
    scroll-snap-align: center;
    display: flex;
    flex-direction: row;
    background: #fff;
    border-radius: 24px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
    border: 1px solid #e5e7eb; /* border-light */
    overflow: hidden;
    user-select: none;
}

.carousel-arrow {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    z-index: 10;
    width: 44px;
    height: 44px;
    min-width: 44px;
    min-height: 44px;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    aspect-ratio: 1 / 1;
    color: #111827; /* text-dark */
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
    transition: 0.2s;
}
.carousel-arrow:hover {
    color: #ff6b00;
    border-color: #ff6b00;
}
.left-arrow {
    left: 10px;
}
.right-arrow {
    right: 10px;
}

.hero-image-side {
    width: 55%;
    background: transparent;
    aspect-ratio: 8/5;
    padding: 16px;
    box-sizing: border-box;
    display: flex;
}
.hero-image-side img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    pointer-events: none;
    border-radius: 4px;
}

.hero-content-side {
    width: 45%;
    padding: 32px;
    display: flex;
    flex-direction: column;
    justify-content: center;
}
.hero-title {
    font-size: 22px;
    font-weight: 800;
    color: #111827;
    margin: 0 0 12px 0;
    line-height: 1.3;
}
.hero-subtitle {
    font-size: 15px;
    color: #6b7280;
    margin: 0 0 24px 0;
    line-height: 1.5;
}

.hero-actions {
    display: flex;
    gap: 12px;
    margin-top: auto;
}
.btn-hero-solid {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #ff6b00;
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 12px 16px;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    transition: 0.2s;
}

@media (max-width: 768px) {
    .carousel-arrow {
        display: none;
    }
    .hero-card {
        flex: 0 0 92%;
        flex-direction: column;
        scroll-snap-align: center;
    }
    .hero-image-side {
        width: 100%;
        aspect-ratio: 8/5;
        padding: 12px;
    }
    .hero-content-side {
        width: 100%;
        padding: 20px;
    }
    .hero-title {
        font-size: 18px;
        margin-bottom: 8px;
    }
    .hero-subtitle {
        font-size: 14px;
        margin-bottom: 20px;
    }
    .btn-hero-solid {
        width: 100%;
    }
}
</style>

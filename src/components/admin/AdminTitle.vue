<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { 
  Medal, Plus, Edit2, Trash2, X, Save, 
  AlertCircle, EyeOff, Sparkles, Clock, Activity, Target,
  Copy, LayoutGrid, List, Palette, Wand2, ChevronLeft, ChevronRight,
  Search, Check, MoreVertical, Loader2, ChevronDown
} from 'lucide-vue-next';
import UserTitle from '../UserTitle.vue';
import { useAdminTitle, type TitleData, type TitleCondition } from '../../composables/useAdminTitle';
import Swal from 'sweetalert2';

const { titles, loading, fetchTitles, saveTitle, deleteTitle } = useAdminTitle();

const submitting = ref(false);
const isModalOpen = ref(false);
const localSearchQuery = ref("");

// --- Custom Dropdown State ---
const activeDropdown = ref<string | null>(null);

const toggleDropdown = (id: string) => {
  activeDropdown.value = activeDropdown.value === id ? null : id;
};

const closeDropdown = () => {
  activeDropdown.value = null;
};

const clearSearch = () => { localSearchQuery.value = ""; };

// --- Process Data ---
const processedTitles = computed(() => {
  const list = [...(titles.value || [])];
  if (localSearchQuery.value) {
    const q = localSearchQuery.value.toLowerCase();
    return list.filter(t => 
      (t.name || "").toLowerCase().includes(q) ||
      (t.rarity || "").toLowerCase().includes(q)
    );
  }
  return list;
});

// --- Pagination Logic ---
const currentPage = ref(1);
const itemsPerPage = ref(10); // ปรับให้ตรงกับหน้า AdminUsers

const totalPages = computed(() => Math.ceil(processedTitles.value.length / itemsPerPage.value));

const paginatedTitles = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  const end = start + itemsPerPage.value;
  return processedTitles.value.slice(start, end);
});

const changePage = (page: number) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
};

const visiblePages = computed(() => {
  const current = currentPage.value;
  const total = totalPages.value;
  const delta = 2;
  const range = [];
  const rangeWithDots = [];
  let l;
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
      range.push(i);
    }
  }
  for (let i of range) {
    if (l) {
      if (i - l === 2) {
        rangeWithDots.push(l + 1);
      } else if (i - l !== 1) {
        rangeWithDots.push('...');
      }
    }
    rangeWithDots.push(i);
    l = i;
  }
  return rangeWithDots;
});

// --- Selection Logic ---
const selectedIds = ref<string[]>([]);
const isAllSelected = computed(() => paginatedTitles.value.length > 0 && paginatedTitles.value.every(t => t.id && selectedIds.value.includes(t.id)));

const toggleOne = (id: string) => {
  if (selectedIds.value.includes(id)) {
    selectedIds.value = selectedIds.value.filter(i => i !== id);
  } else {
    selectedIds.value.push(id);
  }
};

const toggleAll = () => {
  if (isAllSelected.value) {
    selectedIds.value = selectedIds.value.filter(id => !paginatedTitles.value.some(t => t.id === id));
  } else {
    const newIds = [...selectedIds.value];
    paginatedTitles.value.forEach(t => {
      if (t.id && !newIds.includes(t.id)) newIds.push(t.id);
    });
    selectedIds.value = newIds;
  }
};

const bulkDelete = async () => {
  if (selectedIds.value.length === 0) return;
  const ok = await Swal.fire({
    title: 'ยืนยันการลบฉายา?',
    text: `คุณต้องการลบฉายาที่เลือกทั้ง ${selectedIds.value.length} รายการใช่หรือไม่? การลบนี้ไม่สามารถเรียกคืนได้`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ยืนยันลบ',
    cancelButtonText: 'ยกเลิก',
    customClass: {
      confirmButton: 'premium-swal-confirm premium-swal-confirm-danger',
      cancelButton: 'premium-swal-cancel',
      popup: 'premium-swal-popup'
    },
    buttonsStyling: false
  });

  if (ok.isConfirmed) {
    submitting.value = true;
    let successCount = 0;
    for (const id of selectedIds.value) {
      await deleteTitle(id);
      successCount++;
    }
    if (successCount > 0) {
      Swal.fire({
        icon: 'success',
        title: 'ลบสำเร็จ',
        text: `ลบฉายา ${successCount} รายการเรียบร้อยแล้ว`,
        confirmButtonColor: '#f97316'
      });
    }
    selectedIds.value = [];
    await fetchTitles();
    submitting.value = false;
  }
};

// --- Action Menu ---
const localActiveMenuId = ref<string | null>(null);
const localMenuPos = ref({ top: 0, right: 0 });

const toggleMenu = (id: string, event?: MouseEvent) => {
  if (localActiveMenuId.value === id) {
    localActiveMenuId.value = null;
    return;
  }
  localActiveMenuId.value = id;
  if (event) {
    const btn = event.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();
    const menuHeight = 180;
    const spaceBelow = window.innerHeight - rect.bottom;
    const right = Math.max(8, window.innerWidth - rect.right);
    if (spaceBelow < menuHeight && rect.top > menuHeight) {
      localMenuPos.value = { top: rect.top - menuHeight - 4, right };
    } else {
      localMenuPos.value = { top: Math.min(rect.bottom + 4, window.innerHeight - menuHeight - 8), right };
    }
  }
};

const defaultTitle: TitleData = {
  name: '',
  description: '',
  rarity: 'common',
  hint: '',
  color: '#10b981', 
  effect: 'glow-gold', 
  is_active: true,
  unlock_type: 'conditions',
  unlock_code: '',
  conditions: [{ type: 'count', actionType: 'any_activity', targetValue: '' }]
};

const formData = ref<TitleData>(JSON.parse(JSON.stringify(defaultTitle)));

onMounted(() => {
  const handleGlobalClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (localActiveMenuId.value && !target.closest('.action-menu-wrapper')) {
      localActiveMenuId.value = null;
    }
    if (activeDropdown.value && !target.closest('.custom-dropdown-wrapper')) {
      activeDropdown.value = null;
    }
  };
  window.addEventListener('click', handleGlobalClick);
  fetchTitles();
});

const openModal = (title?: TitleData) => {
  if (title) {
    formData.value = JSON.parse(JSON.stringify(title));
  } else {
    formData.value = JSON.parse(JSON.stringify(defaultTitle));
  }
  isModalOpen.value = true;
};

const duplicateTitle = (title: TitleData) => {
  const copy = JSON.parse(JSON.stringify(title));
  delete copy.id;
  copy.name = `${copy.name} (สำเนา)`; 
  formData.value = copy;
  isModalOpen.value = true;
};

const closeModal = () => {
  isModalOpen.value = false;
  activeDropdown.value = null;
  formData.value = JSON.parse(JSON.stringify(defaultTitle));
};

const addCondition = () => {
  formData.value.conditions.push({ type: 'count', actionType: 'any_activity', targetValue: '' });
};

const removeCondition = (index: number) => {
  formData.value.conditions.splice(index, 1);
};

const handleTypeChange = (cond: TitleCondition) => {
  if (cond.type === 'time' && !cond.timeRange) {
    cond.timeRange = { start: '00:00', end: '23:59' };
  }
};

const setMetricType = (cond: TitleCondition, type: 'count' | 'streak' | 'time') => {
  cond.type = type;
  handleTypeChange(cond);
  activeDropdown.value = null;
};

const handleSave = async () => {
  if (!formData.value.name.trim()) {
    alert('กรุณากรอกชื่อฉายา');
    return;
  }

  if (formData.value.unlock_type === 'code' && !formData.value.unlock_code?.trim()) {
    alert('กรุณากรอกรหัสปลดล็อค');
    return;
  }

  if (formData.value.unlock_type === 'conditions') {
    for (const cond of formData.value.conditions) {
      if (cond.type !== 'time' && (!cond.targetValue || Number(cond.targetValue) <= 0)) {
        alert('กรุณากรอกค่าเป้าหมายที่ถูกต้อง (มากกว่า 0)');
        return;
      }
      if (cond.type === 'time' && (!cond.timeRange?.start || !cond.timeRange?.end)) {
        alert('กรุณาระบุช่วงเวลาเริ่มต้นและสิ้นสุดให้ครบถ้วน');
        return;
      }
    }
  }

  try {
    submitting.value = true;
    await saveTitle(formData.value);
    closeModal();
    currentPage.value = 1;
  } catch (err) {
    alert('เกิดข้อผิดพลาดในการบันทึก กรุณาลองใหม่อีกครั้ง');
  } finally {
    submitting.value = false;
  }
};

const handleDelete = async (id: string) => {
  const ok = await Swal.fire({
    title: 'ยืนยันการลบฉายา?',
    text: `คุณต้องการลบฉายานี้ใช่หรือไม่?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ยืนยันลบ',
    cancelButtonText: 'ยกเลิก',
    customClass: {
      confirmButton: 'premium-swal-confirm premium-swal-confirm-danger',
      cancelButton: 'premium-swal-cancel',
      popup: 'premium-swal-popup'
    },
    buttonsStyling: false
  });

  if (ok.isConfirmed) {
    await deleteTitle(id);
    if (paginatedTitles.value.length === 1 && currentPage.value > 1) {
      currentPage.value--;
    }
  }
};

// --- Helper Functions ---
const getActionLabel = (action: string) => {
  switch (action) {
    case 'login': return 'เข้าใช้งานระบบ';
    case 'submit_activity': return 'ส่งกิจกรรมสำเร็จ';
    case 'any_activity': return 'ทำกิจกรรมใดๆ';
    default: return action;
  }
};

const getMetricLabel = (type: string) => {
  switch (type) {
    case 'count': return 'ยอดสะสม (ครั้ง)';
    case 'streak': return 'ต่อเนื่อง (วัน)';
    case 'time': return 'เฉพาะช่วงเวลา';
    default: return type;
  }
};
</script>

<template>
  <div class="font-sarabun bg-white min-h-screen w-full relative pb-24">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-in">
      
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div class="flex items-center gap-2 sm:gap-4 w-full">
          <div class="search-pill-container flex-1 min-w-0 w-full">
            <Search class="search-icon flex-shrink-0" ::size="18" />
            <input v-model="localSearchQuery" type="text" placeholder="ค้นหาชื่อฉายา หรือระดับ..." class="w-full bg-transparent outline-none text-sm font-bold" />
            <button v-if="localSearchQuery" @click="clearSearch" class="btn-clear-search flex-shrink-0">
              <X ::size="14" />
            </button>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between px-1">
        <p class="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
          แสดง {{ paginatedTitles.length }} / {{ processedTitles.length }} รายการ
        </p>
      </div>

      <div v-if="loading && titles.length === 0" class="space-y-4">
        <div v-for="i in 5" :key="i" class="h-16 bg-white border border-slate-100 animate-pulse rounded-2xl"></div>
      </div>

      <div v-else-if="processedTitles.length === 0" class="py-24 text-center bg-white rounded-3xl border border-dashed border-slate-300 flex flex-col items-center justify-center">
        <div class="w-20 h-20 bg-white border border-slate-100 rounded-full flex items-center justify-center mb-5">
           <Search ::size="32" class="text-slate-300" />
        </div>
        <p class="text-slate-800 font-bold text-xl mb-2">ไม่พบข้อมูลฉายา</p>
      </div>

      <div v-else class="w-full">
        <div class="overflow-x-auto no-scrollbar pb-32">
          <table class="w-full text-left border-collapse whitespace-nowrap text-sm">
            <thead class="bg-white text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th class="p-4 w-14 text-center border-r border-slate-100 sticky left-0 bg-white z-20">
                  <div @click="toggleAll" class="w-5 h-5 mx-auto rounded-full border-2 flex items-center justify-center cursor-pointer transition-all"
                    :class="isAllSelected ? 'bg-orange-500 border-orange-500' : 'bg-white border-slate-300'">
                    <Check v-if="isAllSelected" ::size="12" class="text-white" stroke-width="4" />
                  </div>
                </th>
                <th class="p-4 min-w-[240px] sticky left-14 bg-white z-20 border-r border-slate-100">
                  <span class="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">ฉายา (Title)</span>
                </th>
                <th class="p-4 text-center">
                  <span class="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">ระดับ (Tier)</span>
                </th>
                <th class="p-4 text-center">
                  <span class="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">สถานะ</span>
                </th>
                <th class="p-4 text-center">
                  <span class="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">เงื่อนไข (Conditions)</span>
                </th>
                <th class="p-4 w-20 text-center sticky right-0 bg-white z-20 border-l border-slate-100">
                  <span class="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">จัดการ</span>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="title in paginatedTitles" :key="title.id" class="transition-colors group hover:bg-slate-50/80">
                <td class="p-4 text-center border-r border-slate-50 sticky left-0 bg-white group-hover:bg-slate-50/80 transition-colors z-10">
                  <div @click.stop="toggleOne(title.id!)" class="w-5 h-5 mx-auto rounded-full border-2 flex items-center justify-center cursor-pointer transition-all"
                     :class="selectedIds.includes(title.id!) ? 'bg-orange-500 border-orange-500' : 'bg-white border-slate-300'">
                    <Check v-if="selectedIds.includes(title.id!)" ::size="12" class="text-white" stroke-width="4" />
                  </div>
                </td>
                <td class="p-4 sticky left-14 bg-white group-hover:bg-slate-50/80 transition-colors z-10 border-r border-slate-50 max-w-[240px]">
                  <div class="flex flex-col gap-1 items-start">
                    <UserTitle 
                      :name="title.name"
                      :rarity="title.rarity"
                      :color="title.color"
                      size="md"
                    />
                    <p v-if="title.rarity !== 'secret'" class="text-[12px] text-slate-400 truncate max-w-xs font-medium">{{ title.description || '-' }}</p>
                    <p v-else class="text-[12px] text-purple-400 truncate max-w-xs font-bold flex items-center gap-1"><EyeOff :size="12" /> ซ่อนจากผู้ใช้ทั่วไป</p>
                  </div>
                </td>
                <td class="p-4 text-center">
                  <span class="px-2.5 py-1 text-[10px] font-bold rounded-md uppercase tracking-wider inline-block border" 
                      :class="title.rarity === 'common' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : (title.rarity === 'rare' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-purple-50 text-purple-600 border-purple-100')">
                    {{ title.rarity === 'common' ? 'ทั่วไป' : (title.rarity === 'rare' ? 'หายาก' : 'ลับ') }}
                  </span>
                </td>
                <td class="p-4 text-center">
                   <span class="px-2.5 py-1 text-[10px] font-bold rounded-md uppercase tracking-wider inline-block border" 
                   :class="title.is_active ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-slate-100 text-slate-500 border-slate-200'">
                    {{ title.is_active ? 'เปิดแจก' : 'ปิดแจก' }}
                  </span>
                </td>
                <td class="p-4 text-center">
                  <div class="inline-flex flex-col items-center leading-none">
                    <span class="text-lg font-black text-slate-800">{{ title.conditions.length }}</span>
                    <span class="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">เงื่อนไข</span>
                  </div>
                </td>
                <td class="p-4 text-center sticky right-0 bg-white group-hover:bg-slate-50/80 transition-colors z-10 border-l border-slate-50">
                  <button @click.stop="toggleMenu(title.id!, $event)" 
                    class="w-10 h-10 mx-auto flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-xl transition-all action-menu-wrapper"
                    :class="{ 'bg-slate-200 text-slate-700': localActiveMenuId === title.id }">
                    <MoreVertical ::size="20" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="totalPages > 1" class="flex items-center justify-center gap-2 pt-4 pb-4">
        <button @click="changePage(currentPage - 1)" :disabled="currentPage === 1"
          class="rounded-full border border-slate-200 bg-white text-slate-500 hover:text-orange-500 hover:border-orange-500 disabled:opacity-30 disabled:hover:text-slate-500 disabled:hover:border-slate-200 transition-all flex items-center justify-center flex-shrink-0"
          style="width: 40px; height: 40px; min-width: 40px; min-height: 40px; padding: 0;">
          <ChevronLeft ::size="18" />
        </button>
        <div class="flex items-center gap-1.5">
          <button v-for="(p, index) in visiblePages" :key="index" @click="typeof p === 'number' ? changePage(p) : null"
            class="rounded-full text-sm font-bold transition-all flex items-center justify-center flex-shrink-0"
            :class="[
              currentPage === p ? 'bg-orange-500 border-orange-500 text-white border' : 
              typeof p === 'number' ? 'bg-white border-slate-200 text-slate-600 hover:border-orange-300 hover:text-orange-600 border' : 
              'bg-transparent border-transparent text-slate-400 cursor-default pointer-events-none'
            ]"
            style="width: 40px; height: 40px; min-width: 40px; min-height: 40px; padding: 0;"
            :disabled="typeof p !== 'number'">
            {{ p }}
          </button>
        </div>
        <button @click="changePage(currentPage + 1)" :disabled="currentPage === totalPages"
          class="rounded-full border border-slate-200 bg-white text-slate-500 hover:text-orange-500 hover:border-orange-500 disabled:opacity-30 disabled:hover:text-slate-500 disabled:hover:border-slate-200 transition-all flex items-center justify-center flex-shrink-0"
          style="width: 40px; height: 40px; min-width: 40px; min-height: 40px; padding: 0;">
          <ChevronRight ::size="18" />
        </button>
      </div>
      
      <div class="h-32"></div> </div>

    <div class="fixed bottom-0 right-0 z-[40] flex items-center justify-end gap-3 p-4 sm:p-6"
      :style="{ left: selectedIds.length > 0 ? 'var(--sidebar-width, 0)' : 'auto' }">
      <template v-if="selectedIds.length > 0">
        <div class="flex items-center gap-3 w-full justify-between bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl px-4 py-3 max-w-7xl mx-auto overflow-hidden shadow-lg">
          <div class="flex items-center gap-2 sm:gap-3 shrink-0">
            <div class="bg-orange-500 text-white px-3 sm:px-4 py-2 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap">
              เลือกไว้ {{ selectedIds.length }} รายการ
            </div>
            <button @click="selectedIds = []" class="px-3 sm:px-4 py-2 bg-slate-100 text-slate-600 font-bold text-xs sm:text-sm rounded-xl hover:bg-slate-200 transition-all shrink-0">
              ยกเลิก
            </button>
          </div>
          <div class="flex items-center gap-2 py-1">
            <button @click="bulkDelete" class="bg-rose-500 text-white px-3 sm:px-4 h-9 sm:h-10 rounded-xl text-xs sm:text-[13px] font-bold flex items-center gap-1.5 sm:gap-2 hover:bg-rose-600 transition-all shrink-0">
              <Trash2 ::size="16" />
              <span class="hidden sm:inline">ลบข้อมูล</span><span class="sm:hidden">ลบ</span>
            </button>
          </div>
        </div>
      </template>
      <template v-else>
        <button @click="openModal()" 
          class="bg-orange-500 text-white w-48 py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-orange-600 shadow-none transition-transform hover:-translate-y-1">
          <Plus ::size="20" stroke-width="3" />
          สร้างฉายาใหม่
        </button>
      </template>
    </div>

    <Teleport to="body">
      <div v-if="localActiveMenuId !== null">
        <div @click="localActiveMenuId = null" class="fixed inset-0 z-[9998]"></div>
        <div class="fixed z-[9999] w-48 bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden transition-all duration-200 animate-in fade-in zoom-in-95 shadow-xl"
             :style="{ top: localMenuPos.top + 'px', right: localMenuPos.right + 'px' }" @click.stop>
          <div class="py-2">
            <button @click="duplicateTitle(titles.find(t => t.id === localActiveMenuId)!); localActiveMenuId = null" class="w-full px-4 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-orange-50 hover:text-orange-600 transition-colors flex items-center gap-3">
              <div class="p-1.5 bg-slate-50 rounded-lg text-slate-500"><Copy ::size="16" /></div> คัดลอก
            </button>
            <button @click="openModal(titles.find(t => t.id === localActiveMenuId)!); localActiveMenuId = null" class="w-full px-4 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-orange-50 hover:text-orange-600 transition-colors flex items-center gap-3">
              <div class="p-1.5 bg-slate-50 rounded-lg text-slate-500"><Edit2 ::size="16" /></div> แก้ไข
            </button>
            <div class="h-px bg-slate-100 my-1 mx-4"></div>
            <button @click="handleDelete(localActiveMenuId); localActiveMenuId = null" class="w-full px-4 py-2.5 text-left text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-3">
              <div class="p-1.5 bg-rose-100/50 rounded-lg text-rose-500"><Trash2 ::size="16" /></div> ลบถาวร
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <teleport to="body">
      <transition name="fade">
        <div v-if="isModalOpen" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 font-sarabun" @click.self="closeModal">
          <div class="modal-window max-w-[700px]" style="animation: modalIn 0.2s ease">
            
            <div class="modal-header">
              <h3 class="font-bold text-slate-900 text-lg flex items-center gap-2">
                <div class="p-2 bg-orange-50 rounded-xl"><Medal ::size="20" class="text-orange-500" /></div> 
                {{ formData.id ? 'แก้ไขข้อมูลฉายา' : 'สร้างฉายาใหม่' }}
              </h3>
              <button @click="closeModal" class="p-2 text-slate-400 hover:text-slate-700 rounded-full transition-colors"><X ::size="20" /></button>
            </div>

            <div class="modal-body flex flex-col gap-12 bg-white px-6 sm:px-10 py-10 font-sarabun">
              
              <div class="flex flex-col gap-8">
                <h5 class="text-base font-bold text-slate-800 flex items-center gap-3">
                   <div class="w-1.5 h-6 bg-orange-500 rounded-full"></div>
                   ข้อมูลทั่วไป
                </h5>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-y-8 gap-x-12 px-2 sm:px-4">
                  
                  <div class="md:col-span-2">
                    <label class="block text-[13px] font-bold text-slate-700 mb-2.5">ระดับความหายาก (Tier)</label>
                    <div class="flex p-1.5 bg-slate-100/80 border border-slate-200 rounded-2xl">
                      <button type="button" @click="formData.rarity = 'common'" class="flex-1 py-2.5 text-[13px] font-bold rounded-xl transition-all" :class="formData.rarity === 'common' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'">ทั่วไป</button>
                      <button type="button" @click="formData.rarity = 'rare'" class="flex-1 py-2.5 text-[13px] font-bold rounded-xl transition-all" :class="formData.rarity === 'rare' ? 'bg-white shadow-sm text-amber-600' : 'text-slate-500 hover:text-slate-700'">หายาก</button>
                      <button type="button" @click="formData.rarity = 'secret'" class="flex-1 py-2.5 text-[13px] font-bold rounded-xl transition-all" :class="formData.rarity === 'secret' ? 'bg-white shadow-sm text-purple-600' : 'text-slate-500 hover:text-slate-700'">ลับ (ซ่อน)</button>
                    </div>
                  </div>

                  <div class="col-span-1">
                    <label class="block text-[13px] font-bold text-slate-700 mb-2.5">ชื่อฉายา <span class="text-red-500">*</span></label>
                    <input v-model="formData.name" type="text" placeholder="เช่น สุดยอดนักสู้" class="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl focus:border-orange-500 focus:ring-0 outline-none text-base text-slate-900 transition-all font-normal hover:border-slate-300 placeholder:text-slate-300">
                  </div>

                  <div v-if="formData.rarity === 'common' || formData.rarity === 'rare'" class="col-span-1">
                    <label class="block text-[13px] font-bold text-slate-700 mb-2.5">โทนสีของฉายา</label>
                    <div class="flex items-center gap-3">
                      <input v-model="formData.color" type="color" class="h-[52px] w-[60px] p-1 bg-white border border-slate-200 rounded-2xl cursor-pointer">
                      <span class="text-sm font-mono font-bold text-slate-500 bg-slate-50 px-4 py-3.5 rounded-2xl border border-slate-200 flex-1">{{ formData.color }}</span>
                    </div>
                  </div>

                  <div class="md:col-span-2 flex items-center justify-between px-5 py-4 bg-white border border-slate-200 rounded-2xl">
                    <div>
                      <p class="font-bold text-slate-800 text-[13px]">เปิดใช้งานฉายานี้</p>
                      <p class="text-xs text-slate-500 mt-0.5">ให้ผู้ใช้ทำภารกิจและปลดล็อคได้ตามปกติ</p>
                    </div>
                    <button type="button" 
                            class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
                            :class="formData.is_active ? 'bg-orange-500' : 'bg-slate-300'"
                            @click="formData.is_active = !formData.is_active">
                      <span class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                            :class="formData.is_active ? 'translate-x-5' : 'translate-x-0'"/>
                    </button>
                  </div>

                  <div class="md:col-span-2" v-if="formData.rarity !== 'secret'">
                    <label class="block text-[13px] font-bold text-slate-700 mb-2.5">คำอธิบาย</label>
                    <textarea v-model="formData.description" rows="2" class="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl focus:border-orange-500 focus:ring-0 outline-none text-base text-slate-900 transition-all font-normal resize-none hover:border-slate-300 placeholder:text-slate-300" placeholder="อธิบายสั้นๆ เกี่ยวกับฉายานี้..."></textarea>
                  </div>

                  <div v-if="formData.rarity === 'secret'" class="md:col-span-2 p-5 bg-purple-50/50 border border-purple-100 rounded-2xl">
                    <label class="text-[13px] font-bold flex items-center gap-1.5 text-purple-800 mb-3">
                      <EyeOff :size="16" class="text-purple-500" /> คำใบ้สำหรับผู้ใช้ <span class="text-xs font-normal text-purple-400 ml-1">(แสดงเมื่อยังไม่ปลดล็อค)</span>
                    </label>
                    <input v-model="formData.hint" type="text" class="w-full px-5 py-3.5 bg-white border border-purple-200 rounded-2xl text-slate-700 focus:border-purple-500 outline-none transition-all text-base placeholder:text-slate-300" placeholder="เช่น 'ตื่นก่อนนกฮูก ขยับก่อนใคร...'">
                  </div>

                </div>
              </div>

              <div class="flex flex-col gap-8">
                <h5 class="text-base font-bold text-slate-800 flex items-center gap-3">
                   <div class="w-1.5 h-6 bg-slate-300 rounded-full"></div>
                   วิธีการปลดล็อค
                </h5>
                <div class="grid grid-cols-1 gap-y-8 gap-x-12 px-2 sm:px-4">
                  
                  <div>
                    <label class="block text-[13px] font-bold text-slate-700 mb-2.5">รูปแบบการรับฉายา</label>
                    <div class="flex p-1.5 bg-slate-100/80 border border-slate-200 rounded-2xl">
                      <button type="button" @click="formData.unlock_type = 'conditions'" class="flex-1 py-2.5 text-[13px] font-bold rounded-xl transition-all" :class="formData.unlock_type === 'conditions' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'">ตามเงื่อนไข</button>
                      <button type="button" @click="formData.unlock_type = 'open'" class="flex-1 py-2.5 text-[13px] font-bold rounded-xl transition-all" :class="formData.unlock_type === 'open' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'">กดรับได้เลย</button>
                      <button type="button" @click="formData.unlock_type = 'code'" class="flex-1 py-2.5 text-[13px] font-bold rounded-xl transition-all" :class="formData.unlock_type === 'code' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'">ใช้รหัส</button>
                    </div>
                  </div>

                  <div v-if="formData.unlock_type === 'code'" class="animate-in slide-in-from-top-2">
                    <label class="block text-[13px] font-bold text-slate-700 mb-2.5">รหัสสำหรับปลดล็อค (Unlock Code)</label>
                    <input v-model="formData.unlock_code" type="text" placeholder="ระบุรหัส เช่น BANANA2024" class="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl focus:border-orange-500 focus:ring-0 outline-none text-base text-slate-900 transition-all font-normal hover:border-slate-300">
                  </div>

                </div>
              </div>

              <div v-if="formData.unlock_type === 'conditions'" class="flex flex-col gap-6 border-t border-slate-100 pt-8">
                <div class="flex items-center justify-between px-2 sm:px-4">
                  <h5 class="text-base font-bold text-slate-800 flex items-center gap-3">
                     <div class="w-1.5 h-6 bg-slate-300 rounded-full"></div>
                     เงื่อนไขการปลดล็อค
                  </h5>
                  <button @click="addCondition" class="text-[13px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-xl transition-colors flex items-center gap-1.5">
                    <Plus :size="16" /> เพิ่มเงื่อนไข
                  </button>
                </div>

                <div class="space-y-4 px-2 sm:px-4">
                  <div v-if="formData.conditions.length === 0" class="py-10 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                    <p class="text-slate-400 text-sm font-medium">ยังไม่มีเงื่อนไข กดปุ่ม "เพิ่มเงื่อนไข" ด้านบน</p>
                  </div>
                  
                  <div v-for="(cond, index) in formData.conditions" :key="index"
                    class="bg-white border border-slate-200 rounded-3xl p-6 flex flex-col gap-6 relative group transition-all"
                  >
                    <button @click="removeCondition(index)" class="absolute top-4 right-4 w-8 h-8 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full flex items-center justify-center transition-all z-10">
                      <X :size="18" stroke-width="2.5" />
                    </button>

                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                      <div class="col-span-1">
                        <label class="block text-[12px] font-bold text-slate-500 mb-2">เมื่อผู้ใช้...</label>
                        <div class="relative custom-dropdown-wrapper">
                          <button @click.stop="toggleDropdown(`action-${index}`)" type="button" 
                            class="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl focus:border-orange-500 outline-none text-sm text-slate-900 transition-all flex items-center justify-between hover:border-slate-300"
                            :class="{ 'border-orange-500 ring-1 ring-orange-500/20': activeDropdown === `action-${index}` }">
                            <span class="font-bold">{{ getActionLabel(cond.actionType) }}</span>
                            <ChevronDown ::size="18" class="text-slate-400 transition-transform duration-200" :class="{ 'rotate-180': activeDropdown === `action-${index}` }" />
                          </button>
                          
                          <transition name="fade">
                            <div v-if="activeDropdown === `action-${index}`" class="absolute z-[100] mt-2 w-full bg-white border border-slate-100 rounded-2xl shadow-xl py-2 animate-in fade-in zoom-in-95">
                              <button @click="cond.actionType = 'login'; activeDropdown = null" class="w-full px-5 py-3 text-left text-sm font-bold transition-colors flex justify-between items-center" :class="cond.actionType === 'login' ? 'text-orange-600 bg-orange-50/50' : 'text-slate-700 hover:bg-slate-50'">
                                เข้าใช้งานระบบ <Check v-if="cond.actionType === 'login'" :size="16" />
                              </button>
                              <button @click="cond.actionType = 'submit_activity'; activeDropdown = null" class="w-full px-5 py-3 text-left text-sm font-bold transition-colors flex justify-between items-center" :class="cond.actionType === 'submit_activity' ? 'text-orange-600 bg-orange-50/50' : 'text-slate-700 hover:bg-slate-50'">
                                ส่งกิจกรรมสำเร็จ <Check v-if="cond.actionType === 'submit_activity'" :size="16" />
                              </button>
                              <button @click="cond.actionType = 'any_activity'; activeDropdown = null" class="w-full px-5 py-3 text-left text-sm font-bold transition-colors flex justify-between items-center" :class="cond.actionType === 'any_activity' ? 'text-orange-600 bg-orange-50/50' : 'text-slate-700 hover:bg-slate-50'">
                                ทำกิจกรรมใดๆ <Check v-if="cond.actionType === 'any_activity'" :size="16" />
                              </button>
                            </div>
                          </transition>
                        </div>
                      </div>

                      <div class="col-span-1">
                        <label class="block text-[12px] font-bold text-slate-500 mb-2">ตรวจสอบจาก...</label>
                        <div class="relative custom-dropdown-wrapper">
                          <button @click.stop="toggleDropdown(`metric-${index}`)" type="button" 
                            class="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl focus:border-orange-500 outline-none text-sm text-slate-900 transition-all flex items-center justify-between hover:border-slate-300"
                            :class="{ 'border-orange-500 ring-1 ring-orange-500/20': activeDropdown === `metric-${index}` }">
                            <span class="font-bold">{{ getMetricLabel(cond.type) }}</span>
                            <ChevronDown ::size="18" class="text-slate-400 transition-transform duration-200" :class="{ 'rotate-180': activeDropdown === `metric-${index}` }" />
                          </button>
                          
                          <transition name="fade">
                            <div v-if="activeDropdown === `metric-${index}`" class="absolute z-[100] mt-2 w-full bg-white border border-slate-100 rounded-2xl shadow-xl py-2 animate-in fade-in zoom-in-95">
                              <button @click="setMetricType(cond, 'count')" class="w-full px-5 py-3 text-left text-sm font-bold transition-colors flex justify-between items-center" :class="cond.type === 'count' ? 'text-orange-600 bg-orange-50/50' : 'text-slate-700 hover:bg-slate-50'">
                                ยอดสะสม (ครั้ง) <Check v-if="cond.type === 'count'" :size="16" />
                              </button>
                              <button @click="setMetricType(cond, 'streak')" class="w-full px-5 py-3 text-left text-sm font-bold transition-colors flex justify-between items-center" :class="cond.type === 'streak' ? 'text-orange-600 bg-orange-50/50' : 'text-slate-700 hover:bg-slate-50'">
                                ต่อเนื่อง (วัน) <Check v-if="cond.type === 'streak'" :size="16" />
                              </button>
                              <button @click="setMetricType(cond, 'time')" class="w-full px-5 py-3 text-left text-sm font-bold transition-colors flex justify-between items-center" :class="cond.type === 'time' ? 'text-orange-600 bg-orange-50/50' : 'text-slate-700 hover:bg-slate-50'">
                                เฉพาะช่วงเวลา <Check v-if="cond.type === 'time'" :size="16" />
                              </button>
                            </div>
                          </transition>
                        </div>
                      </div>

                      <div class="col-span-1">
                        <label class="block text-[12px] font-bold text-slate-500 mb-2">เป้าหมาย</label>
                        <input v-if="cond.type !== 'time'" v-model="cond.targetValue" type="number" class="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl focus:border-orange-500 focus:ring-0 outline-none text-sm text-slate-900 transition-all font-bold hover:border-slate-300 placeholder:text-slate-300 placeholder:font-normal" placeholder="ระบุจำนวน">
                        
                        <div v-if="cond.type === 'time'" class="flex gap-2 items-center">
                          <input :value="cond.timeRange?.start || ''" @input="cond.timeRange = { start: ($event.target as HTMLInputElement).value, end: cond.timeRange?.end || '' }" type="time" class="w-full px-3 py-3.5 text-sm bg-white border border-slate-200 rounded-2xl focus:border-orange-500 outline-none transition-all font-bold text-slate-700">
                          <span class="text-slate-300 font-bold text-sm">-</span>
                          <input :value="cond.timeRange?.end || ''" @input="cond.timeRange = { start: cond.timeRange?.start || '', end: ($event.target as HTMLInputElement).value }" type="time" class="w-full px-3 py-3.5 text-sm bg-white border border-slate-200 rounded-2xl focus:border-orange-500 outline-none transition-all font-bold text-slate-700">
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              </div>

            </div>
            
            <div class="modal-footer">
              <button @click="closeModal" class="flex-1 sm:flex-none px-6 py-3 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">ยกเลิก</button>
              <button @click="handleSave" :disabled="submitting" class="flex-1 sm:flex-none px-8 py-3 text-sm font-bold text-white bg-orange-500 rounded-xl hover:bg-orange-600 transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50">
                <Loader2 v-if="submitting" ::size="18" class="animate-spin" />
                <Save v-else ::size="18" /> 
                {{ submitting ? "กำลังบันทึก..." : "บันทึกข้อมูล" }}
              </button>
            </div>
            
          </div>
        </div>
      </transition>
    </teleport>

  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&family=Kanit:ital,wght@0,400;0,700;0,800;1,700&display=swap');
.font-sarabun {
  font-family: 'Sarabun', sans-serif;
}
.font-sarabun input, .font-sarabun button, .font-sarabun textarea {
  font-family: 'Sarabun', sans-serif;
}

/* Transitions */
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
@keyframes zoomIn {
  from { opacity: 0; transform: scale(0.98); }
  to { opacity: 1; transform: scale(1); }
}
.animate-in { 
  animation: zoomIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes modalIn {
  from { opacity: 0; transform: scale(0.98) translateY(4px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

/* Base sticky header styling */
thead th.sticky {
  z-index: 20;
}

.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

/* ─── Search Pill ─── */
.search-pill-container { 
  display: flex; 
  align-items: center; 
  background: white;
  padding: 0 20px; 
  height: 48px;
  border-radius: 99px; 
  border: 1.5px solid #E2E8F0; 
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  gap: 12px;
}
.search-pill-container:focus-within { 
  border-color: #f97316;
}
.search-icon { color: #9CA3AF; flex-shrink: 0; }
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
.search-pill-container input::placeholder { color: #9CA3AF; font-weight: 500; }
.btn-clear-search { 
  background: #F3F4F6; 
  border: none; 
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
.btn-clear-search:hover { background: #E5E7EB; color: #1e293b; }

@media (max-width: 768px) {
  table th, table td {
    padding: 12px 10px !important;
    font-size: 12px !important;
  }
  .sticky.left-0 { 
    width: 45px !important;
    min-width: 45px !important; 
    border-right: none !important;
  }
  .sticky.left-14 { 
    left: 44px !important;
    min-width: 160px !important; 
    max-width: 160px !important; 
    border-left: none !important;
  }
  th.w-20, td.sticky.right-0 {
    width: 50px !important;
    min-width: 50px !important;
  }
  .sticky.left-14, .sticky.right-0 {
    box-shadow: none !important;
  }
}

/* ─── Premium Modal System ─── */
.modal-window {
  background: white;
  width: 95%;
  height: 85vh;
  display: flex;
  flex-direction: column;
  border-radius: 24px;
  overflow: hidden;
  border: 1px solid #f1f5f9;
}
.modal-header {
  padding: 16px 24px;
  border-bottom: 1px solid #f1f5f9;
  background: white;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  z-index: 10;
}
.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  scrollbar-width: thin;
  scrollbar-color: #e2e8f0 transparent;
}
.modal-body::-webkit-scrollbar {
  width: 6px;
}
.modal-body::-webkit-scrollbar-track {
  background: transparent;
}
.modal-body::-webkit-scrollbar-thumb {
  background: #e2e8f0;
  border-radius: 10px;
}
.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid #f1f5f9;
  background: white;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  flex-shrink: 0;
}

@media (max-width: 640px) {
  .modal-window {
    height: 92vh;
    border-radius: 20px;
  }
  .modal-header, .modal-footer {
    padding: 12px 16px;
  }
  .modal-body {
    padding: 16px;
  }
  .modal-footer {
    flex-direction: row; 
    flex-wrap: wrap;
  }
}
</style>

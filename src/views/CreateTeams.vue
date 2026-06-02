<script setup lang="ts">
import { ref, computed, onMounted, watch, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { authStore } from "../store/auth";
import {
  Users, Lock, Crown, Plus, ArrowLeft,
  KeyRound, Loader2, Zap, ChevronRight, ChevronLeft, X,
  Search, ShieldCheck, MapPin, Inbox, Info,
  Heart, Activity, Star
} from "lucide-vue-next";
import { swal, showSuccess, showError } from "../lib/swal";
import { useRealtime } from "../composables/useRealtime";
import { uiStore } from "../store/ui";
import { langStore } from "../store/lang";
const router = useRouter();
type User = { id: string; name: string; avatar?: string; fname_th?: string; nickname?: string };
type Room = {
  id: string; code: string; name: string;
  maxMembers: number; isPrivate: boolean;
  password?: string;
  hostId: string; members: User[];
};
const currentUser = computed(() => ({
  id: authStore.user?.id ?? null,
  name: authStore.user?.fname_th ?? "คุณ",
  avatar: authStore.user?.picture_url ?? null,
  teamId: authStore.user?.team_id ?? null,
  canCreateActivity: authStore.user?.role === 'admin',
}));
const loading = ref(false);
const skeletonVisible = ref(false);
const isInitializing = ref(false);
const currentView = ref<"hub" | "search" | "create">("hub");
const rooms = ref<Room[]>([]);
const searchQuery = ref("");
const showCreateModal = ref(false);
const showCodeModal = ref(false);
const showSearchModal = ref(false);
const codeDigits = ref<string[]>(Array(6).fill(''));
const joinCodeStr = computed(() => codeDigits.value.join('').toUpperCase());
const joinCodeLoading = ref(false);
const handleDigitInput = (e: Event, idx: number) => {
  const input = e.target as HTMLInputElement;
  const val = input.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (val.length > 1) {
    const chars = val.slice(0, 6 - idx).split('');
    chars.forEach((c, i) => { codeDigits.value[idx + i] = c; });
    const nextIdx = Math.min(idx + chars.length, 5);
    const nextEl = document.getElementById(`otp-${nextIdx}`);
    if (nextEl) (nextEl as HTMLInputElement).focus();
  } else {
    codeDigits.value[idx] = val.slice(-1);
    if (val && idx < 5) {
      const nextEl = document.getElementById(`otp-${idx + 1}`);
      if (nextEl) (nextEl as HTMLInputElement).focus();
    }
  }
  input.value = codeDigits.value[idx];
};
const handleDigitKeydown = (e: KeyboardEvent, idx: number) => {
  if (e.key === 'Backspace' && !codeDigits.value[idx] && idx > 0) {
    codeDigits.value[idx - 1] = '';
    const prev = document.getElementById(`otp-${idx - 1}`);
    if (prev) (prev as HTMLInputElement).focus();
  }
};
const handleDigitPaste = (e: ClipboardEvent) => {
  e.preventDefault();
  const text = e.clipboardData?.getData('text').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6) || '';
  text.split('').forEach((c, i) => { if (i < 6) codeDigits.value[i] = c; });
  const lastFilledIdx = Math.min(text.length, 5);
  const nextEl = document.getElementById(`otp-${lastFilledIdx}`);
  if (nextEl) (nextEl as HTMLInputElement).focus();
};
const handleFocus = (e: FocusEvent) => {
  if (e.target) {
    (e.target as HTMLInputElement).select();
  }
};
const submitJoinByCode = async () => {
  const code = joinCodeStr.value;
  if (code.length < 6) return showToast('error', langStore.locale === 'th' ? 'กรอกรหัส 6 หลักให้ครบ' : 'Please enter all 6 digits');
  if (joinCodeLoading.value) return;
  joinCodeLoading.value = true;
  try {
    await joinByCode(code);
    showCodeModal.value = false;
    codeDigits.value = Array(6).fill('');
  } finally {
    joinCodeLoading.value = false;
  }
};
const selectedRoomToJoin = ref<Room | null>(null);
const newRoomForm = ref({ name: "", maxMembers: 4, isPrivate: false, code: "" });
const joinStep = ref(1);
const joinTargetName = ref("");
const openJoinModal = (initialRoom = null) => {
   codeDigits.value = Array(6).fill('');
   if (initialRoom) {
      selectedRoomToJoin.value = initialRoom as Room;
      joinStep.value = 2;
      showCodeModal.value = true;
      setTimeout(() => document.getElementById('otp-0')?.focus(), 100);
   } else {
      selectedRoomToJoin.value = null;
      joinTargetName.value = '';
      joinStep.value = 1;
      showCodeModal.value = true;
      setTimeout(() => document.getElementById('joinNameInput')?.focus(), 100);
   }
};
const verifyJoinName = () => {
   if (!joinTargetName.value.trim()) return showToast('error', langStore.locale === 'th' ? 'กรุณาใส่ชื่อทีม' : 'Please enter team name');
   const match = rooms.value.find(r => r.name.toLowerCase() === joinTargetName.value.trim().toLowerCase());
   if (!match) return showToast('error', langStore.locale === 'th' ? 'ไม่พบทีมนี้ในระบบ' : 'Team not found');
   if (!match.isPrivate) {
      showCodeModal.value = false;
      confirmJoin(match.id);
   } else {
      selectedRoomToJoin.value = match;
      joinStep.value = 2;
      setTimeout(() => document.getElementById('otp-0')?.focus(), 100);
   }
};
const showToast = (type: "success" | "error" | "info", message: string) => {
  if (type === "success") showSuccess(message);
  else if (type === "error") showError(message);
  else swal.fire({ icon: "info", title: message, toast: true, position: "top", showConfirmButton: false, timer: 3000 });
};
const fetchRooms = async () => {
  if (!currentUser.value.id) return;
  skeletonVisible.value = true;
  try {
    const res = await fetch("/api/teams", {
      headers: { "x-user-id": String(currentUser.value.id) }
    });
    if (res.ok) { const all = await res.json(); rooms.value = all; }
  } catch { showToast("error", langStore.locale === 'th' ? "โหลดรายการห้องไม่สำเร็จ" : "Failed to load rooms"); }
  finally { skeletonVisible.value = false; }
};
const handleCreateRoom = async () => {
  if (loading.value) return;
  if (authStore.user?.team_id) return showToast("info", langStore.locale === 'th' ? "คุณมีทีมอยู่แล้ว ไม่สามารถสร้างทีมใหม่ได้" : "You are already in a team. You cannot create a new one.");
  if (!newRoomForm.value.name.trim()) return showToast("error", langStore.locale === 'th' ? "กรุณาใส่ชื่อทีม" : "Please enter team name");
  if (newRoomForm.value.isPrivate && (!newRoomForm.value.code || newRoomForm.value.code.length !== 6)) {
    return showToast("error", langStore.locale === 'th' ? "กรุณาระบุ PIN ควบคุมห้องให้ครบ 6 หลัก" : "Please enter a 6-digit PIN");
  }
  if (!currentUser.value.id) return router.push("/login");
  loading.value = true;
  try {
    const res = await fetch("/api/teams", { method: "POST", headers: { "Content-Type": "application/json", "x-user-id": String(currentUser.value.id) }, body: JSON.stringify({ ...newRoomForm.value, hostId: currentUser.value.id }) });
    if (res.ok) {
      const team = await res.json();
      const tid = (team && typeof team === 'object') ? (team.id || team.teamId) : team;
      if (authStore.user && tid) {
        const updatedUser = { ...authStore.user, team_id: tid };
        authStore.setUser(updatedUser);
        showToast("success", langStore.locale === 'th' ? "สร้างทีมสำเร็จ!" : "Team created successfully!");
      } else {
        showToast("error", langStore.locale === 'th' ? "สร้างทีมสำเร็จแต่ไม่สามารถระบุ ID ทีมได้" : "Team created but ID is missing.");
      }
    } else { const err = await res.json(); showToast("error", err.error ?? (langStore.locale === 'th' ? "สร้างทีมไม่สำเร็จ" : "Failed to create team")); }
  } catch { showToast("error", langStore.locale === 'th' ? "เกิดข้อผิดพลาดในการสร้างทีม" : "Error creating team"); }
  finally { loading.value = false; }
};
const confirmJoin = async (teamId: string) => {
  if (loading.value) return;
  if (!currentUser.value.id) return router.push("/login");
  loading.value = true;
  try {
    const res = await fetch("/api/teams/join", { method: "POST", headers: { "Content-Type": "application/json", "x-user-id": String(currentUser.value.id) }, body: JSON.stringify({ teamId, userId: currentUser.value.id }) });
    if (res.ok) { 
      if (authStore.user) {
        const updatedUser = { ...authStore.user, team_id: teamId };
        authStore.setUser(updatedUser);
      }
      showToast("success", langStore.locale === 'th' ? "เข้าร่วมทีมสำเร็จ!" : "Joined team successfully!");
    } else { const err = await res.json(); showToast("error", err.error ?? (langStore.locale === 'th' ? "เข้าร่วมทีมไม่สำเร็จ" : "Failed to join team")); }
  } catch { showToast("error", langStore.locale === 'th' ? "เข้าร่วมทีมล้มเหลว" : "Failed to join team"); }
  finally { loading.value = false; }
};
const joinByCode = async (code: string) => {
  if (loading.value) return;
  if (!code || !currentUser.value.id) return;
  loading.value = true;
  try {
    const res = await fetch("/api/teams/join-by-code", { method: "POST", headers: { "Content-Type": "application/json", "x-user-id": String(currentUser.value.id) }, body: JSON.stringify({ code: code, userId: currentUser.value.id }) });
    const data = await res.json();
    if (res.ok) { 
      if (authStore.user) {
        const updatedUser = { ...authStore.user, team_id: data.teamId };
        authStore.setUser(updatedUser);
      }
      showToast("success", langStore.locale === 'th' ? "เข้าร่วมทีมสำเร็จ!" : "Joined team successfully!");
    } else showToast("error", data.error ?? (langStore.locale === 'th' ? "ค้นหาห้องไม่สำเร็จ" : "Room not found"));
  } catch { showToast("error", langStore.locale === 'th' ? "ค้นหาห้องล้มเหลว" : "Failed to find room"); }
  finally { loading.value = false; }
};
const joinRoom = (room: Room) => {
  if (authStore.user?.team_id) return showToast("info", langStore.locale === 'th' ? "คุณมีทีมอยู่แล้ว ไม่สามารถเข้าร่วมทีมอื่นได้" : "You are already in a team. You cannot join another one.");
  if ((room.members?.length || 0) >= room.maxMembers) return showToast("info", langStore.locale === 'th' ? "ห้องเต็มแล้ว" : "Room is full");
  if (room.isPrivate) {
    openJoinModal(room);
    return;
  }
  confirmJoin(room.id);
};
const getHost = (room: Room) => room.members?.find(m => m.id === room.hostId);
const checkUserTeam = () => {
  if (authStore.user?.team_id) {
    router.replace("/teams");
    return true;
  }
  return false;
};
onMounted(() => {
  if (checkUserTeam()) return;
  fetchRooms();
});
watch(() => authStore.user?.team_id, (newTeamId) => {
  if (newTeamId) {
    router.replace("/teams");
  }
});
const filteredRooms = computed(() => {
  let list = rooms.value;
  if (!searchQuery.value) return list;
  const lowerQ = searchQuery.value.toLowerCase();
  return list.filter(r => r.name.toLowerCase().includes(lowerQ) || (r.code && r.code.toLowerCase() === lowerQ));
});
const currentPage = ref(1);
const itemsPerPage = 10;
const totalPages = computed(() => Math.max(1, Math.ceil(filteredRooms.value.length / itemsPerPage)));
const paginatedRooms = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage;
  return filteredRooms.value.slice(start, start + itemsPerPage);
});
watch(searchQuery, (newVal) => {
  currentPage.value = 1;
  if (newVal && newVal.length === 6) {
    const matchedRoom = rooms.value.find(r => r.code.toUpperCase() === newVal.toUpperCase());
    if (matchedRoom) { joinByCode(newVal); searchQuery.value = ""; }
  }
});
const navigateHub = (view: "search" | "create" | "join") => {
  if (authStore.user?.team_id) {
    return showToast("info", langStore.locale === 'th' ? "คุณมีทีมอยู่แล้ว ไม่สามารถดำเนินการนี้ได้" : "You are already in a team. You cannot perform this action.");
  }
  if (view === "join") openJoinModal();
  else if (view === "create") showCreateModal.value = true;
  else if (view === "search") showSearchModal.value = true;
}
useRealtime({
  onTeamCreated: () => fetchRooms(),
  onTeamUpdated: () => fetchRooms(),
  onTeamDeleted: (data) => {
    // If we're looking at rooms, just refresh the list
    fetchRooms();
  },
  onTeamJoined: () => fetchRooms(),
  onTeamLeft: () => fetchRooms(),
  onTeamKicked: () => fetchRooms(),
});
watch(() => uiStore.lastRealtimeUpdate, () => {
  fetchRooms();
});
</script>
<template>
  <div class="rank-app">
    <main class="modern-list-view">
      <Transition name="fade" mode="out-in">
        <div v-if="currentView === 'hub'" class="hub-container">
          <div class="top-actions-wrapper" :class="authStore.user?.team_id ? 'justify-between' : 'justify-end'">
            <button v-if="authStore.user?.team_id" class="my-team-btn" @click="router.push('/teams')">
               <ShieldCheck :size="18" class="text-orange-600" />
               <span>{{ langStore.locale === 'th' ? 'ดูทีมของฉัน' : 'My Team' }}</span>
            </button>
            <button v-if="!authStore.user?.team_id" class="create-btn-top" @click="navigateHub('create')">
              <Plus :size="18" />
              <span>{{ langStore.locale === 'th' ? 'สร้างทีม' : 'Create Team' }}</span>
            </button>
          </div>
          <div class="search-header">
            <div class="modern-search-box">
              <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input class="modern-search-input" v-model="searchQuery" :placeholder="langStore.locale === 'th' ? 'ค้นหาชื่อทีม หรือ รหัสทีม 6 หลัก...' : 'Search team name or 6-digit code...'" />
            </div>
          </div>
          <div class="activity-list-container">
            <div class="list-header-bar">
              <div class="list-title">{{ langStore.locale === 'th' ? 'ทีมทั้งหมด' : 'All Teams' }} ({{ filteredRooms.length }})</div>
            </div>
            <div class="activity-list-body">
              <div v-if="skeletonVisible" class="skeleton-list">
                <div v-for="n in 5" :key="n" class="skeleton-row"></div>
              </div>
              <div v-else-if="filteredRooms.length === 0" class="empty-search">
                <Users :size="48" class="empty-icon-wrap" />
                <h3 class="empty-title">{{ langStore.locale === 'th' ? 'ไม่พบข้อมูลทีม' : 'No teams found' }}</h3>
                <p class="empty-desc">{{ langStore.locale === 'th' ? 'ลองค้นหาด้วยชื่ออื่น หรือสร้างทีมของคุณเอง' : 'Try searching with another name or create your own team' }}</p>
                <button class="btn-primary mt-4" @click="navigateHub('create')">
                  <Plus :size="18" /> {{ langStore.locale === 'th' ? 'สร้างทีมใหม่' : 'Create New Team' }}
                </button>
              </div>
              <div v-else class="ev-list">
                <div v-for="room in paginatedRooms" :key="room.id" class="activity-row hover-effect" @click="joinRoom(room)">
                  <div class="ar-left">
                    <div class="ev-poster">
                      <img v-if="getHost(room)?.avatar" :src="getHost(room)?.avatar" loading="lazy" />
                      <div class="ev-fallback" v-else>{{ room.name.charAt(0) }}</div>
                    </div>
                  </div>
                  <div class="ar-middle">
                    <div class="ev-name-wrap">
                      <span class="ar-subject">{{ room.name }}</span>
                      <div v-if="room.isPrivate" class="private-badge">
                        <Lock :size="12" />
                      </div>
                    </div>
                    <div class="ar-system-name">{{ langStore.locale === 'th' ? 'หัวหน้าทีม:' : 'Leader:' }} {{ getHost(room)?.fname_th || getHost(room)?.nickname || (langStore.locale === 'th' ? 'หัวหน้า' : 'Leader') }}</div>
                  </div>
                  <div class="ar-right">
                    <span class="ev-score">
                      <Users :size="14" class="mr-1"/>
                      {{ room.members?.length || 0 }} / {{ room.maxMembers }}
                    </span>
                  </div>
                </div>
              </div>
              <div class="pagination" v-if="totalPages > 1">
                <button :disabled="currentPage === 1" @click="currentPage--">&laquo; {{ langStore.locale === 'th' ? 'ก่อนหน้า' : 'Prev' }}</button>
                <span class="page-info">{{ langStore.locale === 'th' ? 'หน้า' : 'Page' }} {{ currentPage }} / {{ totalPages }}</span>
                <button :disabled="currentPage === totalPages" @click="currentPage++">{{ langStore.locale === 'th' ? 'ถัดไป' : 'Next' }} &raquo;</button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </main>
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showCreateModal" class="tn-overlay" @click.self="showCreateModal = false">
          <div class="tn-sheet">
            <div class="tn-header">
              <div class="tn-title">{{ langStore.locale === 'th' ? 'สร้างทีมใหม่' : 'Create New Team' }}</div>
              <button class="tn-close-btn" @click="showCreateModal = false">
                <X :size="20" />
              </button>
            </div>
            <div class="tn-body">
               <div class="input-group mb-5">
                  <label class="input-label">{{ langStore.locale === 'th' ? 'ชื่อทีมของคุณ' : 'Your Team Name' }}</label>
                  <input class="modern-input" v-model="newRoomForm.name" :placeholder="langStore.locale === 'th' ? 'ตั้งชื่อทีมสุดเจ๋ง...' : 'Enter an awesome team name...'" maxlength="40" />
               </div>
               <div class="setting-row mb-5" @click="newRoomForm.isPrivate = !newRoomForm.isPrivate">
                  <div class="setting-info">
                    <span class="setting-title">{{ langStore.locale === 'th' ? 'ตั้งรหัสผ่านเข้าทีม (Private)' : 'Set Team Password (Private)' }}</span>
                    <span class="setting-desc">{{ langStore.locale === 'th' ? 'เฉพาะคนที่มีรหัสผ่านเท่านั้นถึงจะเข้าได้' : 'Only people with the password can join' }}</span>
                  </div>
                  <div class="fancy-toggle" :class="{ 'on': newRoomForm.isPrivate }"><div class="fancy-knob"></div></div>
               </div>
               <Transition name="fade">
                 <div v-if="newRoomForm.isPrivate" class="input-group mb-5">
                    <label class="input-label text-orange-600">{{ langStore.locale === 'th' ? 'สร้าง PIN 6 หลัก' : 'Create 6-digit PIN' }}</label>
                    <input class="modern-input" v-model="newRoomForm.code" :placeholder="langStore.locale === 'th' ? 'เช่น ABC123' : 'e.g. ABC123'" maxlength="6" style="text-transform: uppercase; font-weight: bold; letter-spacing: 2px;" />
                 </div>
               </Transition>
               <div class="input-group mb-4">
                  <label class="input-label">{{ langStore.locale === 'th' ? 'จำนวนสมาชิกสูงสุด (คน)' : 'Max Members' }}</label>
                  <div class="num-grid">
                    <button v-for="n in [2,3,4,5,6]" :key="n" @click="newRoomForm.maxMembers = n" :class="{ active: newRoomForm.maxMembers === n }" class="num-btn">
                      {{ n }}
                    </button>
                  </div>
               </div>
            </div>
            <div class="tn-footer">
              <button class="tn-btn-save" @click="handleCreateRoom" :disabled="loading">
                <Loader2 v-if="loading" class="spin mr-2" :size="18" />
                <span v-else>{{ langStore.locale === 'th' ? 'ยืนยันสร้างทีม' : 'Confirm Create Team' }}</span>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showCodeModal" class="tn-overlay" @click.self="showCodeModal = false">
          <div class="tn-sheet">
            <div class="tn-header">
              <div class="tn-title">{{ langStore.locale === 'th' ? 'เข้าร่วมทีม' : 'Join Team' }}</div>
              <button class="tn-close-btn" @click="showCodeModal = false">
                <X :size="20" />
              </button>
            </div>
            <div class="tn-body text-center flex-col-center">
              <p class="text-gray-500 text-sm mb-6 px-4">
                {{ joinStep === 1 ? (langStore.locale === 'th' ? 'ระบุชื่อทีมที่คุณต้องการค้นหา ระบบจะตรวจสอบโดยอัตโนมัติ' : 'Enter the team name to search') : (langStore.locale === 'th' ? `กรอก PIN 6 หลักเพื่อเข้าทีม: ${selectedRoomToJoin?.name}` : `Enter 6-digit PIN to join: ${selectedRoomToJoin?.name}`) }}
              </p>
              <div v-if="joinStep === 1" class="input-group text-left mb-4 px-2 w-full">
                 <label class="input-label">{{ langStore.locale === 'th' ? 'ชื่อทีมเป้าหมาย' : 'Target Team Name' }}</label>
                 <input id="joinNameInput" class="modern-input text-center font-bold text-lg" v-model="joinTargetName" :placeholder="langStore.locale === 'th' ? 'พิมพ์ชื่อทีม...' : 'Type team name...'" @keyup.enter="verifyJoinName" />
              </div>
              <div v-if="joinStep === 2" class="otp-line mb-6 w-full">
                <input v-for="(_, i) in codeDigits" :key="i" :id="`otp-${i}`" :value="codeDigits[i]" type="text" maxlength="1" class="otp-input-field" @input="handleDigitInput($event, i)" @keydown="handleDigitKeydown($event, i)" @paste="handleDigitPaste" @focus="handleFocus" />
              </div>
            </div>
            <div class="tn-footer">
              <button v-if="joinStep === 1" class="tn-btn-save" @click="verifyJoinName" :disabled="loading">
                <Loader2 v-if="loading" class="spin mr-2" :size="18" />
                {{ langStore.locale === 'th' ? 'ตรวจสอบ' : 'Verify' }}
              </button>
              <button v-else class="tn-btn-save" @click="submitJoinByCode" :disabled="joinCodeStr.length < 6 || joinCodeLoading || loading">
                <Loader2 v-if="joinCodeLoading" class="spin mr-2" :size="18" />
                <span v-else>{{ langStore.locale === 'th' ? 'ยืนยันเข้าร่วม' : 'Confirm Join' }}</span>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
<style scoped>
.rank-app {
  --primary: #FF6A00;
  --primary-hover: #E65F00;
  --primary-light: #FFF0E6;
  --bg-color: #FFFFFF; 
  --surface: #FFFFFF;
  --text-main: #1E293B;
  --text-muted: #64748B;
  --border: #E2E8F0;
  --radius-lg: 16px;
  --radius-md: 12px;
}
* { box-sizing: border-box; }
.rank-app {
  background-color: var(--bg-color);
  min-height: 100vh;
  color: var(--text-main);
  font-family: 'Prompt', 'Noto Sans Thai', sans-serif;
}
.modern-list-view {
  max-width: 1000px;
  margin: 0 auto;
  padding: 24px;
}
.hub-container {
  width: 100%;
}
.justify-end { display: flex; justify-content: flex-end; }
.top-actions-wrapper { margin-bottom: 24px; }
.create-btn-top {
  background: none;
  border: none;
  padding: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-weight: 700;
  color: #64748B;
  transition: all 0.2s;
}
.create-btn-top span {
  color: var(--primary);
}
.create-btn-top:hover {
  transform: translateY(-1px);
  opacity: 0.8;
}
.my-team-btn {
  background: #FFF7ED;
  border: 1px solid #FFEDD5;
  padding: 8px 16px;
  border-radius: 50px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-weight: 700;
  color: #EA580C;
  transition: all 0.2s;
}
.my-team-btn:hover {
  background: #FFEDD5;
  transform: translateY(-1px);
}
.btn-primary {
  background: var(--primary);
  color: #fff;
  border: none;
  padding: 10px 16px;
  border-radius: 50px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;
}
.btn-primary:hover {
  background: var(--primary-hover);
  transform: translateY(-1px);
}
.search-header {
  margin-bottom: 24px;
  display: flex;
  justify-content: center;
}
.modern-search-box {
  display: flex;
  align-items: center;
  background: var(--surface);
  border: 1.5px solid #E2E8F0;
  border-radius: 99px;
  padding: 0 20px;
  height: 44px;
  width: 100%;
  max-width: 100%;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0,0,0,0.02);
}
.modern-search-box:focus-within {
  border-color: #FF6A00;
  background: #FFFFFF;
  box-shadow: 0 4px 12px rgba(255, 106, 0, 0.15);
}
.search-icon {
  width: 18px;
  height: 18px;
  color: #94A3B8;
  margin-right: 8px;
}
.modern-search-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 0.95rem;
  color: var(--text-main);
  outline: none;
}
.modern-search-input::placeholder {
  color: #94A3B8;
}
.activity-list-container {
  background: var(--surface);
  border-radius: var(--radius-lg);
  box-shadow: 0 4px 20px rgba(0,0,0,0.03);
  overflow: hidden;
  border: 1px solid var(--border);
}
.list-header-bar {
  padding: 16px 24px;
  border-bottom: 1px solid var(--border);
  background: #F8FAFC;
}
.list-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-muted);
}
.activity-row {
  display: flex;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid #F1F5F9;
  cursor: pointer;
  background: var(--surface);
  transition: all 0.2s ease;
}
.activity-row:last-child {
  border-bottom: none;
}
.activity-row:hover {
  background: #F8FAFC;
  transform: translateX(4px);
}
.ar-left {
  width: 80px;
  flex-shrink: 0;
}
.ev-poster {
  width: 50px;
  height: 50px;
  min-width: 50px;
  min-height: 50px;
  border-radius: 50%;
  overflow: hidden;
  background: #E2E8F0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  aspect-ratio: 1 / 1;
}
.ev-poster img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.ev-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary);
  font-weight: 700;
  font-size: 1.2rem;
  background: var(--primary-light);
}
.ar-middle {
  flex: 1;
  min-width: 0;
  padding-right: 24px;
}
.ev-name-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.ar-subject {
  font-weight: 500;
  font-size: 1rem;
  color: var(--text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}
.private-badge {
  color: #F59E0B;
  background: #FEF3C7;
  padding: 2px 6px;
  border-radius: 50px;
  display: flex;
}
.ar-system-name {
  font-size: 0.85rem;
  color: var(--text-muted);
  font-weight: 500;
}
.ar-right {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-shrink: 0;
}
.ev-score {
  display: flex;
  align-items: center;
  color: var(--primary);
  font-size: 0.85rem;
  font-weight: 700;
}
.mr-1 { margin-right: 4px; }
.mr-2 { margin-right: 8px; }
.mt-4 { margin-top: 16px; }
.mb-4 { margin-bottom: 16px; }
.mb-5 { margin-bottom: 20px; }
.mb-6 { margin-bottom: 24px; }
.w-full { width: 100%; }
.px-2 { padding-left: 8px; padding-right: 8px; }
.px-4 { padding-left: 16px; padding-right: 16px; }
.text-left { text-align: left; }
.text-center { text-align: center; }
.font-bold { font-weight: 700; }
.text-lg { font-size: 1.125rem; }
.text-orange-600 { color: #ea580c; }
.text-gray-500 { color: #6b7280; }
.flex-col-center { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 200px; }
.btn-outline-sm {
  background: transparent;
  color: var(--primary);
  border: 1.5px solid var(--primary);
  padding: 8px 16px;
  border-radius: 50px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: 0.2s;
}
.activity-row:hover .btn-outline-sm {
  background: var(--primary);
  color: #fff;
}
.empty-search {
  padding: 60px 20px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.empty-icon-wrap {
  color: #CBD5E1;
  margin-bottom: 16px;
}
.empty-title {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--text-main);
  margin: 0 0 8px;
}
.empty-desc {
  color: var(--text-muted);
  font-size: 0.95rem;
  margin: 0;
}
.skeleton-list {
  display: flex;
  flex-direction: column;
}
.skeleton-row {
  height: 80px;
  border-bottom: 1px solid #F1F5F9;
  background: linear-gradient(90deg, #F8FAFC 25%, #E2E8F0 50%, #F8FAFC 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
}
.pagination { display: flex; justify-content: center; align-items: center; padding: 20px; gap: 16px; border-top: 1px solid var(--border); }
@media (max-width: 768px) {
  .pagination { border-top: none; padding-top: 0; }
}
.pagination button { 
  padding: 10px 20px; 
  border-radius: 50px;
  border: 1.5px solid #E2E8F0; 
  background: white; 
  font-family: inherit; 
  font-weight: 600; 
  font-size: 0.9rem;
  color: var(--text-muted);
  cursor: pointer; 
  transition: 0.2s; 
  display: flex;
  align-items: center;
  gap: 8px;
}
.pagination button:hover:not(:disabled) { 
  border-color: var(--primary); 
  color: var(--primary);
  background: var(--primary-light);
}
.pagination button:disabled { opacity: 0.5; cursor: not-allowed; }
.page-info { font-weight: 600; color: var(--text-muted); }
@keyframes skeleton-loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
.table-pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
  gap: 16px;
  border-top: 1px solid var(--border);
}
.page-btn {
  padding: 10px;
  border-radius: 50%;
  border: 1.5px solid #E2E8F0;
  background: white;
  color: var(--text-muted);
  cursor: pointer;
  transition: 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.page-btn:hover:not(:disabled) {
  border-color: var(--primary);
  color: var(--primary);
  background: var(--primary-light);
}
.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.page-info {
  font-weight: 600;
  color: var(--text-muted);
}
.tn-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.6);
  z-index: 1000;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}
.tn-sheet {
  width: 100%;
  background: #fff;
  border-radius: 24px 24px 0 0;
  display: flex;
  flex-direction: column;
  max-height: 90vh;
}
.tn-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}
.tn-title {
  font-size: 1.15rem;
  font-weight: 700;
  flex: 1;
  text-align: left;
  color: var(--text-main);
}
.tn-close-btn {
  display: flex;
  background: #F1F5F9;
  border: none;
  width: 34px;
  height: 34px;
  min-width: 34px;
  min-height: 34px;
  border-radius: 50%;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-muted);
  transition: 0.2s;
  flex-shrink: 0;
  aspect-ratio: 1 / 1;
}
.tn-close-btn:hover {
  background: #E2E8F0;
  color: var(--text-main);
}
.tn-body {
  padding: 24px 20px;
  overflow-y: auto;
  flex: 1;
}
.tn-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--border);
  display: flex;
  gap: 12px;
  background: #fff;
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
}
.tn-btn-cancel {
  flex: 1;
  padding: 14px;
  border: 1.5px solid #CBD5E1;
  background: #fff;
  border-radius: 50px;
  font-weight: 700;
  color: #64748b;
  cursor: pointer;
  transition: 0.2s;
  font-family: inherit;
}
.tn-btn-save {
  flex: 1;
  padding: 14px;
  border: none;
  background: #FF6A00 !important;
  color: #fff;
  border-radius: 50px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;
  transition: 0.2s;
  font-family: inherit;
}
/* เอาเอฟเฟกต์ตอนกดค้างออก */
.tn-btn-save:active {
  transform: none !important;
}
.tn-btn-save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.input-label {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-main);
}
.modern-input {
  width: 100%;
  padding: 16px;
  border: 1.5px solid var(--border);
  border-radius: 14px;
  font-size: 1rem;
  font-family: inherit;
  transition: all 0.2s;
  background: #F8FAFC;
  color: var(--text-main);
}
.modern-input:focus {
  border-color: var(--primary);
  outline: none;
  background: #fff;
  box-shadow: 0 0 0 4px var(--primary-light);
}
.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #F8FAFC;
  padding: 16px;
  border-radius: 14px;
  cursor: pointer;
  border: 1.5px solid var(--border);
}
.setting-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.setting-title {
  font-weight: 600;
  color: var(--text-main);
  font-size: 1rem;
}
.setting-desc {
  font-size: 0.8rem;
  color: var(--text-muted);
}
.fancy-toggle {
  width: 48px;
  height: 26px;
  background: #CBD5E1;
  border-radius: 20px;
  position: relative;
  transition: 0.3s;
}
.fancy-toggle.on {
  background: var(--primary);
}
.fancy-knob {
  width: 20px;
  height: 20px;
  background: #fff;
  border-radius: 50%;
  position: absolute;
  top: 3px;
  left: 3px;
  transition: 0.3s;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}
.fancy-toggle.on .fancy-knob {
  left: 25px;
}
.num-grid {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.num-btn {
  flex: 1;
  min-width: 45px;
  height: 48px;
  border-radius: 12px;
  background: #F8FAFC;
  border: 1.5px solid var(--border);
  font-weight: 700;
  color: var(--text-muted);
  cursor: pointer;
  transition: 0.2s;
  font-size: 1.1rem;
  font-family: inherit;
}
.num-btn.active {
  background: #FF6A00 !important; 
  border-color: #FF6A00 !important;
  color: #fff !important;
  box-shadow: 0 4px 12px rgba(255, 106, 0, 0.3);
}
.otp-line {
  display: flex;
  justify-content: center;
  gap: 8px;
  width: 100%;
}
.otp-input-field {
  width: 48px;
  height: 60px;
  border-radius: 12px;
  border: 1.5px solid var(--border);
  text-align: center;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-main);
  outline: none;
  transition: 0.2s;
  background: #F8FAFC;
  font-family: inherit;
}
.otp-input-field:focus {
  border-color: var(--primary);
  background: #fff;
  box-shadow: 0 0 0 3px var(--primary-light);
}
.loading-full-screen {
  position: fixed;
  inset: 0;
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.9);
  backdrop-filter: blur(4px);
}
.loader-premium-card {
  background: transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}
.loader-icon-wrap {
  color: var(--primary);
}
.loader-text {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-main);
}
.spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
.modal-fade-enter-active, .modal-fade-leave-active {
  transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.modal-fade-enter-from, .modal-fade-leave-to {
  opacity: 0;
}
.modal-fade-enter-active .tn-sheet {
  animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.modal-fade-leave-active .tn-sheet {
  animation: slideDown 0.3s cubic-bezier(0.4, 0, 1, 1) forwards;
}
@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
@keyframes slideDown {
  from { transform: translateY(0); opacity: 1; }
  to { transform: translateY(100%); opacity: 0; }
}
@media (min-width: 768px) {
  .tn-overlay {
    align-items: center;
  }
  .tn-sheet {
    width: 500px;
    border-radius: 24px;
    max-height: 85vh;
    margin: 0 auto;
  }
  .tn-title {
    text-align: left;
  }
  .tn-footer {
    padding-bottom: 20px;
    border-radius: 0 0 24px 24px;
  }
  .modal-fade-enter-active .tn-sheet {
    animation: zoomIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .modal-fade-leave-active .tn-sheet {
    animation: zoomOut 0.3s cubic-bezier(0.4, 0, 1, 1) forwards;
  }
  @keyframes zoomIn {
    from { transform: scale(0.95); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }
  @keyframes zoomOut {
    from { transform: scale(1); opacity: 1; }
    to { transform: scale(0.95); opacity: 0; }
  }
}
@media (max-width: 768px) {
  .modern-list-view {
    padding: 12px 0 100px 0;
    background-color: #fff;
  }
  .top-actions-wrapper {
    padding: 0 16px;
    margin-bottom: 16px;
  }
  .title-text {
    font-size: 1.25rem;
  }
  .search-header {
    padding: 0 16px;
    margin-bottom: 16px;
  }
  .modern-search-box {
    padding: 0 16px;
    height: 38px;
  }
  .search-icon {
    width: 16px;
    height: 16px;
  }
  .modern-search-input {
    font-size: 0.9rem;
  }
  .activity-list-container {
    border-radius: 0;
    border: none;
    box-shadow: none;
  }
  .activity-row {
    flex-wrap: wrap;
    padding: 16px;
  }
  .activity-row:hover {
    transform: none;
  }
  .ar-left {
    width: auto;
    margin-right: 12px;
    margin-bottom: 8px;
  }
  .ar-middle {
    width: calc(100% - 62px);
    padding-right: 0;
    margin-bottom: 8px;
  }
  .ar-right {
    width: 100%;
    justify-content: space-between;
    padding-left: 62px;
  }
}
@media (max-width: 380px) {
  .otp-input-field {
    width: 40px;
    height: 50px;
    font-size: 1.25rem;
  }
  .btn-primary {
    padding: 8px 12px;
    font-size: 0.9rem;
  }
}
</style>
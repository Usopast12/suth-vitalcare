<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useRouter } from "vue-router";
import { authStore } from "../store/auth";
import {
  Users, Crown, LogOut, UserMinus, Settings,
  Loader2, X, Clock
} from "lucide-vue-next";
import { uiStore } from "../store/ui";
import { swal, showSuccess, showError, showConfirm } from "../lib/swal";
import { useRealtime } from "../composables/useRealtime";
import { langStore } from "../store/lang";
const router = useRouter();
type User = { id: string; name: string; avatar?: string; canCreateActivity: boolean; fname_th?: string; nickname?: string };
type Room = {
  id: string; code: string; name: string;
  maxMembers: number; isPrivate: boolean;
  password?: string; hostId: string; members: User[];
};
const currentUser = computed(() => ({
  id: authStore.user?.id ?? null,
  name: authStore.user?.fname_th ?? "คุณ",
  avatar: authStore.user?.picture_url ?? null,
  teamId: authStore.user?.team_id ?? null,
  canCreateActivity: authStore.user?.role === 'admin',
}));
const loading = ref(true);
const currentView = ref<"lobby">("lobby");
const currentRoom = ref<Room | null>(null);
const showSettingsModal = ref(false);
const editRoomForm = ref({
  name: "", maxMembers: 4, isPrivate: false, code: "",
});
// isHost determines if the current user is the owner/host of this specific team.
// Admins who create a team are also considered the host of that team.
const isHost = computed(() => {
  return currentRoom.value?.hostId === currentUser.value.id;
});
const assertIsHost = (action = 'ดำเนินการนี้'): boolean => {
  if (!isHost.value) {
    showToast('error', langStore.locale === 'th' ? `คุณไม่มีสิทธิ์${action} (เฉพาะหัวหน้าทีมนี้เท่านั้น)` : `You don't have permission to perform this action (Host only)`);
    return false;
  }
  return true;
};
const showToast = (type: "success" | "error" | "info", message: string) => {
  if (type === "success") showSuccess(message);
  else if (type === "error") showError(message);
  else swal.fire({ icon: "info", title: message, toast: true, position: "top", showConfirmButton: false, timer: 3000 });
};
const fetchCurrentRoom = async (teamId: any) => {
  if (!currentUser.value.id) return;
  if (!teamId || teamId === "undefined" || teamId === "null") {
    return;
  }
  try {
    const res = await fetch(`/api/teams/${teamId}`, { headers: { "x-user-id": String(currentUser.value.id) } });
    if (res.ok) {
      const data = await res.json() as Room;
      currentRoom.value = data;
      // ── Membership Check ──
      // If we got the room data, but the current user is no longer in the members list, they've been kicked.
      const stillInTeam = data.members.some(m => String(m.id) === String(currentUser.value.id));
      if (!stillInTeam) {
        if (authStore.user) {
          authStore.user.team_id = null;
          authStore.saveUser();
        }
        router.push("/create-teams");
        showToast("info", langStore.locale === 'th' ? "คุณไม่ได้อยู่ในทีมนี้แล้ว" : "You are no longer in this team");
      }
    } else {
      if (authStore.user) {
        authStore.user.team_id = null;
        authStore.saveUser();
      }
      router.push("/create-teams");
    }
  } catch { showToast("error", langStore.locale === 'th' ? "โหลดข้อมูลห้องไม่สำเร็จ" : "Failed to load room data"); }
  finally { loading.value = false; }
};
// -------------------------
const formatDateThai = (dateStr: string) => {
  if (!dateStr) return "ไม่ระบุ";
  const d = new Date(dateStr);
  const m = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "เม.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return `${d.getDate()} ${m[d.getMonth()]} ${d.getFullYear() + 543}`;
};
const handleUpdateRoom = async () => {
  // Guard: only the actual team host (not admin, not regular member)
  if (!assertIsHost('แก้ไขข้อมูลทีม')) return;
  if (!currentRoom.value || !editRoomForm.value.name.trim()) return showToast("error", langStore.locale === 'th' ? "กรุณาใส่ชื่อทีม" : "Please enter a team name");
  if (editRoomForm.value.isPrivate && (!editRoomForm.value.code || editRoomForm.value.code.length !== 6)) {
    return showToast("error", langStore.locale === 'th' ? "กรุณาระบุ PIN ควบคุมห้องให้ครบ 6 หลัก" : "Please enter a 6-digit PIN");
  }
  loading.value = true;
  try {
    const res = await fetch(`/api/teams/${currentRoom.value.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-user-id": String(currentUser.value.id) },
      body: JSON.stringify({ ...editRoomForm.value, hostId: currentUser.value.id }),
    });
    if (res.ok) {
      await fetchCurrentRoom(currentRoom.value.id);
      showSettingsModal.value = false;
      showToast("success", langStore.locale === 'th' ? "อัปเดตห้องสำเร็จ" : "Room updated successfully");
    } else { const err = await res.json(); showToast("error", err.error ?? (langStore.locale === 'th' ? "อัปเดตห้องไม่สำเร็จ" : "Failed to update room")); }
  } catch { showToast("error", langStore.locale === 'th' ? "อัปเดตห้องล้มเหลว" : "Failed to update room"); }
  finally { loading.value = false; }
};
const openSettings = () => {
  // Guard: only the actual team host
  if (!assertIsHost('ตั้งค่าทีม')) return;
  if (!currentRoom.value) return;
  editRoomForm.value = {
    name: currentRoom.value.name,
    maxMembers: currentRoom.value.maxMembers,
    isPrivate: currentRoom.value.isPrivate,
    code: currentRoom.value.code,
  };
  showSettingsModal.value = true;
};
const leaveRoom = async () => {
  let confirmTitle = langStore.locale === 'th' ? "คุณต้องการออกจากทีมใช่หรือไม่?" : "Do you want to leave the team?";
  let confirmHtml = langStore.locale === 'th' ? "ข้อมูลกิจกรรมและสถิติต่างๆ ในทีมนี้ของคุณจะหายไป" : "Your activity data and statistics in this team will be lost";
  let confirmButtonText = langStore.locale === 'th' ? "ยืนยันการออก" : "Confirm leave";
  if (isHost.value) {
    const hasMembers = currentRoom.value && currentRoom.value.members.length > 1;
    confirmTitle = hasMembers 
      ? (langStore.locale === 'th' ? "ยืนยันการยุบทีมและออกจากระบบ?" : "Confirm disbanding and leaving?")
      : (langStore.locale === 'th' ? "ยืนยันการลบทีมและออกจากระบบ?" : "Confirm deleting team and leaving?");
    confirmHtml = langStore.locale === 'th' ? `
      <div style="text-align: left; font-size: 0.95rem; line-height: 1.6; color: #475569;">
        คุณเป็น <b>หัวหน้าทีม</b> การออกครั้งนี้จะส่งผลดังนี้:<br>
        • <span style="color: #ef4444;">สมาชิกทุกคนจะถูกเชิญออกจากทีม</span><br>
        • <span style="color: #ef4444;">กิจกรรมและภารกิจที่คุณสร้างจะถูกลบทั้งหมด</span><br>
        • <span style="color: #ef4444;">ข้อมูลการส่งงานของสมาชิกในกิจกรรมเหล่านั้นจะถูกลบ</span>
      </div>
    ` : `
      <div style="text-align: left; font-size: 0.95rem; line-height: 1.6; color: #475569;">
        You are the <b>Team Leader</b>. Leaving will result in:<br>
        • <span style="color: #ef4444;">All members will be removed from the team</span><br>
        • <span style="color: #ef4444;">All activities and missions you created will be deleted</span><br>
        • <span style="color: #ef4444;">Members' submissions for those activities will be deleted</span>
      </div>
    `;
    confirmButtonText = hasMembers ? (langStore.locale === 'th' ? "ยุบทีมและออกจากระบบ" : "Disband and leave") : (langStore.locale === 'th' ? "ลบทีมและออกจากระบบ" : "Delete team and leave");
  }
  const result = await swal.fire({
    title: confirmTitle,
    html: confirmHtml,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: confirmButtonText,
    cancelButtonText: langStore.locale === 'th' ? "ยกเลิก" : "Cancel",
    confirmButtonColor: "#ef4444",
    cancelButtonColor: "#94a3b8",
  });
  if (result.isConfirmed) doLeaveRoom();
};
const doLeaveRoom = async () => {
  if (!currentUser.value.id || !currentRoom.value) return;
  loading.value = true;
  try {
    const res = await fetch("/api/teams/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": String(currentUser.value.id) },
      body: JSON.stringify({ userId: currentUser.value.id }),
    });
    if (res.ok) {
      const userRes = await fetch(`/api/users/${currentUser.value.id}`, { headers: { "x-user-id": String(currentUser.value.id) } });
      if (userRes.ok) authStore.setUser(await userRes.json());
      router.push("/create-teams");
    } else { const err = await res.json(); showToast("error", err.error ?? (langStore.locale === 'th' ? "ออกจากทีมไม่สำเร็จ" : "Failed to leave team")); }
  } catch { showToast("error", langStore.locale === 'th' ? "ออกจากทีมล้มเหลว" : "Failed to leave team"); }
  finally { loading.value = false; }
};
const kickMember = async (userId: string, memberName: string) => {
  // Guard: only the actual team host can kick members
  if (!assertIsHost('เตะสมาชิก')) return;
  if (await showConfirm(
    langStore.locale === 'th' ? `ยืนยันการลบสมาชิก?` : `Confirm member removal?`, 
    langStore.locale === 'th' ? `คุณต้องการเชิญ "${memberName}" ออกจากทีมใช่หรือไม่?` : `Do you want to remove "${memberName}" from the team?`, 
    langStore.locale === 'th' ? "ลบสมาชิก" : "Remove",
    "warning"
  )) doKickMember(userId);
};
const doKickMember = async (userId: string) => {
  // Double-check guard at execution level
  if (!assertIsHost('เตะสมาชิก')) return;
  if (!currentRoom.value || !currentUser.value.id) return;
  loading.value = true;
  try {
    const res = await fetch("/api/teams/kick", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": String(currentUser.value.id) },
      body: JSON.stringify({ teamId: currentRoom.value.id, userId, hostId: currentUser.value.id }),
    });
    if (res.ok) { showToast("success", langStore.locale === 'th' ? "เตะสมาชิกออกแล้ว" : "Member removed"); await fetchCurrentRoom(currentRoom.value.id); }
    else { const err = await res.json(); showToast("error", err.error ?? (langStore.locale === 'th' ? "ล้มเหลว" : "Failed")); }
  } catch { showToast("error", langStore.locale === 'th' ? "ล้มเหลว" : "Failed"); }
  finally { loading.value = false; }
};
const transferHost = async (userId: string, memberName: string) => {
  // Guard: only the actual team host can transfer ownership
  if (!assertIsHost('โอนสิทธิ์หัวหน้าทีม')) return;
  if (await showConfirm(
    langStore.locale === 'th' ? `โอนสิทธิ์หัวหน้าทีม?` : `Transfer ownership?`, 
    langStore.locale === 'th' ? `ต้องการมอบสิทธิ์การจัดการทีมให้แก่ "${memberName}" ใช่หรือไม่?` : `Do you want to transfer team ownership to "${memberName}"?`, 
    langStore.locale === 'th' ? "ยืนยันการโอน" : "Confirm transfer",
    "info"
  )) doTransferHost(userId);
};
const doTransferHost = async (targetUserId: string) => {
  // Double-check guard at execution level
  if (!assertIsHost('โอนสิทธิ์หัวหน้าทีม')) return;
  if (!currentRoom.value || !currentUser.value.id) return;
  loading.value = true;
  try {
    const res = await fetch(`/api/teams/${currentRoom.value.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-user-id": String(currentUser.value.id) },
      body: JSON.stringify({ ...currentRoom.value, hostId: targetUserId }),
    });
    if (res.ok) {
      showToast("success", langStore.locale === 'th' ? "มอบสิทธิ์หัวหน้าทีมเรียบร้อยแล้ว" : "Transferred ownership successfully");
      await fetchCurrentRoom(currentRoom.value.id);
    } else { showToast("error", langStore.locale === 'th' ? "ดำเนินการไม่สำเร็จ" : "Action failed"); }
  } catch { showToast("error", langStore.locale === 'th' ? "ล้มเหลว" : "Failed"); }
  finally { loading.value = false; }
};
const copyCode = async () => {
  if (!currentRoom.value) return;
  try { await navigator.clipboard.writeText(currentRoom.value.code); showToast("success", langStore.locale === 'th' ? `คัดลอกรหัส ${currentRoom.value.code} แล้ว` : `Copied code ${currentRoom.value.code}`); }
  catch { showToast("error", langStore.locale === 'th' ? "คัดลอกไม่สำเร็จ" : "Copy failed"); }
};
onMounted(() => {
  if (currentUser.value.teamId) fetchCurrentRoom(currentUser.value.teamId);
  else {
    router.push("/create-teams");
  }
});
useRealtime({
  onTeamUpdated: (data) => {
    if (currentRoom.value && String(data.id) === String(currentRoom.value.id)) {
      fetchCurrentRoom(data.id);
    }
  },
  onTeamJoined: (data) => {
    if (currentRoom.value && String(data.teamId) === String(currentRoom.value.id)) {
      fetchCurrentRoom(data.teamId);
    }
  },
  onTeamLeft: (data) => {
    if (currentRoom.value && String(data.teamId) === String(currentRoom.value.id)) {
      fetchCurrentRoom(data.teamId);
    }
  },
  onTeamKicked: (data) => {
    if (currentRoom.value && String(data.teamId) === String(currentRoom.value.id)) {
      fetchCurrentRoom(data.teamId);
    }
  },
  onTeamDeleted: (data) => {
    if (currentRoom.value && String(data.id) === String(currentRoom.value.id)) {
      authStore.user.team_id = null;
      authStore.saveUser();
      router.push("/create-teams");
      showToast("info", langStore.locale === 'th' ? "ทีมนี้ถูกยุบแล้ว" : "This team has been disbanded");
    }
  },
  onUserUpdated: (data) => {
    // If current user is updated (e.g. kicked or role changed), sync authStore and maybe redirect
    if (String(data.id) === String(currentUser.value.id)) {
      if (data.team_id === null && currentRoom.value) {
        authStore.user.team_id = null;
        authStore.saveUser();
        router.push("/create-teams");
        showToast("info", langStore.locale === 'th' ? "คุณไม่ได้อยู่ในทีมนี้แล้ว" : "You are no longer in this team");
      }
    }
    // Also refresh if any member's info changed
    if (currentRoom.value && currentRoom.value.members.some(m => String(m.id) === String(data.id))) {
      fetchCurrentRoom(currentRoom.value.id);
    }
  }
});
watch(() => uiStore.lastRealtimeUpdate, () => {
  if (currentRoom.value) fetchCurrentRoom(currentRoom.value.id);
});
</script>
<template>
  <div class="teams-root">
    <!-- Background Decor Removed per User Request -->
    <!-- No Fixed Header per User Request -->
    <main class="body">
      <div v-if="loading && !currentRoom" class="loading-full-screen">
        <div class="w-10 h-10 border-4 border-slate-100 border-t-[#F05A23] rounded-full animate-spin"></div>
      </div>
      <Transition name="fade" mode="out-in">
        <div v-if="currentView === 'lobby' && currentRoom" class="lobby-container">
          <!-- INTEGRATED PAGE HEADER (Inside Body) -->
          <!-- MEMBER SELECTION SLOTS -->
          <section class="members-section mt-4">
            <div class="team-grid-container w-full relative">
              <!-- Refined Unified Header -->
              <div class="grid-header-bar flex justify-between items-center py-5 px-6 border-b border-slate-100">
                <div class="flex items-center gap-3">
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-black text-slate-400 uppercase tracking-widest">{{ langStore.locale === 'th' ? 'ทีมของคุณ:' : 'Your Team:' }}</span>
                    <h3 class="font-black text-slate-800 text-xl m-0">{{ currentRoom.name }}</h3>
                  </div>
                  <div class="divider-v"></div>
                  <div class="member-count-badge">
                    <Users :size="14" />
                    <span>{{ currentRoom.members.length }} / {{ currentRoom.maxMembers }} {{ langStore.locale === 'th' ? 'คน' : 'members' }}</span>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                   <button v-if="isHost" @click="openSettings" class="icon-btn-circle-v2" :title="langStore.locale === 'th' ? 'ตั้งค่าทีม' : 'Team Settings'"><Settings :size="20"/></button>
                   <button @click="leaveRoom" class="icon-btn-circle-v2 danger" :title="langStore.locale === 'th' ? 'ออกจากทีม' : 'Leave Team'"><LogOut :size="20"/></button>
                </div>
              </div>
              <!-- Pure Responsive Member Grid -->
              <div class="member-grid-body py-8 px-6">
                <div class="flex flex-wrap gap-8 justify-center items-start">
                  <!-- Real Members Only -->
                  <div v-for="member in currentRoom.members" :key="member.id" 
                       class="member-card-minimal" 
                       :class="{ 'is-me': member.id === currentUser.id }">
                    <div class="member-avatar-wrap">
                      <div class="avatar-circle-minimal">
                        <img v-if="member.avatar" :src="member.avatar" loading="lazy" />
                        <span v-else>{{ (member.fname_th || member.nickname || 'U').charAt(0).toUpperCase() }}</span>
                      </div>
                      <div v-if="member.id === currentRoom.hostId" class="host-badge-dot" :title="langStore.locale === 'th' ? 'หัวหน้าทีม' : 'Team Leader'">
                        <Crown :size="10" />
                      </div>
                    </div>
                    <div class="member-info-minimal">
                      <span class="member-name-minimal">{{ member.fname_th || member.nickname }}</span>
                      <span v-if="member.id === currentUser.id" class="me-text">{{ langStore.locale === 'th' ? '(ฉัน)' : '(Me)' }}</span>
                    </div>
                    <!-- Host Actions Overlay -->
                    <div v-if="isHost && member.id !== currentUser.id" class="member-actions-minimal">
                       <button @click="transferHost(member.id, member.fname_th || member.nickname || '')" class="mini-btn" :title="langStore.locale === 'th' ? 'โอนสิทธิ์หัวหน้าทีม' : 'Transfer Leader'"><Crown :size="14"/></button>
                       <button @click="kickMember(member.id, member.fname_th || member.nickname || '')" class="mini-btn danger" :title="langStore.locale === 'th' ? 'เชิญออก' : 'Remove'"><UserMinus :size="14"/></button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </Transition>
    </main>
    <!-- SETTINGS MODAL -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showSettingsModal" class="tn-overlay" style="z-index: 950;" @click.self="showSettingsModal = false">
          <div class="tn-sheet shadow-ultra" style="max-width: 520px;">
            <div class="tn-header" style="margin-bottom: 24px;">
              <span class="tn-title">{{ langStore.locale === 'th' ? 'ตั้งค่าข้อมูลทีม' : 'Team Settings' }}</span>
              <button @click="showSettingsModal = false" class="tn-close" style="background: none;"><X :size="24" /></button>
            </div>
            <div class="tn-body w-full text-left">
               <div class="w-full mb-6 text-left">
                  <input class="input-field w-full" v-model="editRoomForm.name" :placeholder="langStore.locale === 'th' ? 'ชื่อทีมสุขภาพ' : 'Team Name'" maxlength="40" />
               </div>
               <div class="settings-stack w-full mb-6">
                  <div class="setting-row" @click="editRoomForm.isPrivate = !editRoomForm.isPrivate">
                    <div class="setting-info text-left">
                      <span class="setting-title">{{ langStore.locale === 'th' ? 'รหัสผ่านสำหรับเข้ากลุ่ม' : 'Team Password' }}</span>
                    </div>
                    <div class="fancy-toggle" :class="{ 'on': editRoomForm.isPrivate }"><div class="fancy-knob"></div></div>
                  </div>
                  <div v-if="editRoomForm.isPrivate" class="pin-container is-active mt-3">
                    <input class="input-field-sm w-full" v-model="editRoomForm.code" :placeholder="langStore.locale === 'th' ? 'PIN 6 หลัก' : '6-digit PIN'" maxlength="6" style="text-transform: uppercase;" />
                  </div>
               </div>
               <div class="w-full mb-8 text-left flex items-center" style="display: flex; align-items: center;">
                  <label class="input-label mb-0" style="margin-bottom:0; min-width: 90px; font-size: 1.05rem; font-weight: 850;">{{ langStore.locale === 'th' ? 'สมาชิกสูงสุด' : 'Max Members' }}</label>
                  <div class="num-grid" style="flex: 1; margin-left: 12px; display: flex; gap: 8px;">
                    <button v-for="n in [2,3,4,5,6]" :key="n" @click="editRoomForm.maxMembers = n" :class="{ active: editRoomForm.maxMembers === n }" class="num-btn compact">
                      {{ n }}
                    </button>
                  </div>
               </div>
               <button class="primary-btn-solid w-full" @click="handleUpdateRoom" :disabled="loading">
                  <Loader2 v-if="loading" class="spin mr-2" :size="18" />
                  <span class="btn-text">{{ langStore.locale === 'th' ? 'บันทึกการเปลี่ยนแปลง' : 'Save Changes' }}</span>
               </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700;800&display=swap');
.teams-root {
  min-height: 100vh;
  background-color: #ffffff; /* เปลี่ยนเป็นสีขาวตามคำขอ */
  font-family: 'Sarabun', 'Noto Sans Thai', sans-serif;
  position: relative;
  overflow-x: hidden;
  color: #1e293b;
}
/* บังคับใช้ Sarabun กับทุก element ภายใน เพื่อให้มั่นใจว่าทุกที่เป็น Sarabun */
.teams-root,
.teams-root * {
  font-family: 'Sarabun', 'Noto Sans Thai', sans-serif !important;
}
/* Page context header (Inside Flow) */
.page-context-header { display: flex; align-items: center; justify-content: space-between; padding-top: 10px; }
.pch-left { display: flex; align-items: center; gap: 16px; }
.pch-back-btn { width: 44px; height: 44px; border-radius: 14px; background: #fff; border: 1px solid #f1f5f9; color: #64748b; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.03); transition: 0.2s; }
.pch-back-btn:hover { background: #f8fafc; color: #0d1f2d; box-shadow: 0 6px 15px rgba(0,0,0,0.06); }
.pch-info { display: flex; flex-direction: column; }
.pch-subtitle { font-size: 0.72rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; }
.pch-title { font-size: 1.45rem; font-weight: 900; color: #0d1f2d; line-height: 1.2; }
.pch-actions { display: flex; gap: 10px; }
/* Shadows — เพิ่มความเด่นขึ้นเล็กน้อย ให้การ์ดดู "วาง" บนพื้นครีมจริงๆ */
.shadow-tiny { box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04); }
.shadow-premium { box-shadow: 0 4px 14px rgba(15, 23, 42, 0.05); }
.shadow-heavy { box-shadow: 0 24px 40px rgba(15, 23, 42, 0.08); }
.shadow-hover:hover { box-shadow: 0 15px 35px -8px rgba(15, 23, 42, 0.15); }
.shadow-inner-soft { box-shadow: inset 0 2px 4px rgba(15, 23, 42, 0.02); }
/* Water Blob Background */
.water-blob-bg { position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
.blob-svg { position: absolute; top: -10%; left: -20%; width: 1000px; height: 1000px; opacity: 1; animation: blob-float 30s infinite alternate-reverse; will-change: transform; backface-visibility: hidden; transform: translateZ(0); }
.blob-small { top: 40%; right: -10%; left: auto; width: 600px; height: 600px; opacity: 1; animation: blob-float 25s infinite alternate; will-change: transform; transform: translateZ(0); }
@keyframes blob-float {
  0% { transform: translate(0, 0) scale(1) rotate(0deg); }
  50% { transform: translate(40px, -50px) scale(1.08) rotate(5deg); }
  100% { transform: translate(0, 0) scale(1) rotate(0deg); }
}
/* Body */
.body { 
  position: relative; 
  z-index: 1; 
  max-width: 1200px; 
  margin: 0 auto; 
  padding: 32px 16px 60px; 
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: calc(100vh - 100px);
  justify-content: center;
}
/* Room Panel */
.room-panel { 
  background: #fff; 
  border-radius: 24px; 
  padding: 28px; 
  margin-bottom: 24px; 
  display: flex; 
  flex-direction: column; 
  gap: 20px; 
  border: 1.5px solid #f1f5f9; 
  transition: transform 0.6s, box-shadow 0.6s; 
  width: 100%;
  max-width: 900px;
}
.room-panel:hover { box-shadow: 0 24px 40px rgba(15, 23, 42, 0.06); border-color: #e2e8f0; transform: translateY(-4px); }
.panel-info { display: flex; justify-content: space-between; align-items: flex-start; }
.privacy-badge { display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; border-radius: 99px; background: #f1f5f9; color: #64748b; font-size: 0.68rem; font-weight: 800; text-transform: uppercase; }
.privacy-badge.private { background: #fff7ed; color: #ff6b00; }
.code-box-inline { display: flex; align-items: center; gap: 6px; cursor: pointer; border-radius: 10px; background: #f8fafc; padding: 4px 10px; border: 1px solid #f1f5f9; }
.code-label { font-size: 0.75rem; font-weight: 700; color: #94a3b8; }
.code-val { font-size: 1rem; font-weight: 900; color: var(--vp-primary); letter-spacing: 0.05em; font-family: monospace; }
.panel-stats { display: flex; gap: 14px; }
.stat-item { flex: 1; display: flex; align-items: center; gap: 8px; padding: 12px 16px; background: #fff; border-radius: 16px; font-size: 0.9rem; font-weight: 850; color: #475569; border: 1px solid #f1f5f9; }
.stat-item.active-group { background: #f0fdf4; color: #16a34a; border-color: #dcfce7; }
/* Minimal Member Display (No Backgrounds) */
.team-grid-container {
  background: #ffffff;
  border-radius: 28px;
  border: 1px solid #efe6d4;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.04);
  width: 100%;
  max-width: 900px;
}
.member-grid-body { min-height: auto; }
.member-card-minimal {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: transparent;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.member-card-minimal:hover {
  transform: translateY(-4px);
}
.member-avatar-wrap {
  position: relative;
  width: 80px;
  height: 80px;
  flex-shrink: 0;
}
.avatar-circle-minimal {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  font-size: 1.8rem;
  font-weight: 800;
  color: #94a3b8;
  border: 1px solid #efe6d4;
}
.avatar-circle-minimal img { width: 100%; height: 100%; object-fit: cover; }
.host-badge-dot {
  position: absolute;
  bottom: -4px;
  left: 50%;
  transform: translateX(-50%);
  background: #ff6b00;
  color: #fff;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #fff;
  box-shadow: 0 4px 10px rgba(255, 107, 0, 0.4);
  z-index: 2;
}
.member-info-minimal { display: flex; flex-direction: column; align-items: center; gap: 0; }
.member-name-minimal { font-weight: 850; color: #1e293b; font-size: 1rem; text-align: center; }
.me-text { font-size: 0.75rem; font-weight: 900; color: #ff6b00; }
.member-actions-minimal {
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}
.member-card-minimal:hover .member-actions-minimal { opacity: 1; }
.mini-btn {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: #fff;
  border: 1.5px solid #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  cursor: pointer;
  transition: 0.2s;
  box-shadow: 0 4px 10px rgba(0,0,0,0.05);
}
.mini-btn:hover { color: #ff6b00; border-color: #ff6b00; }
.mini-btn.danger:hover { color: #ef4444; border-color: #ef4444; }
.divider-v { width: 1px; height: 20px; background: #e2e8f0; margin: 0 4px; }
.member-count-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.85rem;
  font-weight: 850;
  color: #64748b;
}
.page-btn:not(:disabled):hover { border-color: #ff6b00; color: #ff6b00; background: #fff7ed; }
.page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.page-info { font-weight: 700; color: #64748b; font-size: 0.95rem; }
.m-you { display: none; } /* removed old utility */
.badge-host-v2 {
  font-size: 0.62rem;
  font-weight: 900;
  color: #fff;
  background: #ff6b00;
  padding: 3px 10px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  box-shadow: 0 4px 10px rgba(255, 107, 0, 0.2);
}
.badge-member-v2 {
  font-size: 0.62rem;
  font-weight: 800;
  color: #94a3b8;
  background: #f1f5f9;
  padding: 3px 10px;
  border-radius: 8px;
}
.badge-you-v2 {
  font-size: 0.62rem;
  font-weight: 950;
  color: #ff6b00;
  background: #fff;
  border: 1.5px solid #fed7aa;
  padding: 2px 10px;
  border-radius: 8px;
}
/* Icon circle buttons */
.icon-btn-circle { width: 44px; height: 44px; border-radius: 14px; display: flex; align-items: center; justify-content: center; background: #fff; border: 1px solid #f1f5f9; color: #64748b; cursor: pointer; transition: 0.2s; }
.icon-btn-circle:hover { background: #f8fafc; color: #1e293b; transform: translateY(-2px); }
.icon-btn-circle.danger { background: #fff1f2; color: #ef4444; border-color: #fecaca; }
/* Request Card */
.request-entry-card { background: linear-gradient(135deg, #fff 0%, #fffbf5 100%); margin-top: 24px; border-radius: 28px; padding: 20px; display: flex; align-items: center; gap: 16px; border: 1.5px solid #ffedd5; transition: transform 0.4s; cursor: pointer; }
.request-entry-card:hover { transform: translateY(-4px); box-shadow: 0 20px 40px rgba(255, 107, 0, 0.08); }
.rec-icon { width: 52px; height: 52px; border-radius: 16px; background: #fff7ed; color: #ff6b00; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.rec-content { flex: 1; }
.rec-content h4 { font-size: 1rem; font-weight: 800; color: #ff6b00; margin-bottom: 2px; }
.rec-content p { font-size: 0.75rem; color: #cc5500; opacity: 0.7; line-height: 1.4; }
.rec-btn { background: #ff6b00; color: #fff; border: none; padding: 10px 18px; border-radius: 12px; font-weight: 900; font-size: 0.82rem; cursor: pointer; transition: 0.2s; }
.rec-btn:hover { background: #e66000; box-shadow: 0 4px 12px rgba(255, 107, 0, 0.3); }
.status-badge { padding: 6px 14px; border-radius: 10px; font-size: 0.8rem; font-weight: 900; }
.status-badge.pending { background: #fed7aa; color: #9a3412; }
/* Activities */
.activity-block { margin-top: 32px; }
.act-card-premium { background: #fff; border-radius: 24px; padding: 14px; display: flex; gap: 16px; align-items: center; cursor: pointer; transition: 0.2s; border: 1px solid #f1f5f9; position: relative; }
.acp-thumb { width: 68px; height: 68px; border-radius: 16px; overflow: hidden; background: #f1f5f9; flex-shrink: 0; }
.acp-thumb img { width: 100%; height: 100%; object-fit: cover; }
.acp-name { font-size: 1.1rem; font-weight: 800; color: #1e293b; margin-bottom: 3px; }
.meta-line { display: flex; align-items: center; gap: 6px; font-size: 0.78rem; color: #94a3b8; font-weight: 600; }
.acp-leave { position: absolute; top: 12px; right: 12px; width: 32px; height: 32px; border-radius: 10px; border: none; background: #f8fafc; color: #cbd5e1; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.acp-leave:hover { color: #ef4444; background: #fee2e2; }
.empty-placeholder { padding: 48px 0; background: #f8fafc; border-radius: 24px; text-align: center; color: #94a3b8; margin-top: 10px; border: 1.5px dashed #e2e8f0; }
/* Settings elements matching minimal modal */
.w-full { width: 100%; }
.text-left { text-align: left; }
.input-field { width: 100%; height: 58px; background: #f8fafc; border: 2px solid #f1f5f9; border-radius: 16px; padding: 0 20px; font-size: 1.05rem; font-weight: 750; color: #1e293b; outline: none; }
.input-field-sm { width: 100%; height: 50px; background: #f8fafc; border: 2px solid #f1f5f9; border-radius: 14px; padding: 0 16px; font-size: 1rem; font-weight: 700; color: #1e293b; outline: none; }
.settings-stack { display: flex; flex-direction: column; }
.setting-row { display: flex; justify-content: space-between; align-items: center; background: #f8fafc; padding: 14px 20px; border-radius: 16px; cursor: pointer; transition: 0.3s; }
.setting-title { font-weight: 850; font-size: 1.05rem; color: #1e293b; }
.pin-container { height: 50px; opacity: 0.3; pointer-events: none; transition: 0.3s; margin-top: 12px; }
.pin-container.is-active { opacity: 1; pointer-events: auto; }
.num-btn { flex: 1; min-width: 60px; height: 50px; border-radius: 16px; background: #f8fafc; border: 2px solid transparent; font-weight: 900; color: #64748b; cursor: pointer; transition: 0.3s; display: flex; align-items: center; justify-content: center; }
.num-btn.compact { min-width: 42px; height: 42px; border-radius: 14px; font-size: 1.15rem; }
.num-btn:hover { background: #f1f5f9; color: #1e293b; }
.num-btn.active { background: #fff7ed; border-color: #ff6b00; color: #ff6b00; box-shadow: 0 4px 10px rgba(255, 107, 0, 0.15); }
.icon-btn-circle-v2 {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: transparent;
  border: none;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.icon-btn-ghost {
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  transition: 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  border-radius: 10px;
}
.icon-btn-ghost:hover {
  transform: scale(1.1);
}
.icon-btn-circle-v2:hover {
  color: #ff6b00;
  transform: scale(1.1);
}
.icon-btn-circle-v2.danger:hover {
  color: #ef4444;
  transform: scale(1.1);
}
.fancy-toggle { width: 50px; height: 28px; background: #e2e8f0; border-radius: 20px; position: relative; transition: 0.3s; cursor: pointer; }
.fancy-toggle.on { background: #ff6b00; }
.fancy-knob { width: 20px; height: 20px; background: #fff; border-radius: 50%; position: absolute; top: 4px; left: 4px; transition: 0.3s; box-shadow: 0 2px 5px rgba(0,0,0,0.2); }
.fancy-toggle.on .fancy-knob { left: 26px; }
.primary-btn-solid { width: 100%; height: 64px; background: #ff6b00; color: #fff; border: none; border-radius: 20px; font-weight: 950; font-size: 1.25rem; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: center; }
.primary-btn-solid:hover { background: #e66000; box-shadow: 0 8px 24px rgba(255, 107, 0, 0.2); }
.text-teal-500 { color: #14b8a6; }
.text-blue-500 { color: #3b82f6; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.25s, transform 0.25s; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(12px); }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
/* Premium Loading UI */
.loading-full-screen { position: fixed; inset: 0; z-index: 999; display: flex; align-items: center; justify-content: center; background: #ffffff; }
.loader-premium-card { background: #fff; padding: 48px; border-radius: 44px; display: flex; flex-direction: column; align-items: center; gap: 24px; border: 1.5px solid #f5ecdb; box-shadow: 0 40px 80px rgba(15, 23, 42, 0.08); animation: loader-pop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
.loader-icon-wrap { width: 80px; height: 80px; background: #fff7ed; border-radius: 24px; display: flex; align-items: center; justify-content: center; color: #ff6b00; }
.loader-text { font-size: 1.25rem; font-weight: 900; color: #1e293b; letter-spacing: -0.01em; }
@keyframes loader-pop {
  0% { transform: scale(0.8); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
/* Activities Grid & Cards */
.activities-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr); /* 2 columns on mobile */
  gap: 12px;
}
@media (min-width: 640px) {
  .activities-grid {
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 24px;
  }
}
.activity-flat-card {
  background: white;
  border-radius: 20px; /* Slightly smaller radius for 2-col */
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  border: 1px solid #efe6d4;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
  display: flex;
  flex-direction: column;
}
.activity-flat-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.08);
  border-color: #e5d9bf;
}
.card-img-box {
  position: relative;
  width: 100%;
  aspect-ratio: 1/1;
  background: #f8fafc;
}
.card-img-box img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.card-badge {
  position: absolute;
  top: 12px;
  left: 12px;
  background: rgba(15, 23, 42, 0.8);
  backdrop-filter: blur(4px);
  color: white;
  padding: 6px 12px;
  border-radius: 10px;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.05em;
}
/* Modal tweaks */
.tn-overlay { position: fixed; inset: 0; z-index: 2000; background: rgba(15, 23, 42, 0.5); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; padding: 16px; }
.tn-sheet { background: #fff; border-radius: 32px; width: 100%; max-width: 440px; padding: 32px 24px; border: 1px solid rgba(255,255,255,0.2); }
.tn-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
.tn-title { font-size: 1.35rem; font-weight: 900; color: #0f172a; }
.tn-close { border: none; background: #f1f5f9; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #64748b; }
.heartbeat-me {
  animation: heartbeat-steady 1.2s ease-in-out infinite;
  transform-origin: center;
}
@keyframes heartbeat-steady {
  0% { transform: scale(1); }
  20% { transform: scale(1.12); }
  40% { transform: scale(1); }
  100% { transform: scale(1); }
}
</style>
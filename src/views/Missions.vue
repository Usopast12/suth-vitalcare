<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMissions } from '../composables/useMissions'
import {
  CheckCircle2, Circle, XCircle, ChevronLeft, 
  Calendar, UploadCloud, FileImage, Medal, 
  FolderOpen, Target, Clock, Wand2, ChevronDown,
  Activity, Heart, ImageIcon, CalendarDays, Users, Star
} from 'lucide-vue-next'
// ดึง Logic จาก Composable
const route = useRoute()
const {
  activities,
  filteredTableData,
  totalPoints,
  activeTask,
  showDetailModal,
  selectedDate,
  editingSubmissionId,
  isEditingMode,
  uploadedImageUrl,
  handleImageError,
  triggerFileInput,
  metricMode,
  valNum,
  valSteps,
  valH,
  valM,
  valS,
  isSubmitting,
  isUploading,
  fileInput,
  formatDateDDMMYYYY,
  handleInstanceSelect,
  closeDetailModal,
  submitTask,
  isToday,
  isAnalyzing,
  analyzingProgress,
  currentLoadingMessage,
  handleAIAnalysis,
  isOcrEnabled,
  imageTimestamp,
  tasksForSelectedDateAndEvent,
  onTaskDropdownChange,
  handleManage,
  handleFileUpload,
  userSubmissions,
  ALL_TASKS,
  textResponse,
  oldSubmissionValue,
  cancelEditing,
  isTaskAllowedOnDate,
  showCelebration,
  celebrationPoints,
  celebrationTaskTitle,
  tableData
} = useMissions()

const getLocalYYYYMMDD = (d: Date) => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// คำนวณ Streak ไฟสะสมติดต่อกัน
const activeStreak = computed(() => {
  const approvedDates = userSubmissions.value
    .filter((s: any) => s.status === 'approved')
    .map((s: any) => {
      const d = new Date(s.created_at)
      return getLocalYYYYMMDD(d)
    })
  
  const uniqueDates = [...new Set(approvedDates)].sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
  if (uniqueDates.length === 0) return 0
  
  const todayStr = getLocalYYYYMMDD(new Date())
  const yesterdayStr = getLocalYYYYMMDD(new Date(Date.now() - 86400000))
  
  const latestDateStr = uniqueDates[0]
  if (latestDateStr !== todayStr && latestDateStr !== yesterdayStr) {
    return 0
  }
  
  let streak = 1
  let currentDate = new Date(latestDateStr)
  for (let i = 1; i < uniqueDates.length; i++) {
    const nextDate = new Date(uniqueDates[i])
    const diffTime = currentDate.getTime() - nextDate.getTime()
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))
    if (diffDays === 1) {
      streak++
      currentDate = nextDate
    } else if (diffDays > 1) {
      break
    }
  }
  return streak
})

// ฟังก์ชันคำนวณความคืบหน้ารายกิจกรรม
const getActivityProgress = (title: string) => {
  const actRows = tableData.value.filter((row: any) => row.evt === title)
  const total = actRows.length
  if (total === 0) return { done: 0, total: 0, percent: 0 }
  const done = actRows.filter((row: any) => row.statusCode === 'done').length
  const percent = Math.round((done / total) * 100)
  return { done, total, percent }
}

// สไตล์เศษกระดาษเฉลิมฉลอง
const getConfettiStyle = (i: number) => {
  const colors = ['#FF6A00', '#FFB703', '#22C55E', '#3B82F6', '#EC4899', '#A855F7']
  const color = colors[i % colors.length]
  const left = Math.random() * 100
  const delay = Math.random() * 1.5
  const duration = 2 + Math.random() * 2
  const size = 6 + Math.random() * 8
  return {
    backgroundColor: color,
    left: `${left}%`,
    animationDelay: `${delay}s`,
    animationDuration: `${duration}s`,
    width: `${size}px`,
    height: `${size * 0.4}px`,
    transform: `rotate(${Math.random() * 360}deg)`
  }
}

// ฟังก์ชันคำนวณแต้มแยกตามกิจกรรม
const getActivityPoints = (title: string) => {
  return userSubmissions.value
    .filter((s: any) => s.status === 'approved' && ALL_TASKS.value.find((t: any) => t.id === s.task_id)?.evt === title)
    .reduce((sum: number, s: any) => {
      const taskPts = s.tasks?.points || ALL_TASKS.value.find((t: any) => t.id === s.task_id)?.points || 0
      return sum + taskPts
    }, 0)
}
// ---- ระบบ 3 สเตป ----
const router = useRouter()
const currentStep = ref<1 | 2 | 3>(1) 
const selectedActivity = ref<any>(null) 
const selectedActivityId = ref<string | null>(null)
const taskSearch = ref('') 
// ฟังก์ชันสำหรับนับจำนวนภารกิจในแต่ละกิจกรรม
const getTaskCount = (title: string) => {
  return filteredTableData.value.filter((row: any) => row.evt === title).length
}
const step1Activities = computed(() => {
  if (!taskSearch.value.trim()) return activities.value
  const kw = taskSearch.value.toLowerCase()
  return activities.value.filter(a => a.title.toLowerCase().includes(kw))
})
const step2Tasks = computed(() => {
  if (!selectedActivity.value) return []
  return filteredTableData.value.filter(row => row.evt === selectedActivity.value.title)
})
function updateUrlQuery(isPush = false) {
  const query: any = { ...route.query }
  if (currentStep.value > 1) query.step = String(currentStep.value)
  else delete query.step
  if (selectedActivityId.value) query.activityId = selectedActivityId.value
  else delete query.activityId
  if (currentStep.value === 3 && activeTask.value?.id) {
    query.taskId = String(activeTask.value.id)
  } else {
    delete query.taskId
  }
  if (step1Page.value > 1) query.page1 = String(step1Page.value)
  else delete query.page1
  if (step2Page.value > 1) query.page2 = String(step2Page.value)
  else delete query.page2
  if (isPush) router.replace({ query }).catch(() => {})
  else router.replace({ query }).catch(() => {})
}
function goStep1() {
  currentStep.value = 1
  selectedActivity.value = null
  selectedActivityId.value = null
  taskSearch.value = ''
  closeDetailModal()
  updateUrlQuery(true)
}
function goStep2(act: any) {
  selectedActivity.value = act
  selectedActivityId.value = String(act.id)
  currentStep.value = 2
  closeDetailModal()
  updateUrlQuery(true)
}
function goStep3(row: any) {
  handleManage(row) 
  currentStep.value = 3
  updateUrlQuery(true)
}
function backToStep2() {
  currentStep.value = 2
  closeDetailModal()
  updateUrlQuery(true)
}
watch(showDetailModal, (val) => {
  if (val) {
    currentStep.value = 3
    if (activeTask.value && !selectedActivity.value) {
      selectedActivity.value = activities.value.find((a: any) => a.title === activeTask.value?.evt) || null
    }
    updateUrlQuery(true)
  } else if (!val && currentStep.value === 3) {
    currentStep.value = 2
    updateUrlQuery(true)
  }
})
// Watch for URL changes to restore state
watch(() => route.query, (q) => {
  if (q.step) currentStep.value = Number(q.step) as any
  else currentStep.value = 1
  if (q.activityId) {
    selectedActivityId.value = String(q.activityId)
    // Restore selectedActivity object from activities list
    if (activities.value.length > 0) {
      selectedActivity.value = activities.value.find(a => String(a.id) === String(q.activityId)) || null
    }
  }
  if (q.page1) step1Page.value = Number(q.page1)
  if (q.page2) step2Page.value = Number(q.page2)
}, { immediate: true })
// Sync selectedActivity when activities list loads/updates
watch(activities, (acts) => {
  if (acts.length > 0 && selectedActivityId.value) {
    const updated = acts.find(a => String(a.id) === String(selectedActivityId.value))
    if (updated) {
      selectedActivity.value = updated
    }
  }
})
// ---- ระบบ Pagination (เพิ่มใหม่) ----
const itemsPerPage = 10
const step1Page = ref(1)
const step2Page = ref(1)
const step1TotalPages = computed(() => Math.ceil(step1Activities.value.length / itemsPerPage))
const paginatedStep1 = computed(() => {
  const start = (step1Page.value - 1) * itemsPerPage
  return step1Activities.value.slice(start, start + itemsPerPage)
})
const step2TotalPages = computed(() => Math.ceil(step2Tasks.value.length / itemsPerPage))
const paginatedStep2 = computed(() => {
  const start = (step2Page.value - 1) * itemsPerPage
  return step2Tasks.value.slice(start, start + itemsPerPage)
})
// รีเซ็ตหน้าเมื่อค้นหา
watch(taskSearch, () => {
  step1Page.value = 1
  updateUrlQuery()
})
// รีเซ็ตหน้าเมื่อเปลี่ยนกิจกรรมในสเตป 2
watch(selectedActivity, () => {
  step2Page.value = 1
  updateUrlQuery()
})
// Sync pagination changes to URL
watch(step1Page, () => updateUrlQuery(true))
watch(step2Page, () => updateUrlQuery(true))
// ---- ระบบเวลาและสถานะกิจกรรม ----
const now = ref(Date.now())
let timer: any = null
onMounted(() => {
  timer = setInterval(() => {
    now.value = Date.now()
  }, 1000)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})
const getActivityStatus = (act: any) => {
  const endMs = act.end_date ? new Date(act.end_date).getTime() : 0
  if (endMs > 0 && endMs < now.value) return 'ended'
  if (act.status === 'closed') return 'ended'
  return 'ongoing'
}
</script>
<template>
  <div class="rank-app mission-adapted">
    <!-- AI Loading Overlay as futuristic Download Bar -->
    <transition name="fade">
      <div v-if="isAnalyzing" class="ai-loading-overlay">
        <div class="ai-download-card">
          <!-- Loading state representation -->
          <div class="ai-loader-bar-container">
            <div class="flex justify-between items-center text-sm font-semibold text-slate-700 mb-2">
              <div class="flex items-center gap-2">
                <span class="ai-loading-dot-pulse"></span>
                <span>{{ currentLoadingMessage }}</span>
              </div>
              <span class="font-extrabold text-orange-600">{{ Math.round(analyzingProgress) }}%</span>
            </div>
            
            <!-- The actual Download / Progress Bar -->
            <div class="ai-download-bar-bg">
              <div class="ai-download-bar-fill" :style="{ width: analyzingProgress + '%' }">
                <!-- Glowing laser tip -->
                <div class="laser-tip"></div>
              </div>
            </div>

            <!-- Stats metadata below the bar -->
            <div class="flex justify-between items-center text-xs text-slate-400 font-semibold mt-2">
              <span>ความเร็ว: {{ (1.2 + (analyzingProgress / 40)).toFixed(1) }} MB/s</span>
              <span>ประมวลผล: {{ Math.round(analyzingProgress * 12.5) }} / 1,250 KB</span>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <div v-if="currentStep === 1" class="modern-list-view">
      <!-- Dashboard header section containing Flame Streak and Points -->
      <div class="mission-dashboard">
        <div class="dash-card points-card animate-pulse-subtle">
          <div class="dash-icon-wrap bg-orange-100">
            <Star :size="24" class="text-orange-500 fill-current" />
          </div>
          <div class="dash-info">
            <span class="dash-label text-slate-500 font-bold text-xs uppercase tracking-wider">แต้มสะสมทั้งหมด</span>
            <span class="dash-value text-orange-600 font-black text-2xl">{{ totalPoints.toLocaleString() }} <span class="text-sm font-bold text-slate-400">แต้ม</span></span>
          </div>
        </div>

        <div class="dash-card streak-card" :class="{ 'has-streak': activeStreak > 0 }">
          <div class="dash-icon-wrap" :class="activeStreak > 0 ? 'bg-red-100 animate-bounce-slow' : 'bg-slate-100'">
            <span class="streak-emoji">{{ activeStreak > 0 ? '🔥' : '❄️' }}</span>
          </div>
          <div class="dash-info">
            <span class="dash-label text-slate-500 font-bold text-xs uppercase tracking-wider">ความต่อเนื่อง</span>
            <span class="dash-value font-black text-2xl" :class="activeStreak > 0 ? 'text-red-500' : 'text-slate-400'">
              {{ activeStreak }} <span class="text-sm font-bold text-slate-400">วันติดต่อกัน</span>
            </span>
          </div>
        </div>
      </div>

      <div class="search-header">
        <div class="modern-search-box">
          <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input 
            type="text" 
            v-model="taskSearch" 
            placeholder="ค้นหากิจกรรมที่คุณเข้าร่วม..." 
            class="modern-search-input" 
          />
        </div>
      </div>
      <div class="mission-grid-wrapper">
        <div class="section-title-row mb-4">
          <h3 class="text-xl font-bold">กิจกรรมของคุณ ({{ step1Activities.length }})</h3>
        </div>
        <div v-if="paginatedStep1.length > 0" class="flat-grid">
            <div 
              v-for="act in paginatedStep1" 
              :key="act.id"
              class="flat-card"
              :class="{ 'is-ended': getActivityStatus(act) === 'ended' }"
              @click="goStep2(act)"
            >
              <div class="img-box">
                <img v-if="act.poster" :src="act.poster" :alt="act.title" />
                <div v-else class="img-fallback">
                  <ImageIcon :size="32" class="fallback-icon" />
                </div>
                <div class="dark-badge" :class="getActivityStatus(act)">
                  <template v-if="getActivityStatus(act) === 'ended'">สิ้นสุดกิจกรรม</template>
                  <template v-else>กำลังดำเนินการ</template>
                </div>
              </div>
            <div class="info-box">
              <h4 class="card-title">{{ act.title }}</h4>

              <!-- แถบแสดงความคืบหน้ารายกิจกรรม -->
              <div class="activity-progress-wrap mt-1 mb-3">
                <div class="flex justify-between items-center text-xs font-bold text-slate-500 mb-1">
                  <span>ความคืบหน้า</span>
                  <span>{{ getActivityProgress(act.title).done }}/{{ getActivityProgress(act.title).total }} ภารกิจ ({{ getActivityProgress(act.title).percent }}%)</span>
                </div>
                <div class="activity-progress-bg">
                  <div class="activity-progress-fill" :style="{ width: getActivityProgress(act.title).percent + '%' }"></div>
                </div>
              </div>

              <div class="meta-row text-orange-600">
                <Target :size="14" class="meta-icon" />
                <span>มีทั้งหมด: {{ getTaskCount(act.title) }} ภารกิจ</span>
              </div>
              <div class="points-badge-row mt-2">
                <div class="points-badge">
                  <Star :size="12" class="fill-current" />
                  <span>{{ getActivityPoints(act.title).toLocaleString() }} แต้มสะสม</span>
                </div>
              </div>
              <div class="meta-row">
                <CalendarDays :size="14" class="meta-icon" />
                <span>จัดกิจกรรม: {{ formatDateDDMMYYYY(act.start_date) }} - {{ formatDateDDMMYYYY(act.end_date) }}</span>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="shop-empty py-20">
          <h3 class="text-slate-500 font-medium">ไม่พบกิจกรรมที่ค้นหา</h3>
        </div>
        <div class="pagination mt-8" v-if="step1TotalPages > 1">
          <button :disabled="step1Page === 1" @click="step1Page--" class="pag-btn">« ก่อนหน้า</button>
          <span class="page-info">หน้า {{ step1Page }} / {{ step1TotalPages }}</span>
          <button :disabled="step1Page === step1TotalPages" @click="step1Page++" class="pag-btn">ถัดไป »</button>
        </div>
      </div>
    </div>
    <div v-else-if="currentStep === 2" class="modern-list-view">
      <div class="mb-6 px-mobile">
        <button class="back-btn" @click="goStep1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-5 h-5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          กลับไปหน้ากิจกรรม
        </button>
      </div>
      <div class="page-banner mb-6">
        <div class="banner-text">
          <h2 class="text-2xl font-bold truncate" :title="selectedActivity?.title">{{ selectedActivity?.title }}</h2>
          <p class="opacity-90 mt-1">เลือกภารกิจที่คุณต้องการส่งผลงาน</p>
        </div>
      </div>
      <div class="activity-list-container">
        <div class="list-header-bar">
          <div class="list-title">ภารกิจที่มีให้ทำ ({{ step2Tasks.length }})</div>
        </div>
        <div class="activity-list-body">
          <template v-if="paginatedStep2.length > 0">
            <div 
              v-for="row in paginatedStep2" 
              :key="row.id"
              class="activity-row hover-effect"
              @click="goStep3(row)"
            >
              <div class="ar-left">
                <div class="ar-system-name">{{ row.dateLabel }} • +{{ row.points }} แต้ม</div>
              </div>
              <div class="ar-middle">
                <div class="flex items-center gap-3">
                  <span class="ar-subject">{{ row.taskName }}</span>
                  <span class="status-pill" :class="row.statusCode">{{ row.statusText }}</span>
                </div>
              </div>
            </div>
          </template>
          <div v-else class="empty-search">
            ไม่มีภารกิจให้ทำในขณะนี้
          </div>
        </div>
        <div class="pagination" v-if="step2TotalPages > 1">
          <button :disabled="step2Page === 1" @click="step2Page--">« ก่อนหน้า</button>
          <span class="page-info">หน้า {{ step2Page }} / {{ step2TotalPages }}</span>
          <button :disabled="step2Page === step2TotalPages" @click="step2Page++">ถัดไป »</button>
        </div>
      </div>
    </div>
    <div v-else-if="currentStep === 3" class="detail-view">
      <header class="detail-header">
        <div class="header-container">
          <button class="back-btn" @click="backToStep2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-5 h-5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            กลับไปหน้ารายการภารกิจ
          </button>
        </div>
      </header>
      <div class="layout-wrapper" v-if="activeTask">
        <main class="main-content">
          <div class="page-banner banner-task mb-6">
            <div class="banner-text">
              <h2>{{ activeTask.note }}</h2>
              <div class="mt-4 flex flex-col gap-2 text-sm opacity-90 font-medium">
                <div class="flex items-center gap-2">
                  <span class="text-white/70">วันส่ง:</span>
                  <span>{{ formatDateDDMMYYYY(selectedDate) }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-white/70">ชื่อกิจกรรม:</span>
                  <span>{{ activeTask.evt }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-white/70">คะแนนที่ได้:</span>
                  <span class="font-bold underline decoration-2 underline-offset-4">{{ activeTask.points }} แต้ม</span>
                </div>
              </div>
            </div>
          </div>
          <div class="task-form-content">
            <div class="detail-body">
                <div v-if="editingSubmissionId && !isEditingMode" class="readonly-view">
                  <div class="success-banner">
                    <CheckCircle2 class="w-6 h-6" /> ส่งภารกิจเรียบร้อยแล้ว
                  </div>
                  <!-- แสดงรูปภาพถ้ามี -->
                  <div class="proof-image-box shadow-sm" v-if="uploadedImageUrl">
                    <img :src="uploadedImageUrl + '?t=' + imageTimestamp" alt="หลักฐาน" @error="handleImageError" />
                  </div>
                  <!-- แสดงข้อความที่ตอบถ้ามี -->
                  <div v-if="textResponse" class="recorded-data shadow-sm">
                    <label>ข้อความที่คุณตอบไว้</label>
                    <div class="val-display text-response-display">{{ textResponse }}</div>
                  </div>
                  <!-- แสดงตัวเลขถ้าเป็น manual/steps/time -->
                  <div v-if="!textResponse && activeTask?.submission_type !== 'photo'" class="recorded-data shadow-sm">
                    <label>ผลลัพธ์ที่คุณบันทึกไว้</label>
                    <div class="val-display">
                      {{ metricMode === 'time' ? `${valH} ชม. ${valM} นาที` : (metricMode === 'steps' ? Number(valSteps).toLocaleString() : valNum) }}
                      <span class="unit">{{ metricMode === 'steps' ? 'ก้าว' : (metricMode === 'time' ? '' : activeTask?.metric_unit) }}</span>
                    </div>
                  </div>
                  <button v-if="isToday(selectedDate)" class="action-btn outline-btn mt-4" @click="isEditingMode = true">
                    แก้ไขข้อมูลการส่ง
                  </button>
                </div>
                <template v-else-if="isToday(selectedDate) && isTaskAllowedOnDate(activeTask, selectedDate)">
                  <!-- === PHOTO type: upload area only === -->
                  <template v-if="activeTask?.submission_type === 'photo' || activeTask?.submission_type === 'both' || !activeTask?.submission_type || activeTask?.submission_type === 'manual'">
                    <div v-if="activeTask?.submission_type !== 'text'" class="upload-area shadow-sm" @click="() => (fileInput as any)?.click()">
                      <input type="file" ref="fileInput" class="hidden-input" accept="image/*" @change="handleFileUpload" />
                      <img v-if="uploadedImageUrl" :src="uploadedImageUrl + '?t=' + imageTimestamp" class="uploaded-preview" @error="handleImageError" />
                      <div v-else class="upload-placeholder">
                        <div class="icon-circle shadow-sm"><UploadCloud class="w-8 h-8 text-orange-500" /></div>
                        <p><strong>แตะเพื่ออัปโหลดรูปหลักฐาน</strong></p>
                        <span>(รองรับไฟล์ JPG, PNG)</span>
                      </div>
                      <div v-if="isUploading || isAnalyzing" class="upload-overlay">
                        <span class="upload-loader"></span>
                        <span>{{ isUploading ? 'กำลังอัปโหลด...' : 'AI กำลังวิเคราะห์รูปภาพ...' }}</span>
                      </div>
                    </div>
                  </template>
                  <!-- === TEXT response area === -->
                  <template v-if="activeTask?.submission_type === 'text' || activeTask?.submission_type === 'both'">
                    <div class="input-group shadow-sm" style="margin-top: 12px;">
                      <label class="input-label">✍️ พิมพ์ข้อความตอบกลับ</label>
                      <textarea
                        v-model="textResponse"
                        rows="5"
                        placeholder="พิมพ์คำตอบหรือข้อความของคุณที่นี่..."
                        class="styled-textarea"
                      ></textarea>
                    </div>
                  </template>
                  <!-- === MANUAL numeric input (manual, photo, both) === -->
                  <template v-if="['manual', 'photo', 'both'].includes(activeTask?.submission_type) || (!activeTask?.submission_type)">
                    <div class="input-group shadow-sm">
                      <label class="input-label">
                        {{ metricMode === 'steps' ? 'ระบุจำนวนก้าว' : (metricMode === 'time' ? 'ระบุระยะเวลา' : 'ระบุผลลัพธ์ที่ทำได้') }}
                      </label>
                      <div v-if="isEditingMode && oldSubmissionValue" class="text-sm text-gray-500 mb-2 mt-[-5px]">
                        ค่าเดิมที่บันทึกไว้: <span class="font-semibold text-orange-600">{{ oldSubmissionValue }} <span v-if="metricMode === 'steps'">ก้าว</span><span v-else-if="metricMode !== 'time'">{{ activeTask?.metric_unit }}</span></span>
                      </div>
                      <div v-if="metricMode === 'number' || metricMode === 'steps'" class="field-row">
                        <div v-if="uploadedImageUrl && isOcrEnabled" class="field-ai-wrapper" :class="{ 'opacity-50 pointer-events-none': isAnalyzing || isSubmitting }" title="ใช้ AI วิเคราะห์อีกครั้ง" @click="() => !isAnalyzing && !isSubmitting && handleAIAnalysis()">
                          <Wand2 class="field-ai-icon" :class="{ 'ai-icon-spin': isAnalyzing }" />
                        </div>
                        <input v-if="metricMode === 'steps'" v-model="valSteps" type="number" placeholder="0" class="styled-input" />
                        <input v-else v-model="valNum" type="number" step="any" placeholder="0" class="styled-input" />
                        <span class="field-unit">{{ metricMode === 'steps' ? 'ก้าว' : activeTask?.metric_unit }}</span>
                      </div>
                      <div v-if="metricMode === 'time'" class="time-inputs">
                        <div v-if="uploadedImageUrl && isOcrEnabled" class="field-ai-wrapper mr-2" :class="{ 'opacity-50 pointer-events-none': isAnalyzing || isSubmitting }" title="ใช้ AI วิเคราะห์อีกครั้ง" @click="() => !isAnalyzing && !isSubmitting && handleAIAnalysis()">
                          <Wand2 class="field-ai-icon" :class="{ 'ai-icon-spin': isAnalyzing }" />
                        </div>
                        <div class="time-box"><input v-model="valH" type="number" placeholder="0" class="styled-input text-center" /><span>ชั่วโมง</span></div>
                        <span class="colon">:</span>
                        <div class="time-box"><input v-model="valM" type="number" placeholder="0" class="styled-input text-center" /><span>นาที</span></div>
                        <span class="colon">:</span>
                        <div class="time-box"><input v-model="valS" type="number" placeholder="0" class="styled-input text-center" /><span>วินาที</span></div>
                      </div>
                    </div>
                  </template>
                  <!-- === AI hint for photo-based types === -->
                  <div v-if="isAnalyzing && isOcrEnabled" class="ai-status-hint">
                    <span>Typhoon AI กำลังช่วยคุณวิเคราะห์หลักฐาน...</span>
                  </div>
                  <div class="action-footer">
                    <button class="action-btn primary-btn shadow-md" :disabled="isSubmitting || isAnalyzing" @click="submitTask">
                      <span v-if="isSubmitting" class="loader"></span>
                      <span v-else>{{ editingSubmissionId ? 'ยืนยันการแก้ไข' : 'ส่งผลงานภารกิจ' }}</span>
                    </button>
                    <button v-if="editingSubmissionId" class="action-btn ghost-btn" @click="cancelEditing">
                      ยกเลิกการแก้ไข
                    </button>
                  </div>
                </template>
                <div v-else class="expired-notice shadow-sm">
                  <div class="expired-icon"><Clock class="w-10 h-10 text-slate-400" /></div>
                  <template v-if="isToday(selectedDate) && !isTaskAllowedOnDate(activeTask, selectedDate)">
                    <h3>ยังไม่ถึงวันอนุญาตให้ส่ง</h3>
                    <p>ภารกิจนี้ไม่เปิดให้ส่งในวันนี้ กรุณาตรวจสอบวันในหน้า "วันที่ทำได้"</p>
                  </template>
                  <template v-else>
                    <h3>หมดเวลาส่งภารกิจ</h3>
                    <p>ภารกิจนี้สามารถส่งได้เฉพาะในวันที่กำหนดเท่านั้น</p>
                  </template>
                </div>
              </div>
            </div>
        </main>
      </div>
    </div>

    <!-- Celebration Modal for Successful Submissions & Goals achieved! -->
    <transition name="scale-fade">
      <div v-if="showCelebration" class="celebration-overlay" @click="showCelebration = false">
        <div class="celebration-card" @click.stop>
          
          <!-- Confetti Particles Falling down -->
          <div class="confetti-container">
            <div 
              v-for="i in 60" 
              :key="i" 
              class="confetti-piece" 
              :style="getConfettiStyle(i)"
            ></div>
          </div>

          <h2 class="celebration-title">ยินดีด้วย! ส่งภารกิจสำเร็จ 🎉</h2>
          <p class="celebration-desc">คุณได้ทำภารกิจ <strong>"{{ celebrationTaskTitle }}"</strong> เสร็จสมบูรณ์แล้ว</p>
          
          <div class="points-gain-badge">
            <Star class="fill-current" :size="16" />
            <span>ได้รับ +{{ celebrationPoints }} แต้ม!</span>
          </div>


          <button class="celebration-btn" @click="showCelebration = false">
            รับทราบและลุยต่อ! 💪
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>
<style scoped>
/* ================= CSS VARIABLES & BASE ================= */
.rank-app {
  --primary: #FF6A00;
  --primary-light: #FFF0E6;
  --primary-hover: #E65F00;
  --orange-50: #fff7ed;
  --orange-100: #ffedd5;
  --orange-500: #f97316;
  --orange-600: #ea580c;
  --bg-color: #FFFFFF; 
  --surface: #FFFFFF;
  --text-main: #1E293B;
  --text-muted: #64748B;
  --border: #E2E8F0;
  --radius-lg: 16px;
  --radius-md: 12px;
}
* { box-sizing: border-box; }
.rotate-180 { transform: rotate(180deg); }
.line-through { text-decoration: line-through; }
.rank-app {
  background-color: var(--bg-color);
  min-height: 100vh;
  color: var(--text-main);
  font-family: 'Prompt', 'Noto Sans Thai', sans-serif;
}
/* ================= MODERN LIST VIEW ================= */
.modern-list-view { max-width: 1000px; margin: 0 auto; padding: 24px; }
.justify-end { display: flex; justify-content: flex-end; }
.top-actions-wrapper { margin-bottom: 24px; }
/* โครงสร้าง Activity List Box แบบบาลาบิง */
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
.list-header-bar .list-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 0;
  padding: 0;
}
.search-header { margin-bottom: 24px; }
.modern-search-box {
  display: flex; align-items: center; background: var(--surface);
  border: 1.5px solid #E2E8F0; border-radius: 99px;
  padding: 0 20px; height: 50px; width: 100%; transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0,0,0,0.02);
}
.modern-search-box:focus-within {
  border-color: #FF6A00; background: #FFFFFF;
  box-shadow: 0 4px 12px rgba(255, 106, 0, 0.15);
}
.search-icon { width: 18px; height: 18px; color: #94A3B8; }
.modern-search-input {
  flex: 1; border: none; background: transparent; padding-left: 10px;
  font-size: 0.95rem; color: var(--text-main); outline: none;
}
.modern-search-input::placeholder { color: #94A3B8; }
/* 🌟 Grid & Card System (Match Activities.vue) 🌟 */
.flat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 20px;
  width: 100%;
}
@media (max-width: 768px) {
  .flat-grid { 
    grid-template-columns: repeat(2, 1fr); 
    gap: 12px; 
  }
}
@media (max-width: 480px) {
  .flat-grid { 
    grid-template-columns: repeat(2, 1fr); 
    gap: 12px; 
  }
}
.flat-card {
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: all 0.3s ease;
  background: transparent;
  border: none;
}
.flat-card:hover {
  transform: translateY(-4px);
}
.flat-card.is-ended {
  filter: grayscale(1);
  opacity: 0.7;
}
.img-box {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  background: #F1F5F9;
  border-radius: 16px;
  overflow: hidden;
  margin-bottom: 12px;
}
.img-box img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s ease;
}
.flat-card:hover .img-box img {
  transform: scale(1.05);
}
.dark-badge {
  position: absolute;
  top: 10px;
  left: 10px;
  background: rgba(17, 24, 39, 0.8);
  backdrop-filter: blur(4px);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 6px;
  z-index: 2;
  text-transform: uppercase;
}
.dark-badge.ongoing {
  background: rgba(59, 130, 246, 0.9); /* Blue */
}
.dark-badge.ended {
  background: rgba(107, 114, 128, 0.9); /* Gray */
}
.img-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #CBD5E1;
}
.info-box { 
  padding: 8px 4px 0; 
  display: flex; 
  flex-direction: column; 
  gap: 4px; 
}
.card-title {
  font-size: 15px;
  font-weight: 600;
  color: #111827; 
  margin: 0 0 8px 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.4;
}
.points-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #ECFDF5;
  color: #059669;
  padding: 4px 10px;
  border-radius: 99px;
  font-size: 12px;
  font-weight: 800;
  border: 1px solid #A7F3D0;
}
.meta-row { 
  display: flex; 
  align-items: flex-start; 
  gap: 6px; 
  font-size: 13px; 
  color: #6B7280; 
  margin-bottom: 4px; 
  line-height: 1.4;
}
.meta-row.text-orange-600 { color: var(--primary); font-weight: 600; }
.meta-icon { 
  flex-shrink: 0; 
  margin-top: 2px; 
}
.shop-empty {
  text-align: center;
  padding: 60px 20px;
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
.activity-row:last-child { border-bottom: none; }
.activity-row:hover { background: #F8FAFC; }
.ar-left {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 240px;
  flex-shrink: 0;
}
.ar-system-name { font-size: 0.95rem; color: var(--text-muted); font-weight: 500; }
.ar-middle { flex: 1; min-width: 0; padding-right: 24px; }
.ar-subject { font-size: 1rem; font-weight: 500; color: var(--text-main); display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.status-pill { padding: 0.25rem 0.75rem; border-radius: 100px; font-size: 0.75rem; font-weight: 700; display: inline-block; flex-shrink: 0;}
.status-pill.done { background: #ecfdf5; color: #10b981; }
.status-pill.pending { background: #fff7ed; color: #f97316; }
.status-pill.rejected { background: #fef2f2; color: #ef4444; }
.status-pill.none { background: #f1f5f9; color: #64748b; }
.empty-search { padding: 60px 20px; text-align: center; color: var(--text-muted); font-weight: 600; font-size: 1.1rem; }
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
/* Back Button */
.back-btn {
  display: flex; align-items: center; gap: 6px; background: none; border: none;
  color: var(--text-muted); font-size: 0.95rem; font-weight: 500; cursor: pointer;
  padding: 4px 0; transition: 0.2s;
}
.back-btn:hover { color: var(--primary); }
/* Banners */
.page-banner {
  background: linear-gradient(135deg, #FF9A44 0%, #FF6A00 100%);
  border-radius: var(--radius-lg); padding: 32px; color: white;
  box-shadow: 0 10px 20px rgba(255, 106, 0, 0.15);
}
.banner-task { background: linear-gradient(135deg, #FF9A44 0%, #FF6A00 100%); }
.banner-text h2 { margin: 0; font-size: 1.6rem; font-weight: 800; color: #FFFFFF; line-height: 1.3;}
.flex-col { display: flex; flex-direction: column; }
.gap-2 { gap: 0.5rem; }
.text-white\/70 { color: rgba(255, 255, 255, 0.7); }
.underline { text-decoration: underline; }
.decoration-2 { text-decoration-thickness: 2px; }
.underline-offset-4 { text-underline-offset: 4px; }
.mb-6 { margin-bottom: 1.5rem; }
/* ================= DETAIL VIEW (สเตป 3) ================= */
.detail-view { background-color: #FFFFFF; min-height: 100vh; }
.detail-header { padding: 24px 0 16px; position: relative; z-index: 40; }
.header-container { max-width: 1000px; margin: 0 auto; padding: 0 24px; }
.layout-wrapper { max-width: 1000px; margin: 0 auto; padding: 0 24px 40px; }
.task-form-content { background: white; border: none; padding: 0; }
.detail-body { display: flex; flex-direction: column; gap: 1.5rem; }
.upload-area { height: 220px; border: 2px dashed #cbd5e1; border-radius: var(--radius-lg); background: #FFFFFF; display: flex; align-items: center; justify-content: center; cursor: pointer; position: relative; overflow: hidden; transition: all 0.2s; }
.upload-area:hover { border-color: var(--primary); background: var(--orange-50); }
.hidden-input { display: none; }
.uploaded-preview { width: 100%; height: 100%; object-fit: contain; background: #000; }
.upload-placeholder { text-align: center; color: var(--text-muted); }
.upload-placeholder .icon-circle { width: 64px; height: 64px; background: var(--orange-50); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; }
.upload-placeholder p { margin: 0; color: var(--text-main); font-size: 1.1rem;}
.upload-overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(255, 255, 255, 0.9); display: flex; align-items: center; justify-content: center; flex-direction: column; z-index: 10; gap: 12px; }
.upload-overlay span { font-weight: 600; color: var(--primary); }
.upload-loader { width: 36px; height: 36px; border: 4px solid rgba(255, 106, 0, 0.2); border-bottom-color: var(--primary); border-radius: 50%; display: inline-block; animation: rotation 1s linear infinite; }
/* ================= ช่องกรอกผลลัพธ์ (Minimalist Style) ================= */
.input-group { 
  background: transparent !important; 
  padding: 1rem 0; 
  border: none !important; 
  box-shadow: none !important; 
  margin: 1rem 0; 
}
.input-label { 
  display: block; font-weight: 700; color: var(--text-main); 
  margin-bottom: 0.75rem; font-size: 1.05rem; 
}
/* กล่องกรอกตัวเลขปกติ (ทรงโค้งเหมือน Search Bar) */
.field-row { 
  display: flex; align-items: center; 
  background: #FFFFFF; 
  border: 1.5px solid #E2E8F0; 
  border-radius: 99px; /* โค้งมนแบบแคปซูล */
  padding: 0 24px; 
  height: 52px;
  transition: all 0.3s ease; 
  box-shadow: 0 2px 8px rgba(0,0,0,0.02);
}
.field-row:focus-within { 
  border-color: var(--primary); /* ขอบสีส้มตอนกดพิมพ์ */
  box-shadow: 0 4px 12px rgba(255, 106, 0, 0.15); 
}
.styled-input {
  flex: 1; background: transparent; border: none; padding: 0; 
  font-size: 1.5rem; font-weight: 700; color: var(--text-main); outline: none; width: 100%;
}
.styled-textarea {
  width: 100%; border: 1.5px solid #E2E8F0; border-radius: 14px; padding: 14px 16px;
  font-size: 0.95rem; font-weight: 500; color: var(--text-main); outline: none; 
  font-family: 'Prompt', 'Noto Sans Thai', sans-serif; resize: vertical; min-height: 100px;
  transition: all 0.3s ease; background: #FAFAFA;
}
.styled-textarea:focus { border-color: var(--primary); background: #fff; box-shadow: 0 4px 12px rgba(255,106,0,0.1); }
.text-response-display {
  font-size: 0.95rem !important; font-weight: 400 !important; white-space: pre-wrap;
  line-height: 1.6; color: var(--text-main); padding: 4px 0;
}
.field-unit { font-size: 1rem; font-weight: 600; color: var(--text-muted); margin-left: 12px; }
/* กล่องกรอกแบบเวลา (เผื่อใช้ในกิจกรรมอื่น ปรับให้เป็นทรงแคปซูลเหมือนกัน) */
.time-inputs { 
  display: flex; align-items: center; justify-content: center; gap: 8px; 
  background: #FFFFFF; 
  border: 1.5px solid #E2E8F0; 
  border-radius: 99px; 
  padding: 0 24px; 
  height: 52px;
  transition: all 0.3s ease; 
  box-shadow: 0 2px 8px rgba(0,0,0,0.02);
}
.time-inputs:focus-within { 
  border-color: var(--primary); 
  box-shadow: 0 4px 12px rgba(255, 106, 0, 0.15); 
}
.time-box { flex: 1; display: flex; align-items: baseline; justify-content: center; gap: 4px; }
.time-box .styled-input { text-align: center; font-size: 1.5rem; }
.time-box span { font-size: 0.95rem; color: var(--text-muted); font-weight: 600; }
.colon { font-size: 1.5rem; font-weight: 800; color: #CBD5E1; margin: 0 4px; }
.text-center { text-align: center; }
/* Buttons */
.action-footer { display: flex; flex-direction: column; gap: 0.75rem; margin-top: 0.5rem; }
.action-btn { width: 100%; padding: 1.1rem; border-radius: 12px; font-size: 1.1rem; font-weight: 700; cursor: pointer; display: flex; justify-content: center; align-items: center; border: none; }
.primary-btn { background-color: #06C755 !important; color: white !important; box-shadow: none !important; }
.primary-btn:hover:not(:disabled) { background-color: #05b34c !important; }
.primary-btn:disabled { background-color: #cbd5e1 !important; color: #64748b !important; cursor: not-allowed; }
.outline-btn { background-color: var(--orange-50) !important; border: 2px solid var(--primary) !important; color: var(--primary) !important; }
.ghost-btn { background-color: #f1f5f9 !important; color: #475569 !important; border: 1px solid #e2e8f0 !important; }
/* Readonly View / Utils */
.readonly-view { display: flex; flex-direction: column; gap: 1.25rem; }
.success-banner { background: #ecfdf5; color: #10b981; border: 1px solid #a7f3d0; padding: 1rem; border-radius: 12px; font-weight: 700; display: flex; align-items: center; gap: 0.5rem; }
.proof-image-box { width: 100%; height: 220px; border-radius: var(--radius-lg); overflow: hidden; background: #000; border: 1px solid var(--border); }
.proof-image-box img { width: 100%; height: 100%; object-fit: contain; }
.recorded-data { background: white; border: none; padding: 1.5rem 0; text-align: center; }
.recorded-data label { font-size: 0.95rem; color: var(--text-muted); font-weight: 600; display: block;}
.val-display { font-size: 2.5rem; font-weight: 800; color: var(--text-main); margin-top: 0.5rem; }
.val-display .unit { font-size: 1.2rem; color: var(--text-muted); font-weight: 600; margin-left: 0.5rem; }
.expired-notice { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; color: var(--text-muted); text-align: center; }
.expired-icon { background: #f1f5f9; padding: 1.5rem; border-radius: 50%; margin-bottom: 1rem; flex-shrink: 0; }
.expired-notice h3 { margin: 0 0 0.5rem; font-weight: 700; color: var(--text-main); font-size: 1.5rem; }
.shadow-sm { box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
.loader { width: 24px; height: 24px; border: 3px solid rgba(255,255,255,0.3); border-bottom-color: #fff; border-radius: 50%; display: inline-block; animation: rotation 1s linear infinite; }
@keyframes rotation { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
/* AI Download Bar Style */
.ai-loading-overlay { 
  position: fixed; 
  inset: 0; 
  background: rgba(15, 23, 42, 0.6); 
  backdrop-filter: blur(16px); 
  z-index: 9999; 
  display: flex; 
  align-items: center; 
  justify-content: center; 
  padding: 24px;
}
.ai-download-card {
  width: 100%;
  max-width: 440px;
  background: #FFFFFF;
  border-radius: 24px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(226, 232, 240, 0.8);
  overflow: hidden;
}
.ai-download-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  background: #F8FAFC;
  border-bottom: 1px solid #F1F5F9;
}
.ai-download-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 900;
  font-size: 1.1rem;
  background: linear-gradient(135deg, var(--primary), var(--orange-600));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.sparkle-ai {
  font-size: 1.2rem;
  animation: rotation 3s linear infinite;
}
.ai-version-pill {
  background: var(--primary-light);
  color: var(--primary);
  font-size: 0.7rem;
  font-weight: 800;
  padding: 4px 10px;
  border-radius: 99px;
  border: 1px solid rgba(255, 106, 0, 0.2);
}
.ai-loader-bar-container {
  padding: 24px;
}
.ai-loading-dot-pulse {
  width: 8px;
  height: 8px;
  background: var(--primary);
  border-radius: 50%;
  display: inline-block;
  animation: ai-pulse-dot 1.2s ease-in-out infinite;
}
@keyframes ai-pulse-dot {
  0%, 100% { transform: scale(0.6); opacity: 0.4; }
  50% { transform: scale(1.2); opacity: 1; }
}
.ai-download-bar-bg {
  width: 100%;
  height: 14px;
  background: #E2E8F0;
  border-radius: 99px;
  overflow: hidden;
  position: relative;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.05);
}
.ai-download-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #FF9A44 0%, #FF6A00 100%);
  border-radius: 99px;
  position: relative;
  transition: width 0.3s ease-out;
}
.laser-tip {
  position: absolute;
  top: 0;
  right: 0;
  height: 100%;
  width: 8px;
  background: #FFF;
  box-shadow: 0 0 10px #FFF, 0 0 20px var(--primary);
  animation: laser-pulse 1s infinite alternate;
}
@keyframes laser-pulse {
  from { opacity: 0.6; }
  to { opacity: 1; }
}

/* ================= MISSION DASHBOARD (Streak & Points) ================= */
.mission-dashboard {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}
@media (max-width: 576px) {
  .mission-dashboard {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}
.dash-card {
  display: flex;
  align-items: center;
  gap: 16px;
  background: #FFFFFF;
  border: 1px solid #E2E8F0;
  padding: 16px 20px;
  border-radius: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
  transition: all 0.3s ease;
}
.dash-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.05);
  border-color: rgba(255, 106, 0, 0.2);
}
.dash-icon-wrap {
  width: 52px;
  height: 52px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.dash-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.dash-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: #64748B;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 4px;
}
.dash-value {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.streak-card.has-streak {
  border-color: rgba(239, 68, 68, 0.2);
  background: linear-gradient(135deg, #FFFFFF 0%, #FEF2F2 100%);
}
.streak-emoji {
  font-size: 1.6rem;
}
.animate-bounce-slow {
  animation: bounce-slow 3s infinite;
}
@keyframes bounce-slow {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}
.animate-pulse-subtle {
  animation: pulse-subtle 4s infinite;
}
@keyframes pulse-subtle {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.95; }
}

/* ================= ACTIVITY PROGRESS BAR ================= */
.activity-progress-wrap {
  width: 100%;
}
.activity-progress-bg {
  width: 100%;
  height: 8px;
  background: #F1F5F9;
  border-radius: 99px;
  overflow: hidden;
}
.activity-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #FF9A44 0%, #FF6A00 100%);
  border-radius: 99px;
  transition: width 0.5s ease-out;
}

/* ================= CELEBRATION OVERLAY ================= */
.celebration-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.75);
  backdrop-filter: blur(12px);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.celebration-card {
  width: 100%;
  max-width: 420px;
  background: #FFFFFF;
  border-radius: 32px;
  padding: 32px 24px;
  text-align: center;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.2);
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.confetti-container {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 1;
}
.confetti-piece {
  position: absolute;
  top: -20px;
  border-radius: 2px;
  opacity: 0.8;
  animation: confetti-fall 3s linear infinite;
}
@keyframes confetti-fall {
  0% { transform: translateY(0) rotate(0deg); opacity: 1; }
  100% { transform: translateY(500px) rotate(720deg); opacity: 0; }
}
.trophy-wrapper {
  position: relative;
  width: 120px;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
  z-index: 2;
}
.trophy-pulse-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle, rgba(255, 106, 0, 0.4) 0%, transparent 70%);
  border-radius: 50%;
  animation: ai-pulse 2s infinite;
}
.trophy-circle {
  width: 90px;
  height: 90px;
  background: var(--primary-light);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 4px solid #FFE3D1;
  box-shadow: 0 10px 20px rgba(255, 106, 0, 0.15);
  z-index: 2;
  animation: trophy-spin-bounce 4s ease-in-out infinite;
}
@keyframes trophy-spin-bounce {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-8px) rotate(15deg); }
}
.celebration-title {
  font-size: 1.5rem;
  font-weight: 900;
  color: #0F172A;
  margin: 0 0 12px 0;
  z-index: 2;
}
.celebration-desc {
  font-size: 0.95rem;
  color: #64748B;
  margin: 0 0 20px 0;
  line-height: 1.5;
  z-index: 2;
}
.points-gain-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #ECFDF5;
  color: #059669;
  border: 1.5px solid #A7F3D0;
  font-size: 1.2rem;
  font-weight: 900;
  padding: 8px 20px;
  border-radius: 99px;
  margin-bottom: 20px;
  z-index: 2;
  box-shadow: 0 4px 10px rgba(5, 150, 105, 0.1);
}
.celebration-streak-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #FFF5F5;
  color: #E53E3E;
  border: 1.5px solid #FEE2E2;
  font-size: 0.95rem;
  padding: 6px 16px;
  border-radius: 99px;
  margin-bottom: 24px;
  z-index: 2;
}
.streak-fire-icon {
  font-size: 1.2rem;
}
.celebration-btn {
  width: 100%;
  background: linear-gradient(135deg, #FF9A44 0%, #FF6A00 100%);
  color: #FFFFFF;
  border: none;
  font-size: 1.1rem;
  font-weight: 800;
  padding: 14px;
  border-radius: 16px;
  cursor: pointer;
  box-shadow: 0 10px 20px rgba(255, 106, 0, 0.25);
  transition: all 0.2s ease;
  z-index: 2;
}
.celebration-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 24px rgba(255, 106, 0, 0.35);
}

/* Animations & Transitions */
.scale-fade-enter-active,
.scale-fade-leave-active {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.scale-fade-enter-from,
.scale-fade-leave-to {
  opacity: 0;
  transform: scale(0.9);
}
/* AI Input Integration */
.field-ai-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  padding-right: 12px;
  border-right: 1px solid #E2E8F0;
  margin-right: 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.field-ai-wrapper:hover {
  opacity: 0.8;
}
.field-ai-icon {
  color: var(--primary);
  width: 20px;
  height: 20px;
}
.ai-icon-spin {
  animation: ai-spin 2s linear infinite;
}
@keyframes ai-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.ai-status-hint {
  margin-top: 12px;
  font-size: 0.85rem;
  color: var(--primary);
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}
.mr-2 { margin-right: 0.5rem; }
/* ================= MEDIA QUERIES (Mobile) ================= */
@media (max-width: 768px) {
  /* ปรับ Padding แนวนอนให้ไม่ติดขอบ */
  .modern-list-view { padding: 12px 16px 100px 16px; background-color: #fff; }
  /* ส่วนบน Search และปุ่มกลับ */
  .top-actions-wrapper, .search-header, .px-mobile { padding: 0; }
  .search-header { margin-bottom: 16px; }
  .modern-search-box { padding: 0 16px; height: 38px; }
  .search-icon { width: 16px; height: 16px; }
  .modern-search-input { font-size: 0.9rem; }
  /* ปรับ Banner ให้เท่ากันทุกหน้าบนมือถือ */
  .modern-list-view .page-banner { margin: 0 0 24px; }
  .detail-view .page-banner { margin: 0 0 24px; }
  .page-banner { padding: 24px 20px; }
  .banner-text h2 { font-size: 1.4rem; }
  /* นำขอบโค้งและเส้นกรอบซ้ายขวาออก เพื่อให้ตีเต็มจอเป๊ะๆ */
  .activity-list-container { border-radius: 0; border: none; box-shadow: none; }
  /* จัดตำแหน่ง Row และเว้นระยะให้ตรงกับหน้าอันดับบาลาบิง */
  .activity-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    padding: 16px;
  }
  .ar-left {
    width: 100%;
    gap: 12px;
    margin-bottom: 4px;
  }
  .ar-middle { 
    width: 100%;
    padding-right: 0; 
    padding-left: 0; /* เอาเว้นระยะเดิมที่เผื่อไว้สำหรับดาวออกไปแล้วครับ */
  }
  .ar-subject { white-space: normal; overflow: visible; font-size: 0.95rem; }
  .layout-wrapper { padding: 0 16px; }
}
</style>
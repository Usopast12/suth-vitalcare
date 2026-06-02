// D:\Banana\src\composables\useMissions.ts
import { ref, computed, watch, onMounted, onUnmounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { authStore } from '../store/auth'
import { uiStore } from '../store/ui'
import { useSWR } from '../composables/useSWR'
import { swal, showError } from '../lib/swal'
import type { SmartTableColumn } from '../components/common/SmartTable.vue'

export interface Task {
    id: number
    event_id: number
    note: string
    type: string
    metric_type: string
    metric_unit: string
    points: number
    goal_type: string
    goal_value: number
    allowed_days: number[]
    is_active: boolean
    submission_type: string
    evt?: string
    start?: string
    end?: string
    use_ocr?: boolean | number | string
}

export interface Submission {
    id: number
    task_id: number
    value: number
    img_url: string
    status: 'pending' | 'approved' | 'rejected'
    created_at: string
    note?: string
    tasks?: {
        points: number
        note: string
    }
}

export interface Activity {
    id: number
    title: string
    start_date: string
    end_date: string
    poster?: string
    tasks: Task[]
}

export function useMissions() {
    const router = useRouter()
    const route = useRoute()

    // --- Constants ---
    const API_URL = (import.meta as any).env.VITE_API_URL || '/api'
    const MONTHS_THAI = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
    const SHORT_MONTHS_THAI = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
    const WEEKDAYS = [
        { id: 0, label: 'ทั้งหมด' },
        { id: 1, label: 'จ.' },
        { id: 2, label: 'อ.' },
        { id: 3, label: 'พ.' },
        { id: 4, label: 'พฤ.' },
        { id: 5, label: 'ศ.' },
        { id: 6, label: 'ส.' },
        { id: 7, label: 'อา.' }
    ]

    // --- Helpers (Hoisted) ---
    function getLocalYYYYMMDD(d: Date) {
        const year = d.getFullYear()
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
    }

    function formatDateDDMMYYYY(dateInput: Date | string) {
        if (!dateInput) return ''
        const d = new Date(dateInput)
        const day = String(d.getDate()).padStart(2, '0')
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const year = d.getFullYear() + 543
        return `${day}/${month}/${year}`
    }

    function formatThai(dateStr: string) {
        if (!dateStr) return ''
        const d = new Date(dateStr)
        return `${formatDateDDMMYYYY(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} น.`
    }

    const isToday = (d: any) => {
        if (!d) return false
        const date = new Date(d)
        const t = new Date()
        return (
            date.getDate() === t.getDate() &&
            date.getMonth() === t.getMonth() &&
            date.getFullYear() === t.getFullYear()
        )
    }

    // --- State ---
    const todayForPicker = new Date()
    const filterStartDate = ref(getLocalYYYYMMDD(todayForPicker))
    const filterEndDate = ref(getLocalYYYYMMDD(todayForPicker))
    const selectedWeekday = ref(0)
    const showFilterDropdown = ref(false)
    const filterStatus = ref<'all' | 'done' | 'pending' | 'none' | 'rejected'>('all')

    const activeTask = ref<Task | null>(null)
    const selectedDate = ref(new Date())
    const metricMode = ref<'number' | 'time' | 'steps' | 'photo_only' | 'tanita' | 'line'>('number')

    const valNum = ref('')
    const valSteps = ref('')
    const valH = ref('')
    const valM = ref('')
    const valS = ref('')

    const isSubmitting = ref(false)
    const uploadedImageUrl = ref('') // URL ที่แสดง preview (อาจเป็น temp upload ที่ยังไม่ submit)
    const originalUploadedImageUrl = ref('') // URL ที่บันทึกใน DB จริงๆ (ใช้เป็น target สำหรับลบ)
    const imageTimestamp = ref(Date.now())

    watch(uploadedImageUrl, () => {
        imageTimestamp.value = Date.now()
    })
    const editingSubmissionId = ref<number | null>(null)
    const submissionDate = ref('')
    const isUploading = ref(false)
    const fileInput = ref<HTMLInputElement | null>(null)

    const isAnalyzing = ref(false)
    const analyzingProgress = ref(0)
    const loadingMessages = [
        "กำลังอัปโหลดรูปภาพหลักฐาน...",
        "AI กำลังวิเคราะห์ข้อมูลภารกิจ...",
        "กำลังดึงค่าตัวเลขจากรูปภาพ...",
        "ตรวจสอบความถูกต้องของข้อมูล...",
        "เกือบเสร็จแล้ว รออีกนิดนะ..."
    ]
    const currentLoadingMessage = ref(loadingMessages[0])
    let messageInterval: any = null
    let progressInterval: any = null

    const showSummaryModal = ref(false)
    const summaryDate = ref(new Date())

    const windowWidth = ref(window.innerWidth)
    const showMobileDetail = ref(false)
    const expandedActivities = ref<Record<string, boolean>>({})
    const isEditingMode = ref(false)
    const showDetailModal = ref(false)
    const showCelebration = ref(false)
    const celebrationPoints = ref(0)
    const celebrationTaskTitle = ref('')
    const textResponse = ref('')
    const oldSubmissionValue = ref<string>('')
    const hasAIResult = ref(false) // flag: AI เพิ่งกรอกค่าใหม่ → ห้าม sync ค่าเก่าจาก DB ทับ

    const selectedTaskPerEvent = ref<Record<string, number>>({})

    // --- Data Fetching (SWR) ---
    const { data: swrAllActivities, mutate: mutateActs } = useSWR<Activity[]>(`${API_URL}/activities`)
    const { data: swrRegistrations, mutate: mutateRegs } = useSWR<any[]>(() => 
        authStore.user ? '/api/registrations/my' : null
    )
    const { data: swrSubmissions, mutate: mutateSubs } = useSWR<Submission[]>(() =>
        authStore.user ? `${API_URL}/mission/user/${authStore.user.id}` : null
    )
    const { data: swrProfile, mutate: mutateProfile } = useSWR<any>(() =>
        authStore.user ? `${API_URL}/users/${authStore.user.id}` : null
    )

    // --- Watchers ---
    watch(swrProfile, (nv) => {
        if (nv) authStore.setUser(nv)
    })
    // 💾 บันทึกรูปล่าสุดลง localStorage เผื่อเบราว์เซอร์มือถือ reload ตอนพับจอ
    watch([uploadedImageUrl, activeTask], () => {
        if (!activeTask.value) return
        const key = `vitalcare_pending_img_${activeTask.value.id}`
        const currentTempUrl = uploadedImageUrl.value
        const dbUrl = originalUploadedImageUrl.value
        if (currentTempUrl && currentTempUrl !== dbUrl) {
            localStorage.setItem(key, currentTempUrl)
        } else if (!currentTempUrl || currentTempUrl === dbUrl) {
            localStorage.removeItem(key)
        }
    })

    // จัดการกรณีรูปล้มเหลวในการโหลด (เช่น โดน Server Cron ลบไปแล้ว)
    const handleImageError = () => {
        if (uploadedImageUrl.value) {
            console.warn('[image-preview] Image not found (possibly deleted by cron). Clearing temp state.')
            uploadedImageUrl.value = ''
            if (activeTask.value) {
                localStorage.removeItem(`vitalcare_pending_img_${activeTask.value.id}`)
            }
        }
    }

    onMounted(() => {
        window.addEventListener('resize', () => windowWidth.value = window.innerWidth)
    })

    // 🔄 Real-time Sync
    watch(() => uiStore.lastRealtimeUpdate, () => {
        mutateActs()
        mutateSubs()
        mutateRegs()
        mutateProfile()
    })

    // 🔄 Sync active submission detail in real-time
    watch([swrSubmissions, activeTask, selectedDate], ([newSubs, task, date]) => {
        if (!task || !date || !newSubs) return

        const sub = newSubs.find(s => {
            const sd = new Date(s.created_at)
            return s.task_id === task.id &&
                sd.getDate() === date.getDate() &&
                sd.getMonth() === date.getMonth() &&
                sd.getFullYear() === date.getFullYear() &&
                s.status !== 'rejected'
        })

        if (sub) {
            // Only update if we are NOT in the middle of editing (to avoid wiping user input)
            // OR if the status changed (e.g. approved while viewing)
            const currentSub = newSubs.find(s => s.id === editingSubmissionId.value)
            const statusChanged = currentSub && sub.id === currentSub.id && sub.status !== currentSub.status
            const newSubmissionArrived = !editingSubmissionId.value && sub.id

            // ✅ ถ้า AI เพิ่งกรอกค่าใหม่ → ห้าม sync ค่าเก่าจาก DB ทับ
            if (hasAIResult.value && !statusChanged) return

            if ((newSubmissionArrived || statusChanged) && !isEditingMode.value) {
                editingSubmissionId.value = sub.id
                uploadedImageUrl.value = sub.img_url || ''
                originalUploadedImageUrl.value = sub.img_url || '' // ✅ sync รูปใน DB
                textResponse.value = (sub as any).text_response || ''
                submissionDate.value = sub.created_at || ''
                if (metricMode.value === 'time') {
                    valH.value = Math.floor(sub.value / 3600).toString()
                    valM.value = Math.floor((sub.value % 3600) / 60).toString()
                    valS.value = Math.floor(sub.value % 60).toString()
                    oldSubmissionValue.value = `${valH.value}h ${valM.value}m ${valS.value}s`
                } else if (metricMode.value === 'steps') {
                    valSteps.value = sub.value.toString()
                    oldSubmissionValue.value = sub.value.toString()
                } else {
                    valNum.value = sub.value.toString()
                    oldSubmissionValue.value = sub.value.toString()
                }
                
                // If it was just approved, stop editing mode
                if (sub.status === 'approved') {
                    isEditingMode.value = false
                }
            }
        } else {
            // If the submission we were looking at was deleted or rejected while viewing
            if (editingSubmissionId.value && !isEditingMode.value) {
                editingSubmissionId.value = null
                uploadedImageUrl.value = ''
                originalUploadedImageUrl.value = '' // ✅ reset เมื่อ submission ถูกลบ
                textResponse.value = ''
                isEditingMode.value = isToday(date) && isTaskAllowedOnDate(task, date)
            }
        }
    }, { deep: true })

    // --- Computed ---
    const isMobile = computed(() => windowWidth.value <= 820)

    const todayIdx = computed(() => {
        const d = new Date().getDay()
        return d === 0 ? 7 : d
    })

    const activities = computed(() => {
        if (!swrAllActivities.value || !swrRegistrations.value) return []
        const registeredIds = swrRegistrations.value.map((r: any) => r.id ?? r.event_id)
        return swrAllActivities.value.filter((a: any) => registeredIds.includes(a.id))
    })

    const userSubmissions = computed(() => swrSubmissions.value || [])

    const ALL_TASKS = computed(() => {
        const list = activities.value
        let res: any[] = []
        list.forEach(act => {
            let tks = []
            try {
                tks = typeof act.tasks === 'string' ? JSON.parse(act.tasks) : (act.tasks || [])
            } catch { tks = [] }

            if (Array.isArray(tks)) {
                tks.forEach(t => res.push({ 
                    ...t, 
                    activity_id: act.id, 
                    activity_title: act.title,
                    evt: act.title, // Keep compatibility with old field names
                    start: act.start_date,
                    end: act.end_date
                }))
            }
        })
        return res
    })

    const isOcrEnabled = computed(() => {
        if (!activeTask.value) return false
        return activeTask.value.use_ocr !== false && 
               activeTask.value.use_ocr !== 0 && 
               activeTask.value.use_ocr !== '0'
    })

    // ✅ Watch for task updates (Realtime Sync)
    watch(ALL_TASKS, (newTasks) => {
        if (activeTask.value) {
            const updated = newTasks.find(t => t.id === activeTask.value?.id)
            if (updated) {
                // Check if critical config changed to avoid unnecessary re-renders but ensure UI sync
                const configChanged = 
                    activeTask.value.submission_type !== updated.submission_type || 
                    activeTask.value.metric_type !== updated.metric_type ||
                    activeTask.value.note !== updated.note ||
                    (activeTask.value as any).activity_title !== updated.activity_title ||
                    activeTask.value.points !== updated.points;

                if (configChanged) {
                    activeTask.value = updated
                    
                    // Re-evaluate metricMode
                    const mt = (updated.metric_type || '').toLowerCase()
                    const st = (updated.submission_type || 'manual').toLowerCase()
                    if (st === 'sleep' || mt === 'time' || mt === 'duration') metricMode.value = 'time'
                    else if (st === 'tanita') metricMode.value = 'tanita'
                    else if (st === 'line') metricMode.value = 'line'
                    else if (mt === 'steps') metricMode.value = 'steps'
                    else metricMode.value = 'number'
                    
                    // Update editing mode based on new config
                    if (!editingSubmissionId.value) {
                        isEditingMode.value = isToday(selectedDate.value) && isTaskAllowedOnDate(updated, selectedDate.value)
                    }
                }
            } else {
                // 🚨 Task was deleted/deactivated while viewing detail
                closeDetailModal()
                swal.fire({
                    icon: 'warning',
                    title: 'ภารกิจนี้ไม่สามารถใช้งานได้แล้ว ⚠️',
                    text: 'ภารกิจนี้ถูกลบหรือถูกปิดการใช้งานโดยผู้ดูแลระบบ ข้อมูลของคุณจะถูกอัปเดตอัตโนมัติ',
                    confirmButtonText: 'รับทราบ',
                    confirmButtonColor: '#356768'
                })
            }
        }
    }, { deep: true })

    watch(ALL_TASKS, (newTasks) => {
        newTasks.forEach(task => {
            const evtName = task.evt || 'กิจกรรมทั่วไป'
            if (!selectedTaskPerEvent.value[evtName]) {
                selectedTaskPerEvent.value[evtName] = task.id
            }
        })
    }, { immediate: true, deep: true })

    // --- Table & Filtering Logic ---
    function getAllowedDays(task: Task): number[] {
        const raw = task.allowed_days
        if (!raw) return []
        if (Array.isArray(raw)) return raw
        try { return JSON.parse(raw as unknown as string) } catch { return [] }
    }

    function isTaskAllowedOnDate(task: Task | null, date: Date) {
        if (!task) return false
        const days = getAllowedDays(task)
        if (days.length === 0 || days.length === 7) return true
        const jsDay = date.getDay()
        const appDay = jsDay === 0 ? 7 : jsDay
        return days.includes(appDay)
    }

    function getDayTag(task: Task) {
        const days = getAllowedDays(task)
        if (days.length === 7) return 'ทุกวัน'
        return days.map(d => {
            const w = WEEKDAYS.find(wd => wd.id === (d === 0 ? 7 : d))
            return w ? w.label.replace('.', '') : ''
        }).join(', ')
    }

    const tableColumns = computed<SmartTableColumn[]>(() => [
        { key: 'dateLabel', label: 'วันที่', sortable: true, width: '110px' },
        { key: 'evt', label: 'กิจกรรม', sortable: true },
        { key: 'taskName', label: 'สิ่งที่ต้องส่ง', sortable: false },
        { key: 'allowedDays', label: 'วันที่ทำได้', sortable: false, width: '130px' },
        { key: 'points', label: 'คะแนน', sortable: true, align: 'center', width: '90px' },
        { key: 'statusText', label: 'สถานะ', sortable: true, align: 'center', width: '110px' }
    ])

    function getDatesInRange(startStr: string, endStr: string, appWeekdayId: number): Date[] {
        const dates: Date[] = []
        if (!startStr || !endStr) return dates

        let start = new Date(startStr)
        let end = new Date(endStr)
        start.setHours(0, 0, 0, 0)
        end.setHours(23, 59, 59, 999)
        if (start > end) return dates

        const jsTargetDay = appWeekdayId === 7 ? 0 : appWeekdayId
        let current = new Date(start)

        while (current <= end) {
            if (appWeekdayId === 0 || current.getDay() === jsTargetDay) {
                dates.push(new Date(current))
            }
            current.setDate(current.getDate() + 1)
        }
        return dates
    }

    const tableData = computed(() => {
        let datesToProcess = getDatesInRange(filterStartDate.value, filterEndDate.value, selectedWeekday.value)
        const today = new Date()
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())

        const groups = new Map<string, Task[]>()
        ALL_TASKS.value.forEach(t => {
            const evtName = t.evt || 'กิจกรรมทั่วไป'
            if (!groups.has(evtName)) groups.set(evtName, [])
            groups.get(evtName)!.push(t)
        })

        const rows: any[] = []

        datesToProcess.forEach(targetDate => {
            const targetDayJS = targetDate.getDay()
            const targetDayApp = targetDayJS === 0 ? 7 : targetDayJS
            const dateStr = formatDateDDMMYYYY(targetDate)
            const compareDateStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate())

            groups.forEach((tasks, evtName) => {
                const evtStart = tasks[0].start ? new Date(tasks[0].start) : new Date(0)
                const evtEnd = tasks[0].end ? new Date(tasks[0].end) : new Date(8640000000000000)
                evtStart.setHours(0, 0, 0, 0)
                evtEnd.setHours(23, 59, 59, 999)

                if (targetDate < evtStart || targetDate > evtEnd) return

                const allowedTasksOnThisDay = tasks.filter(t => {
                    const days = getAllowedDays(t)
                    return days.length === 7 || days.includes(targetDayApp)
                })

                allowedTasksOnThisDay.forEach(task => {
                    const subsToday = userSubmissions.value.filter(s => {
                        const sd = new Date(s.created_at)
                        return s.task_id === task.id &&
                            sd.getDate() === targetDate.getDate() &&
                            sd.getMonth() === targetDate.getMonth() &&
                            sd.getFullYear() === targetDate.getFullYear()
                    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

                    const latestSub = subsToday[0]
                    const hasSub = subsToday.some(s => s.status !== 'rejected')
                    const isRejected = latestSub && latestSub.status === 'rejected'

                    let statusCode = 'none'
                    let statusText = 'รอส่ง'

                    if (compareDateStart > todayStart) {
                        statusCode = 'none'
                        statusText = 'ยังไม่ถึงเวลา'
                    } else if (compareDateStart < todayStart) {
                        if (isRejected) {
                            statusCode = 'rejected'
                            statusText = 'ไม่ผ่าน (หมดเวลา)'
                        } else if (hasSub) {
                            statusCode = 'done'
                            statusText = 'ส่งแล้ว'
                        } else {
                            statusCode = 'none'
                            statusText = 'หมดเวลาส่ง'
                        }
                    } else {
                        if (isRejected) {
                            statusCode = 'rejected'
                            statusText = 'ไม่ผ่าน (ต้องแก้)'
                        } else if (hasSub) {
                            statusCode = 'done'
                            statusText = 'ส่งแล้ว'
                        } else {
                            statusCode = 'pending'
                            statusText = 'รอส่ง'
                        }
                    }

                    rows.push({
                        id: `${evtName}_${dateStr}_${task.id}`,
                        evt: evtName,
                        task: task,
                        date: targetDate,
                        dateLabel: dateStr,
                        taskName: task.note,
                        allowedDays: getDayTag(task),
                        points: task.points,
                        statusText,
                        statusCode,
                        sub: latestSub
                    })
                })
            })
        })

        rows.sort((a, b) => a.date.getTime() - b.date.getTime())
        return rows
    })

    const filteredTableData = computed(() => {
        if (filterStatus.value === 'all') return tableData.value
        return tableData.value.filter(r => r.statusCode === filterStatus.value)
    })

    // --- Interaction & Event Handlers ---
    const handleManage = (row: any) => {
        const subsToday = userSubmissions.value.filter(s => {
            const sd = new Date(s.created_at)
            return s.task_id === row.task.id &&
                sd.getDate() === row.date.getDate() &&
                sd.getMonth() === row.date.getMonth() &&
                sd.getFullYear() === row.date.getFullYear()
        }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

        const latestSub = subsToday[0]

        if (latestSub && latestSub.status === 'rejected') {
            swal.fire({
                icon: 'warning',
                title: 'ภารกิจไม่ผ่านการอนุมัติ ❌',
                text: latestSub.note ? `เหตุผล: ${latestSub.note}\n\nกรุณาส่งหลักฐานใหม่อีกครั้ง` : 'กรุณาส่งหลักฐานการทำภารกิจใหม่อีกครั้ง',
                confirmButtonText: 'รับทราบและแก้ไข',
                confirmButtonColor: '#ef4444'
            }).then(() => {
                handleInstanceSelect({ task: row.task, date: row.date })
                showDetailModal.value = true
            })
        } else {
            handleInstanceSelect({ task: row.task, date: row.date })
            showDetailModal.value = true
        }
    }

    const closeDetailModal = () => {
        showDetailModal.value = false
        activeTask.value = null
        hasAIResult.value = false
        oldSubmissionValue.value = ''
    }

    // ✅ ยกเลิกการแก้ไข: restore ค่าเดิมจาก DB กลับเข้า input และ clear AI flag
    function cancelEditing() {
        hasAIResult.value = false
        isEditingMode.value = false

        // Restore ค่าจาก oldSubmissionValue กลับ input
        // (oldSubmissionValue ถูก set ตอน handleInstanceSelect จาก sub.value)
        const sub = userSubmissions.value.find(s => s.id === editingSubmissionId.value)
        if (sub) {
            if (metricMode.value === 'time') {
                valH.value = Math.floor(sub.value / 3600).toString()
                valM.value = Math.floor((sub.value % 3600) / 60).toString()
                valS.value = Math.floor(sub.value % 60).toString()
            } else if (metricMode.value === 'steps') {
                valSteps.value = sub.value.toString()
            } else {
                valNum.value = sub.value.toString()
            }
            uploadedImageUrl.value = sub.img_url || ''
        }
    }

    function handleInstanceSelect(item: any) {
        const isSameTask = activeTask.value?.id === item.task.id

        // ถ้า AI เพิ่งกรอกค่าใหม่สำเร็จ และยังอยู่ที่ task เดิม → ห้าม reset ค่า input
        if (isSameTask && hasAIResult.value) {
            // อัปเดต task reference เฉยๆ แต่ไม่รีเซ็ตค่า
            activeTask.value = item.task
            if (isMobile.value) showMobileDetail.value = true
            return
        }

        // Task เปลี่ยน → clear AI result flag
        hasAIResult.value = false
        oldSubmissionValue.value = ''

        activeTask.value = item.task
        selectedDate.value = item.date

        if (item.task.evt) {
            selectedTaskPerEvent.value[item.task.evt] = item.task.id
        }

        const mt = (item.task.metric_type || '').toLowerCase()
        const st = (item.task.submission_type || 'manual').toLowerCase()

        if (st === 'sleep' || mt === 'time' || mt === 'duration') metricMode.value = 'time'
        else if (st === 'tanita') metricMode.value = 'tanita'
        else if (st === 'line') metricMode.value = 'line'
        else if (mt === 'steps') metricMode.value = 'steps'
        else metricMode.value = 'number'

        valNum.value = valSteps.value = valH.value = valM.value = valS.value = ''
        uploadedImageUrl.value = ''
        originalUploadedImageUrl.value = '' // Reset ทุกครั้งที่เปิด task ใหม่
        textResponse.value = ''
        editingSubmissionId.value = null
        submissionDate.value = ''

        const sub = userSubmissions.value.find(s => {
            const sd = new Date(s.created_at)
            return s.task_id === item.task.id &&
                sd.getDate() === item.date.getDate() &&
                sd.getMonth() === item.date.getMonth() &&
                sd.getFullYear() === item.date.getFullYear() &&
                s.status !== 'rejected'
        })

        // ดึงรูปล่าสุดจาก localStorage เผื่อผู้ใช้พับจอแล้วกลับมา
        const pendingImgKey = `vitalcare_pending_img_${item.task.id}`
        const pendingImg = localStorage.getItem(pendingImgKey)

        if (sub) {
            editingSubmissionId.value = sub.id
            originalUploadedImageUrl.value = sub.img_url || '' // ✅ บันทึก URL ที่อยู่ใน DB จริงๆ
            // ถ้ารูป pending มี ให้ใช้รูป pending (แปลว่า user กำลัง edit รูปอยู่แต่พับจอ)
            uploadedImageUrl.value = pendingImg || sub.img_url || ''
            if (pendingImg && pendingImg !== sub.img_url) {
                isEditingMode.value = true // เปิดโหมด edit อัตโนมัติถ้ามีรูปค้าง
            } else {
                isEditingMode.value = false
            }

            textResponse.value = (sub as any).text_response || ''
            submissionDate.value = sub.created_at || ''
            if (metricMode.value === 'time') {
                valH.value = Math.floor(sub.value / 3600).toString()
                valM.value = Math.floor((sub.value % 3600) / 60).toString()
                valS.value = Math.floor(sub.value % 60).toString()
                oldSubmissionValue.value = `${valH.value}h ${valM.value}m ${valS.value}s`
            } else if (metricMode.value === 'steps') {
                valSteps.value = sub.value.toString()
                oldSubmissionValue.value = sub.value.toString()
            } else {
                valNum.value = sub.value.toString()
                oldSubmissionValue.value = sub.value.toString()
            }
        } else {
            isEditingMode.value = isToday(item.date) && isTaskAllowedOnDate(item.task, item.date)
            if (pendingImg) {
                uploadedImageUrl.value = pendingImg
            }
        }
        if (isMobile.value) showMobileDetail.value = true
    }

    const tasksForSelectedDateAndEvent = computed(() => {
        if (!activeTask.value || !selectedDate.value) return []
        const targetDay = selectedDate.value.getDay()
        return ALL_TASKS.value.filter(t => {
            const days = getAllowedDays(t)
            const allowed = days.length === 7 || days.includes(targetDay) || (targetDay === 0 && days.includes(7))
            return t.evt === activeTask.value?.evt && allowed
        }).map(t => {
            const hasSub = userSubmissions.value.some(s => {
                const sd = new Date(s.created_at)
                return s.task_id === t.id &&
                    sd.getDate() === selectedDate.value.getDate() &&
                    sd.getMonth() === selectedDate.value.getMonth() &&
                    sd.getFullYear() === selectedDate.value.getFullYear() &&
                    s.status !== 'rejected'
            })
            return { ...t, isSubmitted: hasSub }
        })
    })


    function onTaskDropdownChange(e: Event) {
        const targetId = Number((e.target as HTMLSelectElement).value)
        const foundTask = ALL_TASKS.value.find(t => t.id === targetId)
        if (foundTask) {
            handleInstanceSelect({ task: foundTask, date: selectedDate.value })
        }
    }

    // Monitor deep-link or query selection
    watch([ALL_TASKS, () => route.query.taskId, swrProfile], ([allTasks, tid, profile]) => {
        if (allTasks.length > 0 && tid) {
            const targetId = Number(tid)
            const targetTask = allTasks.find(t => t.id === targetId)

            if (targetTask) {
                handleInstanceSelect({ task: targetTask, date: new Date() })
                showDetailModal.value = true

                if (profile && profile.pending_bot_result && profile.last_bot_task_id === targetId) {
                    setTimeout(() => {
                        const botData = typeof profile.pending_bot_result === 'string'
                            ? JSON.parse(profile.pending_bot_result)
                            : profile.pending_bot_result

                        uploadedImageUrl.value = botData.publicUrl || ''
                        originalUploadedImageUrl.value = botData.publicUrl || ''
                        if (botData.type === 'RUNNING') {
                            if (metricMode.value === 'steps') valSteps.value = String(botData.distance || '')
                            else valNum.value = String(botData.distance || '')
                        } else if (botData.type === 'TANITA') {
                            valNum.value = String(botData.weight || '')
                        }
                        isEditingMode.value = true
                        
                        // แจ้งเตือนให้ผู้ใช้ตรวจสอบความถูกต้อง
                        swal.fire({
                            icon: 'info',
                            title: 'ตรวจสอบข้อมูลจาก AI',
                            text: 'บอทได้กรอกข้อมูลเบื้องต้นที่วิเคราะห์ได้ให้แล้ว กรุณาตรวจสอบความถูกต้องอีกครั้งก่อนกดยืนยันครับ',
                            confirmButtonText: 'ตกลง',
                            confirmButtonColor: '#06C755'
                        })
                    }, 100)
                }
            }
        }
    }, { immediate: true })

    function getTaskDetails(taskId: number) {
        return ALL_TASKS.value.find(t => t.id === taskId) || null
    }

    // --- File & Submission Logic ---
    // ✅ Pattern มาตรฐาน: แยก "รูปใน DB" (originalUploadedImageUrl) กับ "รูป preview ชั่วคราว" (uploadedImageUrl)
    // - originalUploadedImageUrl = URL ที่บันทึกใน DB จริงๆ → ลบเมื่อ submit สำเร็จ (หรือเมื่ออัปโหลดรูปครั้งแรกของ session นี้)
    // - uploadedImageUrl = URL ที่แสดงบน UI → อาจเป็น temp upload ที่ยังไม่ submit
    // - ถ้า user เปลี่ยนรูปซ้ำก่อน submit: ลบรูป temp ก่อนหน้า (uploadedImageUrl) ไม่ใช่รูปใน DB
    async function handleFileUpload(event: Event) {
        const target = event.target as HTMLInputElement
        if (!target.files?.length) return
        const file = target.files[0]

        // Start AI UX immediately to show loading overlay (only if OCR is enabled)
        if (isOcrEnabled.value) {
            startAIUX()
            if (isEditingMode.value) {
                // Clear old values so they don't get stuck if AI fails
                valNum.value = valSteps.value = valH.value = valM.value = valS.value = ''
            }
        }

        isUploading.value = true
        
        try {
            const taskLabel = activeTask.value?.note?.trim() || activeTask.value?.type || 'mission'
            const params = new URLSearchParams({ type: 'submissions', name: taskLabel })

            // ✅ Logic การลบรูปเก่า:
            // - ถ้า uploadedImageUrl != originalUploadedImageUrl → user เคยอัปโหลด temp ไว้แล้ว → ลบ temp นั้น
            // - ถ้า uploadedImageUrl == originalUploadedImageUrl (รูป DB) → ไม่ลบตอนนี้ (จะลบหลัง submit สำเร็จ)
            //   เพราะรูป DB ยังต้องแสดงผลจนกว่าจะ submit ใหม่สำเร็จ
            const hasTempUpload = uploadedImageUrl.value && uploadedImageUrl.value !== originalUploadedImageUrl.value
            if (hasTempUpload) {
                // ลบ temp upload ก่อนหน้า (user เปลี่ยนรูปโดยไม่ได้ submit)
                params.append('oldUrl', uploadedImageUrl.value)
                console.log('[upload:cleanup-temp]', { tempUrl: uploadedImageUrl.value })
            }

            const formData = new FormData()
            formData.append('image', file)
            console.log('[upload:mission:start]', {
                taskLabel,
                taskId: activeTask.value?.id,
                fileName: file.name,
                fileType: file.type,
                fileSize: file.size,
                endpoint: `/api/upload?${params}`,
                userId: authStore.user?.id ?? '',
                originalUrl: originalUploadedImageUrl.value,
                currentTempUrl: hasTempUpload ? uploadedImageUrl.value : null,
            })

            const uploadRes = await fetch(`/api/upload?${params}`, {
                method: 'POST',
                headers: { 'x-user-id': String(authStore.user?.id ?? '') },
                body: formData,
            })
            if (!uploadRes.ok) {
                const err = await uploadRes.json().catch(() => ({}))
                console.error('[upload:mission:failed]', {
                    status: uploadRes.status,
                    statusText: uploadRes.statusText,
                    error: err,
                })
                throw new Error(err.error || `Upload failed (${uploadRes.status})`)
            }
            const { url } = await uploadRes.json()
            console.log('[upload:mission:success]', { url })
            // ✅ อัปเดต preview URL แต่ originalUploadedImageUrl ยังคงเป็นรูปใน DB จนกว่าจะ submit สำเร็จ
            uploadedImageUrl.value = url

            // Auto-trigger AI analysis after upload (skip if OCR is disabled)
            if (metricMode.value !== 'photo_only' && isOcrEnabled.value) {
                await handleAIAnalysis(true)
            } else {
                stopAIUX(true)
            }
        } catch (e) {
            console.error('[UPLOAD] Error:', e)
            stopAIUX(false)
        } finally {
            isUploading.value = false
            target.value = ''
        }
    }

    async function submitTask() {
        if (!activeTask.value || isSubmitting.value) return
        isSubmitting.value = true

        try {
            const submissionType = activeTask.value.submission_type || 'manual'
            const isTextOnly = submissionType === 'text'
            const isPhotoOnly = submissionType === 'photo'
            const isBoth = submissionType === 'both'

            let val = 0
            if (metricMode.value === 'time') val = (parseInt(valH.value) || 0) * 3600 + (parseInt(valM.value) || 0) * 60 + (parseInt(valS.value) || 0)
            else if (metricMode.value === 'steps') val = parseInt(valSteps.value) || 0
            else val = parseFloat(valNum.value) || 0

            if (val < 0) return showError('ไม่สามารถกรอกค่าที่ติดลบได้')

            // Text-only: validate text response
            if (isTextOnly) {
                if (!textResponse.value.trim()) return showError('กรุณาพิมพ์ข้อความตอบกลับก่อนส่ง')
                await proceedSubmit(0, true)
                return
            }

            // Photo-only: validate photo
            if (isPhotoOnly) {
                if (!uploadedImageUrl.value) return showError('กรุณาอัปโหลดรูปภาพก่อนส่ง')
                await proceedSubmit(val > 0 ? val : 1, true)
                return
            }

            // Both: must have at least photo or text
            if (isBoth) {
                if (!uploadedImageUrl.value && !textResponse.value.trim()) {
                    return showError('กรุณาอัปโหลดรูปภาพ หรือพิมพ์ข้อความอย่างน้อยหนึ่งอย่าง')
                }
                await proceedSubmit(val > 0 ? val : 1, true)
                return
            }

            const unit = (activeTask.value.metric_unit || '').toLowerCase()

            // 1. ตรวจสอบจำนวนก้าว (Max 100,000 ก้าว)
            if (metricMode.value === 'steps') {
                if (val > 100000) return showError('จำนวนก้าวสูงเกินขีดจำกัดมนุษย์ (สูงสุด 100,000 ก้าว/วัน)')
                if (val > 50000) {
                    const res = await swal.fire({
                        icon: 'warning',
                        title: 'จำนวนก้าวสูงผิดปกติ?',
                        text: `คุณส่ง ${val.toLocaleString()} ก้าว ซึ่งสูงมากสำหรับ 1 วัน โปรดตรวจสอบความถูกต้อง`,
                        showCancelButton: true,
                        confirmButtonText: 'ยืนยันข้อมูล',
                        cancelButtonText: 'แก้ไขข้อมูล',
                        confirmButtonColor: '#356768'
                    })
                    if (!res.isConfirmed) return
                }
            }

            // 2. ตรวจสอบระยะเวลา (Max 24 ชม.)
            if (metricMode.value === 'time' && val > 86400) return showError('ระยะเวลาไม่สามารถเกิน 24 ชม. ได้')

            // 3. ตรวจสอบระยะทาง (Max 100 กม.)
            if (unit === 'กม.' || unit === 'km') {
                if (val > 100) return showError('ระยะทางสูงเกินขีดจำกัด (สูงสุด 100 กม./วัน)')
            }

            // 4. ตรวจสอบแคลอรี่ (Max 10,000 kcal)
            if (unit === 'แคลอรี่' || unit === 'kcal') {
                if (val > 10000) return showError('แคลอรี่สูงเกินขีดจำกัด (สูงสุด 10,000 kcal/วัน)')
            }

            // 5. ตรวจสอบค่าทั่วไป (Max 50,000)
            if (metricMode.value === 'number' && val > 50000 && unit !== 'แคลอรี่' && unit !== 'kcal') {
                return showError('ค่าที่กรอกสูงเกินไป โปรดตรวจสอบหน่วยและตัวเลขอีกครั้ง')
            }

            if (val === 0 && metricMode.value !== 'photo_only') {
                const res = await swal.fire({
                    icon: 'question',
                    title: 'ยืนยันค่าเป็น 0?',
                    text: 'คุณกำลังจะบันทึกค่าเป็น 0 ยืนยันหรือไม่?',
                    showCancelButton: true,
                    confirmButtonText: 'ยืนยัน',
                    cancelButtonText: 'ยกเลิก',
                    confirmButtonColor: '#356768'
                })
                if (res.isConfirmed) await proceedSubmit(val, true)
            } else {
                await proceedSubmit(val, true)
            }
        } finally {
            isSubmitting.value = false
        }
    }

    async function proceedSubmit(val: number, skipGuard: boolean = false) {
        if (!activeTask.value || (!skipGuard && isSubmitting.value)) return
        
        if (!isToday(selectedDate.value)) {
            return showError('คุณสามารถส่งได้เฉพาะภารกิจของวันนี้เท่านั้น')
        }
        
        if (!skipGuard) isSubmitting.value = true
        uiStore.setLoading(true)
        try {
            const url = editingSubmissionId.value ? `${API_URL}/mission/submission/${editingSubmissionId.value}` : `${API_URL}/mission/submit`
            const res = await fetch(url, {
                method: editingSubmissionId.value ? 'PATCH' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': String(authStore.user.id)
                },
                body: JSON.stringify({
                    userId: authStore.user.id, taskId: activeTask.value.id, value: val, imageUrl: uploadedImageUrl.value,
                    textResponse: textResponse.value || null,
                    activity_type: activeTask.value.type, proof_type: activeTask.value.submission_type,
                    backfill_date: selectedDate.value.toISOString()
                })
            })
            if (res.ok) {
                // ✅ Submit สำเร็จ: ถึงเวลาลบรูปเก่าใน DB (originalUploadedImageUrl)
                // ทำหลัง submit สำเร็จ เพื่อให้มั่นใจว่ารูปใหม่บันทึกใน DB แล้ว
                const dbImageToDelete = originalUploadedImageUrl.value
                const newImageUrl = uploadedImageUrl.value
                if (
                    dbImageToDelete &&
                    dbImageToDelete !== newImageUrl &&
                    dbImageToDelete.startsWith('/uploads/')
                ) {
                    fetch('/api/upload', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json', 'x-user-id': String(authStore.user?.id ?? '') },
                        body: JSON.stringify({ oldUrl: dbImageToDelete })
                    }).then(() => {
                        console.log('[upload:cleanup-db-old:success]', { deletedUrl: dbImageToDelete })
                    }).catch((err) => {
                        console.warn('[upload:cleanup-db-old:failed]', { err })
                    })
                }
                originalUploadedImageUrl.value = newImageUrl
                
                if (activeTask.value) {
                    localStorage.removeItem(`vitalcare_pending_img_${activeTask.value.id}`)
                }

                mutateActs(); mutateSubs(); mutateProfile()
                celebrationPoints.value = activeTask.value?.points ?? 0
                celebrationTaskTitle.value = activeTask.value?.note || 'ภารกิจ'
                showCelebration.value = true
                swal.fire({
                    icon: 'success',
                    title: 'บันทึกสำเร็จ!',
                    text: 'ภารกิจของคุณได้รับการบันทึกเรียบร้อยแล้ว',
                    timer: 3000,
                    showConfirmButton: true,
                    confirmButtonText: 'ตกลง',
                    confirmButtonColor: '#356768',
                    background: '#ffffff',
                    iconColor: '#10b981'
                })
                isEditingMode.value = false
                hasAIResult.value = false
                oldSubmissionValue.value = ''
                showDetailModal.value = false
                activeTask.value = null
            } else {
                showError('ไม่สามารถบันทึกได้ โปรดลองอีกครั้ง')
            }
        } catch (e) {
            showError('เกิดข้อผิดพลาดในการเชื่อมต่อ')
        } finally {
            isSubmitting.value = false
            uiStore.setLoading(false)
        }
    }

    function formatSubValue(sub: Submission) {
        const task = getTaskDetails(sub.task_id)
        if (!task) return sub.value.toLocaleString()

        const mt = (task.metric_type || '').toLowerCase()
        const st = (task.submission_type || 'manual').toLowerCase()
        let mode = 'number'

        if (st === 'sleep' || mt === 'time' || mt === 'duration') mode = 'time'
        else if (mt === 'steps') mode = 'steps'

        if (mode === 'time') {
            const h = Math.floor(sub.value / 3600)
            const m = Math.floor((sub.value % 3600) / 60)
            if (h > 0 && m > 0) return `${h} ชม. ${m} นาที`
            if (h > 0) return `${h} ชม.`
            return `${m} นาที`
        } else if (mode === 'steps') {
            return `${sub.value.toLocaleString()} ก้าว`
        }
        return `${sub.value.toLocaleString()} ${task.metric_unit || ''}`.trim()
    }

    const totalPoints = computed(() =>
        userSubmissions.value.filter(s => s.status === 'approved').reduce((sum, s) => sum + (s.tasks?.points || 0), 0)
    )

    // --- AI UX Helpers ---
    const startAIUX = () => {
        isAnalyzing.value = true
        analyzingProgress.value = 0
        let msgIdx = 0
        currentLoadingMessage.value = loadingMessages[0]
        messageInterval = setInterval(() => {
            msgIdx = (msgIdx + 1) % loadingMessages.length
            currentLoadingMessage.value = loadingMessages[msgIdx]
        }, 3500)
        progressInterval = setInterval(() => {
            if (analyzingProgress.value < 60) analyzingProgress.value += Math.random() * 10
            else if (analyzingProgress.value < 85) analyzingProgress.value += Math.random() * 3
            else if (analyzingProgress.value < 95) analyzingProgress.value += Math.random() * 0.5
            if (analyzingProgress.value > 95) analyzingProgress.value = 95
        }, 400)
    }

    const stopAIUX = (success = true) => {
        if (messageInterval) clearInterval(messageInterval)
        if (progressInterval) clearInterval(progressInterval)
        if (success) {
            analyzingProgress.value = 100
            setTimeout(() => { isAnalyzing.value = false }, 800)
        } else {
            isAnalyzing.value = false
        }
    }

    async function handleAIAnalysis(skipUX = false) {
        if (!uploadedImageUrl.value || !activeTask.value || !authStore.user) return
        if (!skipUX) startAIUX()
        try {
            const res = await fetch(`${API_URL}/ai/analyze-mission`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': String(authStore.user.id)
                },
                body: JSON.stringify({
                    imageUrl: uploadedImageUrl.value,
                    taskTitle: activeTask.value.note || activeTask.value.type,
                    metricType: activeTask.value.type,
                    metricUnit: activeTask.value.metric_unit,
                    userId: authStore.user.id
                })
            })

            if (res.ok) {
                const data = await res.json()
                if (data.isRelated && data.value) {
                    if (metricMode.value === 'steps') {
                        valSteps.value = String(parseInt(data.value) || '')
                    } else if (metricMode.value === 'time') {
                        if (typeof data.value === 'string' && data.value.includes(':')) {
                            const parts = data.value.split(':')
                            valH.value = parts[0] || '0'
                            valM.value = parts[1] || '0'
                            valS.value = parts[2] || '0'
                        } else {
                            const seconds = parseInt(data.value) || 0
                            valH.value = Math.floor(seconds / 3600).toString()
                            valM.value = Math.floor((seconds % 3600) / 60).toString()
                            valS.value = (seconds % 60).toString()
                        }
                    } else {
                        valNum.value = String(data.value || '')
                    }

                    // ✅ ตั้ง flag กันค่า AI หายเมื่อ user ไป tab อื่นแล้วกลับมา
                    hasAIResult.value = true

                    swal.fire({
                        icon: 'success',
                        title: 'AI วิเคราะห์ข้อมูลสำเร็จ',
                        text: `ระบบตรวจพบค่า ${data.value} ${activeTask.value.metric_unit || ''}${data.reason ? ` (${data.reason})` : ''}\n\nกรุณาตรวจสอบความถูกต้องอีกครั้งก่อนบันทึกครับ`,
                        confirmButtonText: 'ตกลง',
                        confirmButtonColor: '#06C755'
                    })
                } else {
                    swal.fire({
                        icon: 'warning',
                        title: 'AI ไม่สามารถระบุข้อมูลจากรูปภาพ',
                        text: data.reason || 'กรุณากรอกข้อมูลดัวยตนเอง หรือลองอัปโหลดรูปที่ชัดเจนกว่านี้',
                        confirmButtonText: 'ตกลง',
                        confirmButtonColor: '#356768'
                    })
                }
            } else {
                console.error('[AI_ANALYSIS] API Error:', res.status)
            }
        } catch (e) {
            console.error("[AI_ANALYSIS] Exception:", e)
        } finally {
            stopAIUX(true)
        }
    }

    // --- Summary Methods ---
    const summaryMonthSubmissions = computed(() => {
        return userSubmissions.value.filter(s => {
            if (s.status !== 'approved') return false
            const d = new Date(s.created_at)
            return d.getMonth() === summaryDate.value.getMonth() && d.getFullYear() === summaryDate.value.getFullYear()
        }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    })

    const summaryTotalPoints = computed(() => {
        return summaryMonthSubmissions.value.reduce((sum, s) => {
            const pts = getTaskDetails(s.task_id)?.points || s.tasks?.points || 0
            return sum + pts
        }, 0)
    })

    const summaryTotalTasks = computed(() => summaryMonthSubmissions.value.length)

    const groupedSummarySubmissions = computed(() => {
        const groups = new Map<string, Submission[]>()
        summaryMonthSubmissions.value.forEach(sub => {
            const dateStr = formatDateDDMMYYYY(sub.created_at)
            if (!groups.has(dateStr)) groups.set(dateStr, [])
            groups.get(dateStr)!.push(sub)
        })
        return Array.from(groups.entries()).map(([date, items]) => ({ date, items }))
    })

    function prevMonth() {
        summaryDate.value = new Date(summaryDate.value.getFullYear(), summaryDate.value.getMonth() - 1, 1)
    }
    function nextMonth() {
        summaryDate.value = new Date(summaryDate.value.getFullYear(), summaryDate.value.getMonth() + 1, 1)
    }
    function openSummary() {
        summaryDate.value = new Date()
        showSummaryModal.value = true
    }

    // --- Real-time Sync ---
    let fetchTimeout: any = null;
    watch(() => uiStore.lastRealtimeUpdate, () => {
        if (fetchTimeout) clearTimeout(fetchTimeout);
        fetchTimeout = setTimeout(() => {
            mutateSubs();   // Refresh submissions
            mutateActs();   // Refresh activities/tasks
            mutateProfile(); // Refresh profile/points
            console.log('[REALTIME] useMissions data refreshed');
        }, 1000);
    });

    // --- Return Objects (Expose to Template) ---
    return {
        router,
        route,
        API_URL,
        MONTHS_THAI,
        SHORT_MONTHS_THAI,
        WEEKDAYS,
        selectedWeekday,
        showFilterDropdown,
        filterStartDate,
        filterEndDate,
        todayIdx,
        activeTask,
        selectedDate,
        metricMode,
        valNum,
        valSteps,
        valH,
        valM,
        valS,
        isSubmitting,
        uploadedImageUrl,
        handleImageError,
        editingSubmissionId,
        submissionDate,
        isUploading,
        fileInput,
        isAnalyzing,
        analyzingProgress,
        loadingMessages,
        currentLoadingMessage,
        showSummaryModal,
        summaryDate,
        windowWidth,
        isMobile,
        showMobileDetail,
        expandedActivities,
        isEditingMode,
        showDetailModal,
        showCelebration,
        celebrationPoints,
        celebrationTaskTitle,
        textResponse,
        oldSubmissionValue,
        selectedTaskPerEvent,
        formatDateDDMMYYYY,
        formatThai,
        swrAllActivities,
        mutateActs,
        swrRegistrations,
        swrSubmissions,
        mutateSubs,
        swrProfile,
        mutateProfile,
        activities,
        userSubmissions,
        ALL_TASKS,
        getAllowedDays,
        getDayTag,
        tableColumns,
        getDatesInRange,
        tableData,
        filterStatus,
        filteredTableData,
        handleManage,
        closeDetailModal,
        cancelEditing,
        tasksForSelectedDateAndEvent,
        onTaskDropdownChange,
        handleInstanceSelect,
        getTaskDetails,
        handleFileUpload,
        submitTask,
        proceedSubmit,
        formatSubValue,
        totalPoints,
        isTaskAllowedOnDate,
        startAIUX,
        stopAIUX,
        handleAIAnalysis,
        summaryMonthSubmissions,
        summaryTotalPoints,
        summaryTotalTasks,
        groupedSummarySubmissions,
        prevMonth,
        nextMonth,
        openSummary,
        isToday,
        isOcrEnabled,
        imageTimestamp
    }
}

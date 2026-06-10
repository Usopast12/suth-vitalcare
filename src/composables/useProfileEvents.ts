import { ref, computed, watch } from 'vue'
import { langStore } from '../store/lang'
export function useProfileEvents(user, activeTabRef) {
  const registrations = ref([])
  const userSubmissions = ref([])
  const isEventsLoaded = ref(false)
  const team = ref(null)
  const memberCount = ref(0)
  const isTeamLoaded = ref(false)
  const eventsPerPage = 10
  const eventsCurrentPage = ref(1)
  const teamGoal = computed(() => {
    const teamEvent = registrations.value.find(r => r.event.team_mode && r.event.goal_config?.enabled)
    return teamEvent ? (teamEvent.event.goal_config.target_value || 100) : 100
  })
  const teamProgress = computed(() => {
    if (!team.value) return 0
    return Math.min(100, Math.round(((team.value.total_score || 0) / teamGoal.value) * 100))
  })
  const eventsTotalPages = computed(() => Math.ceil(registrations.value.length / eventsPerPage))
  const paginatedEvents = computed(() => {
    const start = (eventsCurrentPage.value - 1) * eventsPerPage
    return registrations.value.slice(start, start + eventsPerPage)
  })
  // Reset pagination when events tab is opened
  if (activeTabRef) {
    watch(activeTabRef, (newTab) => {
      if (newTab === 'events') {
        eventsCurrentPage.value = 1
      }
    })
  }
  const liveTotalPoints = computed(() => {
    return userSubmissions.value.filter(s => s.status === 'approved').reduce((sum, s) => sum + (s.tasks?.points || 0), 0)
  })

  const selectedEventId = ref(null)

  // --- Calendar Logic ---
  const calDate = ref(new Date())
  const calMonth = computed(() => calDate.value.getMonth())
  const calYear = computed(() => calDate.value.getFullYear())

  const calMonthLabel = computed(() => {
    return new Intl.DateTimeFormat(langStore.locale === 'en' ? 'en-US' : 'th-TH', { month: 'long' }).format(calDate.value)
  })
  const calYearLabel = computed(() => {
    return langStore.locale === 'en' ? calDate.value.getFullYear() : calDate.value.getFullYear() + 543
  })

  function prevMonth() {
    calDate.value = new Date(calYear.value, calMonth.value - 1, 1)
  }
  function nextMonth() {
    calDate.value = new Date(calYear.value, calMonth.value + 1, 1)
  }

  function getMissionsForDate(date) {
    if (!date) return []
    const d = date.getDate()
    const month = date.getMonth()
    const year = date.getFullYear()
    const weekday = date.getDay() === 0 ? 7 : date.getDay()
    const today = new Date()
    today.setHours(0,0,0,0)

    const activeRegs = registrations.value.filter(r => {
      if (!r.event) return false
      if (selectedEventId.value && Number(r.event.id) !== Number(selectedEventId.value)) return false
      
      const start = r.event.start_date ? new Date(r.event.start_date) : null
      const end = r.event.end_date ? new Date(r.event.end_date) : null
      const regCreated = r.created_at ? new Date(r.created_at) : null
      
      const isValid = (d) => d && !isNaN(d.getTime())
      
      if (isValid(start)) start.setHours(0,0,0,0)
      if (isValid(end)) end.setHours(23,59,59,999)
      if (isValid(regCreated)) regCreated.setHours(0,0,0,0)
      
      let effectiveStart = start
      if (isValid(regCreated)) {
        if (!isValid(effectiveStart) || regCreated > effectiveStart) {
          effectiveStart = regCreated
        }
      }
      
      const isAfterStart = !isValid(effectiveStart) || date >= effectiveStart
      const isBeforeEnd = !isValid(end) || date <= end
      
      return isAfterStart && isBeforeEnd
    })

    const results = []
    activeRegs.forEach(r => {
      let tasks = r.tasks || r.event?.tasks || []
      if (typeof tasks === 'string') {
        try { tasks = JSON.parse(tasks) } catch { tasks = [] }
      }
      if (!Array.isArray(tasks)) tasks = []

      tasks.forEach(t => {
        let allowed = []
        try {
          allowed = Array.isArray(t.allowed_days) ? t.allowed_days : JSON.parse(t.allowed_days || '[]')
        } catch { return }

        if (allowed.length === 0 || allowed.length === 7 || allowed.includes(weekday)) {
          const subs = userSubmissions.value.filter(s => {
            const sd = new Date(s.created_at)
            return Number(s.task_id) === Number(t.id) && sd.getDate() === d && sd.getMonth() === month && sd.getFullYear() === year
          })

          const latestSub = subs.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
          
          let status = 'none'
          if (latestSub) {
            status = latestSub.status
          } else if (date < today) {
            status = 'missed'
          } else {
            const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear()
            status = isToday ? 'active' : 'upcoming'
          }

          results.push({
            id: `${r.id}_${t.id}`,
            task: t,
            event: r.event,
            status,
            submission: latestSub
          })
        }
      })
    })
    return results
  }

  const calendarDays = computed(() => {
    const year = calYear.value
    const month = calMonth.value
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    
    // Padding for Mon-Sun
    let firstDayOfWeek = firstDay.getDay() // 0=Sun, 1=Mon...
    if (firstDayOfWeek === 0) firstDayOfWeek = 7
    const startPadding = firstDayOfWeek - 1 // 0=Mon
    
    const days = []
    
    // Previous month padding
    const prevLastDay = new Date(year, month, 0).getDate()
    for (let i = startPadding - 1; i >= 0; i--) {
      const d = prevLastDay - i
      days.push({
        day: d,
        date: new Date(year, month - 1, d),
        isCurrentMonth: false,
        isToday: false,
        status: null
      })
    }
    
    const today = new Date()
    today.setHours(0,0,0,0)
    
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d)
      const isTodayDate = date.getTime() === today.getTime()
      
      let status = null
      
      // Check if any event is active on this day
      const activeRegs = registrations.value.filter(r => {
        if (!r.event) return false
        if (selectedEventId.value && Number(r.event.id) !== Number(selectedEventId.value)) return false
        
        const start = r.event.start_date ? new Date(r.event.start_date) : null
        const end = r.event.end_date ? new Date(r.event.end_date) : null
        const regCreated = r.created_at ? new Date(r.created_at) : null
        
        const isValid = (d) => d && !isNaN(d.getTime())
        
        if (isValid(start)) start.setHours(0,0,0,0)
        if (isValid(end)) end.setHours(23,59,59,999)
        if (isValid(regCreated)) regCreated.setHours(0,0,0,0)
        
        // Effective start is the later of event start or registration date
        let effectiveStart = start
        if (isValid(regCreated)) {
          if (!isValid(effectiveStart) || regCreated > effectiveStart) {
            effectiveStart = regCreated
          }
        }
        
        const isAfterStart = !isValid(effectiveStart) || date >= effectiveStart
        const isBeforeEnd = !isValid(end) || date <= end
        
        return isAfterStart && isBeforeEnd
      })
      
      if (activeRegs.length > 0) {
        const weekday = date.getDay() === 0 ? 7 : date.getDay()
        const hasAllowedTask = activeRegs.some(r => {
          let tasks = r.tasks || r.event?.tasks || []
          if (typeof tasks === 'string') {
            try { tasks = JSON.parse(tasks) } catch { tasks = [] }
          }
          if (!Array.isArray(tasks)) tasks = []
          
          return tasks.some(t => {
            let allowed = []
            try {
              allowed = Array.isArray(t.allowed_days) ? t.allowed_days : JSON.parse(t.allowed_days || '[]')
            } catch { return false }
            return allowed.length === 0 || allowed.length === 7 || allowed.includes(weekday)
          })
        })
        
        if (hasAllowedTask) {
          const subs = userSubmissions.value.filter(s => {
            const sd = new Date(s.created_at)
            const sameDate = sd.getDate() === d && sd.getMonth() === month && sd.getFullYear() === year
            if (!sameDate) return false
            
            // Link submission to event via task metadata or event_id
            const subEventId = s.tasks?.event_id || s.event_id || s.activity_id
            if (selectedEventId.value && subEventId) {
              return Number(subEventId) === Number(selectedEventId.value)
            }
            return true
          })
          
          if (subs.some(s => s.status === 'approved')) {
            status = 'approved'
          } else if (subs.some(s => s.status === 'pending')) {
            status = 'pending'
          } else if (date < today) {
            status = 'missed'
          } else {
            const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear()
            status = isToday ? 'active' : 'upcoming'
          }
        }
      }
      
      days.push({
        day: d,
        date,
        isCurrentMonth: true,
        isToday: isTodayDate,
        status,
        missions: getMissionsForDate(date)
      })
    }
    
    // Next month padding
    const remaining = 42 - days.length
    for (let i = 1; i <= remaining; i++) {
      days.push({
        day: i,
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
        isToday: false,
        status: null
      })
    }
    
    return days
  })

  const currentStreak = computed(() => {
    const today = new Date()
    today.setHours(0,0,0,0)
    let streak = 0
    let checkDate = new Date(today)
    
    // Sort submissions by date descending
    const sortedSubs = [...userSubmissions.value].filter(s => s.status === 'approved').sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    
    if (sortedSubs.length === 0) return 0

    // Check if there was an approved submission today or yesterday to continue streak
    const lastSubDate = new Date(sortedSubs[0].created_at)
    lastSubDate.setHours(0,0,0,0)
    
    const diffDays = Math.round((today.getTime() - lastSubDate.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays > 1) return 0 // Streak broken

    // Iterate backwards
    let currentDate = lastSubDate
    streak = 1
    
    for (let i = 1; i < sortedSubs.length; i++) {
      const subDate = new Date(sortedSubs[i].created_at)
      subDate.setHours(0,0,0,0)
      
      const gap = Math.round((currentDate.getTime() - subDate.getTime()) / (1000 * 60 * 60 * 24))
      if (gap === 1) {
        streak++
        currentDate = subDate
      } else if (gap > 1) {
        break
      }
    }
    
    return streak
  })

  // --- Chart Logic ---
  const last7DaysData = computed(() => {
    const data = []
    const today = new Date()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      d.setHours(0,0,0,0)
      
      const daySubs = userSubmissions.value.filter(s => {
        const sd = new Date(s.created_at)
        sd.setHours(0,0,0,0)
        return sd.getTime() === d.getTime() && s.status === 'approved'
      })
      
      data.push({
        label: new Intl.DateTimeFormat('th-TH', { weekday: 'short' }).format(d),
        value: daySubs.length,
        date: d
      })
    }
    return data
  })

  async function fetchTeamData() {
    if (!user.value?.team_id || isTeamLoaded.value) return
    try {
      const teamRes = await fetch(`/api/teams/${user.value.team_id}`)
      if (teamRes.ok) {
        const teamData = await teamRes.json()
        team.value = teamData
        memberCount.value = teamData.members?.length || 0
        isTeamLoaded.value = true
      }
    } catch { }
  }
  async function fetchEventsData() {
    if (!user.value?.id) return
    try {
      const regRes = await fetch(`/api/users/${user.value.id}/registrations`, { headers: { 'x-user-id': String(user.value.id) } })
      if (regRes.ok) {
        registrations.value = await regRes.json()
      }
      const subRes = await fetch(`/api/mission/user/${user.value.id}`, { headers: { 'x-user-id': String(user.value.id) } })
      if (subRes.ok) userSubmissions.value = await subRes.json()
      isEventsLoaded.value = true
    } catch { }
  }
  const getActivityStatus = (act) => {
    if (act.is_unlimited_max_slots) return 'open';
    if (act.registration_count >= act.max_slots) return 'full';
    const deadline = act.registration_deadline ? new Date(act.registration_deadline).getTime() : null;
    if (deadline && deadline < Date.now()) return 'closed';
    return 'open';
  };
  const MONTHS_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
  const MONTHS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  function formatDate(dateStr) {
    if (!dateStr) return '–'
    const d = new Date(dateStr)
    const isEn = langStore.locale === 'en'
    const m = isEn ? MONTHS_EN[d.getMonth()] : MONTHS_TH[d.getMonth()]
    const y = isEn ? d.getFullYear() : d.getFullYear() + 543
    return `${d.getDate()} ${m} ${y}`
  }
  function formatDateRange(start, end) {
    if (!start) return '–'
    const s = new Date(start), e = new Date(end)
    const isEn = langStore.locale === 'en'
    if (s.getMonth() === e.getMonth()) {
      const m = isEn ? MONTHS_EN[s.getMonth()] : MONTHS_TH[s.getMonth()]
      const y = isEn ? s.getFullYear() : s.getFullYear() + 543
      return `${s.getDate()} – ${e.getDate()} ${m} ${y}`
    }
    return `${formatDate(start)} – ${formatDate(end)}`
  }
  function formatEventRemaining(event) {
    if (!event.start_date || !event.end_date) return '–'
    const now = new Date()
    const start = new Date(event.start_date)
    const end = new Date(event.end_date)
    const isEn = langStore.locale === 'en'
    if (now > end) return formatDateRange(event.start_date, event.end_date)
    if (now < start) return isEn ? `Starts in ${Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))} days` : `เริ่มในอีก ${Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))} วัน`
    const days = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return days <= 0 ? (isEn ? 'Last day' : 'วันสุดท้าย') : (isEn ? `${days} days left` : `เหลืออีก ${days} วัน`)
  }
  function getEventScore(eventId) {
    return userSubmissions.value.filter(s => {
      const subEvId = s.tasks?.event_id || s.event_id || s.activity_id
      return Number(subEvId) === Number(eventId) && s.status === 'approved'
    }).reduce((sum, s) => sum + (s.tasks?.points || 0), 0)
  }
  function hasGoal(event) { return event.goal_config?.enabled && event.goal_config?.target_value }

  const missionStats = computed(() => {
    const stats = []

    // ── Clamp counting to the month currently shown on the calendar ──
    const viewYear  = calYear.value
    const viewMonth = calMonth.value
    const monthStart = new Date(viewYear, viewMonth, 1)
    monthStart.setHours(0, 0, 0, 0)
    const monthEnd = new Date(viewYear, viewMonth + 1, 0)
    monthEnd.setHours(23, 59, 59, 999)

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const isValid = (d) => d && !isNaN(d.getTime())

    registrations.value.forEach(reg => {
      let tasks = reg.tasks || reg.event?.tasks || []
      if (typeof tasks === 'string') {
        try { tasks = JSON.parse(tasks) } catch { tasks = [] }
      }
      if (!Array.isArray(tasks)) tasks = []

      const evStart    = reg.event.start_date ? new Date(reg.event.start_date) : null
      const evEnd      = reg.event.end_date   ? new Date(reg.event.end_date)   : null
      const regCreated = reg.created_at       ? new Date(reg.created_at)       : null

      if (isValid(evStart))    evStart.setHours(0, 0, 0, 0)
      if (isValid(evEnd))      evEnd.setHours(23, 59, 59, 999)
      if (isValid(regCreated)) regCreated.setHours(0, 0, 0, 0)

      // effective start = later of event start or registration date
      let effectiveStart = evStart
      if (isValid(regCreated)) {
        if (!isValid(effectiveStart) || regCreated > effectiveStart) {
          effectiveStart = regCreated
        }
      }

      // Skip if event doesn't overlap the viewed month at all
      if (isValid(evEnd)          && evEnd < monthStart)   return
      if (isValid(effectiveStart) && effectiveStart > monthEnd) return

      // Final window = intersection of [effectiveStart, evEnd] and [monthStart, monthEnd]
      const rangeStart = new Date(isValid(effectiveStart) && effectiveStart > monthStart ? effectiveStart : monthStart)
      const rangeEnd   = new Date(isValid(evEnd) && evEnd < monthEnd ? evEnd : monthEnd)
      rangeStart.setHours(0, 0, 0, 0)
      rangeEnd.setHours(0, 0, 0, 0)

      tasks.forEach(task => {
        let allowed = []
        try {
          allowed = Array.isArray(task.allowed_days)
            ? task.allowed_days
            : JSON.parse(task.allowed_days || '[]')
        } catch { allowed = [] }

        let expected = 0
        let completedDays = 0
        let missed = 0

        // 1. Expected days within this month's window
        let curr = new Date(rangeStart)
        while (curr <= rangeEnd) {
          const wd = curr.getDay() === 0 ? 7 : curr.getDay()
          if (allowed.length === 0 || allowed.length === 7 || allowed.includes(wd)) expected++
          curr.setDate(curr.getDate() + 1)
        }

        // 2. Completed unique days (approved) within this month's window
        const taskSubs = userSubmissions.value.filter(s => {
          if (Number(s.task_id) !== Number(task.id) || s.status !== 'approved') return false
          const sd = new Date(s.created_at)
          sd.setHours(0, 0, 0, 0)
          return sd >= rangeStart && sd <= rangeEnd
        })
        const completedDates = new Set(taskSubs.map(s => {
          const d = new Date(s.created_at)
          return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
        }))
        completedDays = completedDates.size

        // 3. Missed days up to today (or rangeEnd, whichever is earlier)
        const limitDate = today < rangeEnd ? today : rangeEnd
        let checkDate = new Date(rangeStart)
        while (checkDate < limitDate) {
          const wd = checkDate.getDay() === 0 ? 7 : checkDate.getDay()
          if (allowed.length === 0 || allowed.length === 7 || allowed.includes(wd)) {
            const key = `${checkDate.getFullYear()}-${checkDate.getMonth()}-${checkDate.getDate()}`
            if (!completedDates.has(key)) missed++
          }
          checkDate.setDate(checkDate.getDate() + 1)
        }

        stats.push({
          taskId:    task.id,
          taskName:  task.note || 'ภารกิจ',
          eventName: reg.event.title,
          expected,
          completed: completedDays,
          missed
        })
      })
    })
    return stats
  })

  function formatGoalTarget(event) {
    const gc = event.goal_config
    if (!gc) return ''
    const unitMap = { 'points': 'คะแนน', 'submissions': 'ครั้ง', 'distance': 'กม.', 'km': 'กม.', 'steps': 'ก้าว', 'min': 'นาที', 'hr': 'ชั่วโมง', 'cal': 'แคลอรี่', 'kg': 'กก.' }
    return `${Number(gc.target_value).toLocaleString()} ${unitMap[gc.target_type] || gc.target_type || ''}`
  }
  return {
    registrations,
    userSubmissions,
    team,
    memberCount,
    teamProgress,
    teamGoal,
    isEventsLoaded,
    isTeamLoaded,
    eventsPerPage,
    eventsCurrentPage,
    eventsTotalPages,
    paginatedEvents,
    liveTotalPoints,
    selectedEventId,
    calendarDays,
    calMonthLabel,
    calYearLabel,
    currentStreak,
    last7DaysData,
    prevMonth,
    nextMonth,
    fetchTeamData,
    fetchEventsData,
    getActivityStatus,
    getMissionsForDate,
    formatDate,
    formatDateRange,
    formatEventRemaining,
    getEventScore,
    hasGoal,
    formatGoalTarget,
    missionStats
  }
}
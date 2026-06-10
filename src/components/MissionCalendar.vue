<template>
  <div class="calendar-wrapper">
    <div class="calendar">
      <div class="month">
        <div class="month-nav">
          <span class="month-title">{{ monthLabel }} {{ yearLabel }}</span>
          <div class="nav-arrows-container">
            <button class="nav-arrow" @click="$emit('prevMonth')">
              <ChevronLeft :size="20" />
            </button>
            <button class="nav-arrow" @click="$emit('nextMonth')">
              <ChevronRight :size="20" />
            </button>
          </div>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th v-for="(day, index) in ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']" :key="day">{{ langStore.locale === 'th' ? ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'][index] : day }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(week, wIdx) in weeks" :key="wIdx">
            <td 
              v-for="(day, dIdx) in week" 
              :key="dIdx"
              @click="day && $emit('selectDay', day)"
              :class="[
                !day ? 'is-empty' : '',
                day?.isToday ? 'is-today' : '',
                selectedDate?.getTime() === day?.date.getTime() ? 'is-selected' : '',
                day && !day.isCurrentMonth ? 'not-current-month' : ''
              ]"
            >
              <template v-if="day">
                <input 
                  type="checkbox" 
                  :checked="selectedDate?.getTime() === day.date.getTime()" 
                  readonly
                >
                <div class="day-content">
                  <span class="day-num">{{ day.day }}</span>
                  <div class="day-bars" v-if="day.missions && day.missions.length">
                    <div 
                      v-for="(m, i) in day.missions.slice(0, maxBars)" 
                      :key="i"
                      class="mission-bar"
                      :class="m.status"
                    >
                      <span class="mission-text" v-auto-translate="m.task?.note || m.task?.type || langStore.t('mission_activity')"></span>
                    </div>
                    <div v-if="day.missions.length > maxBars" class="more-bars">
                      +{{ day.missions.length - maxBars }} {{ langStore.t('more_items') }}
                    </div>
                  </div>
                  <!-- fallback if missions not provided -->
                  <div class="day-bars fallback" v-else-if="day.status">
                    <div class="mission-bar" :class="day.status"></div>
                  </div>
                </div>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { langStore } from '../store/lang'

const props = defineProps({
  days: { type: Array, required: true },
  monthLabel: { type: String, default: '' },
  yearLabel: { type: String, default: '' },
  selectedDate: { type: Date, default: null }
})

defineEmits(['prevMonth', 'nextMonth', 'selectDay'])

const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1024)
const updateWidth = () => { windowWidth.value = window.innerWidth }
onMounted(() => window.addEventListener('resize', updateWidth))
onUnmounted(() => window.removeEventListener('resize', updateWidth))

// 2 bars on mobile (≤640px), 3 on tablet/desktop
const maxBars = computed(() => windowWidth.value <= 640 ? 2 : 3)

const weeks = computed(() => {
  const result = []
  for (let i = 0; i < props.days.length; i += 7) {
    result.push(props.days.slice(i, i + 7))
  }
  return result
})
</script>

<style scoped>
/* ── Wrapper ── */
.calendar-wrapper {
  color-scheme: light;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  width: 100%;
  font-family: 'Inter', 'Sarabun', sans-serif;
}

.calendar {
  width: 100%;
  background: #ffffff;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.07);
}

/* ── Header ── */
.month {
  padding: 16px 20px;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #e2e8f0;
}

.month-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.month-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: #111827;
  letter-spacing: -0.01em;
}

.nav-arrows-container {
  display: flex;
  gap: 6px;
}

.nav-arrow {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  width: 32px;
  height: 32px;
  min-width: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #374151;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  padding: 0;
  flex-shrink: 0;
}

.nav-arrow:hover {
  background: #f0f0f0;
  color: #111827;
  border-color: #d1d5db;
}

/* ── Table ── */
table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

th {
  height: 36px;
  background: #f8fafc;
  color: #64748b;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid #e2e8f0;
  border-right: 1px solid #e2e8f0;
  text-align: center;
  padding: 0;
}

th:last-child { border-right: none; }

/* Desktop: tall cells to comfortably show 3 bars + +N indicator */
td {
  height: 140px;
  border-right: 1px solid #e2e8f0;
  border-bottom: 1px solid #e2e8f0;
  background: #ffffff;
  position: relative;
  padding: 0;
  cursor: pointer;
  vertical-align: top;
  transition: background 0.15s;
}

td:last-child { border-right: none; }
tbody tr:last-child td { border-bottom: none; }

td:hover { background: #f9fafb; }

td.is-empty {
  background: #fafafa;
  cursor: default;
}
td.is-empty:hover { background: #fafafa; }

td.is-today { background: #f0f9ff; }

td.is-selected {
  background: #eff6ff;
  box-shadow: inset 0 0 0 2px #3b82f6;
  z-index: 2;
}

td.not-current-month { background: #fafafa; }
td.not-current-month .day-num { color: #c4c9d4; }

/* ── Day content ── */
td .day-content {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 6px 5px 4px 5px;
  box-sizing: border-box;
  overflow: hidden;
  gap: 2px;
}

td input[type="checkbox"] { display: none; }

.day-num {
  font-size: 12px;
  font-weight: 700;
  color: #374151;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  margin-bottom: 3px;
  flex-shrink: 0;
  line-height: 1;
}

td.is-today .day-num {
  background: #2563eb;
  color: #ffffff;
}

/* ── Mission bars ── */
.day-bars {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  flex: 1;
  min-height: 0;
}

.mission-bar {
  height: 19px;
  border-radius: 4px;
  width: 100%;
  display: flex;
  align-items: center;
  padding: 0 5px;
  box-sizing: border-box;
  flex-shrink: 0;
}

.mission-text {
  font-size: 10.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
  text-align: left;
  font-weight: 600;
}

/* ── Vivid status colors ── */
.mission-bar.approved  { background: #bbf7d0; }
.mission-bar.approved  .mission-text { color: #14532d; }

.mission-bar.active    { background: #bfdbfe; }
.mission-bar.active    .mission-text { color: #1e3a8a; }

.mission-bar.pending   { background: #fde68a; }
.mission-bar.pending   .mission-text { color: #78350f; }

.mission-bar.missed    { background: #fecaca; }
.mission-bar.missed    .mission-text { color: #7f1d1d; }

.mission-bar.upcoming  { background: #e0e7ff; }
.mission-bar.upcoming  .mission-text { color: #312e81; }

/* ── +N more label ── */
.more-bars {
  font-size: 10px;
  color: #94a3b8;
  font-weight: 600;
  line-height: 1;
  padding: 0 4px;
}

/* ── Mobile: 2 bars max, shorter cells ── */
@media (max-width: 640px) {
  .calendar-wrapper { padding: 0; }
  .calendar { border-radius: 10px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
  .month { padding: 10px 12px; }
  .month-title { font-size: 0.88rem; }
  .nav-arrow { width: 28px; height: 28px; min-width: 28px; border-radius: 6px; }
  th { font-size: 8px; height: 26px; letter-spacing: 0; }

  /* Mobile cells: 90px gives breathing room for 2 bars + more indicator */
  td { height: 90px; }
  td .day-content { padding: 5px 3px 3px 4px; gap: 2px; }
  .day-num { font-size: 10px; width: 18px; height: 18px; margin-bottom: 2px; }
  .mission-bar { height: 15px; padding: 0 3px; border-radius: 3px; }
  .mission-text { font-size: 8.5px; }
  .more-bars { font-size: 8px; padding: 0 3px; }
}

/* ── Tablet: moderate height ── */
@media (min-width: 641px) and (max-width: 1023px) {
  td { height: 110px; }
}
</style>

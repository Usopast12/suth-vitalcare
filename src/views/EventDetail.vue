<template>
  <div v-if="loading" class="loading-page flex-center full-h">
    <div
      class="spin-lg border-t-orange-500 border-4 border-slate-200 rounded-full w-12 h-12"
    ></div>
  </div>
  <div v-else-if="loadError" class="error-page flex-center full-h">
    <AlertCircleIcon :size="40" class="error-ico text-orange-500" />
    <p class="mt-4 text-slate-600 font-bold">{{ langStore.locale === 'th' ? 'ไม่พบข้อมูลกิจกรรม' : 'Event not found' }}</p>
    <button
      class="btn-back-err mt-4 px-6 py-2 bg-slate-100 text-slate-700 rounded-full hover:bg-slate-200"
      @click="handleBack"
    >
      {{ langStore.locale === 'th' ? 'กลับหน้าหลัก' : 'Go Back' }}
    </button>
  </div>
  <div v-else-if="event" class="event-page pb-40 md:pb-12">
    <div class="hero-blur-container">
      <div
        class="hero-blur-image"
        :style="{
          backgroundImage: `url(${event.poster || event.image || 'https://placehold.co/1200x600'})`,
        }"
      ></div>
      <div class="hero-blur-overlay"></div>
    </div>
    <main class="main-content">
      <Transition name="slide-down">
        <div
          v-if="route.query.success === 'health_updated'"
          class="notice-success w-full mb-4 bg-orange-50 text-orange-700 p-3 rounded-lg flex items-center gap-2 border border-orange-200"
        >
          <CheckCircleIcon :size="16" class="flex-shrink-0" />
          <span class="text-sm">{{ langStore.locale === 'th' ? 'บันทึกข้อมูลเรียบร้อยแล้ว' : 'Data saved successfully' }}</span>
        </div>
      </Transition>
      <div v-if="event" class="title-with-back">
        <button class="btn-back-hero" @click="handleBack">
          <ArrowLeftIcon :size="24" />
        </button>
        <h1 class="event-title-hero" v-auto-translate="event.title"></h1>
      </div>
      <div class="content-grid">
        <div class="left-column">
          <div class="poster-wrapper mb-6">
            <img
              :src="
                event.poster ||
                event.image ||
                'https://placehold.co/600x600/f8fafc/94a3b8?text=No+Image'
              "
              :alt="event.title"
              class="poster-img"
            />
          </div>
          <div class="mobile-details-block mobile-only-block mb-8 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
            <div v-if="event.organizer" class="inline-flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100 mb-4 max-w-full overflow-hidden">
              <span class="font-bold text-sm text-slate-700 truncate min-w-0">{{ langStore.locale === 'th' ? 'จัดโดย:' : 'Organized by:' }} {{ event.organizer }}</span>
            </div>
            <div class="flex flex-col gap-3 pb-4 border-b border-slate-100 mb-4">
              <div class="flex gap-2 min-w-0">
                <span class="min-w-[100px] font-bold shrink-0">{{ langStore.locale === 'th' ? 'สิทธิ์การเข้าร่วม :' : 'Eligibility :' }}</span>
                <div class="flex flex-wrap gap-1.5 flex-1 min-w-0">
                  <span v-if="!allowedGroups || allowedGroups.length === 0 || allowedGroups.includes('general')" class="text-green-600 font-bold">{{ langStore.locale === 'th' ? 'ทุกคนสามารถเข้าร่วมได้' : 'Everyone can join' }}</span>
                  <span
                    v-else
                    v-for="g in allowedGroups"
                    :key="g"
                    class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-100"
                  >{{ g === 'my_team' ? (langStore.locale === 'th' ? 'เฉพาะสมาชิกในทีมผู้จัด' : 'Organizer team members only') : (g === 'other_teams' ? (langStore.locale === 'th' ? 'สมาชิกทุกทีม' : 'All team members') : g) }}</span>
                </div>
              </div>
              <div class="flex gap-2 min-w-0" v-if="authStore.user">
                <span class="min-w-[100px] font-bold shrink-0">{{ langStore.locale === 'th' ? 'สถานะของคุณ :' : 'Your Status :' }}</span>
                <span class="text-slate-600 flex-1">{{ currentUserRoleLabel || (langStore.locale === 'th' ? 'บุคคลทั่วไป' : 'General User') }}</span>
              </div>
            </div>
            <div v-if="!isRegistered && !hasPermissionToJoin" class="alert-box error mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">
              <div class="flex items-start gap-3">
                <AlertCircleIcon :size="20" class="mt-0.5 flex-shrink-0" />
                <div class="flex-1 min-w-0">
                  <div class="mb-3 pb-2 border-b border-red-100">
                    <div class="text-[10px] uppercase tracking-wider font-bold opacity-60 mb-0.5">{{ langStore.locale === 'th' ? 'สถานะปัจจุบันของคุณ' : 'Your Current Status' }}</div>
                    <div class="font-bold text-base break-words">{{ currentUserRoleLabel }}</div>
                  </div>
                  <div>
                    <div class="text-[10px] uppercase tracking-wider font-bold opacity-60 mb-0.5">{{ langStore.locale === 'th' ? 'เหตุผล' : 'Reason' }}</div>
                    <div class="font-bold text-sm break-words">{{ noPermissionReason || (langStore.locale === 'th' ? "คุณไม่มีสิทธิ์เข้าร่วมกิจกรรมนี้" : "You don't have permission to join this event") }}</div>
                  </div>
                </div>
              </div>
            </div>
            <div class="rc-info-list mb-6 space-y-2 text-sm border-b border-slate-100 pb-5">
              <div class="flex gap-2 min-w-0">
                <span class="min-w-[100px] font-bold shrink-0">{{ langStore.locale === 'th' ? 'วันเริ่มกิจกรรม :' : 'Start Date :' }}</span>
                <span class="flex-1 break-words min-w-0">{{ formatDateThai(event.start_date) || (langStore.locale === 'th' ? "จัดต่อเนื่อง" : "Continuous") }}</span>
              </div>
              <div class="flex gap-2 min-w-0">
                <span class="min-w-[100px] font-bold shrink-0">{{ langStore.locale === 'th' ? 'วันสิ้นสุดกิจกรรม :' : 'End Date :' }}</span>
                <span class="flex-1 break-words min-w-0">{{ formatDateThai(event.end_date || event.start_date) || (langStore.locale === 'th' ? "จัดต่อเนื่อง" : "Continuous") }}</span>
              </div>
              <div class="flex gap-2 min-w-0">
                <span class="min-w-[100px] font-bold shrink-0">{{ langStore.locale === 'th' ? 'เวลาจัดกิจกรรม :' : 'Time :' }}</span>
                <span class="flex-1 break-words min-w-0">
                  {{ event.start_time?.slice(0, 5) || "08:00" }} – {{ event.end_time?.slice(0, 5) || "17:00" }} {{ langStore.locale === 'th' ? 'น.' : '' }}
                </span>
              </div>
              <div class="flex gap-2 min-w-0">
                <span class="min-w-[100px] font-bold shrink-0">{{ langStore.locale === 'th' ? 'สถานที่จัด :' : 'Location :' }}</span>
                <span class="flex-1 break-words min-w-0">{{ event.location_name || "Virtual" }}</span>
              </div>
              <div class="flex gap-2 min-w-0">
                <span class="min-w-[100px] font-bold shrink-0">{{ langStore.locale === 'th' ? 'จำนวนรับสมัคร :' : 'Capacity :' }}</span>
                <span class="text-orange-600 flex-1 min-w-0 flex items-center gap-2">
                   {{ event.registration_count ?? event.filled ?? 0 }} / {{ isUnlimited ? (langStore.locale === 'th' ? "ไม่จำกัด" : "Unlimited") : event.max_slots || event.total || 0 }} {{ langStore.locale === 'th' ? 'คน' : 'pax' }}
                   <span v-if="slotFull" class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-600 border border-red-200 animate-pulse">{{ langStore.locale === 'th' ? 'เต็มแล้ว' : 'Full' }}</span>
                </span>
              </div>
            </div>
            <div class="rc-header mb-4 flex justify-between items-center gap-2 min-w-0">
              <h2 class="text-lg font-bold text-slate-800 truncate flex-1 min-w-0">{{ langStore.locale === 'th' ? 'ช่วงรับสมัคร' : 'Registration Period' }}</h2>
              <div v-if="slotFull" class="badge-status closed text-xs bg-red-100 text-red-700 px-2 py-1 rounded whitespace-nowrap shrink-0">{{ langStore.locale === 'th' ? 'กิจกรรมเต็ม' : 'Event Full' }}</div>
              <div v-else class="badge-status open text-xs bg-green-100 text-green-700 px-2 py-1 rounded whitespace-nowrap shrink-0">{{ langStore.locale === 'th' ? 'เปิดรับสมัคร' : 'Open' }}</div>
            </div>
            <div class="rc-info-list space-y-2 text-sm min-w-0">
              <div class="flex gap-2 min-w-0">
                <span class="min-w-[100px] font-bold shrink-0">{{ langStore.locale === 'th' ? 'เปิดรับสมัคร :' : 'Opens :' }}</span>
                <span class="flex-1 break-words min-w-0">{{ formatDateThai(event.registration_start_date || event.start_date) || (langStore.locale === 'th' ? "เปิดรับสมัครต่อเนื่อง" : "Always Open") }}</span>
              </div>
              <div class="flex gap-2 min-w-0">
                <span class="min-w-[100px] font-bold shrink-0">{{ langStore.locale === 'th' ? 'ปิดรับสมัคร :' : 'Closes :' }}</span>
                <span class="flex-1 break-words min-w-0">{{ formatDateThai(event.registration_end_date || event.end_date || event.start_date) || (langStore.locale === 'th' ? "เปิดรับสมัครต่อเนื่อง" : "Always Open") }}</span>
              </div>
              <p class="text-xs text-slate-400 mt-2 flex items-start gap-1">
                <AlertCircleIcon :size="12" class="mt-0.5 shrink-0" />
                <span class="flex-1 break-words">{{ langStore.locale === 'th' ? 'หรือปิดรับสมัครทันทีเมื่อผู้สมัครครบเต็มจำนวน' : 'Or closes immediately when capacity is reached' }}</span>
              </p>
            </div>
          </div>
          <div class="widgets-container mt-6">
            <div class="glass-widget full-width" v-if="isRegistered && totalMissionsCount > 0">
              <div class="gw-icon bg-orange-50 text-orange-600 flex-shrink-0">
                <ListTodoIcon :size="20" class="text-orange-600" />
              </div>
              <div class="gw-info">
                <h4>{{ langStore.locale === 'th' ? 'ภารกิจของคุณ' : 'Your Missions' }}</h4>
                <p>{{ langStore.locale === 'th' ? 'ทำสำเร็จแล้ว' : 'Completed' }} {{ completedMissionsCount }} / {{ totalMissionsCount }}</p>
              </div>
              <button
                v-if="isRegistered && completedMissionsCount < totalMissionsCount"
                class="btn-small btn-blue flex-shrink-0"
                @click="goToMissions()"
              >
                {{ langStore.locale === 'th' ? 'เข้าทำ' : 'Start' }}
              </button>
              <div class="font-bold text-green-600 flex-shrink-0 text-sm whitespace-nowrap" v-else-if="completedMissionsCount === totalMissionsCount">
                {{ langStore.locale === 'th' ? 'สำเร็จ!' : 'Done!' }}
                <CheckCircleIcon :size="16" class="inline" />
              </div>
            </div>
            <div class="glass-widget full-width flex-col items-start" v-if="certConfigParsed.enabled">
              <div class="flex items-center gap-3 w-full">
                <div class="gw-icon bg-orange-100 text-orange-600 flex-shrink-0">
                  <AwardIcon :size="20" class="text-orange-600" />
                </div>
                <div class="gw-info">
                  <h4>{{ langStore.locale === 'th' ? 'เกียรติบัตร' : 'Certificate' }}</h4>
                  <p v-if="certStatus === 'issued'" class="text-green font-bold">{{ langStore.locale === 'th' ? 'ได้รับรางวัลแล้ว ✓' : 'Received ✓' }}</p>
                  <p v-else-if="isEligible" class="text-orange font-bold animate-pulse">{{ langStore.locale === 'th' ? 'พร้อมกดรับ! ✨' : 'Ready to claim! ✨' }}</p>
                  <p v-else class="text-slate-400 text-xs">{{ certReason || (langStore.locale === 'th' ? "เงื่อนไขตามที่ผู้จัดกำหนด" : "Based on organizer conditions") }}</p>
                </div>
                <button
                  class="btn-small flex-shrink-0"
                  :class="certStatus === 'issued' ? 'btn-light-green' : isEligible ? 'btn-light-orange' : 'btn-disabled'"
                  @click="claimCert"
                  :disabled="!isRegistered || (!isEligible && certStatus !== 'issued')"
                >
                  {{ certStatus === "issued" ? (langStore.locale === 'th' ? "ดาวน์โหลด" : "Download") : isEligible ? (langStore.locale === 'th' ? "กดรับเลย" : "Claim Now") : (langStore.locale === 'th' ? "ล็อค" : "Locked") }}
                </button>
              </div>
              <div v-if="isRegistered && certStatus !== 'issued' && certCriteria" class="w-full mt-3 pt-3 border-t border-slate-100 space-y-2">
                <div v-if="certCriteria.preTest && assessmentConfig.pre_test?.enabled" class="flex items-center justify-between text-xs">
                  <div class="flex items-center gap-2">
                    <CheckCircleIcon v-if="certCriteria.preTest.completed" :size="14" class="text-green-500" />
                    <ClockIcon v-else :size="14" class="text-slate-300" />
                    <span :class="certCriteria.preTest.completed ? 'text-slate-600 font-medium' : 'text-slate-400'">{{ certCriteria.preTest.label }}</span>
                  </div>
                  <span v-if="certCriteria.preTest.completed" class="text-[10px] text-green-600 font-bold">{{ langStore.locale === 'th' ? 'สำเร็จ' : 'Done' }}</span>
                </div>
                <div v-if="certCriteria.goal && goalConfigParsed.enabled" class="flex flex-col gap-1 text-xs">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <CheckCircleIcon v-if="certCriteria.goal.completed" :size="14" class="text-green-500" />
                      <TargetIcon v-else :size="14" class="text-slate-300" />
                      <span :class="certCriteria.goal.completed ? 'text-slate-600 font-medium' : 'text-slate-400'">{{ certCriteria.goal.label }}</span>
                    </div>
                    <span class="text-[10px] font-bold" :class="certCriteria.goal.completed ? 'text-green-600' : 'text-orange-500'">
                      {{ certCriteria.goal.current.toLocaleString() }} / {{ certCriteria.goal.target.toLocaleString() }} {{ certCriteria.goal.unit }}
                    </span>
                  </div>
                  <div v-if="!certCriteria.goal.completed" class="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                    <div class="h-full bg-orange-400 transition-all" :style="{ width: `${Math.min(100, (certCriteria.goal.current / certCriteria.goal.target) * 100)}%` }"></div>
                  </div>
                </div>
                <div v-if="certCriteria.postTest && assessmentConfig.post_test?.enabled" class="flex items-center justify-between text-xs">
                  <div class="flex items-center gap-2">
                    <CheckCircleIcon v-if="certCriteria.postTest.completed" :size="14" class="text-green-500" />
                    <ClockIcon v-else :size="14" class="text-slate-300" />
                    <span :class="certCriteria.postTest.completed ? 'text-slate-600 font-medium' : 'text-slate-400'">{{ certCriteria.postTest.label }}</span>
                  </div>
                  <span v-if="certCriteria.postTest.completed" class="text-[10px] text-green-600 font-bold">{{ langStore.locale === 'th' ? 'สำเร็จ' : 'Done' }}</span>
                </div>
              </div>
            </div>
            <div class="glass-widget full-width" v-if="assessmentConfig.pre_test?.enabled">
              <div class="gw-icon bg-orange-50 text-orange-600 flex-shrink-0">
                <ClipboardListIcon :size="20" class="text-orange-600" />
              </div>
              <div class="gw-info">
                <h4>{{ langStore.locale === 'th' ? 'แบบทดสอบก่อนเริ่ม' : 'Pre-test' }}</h4>
                <p v-if="preTestCompleted" class="text-green font-bold text-sm">{{ langStore.locale === 'th' ? '✓ ทำเสร็จแล้ว' : '✓ Completed' }}</p>
                <p v-else class="text-orange font-bold text-sm">{{ langStore.locale === 'th' ? 'ยังไม่ได้ทำ' : 'Not started' }}</p>
              </div>
              <button
                v-if="isRegistered && !preTestCompleted"
                class="btn-small btn-violet flex-shrink-0"
                @click="goToAssessment('pre_test')"
              >
                {{ langStore.locale === 'th' ? 'เข้าทำ' : 'Start' }}
              </button>
            </div>
            <div class="glass-widget full-width" v-if="assessmentConfig.post_test?.enabled">
              <div class="gw-icon bg-orange-50 text-orange-600 flex-shrink-0">
                <ClipboardCheckIcon :size="20" class="text-orange-600" />
              </div>
              <div class="gw-info">
                <h4>{{ langStore.locale === 'th' ? 'แบบประเมินหลังจบ' : 'Post-test' }}</h4>
                <p v-if="postTestCompleted" class="text-green font-bold text-sm">{{ langStore.locale === 'th' ? '✓ ทำเสร็จแล้ว' : '✓ Completed' }}</p>
                <p v-else-if="!isEventStarted" class="text-sub text-xs">{{ langStore.locale === 'th' ? 'เปิดเมื่อเริ่ม' : 'Opens on start' }}</p>
                <p v-else class="text-orange font-bold text-sm">{{ langStore.locale === 'th' ? 'ยังไม่ได้ทำ' : 'Not started' }}</p>
              </div>
              <button
                v-if="isRegistered && !postTestCompleted && isEventStarted && (isContinuousEvent || postTestEligible)"
                class="btn-small btn-emerald flex-shrink-0"
                @click="goToAssessment('post_test')"
              >
                {{ langStore.locale === 'th' ? 'เข้าทำ' : 'Start' }}
              </button>
            </div>
            <div class="glass-widget full-width flex-col items-start" v-if="shouldShowTanita">
              <div class="flex items-center justify-between w-full">
                <div class="flex items-center gap-3">
                  <div class="gw-icon bg-orange-50 text-orange-600 flex-shrink-0">
                    <ScaleIcon :size="20" class="text-orange-600" />
                  </div>
                  <div class="gw-info">
                    <h4>{{ langStore.locale === 'th' ? 'บันทึกค่าองค์ประกอบของร่างกาย' : 'Record Body Composition' }}</h4>
                    <p class="text-sub cursor-pointer hover:text-teal-600 transition" @click="openTanitaModal">
                      {{ langStore.locale === 'th' ? 'ดูรายงานการวิเคราะห์' : 'View Analysis Report' }}
                    </p>
                  </div>
                </div>
              </div>
              <div v-if="tanitaRequiredDates.length > 0" class="w-full mt-3 flex flex-col gap-2">
                <div
                  v-for="(dateItem, index) in tanitaRequiredDates"
                  :key="index"
                  class="flex items-center justify-between bg-white/50 p-2 rounded-lg border border-slate-200/50 text-sm"
                >
                  <span class="text-slate-600 font-semibold truncate flex-1">
                    {{ Number(index) + 1 }}. {{ getTanitaLabel(dateItem) || (langStore.locale === 'th' ? 'รอบที่ ' : 'Round ') + (Number(index) + 1) }}
                    <span v-if="getTanitaDate(dateItem)" class="text-xs text-slate-400 ml-1">
                      ({{ formatDateThai(getTanitaDate(dateItem)) }})
                    </span>
                  </span>
                  <button
                    v-if="hasTanitaRecord(`รอบที่ ${Number(index) + 1}`)"
                    class="btn-small btn-light-green py-1 px-2 flex-shrink-0 ml-2 flex items-center gap-1 font-bold text-[11px] rounded-md transition-all shadow-sm"
                    @click="openTanitaEntryModal(Number(index) + 1)"
                  >
                    <CheckCircleIcon :size="14" class="inline" /> {{ langStore.locale === 'th' ? 'บันทึกแล้ว' : 'Recorded' }}
                  </button>
                  <button
                    v-else-if="isRegistered && isPastOrToday(dateItem)"
                    class="btn-small btn-orange py-1 px-3 flex-shrink-0 ml-2 shadow-sm hover:scale-105 transition-all"
                    @click="openTanitaEntryModal(Number(index) + 1)"
                  >
                    {{ langStore.locale === 'th' ? 'บันทึกผล' : 'Record' }}
                  </button>
                  <span v-else class="text-sub text-xs flex-shrink-0 ml-2"><LockIcon :size="10" class="inline" /> {{ langStore.locale === 'th' ? 'รอถึงกำหนด' : 'Waiting' }}</span>
                </div>
              </div>
            </div>
          </div>
          <div v-if="event.inclusions" class="content-section highlight-box mt-6">
            <h3 class="section-title text-orange-600">
              <SparklesIcon :size="18" class="inline mr-1 flex-shrink-0" />
              {{ langStore.locale === 'th' ? 'สิ่งที่จะได้รับ' : 'What you will receive' }}
            </h3>
            <p class="prose" v-auto-translate="event.inclusions"></p>
          </div>
          <div v-if="event.rules_regulations" class="content-section mt-6">
            <h3 class="section-title">{{ langStore.locale === 'th' ? 'กติกาและเงื่อนไข' : 'Rules and Conditions' }}</h3>
            <div class="prose" v-html="sanitizedRules"></div>
          </div>
          <div v-for="(sec, i) in parsedSections" :key="i" class="content-section mt-6">
            <h3 class="section-title" v-auto-translate="sec.title"></h3>
            <img v-if="sec.image" :src="sec.image" class="w-full rounded-2xl mb-4 object-cover shadow-sm" />
            <div class="prose" v-html="sanitizeHtml(sec.content)"></div>
          </div>
          <div v-if="hasGoalConfig" id="goal-section" class="content-section goal-motivation-card mt-8">
            <div class="goal-card-header">
              <TrendingUpIcon class="goal-icon text-orange-500 flex-shrink-0" :size="24" />
              <h2 class="goal-title text-orange-600">{{ langStore.locale === 'th' ? 'เป้าหมายและความคืบหน้า' : 'Goals and Progress' }}</h2>
            </div>
            <div v-if="goalConfigParsed.enabled" class="goal-hero-card" style="color: #ffffff !important;">
              <div class="gh-content text-center">
                <div class="gh-label" style="color: rgba(255, 255, 255, 0.8) !important;">{{ langStore.locale === 'th' ? 'เป้าหมายรวม (TARGET)' : 'TOTAL TARGET' }}</div>
                <div class="gh-value flex-center flex-wrap gap-1" style="color: #ffffff !important;">
                  {{ goalConfigParsed.target_value?.toLocaleString() }}
                  <span class="gh-unit" style="color: #ffffff !important;">{{ goalUnitLabel }}</span>
                </div>
                <div v-if="goalConfigParsed.reward_text" class="gh-reward mt-2 text-orange-100 text-sm">
                  🏆 {{ goalConfigParsed.reward_text }}
                </div>
              </div>
            </div>
            <div v-if="goalLoading" class="goal-loading p-8 flex-center">
              <div class="spin-lg border-t-orange-500 border-4 border-slate-200 rounded-full w-8 h-8"></div>
            </div>
            <div v-else-if="goalData.length === 0" class="goal-empty p-8 text-center text-slate-400">
              {{ langStore.locale === 'th' ? 'ยังไม่มีข้อมูลผู้เข้าร่วม' : 'No participant data yet' }}
            </div>
            <div v-else class="goal-table-container mt-6">
              <div class="gt-controls flex flex-col sm:flex-row gap-3 mb-4">
                <div class="gt-search-box flex-1 flex items-center bg-white shadow-sm rounded-lg px-3 border border-slate-100 focus-within:border-orange-400">
                  <SearchIcon :size="16" class="text-slate-400 flex-shrink-0" />
                  <input
                    v-model="goalSearchQuery"
                    :placeholder="langStore.locale === 'th' ? 'ค้นหาชื่อ...' : 'Search name...'"
                    class="w-full bg-transparent border-none p-2 outline-none text-sm"
                    @input="goalCurrentPage = 1"
                  />
                </div>
                <div class="gt-sort-container relative flex-shrink-0 min-w-[180px] sm:min-w-[220px]">
                  <button @click.stop="isSortDropdownOpen = !isSortDropdownOpen" 
                    class="w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-white border border-slate-100 rounded-xl hover:border-orange-400 transition-all text-sm font-bold text-slate-700 shadow-sm">
                    <div class="flex items-center gap-2.5 min-w-0">
                      <TrendingUpIcon v-if="goalSortBy === 'progress_desc'" :size="16" class="text-orange-500 flex-shrink-0" />
                      <TrendingDownIcon v-else-if="goalSortBy === 'progress_asc'" :size="16" class="text-orange-500 flex-shrink-0" />
                      <TrophyIcon v-else-if="goalSortBy === 'points_desc'" :size="16" class="text-orange-500 flex-shrink-0" />
                      <TargetIcon v-else-if="goalSortBy === 'points_asc'" :size="16" class="text-orange-500 flex-shrink-0" />
                      <UserIcon v-else :size="16" class="text-orange-500 flex-shrink-0" />
                      <span class="truncate">{{ currentSortLabel }}</span>
                    </div>
                    <ChevronRightIcon :size="16" class="text-slate-400 transition-transform duration-300 flex-shrink-0" :class="{ 'rotate-90': isSortDropdownOpen }" />
                  </button>
                  <transition name="fade">
                    <div v-if="isSortDropdownOpen" class="absolute right-0 top-full mt-2 w-full min-w-[200px] bg-white border border-slate-100 rounded-2xl shadow-2xl z-[100] overflow-hidden py-1.5 animate-in slide-in-top">
                      <div v-for="opt in sortOptions" :key="opt.value" 
                        @click.stop="selectSort(opt.value)"
                        class="px-4 py-3 text-sm font-bold flex items-center gap-3 cursor-pointer transition-all hover:bg-orange-50 border-b border-slate-50 last:border-0"
                        :class="goalSortBy === opt.value ? 'text-orange-600 bg-orange-50' : 'text-slate-600'">
                        <TrendingUpIcon v-if="opt.value === 'progress_desc'" :size="16" class="flex-shrink-0" :class="goalSortBy === opt.value ? 'text-orange-600' : 'text-slate-400'" />
                        <TrendingDownIcon v-else-if="opt.value === 'progress_asc'" :size="16" class="flex-shrink-0" :class="goalSortBy === opt.value ? 'text-orange-600' : 'text-slate-400'" />
                        <TrophyIcon v-else-if="opt.value === 'points_desc'" :size="16" class="flex-shrink-0" :class="goalSortBy === opt.value ? 'text-orange-600' : 'text-slate-400'" />
                        <TargetIcon v-else-if="opt.value === 'points_asc'" :size="16" class="flex-shrink-0" :class="goalSortBy === opt.value ? 'text-orange-600' : 'text-slate-400'" />
                        <UserIcon v-else :size="16" class="flex-shrink-0" :class="goalSortBy === opt.value ? 'text-orange-600' : 'text-slate-400'" />
                        <span class="flex-1">{{ opt.label }}</span>
                        <CheckCircleIcon v-if="goalSortBy === opt.value" :size="16" class="text-orange-500" />
                      </div>
                    </div>
                  </transition>
                </div>
              </div>
              <div class="gt-rows flex flex-col gap-2">
                <div
                  v-for="item in paginatedGoalData"
                  :key="item.id"
                  class="gt-row flex items-center p-3 bg-white border border-slate-100 rounded-xl shadow-sm transition hover:border-orange-200"
                  :class="{ '!border-orange-400 bg-orange-50': isGoalCurrentUser(item) }"
                >
                  <div class="gt-col col-rank w-8 text-center font-bold text-slate-500 flex-shrink-0">
                    {{ getOriginalRank(item) }}
                  </div>
                  <div class="gt-col col-user flex-1 flex items-center gap-3 min-w-0">
                    <div class="w-10 h-10 rounded-full bg-slate-200 overflow-hidden flex-center text-slate-500 font-bold flex-shrink-0">
                      <img v-if="item.picture_url || item.image" :src="item.picture_url || item.image" class="w-full h-full object-cover" />
                      <span v-else>{{ (getGoalName(item)?.[0] || "?").toUpperCase() }}</span>
                    </div>
                    <div class="min-w-0">
                      <div class="font-bold text-slate-800 text-sm truncate">{{ getGoalName(item) }}</div>
                      <span v-if="isGoalCurrentUser(item)" class="text-[10px] bg-orange-200 text-orange-800 px-2 py-0.5 rounded uppercase inline-block mt-0.5">{{ langStore.locale === 'th' ? 'อันดับของฉัน' : 'My Rank' }}</span>
                    </div>
                  </div>
                  <div class="gt-col col-progress w-24 sm:w-32 md:w-48 px-2 flex-shrink-0 min-w-0">
                    <div class="flex justify-between text-[10px] sm:text-xs font-bold mb-1">
                      <span class="text-slate-800">{{ Number(item.achieved || 0).toLocaleString("th-TH") }}</span>
                      <span class="text-slate-400 truncate ml-1">/ {{ Number(item.target || 0).toLocaleString("th-TH") }}</span>
                    </div>
                    <div class="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div class="h-full bg-primary transition-all" :style="{ width: `${Math.min(100, item.percent || 0)}%` }"></div>
                    </div>
                  </div>
                  <div class="gt-col col-status w-16 sm:w-20 text-right pr-1 flex-shrink-0 min-w-0">
                    <div class="text-xs sm:text-sm font-black text-primary truncate">{{ Number(item.points_achieved || 0).toLocaleString() }}</div>
                    <div class="text-[10px] text-slate-400 font-bold">{{ langStore.locale === 'th' ? 'คะแนน' : 'Points' }}</div>
                  </div>
                </div>
              </div>
              <div v-if="totalGoalPages > 1" class="flex justify-center items-center gap-4 mt-6">
                <button @click="goalCurrentPage--" :disabled="goalCurrentPage === 1" class="flex items-center justify-center border border-slate-200 rounded-full hover:bg-slate-50 disabled:opacity-50 text-orange-500 flex-shrink-0" style="width: 40px; height: 40px; min-width: 40px; min-height: 40px; padding: 0 !important;">
                  <ChevronLeftIcon :size="16" />
                </button>
                <span class="text-sm font-bold text-slate-600">หน้า {{ goalCurrentPage }} / {{ totalGoalPages }}</span>
                <button @click="goalCurrentPage++" :disabled="goalCurrentPage === totalGoalPages" class="flex items-center justify-center border border-slate-200 rounded-full hover:bg-slate-50 disabled:opacity-50 text-orange-500 flex-shrink-0" style="width: 40px; height: 40px; min-width: 40px; min-height: 40px; padding: 0 !important;">
                  <ChevronRightIcon :size="16" />
                </button>
              </div>
            </div>
          </div>
        </div>
        <div class="right-column desktop-only-block">
          <div class="registration-card shadow-sm border border-slate-100 p-6 rounded-2xl bg-white">
            <div v-if="event.organizer" class="inline-flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100 mb-4 max-w-full">
              <span class="font-bold text-sm text-slate-700 truncate">{{ langStore.locale === 'th' ? 'จัดโดย:' : 'Organized by:' }} {{ event.organizer }}</span>
            </div>
            <div class="rc-info-list mb-6 space-y-2 text-sm border-b border-slate-100 pb-5">
              <div class="flex gap-2">
                <span class="min-w-[100px] font-bold shrink-0">{{ langStore.locale === 'th' ? 'วันเริ่มกิจกรรม :' : 'Start Date :' }}</span>
                <span class="flex-1 break-words">{{ formatDateThai(event.start_date) || (langStore.locale === 'th' ? "จัดต่อเนื่อง" : "Continuous") }}</span>
              </div>
              <div class="flex gap-2">
                <span class="min-w-[100px] font-bold shrink-0">{{ langStore.locale === 'th' ? 'วันสิ้นสุดกิจกรรม :' : 'End Date :' }}</span>
                <span class="flex-1 break-words">{{ formatDateThai(event.end_date || event.start_date) || (langStore.locale === 'th' ? "จัดต่อเนื่อง" : "Continuous") }}</span>
              </div>
              <div class="flex gap-2">
                <span class="min-w-[100px] font-bold shrink-0">{{ langStore.locale === 'th' ? 'เวลาจัดกิจกรรม :' : 'Time :' }}</span>
                <span class="flex-1 break-words">
                  {{ event.start_time?.slice(0, 5) || "08:00" }} – {{ event.end_time?.slice(0, 5) || "17:00" }} {{ langStore.locale === 'th' ? 'น.' : '' }}
                </span>
              </div>
              <div class="flex gap-2">
                <span class="min-w-[100px] font-bold shrink-0">{{ langStore.locale === 'th' ? 'สถานที่จัด :' : 'Location :' }}</span>
                <span class="flex-1 break-words">{{ event.location_name || "Virtual" }}</span>
              </div>
              <div class="flex gap-2">
                <span class="min-w-[100px] font-bold shrink-0">{{ langStore.locale === 'th' ? 'จำนวนรับสมัคร :' : 'Capacity :' }}</span>
                <span class="text-orange-600 flex-1 break-words flex items-center gap-2">
                  {{ event.registration_count ?? event.filled ?? 0 }} / {{ isUnlimited ? (langStore.locale === 'th' ? "ไม่จำกัด" : "Unlimited") : event.max_slots || event.total || 0 }} {{ langStore.locale === 'th' ? 'คน' : 'pax' }}
                  <span v-if="slotFull" class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-600 border border-red-200 animate-pulse">{{ langStore.locale === 'th' ? 'เต็มแล้ว' : 'Full' }}</span>
                </span>
              </div>
            </div>
            <div class="rc-header mb-4 flex justify-between items-center gap-2">
              <h2 class="text-lg font-bold text-slate-800 truncate">{{ langStore.locale === 'th' ? 'ช่วงรับสมัคร' : 'Registration Period' }}</h2>
              <div v-if="slotFull" class="badge-status closed text-xs bg-red-100 text-red-700 px-2 py-1 rounded whitespace-nowrap shrink-0">{{ langStore.locale === 'th' ? 'กิจกรรมเต็ม' : 'Event Full' }}</div>
              <div v-else class="badge-status open text-xs bg-green-100 text-green-700 px-2 py-1 rounded whitespace-nowrap shrink-0">{{ langStore.locale === 'th' ? 'เปิดรับสมัคร' : 'Open' }}</div>
            </div>
            <div class="rc-info-list mb-6 space-y-2 text-sm">
              <div class="flex gap-2">
                <span class="min-w-[100px] font-bold shrink-0">{{ langStore.locale === 'th' ? 'เปิดรับสมัคร :' : 'Opens :' }}</span>
                <span class="flex-1 break-words">{{ formatDateThai(event.registration_start_date || event.start_date) || (langStore.locale === 'th' ? "เปิดรับสมัครต่อเนื่อง" : "Always Open") }}</span>
              </div>
              <div class="flex gap-2">
                <span class="min-w-[100px] font-bold shrink-0">{{ langStore.locale === 'th' ? 'ปิดรับสมัคร :' : 'Closes :' }}</span>
                <span class="flex-1 break-words">{{ formatDateThai(event.registration_end_date || event.end_date || event.start_date) || (langStore.locale === 'th' ? "เปิดรับสมัครต่อเนื่อง" : "Always Open") }}</span>
              </div>
              <p class="text-xs text-slate-400 mt-2 flex items-start gap-1">
                <AlertCircleIcon :size="12" class="mt-0.5 shrink-0" />
                <span class="flex-1 break-words">{{ langStore.locale === 'th' ? 'หรือปิดรับสมัครทันทีเมื่อผู้สมัครครบเต็มจำนวน' : 'Or closes immediately when capacity is reached' }}</span>
              </p>
            </div>
          <div class="action-section-sidebar mt-2">
            <div class="flex flex-col gap-3 pb-4 border-b border-slate-100 mb-4">
              <div class="flex gap-2 min-w-0">
                <span class="min-w-[100px] font-bold shrink-0">{{ langStore.locale === 'th' ? 'สิทธิ์การเข้าร่วม :' : 'Eligibility :' }}</span>
                <div class="flex flex-wrap gap-1.5 flex-1 min-w-0">
                  <span v-if="!allowedGroups || allowedGroups.length === 0 || allowedGroups.includes('general')" class="text-green-600 font-bold">{{ langStore.locale === 'th' ? 'ทุกคนสามารถเข้าร่วมได้' : 'Everyone can join' }}</span>
                  <span
                    v-else
                    v-for="g in allowedGroups"
                    :key="g"
                    class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-100"
                  >{{ g === 'my_team' ? (langStore.locale === 'th' ? 'เฉพาะสมาชิกในทีมผู้จัด' : 'Organizer team members only') : (g === 'other_teams' ? (langStore.locale === 'th' ? 'สมาชิกทุกทีม' : 'All team members') : g) }}</span>
                </div>
              </div>
              <div class="flex gap-2 min-w-0" v-if="authStore.user">
                <span class="min-w-[100px] font-bold shrink-0">{{ langStore.locale === 'th' ? 'สถานะของคุณ :' : 'Your Status :' }}</span>
                <span class="text-slate-600 flex-1">{{ currentUserRoleLabel || (langStore.locale === 'th' ? 'บุคคลทั่วไป' : 'General User') }}</span>
              </div>
            </div>
            <div v-if="!isRegistered && !hasPermissionToJoin" class="alert-box error mb-4 p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">
              <div class="flex items-start gap-3">
                <AlertCircleIcon :size="20" class="mt-0.5 flex-shrink-0" />
                <div class="flex-1 min-w-0">
                  <div class="mb-3 pb-2 border-b border-red-100">
                    <div class="text-[10px] uppercase tracking-wider font-bold opacity-60 mb-0.5">{{ langStore.locale === 'th' ? 'สถานะปัจจุบันของคุณ' : 'Your Current Status' }}</div>
                    <div class="font-bold text-base break-words">{{ currentUserRoleLabel }}</div>
                    </div>
                    <div>
                      <div class="text-[10px] uppercase tracking-wider font-bold opacity-60 mb-0.5">{{ langStore.locale === 'th' ? 'เหตุผล' : 'Reason' }}</div>
                      <div class="font-bold text-sm break-words">{{ noPermissionReason || (langStore.locale === 'th' ? "คุณไม่มีสิทธิ์เข้าร่วมกิจกรรมนี้" : "You don't have permission to join this event") }}</div>
                    </div>
                  </div>
                </div>
              </div>
              <template v-if="!isRegistered">
                <div class="pdpa-consent mb-4">
                  <label class="pdpa-row">
                    <input type="checkbox" id="acceptDisclosure" v-model="acceptDataDisclosure" />
                    <span class="pdpa-checkbox-wrap">
                      <span class="pdpa-custom-box" :class="{ checked: acceptDataDisclosure }">
                        <svg v-if="acceptDataDisclosure" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </span>
                    </span>
                    <span class="pdpa-label-text">{{ langStore.locale === 'th' ? 'ยอมรับเงื่อนไขและยินยอมให้แสดงผลข้อมูลส่วนบุคคลในกิจกรรม' : 'I agree to the terms and consent to sharing my personal data' }}</span>
                  </label>
                </div>
                <button class="btn-massive primary-orange w-full force-white-text" :class="{ 'btn-disabled': !acceptDataDisclosure }" style="color: #ffffff !important;" @click="joinActivity" :disabled="joining || slotFull || !hasPermissionToJoin || !acceptDataDisclosure">
                  <LoaderIcon v-if="joining" class="spin" />
                  <span v-else-if="slotFull" style="color: #ffffff !important;">{{ langStore.locale === 'th' ? 'ที่นั่งเต็มแล้ว' : 'Fully booked' }}</span>
                  <span v-else-if="!hasPermissionToJoin" style="color: #ffffff !important;"><LockIcon :size="18" class="mr-2 inline" style="color: #ffffff !important;" /> {{ langStore.locale === 'th' ? 'ไม่มีสิทธิ์เข้าร่วม' : 'No Permission' }}</span>
                  <span v-else style="color: #ffffff !important;"><ActivityIcon :size="18" class="mr-2 inline" style="color: #ffffff !important;" /> {{ langStore.locale === 'th' ? 'สมัครเข้าร่วมกิจกรรม' : 'Join Event' }}</span>
                </button>
              </template>
              <template v-else>
                <button class="btn-outline-red w-full" @click="leaveActivity" :disabled="joining">
                  {{ langStore.locale === 'th' ? 'ออกจากกิจกรรม' : 'Leave Event' }}
                </button>
              </template>
            </div>
          </div>
          </div>
      </div>
    </main>
    <div class="mobile-bar mobile-only-flex flex-col gap-2 p-4 h-auto bg-white border-t border-slate-100">
      <template v-if="!isRegistered">
        <div class="pdpa-consent w-full">
          <label class="pdpa-row">
            <input type="checkbox" id="acceptDisclosureMob" v-model="acceptDataDisclosure" />
            <span class="pdpa-checkbox-wrap">
              <span class="pdpa-custom-box" :class="{ checked: acceptDataDisclosure }">
                <svg v-if="acceptDataDisclosure" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </span>
            </span>
            <span class="pdpa-label-text">{{ langStore.locale === 'th' ? 'ยอมรับเงื่อนไขและยินยอมให้แสดงผลข้อมูลในกิจกรรม' : 'I agree to the terms and consent' }}</span>
          </label>
        </div>
        <button class="mob-btn-primary force-white-text w-full" :class="{ 'btn-disabled': !acceptDataDisclosure }" style="color: #ffffff !important;" :disabled="slotFull || joining || !hasPermissionToJoin || !acceptDataDisclosure" @click="joinActivity">
          <LoaderIcon v-if="joining" class="spin" :size="18" />
          <span v-else-if="!hasPermissionToJoin" style="color: #ffffff !important;">{{ langStore.locale === 'th' ? 'ไม่มีสิทธิ์เข้าร่วม' : 'No Permission' }}</span>
          <span v-else-if="slotFull" style="color: #ffffff !important;">{{ langStore.locale === 'th' ? 'กิจกรรมเต็มแล้ว' : 'Event Full' }}</span>
          <span v-else style="color: #ffffff !important;"><ActivityIcon :size="18" class="mr-2 inline" style="color: #ffffff !important;" /> {{ langStore.locale === 'th' ? 'สมัครเข้าร่วมกิจกรรม' : 'Join Event' }}</span>
        </button>
      </template>
      <template v-else>
        <button class="mob-btn-primary secondary-red" :disabled="joining" @click="leaveActivity">
          <LoaderIcon v-if="joining" class="spin" :size="18" />
          <span v-else>{{ langStore.locale === 'th' ? 'ออกจากกิจกรรม' : 'Leave Event' }}</span>
        </button>
      </template>
    </div>
    <Teleport to="body">
      <Transition name="ios-slide">
        <div v-if="showTanitaModal" class="hc-overlay" @click.self="showTanitaModal = false">
          <div class="hc-sheet">
            <div class="hc-header">
              <h2>{{ langStore.locale === 'th' ? 'รายงานร่างกาย' : 'Body Report' }}</h2>
              <button class="hc-close" @click="showTanitaModal = false"><XIcon :size="20" stroke-width="3" /></button>
            </div>
            <div v-if="loadingTanita" class="p-10 flex-center">
              <div class="spin-lg border-t-orange-500 border-4 border-slate-200 rounded-full w-8 h-8"></div>
            </div>
            <div v-else-if="tanitaRecords.length === 0" class="p-10 text-center text-slate-500 font-bold">
              {{ langStore.locale === 'th' ? 'ยังไม่มีข้อมูลร่างกาย' : 'No body data available' }}
            </div>
            <div v-else class="hc-body">
              <div class="hc-glance-row">
                <div class="hc-glance-card">
                  <span class="hgc-lbl">{{ langStore.locale === 'th' ? 'น้ำหนัก' : 'Weight' }}</span>
                  <span class="hgc-val">{{ Number(tanitaRecords[0].weight || 0).toFixed(1) }} <span class="text-sm text-slate-400">kg</span></span>
                </div>
                <div class="hc-glance-card">
                  <span class="hgc-lbl">{{ langStore.locale === 'th' ? 'ไขมัน' : 'Fat' }}</span>
                  <span class="hgc-val">{{ Number(tanitaRecords[0].fat_pc || 0).toFixed(1) }} <span class="text-sm text-slate-400">%</span></span>
                </div>
                <div class="hc-glance-card">
                  <span class="hgc-lbl">{{ langStore.locale === 'th' ? 'กล้ามเนื้อ' : 'Muscle' }}</span>
                  <span class="hgc-val">{{ Number(tanitaRecords[0].muscle_mass || 0).toFixed(1) }} <span class="text-sm text-slate-400">kg</span></span>
                </div>
              </div>
              <div class="hc-smart-insight mt-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                <h4 class="font-bold text-slate-800 mb-2 text-lg">💡 {{ langStore.locale === 'th' ? 'บทวิเคราะห์:' : 'Analysis:' }} {{ healthSummaryText }}</h4>
                <p class="text-sm text-slate-500">{{ langStore.locale === 'th' ? 'สัดส่วนกล้ามเนื้อต่อไขมัน:' : 'Muscle to Fat Ratio:' }} {{ currentMuscleToFatRatio }} ({{ muscleFatTrendText }})</p>
              </div>
            </div>
          </div>
        </div>
      </Transition>
      <Transition name="fade-scale">
        <div v-if="popupQueue.length > 0 && !popupsDismissed" class="assessment-popup-overlay">
          <div class="carousel-container" @touchstart="handleTouchStart" @touchend="handleTouchEnd">
            <button v-if="activePopupIndex > 0" class="nav-arrow left" @click="activePopupIndex--"><ChevronLeftIcon :size="24" /></button>
            <div class="carousel-track" :style="{ transform: `translateX(-${activePopupIndex * 100}%)` }">
              <div v-for="(popup, idx) in popupQueue" :key="idx" class="carousel-slide">
                <div class="assessment-popup-card" :class="getPopupTheme(popup.type)">
                  <button class="ap-close-btn" @click="dismissAllPopups"><XIcon :size="20" stroke-width="2.5" /></button>
                  <div class="ap-icon-wrap">
                    <ClipboardListIcon v-if="popup.type === 'pre_test'" class="w-8 h-8 flex-shrink-0" />
                    <ClipboardCheckIcon v-else-if="popup.type === 'post_test'" class="w-8 h-8 flex-shrink-0" />
                    <ScaleIcon v-else class="w-8 h-8 flex-shrink-0" />
                  </div>
                  <h3 class="ap-title">{{ getPopupTitle(popup) }}</h3>
                  <p class="ap-desc">
                    {{
                      popup.type === "pre_test"
                        ? (langStore.locale === 'th' ? "กรุณาทำแบบทดสอบก่อนเริ่มกิจกรรม" : "Please complete the pre-test before starting")
                        : popup.type === "post_test"
                          ? (langStore.locale === 'th' ? "กรุณาทำแบบประเมินหลังจบกิจกรรม" : "Please complete the post-test")
                          : (langStore.locale === 'th' ? "ถึงรอบบันทึกผลองค์ประกอบร่างกายแล้ว" : "Time to record body composition")
                    }}
                  </p>
                  <button class="ap-btn-primary" @click="goToAssessment(popup)">{{ langStore.locale === 'th' ? 'เข้าทำแบบฟอร์ม' : 'Start Form' }}</button>
                  <button class="ap-btn-secondary mt-2" @click="dismissAllPopups">{{ langStore.locale === 'th' ? 'ข้ามไปก่อน' : 'Skip for now' }}</button>
                </div>
              </div>
            </div>
            <button v-if="activePopupIndex < popupQueue.length - 1" class="nav-arrow right" @click="activePopupIndex++"><ChevronRightIcon :size="24" /></button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from "vue";
import { useRouter } from "vue-router";
import Swal from "sweetalert2";
import { authStore } from "../store/auth";
import { langStore } from "../store/lang";
import {
  ArrowLeft as ArrowLeftIcon,
  CheckCircle as CheckCircleIcon,
  Calendar as CalendarIcon,
  Clock as ClockIcon,
  MapPin as MapPinIcon,
  Users as UsersIcon,
  Activity as ActivityIcon,
  ArrowRight as ArrowRightIcon,
  Loader2 as LoaderIcon,
  Award as AwardIcon,
  Lock as LockIcon,
  AlertCircle as AlertCircleIcon,
  Trophy as TrophyIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  LineChart as ChartIcon,
  ChevronRight as ChevronRightIcon,
  Sparkles as SparklesIcon,
  ClipboardCheck as ClipboardCheckIcon,
  ClipboardList as ClipboardListIcon,
  Scale as ScaleIcon,
  UserRound as UserIcon,
  ListTodo as ListTodoIcon,
  ChevronLeft as ChevronLeftIcon,
  Search as SearchIcon,
  Heart as HeartIcon,
  Share2 as ShareIcon,
  X as XIcon,
  Target as TargetIcon,
} from "lucide-vue-next";
import { useEventDetail } from "../composables/useEventDetail";
const router = useRouter();
const {
  event,
  loading,
  loadError,
  parsedSections,
  isRegistered,
  joining,
  hasPermissionToJoin,
  noPermissionReason,
  allowedGroups,
  isHost,
  registerTeamMode,
  claiming,
  isEligible,
  certReason,
  certStatus,
  certCriteria,
  preTestCompleted,
  postTestCompleted,
  popupQueue,
  activePopupIndex,
  popupsDismissed,
  tanitaRecords,
  showTanitaModal,
  loadingTanita,
  acceptDataDisclosure,
  goalViewTab,
  goalLoading,
  goalData,
  goalConfigData,
  goalSearchQuery,
  goalSortBy,
  goalCurrentPage,
  isFavorited,
  favoriteCount,
  showFloater,
  route,
  isUnlimited,
  isContinuousEvent,
  assessmentConfig,
  certConfigParsed,
  isPreTestRequired,
  isPostTestRequired,
  isEventStarted,
  slotFull,
  totalMissionsCount,
  completedMissionsCount,
  shouldShowTanita,
  currentMuscleToFatRatio,
  healthSummaryText,
  muscleFatTrendText,
  muscleFatTrendClass,
  hasGoalConfig,
  goalConfigParsed,
  goalUnitLabel,
  paginatedGoalData,
  totalGoalPages,
  sanitizedRules,
  postTestEligible,
  tanitaRequiredDates,
  slotPct,
  certConditionText,
  certCardState,
  userActivityScore,
  userActivityRank,
  joinActivity,
  leaveActivity,
  toggleFavorite,
  shareSocial,
  claimCert,
  openTanitaModal,
  goToAssessment,
  formatDateThai,
  getGoalName,
  getOriginalRank,
  isGoalCurrentUser,
  scrollToGoal,
  handleBack,
  goToMissions,
  getTanitaDate,
  getTanitaLabel,
  isPastOrToday,
  hasTanitaRecord,
  handleTouchStart,
  handleTouchEnd,
  sanitizeHtml,
  getPopupTheme,
  getPopupTitle,
  dismissAllPopups,
  currentUserRoleLabel,
} = useEventDetail();
const openTanitaEntryModal = (roundIndex: number) => {
  const eventId = route.params.id;
  router.push({
    path: "/body-composition",
    query: {
      fromEventId: eventId,
      session_label: `รอบที่ ${roundIndex}`
    }
  });
};
// Custom Sort Dropdown
const isSortDropdownOpen = ref(false);
const sortOptions = computed(() => [
  { value: "progress_desc", label: langStore.locale === 'th' ? "ความคืบหน้า (มาก-น้อย)" : "Progress (High-Low)", icon: "TrendingUpIcon" },
  { value: "progress_asc", label: langStore.locale === 'th' ? "ความคืบหน้า (น้อย-มาก)" : "Progress (Low-High)", icon: "TrendingDownIcon" },
  { value: "points_desc", label: langStore.locale === 'th' ? "คะแนนสะสมสูงสุด" : "Highest Points", icon: "TrophyIcon" },
  { value: "points_asc", label: langStore.locale === 'th' ? "คะแนนสะสมน้อยสุด" : "Lowest Points", icon: "TargetIcon" },
  { value: "name_asc", label: langStore.locale === 'th' ? "ชื่อ (ก-ฮ)" : "Name (A-Z)", icon: "UserIcon" },
]);
const currentSortLabel = computed(() => {
  return sortOptions.value.find(o => o.value === goalSortBy.value)?.label || (langStore.locale === 'th' ? "จัดเรียง" : "Sort");
});
const selectSort = (val: string) => {
  goalSortBy.value = val;
  isSortDropdownOpen.value = false;
  goalCurrentPage.value = 1;
};
// Close dropdown on click outside
onMounted(() => {
  window.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('.gt-sort-container')) {
      isSortDropdownOpen.value = false;
    }
  });
});
</script>
<style scoped>
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Sarabun:wght@400;500;600;700;800&display=swap");
.event-page {
  font-family: "Sarabun", "Inter", sans-serif;
  background-color: #FFFFFF;
  min-height: 100vh;
  position: relative;
  color: #000000;
  box-sizing: border-box;
  overflow: clip;
  width: 100%;
}
.event-page, 
.event-page * {
  font-family: "Sarabun", "Inter", sans-serif !important;
}
.event-page :deep(.text-slate-900),
.event-page :deep(.text-slate-800),
.event-page :deep(.text-slate-700),
.event-page :deep(.text-slate-600),
.event-page :deep(.text-slate-500),
.event-page :deep(.text-slate-400),
.event-page :deep(.text-sub),
.event-page :deep(.prose),
.event-page :deep(p),
.event-page :deep(span),
.event-page :deep(h1),
.event-page :deep(h2),
.event-page :deep(h3),
.event-page :deep(h4),
.event-page :deep(div),
.event-page :deep(button:not(.primary-orange):not(.btn-orange):not(.btn-teal):not(.btn-massive)) {
  color: #000000 !important;
}
/* Specific overrides for buttons and status badges that should keep some color but have black text if appropriate */
.event-page :deep(.badge-status.open) {
  color: #166534 !important; /* Darker green for readability with Sarabun */
}
*, *::before, *::after { box-sizing: border-box !important; }
/* Sort Dropdown Animations */
.slide-in-top {
  animation: slideInTop 0.2s cubic-bezier(0, 0, 0.2, 1);
}
@keyframes slideInTop {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}
.gt-sort-container button {
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}
.gt-sort-container button:hover {
  box-shadow: 0 4px 12px rgba(255, 107, 0, 0.1);
}
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
<style>
html, body {
  overflow-x: clip !important;
  width: 100% !important;
  position: relative !important;
  margin: 0 !important;
  padding: 0 !important;
}
</style>
<style scoped>
.mobile-only-flex { display: none; }
.mobile-only-block { display: none; }
.desktop-only-block { display: block; }
.flex-center { display: flex; align-items: center; justify-content: center; flex-direction: column; }
.flex-col { flex-direction: column; }
.items-start { align-items: flex-start; }
.full-h { min-height: 100vh; }
.loading-page, .error-page { width: 100%; background: #fff; }
.hero-blur-container {
  position: absolute; top: 0; left: 0; right: 0; height: 50vh;
  z-index: 0; overflow: hidden;
}
.hero-blur-image {
  width: 100%; height: 100%; background-size: cover; background-position: center;
  filter: blur(80px); transform: scale(1.1);
  opacity: 0.3;
}
.hero-blur-overlay {
  position: absolute; inset: 0; background: linear-gradient(to bottom, transparent 0%, rgba(255,255,255,1) 100%);
}

/* =====================================
   🎯 Container matching Profile's layout-container 
===================================== */
.main-content {
  position: relative; 
  z-index: 10; 
  max-width: 1200px;
  margin: 0 auto 100px; 
  padding: 40px 24px 0;
  width: 100%;
}

.title-with-back {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}
.btn-back-hero {
  background: white;
  border: 1px solid #f1f5f9;
  width: 44px;
  height: 44px;
  min-width: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  color: #000000;
  transition: all 0.2s ease;
}
.btn-back-hero:hover {
  transform: translateX(-4px);
  box-shadow: 0 6px 16px rgba(0,0,0,0.08);
}
.event-title-hero {
  font-size: 2.8rem; font-weight: 900; line-height: 1.2; color: #000000;
  margin: 0; letter-spacing: -1px;
  overflow-wrap: break-word;
  word-wrap: break-word;
  word-break: break-word;
}
.content-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 420px; 
  gap: 24px; /* เริ่มต้นด้วย 24px สำหรับหน้าจอขนาดกลางลงมา */
  align-items: stretch;
  width: 100%;
  min-width: 0;
}

@media (min-width: 768px) {
  .main-content {
    max-width: 1440px; /* ขยายความกว้างสูงสุดให้เท่ากับ Profile */
  }
  .content-grid {
    gap: 32px; /* ใช้ช่องว่าง 32px แบบ Profile บนหน้าจอใหญ่ */
  }
}

.left-column { width: 100%; max-width: 100%; }
.right-column {
  position: -webkit-sticky;
  position: sticky;
  top: 90px;
  align-self: start; 
  width: 100%;
}
.poster-wrapper {
  position: relative;
  width: 100%; aspect-ratio: 1/1; border-radius: 16px; overflow: hidden;
  box-shadow: 0 10px 30px rgba(0,0,0,0.1);
}
.poster-img { width: 100%; height: 100%; object-fit: cover; }
.status-badge {
  position: absolute; top: 16px; right: 16px; padding: 6px 14px; border-radius: 99px;
  font-size: 0.75rem; font-weight: 700;
  text-transform: uppercase; backdrop-filter: blur(10px);
}
.status-badge.live { background: rgba(255, 255, 255, 0.95); color: #ea580c; }
.status-badge.upcoming { background: rgba(0, 0, 0, 0.6); color: #fff; }
.widgets-container { 
  display: grid; 
  grid-template-columns: 1fr; 
  gap: 16px;
}
.glass-widget.full-width {
  grid-column: span 2;
}
@media (max-width: 768px) {
  .main-content { padding: 24px 16px 100px; }
  .widgets-container {
    grid-template-columns: 1fr;
  }
  .glass-widget.full-width {
    grid-column: span 1;
  }
}
.glass-widget { 
  background: #ffffff; 
  border: 1px solid #f1f5f9; 
  padding: 16px; 
  border-radius: 16px; 
  display: flex; 
  align-items: center; 
  gap: 12px; 
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.glass-widget:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
}
.gw-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; justify-content: center; align-items: center; }
.gw-info { flex: 1; min-width: 0; }
.gw-info h4 { margin: 0 0 2px; font-size: 0.85rem; font-weight: 700; color: #000000; }
.gw-info p { margin: 0; font-size: 0.75rem; color: #64748b; }
.content-section { margin-top: 32px; width: 100%; overflow: hidden; }
.highlight-box { background: #fff7ed; border-radius: 16px; padding: 24px; }
.section-title { font-size: 1.4rem; font-weight: 800; color: #000000; margin: 0 0 16px; }
.prose { font-size: 1rem; line-height: 1.7; color: #000000; overflow-wrap: break-word; word-break: break-word; }
.btn-massive { width: 100%; padding: 16px; border-radius: 12px; font-size: 1.05rem; font-weight: 700; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease; }
.primary-orange { background: #f97316; color: #ffffff !important; }
.green { background: #10b981; color: #fff; }
.btn-massive:disabled { background: #cbd5e1; color: #f8fafc; cursor: not-allowed; }
.btn-outline-red { background: transparent; border: 1px solid #fca5a5; color: #ef4444; padding: 12px; border-radius: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
.btn-small { padding: 6px 12px; border-radius: 8px; font-size: 0.75rem; font-weight: 700; border: none; cursor: pointer; }
.btn-orange { background: #fff7ed; color: #ea580c; border: 1px solid #ffedd5; }
.btn-blue { background: #eff6ff; color: #2563eb; border: 1px solid #dbeafe; }
.btn-violet { background: #f5f3ff; color: #7c3aed; border: 1px solid #ede9fe; }
.btn-emerald { background: #ecfdf5; color: #059669; border: 1px solid #d1fae5; }
.btn-light-green { background: #dcfce7; color: #16a34a; border: 1px solid #bbf7d0; }
.btn-light-orange { background: #fff7ed; color: #f97316; border: 1px solid #ffedd5; }
.btn-teal { background: #f0fdfa; color: #0d9488; border: 1px solid #ccfbf1; }
.btn-disabled { background: #f1f5f9; color: #94a3b8; cursor: not-allowed; }
@media (max-width: 992px) {
  .desktop-only-block { display: none !important; }
  .mobile-only-block { display: block !important; }
  .mobile-only-flex { display: flex !important; }
  .mobile-bar { display: flex !important; }
  .content-grid { display: block; width: 100%; }
  .left-column { width: 100%; max-width: 100%; }
  .event-title-hero { font-size: 2.2rem; }
}
@media (max-width: 640px) {
  .event-title-hero { font-size: 1.6rem; }
  .mobile-details-block { padding: 16px !important; max-width: 100%; }
  .gt-col.col-progress { width: 80px !important; }
  .gt-col.col-status { width: 50px !important; }
  .gt-col.col-rank { width: 24px !important; }
}
@media (max-width: 375px) {
  .main-content { padding: 20px 16px 100px; }
  .mobile-details-block { padding: 12px !important; }
  .event-title-hero { font-size: 1.4rem; }
  .rc-header { flex-direction: column; align-items: flex-start !important; gap: 4px !important; }
  .badge-status { align-self: flex-start; }
}
.mobile-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  padding: 16px 20px calc(16px + env(safe-area-inset-bottom, 0px));
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  z-index: 201;
  border-top: 1px solid #e2e8f0;
  box-shadow: 0 -10px 25px rgba(0, 0, 0, 0.05);
  pointer-events: auto;
  display: none;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.mob-btn-primary { 
  pointer-events: auto;
  height: 54px; 
  border-radius: 99px; 
  background: #f97316; 
  color: #ffffff !important;
  font-weight: 800; 
  font-size: 1.05rem; 
  border: none; 
  display: flex; 
  justify-content: center; 
  align-items: center; 
  padding: 0 24px;
  box-shadow: 0 8px 25px rgba(249, 115, 22, 0.4);
  width: auto;
  min-width: 160px;
  max-width: 100%;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.mob-btn-primary.secondary-red {
  background: #fef2f2;
  color: #ef4444;
  border: 1.5px solid #fee2e2;
  box-shadow: 0 8px 20px rgba(239, 68, 68, 0.1);
}
.mob-btn-primary.secondary-red:hover {
  background: #fee2e2;
}
.mob-btn-primary:disabled { background: #cbd5e1; color: #f8fafc; cursor: not-allowed; box-shadow: none; }
.goal-motivation-card { padding: 32px; text-align: center; }
.goal-card-header { display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 20px; }
.goal-title { font-size: 1.5rem; font-weight: 800; margin: 0; }
.goal-tabs-wrap { margin-bottom: 16px; }
.goal-pill-bg { position: relative; background: #f1f5f9; border-radius: 12px; padding: 4px; display: flex; gap: 4px; max-width: 300px; margin: 0 auto; }
.goal-pill-slider { position: absolute; top: 4px; left: 4px; width: calc(50% - 6px); height: calc(100% - 8px); background: #ffffff; border-radius: 9px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05); transition: transform 0.3s ease; }
.goal-pill { position: relative; flex: 1; padding: 8px 0; font-size: 14px; font-weight: 700; color: #64748b; background: transparent; border: none; cursor: pointer; z-index: 1; display: flex; align-items: center; justify-content: center; gap: 6px; transition: color 0.2s; }
.goal-pill.active { color: #ea580c; }
.goal-hero-card { background: linear-gradient(135deg, #f97316, #ea580c); color: #ffffff !important; padding: 24px; border-radius: 18px; box-shadow: 0 10px 24px rgba(249, 115, 22, 0.25); margin-bottom: 24px; }
.gh-label { font-size: 11px; font-weight: 800; letter-spacing: 1px; color: rgba(255, 255, 255, 0.8) !important; margin-bottom: 4px; }
.gh-value { font-size: 36px; font-weight: 800; line-height: 1; color: #ffffff !important; }
.gh-unit { font-size: 16px; font-weight: 600; opacity: 0.9; margin-left: 4px; color: #ffffff !important; }
.hc-overlay { position: fixed; inset: 0; z-index: 9999; background: rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 20px; }
.hc-sheet { background: #ffffff; width: 100%; max-width: 500px; max-height: 90vh; border-radius: 24px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); }
.hc-header { padding: 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; background: #fff; }
.hc-header h2 { margin: 0; font-size: 1.2rem; font-weight: 800; color: #000000; }
.hc-close { padding: 0; background: none; border: none; color: #64748b; cursor: pointer; transition: color 0.2s; min-width: 32px; min-height: 32px; aspect-ratio: 1/1; display: flex; align-items: center; justify-content: center; border-radius: 50%; }
.hc-close:hover { color: #f97316; background: #f1f5f9; }
.hc-body { padding: 20px; overflow-y: auto; }
.hc-glance-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.hc-glance-card { background: white; padding: 16px; border-radius: 16px; text-align: center; border: 1px solid #e2e8f0; }
.hgc-lbl { display: block; font-size: 0.8rem; font-weight: 700; color: #64748b; margin-bottom: 4px; }
.hgc-val { font-size: 1.5rem; font-weight: 800; color: #f97316; }
.assessment-popup-overlay { position: fixed; inset: 0; z-index: 10000; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(5px); display: flex; align-items: center; justify-content: center; padding: 20px; }
.carousel-container { width: 100%; max-width: 360px; position: relative; overflow: hidden; border-radius: 24px; background: #fff; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.3); }
.carousel-track { display: flex; transition: transform 0.3s ease; width: 100%; }
.carousel-slide { flex: 0 0 100%; width: 100%; }
.assessment-popup-card { padding: 32px 24px; text-align: center; position: relative; display: flex; flex-direction: column; align-items: center; }
.ap-close-btn { padding: 0; position: absolute; top: 12px; right: 12px; min-width: 32px; min-height: 32px; aspect-ratio: 1/1; border-radius: 50%; background: #f1f5f9; border: none; display: flex; justify-content: center; align-items: center; cursor: pointer; transition: background 0.2s; }
.ap-close-btn:hover { background: #e2e8f0; color: #f97316; }
.ap-icon-wrap { width: 72px; height: 72px; border-radius: 20px; display: flex; align-items: center; justify-content: center; margin-bottom: 20px; color: #fff; background: linear-gradient(135deg, #f97316, #ea580c); flex-shrink: 0; }
.ap-title { font-size: 1.15rem; font-weight: 800; color: #000000; margin: 0 0 12px; line-height: 1.4; }
.ap-desc { font-size: 0.9rem; color: #475569; margin: 0 0 24px; line-height: 1.5; }
.ap-btn-primary { width: 100%; padding: 14px; border-radius: 12px; font-weight: 700; color: #fff; border: none; cursor: pointer; background: #f97316; transition: background 0.2s; }
.ap-btn-primary:hover { background: #ea580c; }
.ap-btn-secondary { background: none; border: none; color: #64748b; font-weight: 600; padding: 12px; cursor: pointer; transition: color 0.2s; }
.ap-btn-secondary:hover { color: #f97316; }
.nav-arrow { padding: 0; position: absolute; top: 50%; transform: translateY(-50%); min-width: 36px; min-height: 36px; aspect-ratio: 1/1; border-radius: 50%; background: white; border: 1px solid #e2e8f0; display: flex; justify-content: center; align-items: center; cursor: pointer; z-index: 10; transition: border-color 0.2s; }
.nav-arrow:hover { border-color: #f97316; color: #f97316; }
.nav-arrow.left { left: 10px; }
.nav-arrow.right { right: 10px; }
@keyframes spinAnim { to { transform: rotate(360deg); } }
.spin, .spin-lg { animation: spinAnim 0.7s linear infinite; }
.force-white-text, .force-white-text * { color: #ffffff !important; }

/* PDPA Consent Block from Login.vue */
.pdpa-consent {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  box-sizing: border-box;
  margin-bottom: 1rem;
}
.pdpa-row {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  user-select: none;
  padding: 8px 4px;
  position: relative;
}
.pdpa-checkbox-wrap {
  position: relative;
  flex-shrink: 0;
  display: flex;
  align-items: center;
}
.pdpa-row input[type="checkbox"] {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  margin: 0;
  cursor: pointer;
  z-index: 2;
}
.pdpa-custom-box {
  width: 20px;
  height: 20px;
  border: 2px solid #cbd5e1;
  border-radius: 5px;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.18s ease;
  flex-shrink: 0;
  z-index: 1;
}
.pdpa-custom-box.checked {
  background: #F05A23;
  border-color: #F05A23;
}
.pdpa-row:hover .pdpa-custom-box:not(.checked) {
  border-color: #F05A23;
  background: #fff5f2;
}
.pdpa-label-text {
  font-size: 13px;
  color: #475569;
  line-height: 1.4;
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  font-weight: 500;
}
.btn-disabled {
  opacity: 0.5 !important;
  cursor: not-allowed !important;
  filter: grayscale(0.5);
}
</style>
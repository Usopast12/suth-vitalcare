import { ref, onMounted, onUnmounted, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { authStore } from "../store/auth";
import moment from "moment";
import * as fabric from "fabric";
import { swal, showSuccess, showError } from "../lib/swal";
import { useFavorites } from "./useFavorites";
import { useRealtime } from "./useRealtime";
export interface AssessmentPopupQueue {
  type: string;
  label?: string;
}
export function useEventDetail() {
  const route = useRoute();
  const router = useRouter();
  const activityId = computed(() => Number(route.params.id));
  // ==========================
  // Real-time Sync
  // ==========================
  useRealtime({
    onActivityUpdated: (data) => {
      if (Number(data.id) === activityId.value) {
        fetchEvent(true); // Silent refresh
      }
    },
    onActivityDeleted: (data) => {
      if (Number(data.id) === activityId.value) {
        showToast("กิจกรรมนี้ถูกลบแล้ว", "error");
        router.push("/activities");
      }
    },
    onSubmissionCreated: (data) => {
      if (Number(data.activity_id) === activityId.value) {
        fetchEvent(true);
        if (hasGoalConfig.value) fetchGoalProgress();
        checkCertEligibility();
      }
    },
    onSubmissionUpdated: (data) => {
      if (Number(data.activity_id) === activityId.value) {
        fetchEvent(true);
        if (hasGoalConfig.value) fetchGoalProgress();
        checkCertEligibility();
      }
    },
    onSubmissionDeleted: (data) => {
      fetchEvent(true);
      if (hasGoalConfig.value) fetchGoalProgress();
    },
    onTeamUpdated: (data) => {
      if (Number(data.activity_id) === activityId.value) {
        fetchEvent(true);
      }
    }
  });
  // ==========================
  // Core Event State
  // ==========================
  const event = ref<any>(null);
  const loading = ref(false);
  const loadError = ref(false);
  const parsedSections = ref<any[]>([]);
  // ==========================
  // Registration & Access State
  // ==========================
  const isRegistered = ref(false);
  const joining = ref(false);
  const hasPermissionToJoin = ref(true);
  const noPermissionReason = ref("");
  const allowedGroups = computed(() => {
    if (!event.value) return ["general"];
    let vis: string[] = [];
    try {
      let rawVis = event.value.visibility || event.value.allowed_roles;
      if (typeof rawVis === "string") {
        rawVis = rawVis.trim();
        if ((rawVis.startsWith('"') && rawVis.endsWith('"')) || (rawVis.startsWith("'") && rawVis.endsWith("'"))) {
          try {
            const inner = JSON.parse(rawVis);
            if (inner) rawVis = inner;
          } catch {
            rawVis = rawVis.slice(1, -1);
          }
        }
      }
      if (Array.isArray(rawVis)) {
        vis = rawVis;
      } else if (typeof rawVis === "string" && rawVis.trim() !== "") {
        rawVis = rawVis.trim();
        if (rawVis.startsWith("[") && rawVis.endsWith("]")) {
          try {
            vis = JSON.parse(rawVis);
          } catch {
            vis = rawVis.slice(1, -1).split(",").map((s: string) => s.trim().replace(/^["']|["']$/g, ""));
          }
        } else {
          vis = rawVis.split(",").map((v: string) => v.trim()).filter(Boolean);
        }
      } else if (rawVis) {
        vis = [String(rawVis)];
      }
    } catch (err) {
    }
    vis = [...new Set(vis.map(String).filter((v) => v && v !== "null" && v !== "undefined"))];
    return vis.length === 0 ? ["general"] : vis;
  });
  const currentUserRoleLabel = ref("");
  const isHost = ref(false);
  const registerTeamMode = ref(false); // Default to false (Individual)
  // ==========================
  // Certificate State
  // ==========================
  const claiming = ref(false);
  const isEligible = ref(false);
  const certReason = ref("");
  const certStatus = ref<"none" | "issued">("none");
  const userActivityScore = ref(0);
  const userActivityRank = ref(0);
  // ==========================
  // Assessment & Popups State
  // ==========================
  const preTestCompleted = ref(false);
  const postTestCompleted = ref(false);
  const popupQueue = ref<AssessmentPopupQueue[]>([]);
  const activePopupIndex = ref(0);
  const popupsDismissed = ref(false);
  // ==========================
  // Tanita State
  // ==========================
  const tanitaRecords = ref<any[]>([]);
  const showTanitaModal = ref(false);
  const loadingTanita = ref(false);
  const acceptDataDisclosure = ref(false);
  // ==========================
  // Goal / Leaderboard State
  // ==========================
  const showGoalModal = ref(false);
  const goalViewTab = ref<"individual" | "team">("individual");
  const goalLoading = ref(false);
  const goalData = ref<any[]>([]);
  const goalConfigData = ref<any>({});
  const goalSearchQuery = ref("");
  const goalSortBy = ref("progress_desc");
  const goalCurrentPage = ref(1);
  const goalPageSize = ref(10);
  // ==========================
  // UI Specific State (Floating button, Touch)
  // ==========================
  const showFloater = ref(false);
  let touchStartX = 0;
  let touchEndX = 0;
  // ==========================
  // Favorites State
  // ==========================
  const isFavorited = ref(false);
  const favoriteCount = ref(0);
  const {
    favoriteIds,
    toggleFavorite: syncToggleFavorite,
    fetchEventFavoriteData,
  } = useFavorites();
  let pollTimer: any = null;
  // ==========================
  // Computed Properties
  // ==========================
  const isUnlimited = computed(() =>
    [true, 1, "1"].includes(event.value?.is_unlimited_max_slots),
  );
  const isContinuousEvent = computed(() =>
    [true, 1, "1"].includes(event.value?.is_continuous_event),
  );
  const isContinuousRegistration = computed(() =>
    [true, 1, "1"].includes(event.value?.is_continuous_registration),
  );
  const assessmentConfig = computed(() => {
    try {
      return typeof event.value?.assessment_config === "string"
        ? JSON.parse(event.value.assessment_config)
        : event.value?.assessment_config || {};
    } catch {
      return {};
    }
  });
  const certConfigParsed = computed(() => {
    try {
      return typeof event.value?.certificate_config === "string"
        ? JSON.parse(event.value.certificate_config)
        : event.value?.certificate_config || {};
    } catch {
      return {};
    }
  });
  const isPreTestRequired = computed(
    () => assessmentConfig.value?.pre_test?.enabled === true,
  );
  const isPostTestRequired = computed(
    () => assessmentConfig.value?.post_test?.enabled === true,
  );
  const hasAssessment = computed(
    () => isPreTestRequired.value || isPostTestRequired.value,
  );
  const isEventStarted = computed(() => {
    if (isContinuousEvent.value) return true;
    if (!event.value?.start_date) return false;
    const start = moment(event.value.start_date).startOf("day");
    if (event.value.start_time) {
      const [h, m] = event.value.start_time.split(":");
      start.hour(parseInt(h)).minute(parseInt(m));
    }
    return moment().isSameOrAfter(start);
  });
  const slotFull = computed(() => {
    if (isUnlimited.value) return false;
    if (!event.value) return false;
    // Use registration_count as primary source of truth for filled slots
    const filled = event.value.registration_count ?? event.value.filled ?? 0;
    const total = Number(event.value.max_slots || event.value.total || 0);
    return filled >= total;
  });
  const slotPct = computed(() => {
    if (isUnlimited.value) return 0;
    const filled = event.value.registration_count ?? event.value.filled ?? 0;
    const total = Number(event.value.max_slots || event.value.total || 1);
    return Math.min(100, Math.round((filled / total) * 100));
  });
  const totalMissionsCount = computed(() => {
    if (event.value?.tasks?.length) return event.value.tasks.length;
    if (event.value?.missions_config)
      return Object.values(event.value.missions_config).filter(
        (c: any) => c.enabled,
      ).length;
    return 0;
  });
  const completedMissionsCount = computed(
    () => event.value?.tasks?.filter((t: any) => t.completed).length || 0,
  );
  // ── Tanita Computed ──
  const tanitaConfig = computed(() => {
    try {
      return typeof event.value?.health_config === "string"
        ? JSON.parse(event.value.health_config)
        : event.value?.health_config || {};
    } catch {
      return {};
    }
  });
  const tanitaRequiredDates = computed(() =>
    Array.isArray(tanitaConfig.value?.tanita_dates)
      ? tanitaConfig.value.tanita_dates
      : [],
  );
  const hasTanitaTask = computed(() =>
    (event.value?.tasks || []).some((t: any) => t.submission_type === "tanita"),
  );
  const shouldShowTanita = computed(
    () => hasTanitaTask.value || tanitaRequiredDates.value.length > 0,
  );
  const currentMuscleToFatRatio = computed(() => {
    if (tanitaRecords.value.length === 0) return "0.00";
    const rec = tanitaRecords.value[0];
    const muscle = Number(rec.muscle_mass) || 0;
    const fat = (Number(rec.weight) || 0) * ((Number(rec.fat_pc) || 0) / 100);
    return fat > 0 ? (muscle / fat).toFixed(2) : "0.00";
  });
  const healthTrendClass = computed(() => {
    if (tanitaRecords.value.length < 2) return "";
    const r0 = tanitaRecords.value[0],
      r1 = tanitaRecords.value[1];
    const fat_diff = (Number(r0.fat_pc) || 0) - (Number(r1.fat_pc) || 0);
    const muscle_diff =
      (Number(r0.muscle_mass) || 0) - (Number(r1.muscle_mass) || 0);
    if (fat_diff <= 0 && muscle_diff >= 0) return "trend-excellent";
    if (fat_diff <= 0) return "trend-good";
    return "trend-neutral";
  });
  const healthSummaryText = computed(() => {
    if (tanitaRecords.value.length < 2)
      return "เริ่มบันทึกข้อมูลเพื่อดูบทวิเคราะห์";
    const r0 = tanitaRecords.value[0],
      r1 = tanitaRecords.value[1];
    const fat_diff = (Number(r0.fat_pc) || 0) - (Number(r1.fat_pc) || 0);
    const muscle_diff =
      (Number(r0.muscle_mass) || 0) - (Number(r1.muscle_mass) || 0);
    if (fat_diff < 0 && muscle_diff > 0)
      return "🔥 ร่างกายกำลัง Lean และเพิ่มมวลกล้ามเนื้อได้ดีเยี่ยม!";
    if (fat_diff < 0) return "✨ เปอร์เซ็นต์ไขมันลดลง ร่างกายดูคมชัดขึ้น";
    if (muscle_diff > 0) return "💪 มวลกล้ามเนื้อเพิ่มขึ้น พัฒนาการดีมาก";
    return "🏃 รักษามาตรฐานการออกกำลังกายต่อไป สู้ๆ!";
  });
  const muscleFatTrendText = computed(() => {
    if (tanitaRecords.value.length < 2) return "คงที่";
    const r0 = tanitaRecords.value[0],
      r1 = tanitaRecords.value[1];
    const ratio0 =
      Number(r0.muscle_mass) /
      ((Number(r0.weight) * Number(r0.fat_pc)) / 100 || 1);
    const ratio1 =
      Number(r1.muscle_mass) /
      ((Number(r1.weight) * Number(r1.fat_pc)) / 100 || 1);
    const diff = ratio0 - ratio1;
    return (diff >= 0 ? "+" : "") + diff.toFixed(2);
  });
  const muscleFatTrendClass = computed(() => {
    if (tanitaRecords.value.length < 2) return "";
    const r0 = tanitaRecords.value[0],
      r1 = tanitaRecords.value[1];
    const ratio0 =
      Number(r0.muscle_mass) /
      ((Number(r0.weight) * Number(r0.fat_pc)) / 100 || 1);
    const ratio1 =
      Number(r1.muscle_mass) /
      ((Number(r1.weight) * Number(r1.fat_pc)) / 100 || 1);
    return ratio0 >= ratio1 ? "trend-up" : "trend-down";
  });
  const metabolicTrendText = computed(() => {
    if (tanitaRecords.value.length < 2) return "คงที่";
    const diff =
      (Number(tanitaRecords.value[0].metabolic_age) || 0) -
      (Number(tanitaRecords.value[1].metabolic_age) || 0);
    if (diff < 0) return `เด็กลง ${Math.abs(diff)} ปี ✨`;
    if (diff > 0) return `เพิ่มขึ้น ${diff} ปี`;
    return "เท่าเดิม";
  });
  const metabolicTrendClass = computed(() => {
    if (tanitaRecords.value.length < 2) return "";
    const diff =
      (Number(tanitaRecords.value[0].metabolic_age) || 0) -
      (Number(tanitaRecords.value[1].metabolic_age) || 0);
    return diff <= 0 ? "trend-up" : "trend-down";
  });
  // ── Goal Computed ──
  const hasGoalConfig = computed(() => {
    try {
      const gc =
        typeof event.value?.goal_config === "string"
          ? JSON.parse(event.value.goal_config)
          : event.value?.goal_config || {};
      return gc.enabled && Number(gc.target_value) > 0;
    } catch {
      return false;
    }
  });
  const goalConfigParsed = computed(() => {
    try {
      return typeof event.value?.goal_config === "string"
        ? JSON.parse(event.value.goal_config)
        : event.value?.goal_config || {};
    } catch {
      return {};
    }
  });
  const goalUnit = computed(() => {
    try {
      const gc =
        typeof event.value?.goal_config === "string"
          ? JSON.parse(event.value.goal_config)
          : event.value?.goal_config || {};
      if (!gc.enabled) return "หน่วย";
      const t = gc.target_type;
      const map: Record<string, string> = {
        points: "pts",
        submissions: "ครั้ง",
        times: "ครั้ง",
        kilometers: "กม.",
        km: "กม.",
        steps: "ก้าว",
        calories: "kcal",
        cal: "kcal",
        minutes: "นาที",
        min: "นาที",
        hours: "ชม.",
        hr: "ชม.",
        meters: "เมตร",
        m: "เมตร",
        meal: "มื้อ",
        kg: "กก.",
        level: "ระดับ",
      };
      return map[t] || t || "หน่วย";
    } catch {
      return "หน่วย";
    }
  });
  const goalUnitLabel = computed(() => {
    const gc = goalConfigData.value || goalConfigParsed.value || {};
    const t = gc.target_type;
    const map: Record<string, string> = {
      points: "แต้ม",
      submissions: "ครั้ง",
      times: "ครั้ง",
      kilometers: "กม.",
      km: "กม.",
      steps: "ก้าว",
      calories: "kcal",
      cal: "kcal",
      minutes: "นาที",
      min: "นาที",
      hours: "ชม.",
      hr: "ชม.",
      meters: "เมตร",
      m: "เมตร",
      meal: "มื้อ",
      kg: "กก.",
      level: "ระดับ",
    };
    return map[t] || goalUnit.value || "หน่วย";
  });
  const filteredAndSortedGoalData = computed(() => {
    let list = [...goalData.value];
    if (goalSearchQuery.value.trim()) {
      const q = goalSearchQuery.value.toLowerCase().trim();
      list = list.filter((item) => getGoalName(item).toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      if (goalSortBy.value === "progress_desc")
        return (b.percent || 0) - (a.percent || 0);
      if (goalSortBy.value === "progress_asc")
        return (a.percent || 0) - (b.percent || 0);
      if (goalSortBy.value === "points_desc")
        return (b.points_achieved || 0) - (a.points_achieved || 0);
      if (goalSortBy.value === "points_asc")
        return (a.points_achieved || 0) - (b.points_achieved || 0);
      if (goalSortBy.value === "name_asc")
        return getGoalName(a).localeCompare(getGoalName(b), "th");
      return 0;
    });
    return list;
  });
  const paginatedGoalData = computed(() => {
    const start = (goalCurrentPage.value - 1) * goalPageSize.value;
    return filteredAndSortedGoalData.value.slice(
      start,
      start + goalPageSize.value,
    );
  });
  const totalGoalPages = computed(() =>
    Math.ceil(filteredAndSortedGoalData.value.length / goalPageSize.value),
  );
  // ── Cert Computed ──
  const certConditionText = computed(() => {
    const mode = event.value?.certificate_config?.issue_mode;
    if (mode === "immediately") return "แจกทันทีเมื่อลงทะเบียน";
    if (mode === "goal_complete") return "รับได้เมื่อผ่านเป้าหมาย";
    return "เงื่อนไขตามที่ผู้จัดกำหนด";
  });
  const certCardState = computed(() => {
    if (certStatus.value === "issued") return "state-issued";
    if (isRegistered.value && isEligible.value) return "state-eligible";
    return "state-pending";
  });
  const postTestEligible = computed(() => {
    if (!event.value) return false;
    if (isContinuousEvent.value) return true;
    if (!event.value.end_date) return true;
    // If it's started, they can do post-test (or use the 3-day window)
    return isEventStarted.value;
  });
  // ==========================
  // Methods
  // ==========================
  const showToast = (msg: string, type: "success" | "error" = "success") =>
    type === "error" ? showError(msg) : showSuccess(msg);
  const formatDateThai = (dateStr: string) => {
    if (!dateStr) return "";
    const d = moment(dateStr);
    const m = [
      "ม.ค.",
      "ก.พ.",
      "มี.ค.",
      "เม.ย.",
      "พ.ค.",
      "มิ.ย.",
      "ก.ค.",
      "ส.ค.",
      "ก.ย.",
      "ต.ค.",
      "พ.ย.",
      "ธ.ค.",
    ];
    return `${d.date()} ${m[d.month()]} ${d.year() + 543}`;
  };
  const sanitizeHtml = (html: string) =>
    html
      ? html
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
          .replace(/on\w+="[^"]*"/gi, "")
          .replace(/on\w+='[^']*'/gi, "")
          .replace(/javascript:/gi, "")
          .replace(/\n/g, "<br>")
      : "";
  const sanitizedRules = computed(() =>
    sanitizeHtml(event.value?.rules_regulations || ""),
  );
  // Fetch Core Event
  const fetchEvent = async (silent = false) => {
    if (!silent) {
      loading.value = true;
      acceptDataDisclosure.value = false;
    }
    loadError.value = false;
    try {
      const id = route.params.id;
      if (!id || !/^\d+$/.test(String(id))) {
        router.push("/activities");
        return;
      }
      const res = await fetch(`/api/activities/${id}`);
      if (!res.ok) {
        loadError.value = true;
        return;
      }
      const data = await res.json();
      // Update event data while preserving local state if needed (optional)
      event.value = data;
      try {
        parsedSections.value = JSON.parse(event.value.detail || "[]");
      } catch {
        parsedSections.value = event.value.detail
          ? [{ title: "รายละเอียด", content: event.value.detail }]
          : [];
      }
      // Refresh registration and validate access
      await checkRegistration();
      validateAccess();
    } catch {
      loadError.value = true;
    } finally {
      loading.value = false;
    }
    // Phase 2: Secondary data
    if (authStore.user?.id && event.value) {
      Promise.all([
        checkCertEligibility(),
        checkAssessmentStatus(),
        shouldShowTanita.value ? fetchTanitaHistory() : Promise.resolve(),
        hasGoalConfig.value ? fetchGoalProgress() : Promise.resolve(),
        fetchFavoriteStatus(),
      ]).then(() => {
        if (!silent) checkAndShowPopups();
      }).catch(() => {});
    }
  };
  // Host & Registration Checks
  const checkIsHost = async () => {
    if (!authStore.user?.team_id) {
      isHost.value = false;
      return;
    }
    try {
      const res = await fetch(`/api/teams/${authStore.user.team_id}`);
      if (res.ok) {
        const data = await res.json();
        isHost.value =
          data.host_id === authStore.user.id ||
          data.hostId === authStore.user.id;
        if (isHost.value) registerTeamMode.value = !!data.autoJoinActivity;
      } else {
        isHost.value = authStore.user.role === "host";
      }
    } catch {
      isHost.value = authStore.user.role === "host";
    }
  };
  const checkRegistration = async () => {
    if (!authStore.user?.id) return;
    try {
      const res = await fetch(
        `/api/activities/${event.value.id}/registration/${authStore.user.id}`,
        { headers: { "x-user-id": String(authStore.user.id) } },
      );
      const data = await res.json();
      isRegistered.value = !!data.registered;
    } catch {}
  };
  const validateAccess = () => {
    if (!event.value) return;
    noPermissionReason.value = "";
    if (event.value.status === "closed") {
      hasPermissionToJoin.value = false;
      noPermissionReason.value = "กิจกรรมนี้ปิดรับสมัครแล้ว";
      return;
    }
    if (!isContinuousRegistration.value && event.value.registration_end_date) {
      const regEnd = new Date(event.value.registration_end_date);
      regEnd.setHours(23, 59, 59, 999);
      if (new Date() > regEnd) {
        hasPermissionToJoin.value = false;
        noPermissionReason.value = "หมดเวลารับสมัครแล้ว";
        return;
      }
    }
    if (!isContinuousEvent.value && event.value.end_date) {
      const eventEnd = new Date(event.value.end_date);
      eventEnd.setHours(23, 59, 59, 999);
      if (new Date() > eventEnd) {
        hasPermissionToJoin.value = false;
        noPermissionReason.value = "กิจกรรมสิ้นสุดแล้ว";
        return;
      }
    }
    if (!isUnlimited.value) {
      const filled = event.value.registration_count ?? event.value.filled ?? 0;
      const limit = Number(event.value.max_slots || event.value.total || 0);
      if (filled >= limit) {
        hasPermissionToJoin.value = false;
        noPermissionReason.value = "กิจกรรมนี้เต็มแล้ว";
        return;
      }
    }
    const vis = allowedGroups.value;
    if (vis.includes("general") || (vis.length === 1 && (vis[0].toLowerCase() === 'public' || vis[0].toLowerCase() === 'general'))) {
      hasPermissionToJoin.value = true;
      return;
    }
    if (!authStore.user) {
      hasPermissionToJoin.value = false;
      noPermissionReason.value = "กรุณาเข้าสู่ระบบก่อนเข้าร่วม";
      return;
    }
    // If the activity was created by a Team Host, restrict to that team ONLY
    const creatorRole = event.value.creator?.role || event.value.creator?.role_name;
    const isTeamMatch =
      authStore.user?.team_id &&
      event.value.creator?.team_id &&
      Number(authStore.user.team_id) === Number(event.value.creator.team_id);
    if (creatorRole === 'host') {
      if (!isTeamMatch) {
        hasPermissionToJoin.value = false;
        noPermissionReason.value = "กิจกรรมนี้จำกัดเฉพาะสมาชิกภายในทีมของผู้จัดเท่านั้น";
        return;
      }
    }
    const baseGroups = ["general", "my_team", "other_teams"];
    const baseVis = vis.filter((v) => baseGroups.includes(v));
    let passBase =
      baseVis.length === 0 ||
      baseVis.includes("general") ||
      (baseVis.includes("my_team") && isTeamMatch) ||
      (baseVis.includes("other_teams") && authStore.user?.team_id);
    if (!passBase) {
      hasPermissionToJoin.value = false;
      if (baseVis.includes("my_team") && !baseVis.includes("other_teams")) {
        noPermissionReason.value =
          "สงวนสิทธิ์เฉพาะสมาชิกในทีมผู้จัดกิจกรรมเท่านั้น";
      } else if (
        baseVis.includes("other_teams") ||
        baseVis.includes("my_team")
      ) {
        noPermissionReason.value =
          "กิจกรรมนี้จำกัดเฉพาะกลุ่มทีม (Team Only) กรุณาเข้าร่วมทีมก่อนสมัครครับ";
      } else {
        noPermissionReason.value =
          "คุณไม่มีสิทธิ์เข้าร่วมกิจกรรมนี้ตามเงื่อนไขที่กำหนด";
      }
      return;
    }
    const roleTypeGroups = [
      "นักเรียน",
      "นักศึกษา",
      "บุคลากรโรงพยาบาล",
      "บุคลากรมหาวิทยาลัย",
      "บุคคลทั่วไป",
    ];
    const roleTypeVis = vis.filter((v) => roleTypeGroups.includes(v));
    const gradeGroups = ["ป.1 - ป.6", "ม.1 - ม.6"];
    const specificGrades = [
      "ป.1", "ป.2", "ป.3", "ป.4", "ป.5", "ป.6",
      "ม.1", "ม.2", "ม.3", "ม.4", "ม.5", "ม.6"
    ];
    const yearGroups = ["ปี 1", "ปี 2", "ปี 3", "ปี 4", "ปี 5", "ปี 6"];
    const gradeVis = vis.filter((v) => gradeGroups.includes(v) || specificGrades.includes(v));
    const yearVis = vis.filter((v) => yearGroups.includes(v));
    const facultyVis = vis.filter(
      (v) =>
        !baseGroups.includes(v) &&
        !roleTypeGroups.includes(v) &&
        !gradeGroups.includes(v) &&
        !specificGrades.includes(v) &&
        !yearGroups.includes(v),
    );
    const hasRoleFilters =
      roleTypeVis.length > 0 ||
      gradeVis.length > 0 ||
      yearVis.length > 0 ||
      facultyVis.length > 0;
    const userRole = authStore.user?.role_type;
    const userDetail1 = authStore.user?.role_detail_1;
    const userDetail2 = authStore.user?.role_detail_2;
    // Compute User Status Label
    if (authStore.user) {
      if (userRole === "นักเรียน") {
        currentUserRoleLabel.value = `นักเรียน (${userDetail2 || "ไม่ระบุชั้นปี"})`;
      } else if (userRole === "นักศึกษา") {
        currentUserRoleLabel.value = `นักศึกษา (${userDetail2 || "ไม่ระบุคณะ"})`;
      } else if (
        userRole === "บุคลากรมหาวิทยาลัย" ||
        userRole === "บุคลากรโรงพยาบาล"
      ) {
        currentUserRoleLabel.value = `${userRole} (${userDetail1 || "ไม่ระบุแผนก"})`;
      } else {
        currentUserRoleLabel.value = userRole || "บุคคลทั่วไป";
      }
    } else {
      currentUserRoleLabel.value = "ยังไม่ได้เข้าสู่ระบบ";
    }
    if (hasRoleFilters) {
      // 1. Check Role Type if specified
      if (roleTypeVis.length > 0 && !roleTypeVis.includes(userRole)) {
        hasPermissionToJoin.value = false;
        noPermissionReason.value = `จำกัดเฉพาะกลุ่ม: ${roleTypeVis.join(", ")}`;
        return;
      }
      // 2. Role-specific Detail Checks
      if (userRole === "นักเรียน") {
        const userGrade = userDetail2 || "";
        const passGrade =
          gradeVis.length === 0 ||
          gradeVis.some((v) => {
            if (v === "ป.1 - ป.6") return userGrade.startsWith("ป.");
            if (v === "ม.1 - ม.6") return userGrade.startsWith("ม.");
            return v === userGrade;
          });
        if (!passGrade) {
          hasPermissionToJoin.value = false;
          noPermissionReason.value = `จำกัดเฉพาะระดับชั้น: ${gradeVis.join(", ")} (ปัจจุบันคุณคือ: ${userGrade || "ไม่ระบุ"})`;
          return;
        }
      } else if (userRole === "นักศึกษา") {
        let userFac = "";
        let userYear = "";
        if (userDetail2 && userDetail2.includes(" - ")) {
          const parts = userDetail2.split(" - ");
          userFac = parts[0].trim();
          userYear = parts[1].trim();
        } else {
          userFac = userDetail2 || "";
        }
        const standardFaculties = [
          "สำนักวิชาวิทยาศาสตร์", "สำนักวิชาเทคโนโลยีสังคม", "สำนักวิชาเทคโนโลยีการเกษตร", 
          "สำนักวิชาวิศวกรรมศาสตร์", "สำนักวิชาแพทยศาสตร์", "สำนักวิชาพยาบาลศาสตร์", 
          "สำนักวิชาทันตแพทยศาสตร์", "สำนักวิชาสาธารณสุขศาสตร์", "สำนักวิชาศาสตร์และศิลป์ดิจิทัล"
        ];
        const isOtherFac = !standardFaculties.includes(userFac) && !standardFaculties.includes(userDetail2);
        const passFac =
          facultyVis.length === 0 ||
          facultyVis.includes(userFac) ||
          facultyVis.includes(userDetail2) ||
          (facultyVis.includes("อื่น ๆ") && isOtherFac);
        if (!passFac) {
          hasPermissionToJoin.value = false;
          noPermissionReason.value = `จำกัดเฉพาะสำนักวิชา: ${facultyVis.join(", ")}`;
          return;
        }
        const passYear =
          yearVis.length === 0 ||
          yearVis.includes(userYear) ||
          yearVis.includes(userDetail2);
        if (!passYear) {
          hasPermissionToJoin.value = false;
          noPermissionReason.value = `จำกัดเฉพาะชั้นปี: ${yearVis.join(", ")} (ปัจจุบันคุณคือ: ${userYear || "ไม่ระบุ"})`;
          return;
        }
      } else if (
        userRole === "บุคลากรมหาวิทยาลัย" ||
        userRole === "บุคลากรโรงพยาบาล"
      ) {
        const standardFaculties = [
          "สำนักวิชาวิทยาศาสตร์", "สำนักวิชาเทคโนโลยีสังคม", "สำนักวิชาเทคโนโลยีการเกษตร", 
          "สำนักวิชาวิศวกรรมศาสตร์", "สำนักวิชาแพทยศาสตร์", "สำนักวิชาพยาบาลศาสตร์", 
          "สำนักวิชาทันตแพทยศาสตร์", "สำนักวิชาสาธารณสุขศาสตร์", "สำนักวิชาศาสตร์และศิลป์ดิจิทัล"
        ];
        const isOtherDept = !standardFaculties.includes(userDetail1) && !standardFaculties.includes(userDetail2);
        if (
          facultyVis.length > 0 &&
          !facultyVis.includes(userDetail1) &&
          !facultyVis.includes(userDetail2) &&
          !(facultyVis.includes("อื่น ๆ") && isOtherDept)
        ) {
          hasPermissionToJoin.value = false;
          noPermissionReason.value = `จำกัดเฉพาะหน่วยงาน/สำนักวิชา: ${facultyVis.join(", ")}`;
          return;
        }
      }
      // 3. Cross-role enforcement
      // If a role-specific filter is active but the user isn't in that role,
      // they must have been explicitly allowed in roleTypeVis.
      const isStudent = userRole === "นักเรียน";
      const isCollegeStudent = userRole === "นักศึกษา";
      const isStaff =
        userRole === "บุคลากรมหาวิทยาลัย" || userRole === "บุคลากรโรงพยาบาล";
      if (gradeVis.length > 0 && !isStudent && !roleTypeVis.includes(userRole)) {
        hasPermissionToJoin.value = false;
        noPermissionReason.value = `กิจกรรมนี้จำกัดเฉพาะนักเรียนระดับชั้น: ${gradeVis.join(", ")}`;
        return;
      }
      if (
        yearVis.length > 0 &&
        !isCollegeStudent &&
        !roleTypeVis.includes(userRole)
      ) {
        hasPermissionToJoin.value = false;
        noPermissionReason.value = `กิจกรรมนี้จำกัดเฉพาะนักศึกษาชั้นปี: ${yearVis.join(", ")}`;
        return;
      }
      if (
        facultyVis.length > 0 &&
        !isCollegeStudent &&
        !isStaff &&
        !roleTypeVis.includes(userRole)
      ) {
        hasPermissionToJoin.value = false;
        noPermissionReason.value = `กิจกรรมนี้จำกัดเฉพาะหน่วยงาน/สำนักวิชา: ${facultyVis.join(", ")}`;
        return;
      }
    }
    hasPermissionToJoin.value = true;
  };
  // Join / Leave Actions
  const joinActivity = async () => {
    if (joining.value || slotFull.value || (!isRegistered.value && !acceptDataDisclosure.value)) return;
    joining.value = true;
    if (!authStore.user?.id) {
      joining.value = false;
      return showError("กรุณาเข้าสู่ระบบก่อนเข้าร่วมกิจกรรมครับ");
    }
    if (!hasPermissionToJoin.value) {
      joining.value = false;
      return showToast(
        noPermissionReason.value || "คุณประมวลผลข้อมูลไม่ผ่านเงื่อนไขการเข้าร่วม",
        "error",
      );
    }
    let joinMode = "solo"; // Force individual registration as per user request
    let eventCode = "";
    const hasCode = event.value.has_event_code || !!event.value.event_code;
    const isTeamMember = authStore.user?.team_id && event.value.creator?.team_id && 
                        Number(authStore.user.team_id) === Number(event.value.creator.team_id);
    if (hasCode) {
      const { value: code, isConfirmed } = await swal.fire({
        title: event.value.team_mode ? "รหัสเข้าร่วมทีม" : "รหัสเข้าร่วมกิจกรรม",
        text: "กรุณากรอกรหัสผ่านเพื่อเข้าร่วมกิจกรรมนี้",
        input: "text",
        showCancelButton: true,
        confirmButtonColor: "#F05A23",
        inputPlaceholder: "กรอกรหัสผ่านที่นี่...",
        inputValidator: (value) => !value ? "กรุณากรอกรหัสผ่าน!" : null,
      });
      if (!isConfirmed) {
        joining.value = false;
        return;
      }
      eventCode = code as string;
    }
    // Check if event has a password
    let eventPassword = "";
    const hasPassword = event.value.has_event_password;
    if (hasPassword) {
      const { value: pwd, isConfirmed: pwdConfirmed } = await swal.fire({
        title: "🔒 กิจกรรมนี้ต้องการรหัสผ่าน",
        text: "กรุณากรอกรหัสผ่านที่ได้รับเพื่อเข้าร่วมกิจกรรมนี้",
        input: "password",
        showCancelButton: true,
        confirmButtonColor: "#F05A23",
        confirmButtonText: "ยืนยัน",
        cancelButtonText: "ยกเลิก",
        inputPlaceholder: "กรอกรหัสผ่านที่นี่...",
        inputValidator: (value) => !value ? "กรุณากรอกรหัสผ่าน!" : null,
        customClass: {
          confirmButton: "btn-global-orange !rounded-xl !px-10",
          cancelButton: "btn-global-outline !rounded-xl !px-10",
        },
        buttonsStyling: false,
      });
      if (!pwdConfirmed) {
        joining.value = false;
        return;
      }
      eventPassword = pwd as string;
    }
    try {
      const res = await fetch(`/api/activities/${event.value.id}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(authStore.user.id),
        },
        body: JSON.stringify({
          userId: authStore.user.id,
          joinMode,
          eventCode,
          eventPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || "เข้าร่วมไม่สำเร็จ");
      }
      isRegistered.value = true;
      event.value.registration_count = (event.value.registration_count || 0) + 1;
      if (event.value.filled !== undefined) event.value.filled = (event.value.filled || 0) + 1;
      showToast("เข้าร่วมกิจกรรมสำเร็จ!", "success");
      if (event.value.certificate_config?.enabled) checkCertEligibility();
      checkAndShowPopups();
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      joining.value = false;
    }
  };
  const leaveActivity = async () => {
    const result = await swal.fire({
      title: "ยืนยันการออกจากกิจกรรม?",
      html: `<div style="text-align: center; font-size: 0.95rem; color: #64748b;">
               คะแนนสะสมของคุณจะถูกเก็บไว้<br>และสามารถกลับมาร่วมต่อได้ทุกเมื่อ<br><br>
             </div>`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ยืนยันการออก",
      cancelButtonText: "ยกเลิก",
      customClass: {
        confirmButton: "btn-global-orange !rounded-xl !px-10",
        cancelButton: "btn-global-outline !rounded-xl !px-10",
      },
      buttonsStyling: false,
    });
    if (!result.isConfirmed) return;
    let leaveMode = "solo";
    joining.value = true;
    try {
      const res = await fetch(`/api/activities/${event.value.id}/leave`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(authStore.user?.id),
        },
        body: JSON.stringify({ userId: authStore.user?.id, leaveMode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ออกไม่สำเร็จ");
      isRegistered.value = false;
      event.value.registration_count = Math.max(0, (event.value.registration_count || 1) - 1);
      if (event.value.filled !== undefined) event.value.filled = Math.max(0, (event.value.filled || 1) - 1);
      showToast(data.message || "ออกจากกิจกรรมแล้ว");
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      joining.value = false;
    }
  };
  // Favorites
  const fetchFavoriteStatus = async () => {
    if (!event.value?.id) return;
    const data = await fetchEventFavoriteData(event.value.id);
    favoriteCount.value = data.count;
    isFavorited.value = data.isFavorited;
  };
  const toggleFavorite = async () => {
    if (!authStore.user?.id) return showError("กรุณาเข้าสู่ระบบก่อน");
    try {
      await syncToggleFavorite(event.value.id);
      isFavorited.value = favoriteIds.value.has(event.value.id);
      await fetchFavoriteStatus();
    } catch {}
  };
  // Assessments & Popups
  const checkAssessmentStatus = async () => {
    if (!authStore.user || !event.value) return;
    try {
      const [pre, post] = await Promise.all([
        fetch(
          `/api/health/check-submission/${event.value.id}/${authStore.user.id}/pre_test`,
          { headers: { "x-user-id": String(authStore.user.id) } },
        ).then((r) => r.json()),
        fetch(
          `/api/health/check-submission/${event.value.id}/${authStore.user.id}/post_test`,
          { headers: { "x-user-id": String(authStore.user.id) } },
        ).then((r) => r.json()),
      ]);
      preTestCompleted.value = pre.completed;
      postTestCompleted.value = post.completed;
    } catch {}
  };
  const getTanitaLabel = (dateItem: any) => {
    if (!dateItem) return "";
    if (typeof dateItem === 'object') return dateItem.label || "";
    return "";
  };
  const getTanitaDate = (dateItem: any) => {
    if (!dateItem) return "";
    if (typeof dateItem === 'object') return dateItem.date || "";
    return String(dateItem);
  };
  const isPastOrToday = (dateItem: any) => {
    const dStr = getTanitaDate(dateItem);
    if (!dStr) return true; // หากไม่ระบุวันที่ ให้ถือว่าสามารถส่งได้เลย
    // ใช้การเปรียบเทียบแบบ String (YYYY-MM-DD) เพื่อความแม่นยำเรื่องวันที่ ไม่โดนเวลาหลอก
    const today = moment().format("YYYY-MM-DD");
    const target = moment(dStr).format("YYYY-MM-DD");
    return today >= target;
  };
  const hasTanitaRecord = (label: string) =>
    tanitaRecords.value.some(
      (r: any) =>
        String(r.session_label || "").trim() === label.trim() ||
        String(r.session_label || "").trim() === label.replace("รอบที่ ", ""),
    );
  const checkAndShowPopups = () => {
    if (!isRegistered.value) return;
    const tempQueue: AssessmentPopupQueue[] = [];
    if (isPreTestRequired.value && !preTestCompleted.value)
      tempQueue.push({ type: "pre_test" });
    tanitaRequiredDates.value.forEach((dateItem: any, index: number) => {
      const label = `รอบที่ ${index + 1}`;
      if (isPastOrToday(dateItem) && !hasTanitaRecord(label))
        tempQueue.push({ type: `tanita_${index + 1}`, label });
    });
    const canDoPostTest = isPreTestRequired.value
      ? preTestCompleted.value
      : true;
    if (
      isPostTestRequired.value &&
      !postTestCompleted.value &&
      !isContinuousEvent.value &&
      canDoPostTest &&
      event.value?.end_date
    ) {
      if (postTestEligible.value) tempQueue.push({ type: "post_test" });
    }
    activePopupIndex.value = 0;
    popupQueue.value = tempQueue;
  };
  const dismissAllPopups = () => (popupsDismissed.value = true);
  const goToAssessment = (popup: any) => {
    const type = typeof popup === "string" ? popup : popup.type;
    const label = typeof popup === "string" ? "" : popup.label;
    if (type.includes("test") && !isRegistered.value)
      return showError("กรุณาลงทะเบียนก่อนทำแบบทดสอบครับ");
    dismissAllPopups();
    if (type.startsWith("tanita"))
      router.push({
        path: "/body-composition",
        query: {
          fromEventId: event.value.id,
          session_label: label || "ทั่วไป",
        },
      });
    else
      router.push({
        path: `/health`,
        query: { eventId: event.value.id, type },
      });
  };
  const getPopupTheme = (type: string) =>
    type === "pre_test"
      ? "pre-test-theme"
      : type === "post_test"
        ? "post-test-theme"
        : "tanita-theme";
  const getPopupTitle = (popup: AssessmentPopupQueue) => {
    if (popup.type === "pre_test") return "กรุณาทำแบบทดสอบก่อนกิจกรรม";
    if (popup.type === "post_test") return "ประเมินผลหลังกิจกรรม";
    if (popup.type.startsWith("tanita"))
      return `ถึงกำหนดบันทึกข้อมูล (Tanita) ${popup.label || ""}`;
    return "ถึงกำหนดบันทึกข้อมูล (Tanita)";
  };
  // Touch Swipe Logic for Modals
  const handleTouchStart = (e: TouchEvent) => {
    touchStartX = e.changedTouches[0].screenX;
  };
  const handleTouchEnd = (e: TouchEvent) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  };
  const handleSwipe = () => {
    const threshold = 50;
    if (
      touchEndX < touchStartX - threshold &&
      activePopupIndex.value < popupQueue.value.length - 1
    )
      activePopupIndex.value++;
    if (touchEndX > touchStartX + threshold && activePopupIndex.value > 0)
      activePopupIndex.value--;
  };
  // Tanita Calls
  const fetchTanitaHistory = async () => {
    if (!authStore.user?.id || !event.value?.id) return;
    loadingTanita.value = true;
    try {
      const res = await fetch(`/api/tanita/user/${authStore.user.id}?eventId=${event.value.id}`, {
        headers: { "x-user-id": authStore.user.id },
      });
      if (res.ok) tanitaRecords.value = await res.json();
    } catch {
    } finally {
      loadingTanita.value = false;
    }
  };
  const openTanitaModal = async () => {
    await fetchTanitaHistory();
    if (tanitaRecords.value.length === 0)
      return showToast("ยังไม่มีข้อมูลบันทึก", "error");
    showTanitaModal.value = true;
  };
  // Goals
  const fetchGoalProgress = async () => {
    if (!event.value?.id) return;
    goalLoading.value = true;
    try {
      const res = await fetch(
        `/api/stats/goal-progress/${event.value.id}?type=${goalViewTab.value}`,
      );
      const json = await res.json();
      goalConfigData.value = json.goal_config || {};
      goalData.value = json.data || [];
      goalCurrentPage.value = 1;
      // Re-verify certificate eligibility whenever goal progress is updated
      // to allow the download button to unlock immediately if the user just passed the goal.
      if (isRegistered.value && event.value?.certificate_config?.enabled) {
        checkCertEligibility();
      }
    } catch {
    } finally {
      goalLoading.value = false;
    }
  };
  const openGoalModal = () => {
    goalViewTab.value =
      goalConfigParsed.value.mode === "team" || event.value?.team_mode
        ? "team"
        : "individual";
    showGoalModal.value = true;
    fetchGoalProgress();
  };
  const getGoalName = (item: any) =>
    goalViewTab.value === "individual"
      ? item.nickname || item.fname_th || "ผู้เข้าร่วม"
      : item.name || "ทีม";
  const getOriginalRank = (item: any) =>
    goalData.value.findIndex((x) => x.id === item.id) + 1;
  const isGoalCurrentUser = (item: any) =>
    authStore.user &&
    (goalViewTab.value === "individual"
      ? Number(item.id) === Number(authStore.user.id)
      : Number(item.id) === Number(authStore.user.team_id));
  const certCriteria = ref<any>(null);
  const checkCertEligibility = async () => {
    if (!authStore.user?.id || !event.value?.id) return;
    try {
      // ✅ ยิงทั้ง 2 calls พร้อมกัน (parallel) แทนที่จะรอทีละ call
      const [certRes, statRes] = await Promise.all([
        fetch(
          `/api/certificates/check/${event.value.id}/${authStore.user.id}`,
          { headers: { "x-user-id": String(authStore.user.id) } },
        ),
        fetch(
          `/api/stats/individual/rank/${authStore.user.id}?activity_id=${event.value.id}`,
          { headers: { "x-user-id": String(authStore.user.id) } },
        ),
      ]);
      if (certRes.ok) {
        const data = await certRes.json();
        isEligible.value = !!data.eligible;
        certReason.value = data.reason || "";
        certStatus.value = data.issued ? "issued" : "none";
        certCriteria.value = data.criteria || null;
      }
      if (statRes.ok) {
        const statData = await statRes.json();
        userActivityScore.value = statData.score || 0;
        userActivityRank.value = statData.rank || 0;
      }
    } catch {}
  };
  const toSafeUrl = (url: string) => {
    if (!url || typeof url !== "string") return "";
    if (!url.startsWith("http")) return url;
    try {
      const u = new URL(url);
      if (u.hostname === window.location.hostname || u.hostname === "localhost")
        return u.pathname + u.search;
    } catch {}
    return url;
  };
  const patchCORS = (obj: any) => {
    if (!obj || typeof obj !== "object") return;
    if (typeof obj.src === "string") {
      obj.crossOrigin = "anonymous";
      obj.src = toSafeUrl(obj.src) || obj.src;
    }
    if (Array.isArray(obj.objects)) obj.objects.forEach(patchCORS);
    if (obj.backgroundImage) patchCORS(obj.backgroundImage);
  };
  const claimCert = async () => {
    if (claiming.value) return;
    claiming.value = true;
    try {
      const tplRes = await fetch(
        `/api/certificates/templates/${event.value.id}`,
        { headers: { "x-user-id": String(authStore.user?.id) } },
      );
      if (!tplRes.ok) throw new Error("ไม่พบเทมเพลตเกียรติบัตร");
      const template = await tplRes.json();
      if (!template?.canvas_json) throw new Error("เกียรติบัตรยังไม่ได้ออกแบบ");
      const W = template.width || 1754,
        H = template.height || 1240;
      const el = document.createElement("canvas");
      el.width = W;
      el.height = H;
      const cv = new fabric.StaticCanvas(el, {
        width: W,
        height: H,
        enableRetinaScaling: false,
      });
      const raw =
        typeof template.canvas_json === "string"
          ? JSON.parse(template.canvas_json)
          : structuredClone(template.canvas_json);
      patchCORS(raw);
      await cv.loadFromJSON(raw, (jsonObj: any, fabricObj: any) => {
        if (jsonObj?.data && fabricObj) (fabricObj as any).data = jsonObj.data;
      });
      // Profile Image handling
      const user = authStore.user;
      const picUrl =
        user?.picture_url || user?.pictureUrl || user?.avatar || "";
      if (template.background_url) {
        try {
          const bgImg = await (fabric as any).FabricImage.fromURL(
            toSafeUrl(template.background_url),
            { crossOrigin: "anonymous" },
          );
          bgImg.set({
            originX: "left",
            originY: "top",
            left: 0,
            top: 0,
            scaleX: W / (bgImg.width || 1),
            scaleY: H / (bgImg.height || 1),
            selectable: false,
            evented: false,
          });
          cv.backgroundImage = bgImg;
        } catch (e) {
        }
      }
      const replacements: Record<string, string> = {
        "{{user_fullname}}":
          [user?.fname_th, user?.lname_th].filter(Boolean).join(" ") ||
          "ผู้เข้าร่วม",
        "{{user_nickname}}": user?.nickname || "",
        "{{user_team}}":
          user?.team_name || (event.value?.team_mode ? "ไม่มีทีม" : ""),
        "{{event_title}}": event.value.title || "",
        "{{event_date}}": formatDateThai(event.value.start_date),
        "{{event_organizer}}": event.value.organizer || "ทีมงาน",
        "{{event_location}}": event.value.location_name || "Online",
        "{{user_score}}": String(userActivityScore.value),
        "{{user_rank}}": String(userActivityRank.value),
        "{{issued_date}}": new Date().toLocaleDateString("th-TH", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
      };
      const picHolders: any[] = [];
      cv.getObjects().forEach((obj) => {
        if (["i-text", "text", "textbox"].includes(obj.type || "")) {
          let txt = (obj as any).text || "";
          if ((obj as any).data?.field) txt = `{{${(obj as any).data.field}}}`;
          Object.entries(replacements).forEach(
            ([k, v]) => (txt = txt.replaceAll(k, v)),
          );
          (obj as any).set({ text: txt });
        }
        if ((obj as any).data?.field === "user_picture") picHolders.push(obj);
      });
      for (const ph of picHolders) {
        if (!picUrl) {
          cv.remove(ph);
          continue;
        }
        try {
          const profileImg = await (fabric as any).FabricImage.fromURL(
            toSafeUrl(picUrl),
            { crossOrigin: "anonymous" },
          );
          const scaleX = ph.scaleX ?? 1,
            scaleY = ph.scaleY ?? 1;
          const targetR =
            (ph.radius ?? Math.min(ph.width || 120, ph.height || 120) / 2) *
            Math.max(scaleX, scaleY);
          const scale = Math.max(
            (targetR * 2) / (profileImg.width || 1),
            (targetR * 2) / (profileImg.height || 1),
          );
          const clipPath = new fabric.Circle({
            radius: targetR / scale,
            originX: "center",
            originY: "center",
          });
          profileImg.set({
            left: ph.left,
            top: ph.top,
            originX: ph.originX || "center",
            originY: ph.originY || "center",
            scaleX: scale,
            scaleY: scale,
            angle: ph.angle ?? 0,
            clipPath,
          });
          cv.remove(ph);
          cv.add(profileImg);
        } catch (err) {
          cv.remove(ph);
        }
      }
      cv.renderAll();
      await new Promise<void>((r) => setTimeout(r, 100)); // Hack for fonts/images loading
      cv.renderAll();
      const dataURL = cv.toDataURL({
        format: "png",
        quality: 1,
        multiplier: Math.max(+(2800 / W).toFixed(1), 2.5),
      });
      const a = document.createElement("a");
      a.href = dataURL;
      a.download = `Certificate_${event.value.id}_${user?.id || "user"}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      await fetch("/api/certificates/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(authStore.user?.id),
        },
        body: JSON.stringify({
          event_id: event.value.id,
          user_id: authStore.user?.id,
        }),
      });
      certStatus.value = "issued";
      showToast("ดาวน์โหลดเกียรติบัตรสำเร็จ!");
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      claiming.value = false;
    }
  };
  // Social
  const shareSocial = async (platform: string) => {
    const url = window.location.href;
    const text = `เข้าร่วมกิจกรรม ${event.value?.title} กับเราสิ!`;
    if (platform === "copy") {
      await navigator.clipboard.writeText(url);
      return showToast("คัดลอกลิงก์แล้ว!");
    }
    const isMobile = /iPhone|iPod|iPad|Android|BlackBerry|IEMobile/.test(
      navigator.userAgent,
    );
    const urls: Record<string, string> = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      twitter: `https://x.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
      messenger: isMobile
        ? `fb-messenger://share/?link=${encodeURIComponent(url)}`
        : `https://www.facebook.com/dialog/send?link=${encodeURIComponent(url)}&app_id=626892557343231&redirect_uri=${encodeURIComponent(url)}`,
    };
    if (urls[platform])
      window.open(urls[platform], "_blank", "width=600,height=450");
  };
  // Navigation & UI Helpers
  const handleBack = () => {
    const backPath = window.history.state?.back;
    if (
      backPath &&
      !backPath.includes("/login") &&
      !backPath.includes("/register")
    )
      router.back();
    else router.push("/activities");
  };
  const goToMissions = (task?: any) => {
    if (!isRegistered.value)
      return showError("กรุณาลงทะเบียนก่อนเข้าร่วมภารกิจครับ");
    router.push({
      path: "/missions",
      query: { 
        taskId: task?.id,
        eventId: event.value?.id 
      },
    });
  };
  const scrollToGoal = () =>
    document
      .getElementById("goal-section")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  const scrollToHeader = () => window.scrollTo({ top: 0, behavior: "smooth" });
  const handleScroll = () => {
    showFloater.value = window.scrollY > 400;
  };
  // ==========================
  // Watchers & Lifecycles
  // ==========================
  watch(goalViewTab, fetchGoalProgress);
  watch(
    () => route.query.modal,
    (newVal) => {
      showGoalModal.value = newVal === "goals";
      showTanitaModal.value = newVal === "tanita";
    },
    { immediate: true },
  );
  watch(showGoalModal, (nv) =>
    nv
      ? router.replace({ query: { ...route.query, modal: "goals" } })
      : router.replace({ query: { ...route.query, modal: undefined } }),
  );
  watch(showTanitaModal, (nv) =>
    nv
      ? router.replace({ query: { ...route.query, modal: "tanita" } })
      : router.replace({ query: { ...route.query, modal: undefined } }),
  );
  watch(
    () => route.query.success,
    async (newVal) => {
      if (
        ["health_updated", "submission_sent", "form_submitted"].includes(
          String(newVal),
        )
      ) {
        popupsDismissed.value = false;
        await Promise.all([
          fetchTanitaHistory(),
          checkCertEligibility(),
          checkAssessmentStatus(),
          hasGoalConfig.value ? fetchGoalProgress() : Promise.resolve(),
        ]);
        checkAndShowPopups();
        if (newVal === "submission_sent")
          swal.fire({
            icon: "success",
            title: "ส่งภารกิจสำเร็จ",
            text: "คะแนนและอันดับจะอัปเดตหลังจากข้อมูลได้รับการอนุมัติครับ",
            timer: 3000,
          });
      }
    },
  );
  watch(
    [() => authStore.user?.id, () => authStore.user?.team_id],
    checkIsHost,
    { immediate: true },
  );
  watch(
    () => authStore.user,
    async () => {
      validateAccess();
      if (event.value && authStore.user?.id) {
        await checkRegistration();
        await checkIsHost();
        checkCertEligibility();
        checkAssessmentStatus();
        if (shouldShowTanita.value) fetchTanitaHistory();
        if (hasGoalConfig.value) fetchGoalProgress();
        fetchFavoriteStatus();
      }
    },
    { deep: true }
  );
  watch(activityId, () => {
    fetchEvent();
  });
  onMounted(() => {
    fetchEvent();
    window.addEventListener("scroll", handleScroll);
  });
  onUnmounted(() => {
    if (pollTimer) clearInterval(pollTimer);
    window.removeEventListener("scroll", handleScroll);
  });
  // ==========================
  // Return all encapsulated logic
  // ==========================
  return {
    // State
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
    userActivityScore,
    userActivityRank,
    preTestCompleted,
    postTestCompleted,
    popupQueue,
    activePopupIndex,
    popupsDismissed,
    tanitaRecords,
    showTanitaModal,
    loadingTanita,
    acceptDataDisclosure,
    showGoalModal,
    goalViewTab,
    goalLoading,
    goalData,
    goalConfigData,
    goalSearchQuery,
    goalSortBy,
    goalCurrentPage,
    goalPageSize,
    isFavorited,
    favoriteCount,
    showFloater,
    route,
    router,
    // Computed
    isUnlimited,
    isContinuousEvent,
    assessmentConfig,
    certConfigParsed,
    hasAssessment,
    isPreTestRequired,
    isPostTestRequired,
    isEventStarted,
    slotFull,
    slotPct,
    totalMissionsCount,
    completedMissionsCount,
    shouldShowTanita,
    currentMuscleToFatRatio,
    healthSummaryText,
    muscleFatTrendText,
    healthTrendClass,
    muscleFatTrendClass,
    metabolicTrendText,
    metabolicTrendClass,
    hasGoalConfig,
    goalConfigParsed,
    goalUnit,
    goalUnitLabel,
    paginatedGoalData,
    totalGoalPages,
    sanitizedRules,
    certConditionText,
    certCardState,
    tanitaConfig,
    tanitaRequiredDates,
    hasTanitaTask,
    postTestEligible,
    // Methods
    fetchEvent,
    joinActivity,
    leaveActivity,
    toggleFavorite,
    shareSocial,
    claimCert,
    openTanitaModal,
    openGoalModal,
    goToAssessment,
    dismissAllPopups,
    formatDateThai,
    getGoalName,
    getOriginalRank,
    isGoalCurrentUser,
    scrollToGoal,
    scrollToHeader,
    handleBack,
    goToMissions,
    getTanitaLabel,
    getTanitaDate,
    isPastOrToday,
    hasTanitaRecord,
    getPopupTheme,
    getPopupTitle,
    handleTouchStart,
    handleTouchEnd,
    handleSwipe,
    sanitizeHtml,
    currentUserRoleLabel,
  };
}
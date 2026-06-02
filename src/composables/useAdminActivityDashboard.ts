import { ref, computed, onMounted, onUnmounted } from "vue";
import { authStore } from "../store/auth";
import { swal, showSuccess, showError } from "../lib/swal";
import type { SmartTableColumn } from "../components/common/SmartTable.vue";
import { useRealtime } from "./useRealtime";

export function useAdminActivityDashboard(
  activityId: number,
  _activityTitle: string,
) {
  const loading = ref(true);
  const registrants = ref<any[]>([]);
  const teams = ref<any[]>([]);
  const eventInfo = ref<any>(null);
  const eventTasks = ref<any[]>([]);
  const submissions = ref<any[]>([]);
  const selectedUserIds = ref<number[]>([]);
  const selectedSubmissionIds = ref<number[]>([]);
  const isAssigningTeam = ref(false);
  const selectedTeamToAssign = ref<number | "">("");

  // แถบที่มีให้เลือก
  const activeTab = ref<
    | "overview"
    | "participants"
    | "submissions"
    | "tracking"
    | "participation"
    | "rankings"
    | "changes"
    | "responses"
  >("overview");
  const updatingId = ref<number | null>(null);
  const searchQuery = ref("");
  const selectedTaskIds = ref<number[]>([]);

  const thaiMonthLong = [
    "มกราคม",
    "กุมภาพันธ์",
    "มีนาคม",
    "เมษายน",
    "พฤษภาคม",
    "มิถุนายน",
    "กรกฎาคม",
    "สิงหาคม",
    "กันยายน",
    "ตุลาคม",
    "พฤศจิกายน",
    "ธันวาคม",
  ];
  const getYMD = (d: Date) =>
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0");
  const todayStr = getYMD(new Date());
  const todayMonthKey = todayStr.substring(0, 7);

  // Helper Functions
  const getTeamName = (id: number | null | undefined) => {
    if (!id) return "ไม่มีทีม";
    const team = teams.value.find((t) => t.id === id);
    return team ? team.name : "ไม่ระบุ";
  };

  const formatDist = (val: any) =>
    Number(val || 0).toLocaleString("th-TH", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    });

  const calculateAge = (dateString: string) => {
    if (!dateString) return "-";
    const birthYear = new Date(dateString).getFullYear();
    return new Date().getFullYear() - birthYear;
  };

  const formatDate = (ds: string) => {
    if (!ds) return "-";
    const d = new Date(ds);
    return d.toLocaleString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Computed Properties (Metrics & Tables)
  const totalParticipants = computed(() => registrants.value.length);
  const totalSubmissions = computed(() =>
    registrants.value.reduce((sum, r) => sum + (r.submission_count || 0), 0),
  );

  const daysActive = computed(() => {
    const startStr = eventInfo.value?.start_date || eventInfo.value?.created_at;
    if (!startStr) return "-";
    const start = new Date(startStr);
    const end = eventInfo.value?.is_continuous_event
      ? new Date()
      : eventInfo.value?.end_date
        ? new Date(eventInfo.value.end_date)
        : new Date();
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  });

  const rankingUnitLong = computed(() => {
    if (!eventInfo.value?.goal_config) return "แต้ม";
    try {
      const config =
        typeof eventInfo.value.goal_config === "string"
          ? JSON.parse(eventInfo.value.goal_config)
          : eventInfo.value.goal_config;
      const unit =
        config.target_unit ||
        config.unit ||
        (config.target_type !== "points" ? config.target_type : "");
      if (unit && unit !== "points") return unit;
    } catch (e) {}
    return "แต้ม";
  });

  const isPoints = computed(() =>
    ["pts", "แต้ม"].includes(rankingUnitLong.value),
  );

  const teamColors = computed(() => {
    const map: Record<number | string, string> = {};
    const palette = [
      "bg-sky-100",
      "bg-fuchsia-100",
      "bg-amber-100",
      "bg-rose-100",
      "bg-lime-100",
      "bg-indigo-100",
      "bg-orange-100",
    ];
    teams.value.forEach((t, i) => {
      map[t.id] = palette[i % palette.length];
    });
    return map;
  });

  const registrationTimes = computed(() => {
    const times: Record<string, number> = {
      "เช้าตรู่ (00-06)": 0,
      "เช้า (06-12)": 0,
      "บ่าย (12-17)": 0,
      "เย็น (17-21)": 0,
      "ดึก (21-24)": 0,
    };
    registrants.value.forEach((r) => {
      const t = r.joined_at || r.created_at;
      if (!t) return;
      const h = new Date(t).getHours();
      if (h >= 0 && h < 6) times["เช้าตรู่ (00-06)"]++;
      else if (h >= 6 && h < 12) times["เช้า (06-12)"]++;
      else if (h >= 12 && h < 17) times["บ่าย (12-17)"]++;
      else if (h >= 17 && h < 21) times["เย็น (17-21)"]++;
      else times["ดึก (21-24)"]++;
    });
    return Object.entries(times)
      .filter(([_, c]) => c > 0)
      .sort((a, b) => (b[1] as number) - (a[1] as number));
  });

  const ageRanges = computed(() => {
    const currentYear = new Date().getFullYear();
    const ranges = {
      "0-1": 0,
      "1-6": 0,
      "7-12": 0,
      "13-20": 0,
      "21-39": 0,
      "40-59": 0,
      "60+": 0,
      ไม่ระบุ: 0,
    };
    registrants.value.forEach((r) => {
      if (!r.birth_date) {
        ranges["ไม่ระบุ"]++;
        return;
      }
      const birthYear = new Date(r.birth_date).getFullYear();
      const age = currentYear - birthYear;
      if (age <= 1) ranges["0-1"]++;
      else if (age <= 6) ranges["1-6"]++;
      else if (age <= 12) ranges["7-12"]++;
      else if (age <= 20) ranges["13-20"]++;
      else if (age <= 39) ranges["21-39"]++;
      else if (age <= 59) ranges["40-59"]++;
      else ranges["60+"]++;
    });
    return Object.entries(ranges).filter(([_, count]) => count > 0);
  });

  const userTypes = computed(() => {
    const types: Record<string, number> = {
      นักเรียน: 0,
      นักศึกษา: 0,
      บุคลากรโรงพยาบาล: 0,
      บุคลากรมหาวิทยาลัย: 0,
      บุคคลทั่วไป: 0,
    };
    registrants.value.forEach((r) => {
      const type = r.role_type || r.role || "อื่นๆ";
      types[type] = (types[type] || 0) + 1;
    });
    return Object.entries(types).sort((a, b) => b[1] - a[1]);
  });

  const genderStats = computed(() => {
    const stats: Record<string, number> = { ชาย: 0, หญิง: 0, ไม่ระบุ: 0 };
    registrants.value.forEach((r) => {
      if (r.gender === "male" || r.gender === "ชาย") stats["ชาย"]++;
      else if (r.gender === "female" || r.gender === "หญิง") stats["หญิง"]++;
      else stats["ไม่ระบุ"]++;
    });
    return Object.entries(stats)
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1]);
  });

  // Table Columns
  const participantCols = computed<SmartTableColumn[]>(() => {
    const cols: SmartTableColumn[] = [
      { key: "select", label: "", width: "50px", align: "center" },
      {
        key: "profile",
        label: "ชื่อ - นามสกุล",
        sortable: true,
        sortKey: "fname_th",
        minWidth: 220,
        exportRender: (r) =>
          `${r.fname_th || ""} ${r.lname_th || ""}`.trim() || r.nickname || "-",
      },
      {
        key: "role_type",
        label: "ประเภทผู้ใช้งาน",
        sortable: true,
        exportRender: (r) => r.role_type || r.role || "-",
      },
      {
        key: "contact",
        label: "รายละเอียดผู้ใช้งาน",
        minWidth: 200,
        exportRender: (r) =>
          [r.email, r.phone, r.id_code].filter(Boolean).join(" | "),
      },
      {
        key: "age",
        label: "สถิติอายุ (ปี)",
        exportRender: (r) =>
          r.birth_date
            ? String(
                new Date().getFullYear() - new Date(r.birth_date).getFullYear(),
              )
            : "-",
      },
    ];
    cols.push({
      key: "submission_count",
      label: "จำนวนส่งภารกิจ",
      sortable: true,
      sortKey: "submission_count",
      align: "center",
      exportRender: (r) => r.submission_count ?? 0,
    });
    if (goalDisplay.value)
      cols.push({
        key: "goal_status",
        label: "เป้าหมายกิจกรรม",
        align: "center",
        sortable: true,
        sortKey: "goal_percent",
        minWidth: 150,
        exportRender: (r) =>
          r.goal_target > 0
            ? `${r.goal_achieved ?? 0}/${r.goal_target ?? 0} (${r.goal_percent ?? 0}%)`
            : "-",
      });
    cols.push({
      key: "team",
      label: "ทีม",
      align: "center",
      exportRender: (r) => getTeamName(r.team_id),
    });
    cols.push({
      key: "actions",
      label: "จัดการ",
      align: "center",
      width: "100px",
    });
    return cols;
  });

  const submissionCols = computed<SmartTableColumn[]>(() => [
    {
      key: "created_at",
      label: "ส่งเมื่อ",
      sortable: true,
      sortKey: "created_at",
      exportRender: (r) => formatDate(r.created_at),
    },
    {
      key: "profile",
      label: "ชื่อ - นามสกุล",
      sortable: true,
      sortKey: "fname_th",
      exportRender: (r) =>
        `${r.fname_th || ""} ${r.lname_th || ""}`.trim() || "-",
    },
    {
      key: "task",
      label: "ภารกิจที่ทำ",
      minWidth: 200,
      exportRender: (r) =>
        [r.task_type, r.task_note || r.activity_type]
          .filter(Boolean)
          .join(" - ") || "-",
    },
    {
      key: "img",
      label: "หลักฐาน",
      align: "center",
      exportRender: (r) => (r.img_url ? r.img_url : "-"),
    },
    {
      key: "value",
      label: "ค่าที่ส่ง",
      exportRender: (r) => {
        if (r.proof_type === "line") return "รูปแชท LINE";
        if (r.text_response) return r.text_response;
        if (r.value != null && Number(r.value) !== 0)
          return `${r.value} ${r.metric_unit || r.metric_type || ""}`.trim();
        return "-";
      },
    },
    {
      key: "status",
      label: "สถานะ",
      sortable: true,
      sortKey: "status",
      align: "center",
      exportRender: (r) =>
        ({ approved: "อนุมัติ", pending: "รอดำเนินการ", rejected: "ปฏิเสธ" })[
          r.status as string
        ] || r.status,
    },
    { key: "actions", label: "จัดการ", align: "center", width: "120px" },
  ]);

  const rankingCols = computed<SmartTableColumn[]>(() => [
    {
      key: "rank",
      label: "#",
      width: "60px",
      align: "center",
      exportRender: (r) => r._rank ?? "-",
    },
    {
      key: "profile",
      label: "ชื่อ - นามสกุล / ทีม",
      sortable: true,
      sortKey: "fname_th",
      minWidth: 200,
      exportRender: (r) =>
        r.team_name ||
        `${r.fname_th || ""} ${r.lname_th || ""}`.trim() ||
        r.name ||
        "-",
    },
    {
      key: "streak",
      label: "สตรีค",
      align: "center",
      width: "90px",
      exportRender: (r) => r.streak ?? 0,
    },
    {
      key: "score",
      label: "คะแนน/ระยะทาง",
      sortable: true,
      sortKey: "total_points",
      align: "right",
      minWidth: 140,
      exportRender: (r) => r.total_points ?? r.score ?? 0,
    },
  ]);

  const viewOption = ref("newest");
  const filteredRegistrants = computed(() => {
    let list = [...registrants.value];
    if (viewOption.value === "has_team")
      list = list.filter((r) => r.team_id != null);
    else if (viewOption.value === "no_team")
      list = list.filter((r) => r.team_id == null);
    else if (viewOption.value === "oldest")
      list.sort((a, b) => a.user_id - b.user_id);
    else if (viewOption.value === "name_az")
      list.sort((a, b) =>
        (a.fname_th || "").localeCompare(b.fname_th || "", "th"),
      );
    else if (viewOption.value === "name_za")
      list.sort((a, b) =>
        (b.fname_th || "").localeCompare(a.fname_th || "", "th"),
      );
    else if (viewOption.value === "team")
      list.sort((a, b) => (a.team_id || Infinity) - (b.team_id || Infinity));
    else list.sort((a, b) => b.user_id - a.user_id);

    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase().trim();
      list = list.filter(
        (r) =>
          (r.fname_th || "").toLowerCase().includes(q) ||
          (r.lname_th || "").toLowerCase().includes(q) ||
          (r.id_code || "").toLowerCase().includes(q) ||
          String(r.user_id).includes(q),
      );
    }
    return list;
  });

  const filteredSubmissions = computed(() => {
    let list = [...submissions.value];
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase().trim();
      list = list.filter(
        (s) =>
          (s.fname_th || "").toLowerCase().includes(q) ||
          (s.lname_th || "").toLowerCase().includes(q) ||
          (s.task_note || "").toLowerCase().includes(q) ||
          (s.task_type || "").toLowerCase().includes(q),
      );
    }
    return list;
  });

  // Rankings
  const rankingsIndividual = ref<any[]>([]);
  const rankingsTeam = ref<any[]>([]);
  const rankingsTab = ref<"individual" | "team">("individual");
  const rankingsLoading = ref(false);
  const currentRankingList = computed(() =>
    rankingsTab.value === "individual"
      ? rankingsIndividual.value
      : rankingsTeam.value,
  );

  const filteredRankings = computed(() => {
    let list = [...currentRankingList.value];
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase().trim();
      list = list.filter(
        (r) =>
          (r.name || r.fname_th || "").toLowerCase().includes(q) ||
          (r.lname_th || "").toLowerCase().includes(q) ||
          (r.team_name || "").toLowerCase().includes(q) ||
          (r.id_code || "").toLowerCase().includes(q),
      );
    }
    return list;
  });

  const rankingTableData = computed(() =>
    currentRankingList.value.map((item, idx) => ({ ...item, _rank: idx + 1 })),
  );

  const fetchRankings = async () => {
    if (rankingsLoading.value) return;
    rankingsLoading.value = true;
    try {
      const [indRes, teamRes] = await Promise.all([
        fetch(
          `/api/stats/rankings/individual?page=1&limit=100&activity_id=${activityId}`,
        ),
        fetch(
          `/api/stats/rankings/team?page=1&limit=100&activity_id=${activityId}`,
        ),
      ]);
      if (indRes.ok) rankingsIndividual.value = await indRes.json();
      if (teamRes.ok) rankingsTeam.value = await teamRes.json();
    } catch {
      // intentionally silent (no console output in browser)
    } finally {
      rankingsLoading.value = false;
    }
  };

  // ─── Health & Body Comparison ──────────────────────────────────────────
  const tanitaChanges = ref<any[]>([]);
  const assessmentComparison = ref<any[]>([]);
  const assessmentPartStats = ref<{ partStats: any[]; questionStats: any[] }>({
    partStats: [],
    questionStats: [],
  });
  const loadingComparison = ref(false);

  const filteredTanitaChanges = computed(() => {
    let list = [...tanitaChanges.value];
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase().trim();
      list = list.filter(
        (s) =>
          (s.fname_th || "").toLowerCase().includes(q) ||
          (s.lname_th || "").toLowerCase().includes(q) ||
          (s.nickname || "").toLowerCase().includes(q),
      );
    }
    return list;
  });

  const filteredAssessmentComparison = computed(() => {
    let list = [...assessmentComparison.value];
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase().trim();
      list = list.filter(
        (s) =>
          (s.fname_th || "").toLowerCase().includes(q) ||
          (s.lname_th || "").toLowerCase().includes(q) ||
          (s.nickname || "").toLowerCase().includes(q),
      );
    }
    return list;
  });

  const generateNarrative = (history: any[]) => {
    if (history.length < 2) return "ข้อมูลยังไม่เพียงพอต่อการวิเคราะห์";

    const first = history[0];
    const last = history[history.length - 1];
    const wDiff = Number(last.weight) - Number(first.weight);

    // Check for continuous decrease
    let isContinuousDecrease = true;
    for (let i = 1; i < history.length; i++) {
      if (Number(history[i].weight) > Number(history[i - 1].weight)) {
        isContinuousDecrease = false;
        break;
      }
    }

    // Check for "U-shape" (went up then down)
    let maxWeightIdx = 0;
    for (let i = 1; i < history.length; i++) {
      if (Number(history[i].weight) > Number(history[maxWeightIdx].weight))
        maxWeightIdx = i;
    }
    const isUpThenDown =
      maxWeightIdx > 0 &&
      maxWeightIdx < history.length - 1 &&
      Number(last.weight) < Number(history[maxWeightIdx].weight);

    if (wDiff < -2 && isContinuousDecrease)
      return "รักษาวินัยได้ดีเยี่ยม น้ำหนักลดลงอย่างต่อเนื่อง";
    if (wDiff < -1 && isUpThenDown)
      return "มีช่วงน้ำหนักขึ้นเล็กน้อยแต่คุมกลับมาได้ดีในตอนท้าย";
    if (wDiff < -0.5) return "มีความก้าวหน้าในทิศทางที่ดี น้ำหนักโดยรวมลดลง";
    if (Math.abs(wDiff) <= 0.5) return "น้ำหนักค่อนข้างคงที่ รักษาสมดุลได้ดี";
    if (wDiff > 1)
      return "น้ำหนักมีแนวโน้มเพิ่มขึ้น ควรติดตามและให้คำแนะนำเพิ่มเติม";

    return "เริ่มเห็นการเปลี่ยนแปลงในภาพรวม";
  };

  const fetchComparisonData = async () => {
    if (loadingComparison.value) return;
    loadingComparison.value = true;
    try {
      const [statsRes, assessmentRes, partStatsRes] = await Promise.all([
        fetch(`/api/activities/${activityId}/admin-stats`, {
          headers: { "x-user-id": String(authStore.user?.id) },
        }),
        fetch(`/api/activities/${activityId}/assessments`, {
          headers: { "x-user-id": String(authStore.user?.id) },
        }),
        fetch(`/api/activities/${activityId}/assessment-part-stats`, {
          headers: { "x-user-id": String(authStore.user?.id) },
        }),
      ]);

      if (partStatsRes.ok) {
        assessmentPartStats.value = await partStatsRes.json();
      }

      if (statsRes.ok) {
        const stats = await statsRes.json();
        const records = stats.tanita || [];
        const userMap = new Map();

        // Map registrants for profile info
        if (stats.registrants) {
          stats.registrants.forEach((r: any) => {
            userMap.set(r.user_id, {
              user_id: r.user_id,
              fname_th: r.fname_th,
              lname_th: r.lname_th,
              nickname: r.nickname,
              picture_url: r.picture_url,
              team_name: getTeamName(r.team_id),
              gender: r.gender,
              id_code: r.id_code,
              birth_date: r.birth_date,
              first_tanita: null,
              latest_tanita: null,
            });
          });
        }

        const userProgressMap = new Map();

        records.forEach((rec: any) => {
          if (!userProgressMap.has(rec.user_id)) {
            userProgressMap.set(rec.user_id, []);
          }
          const history = userProgressMap.get(rec.user_id);
          const last = history[history.length - 1];

          // Keep only the latest record of each session
          if (last && last.session_label === rec.session_label) {
            history[history.length - 1] = rec;
          } else {
            history.push(rec);
          }
        });

        tanitaChanges.value = Array.from(userMap.values())
          .map((u) => {
            const history = userProgressMap.get(u.user_id) || [];
            return {
              ...u,
              history,
              first_tanita: history[0] || null,
              latest_tanita: history[history.length - 1] || null,
              summary: generateNarrative(history),
            };
          })
          .filter((u) => u.history.length >= 2);
      }

      if (assessmentRes.ok) {
        const rows = await assessmentRes.json();
        const userMap = new Map();

        rows.forEach((r: any) => {
          if (!userMap.has(r.user_id)) {
            userMap.set(r.user_id, {
              user_id: r.user_id,
              fname_th: r.fname_th,
              lname_th: r.lname_th,
              nickname: r.nickname,
              picture_url: r.picture_url,
              team_name: r.team_name,
              pre_score: null,
              post_score: null,
              pre_date: null,
              post_date: null,
            });
          }
          const u = userMap.get(r.user_id);
          const type = r.test_type || r.type;
          if (type === "pre_test") {
            u.pre_score = r.total_score;
            u.pre_date = r.submitted_at || r.created_at;
          } else if (type === "post_test") {
            u.post_score = r.total_score;
            u.post_date = r.submitted_at || r.created_at;
          }
        });

        assessmentComparison.value = Array.from(userMap.values()).filter(
          (u) => u.pre_score !== null || u.post_score !== null,
        );
      }
    } catch {
      // intentionally silent (no console output in browser)
    } finally {
      loadingComparison.value = false;
    }
  };

  // Fetch Data
  const fetchStats = async (isBackground = false) => {
    if (!isBackground) loading.value = true;
    try {
      const res = await fetch(`/api/activities/${activityId}/admin-stats`, {
        headers: { "x-user-id": String(authStore.user?.id) },
      });
      if (res.ok) {
        const data = await res.json();
        eventInfo.value = data.event;
        eventTasks.value = data.tasks || [];
        registrants.value = data.registrants;
        teams.value = data.teams;
        submissions.value = data.submissions || [];

        const goalRes = await fetch(
          `/api/stats/goal-progress/${activityId}?type=individual`,
          { headers: { "x-user-id": String(authStore.user?.id) } },
        );
        if (goalRes.ok) {
          const goalJson = await goalRes.json();
          const gMap = new Map();
          (goalJson.data || []).forEach((g: any) => gMap.set(Number(g.id), g));

          registrants.value = registrants.value.map((r) => {
            const gd = gMap.get(Number(r.user_id));
            return {
              ...r,
              goal_reached: gd?.reached || false,
              goal_percent: gd?.percent || 0,
              goal_achieved: gd?.achieved || 0,
              goal_target: gd?.target || 0,
            };
          });
        }
      }
    } catch {
      // intentionally silent (no console output in browser)
    } finally {
      loading.value = false;
    }
  };

  useRealtime({
    onActivityUpdated: (data) => {
      if (Number(data.id) === Number(activityId)) {
        fetchStats(true);
      }
    },
    onSubmissionCreated: (data) => {
      if (Number(data.activity_id) === Number(activityId)) {
        fetchStats(true);
        if (activeTab.value === "rankings") fetchRankings();
      }
    },
    onSubmissionUpdated: (data) => {
      if (Number(data.activity_id) === Number(activityId)) {
        fetchStats(true);
        if (activeTab.value === "rankings") fetchRankings();
      }
    },
    onSubmissionDeleted: (data) => {
      // Note: Backend event might not have activity_id, but let's assume it does or we refresh just in case
      fetchStats(true);
      if (activeTab.value === "rankings") fetchRankings();
    },
    onTeamUpdated: (data) => {
      if (Number(data.activity_id) === Number(activityId)) {
        fetchStats(true);
      }
    },
  });

  onMounted(() => {
    fetchStats();
  });

  // Actions
  const updateSubStatus = async (id: number, status: string) => {
    updatingId.value = id;
    try {
      const res = await fetch(`/api/missions/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(authStore.user?.id),
        },
        body: JSON.stringify({ status, note: "" }),
      });
      if (res.ok) {
        const sub = submissions.value.find((s) => s.id === id);
        if (sub) {
          sub.status = status;
          sub.note = "";
        }
        showSuccess(
          status === "approved" ? "อนุมัติสำเร็จ" : "ดำเนินการสำเร็จ",
        );
      } else showError("เกิดข้อผิดพลาดในการอัปเดตข้อมูล");
    } catch {
      showError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      updatingId.value = null;
    }
  };

  const bulkUpdateSubmissionStatus = async (status: string) => {
    if (selectedSubmissionIds.value.length === 0) return;
    loading.value = true;
    try {
      const res = await fetch("/api/missions/bulk-status", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(authStore.user?.id),
        },
        body: JSON.stringify({
          ids: selectedSubmissionIds.value,
          status,
          note: "",
        }),
      });
      if (res.ok) {
        submissions.value.forEach((s) => {
          if (selectedSubmissionIds.value.includes(s.id)) {
            s.status = status;
            s.note = "";
          }
        });
        selectedSubmissionIds.value = [];
        showSuccess("ดำเนินการสำเร็จ");
      } else showError("เกิดข้อผิดพลาด");
    } catch {
      showError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      loading.value = false;
    }
  };

  const deleteSubmission = async (id: number) => {
    updatingId.value = id;
    try {
      const res = await fetch(`/api/missions/submission/${id}`, {
        method: "DELETE",
        headers: { "x-user-id": String(authStore.user?.id) },
      });
      if (res.ok) {
        submissions.value = submissions.value.filter((s) => s.id !== id);
        showSuccess("ลบรายการสำเร็จ");
      } else showError("ลบไม่สำเร็จ");
    } catch {
      showError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      updatingId.value = null;
    }
  };

  const bulkDeleteSubmissions = async () => {
    if (selectedSubmissionIds.value.length === 0) return;
    loading.value = true;
    try {
      const res = await fetch("/api/missions/bulk-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(authStore.user?.id),
        },
        body: JSON.stringify({ ids: selectedSubmissionIds.value }),
      });
      if (res.ok) {
        submissions.value = submissions.value.filter(
          (s) => !selectedSubmissionIds.value.includes(s.id),
        );
        selectedSubmissionIds.value = [];
        showSuccess("ลบรายการที่เลือกสำเร็จ");
      } else showError("เกิดข้อผิดพลาดในการลบแบบกลุ่ม");
    } catch {
      showError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      loading.value = false;
    }
  };

  const updateSubmissionValue = async (
    id: number,
    newValue: number | string,
  ) => {
    updatingId.value = id;
    try {
      const res = await fetch(`/api/missions/submission/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(authStore.user?.id),
        },
        body: JSON.stringify({ value: newValue }),
      });
      if (res.ok) {
        const data = await res.json();
        const subIdx = submissions.value.findIndex((s) => s.id === id);
        if (subIdx > -1)
          submissions.value[subIdx] = {
            ...submissions.value[subIdx],
            ...data.submission,
          };
        showSuccess("แก้ไขข้อมูลสำเร็จ");
        return true;
      } else {
        const err = await res.json().catch(() => ({}));
        showError(err.error || "แก้ไขข้อมูลไม่สำเร็จ");
        return false;
      }
    } catch {
      showError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
      return false;
    } finally {
      updatingId.value = null;
    }
  };

  const assignTeam = async () => {
    if (selectedUserIds.value.length === 0 || loading.value) return;
    loading.value = true;
    try {
      const res = await fetch(`/api/activities/${activityId}/assign-team`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(authStore.user?.id),
        },
        body: JSON.stringify({
          userIds: selectedUserIds.value,
          teamId:
            selectedTeamToAssign.value === ""
              ? null
              : selectedTeamToAssign.value,
        }),
      });
      if (res.ok) {
        isAssigningTeam.value = false;
        selectedUserIds.value = [];
        fetchStats();
      } else swal.fire("เกิดข้อผิดพลาด", "ไม่สามารถจัดทีมได้", "error");
    } catch {
      // intentionally silent (no console output in browser)
    } finally {
      loading.value = false;
    }
  };

  const removeParticipants = async () => {
    if (selectedUserIds.value.length === 0) return;
    const { isConfirmed } = await swal.fire({
      title: "ยืนยันการนำออก?",
      text: `คุณต้องการนำผู้ใช้ ${selectedUserIds.value.length} รายการออกจากกิจกรรมใช่หรือไม่?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#94a3b8",
      confirmButtonText: "นำออก",
      cancelButtonText: "ยกเลิก",
    });
    if (!isConfirmed) return;

    loading.value = true;
    try {
      // For bulk kick in a single event, we can use the existing /admin/kick endpoint in parallel
      await Promise.all(
        selectedUserIds.value.map((userId) =>
          fetch(`/api/activities/admin/kick`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-user-id": String(authStore.user?.id),
            },
            body: JSON.stringify({ userId, eventId: activityId }),
          }),
        ),
      );

      showSuccess("นำผู้ใช้ออกจากกิจกรรมเรียบร้อยแล้ว");
      selectedUserIds.value = [];
      fetchStats();
    } catch {
      showError("เกิดข้อผิดพลาด ไม่สามารถนำผู้ใช้ออกได้");
    } finally {
      loading.value = false;
    }
  };

  const toggleTaskFilter = (taskId: number) => {
    const idx = selectedTaskIds.value.indexOf(taskId);
    if (idx > -1) selectedTaskIds.value.splice(idx, 1);
    else selectedTaskIds.value.push(taskId);
  };

  // Tracking Logic
  const trackingDates = computed(() => {
    let rawStart =
      eventInfo.value?.is_continuous_event && eventInfo.value?.created_at
        ? eventInfo.value.created_at
        : eventInfo.value?.start_date || eventInfo.value?.created_at;
    if (!rawStart) {
      const d = new Date();
      d.setDate(d.getDate() - 14);
      rawStart = d.toISOString();
    }
    const startStr =
      typeof rawStart === "string"
        ? rawStart.substring(0, 10)
        : getYMD(new Date(rawStart));
    const start = new Date(startStr);
    if (eventInfo.value?.is_continuous_event) {
      const now = new Date();
      if (start.getFullYear() === now.getFullYear()) start.setMonth(0, 1);
    }
    start.setHours(0, 0, 0, 0);
    let actualEnd = eventInfo.value?.end_date
      ? new Date(eventInfo.value.end_date)
      : new Date();
    if (!eventInfo.value?.end_date)
      actualEnd.setMonth(actualEnd.getMonth() + 1);
    actualEnd.setHours(23, 59, 59, 999);
    if (actualEnd < start) {
      actualEnd = new Date(start);
      actualEnd.setDate(actualEnd.getDate() + 30);
    }
    const dates = [];
    let curr = new Date(start);
    let maxDays = 2000;
    while (curr <= actualEnd && maxDays > 0) {
      dates.push(new Date(curr));
      curr.setDate(curr.getDate() + 1);
      maxDays--;
    }
    return dates.length ? dates : [new Date()];
  });

  const selectedYear = ref<number>(new Date().getFullYear());
  const selectedMonth = ref<number>(new Date().getMonth());

  const yearOptions = computed(() => {
    const currentYear = new Date().getFullYear();
    const startYearValue = eventInfo.value?.start_date
      ? new Date(eventInfo.value.start_date).getFullYear()
      : currentYear;
    const minYear = Math.min(startYearValue, currentYear - 5);
    let maxYear = currentYear + 10;
    if (eventInfo.value?.end_date)
      maxYear = Math.max(
        maxYear,
        new Date(eventInfo.value.end_date).getFullYear(),
      );
    const years = [];
    for (let y = minYear; y <= maxYear; y++)
      years.push({ value: y, label: `${y}` });
    return years;
  });

  const monthOptions = computed(() =>
    [
      "มกราคม",
      "กุมภาพันธ์",
      "มีนาคม",
      "เมษายน",
      "พฤษภาคม",
      "มิถุนายน",
      "กรกฎาคม",
      "สิงหาคม",
      "กันยายน",
      "ตุลาคม",
      "พฤศจิกายน",
      "ธันวาคม",
    ].map((label, index) => ({ value: index, label })),
  );

  const goToMonth = (dir: number) => {
    let newMonth = selectedMonth.value + dir;
    let newYear = selectedYear.value;
    if (newMonth > 11) {
      newMonth = 0;
      newYear++;
    } else if (newMonth < 0) {
      newMonth = 11;
      newYear--;
    }
    if (yearOptions.value.some((o) => o.value === newYear)) {
      selectedYear.value = newYear;
      selectedMonth.value = newMonth;
    }
  };
  const goToToday = () => {
    const now = new Date();
    selectedYear.value = now.getFullYear();
    selectedMonth.value = now.getMonth();
  };

  const getMonthColumns = (year: number, month: number) => {
    const columns: any[] = [];
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const rawStart =
      eventInfo.value?.is_continuous_event && eventInfo.value?.created_at
        ? eventInfo.value.created_at
        : eventInfo.value?.start_date ||
          eventInfo.value?.created_at ||
          new Date().toISOString();
    const startYMD =
      typeof rawStart === "string"
        ? rawStart.substring(0, 10)
        : getYMD(new Date(rawStart));
    const rawEnd = eventInfo.value?.is_continuous_event
      ? "9999-99-99"
      : eventInfo.value?.end_date || "9999-99-99";
    const endYMD =
      typeof rawEnd === "string"
        ? rawEnd.substring(0, 10)
        : getYMD(new Date(rawEnd));

    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const dStr = getYMD(d);
      if (dStr < startYMD || dStr > endYMD) continue;
      const dayOfWeek = d.getDay();
      const tasksToday = eventTasks.value.filter((task) => {
        const tDateStr = task.task_date ? task.task_date.split("T")[0] : null;
        if (tDateStr) return tDateStr === dStr;
        let allowed = task.allowed_days;
        if (typeof allowed === "string")
          try {
            allowed = JSON.parse(allowed);
          } catch {
            allowed = null;
          }
        return (
          Array.isArray(allowed) &&
          allowed.some((day) => Number(day) === dayOfWeek)
        );
      });
      tasksToday.forEach((task) =>
        columns.push({ date: new Date(d), dStr, task }),
      );
    }
    return columns;
  };

  const currentMonthColumns = computed(() => {
    const cols = getMonthColumns(selectedYear.value, selectedMonth.value);
    return selectedTaskIds.value.length
      ? cols.filter((c) => selectedTaskIds.value.includes(c.task.id))
      : cols;
  });

  const currentMonthDates = computed(() => {
    const dates: any[] = [];
    const year = selectedYear.value;
    const month = selectedMonth.value;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const rawStart =
      eventInfo.value?.is_continuous_event && eventInfo.value?.created_at
        ? eventInfo.value.created_at
        : eventInfo.value?.start_date ||
          eventInfo.value?.created_at ||
          new Date().toISOString();
    const startYMD =
      typeof rawStart === "string"
        ? rawStart.substring(0, 10)
        : getYMD(new Date(rawStart));

    const rawEnd = eventInfo.value?.is_continuous_event
      ? "9999-99-99"
      : eventInfo.value?.end_date || "9999-99-99";
    const endYMD =
      typeof rawEnd === "string"
        ? rawEnd.substring(0, 10)
        : getYMD(new Date(rawEnd));

    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const dStr = getYMD(d);
      if (dStr < startYMD || dStr > endYMD) continue;
      dates.push({ date: d, dStr });
    }
    return dates;
  });

  const visibleTasks = computed(() => {
    if (selectedTaskIds.value.length === 0) return eventTasks.value;
    return eventTasks.value.filter((t) => selectedTaskIds.value.includes(t.id));
  });

  const isTaskExpectedOnDate = (taskId: number, dStr: string) => {
    const task = eventTasks.value.find((t) => t.id === taskId);
    if (!task) return false;
    const date = new Date(dStr);
    const dayOfWeek = date.getDay();
    const tDateStr = task.task_date ? task.task_date.split("T")[0] : null;
    if (tDateStr) return tDateStr === dStr;
    let allowed = task.allowed_days;
    if (typeof allowed === "string") {
      try {
        allowed = JSON.parse(allowed);
      } catch {
        allowed = null;
      }
    }
    return (
      Array.isArray(allowed) && allowed.some((day) => Number(day) === dayOfWeek)
    );
  };

  const userTrackingSheet = computed(() => {
    let list = filteredRegistrants.value;
    const todayStr = getYMD(new Date());
    return list
      .map((r) => {
        const regDateStr =
          r.joined_at || r.created_at
            ? getYMD(new Date(r.joined_at || r.created_at))
            : "1900-01-01";
        const userSubs = submissions.value.filter(
          (s) => s.user_id === r.user_id && s.status !== "rejected",
        );
        const taskStatus: Record<string, any> = {};
        currentMonthColumns.value.forEach((col) => {
          taskStatus[`${col.dStr}_${col.task.id}`] =
            userSubs.find(
              (s) =>
                s.task_id === col.task.id &&
                getYMD(new Date(s.created_at)) === col.dStr,
            ) || null;
        });
        const expected = currentMonthColumns.value.filter(
          (c) =>
            c.dStr <= todayStr &&
            (!eventInfo.value?.is_continuous_event || c.dStr >= regDateStr),
        );
        const completed = expected.filter(
          (c) => taskStatus[`${c.dStr}_${c.task.id}`],
        ).length;
        return {
          ...r,
          taskStatus,
          missedCount: expected.length - completed,
          totalExpected: expected.length,
          completed,
          percentage: expected.length
            ? Math.round((completed * 100) / expected.length)
            : 0,
        };
      })
      .sort(
        (a, b) =>
          (a.team_id || Infinity) - (b.team_id || Infinity) ||
          b.missedCount - a.missedCount,
      );
  });

  // Participation
  const trackingMonthOptions = computed(() =>
    [
      "มกราคม",
      "กุมภาพันธ์",
      "มีนาคม",
      "เมษายน",
      "พฤษภาคม",
      "มิถุนายน",
      "กรกฎาคม",
      "สิงหาคม",
      "กันยายน",
      "ตุลาคม",
      "พฤศจิกายน",
      "ธันวาคม",
    ].map((label, m) => ({
      value: `${selectedYear.value}-${String(m + 1).padStart(2, "0")}`,
      label,
    })),
  );

  const participationExpected = computed(() => {
    const perMonth: Record<string, number> = {};
    let total = 0;
    const config =
      typeof eventInfo.value?.goal_config === "string"
        ? JSON.parse(eventInfo.value.goal_config || "{}")
        : eventInfo.value?.goal_config || {};
    const monthlyGoal =
      config.target_count || config.target_amount || config.target_value
        ? Number(
            config.target_count || config.target_amount || config.target_value,
          )
        : Infinity;
    const todayMonthKey = getYMD(new Date()).substring(0, 7);

    trackingMonthOptions.value.forEach((opt) => {
      const [y, m] = opt.value.split("-").map((v) => parseInt(v, 10));
      const allMissions = getMonthColumns(y, m - 1);
      const actualTarget = isFinite(monthlyGoal)
        ? Math.min(monthlyGoal, allMissions.length)
        : allMissions.length;
      perMonth[opt.value] = actualTarget;
      const rawStart =
        eventInfo.value?.is_continuous_event && eventInfo.value?.created_at
          ? eventInfo.value.created_at
          : eventInfo.value?.start_date ||
            eventInfo.value?.created_at ||
            new Date().toISOString();
      if (
        opt.value <= todayMonthKey &&
        (eventInfo.value?.is_continuous_event ||
          (new Date(opt.value) >= new Date(rawStart.substring(0, 7)) &&
            (!eventInfo.value?.end_date ||
              new Date(opt.value) <= new Date(eventInfo.value.end_date))))
      )
        total += actualTarget;
    });
    return { perMonth, total };
  });

  const goalDisplay = computed(() => {
    if (!eventInfo.value?.goal_config) return null;
    try {
      const config =
        typeof eventInfo.value.goal_config === "string"
          ? JSON.parse(eventInfo.value.goal_config)
          : eventInfo.value.goal_config;
      if (!config?.enabled) return null;

      let typeLabel = "เป้าหมายกิจกรรม";
      let unit = config.target_unit || config.unit || config.target_type || "";

      if (config.target_type === "points") {
        typeLabel = "เป้าหมายคะแนน";
        unit = "คะแนน";
      } else if (
        ["km", "m", "distance", "kilometers", "meters"].includes(
          config.target_type,
        )
      ) {
        typeLabel = "เป้าหมายระยะทาง";
        unit = ["m", "meters"].includes(config.target_type) ? "เมตร" : "กม.";
      } else if (["cal", "calories"].includes(config.target_type)) {
        typeLabel = "เป้าหมายเผาผลาญ";
        unit = "kcal";
      } else if (config.target_type === "steps") {
        typeLabel = "เป้าหมายจำนวนก้าว";
        unit = "ก้าว";
      } else if (
        ["min", "hr", "minutes", "hours"].includes(config.target_type)
      ) {
        typeLabel = "เป้าหมายเวลา";
        unit = ["min", "minutes"].includes(config.target_type)
          ? "นาที"
          : "ชั่วโมง";
      } else if (
        ["times", "submissions", "missions"].includes(config.target_type)
      ) {
        typeLabel = "เป้าหมายความถี่";
        unit = "ครั้ง";
      } else if (config.target_type === "meal") {
        typeLabel = "เป้าหมายมื้ออาหาร";
        unit = "มื้อ";
      } else if (config.target_type === "kg") {
        typeLabel = "เป้าหมายน้ำหนัก";
        unit = "กก.";
      } else if (config.target_type === "level") {
        typeLabel = "เป้าหมายระดับ";
        unit = "ระดับ";
      }

      const freq = config.target_frequency === "monthly" ? "/เดือน" : "";
      return {
        label: typeLabel,
        value: Number(
          config.target_value ||
            config.target_amount ||
            config.target_count ||
            0,
        ).toLocaleString(),
        unit: unit + freq,
      };
    } catch {
      return null;
    }
  });

  const userParticipationSheet = computed(() => {
    const { perMonth, total } = participationExpected.value;
    const todayMonthKey = getYMD(new Date()).substring(0, 7);
    return filteredRegistrants.value
      .map((r) => {
        const userSubs = submissions.value.filter(
          (s) => s.user_id === r.user_id && s.status !== "rejected",
        );
        const monthlySubmissions: Record<string, number> = {};
        let totalUser = 0;
        trackingMonthOptions.value.forEach((opt) => {
          const [y, m] = opt.value.split("-").map((v) => parseInt(v, 10));
          const count = getMonthColumns(y, m - 1).filter((col) =>
            userSubs.some(
              (s) =>
                s.task_id === col.task.id &&
                getYMD(new Date(s.created_at)) === col.dStr,
            ),
          ).length;
          monthlySubmissions[opt.value] = count;
          if (opt.value <= todayMonthKey)
            totalUser += Math.min(count, perMonth[opt.value] || 0);
        });
        return {
          ...r,
          monthlySubmissions,
          totalUserSubs: totalUser,
          totalExpected: total,
          percentage: total ? (totalUser * 100) / total : 0,
        };
      })
      .sort(
        (a, b) =>
          (a.team_id || Infinity) - (b.team_id || Infinity) ||
          b.percentage - a.percentage,
      );
  });

  // Modal Methods
  const showMissedModal = ref(false);
  const selectedMissedUser = ref<any>(null);
  const missedDetailsList = ref<{ date: string; tasks: any[] }[]>([]);

  const openMissedModal = (ut: any) => {
    selectedMissedUser.value = ut;
    const details = [];
    const userSubs = submissions.value.filter(
      (s) => s.user_id === ut.user_id && s.status !== "rejected",
    );
    const regDate =
      ut.joined_at || ut.created_at
        ? getYMD(new Date(ut.joined_at || ut.created_at))
        : "1900-01-01";
    const today = getYMD(new Date());
    trackingDates.value.forEach((d) => {
      const dStr = getYMD(d);
      if (
        dStr > today ||
        (eventInfo.value?.is_continuous_event && dStr < regDate)
      )
        return;
      const tasks = eventTasks.value.filter((t) => {
        let allowed = true;
        if (t.allowed_days) {
          const days =
            typeof t.allowed_days === "string"
              ? JSON.parse(t.allowed_days)
              : t.allowed_days;
          if (Array.isArray(days)) allowed = days.includes(d.getDay());
        }
        return (
          allowed &&
          !userSubs.some(
            (s) =>
              s.task_id === t.id && getYMD(new Date(s.created_at)) === dStr,
          )
        );
      });
      if (tasks.length) details.push({ date: dStr, tasks });
    });
    missedDetailsList.value = details.reverse();
    showMissedModal.value = true;
  };

  const showUserProfileModal = ref(false);
  const selectedUserProfile = ref<any>(null);
  const selectedUserSubmissions = ref<any[]>([]);
  const selectedUserRegistrations = ref<any[]>([]);
  const profileLoading = ref(false);

  const openUserProfile = async (u: any) => {
    selectedUserProfile.value = { ...u };
    selectedUserRegistrations.value = [];
    selectedUserSubmissions.value = submissions.value
      .filter((s) => s.user_id === u.user_id)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    showUserProfileModal.value = true;
    profileLoading.value = true;
    try {
      const res = await fetch(`/api/users/${u.user_id}/full-profile`, {
        headers: { "x-user-id": String(authStore.user?.id) },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user) selectedUserProfile.value = { ...u, ...data.user };
        selectedUserRegistrations.value = (data.registrations || []).map(
          (r: any) => ({
            id: r.id,
            event: {
              id: r.event_id,
              title: r.title,
              poster: r.poster,
              start_date: r.start_date,
              end_date: r.end_date,
              status: r.event_status,
            },
          }),
        );
        if (data.submissions?.length) {
          const taskIds = new Set(eventTasks.value.map((t) => t.id));
          const filtered = data.submissions.filter((s: any) =>
            taskIds.has(s.task_id),
          );
          if (filtered.length) selectedUserSubmissions.value = filtered;
        }
      }
    } catch {
      // intentionally silent (no console output in browser)
    } finally {
      profileLoading.value = false;
    }
  };

  const taskColors = computed(() => {
    const palette = [
      { bg: "bg-blue-100", dot: "bg-blue-400" },
      { bg: "bg-emerald-100", dot: "bg-emerald-400" },
      { bg: "bg-amber-100", dot: "bg-amber-400" },
      { bg: "bg-purple-100", dot: "bg-purple-400" },
      { bg: "bg-pink-100", dot: "bg-pink-400" },
    ];
    const map: any = {};
    eventTasks.value.forEach(
      (t, i) => (map[t.id] = palette[i % palette.length]),
    );
    return map;
  });

  // ─── Export Tracking Sheet (Pivot Style like Google Sheets) ───────────────
  const exportingTracking = ref(false);

  const exportTrackingSheet = async (
    targetYear?: number,
    targetMonth?: number,
  ) => {
    exportingTracking.value = true;
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      const thaiMonths = [
        "มกราคม",
        "กุมภาพันธ์",
        "มีนาคม",
        "เมษายน",
        "พฤษภาคม",
        "มิถุนายน",
        "กรกฎาคม",
        "สิงหาคม",
        "กันยายน",
        "ตุลาคม",
        "พฤศจิกายน",
        "ธันวาคม",
      ];
      const title = eventInfo.value?.title || "กิจกรรม";
      const today = getYMD(new Date());

      // Build list of months to export
      const monthsToExport: Array<{ year: number; month: number }> = [];
      if (targetYear !== undefined && targetMonth !== undefined) {
        monthsToExport.push({ year: targetYear, month: targetMonth });
      } else {
        // All months from event start to end
        const rawStart =
          eventInfo.value?.is_continuous_event && eventInfo.value?.created_at
            ? eventInfo.value.created_at
            : eventInfo.value?.start_date ||
              eventInfo.value?.created_at ||
              new Date().toISOString();
        const rawEnd = eventInfo.value?.end_date || new Date().toISOString();
        let cur = new Date(rawStart.substring(0, 7) + "-01");
        const end = new Date(rawEnd.substring(0, 7) + "-01");
        while (cur <= end) {
          monthsToExport.push({
            year: cur.getFullYear(),
            month: cur.getMonth(),
          });
          cur.setMonth(cur.getMonth() + 1);
        }
      }

      for (const { year, month } of monthsToExport) {
        // Build date+task columns for this month
        const cols = getMonthColumns(year, month);
        if (cols.length === 0) continue;

        const monthLabel = `เดือน${thaiMonths[month]} ${year + 543}`;
        const sheetName = `${thaiMonths[month]} ${year + 543}`.substring(0, 31);

        const fixedHeaders = [
          "ลำดับ",
          "รหัสประจำตัว",
          "ชื่อ-นามสกุล",
          "ชื่อทีม",
        ];

        // Group columns by date for merged header
        const dateGroups: Record<string, typeof cols> = {};
        cols.forEach((c) => {
          const d = c.dStr;
          if (!dateGroups[d]) dateGroups[d] = [];
          dateGroups[d].push(c);
        });
        const sortedDates = Object.keys(dateGroups).sort();

        // Header row 3 — dates merged across tasks
        const dateHeaderRow: any[] = [...fixedHeaders.map(() => "")];
        sortedDates.forEach((dStr) => {
          const d = new Date(dStr);
          const dateLabel = `วันที่ ${d.getDate()} ${thaiMonths[d.getMonth()]}`;
          dateHeaderRow.push(dateLabel);
          for (let i = 1; i < dateGroups[dStr].length; i++)
            dateHeaderRow.push("");
        });

        // Header row 4 — task names under each date
        const taskHeaderRow: any[] = [...fixedHeaders];
        sortedDates.forEach((dStr) => {
          dateGroups[dStr].forEach((c) => {
            taskHeaderRow.push(
              c.task.note || c.task.title || c.task.type || "ภารกิจ",
            );
          });
        });

        // Data rows
        const dataRows: any[][] = [];
        filteredRegistrants.value.forEach((r, idx) => {
          const userSubs = submissions.value.filter(
            (s) => s.user_id === r.user_id && s.status !== "rejected",
          );
          const row: any[] = [
            idx + 1,
            r.id_code || r.user_id,
            `${r.fname_th || ""} ${r.lname_th || ""}`.trim() ||
              r.nickname ||
              "-",
            getTeamName(r.team_id),
          ];
          sortedDates.forEach((dStr) => {
            if (dStr > today) {
              dateGroups[dStr].forEach(() => row.push("-"));
              return;
            }
            dateGroups[dStr].forEach((c) => {
              const done = userSubs.some(
                (s) =>
                  s.task_id === c.task.id &&
                  getYMD(new Date(s.created_at)) === dStr,
              );
              row.push(done ? "TRUE" : "FALSE");
            });
          });
          dataRows.push(row);
        });

        // Assemble worksheet data
        const wsData: any[][] = [
          [`ตารางเก็บสะสมแต้มกิจกรรม ${title}`],
          [monthLabel],
          dateHeaderRow,
          taskHeaderRow,
          ...dataRows,
        ];

        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // Column widths
        const colWidths = [
          { wch: 8 }, // ลำดับ
          { wch: 14 }, // รหัส
          { wch: 28 }, // ชื่อ
          { wch: 18 }, // ทีม
          ...cols.map(() => ({ wch: 12 })),
        ];
        ws["!cols"] = colWidths;

        // Merge title cell across all columns
        const totalCols = fixedHeaders.length + cols.length;
        ws["!merges"] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } },
          { s: { r: 1, c: 0 }, e: { r: 1, c: totalCols - 1 } },
          // Merge date headers across their tasks
          ...(() => {
            const merges: any[] = [];
            let colIdx = fixedHeaders.length;
            sortedDates.forEach((dStr) => {
              const span = dateGroups[dStr].length;
              if (span > 1) {
                merges.push({
                  s: { r: 2, c: colIdx },
                  e: { r: 2, c: colIdx + span - 1 },
                });
              }
              colIdx += span;
            });
            return merges;
          })(),
        ];

        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      }

      const fileName = `tracking_${title}_${today}.xlsx`;
      XLSX.writeFile(wb, fileName);
      showSuccess(`Export สำเร็จ ${monthsToExport.length} เดือน`);
    } catch {
      showError("Export ไม่สำเร็จ");
    } finally {
      exportingTracking.value = false;
    }
  };

  const isExportingExcel = ref(false);

  const exportMonthlyExcel = async () => {
    if (isExportingExcel.value) return;
    isExportingExcel.value = true;
    try {
      const res = await fetch(
        `/api/export/activities/${activityId}/monthly-report`,
        {
          headers: { "x-user-id": String(authStore.user?.id) },
        },
      );

      if (!res.ok) {
        throw new Error("Failed to generate export");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `report_${eventInfo.value?.title || "activity"}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showSuccess("ดาวน์โหลดไฟล์ Excel เรียบร้อยแล้ว");
    } catch {
      showError("ไม่สามารถดาวน์โหลดไฟล์ Excel ได้");
    } finally {
      isExportingExcel.value = false;
    }
  };

  const advancedStats = computed(() => {
    const users = registrants.value || [];
    const subs = submissions.value || [];
    const totalUsers = users.length || 1;

    // 1. Gender percentages
    const genderStatsArr = Object.entries(genderStats.value).map(
      ([label, count]) => ({
        label,
        count,
        percentage: ((Number(count) / totalUsers) * 100).toFixed(1),
      }),
    );

    // 2. User Types Details + Year Level + Institution
    const userTypesObj: Record<string, number> = {};
    const userRolesObj: Record<string, number> = {};
    const userYearsObj: Record<string, number> = {};
    const mainGoalsObj: Record<string, number> = {};
    users.forEach((u) => {
      const type = u.role_type || u.role || "ไม่ระบุ";
      userTypesObj[type] = (userTypesObj[type] || 0) + 1;
      if (u.role_detail_1) {
        userRolesObj[u.role_detail_1] =
          (userRolesObj[u.role_detail_1] || 0) + 1;
      }
      if (u.role_detail_2) {
        userYearsObj[u.role_detail_2] =
          (userYearsObj[u.role_detail_2] || 0) + 1;
      }
      if (u.main_goal) {
        mainGoalsObj[u.main_goal] = (mainGoalsObj[u.main_goal] || 0) + 1;
      }
    });

    // 3. Goal Completion
    let totalWithGoals = 0;
    let reachedGoals = 0;
    users.forEach((u) => {
      if (u.goal_target && Number(u.goal_target) > 0) {
        totalWithGoals++;
        if (u.goal_reached) reachedGoals++;
      }
    });
    const goalCompletionRate =
      totalWithGoals > 0
        ? ((reachedGoals / totalWithGoals) * 100).toFixed(1)
        : "0";

    // 4. Submission Timing (Hours)
    const subTimes: Record<string, number> = {
      "เช้าตรู่ (00-06)": 0,
      "เช้า (06-12)": 0,
      "บ่าย (12-17)": 0,
      "เย็น (17-21)": 0,
      "ดึก (21-24)": 0,
    };
    subs.forEach((s) => {
      const t = s.created_at || s.submitted_at;
      if (!t) return;
      const h = new Date(t).getHours();
      if (h >= 0 && h < 6) subTimes["เช้าตรู่ (00-06)"]++;
      else if (h >= 6 && h < 12) subTimes["เช้า (06-12)"]++;
      else if (h >= 12 && h < 17) subTimes["บ่าย (12-17)"]++;
      else if (h >= 17 && h < 21) subTimes["เย็น (17-21)"]++;
      else subTimes["ดึก (21-24)"]++;
    });

    // 5. Missed vs On-Time
    let totalExpected = 0;
    let totalCompleted = 0;
    let totalMissed = 0;
    userTrackingSheet.value.forEach((ut) => {
      totalCompleted += ut.completed || 0;
      totalMissed += ut.missedCount || 0;
    });
    totalExpected = totalCompleted + totalMissed;
    const onTimePercentage =
      totalExpected > 0
        ? ((totalCompleted / totalExpected) * 100).toFixed(1)
        : "0";

    // 6. Active Participants
    let activeParticipants = 0;
    users.forEach((u) => {
      if (u.submission_count > 0) activeParticipants++;
    });
    const activePercentage = ((activeParticipants / totalUsers) * 100).toFixed(
      1,
    );

    // 7. Rankings (Max, Min, Avg, Top3)
    const rankingList = currentRankingList.value || [];
    let maxScore = 0;
    let minScore = 0;
    let avgScore = 0;
    let top3: any[] = [];
    if (rankingList.length > 0) {
      const scores = rankingList
        .map((r) =>
          Number(r.total_points || r.total_unit_value || r.score || 0),
        )
        .filter((s) => s > 0);
      if (scores.length > 0) {
        maxScore = Math.max(...scores);
        minScore = Math.min(...scores);
        avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      }
      top3 = rankingList.slice(0, 3);
    }

    // 8. Tanita Changes
    const tanitaChangesArr = tanitaChanges.value || [];
    let tanitaImproved = 0;
    let tanitaWarning = 0;
    const tanitaGender: Record<string, { improved: number; warning: number; stable: number }> =
      {};
    tanitaChangesArr.forEach((t) => {
      const g =
        t.gender === "male" || t.gender === "ชาย"
          ? "ชาย"
          : t.gender === "female" || t.gender === "หญิง"
            ? "หญิง"
            : "ไม่ระบุ";
      if (!tanitaGender[g]) tanitaGender[g] = { improved: 0, warning: 0, stable: 0 };

      const wDiff =
        Number(t.latest_tanita?.weight || 0) -
        Number(t.first_tanita?.weight || 0);
      if (wDiff < 0) {
        tanitaImproved++;
        tanitaGender[g].improved++;
      } else if (wDiff > 0) {
        tanitaWarning++;
        tanitaGender[g].warning++;
      } else {
        tanitaGender[g].stable++;
      }
    });
    const tanitaImprovedPercentage =
      tanitaChangesArr.length > 0
        ? ((tanitaImproved / tanitaChangesArr.length) * 100).toFixed(1)
        : "0";

    // 9. Assessment Scores
    const assessmentArr = assessmentComparison.value || [];
    const postScores = assessmentArr
      .filter((a) => a.post_score != null)
      .map((a) => Number(a.post_score));
    let assessmentMax = 0;
    let assessmentMin = 0;
    let assessmentAvg = 0;
    if (postScores.length > 0) {
      assessmentMax = Math.max(...postScores);
      assessmentMin = Math.min(...postScores);
      assessmentAvg = postScores.reduce((a, b) => a + b, 0) / postScores.length;
    }

    return {
      genderStats: genderStatsArr,
      userTypes: userTypesObj,
      userRoles: userRolesObj,
      userYears: userYearsObj,
      mainGoals: mainGoalsObj,
      goals: {
        total: totalWithGoals,
        reached: reachedGoals,
        completionRate: goalCompletionRate,
      },
      submissionTimes: subTimes,
      bmiStats: [0, 0, 0, 0, 0],
      compliance: {
        onTime: totalCompleted,
        missed: totalMissed,
        onTimePercentage,
      },
      activeParticipants: {
        count: activeParticipants,
        percentage: activePercentage,
      },
      rankings: {
        max: maxScore,
        min: minScore,
        avg: avgScore.toFixed(1),
        top3,
      },
      tanita: {
        total: tanitaChangesArr.length,
        improved: tanitaImproved,
        warning: tanitaWarning,
        improvedPercentage: tanitaImprovedPercentage,
        byGender: tanitaGender,
      },
      assessment: {
        total: postScores.length,
        max: assessmentMax,
        min: assessmentMin,
        avg: assessmentAvg.toFixed(1),
      },
    };
  });

  onMounted(() => {
    fetchStats();
    fetchComparisonData();
    fetchRankings();
  });

  return {
    loading,
    registrants,
    teams,
    eventInfo,
    eventTasks,
    submissions,
    selectedUserIds,
    selectedSubmissionIds,
    isAssigningTeam,
    selectedTeamToAssign,
    activeTab,
    updatingId,
    searchQuery,
    selectedTaskIds,
    participantCols,
    submissionCols,
    rankingCols,
    viewOption,
    filteredRegistrants,
    filteredSubmissions,
    rankingsIndividual,
    rankingsTeam,
    rankingsTab,
    rankingsLoading,
    currentRankingList,
    filteredRankings,
    rankingTableData,
    fetchStats,
    fetchRankings,
    updateSubStatus,
    bulkUpdateSubmissionStatus,
    deleteSubmission,
    bulkDeleteSubmissions,
    assignTeam,
    removeParticipants,
    toggleTaskFilter,
    totalParticipants,
    totalSubmissions,
    daysActive,
    registrationTimes,
    ageRanges,
    userTypes,
    genderStats,
    trackingDates,
    selectedYear,
    selectedMonth,
    yearOptions,
    monthOptions,
    goToMonth,
    goToToday,
    currentMonthColumns,
    currentMonthDates,
    visibleTasks,
    isTaskExpectedOnDate,
    userTrackingSheet,
    trackingMonthOptions,
    participationExpected,
    goalDisplay,
    userParticipationSheet,
    showMissedModal,
    selectedMissedUser,
    missedDetailsList,
    openMissedModal,
    showUserProfileModal,
    selectedUserProfile,
    selectedUserSubmissions,
    selectedUserRegistrations,
    profileLoading,
    openUserProfile,
    taskColors,
    calculateAge,
    formatDate,
    getTeamName,
    rankingUnitLong,
    isPoints,
    formatDist,
    teamColors,
    getYMD,
    todayStr,
    todayMonthKey,
    thaiMonthLong,
    exportTrackingSheet,
    exportingTracking,
    exportMonthlyExcel,
    isExportingExcel,
    tanitaChanges,
    assessmentComparison,
    assessmentPartStats,
    filteredTanitaChanges,
    filteredAssessmentComparison,
    loadingComparison,
    fetchComparisonData,
    advancedStats,
    updateSubmissionValue,
  };
}

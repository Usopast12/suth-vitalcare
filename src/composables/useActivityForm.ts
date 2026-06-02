import { ref, watch, nextTick, type WatchStopHandle } from "vue";
import { authStore } from "../store/auth";
import { uiStore } from "../store/ui";
import { showSuccess, showError, showConfirm } from "../lib/swal";
import moment from "moment";
import Cropper from "cropperjs";
import "cropperjs/dist/cropper.css";
import { useRoute, useRouter } from "vue-router";
export interface Section {
  title: string;
  content: string;
  image?: string;
  type?: string;
}
export interface Task {
  id?: number | null;
  title: string;
  note: string;
  type: string;
  metric_type: string;
  metric_unit: string;
  points?: number;
  submission_type: string;
  is_active?: boolean;
  allowed_days: number[];
  use_ocr?: boolean;
}
export interface GoalConfig {
  enabled: boolean;
  mode: "solo" | "team";
  team_size: number;
  target_type: string;
  target_value: number;
  reward_text: string;
}
export interface CertificateConfig {
  enabled: boolean;
  issue_mode: "immediately" | "event_end" | "goal_complete";
  template_id?: number;
}
export function useActivityForm(fetchActivitiesCallback: () => Promise<void>) {
  const route = useRoute();
  const router = useRouter();
  const ACTIVITY_DRAFT_KEY = "activity_create_draft";
  let isRestoringDraft = false;
  const editingId = ref<number | null>(null);
  const uploading = ref(false);
  const submitting = ref(false);
  const activeTaskIdx = ref(0);
  const showAdvanced = ref(false);
  const allMasterData = ref<any[]>([]);
  const taskTypeOptions = ref<any[]>([]);
  const metricOptions = ref<any[]>([]);
  const unitOptions = ref<Record<string, string[]>>({});
  const roles = ref<{ id: string; name: string; category: string }[]>([]);
  const submissionOptions = ref([
    { value: "photo", label: "📷 ส่งรูปภาพ (Photo)" },
    { value: "text", label: "✍️ พิมพ์ข้อความ (Text)" },
    { value: "both", label: "📷✍️ รูปภาพ + ข้อความ (Both)" },
    { value: "manual", label: "🔢 กรอกตัวเลข (Manual)" },
  ]);
  const initialForm = (existingDates?: any[]) => ({
    title: "",
    poster: "",
    start_date: "",
    end_date: "",
    registration_start_date: "",
    registration_end_date: "",
    is_continuous_registration: true,
    is_continuous_event: true,
    start_time: "08:00",
    end_time: "17:00",
    max_slots: 100,
    is_unlimited_max_slots: true,
    sections: [] as Section[],
    location_name: "",
    organizer: "",
    event_code: "",
    event_password: "",
    visibility: ["general"] as string[],
    visibility_type: "now",
    publish_start_date: "",
    publish_end_date: "",
    goal_config: {
      enabled: false,
      mode: "solo",
      team_size: 3,
      target_type: "points",
      target_value: 1000,
      reward_text: "",
    } as GoalConfig,
    certificate_config: {
      enabled: false,
      issue_mode: "immediately",
    } as CertificateConfig,
    tanita_dates: (existingDates || []) as { label: string; date: string }[],
    tasks: [
      {
        title: "ภารกิจใหม่",
        note: "ภารกิจใหม่",
        type: "exercise",
        metric_type: "distance",
        metric_unit: "km",
        points: 10,
        submission_type: "photo",
        is_active: true,
        allowed_days: [0, 1, 2, 3, 4, 5, 6],
        use_ocr: false,
      },
    ] as Task[],
    is_active: true,
    auto_join_team: false,
    assessment_config: {
      pre_test: {
        enabled: false,
        title: "แบบทดสอบก่อนเข้าร่วม (Pre-test)",
        questions: [] as any[],
      },
      post_test: {
        enabled: false,
        title: "แบบทดสอบหลังเข้าร่วม (Post-test)",
        questions: [] as any[],
      },
    },
    sort_order: 0,
    team_id: route.query.teamId ? Number(route.query.teamId) : null,
    scope: (route.query.teamId ? "team" : "global") as "global" | "team",
    is_restricted: false,
  });
  const form = ref(initialForm());
  // Master Data logic
  const fetchMasterData = async () => {
    try {
      const uniYears = ["ปี 1", "ปี 2", "ปี 3", "ปี 4", "ปี 5", "ปี 6"];
      const uniFaculties = [
        "สำนักวิชาวิทยาศาสตร์",
        "สำนักวิชาเทคโนโลยีสังคม",
        "สำนักวิชาเทคโนโลยีการเกษตร",
        "สำนักวิชาวิศวกรรมศาสตร์",
        "สำนักวิชาแพทยศาสตร์",
        "สำนักวิชาพยาบาลศาสตร์",
        "สำนักวิชาทันตแพทยศาสตร์",
        "สำนักวิชาสาธารณสุขศาสตร์",
        "สำนักวิชาศาสตร์และศิลป์ดิจิทัล",
        "อื่น ๆ",
      ];
      const staticRoles = [
        { id: "general", name: "ทุกคนในโครงการ (Public)", category: "พื้นฐาน" },
        { id: "นักเรียน", name: "นักเรียน", category: "บทบาทหลัก" },
        { id: "นักศึกษา", name: "นักศึกษา", category: "บทบาทหลัก" },
        {
          id: "บุคลากรโรงพยาบาล",
          name: "บุคลากรโรงพยาบาล",
          category: "บทบาทหลัก",
        },
        {
          id: "บุคลากรมหาวิทยาลัย",
          name: "บุคลากรมหาวิทยาลัย",
          category: "บทบาทหลัก",
        },
        { id: "บุคคลทั่วไป", name: "บุคคลทั่วไป", category: "บทบาทหลัก" },
        {
          id: "ป.1 - ป.6",
          name: "ประถมศึกษา (ป.1 - ป.6)",
          category: "ระบุระดับชั้น",
        },
        {
          id: "ม.1 - ม.6",
          name: "มัธยมศึกษา (ม.1 - ม.6)",
          category: "ระบุระดับชั้น",
        },
        ...uniYears.map((yr) => ({ id: yr, name: yr, category: "ระบุชั้นปี" })),
        ...uniFaculties.map((fac) => ({
          id: fac,
          name: fac,
          category: "ระบุสำนักวิชา",
        })),
      ];
      const res = await fetch("/api/master", {
        headers: { "x-user-id": String(authStore.user?.id) },
      });
      if (res.ok) {
        const data = await res.json();
        allMasterData.value = data;
        taskTypeOptions.value = data
          .filter((c: any) => c.category === "task_type")
          .map((c: any) => ({ value: c.key_name, label: c.display_label }));
        metricOptions.value = data
          .filter((c: any) => c.category === "metric")
          .map((c: any) => ({ value: c.key_name, label: c.display_label }));
        const units: Record<string, string[]> = {};
        data
          .filter((c: any) => c.category === "metric")
          .forEach((c: any) => {
            units[c.key_name] = c.metadata?.links || [];
          });
        unitOptions.value = units;
        const roleOptions = data
          .filter((c: any) => c.category === "role")
          .map((c: any) => ({
            id: c.key_name,
            name: c.display_label,
            category: "บทบาทหลัก",
          }));
        roles.value = [...staticRoles, ...roleOptions];
      } else {
        roles.value = staticRoles;
      }
    } catch (e) {}
  };
  const getFilteredMetrics = (taskTypeKey: string) => {
    const taskTypeItem = allMasterData.value.find(
      (c) => c.category === "task_type" && c.key_name === taskTypeKey,
    );
    const linkedIds = taskTypeItem?.metadata?.links || [];
    if (linkedIds.length === 0) return metricOptions.value;
    return metricOptions.value.filter((m) => {
      const fullItem = allMasterData.value.find(
        (c) => c.category === "metric" && c.key_name === m.value,
      );
      return linkedIds.includes(fullItem?.id) || linkedIds.includes(m.value);
    });
  };
  const getFilteredUnits = (metricKey: string) => {
    const metricItem = allMasterData.value.find(
      (c) => c.category === "metric" && c.key_name === metricKey,
    );
    const linkedIds = metricItem?.metadata?.links || [];
    const allUnitOptions = allMasterData.value
      .filter((c) => c.category === "unit")
      .map((c) => ({ value: c.key_name, label: c.display_label, id: c.id }));
    if (linkedIds.length === 0) return allUnitOptions;
    return allUnitOptions.filter(
      (u) => linkedIds.includes(u.id) || linkedIds.includes(u.value),
    );
  };
  const resetForm = async () => {
    // 🧹 Cleanup orphaned file if user uploaded a new image but then cancelled
    if (form.value.poster && form.value.poster !== originalPoster.value && form.value.poster.startsWith('/uploads/')) {
        try {
            await fetch(`/api/upload`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ oldUrl: form.value.poster }),
            });
            console.log("[cancel] Deleted intermediate activity poster:", form.value.poster);
        } catch (e) {
            console.error("Failed to delete intermediate activity poster:", e);
        }
    }
    
    // Also clean up any intermediate section images
    if (form.value.sections && Array.isArray(form.value.sections)) {
        for (const section of form.value.sections) {
            if (section.type === 'image' && section.image) {
                const isOriginal = originalSections.value.some((s: any) => s.type === 'image' && s.image === section.image);
                if (!isOriginal && section.image.startsWith('/uploads/')) {
                    try {
                        await fetch(`/api/upload`, {
                            method: "DELETE",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ oldUrl: section.image }),
                        });
                        console.log("[cancel] Deleted intermediate activity section image:", section.image);
                    } catch (e) {
                        console.error("Failed to delete intermediate activity section image:", e);
                    }
                }
            }
        }
    }

    editingId.value = null;
    form.value = initialForm();
    activeTaskIdx.value = 0;
    showAdvanced.value = false;
    originalPoster.value = "";
    originalSections.value = [];
  };
  const restoreDraft = () => {
    const draft = localStorage.getItem(ACTIVITY_DRAFT_KEY);
    if (draft && !editingId.value) {
      try {
        isRestoringDraft = true;
        const parsed = JSON.parse(draft);
        form.value = { ...initialForm(), ...parsed };
      } catch (e) {
      } finally {
        setTimeout(() => {
          isRestoringDraft = false;
        }, 100);
      }
    }
  };
  const saveActivity = async () => {
    if (submitting.value) return false;
    if (!editingId.value && authStore.user?.role !== "admin") {
      showError("คุณไม่มีสิทธิ์ในการสร้างกิจกรรม (เฉพาะ Admin เท่านั้น)");
      return false;
    }
    if (
      !form.value.is_unlimited_max_slots &&
      (!form.value.max_slots || form.value.max_slots <= 0)
    ) {
      showError("กรุณาระบุจำนวนผู้เข้าร่วมอย่างน้อย 1 คน");
      return false;
    }
    // Validate Task Points
    for (let i = 0; i < form.value.tasks.length; i++) {
      const task = form.value.tasks[i];
      if (!task.points || task.points <= 0) {
        showError(`ภารกิจที่ ${i + 1} ต้องกำหนดแต้มอย่างน้อย 1 แต้ม`);
        return false;
      }
    }
    // Validate Dates
    if (
      !form.value.is_continuous_registration &&
      form.value.registration_start_date &&
      form.value.registration_end_date
    ) {
      if (
        moment(form.value.registration_end_date).isBefore(
          moment(form.value.registration_start_date),
        )
      ) {
        showError("วันปิดรับสมัครไม่สามารถอยู่ก่อนวันเปิดรับสมัครได้");
        return false;
      }
    }
    if (
      !form.value.is_continuous_event &&
      form.value.start_date &&
      form.value.end_date
    ) {
      if (moment(form.value.end_date).isBefore(moment(form.value.start_date))) {
        showError("วันสิ้นสุดกิจกรรมไม่สามารถอยู่ก่อนวันเริ่มกิจกรรมได้");
        return false;
      }
    }
    submitting.value = true;
    try {
      const url = editingId.value
        ? `/api/activities/${editingId.value}`
        : "/api/activities";
      const method = editingId.value ? "PATCH" : "POST";
      let status = "open";
      if (form.value.visibility_type === "draft") status = "draft";
      else if (form.value.visibility_type === "scheduled") status = "published";
      const eventData = {
        title: form.value.title,
        poster: form.value.poster,
        start_date: form.value.is_continuous_event
          ? null
          : form.value.start_date || null,
        end_date: form.value.is_continuous_event
          ? null
          : form.value.end_date || null,
        publish_start_date:
          form.value.visibility_type === "scheduled"
            ? form.value.publish_start_date || null
            : null,
        registration_start_date: form.value.is_continuous_registration
          ? null
          : form.value.registration_start_date || null,
        registration_end_date: form.value.is_continuous_registration
          ? null
          : form.value.registration_end_date || null,
        is_continuous_registration: form.value.is_continuous_registration,
        is_continuous_event: form.value.is_continuous_event,
        start_time: form.value.start_time || null,
        end_time: form.value.end_time || null,
        max_slots: form.value.is_unlimited_max_slots
          ? 0
          : form.value.max_slots || 0,
        is_unlimited_max_slots: form.value.is_unlimited_max_slots,
        detail: JSON.stringify(form.value.sections),
        activity_mode: "event",
        tasks: form.value.tasks,
        location_name: form.value.location_name,
        organizer: form.value.organizer,
        event_code: form.value.event_code,
        event_password: form.value.is_restricted
          ? form.value.event_password || null
          : null,
        visibility: JSON.stringify(
          !form.value.is_restricted || form.value.visibility.length === 0
            ? ["general"]
            : form.value.visibility.filter((v) => v !== "general"),
        ),
        health_config: { tanita_dates: [...form.value.tanita_dates] },
        goal_config: JSON.stringify(form.value.goal_config),
        certificate_config: JSON.stringify(form.value.certificate_config),
        assessment_config: JSON.stringify(form.value.assessment_config),
        team_id: form.value.team_id,
        auto_join_team: false,
        status: status,
      };
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(authStore.user?.id),
        },
        body: JSON.stringify({ ...eventData, userId: authStore.user?.id }),
      });
      if (response.ok) {
        await fetchActivitiesCallback();
        if (method === "POST") {
          const userRes = await fetch(`/api/users/${authStore.user?.id}`, {
            headers: { "x-user-id": String(authStore.user?.id) },
          });
          if (userRes.ok) authStore.setUser(await userRes.json());
        }
        showSuccess(
          editingId.value ? "อัปเดตกิจกรรมสำเร็จ!" : "สร้างกิจกรรมสำเร็จ!",
        );
        uiStore.triggerRealtimeUpdate(); // ✅ Trigger global realtime sync
        localStorage.removeItem(ACTIVITY_DRAFT_KEY);
        // ✅ Prevent resetForm from deleting the newly uploaded files we just saved
        originalPoster.value = form.value.poster;
        originalSections.value = form.value.sections ? form.value.sections.map(s => s.image).filter(Boolean) : [];
        resetForm();
        router.replace({
          query: { ...route.query, sub: undefined, id: undefined },
        });
        activeTab.value = "list";
        return true;
      } else {
        const err = await response.json();
        showError(err.error || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
      }
    } catch (e) {
      showError("เกิดข้อผิดพลาดขณะบันทึกกิจกรรม");
    } finally {
      submitting.value = false;
    }
    return false;
  };
  const addSection = () => form.value.sections.push({ title: "", content: "" });
  const removeSection = (index: number) => form.value.sections.splice(index, 1);
  const addTask = (template?: "exercise" | "food" | "mood" | "photo") => {
    let newTask: Task = {
      title: "ภารกิจใหม่",
      note: "",
      type: "exercise",
      metric_type: "distance",
      metric_unit: "km",
      points: 10,
      submission_type: "manual",
      is_active: true,
      allowed_days: [0, 1, 2, 3, 4, 5, 6],
      use_ocr: false,
    };
    if (template === "exercise") {
      newTask = {
        ...newTask,
        title: "ออกกำลังกาย",
        note: "ออกกำลังกาย",
        type: "exercise",
        metric_type: "distance",
        metric_unit: "km",
        submission_type: "photo",
        use_ocr: true,
      };
    } else if (template === "food") {
      newTask = {
        ...newTask,
        title: "อาหาร",
        note: "อาหาร",
        type: "food",
        metric_type: "nutrition",
        metric_unit: "meal",
        submission_type: "photo",
        use_ocr: false,
      };
    } else if (template === "mood") {
      newTask = {
        ...newTask,
        title: "อารมณ์/สมาธิ",
        note: "อารมณ์/สมาธิ",
        type: "mood",
        metric_type: "mood_level",
        metric_unit: "level",
        submission_type: "manual",
        use_ocr: false,
      };
    } else if (template === "photo") {
      newTask = {
        ...newTask,
        title: "ส่งรูปภาพ",
        note: "ส่งรูปภาพ",
        type: "general",
        metric_type: "count",
        metric_unit: "times",
        submission_type: "photo",
        use_ocr: false,
      };
    }
    form.value.tasks.push(newTask);
    activeTaskIdx.value = form.value.tasks.length - 1;
  };
  const removeTask = async (origIdx: number) => {
    const task = form.value.tasks[origIdx];
    if (task.id) {
      const confirmed = await showConfirm(
        "ยืนยันการลบภารกิจ?",
        "การลบภารกิจที่มีอยู่แล้วจะทำให้ประวัติการส่งงานทั้งหมดของภารกิจนี้ถูกลบไปด้วย คุณแน่ใจหรือไม่?",
        "ลบภารกิจนี้",
        "warning",
      );
      if (!confirmed) return;
    }
    form.value.tasks.splice(origIdx, 1);
    activeTaskIdx.value = Math.max(
      0,
      Math.min(activeTaskIdx.value, form.value.tasks.length - 1),
    );
  };
  const handleTypeChange = (task: Task) => {
    const availableMetrics = getFilteredMetrics(task.type);
    if (availableMetrics.length > 0) {
      task.metric_type = availableMetrics[0].value;
      handleMetricChange(task);
    }
  };
  const handleMetricChange = (task: Task) => {
    const availableUnits = getFilteredUnits(task.metric_type);
    if (availableUnits.length > 0) task.metric_unit = availableUnits[0].value;
  };
  const isDayValidForEvent = (day: number) => {
    if (!form.value.start_date || !form.value.end_date) return { valid: true };
    const start = moment(form.value.start_date).startOf("day");
    const end = moment(form.value.end_date).endOf("day");
    if (end.diff(start, "days") >= 6) return { valid: true };
    const validDays = new Set<number>();
    let current = moment(start);
    while (current.isSameOrBefore(end)) {
      validDays.add(current.day());
      current.add(1, "day");
    }
    if (validDays.has(day)) return { valid: true };
    const daysMap = [
      "อาทิตย์",
      "จันทร์",
      "อังคาร",
      "พุธ",
      "พฤหัสบดี",
      "ศุกร์",
      "เสาร์",
    ];
    return {
      valid: false,
      reason: `ขออภัย วัน${daysMap[day]} ไม่อยู่ในช่วงวันที่จัดกิจกรรม (${start.format("DD/MM/YYYY")} - ${end.format("DD/MM/YYYY")})`,
    };
  };
  const toggleDay = (task: Task, day: number) => {
    const check = isDayValidForEvent(day);
    if (!check.valid) {
      showError(check.reason);
      return;
    }
    if (typeof task.allowed_days === "string") {
      try {
        task.allowed_days = JSON.parse(task.allowed_days);
      } catch {
        task.allowed_days = [0, 1, 2, 3, 4, 5, 6];
      }
    }
    if (!Array.isArray(task.allowed_days))
      task.allowed_days = [0, 1, 2, 3, 4, 5, 6];
    const idx = task.allowed_days.indexOf(day);
    if (idx > -1) task.allowed_days.splice(idx, 1);
    else {
      task.allowed_days.push(day);
      task.allowed_days.sort();
    }
  };
  const setDayPreset = (task: Task, type: "all" | "weekday" | "weekend") => {
    let days: number[] = [];
    if (type === "all") days = [0, 1, 2, 3, 4, 5, 6];
    else if (type === "weekday") days = [1, 2, 3, 4, 5];
    else if (type === "weekend") days = [0, 6];
    const validSet: number[] = [];
    const invalidNames: string[] = [];
    const daysMap = [
      "อาทิตย์",
      "จันทร์",
      "อังคาร",
      "พุธ",
      "พฤหัสบดี",
      "ศุกร์",
      "เสาร์",
    ];
    for (const d of days) {
      const check = isDayValidForEvent(d);
      if (check.valid) validSet.push(d);
      else invalidNames.push(daysMap[d]);
    }
    if (invalidNames.length > 0)
      showError(
        `ไม่สามารถเลือกวัน: ${invalidNames.join(", ")} ได้ เนื่องจากอยู่นอกระยะเวลาจัดกิจกรรม`,
      );
    if (validSet.length > 0) task.allowed_days = validSet;
  };
  const activeTab = ref("list");
  // --- Sync State from URL (Back/Forward support) ---
  watch(
    () => [route.query.sub, route.query.id],
    ([newSub, newId]) => {
      const sub = String(newSub || "list");
      if (activeTab.value !== sub) {
        activeTab.value = sub as any;
      }
      if (newId) {
        editingId.value = Number(newId);
      } else if (sub === "list") {
        resetForm();
      }
    },
    { immediate: true },
  );
  const handleBack = () => {
    if (window.history.length > 1 && route.query.sub) {
      router.back();
    } else {
      router.replace({
        query: { ...route.query, sub: undefined, id: undefined },
      });
      activeTab.value = "list";
    }
  };
  const showCertEditor = ref(false);
  const certEditorEventId = ref<number | null>(null);
  const hasCertTemplate = ref(false);
  const certLastUpdated = ref("");
  const isDragging = ref(false);
  const draggingSectionIdx = ref<number | null>(null);
  const showCropper = ref(false);
  const cropperTarget = ref<"poster" | number>("poster");
  const cropperRawFile = ref<File | null>(null);
  const cropperImgUrl = ref("");
  const cropperEl = ref<HTMLImageElement | null>(null);
  const cropRatio = ref(16 / 9);
  let cropperInstance: any = null; // Using any for Cropper instance
  const originalPoster = ref("");
  const originalSections = ref<string[]>([]);
  const clockField = ref<"start" | "end" | null>(null);
  const clockMode = ref<"hour" | "min">("hour");
  const sectionDraggingIdx = ref<number | null>(null);
  const sectionDragOverIdx = ref<number | null>(null);
  const taskDraggingOrigIdx = ref<number | null>(null);
  const taskDragOverOrigIdx = ref<number | null>(null);
  // Computed
  const getTimeHour = (t: string) => parseInt(t?.split(":")?.[0] ?? "8", 10);
  const getTimeMin = (t: string) => parseInt(t?.split(":")?.[1] ?? "0", 10);
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const currentHour = ref(8);
  const currentMin = ref(0);
  const isAm = ref(true);
  watch(
    [clockField, () => form.value.start_time, () => form.value.end_time],
    () => {
      const cur =
        clockField.value === "start"
          ? form.value.start_time
          : form.value.end_time;
      currentHour.value = getTimeHour(cur);
      currentMin.value = getTimeMin(cur);
      isAm.value = currentHour.value < 12;
    },
  );
  const displayedTasks = ref<any[]>([]);
  watch(
    () => form.value.tasks,
    (tasks) => {
      displayedTasks.value = tasks.map((task, i) => ({
        origIdx: i,
        displayNum: i + 1,
        task,
      }));
    },
    { deep: true, immediate: true },
  );
  const flatUnits = [
    { value: "km", label: "กิโลเมตร (km)" },
    { value: "m", label: "เมตร (m)" },
    { value: "steps", label: "ก้าว (steps)" },
    { value: "min", label: "นาที (min)" },
    { value: "hr", label: "ชั่วโมง (hr)" },
    { value: "cal", label: "แคลอรี่ (cal)" },
    { value: "meal", label: "มื้อ (meal)" },
    { value: "level", label: "ระดับ (level)" },
    { value: "times", label: "ครั้ง (times)" },
    { value: "kg", label: "กิโลกรัม (kg)" },
  ];
  const showSchoolLevels = ref(false);
  const showUniFilters = ref(false);
  const showFacultyFilters = ref(false);
  watch(
    () => form.value.visibility,
    (vis, oldVis) => {
      showSchoolLevels.value = vis.includes("นักเรียน");
      showUniFilters.value = vis.includes("นักศึกษา");
      showFacultyFilters.value =
        vis.includes("นักศึกษา") || vis.includes("บุคลากรมหาวิทยาลัย");
      // Cleanup logic: If a main category is removed, remove its sub-categories
      if (oldVis && vis.length < oldVis.length) {
        const removedItems = oldVis.filter((id) => !vis.includes(id));
        let newVis = [...vis];
        let changed = false;
        if (removedItems.includes("นักเรียน")) {
          const schoolLevelIds = roles.value
            .filter((r) => r.category === "ระบุระดับชั้น")
            .map((r) => r.id);
          newVis = newVis.filter((id) => !schoolLevelIds.includes(id));
          changed = true;
        }
        if (removedItems.includes("นักศึกษา")) {
          const uniYearIds = roles.value
            .filter((r) => r.category === "ระบุชั้นปี")
            .map((r) => r.id);
          newVis = newVis.filter((id) => !uniYearIds.includes(id));
          changed = true;
        }
        // Faculty is shared between Students and University Staff
        const isFacultyParentActive =
          vis.includes("นักศึกษา") || vis.includes("บุคลากรมหาวิทยาลัย");
        if (
          !isFacultyParentActive &&
          (removedItems.includes("นักศึกษา") ||
            removedItems.includes("บุคลากรมหาวิทยาลัย"))
        ) {
          const facultyIds = roles.value
            .filter((r) => r.category === "ระบุสำนักวิชา")
            .map((r) => r.id);
          newVis = newVis.filter((id) => !facultyIds.includes(id));
          changed = true;
        }
        if (changed && newVis.length !== vis.length) {
          form.value.visibility = newVis;
        }
      }
    },
    { deep: true, immediate: true },
  );
  const openCreate = (forcedTeamId?: number) => {
    if (authStore.user?.role !== "admin") {
      showError("คุณไม่มีสิทธิ์ในการสร้างกิจกรรม (เฉพาะ Admin เท่านั้น)");
      return;
    }
    resetForm();
    if (forcedTeamId) {
      form.value.team_id = forcedTeamId;
      form.value.scope = "team";
    }
    activeTab.value = "form";
    router.push({ query: { ...route.query, sub: "form" } });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const viewActivityDetails = (act: any) => {
    editingId.value = act.id;
    form.value.title = act.title;
    activeTab.value = "dashboard";
    router.push({ query: { ...route.query, sub: "dashboard", id: act.id } });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const editActivity = (act: any) => {
    editingId.value = act.id;
    router.push({ query: { ...route.query, sub: "form", id: act.id } });
    let parsedSections = [];
    let parsedTasks: any[] = [];
    try {
      parsedSections = JSON.parse(act.detail || "[]");
      if (!Array.isArray(parsedSections))
        parsedSections = [{ title: "รายละเอียด", content: act.detail || "" }];
    } catch {
      parsedSections = [{ title: "รายละเอียด", content: act.detail || "" }];
    }
    try {
      parsedTasks = Array.isArray(act.tasks)
        ? act.tasks
        : JSON.parse(act.tasks || "[]");
    } catch {
      parsedTasks = [];
    }
    let vType = "now";
    if (act.status === "draft") vType = "draft";
    else if (act.status === "published") vType = "scheduled";
    const safeParseJSON = (data: any, fallback: any) => {
      if (!data) return fallback;
      if (typeof data !== "string") return data;
      try {
        let p = JSON.parse(data);
        while (typeof p === "string") p = JSON.parse(p);
        return p || fallback;
      } catch {
        return fallback;
      }
    };
    const newFormState = {
      ...initialForm(),
      title: act.title,
      poster: act.poster || "",
      registration_start_date: act.registration_start_date || "",
      registration_end_date: act.registration_end_date || "",
      is_continuous_registration: !!act.is_continuous_registration,
      is_continuous_event: !!act.is_continuous_event,
      start_time: act.start_time || "08:00",
      end_time: act.end_time || "17:00",
      max_slots: act.max_slots,
      is_unlimited_max_slots: !!act.is_unlimited_max_slots,
      sections: parsedSections,
      tasks: parsedTasks.map((t: any) => {
        let ad = t.allowed_days;
        if (typeof ad === "string") {
          try {
            ad = JSON.parse(ad);
          } catch {
            ad = [0, 1, 2, 3, 4, 5, 6];
          }
        }
        if (!Array.isArray(ad)) ad = [0, 1, 2, 3, 4, 5, 6];
        return {
          ...t,
          title: t.note || t.title || "ภารกิจ",
          note: t.note || t.title || "ภารกิจ",
          type: t.type || "exercise",
          allowed_days: ad,
          use_ocr: t.use_ocr === 1 || t.use_ocr === true,
        };
      }),
      location_name: act.location_name || "",
      organizer: act.organizer || "",
      event_code: act.event_code || "",
      event_password: act.event_password || "",
      visibility: safeParseJSON(act.visibility, []),
      goal_config: safeParseJSON(act.goal_config, { enabled: false }),
      certificate_config: safeParseJSON(act.certificate_config, {
        enabled: false,
        issue_mode: "immediately",
      }),
      assessment_config: safeParseJSON(act.assessment_config, {
        pre_test: {
          enabled: false,
          title: "แบบทดสอบก่อนเข้าร่วม (Pre-test)",
          questions: [],
        },
        post_test: {
          enabled: false,
          title: "แบบทดสอบหลังเข้าร่วม (Post-test)",
          questions: [],
        },
      }),
      tanita_dates: [] as any[],
      visibility_type: vType,
      publish_start_date: act.publish_start_date || "",
      publish_end_date: "",
      start_date: act.start_date || "",
      end_date: act.end_date || "",
      is_active: act.is_active !== false,
      auto_join_team: act.auto_join_team !== false,
      team_id: act.team_id,
      scope: (act.team_id ? "team" : "global") as "team" | "global",
      sort_order: act.sort_order || 0,
      is_restricted: false,
    };
    const visibility = safeParseJSON(act.visibility, []);
    newFormState.visibility = visibility;
    newFormState.is_restricted =
      (visibility.length > 0 && !visibility.includes("general")) ||
      !!act.event_password;
    let hConfig = act.health_config;
    if (hConfig && typeof hConfig === "string") {
      try {
        hConfig = JSON.parse(hConfig);
      } catch {
        hConfig = null;
      }
    }
    newFormState.tanita_dates = Array.isArray(hConfig?.tanita_dates)
      ? [...hConfig.tanita_dates]
      : [];
    form.value = newFormState;
    originalPoster.value = act.poster || "";
    originalSections.value = parsedSections.map((s: any) => s.image).filter(Boolean);
    const specificRoleIds = roles.value
      .filter((r) => r.category !== "พื้นฐาน")
      .map((r) => r.id);
    showAdvanced.value =
      newFormState.visibility.some((v: string) =>
        specificRoleIds.includes(v),
      ) ||
      !!newFormState.event_code ||
      !!newFormState.event_password;
    activeTaskIdx.value = 0;
    activeTab.value = "form";
    if (act.id) checkCertTemplate(act.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };
  // Upload to local server storage (/api/upload) — returns a path URL e.g. /uploads/activity/name-date.png
  const uploadToLocal = async (
    file: File,
    type: "activity" | "section",
    oldUrl?: string,
  ): Promise<string> => {
    // Use the current activity title as the filename base, fallback to "กิจกรรม"
    const activityName = form.value.title?.trim() || "กิจกรรม";
    const label = type === "section" ? `${activityName}-section` : activityName;
    const formData = new FormData();
    formData.append("image", file);
    const params = new URLSearchParams({ type: "activity", name: label });
    if (oldUrl && oldUrl !== originalPoster.value && !originalSections.value.includes(oldUrl)) {
      params.append("oldUrl", oldUrl);
    }
    console.log("[upload:activity:start]", {
      type,
      label,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      endpoint: `/api/upload?${params}`,
      userId: authStore.user?.id,
    });
    const res = await fetch(`/api/upload?${params}`, {
      method: "POST",
      headers: { "x-user-id": String(authStore.user?.id) },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[upload:activity:failed]", {
        status: res.status,
        statusText: res.statusText,
        error: err,
      });
      throw new Error(err.error || `Upload failed (${res.status})`);
    }
    const data = await res.json();
    console.log("[upload:activity:success]", data);
    return data.url as string;
  };
  const uploadSectionFile = async (file: File, index: number) => {
    uploading.value = true;
    try {
      const oldUrl = form.value.sections[index]?.image;
      const url = await uploadToLocal(file, "section", oldUrl);
      form.value.sections[index].image = url;
    } catch (error: any) {
      console.error("[upload:activity-section:error]", error);
      uiStore.toast("error", "อัปโหลดรูปภาพล้มเหลว", error.message);
    } finally {
      uploading.value = false;
    }
  };
  const uploadFile = async (file: File) => {
    uploading.value = true;
    try {
      const oldUrl = form.value.poster;
      const url = await uploadToLocal(file, "activity", oldUrl);
      form.value.poster = url;
    } catch (error: any) {
      console.error("[upload:activity-poster:error]", error);
      uiStore.toast("error", "อัปโหลดรูปภาพล้มเหลว", error.message);
    } finally {
      uploading.value = false;
    }
  };
  const handlePosterUpload = (e: any) => {
    const file = e.target.files[0];
    if (file) openCropper(file, "poster");
  };
  const handleSectionImageUpload = (e: any, index: number) => {
    const file = e.target.files[0];
    if (file) openCropper(file, index);
  };
  const openCropper = (file: File, target: "poster" | number) => {
    cropperTarget.value = target;
    cropperRawFile.value = file;
    cropperImgUrl.value = URL.createObjectURL(file);
    showCropper.value = true;
    // Poster default = 1:1 (square), Section default = 16:9
    cropRatio.value = target === "poster" ? 1 : 16 / 9;
  };
  watch([cropperEl, cropperImgUrl, showCropper], async ([el, url, show]) => {
    if (show && el && url) {
      await nextTick();
      if (cropperInstance) cropperInstance.destroy();
      cropperInstance = new Cropper(el, {
        aspectRatio: cropRatio.value,
        viewMode: 1,
        dragMode: "move",
        autoCropArea: 0.9,
        background: false,
        responsive: true,
        restore: false,
      });
    }
  });
  const closeCropper = () => {
    showCropper.value = false;
    if (cropperImgUrl.value) URL.revokeObjectURL(cropperImgUrl.value);
    if (cropperInstance) {
      cropperInstance.destroy();
      cropperInstance = null;
    }
  };
  const confirmCrop = async () => {
    if (!cropperRawFile.value || !cropperInstance) return;
    // Cap output resolution: poster max 1080px, section max 1280px wide
    const isPoster = cropperTarget.value === "poster";
    const maxPx = isPoster ? 1080 : 1280;
    // getCroppedCanvas with size limit — avoids sending huge canvases
    const canvas = cropperInstance.getCroppedCanvas({
      maxWidth: maxPx,
      maxHeight: maxPx,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: "high",
    });
    if (!canvas) return;
    // PNG output for deployment compatibility
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const sizeMB = (blob.size / 1024 / 1024).toFixed(2);
      const file = new File(
        [blob],
        cropperRawFile.value!.name.replace(/\.[^/.]+$/, "") + ".png",
        { type: "image/png" },
      );
      if (cropperTarget.value === "poster") await uploadFile(file);
      else await uploadSectionFile(file, cropperTarget.value as number);
      closeCropper();
    }, "image/png");
  };
  const setCropRatio = (ratio: number) => {
    cropRatio.value = ratio;
    if (cropperInstance) cropperInstance.setAspectRatio(ratio);
  };
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    isDragging.value = true;
  };
  const handleDragLeave = () => {
    isDragging.value = false;
  };
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    isDragging.value = false;
    const file = e.dataTransfer?.files[0];
    if (file && file.type.startsWith("image/")) openCropper(file, "poster");
  };
  const handleSectionDragOver = (e: DragEvent, idx: number) => {
    e.preventDefault();
    draggingSectionIdx.value = idx;
  };
  const handleSectionDragLeave = () => {
    draggingSectionIdx.value = null;
  };
  const handleSectionDrop = (e: DragEvent, idx: number) => {
    e.preventDefault();
    draggingSectionIdx.value = null;
    const file = e.dataTransfer?.files[0];
    if (file && file.type.startsWith("image/")) openCropper(file, idx);
  };
  const openCertificateEditor = () => {
    if (!editingId.value) {
      showError(
        "ต้องบันทึกข้อมูลกิจกรรมเบื้องต้นก่อนจึงจะออกแบบเกียรติบัตรได้",
      );
      return;
    }
    certEditorEventId.value = editingId.value;
    showCertEditor.value = true;
  };
  const openCertEditorDirect = (id: number) => {
    certEditorEventId.value = id;
    showCertEditor.value = true;
  };
  const closeCertEditor = () => {
    showCertEditor.value = false;
    setTimeout(() => {
      certEditorEventId.value = null;
    }, 300);
  };
  const checkCertTemplate = async (id: number) => {
    try {
      const res = await fetch(`/api/certificates/templates/${id}`, {
        headers: { "x-user-id": String(authStore.user?.id) },
      });
      if (res.ok) {
        const data = await res.json();
        hasCertTemplate.value = true;
        certLastUpdated.value = data.updated_at || data.created_at || "";
      } else {
        hasCertTemplate.value = false;
        certLastUpdated.value = "";
      }
    } catch {
      hasCertTemplate.value = false;
      certLastUpdated.value = "";
    }
  };
  const onSectionDragStart = (idx: number) => {
    sectionDraggingIdx.value = idx;
  };
  const onSectionDragOver = (idx: number) => {
    if (sectionDraggingIdx.value !== null && sectionDraggingIdx.value !== idx)
      sectionDragOverIdx.value = idx;
  };
  const onSectionDragLeave = () => {
    sectionDragOverIdx.value = null;
  };
  const onSectionDrop = (toIdx: number) => {
    const fromIdx = sectionDraggingIdx.value;
    if (fromIdx !== null && fromIdx !== toIdx) {
      const arr = [...form.value.sections];
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      form.value.sections = arr;
    }
    sectionDraggingIdx.value = null;
    sectionDragOverIdx.value = null;
  };
  const onSectionDragEnd = () => {
    sectionDraggingIdx.value = null;
    sectionDragOverIdx.value = null;
  };
  const onTaskTabDragStart = (e: DragEvent, origIdx: number) => {
    taskDraggingOrigIdx.value = origIdx;
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
  };
  const onTaskTabDragOver = (e: DragEvent, origIdx: number) => {
    e.preventDefault();
    if (
      taskDraggingOrigIdx.value !== null &&
      taskDraggingOrigIdx.value !== origIdx
    )
      taskDragOverOrigIdx.value = origIdx;
  };
  const onTaskTabDragLeave = () => {
    taskDragOverOrigIdx.value = null;
  };
  const onTaskTabDrop = (origIdx: number) => {
    const fromOrig = taskDraggingOrigIdx.value;
    if (fromOrig !== null && fromOrig !== origIdx) {
      const arr = [...form.value.tasks];
      const [moved] = arr.splice(fromOrig, 1);
      arr.splice(origIdx, 0, moved);
      form.value.tasks = arr;
      if (activeTaskIdx.value === fromOrig) activeTaskIdx.value = origIdx;
      else if (activeTaskIdx.value > fromOrig && activeTaskIdx.value <= origIdx)
        activeTaskIdx.value--;
      else if (activeTaskIdx.value < fromOrig && activeTaskIdx.value >= origIdx)
        activeTaskIdx.value++;
    }
    taskDraggingOrigIdx.value = null;
    taskDragOverOrigIdx.value = null;
  };
  const onTaskTabDragEnd = () => {
    taskDraggingOrigIdx.value = null;
    taskDragOverOrigIdx.value = null;
  };
  const onTaskTabClick = (origIdx: number) => {
    activeTaskIdx.value = origIdx;
  };
  const toggleAll = (rolesToToggle: { id: string }[]) => {
    const allIds = rolesToToggle.map((r) => r.id);
    const allSelected = allIds.every((id) =>
      form.value.visibility.includes(id),
    );
    if (allSelected)
      form.value.visibility = form.value.visibility.filter(
        (id) => !allIds.includes(id),
      );
    else {
      const newVis = [...form.value.visibility];
      allIds.forEach((id) => {
        if (!newVis.includes(id)) newVis.push(id);
      });
      form.value.visibility = newVis;
    }
  };
  const fmtTime = (t: string) => {
    const h = getTimeHour(t);
    const m = getTimeMin(t);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return { h12: pad2(h12), m: pad2(m), ampm };
  };
  const openClock = (field: "start" | "end") => {
    clockField.value = field;
    clockMode.value = "hour";
  };
  const closeClock = () => {
    clockField.value = null;
  };
  const selectHour = (h: number) => {
    const field = clockField.value!;
    const cur = field === "start" ? form.value.start_time : form.value.end_time;
    let hour = h;
    if (!isAm.value && h !== 12) hour += 12;
    if (isAm.value && h === 12) hour = 0;
    const time = `${pad2(hour)}:${pad2(getTimeMin(cur))}`;
    if (field === "start") form.value.start_time = time;
    else form.value.end_time = time;
  };
  const selectMin = (m: number) => {
    const field = clockField.value!;
    const cur = field === "start" ? form.value.start_time : form.value.end_time;
    const time = `${pad2(getTimeHour(cur))}:${pad2(m)}`;
    if (field === "start") form.value.start_time = time;
    else form.value.end_time = time;
  };
  const toggleAmPm = () => {
    const field = clockField.value!;
    const cur = field === "start" ? form.value.start_time : form.value.end_time;
    let h = getTimeHour(cur);
    const m = pad2(getTimeMin(cur));
    h = h >= 12 ? h - 12 : h + 12;
    const time = `${pad2(h)}:${m}`;
    if (field === "start") form.value.start_time = time;
    else form.value.end_time = time;
  };
  const formatDateThai = (dateStr: string) => {
    if (!dateStr) return "—";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "—";
    const months = [
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
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear() + 543}`;
  };
  return {
    // State
    form,
    editingId,
    uploading,
    submitting,
    roles,
    submissionOptions,
    taskTypeOptions,
    metricOptions,
    unitOptions,
    showAdvanced,
    activeTaskIdx,
    activeTab,
    showCropper,
    cropperTarget,
    cropperRawFile,
    cropperImgUrl,
    cropperEl,
    cropRatio,
    showCertEditor,
    certEditorEventId,
    hasCertTemplate,
    certLastUpdated,
    isDragging,
    draggingSectionIdx,
    displayedTasks,
    flatUnits,
    clockField,
    clockMode,
    currentHour,
    currentMin,
    isAm,
    sectionDraggingIdx,
    sectionDragOverIdx,
    taskDraggingOrigIdx,
    taskDragOverOrigIdx,
    // Actions
    fetchMasterData,
    openCreate,
    editActivity,
    viewActivityDetails,
    saveActivity,
    resetForm: () => {
      resetForm();
      activeTab.value = "list";
      hasCertTemplate.value = false;
      certLastUpdated.value = "";
    },
    restoreDraft,
    addTask,
    removeTask,
    handleTypeChange,
    handleMetricChange,
    toggleDay,
    setDayPreset,
    addSection,
    removeSection,
    handlePosterUpload,
    handleSectionImageUpload,
    openCropper,
    closeCropper,
    confirmCrop,
    setCropRatio,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleSectionDragOver,
    handleSectionDragLeave,
    handleSectionDrop,
    openCertificateEditor,
    openCertEditorDirect,
    closeCertEditor,
    checkCertTemplate,
    onSectionDragStart,
    onSectionDragOver,
    onSectionDragLeave,
    onSectionDrop,
    onSectionDragEnd,
    onTaskTabDragStart,
    onTaskTabDragOver,
    onTaskTabDragLeave,
    onTaskTabDrop,
    onTaskTabDragEnd,
    onTaskTabClick,
    toggleAll,
    showSchoolLevels,
    showUniFilters,
    showFacultyFilters,
    fmtTime,
    openClock,
    closeClock,
    selectHour,
    selectMin,
    toggleAmPm,
    formatDateThai,
    pad2,
    vAutoExpand: {
      mounted: (el: HTMLElement) => {
        el.style.overflow = "hidden";
        el.style.resize = "none";
        autoExpand(el);
      },
      updated: (el: HTMLElement) => autoExpand(el),
    },
    initialForm,
  };
}
// Helper outside the composable if needed or inside
function autoExpand(el: HTMLElement) {
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

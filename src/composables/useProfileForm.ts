import { ref, computed, watch } from "vue";
import { authStore } from "../store/auth";
import { langStore } from "../store/lang";
import { showError } from "../lib/swal";
import {
  User,
  School,
  GraduationCap,
  Building2,
  Briefcase,
  VenetianMask,
  Calendar,
  Activity,
  Target,
  Mail,
  Phone,
  IdCard,
  MapPin,
  Stethoscope,
} from "lucide-vue-next";
export function useProfileForm(user: any, tanitaRef: any) {
  const form = ref<any>({});
  const form_be = ref({ day: "1", month: "1", year: "" });
  const editing = ref(false);
  const underlyingDiseaseState = ref("no");
  const fileInput = ref(null);
  const isUploading = ref(false);
  const isSubmitting = ref(false);
  const currentYear = new Date().getFullYear();
  const years_be = Array.from({ length: 100 }, (_, i) =>
    String(currentYear + 543 - i),
  );
  const months_th = [
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
  const dayOptions = Array.from({ length: 31 }, (_, i) => ({
    label: String(i + 1),
    value: String(i + 1),
  }));
  const monthOptions = months_th.map((m, i) => ({
    label: m,
    value: String(i + 1),
  }));
  const yearOptions = years_be.map((y) => ({ label: y, value: y }));
  watch(
    user,
    (val) => {
      if (val) {
        form.value = { ...val };
        if (val.birth_date) {
          const d = new Date(val.birth_date);
          form_be.value = {
            day: String(d.getDate()),
            month: String(d.getMonth() + 1),
            year: String(d.getFullYear() + 543),
          };
        }
      }
    },
    { immediate: true },
  );
  watch(
    form_be,
    (val) => {
      if (editing.value && val.year && val.month && val.day) {
        const y = Number(val.year) - 543;
        const m = val.month.toString().padStart(2, "0");
        const d = val.day.toString().padStart(2, "0");
        form.value.birth_date = `${y}-${m}-${d}`;
      }
    },
    { deep: true },
  );
  watch(editing, (val) => {
    if (val) {
      const ud = form.value.underlying_disease;
      underlyingDiseaseState.value =
        ud && ud !== "ไม่มีโรคประจำตัว" && ud !== "ไม่มี" ? "yes" : "no";
      if (underlyingDiseaseState.value === "no")
        form.value.underlying_disease = "ไม่มีโรคประจำตัว";
    }
  });
  function setDisease(type) {
    underlyingDiseaseState.value = type;
    if (type === "no") form.value.underlying_disease = langStore.t('no_underlying_disease');
    else if (form.value.underlying_disease === langStore.t('no_underlying_disease') || form.value.underlying_disease === "ไม่มีโรคประจำตัว")
      form.value.underlying_disease = "";
  }
  function startEdit() {
    editing.value = true;
    const u = user.value;
    form.value = { ...u };
    if (u?.role_type === "นักศึกษา" && u?.role_detail_2) {
      if (u.role_detail_2.includes(" - ")) {
        const parts = u.role_detail_2.split(" - ");
        let fac = parts[0];
        if (fac && !uniFaculties.value.includes(fac) && fac !== langStore.t('others') && fac !== "อื่น ๆ") {
          form.value.univ_faculty = langStore.t('others');
          form.value.univ_faculty_other = fac;
        } else {
          form.value.univ_faculty = fac;
        }
        form.value.univ_year = parts[1];
      } else {
        let fac = u.role_detail_2;
        if (fac && !uniFaculties.value.includes(fac) && fac !== langStore.t('others') && fac !== "อื่น ๆ") {
          form.value.univ_faculty = langStore.t('others');
          form.value.univ_faculty_other = fac;
        } else {
          form.value.univ_faculty = fac;
        }
      }
    } else if (u?.role_type === "บุคลากรมหาวิทยาลัย") {
      let dep = u?.role_detail_1;
      if (dep && !uniFaculties.value.includes(dep) && dep !== "" && dep !== langStore.t('others') && dep !== "อื่น ๆ") {
        form.value.role_detail_1 = langStore.t('others');
        form.value.role_detail_1_other = dep;
      }
    }
  }
  function cancelEdit() {
    editing.value = false;
    // Reset form to current user data to discard changes
    if (user.value) {
      form.value = { ...user.value };
      // Also reset BE date if exists
      if (user.value.birth_date) {
        const d = new Date(user.value.birth_date);
        form_be.value = {
          day: String(d.getDate()),
          month: String(d.getMonth() + 1),
          year: String(d.getFullYear() + 543),
        };
      }
    }
  }
  function formatPhone(val) {
    if (!val) return "";
    const digits = val.replace(/\D/g, "").slice(0, 10);
    let formatted = digits;
    if (digits.length > 6) {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length > 3) {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`;
    }
    return formatted;
  }
  watch(
    () => form.value.phone,
    (newVal) => {
      if (editing.value && newVal) {
        const formatted = formatPhone(newVal);
        if (formatted !== newVal) {
          form.value.phone = formatted;
        }
      }
    },
  );
  async function saveEdit() {
    if (!user.value?.id || isSubmitting.value) return;
    isSubmitting.value = true;
    try {
      // 1. Validate Email (Gmail only)
      if (form.value.email) {
        const email = form.value.email.toLowerCase().trim();
        if (!email.endsWith("@gmail.com")) {
          showError(langStore.t('gmail_only_error') || "กรุณาใช้อีเมลของ Gmail (@gmail.com) เท่านั้น");
          return;
        }
        form.value.email = email;
      }
      // 2. Validate Phone (Thai format: 10 digits)
      if (form.value.phone) {
        const digits = form.value.phone.replace(/\D/g, "");
        if (digits.length !== 10) {
          showError(langStore.t('phone_10_digits_error') || "กรุณากรอกเบอร์โทรศัพท์ให้ครบ 10 หลัก");
          return;
        }
      }
      if (form_be.value?.year) {
        const y = Number(form_be.value.year) - 543;
        const m = form_be.value.month.toString().padStart(2, "0");
        const d = form_be.value.day.toString().padStart(2, "0");
        form.value.birth_date = `${y}-${m}-${d}`;
      }
      if (form.value.role_type === "นักศึกษา" && form.value.univ_faculty) {
        const finalFac =
          form.value.univ_faculty === "อื่น ๆ" ||
          form.value.univ_faculty === "อื่นๆ" ||
          form.value.univ_faculty === langStore.t('others')
            ? form.value.univ_faculty_other || ""
            : form.value.univ_faculty;
        form.value.role_detail_2 = `${finalFac}${form.value.univ_year ? " - " + form.value.univ_year : ""}`;
        delete form.value.univ_faculty;
        delete form.value.univ_year;
        delete form.value.univ_faculty_other;
      } else if (
        form.value.role_type === "บุคลากรมหาวิทยาลัย" &&
        (form.value.role_detail_1 === "อื่น ๆ" ||
          form.value.role_detail_1 === "อื่นๆ" ||
          form.value.role_detail_1 === langStore.t('others'))
      ) {
        form.value.role_detail_1 = form.value.role_detail_1_other || "";
        delete form.value.role_detail_1_other;
      }
      if (form.value.weight) form.value.weight = parseFloat(form.value.weight);
      if (form.value.height) form.value.height = parseFloat(form.value.height);
      const res = await fetch(`/api/users/${user.value.id}/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(user.value.id),
        },
        body: JSON.stringify(form.value),
      });
      if (res.ok) {
        const updated = await res.json();
        authStore.setUser(updated);
        form.value = { ...updated };
        editing.value = false;
        // Optionally show success message
      } else {
        const errorData = await res.json().catch(() => ({}));
        showError(errorData.error || langStore.t('save_failed_retry') || "ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
      }
    } catch (err: any) {
      console.error("[saveEdit] Error:", err);
      showError(langStore.t('server_connection_error') || "เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    } finally {
      isSubmitting.value = false;
    }
  }
  async function fetchData() {
    if (!user.value?.id) return;
    try {
      const fetchProfileRes = await fetch(
        `/api/users/${user.value.id}/profile`,
        { headers: { "x-user-id": String(user.value.id) } },
      ).catch(() => null);
      if (fetchProfileRes && fetchProfileRes.ok) {
        const freshUser = await fetchProfileRes.json();
        authStore.setUser(freshUser);
        form.value = { ...freshUser };
      }
    } catch (err) {}
  }
  function triggerUpload() {
    if (fileInput.value) {
      fileInput.value.value = "";
      fileInput.value.click();
    }
  }
  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file || !user.value?.id || isUploading.value) return;
    isUploading.value = true;
    try {
      // Build a descriptive filename: username-date (server appends the date)
      const username =
        user.value?.nickname || user.value?.fname_th || `user${user.value.id}`;
      const params = new URLSearchParams({ type: "profile", name: username });
      if (user.value?.picture_url) {
        params.append("oldUrl", user.value.picture_url);
      }
      const formData = new FormData();
      formData.append("image", file);
      console.log("[upload:profile:start]", {
        username,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        endpoint: `/api/upload?${params}`,
        userId: user.value.id,
      });
      const uploadRes = await fetch(`/api/upload?${params}`, {
        method: "POST",
        headers: { "x-user-id": String(user.value.id) },
        body: formData,
      });
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        console.error("[upload:profile:failed]", {
          status: uploadRes.status,
          statusText: uploadRes.statusText,
          error: err,
        });
        throw new Error(err.error || `Upload failed (${uploadRes.status})`);
      }
      const { url } = await uploadRes.json();
      console.log("[upload:profile:success]", { url });
      // Save the returned URL to the user profile in the DB
      const res = await fetch(`/api/users/${user.value.id}/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(user.value.id),
        },
        body: JSON.stringify({ picture_url: url }),
      });
      if (res.ok) {
        const updatedUser = await res.json();
        authStore.setUser(updatedUser);
        if (form.value) form.value.picture_url = updatedUser.picture_url;
      } else {
        const errJson = await res.json();
        console.error("[upload:profile:db-update-failed]", {
          status: res.status,
          statusText: res.statusText,
          error: errJson,
          uploadedUrl: url,
        });
        throw new Error(errJson.error || "Database update failed");
      }
    } catch (err) {
      console.error("[upload:profile:error]", err);
      showError(langStore.t('upload_failed_retry') || "ไม่สามารถอัปโหลดรูปโปรไฟล์ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      isUploading.value = false;
      if (e.target) e.target.value = "";
    }
  }
  const initials = computed(() => {
    const u = editing.value ? form.value : user.value;
    if (!u) return "?";
    const f = u.fname_th?.[0] ?? "";
    const l = u.lname_th?.[0] ?? "";
    return (f + l).trim() || "?";
  });
  const accurateAge = computed(() => {
    // ใช้ birth_date เป็นหลักเสมอ (อายุจริง สำหรับสูตร Mifflin-St Jeor)
    const u = editing.value ? form.value : user.value;
    if (u?.birth_date) {
      const birth = new Date(u.birth_date);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
      return age >= 0 ? age : 0;
    }
    // fallback: ใช้ age จาก Tanita ถ้าไม่มี birth_date เท่านั้น
    if (tanitaRef.value?.age) return parseInt(tanitaRef.value.age);
    return "–";
  });
  const latestWeight = computed(() => {
    const u = editing.value ? form.value : user.value;
    const tw = parseFloat(tanitaRef.value?.weight);
    const uw = parseFloat(u?.weight);
    if (!isNaN(tw)) return tw;
    if (!isNaN(uw)) return uw;
    return "–";
  });
  const latestHeight = computed(() => {
    const u = editing.value ? form.value : user.value;
    const th = parseFloat(tanitaRef.value?.height);
    const uh = parseFloat(u?.height);
    if (!isNaN(th)) return th;
    if (!isNaN(uh)) return uh;
    return "–";
  });
  const profileBMI = computed(() => {
    const w = parseFloat(String(latestWeight.value));
    const h = parseFloat(String(latestHeight.value)) / 100;
    if (!w || !h || isNaN(w) || isNaN(h)) return "–";
    return (w / (h * h)).toFixed(1);
  });
  const idealWeight = computed(() => {
    if (tanitaRef.value?.ideal_weight) return tanitaRef.value.ideal_weight;
    const h = parseFloat(String(latestHeight.value)) / 100;
    if (!h || isNaN(h)) return null;
    return (22 * (h * h)).toFixed(1);
  });
  const recommendedCalories = computed(() => {
    const u = editing.value ? form.value : user.value;
    const w = parseFloat(String(latestWeight.value));
    const h = parseFloat(String(latestHeight.value));
    const a = parseInt(String(accurateAge.value));
    const rawGender = (
      tanitaRef.value?.gender ||
      u?.gender ||
      ""
    ).toLowerCase();
    if (isNaN(w) || isNaN(h) || isNaN(a) || !rawGender) return null;
    // Mifflin-St Jeor Formula
    const isMale = rawGender.includes("ชาย") || rawGender.includes("male");
    let bmr = isMale
      ? 10 * w + 6.25 * h - 5 * a + 5
      : 10 * w + 6.25 * h - 5 * a - 161;
    const multipliers = {
      sedentary: 1.2, // ไม่ออกกำลังกายเลย
      light: 1.375, // 1-3 วัน/สัปดาห์
      moderate: 1.55, // 3-5 วัน/สัปดาห์
      very_active: 1.725, // 6-7 วัน/สัปดาห์
      extra_active: 1.9, // หนักมาก/นักกีฬา
    };
    const tdee = Math.round(bmr * (multipliers[u?.activity_level] || 1.2));
    // Weight Goal Adjustment
    if (u?.main_goal?.includes("ลด")) return tdee - 500;
    if (u?.main_goal?.includes("เพิ่ม")) return tdee + 500;
    return tdee;
  });
  const fatStatus = computed(() => {
    const v = parseFloat(tanitaRef.value?.fat_pc);
    const u = editing.value ? form.value : user.value;
    const rawGender = (
      tanitaRef.value?.gender ||
      u?.gender ||
      ""
    ).toLowerCase();
    if (!v || !rawGender) return "";
    const isFemale = rawGender.includes("หญิง") || rawGender.includes("female");
    if (isFemale)
      return v < 20 ? "ต่ำ" : v < 30 ? "ปกติ" : v < 35 ? "เฝ้าระวัง" : "สูง";
    return v < 10 ? "ต่ำ" : v < 20 ? "ปกติ" : v < 25 ? "เฝ้าระวัง" : "สูง";
  });
  const BMI_LEVELS = [
    {
      maxBmi: 18.5,
      src: "/underweight.png",
      label: "ผอมเกินเกณฑ์",
      badge: langStore.t('bmi_under_badge'),
      badgeStyle: { background: "#e0f2fe", color: "#075985" },
      color: "#0369a1",
      descStyle: {
        background: "#f0f9ff",
        border: "1px solid #bae6fd",
        color: "#075985",
      },
      desc: langStore.t('bmi_under_desc'),
      dotIndex: 0,
    },
    {
      maxBmi: 22.9,
      src: "/normalweight.png",
      label: "ปกติ / สมส่วน",
      badge: langStore.t('bmi_normal_badge'),
      badgeStyle: { background: "#dcfce7", color: "#166534" },
      color: "#10b981",
      descStyle: {
        background: "#f0fdf4",
        border: "1px solid #bbf7d0",
        color: "#166534",
      },
      desc: langStore.t('bmi_normal_desc'),
      dotIndex: 1,
    },
    {
      maxBmi: 24.9,
      src: "/overweight.png",
      label: "รูปร่างท้วม",
      badge: langStore.t('bmi_over_badge'),
      badgeStyle: { background: "#fef9c3", color: "#854d0e" },
      color: "#ca8a04",
      descStyle: {
        background: "#fefce8",
        border: "1px solid #fef08a",
        color: "#854d0e",
      },
      desc: langStore.t('bmi_over_desc'),
      dotIndex: 2,
    },
    {
      maxBmi: 29.9,
      src: "/chubbyweight.png",
      label: "น้ำหนักเกินระดับ 1",
      badge: langStore.t('bmi_obese1_badge'),
      badgeStyle: { background: "#ffedd5", color: "#9a3412" },
      color: "#ea580c",
      descStyle: {
        background: "#fff7ed",
        border: "1px solid #fed7aa",
        color: "#9a3412",
      },
      desc: langStore.t('bmi_obese1_desc'),
      dotIndex: 3,
    },
    {
      maxBmi: Infinity,
      src: "/chubbyweight.png",
      label: "น้ำหนักเกินระดับ 2",
      badge: langStore.t('bmi_obese2_badge'),
      badgeStyle: { background: "#fee2e2", color: "#991b1b" },
      color: "#dc2626",
      descStyle: {
        background: "#fef2f2",
        border: "1px solid #fecaca",
        color: "#991b1b",
      },
      desc: langStore.t('bmi_obese2_desc'),
      dotIndex: 4,
    },
  ];
  const bmiImage = computed(() => {
    const val = parseFloat(
      profileBMI.value === "–" ? "0" : String(profileBMI.value),
    );
    return BMI_LEVELS.find((l) => val < l.maxBmi) ?? BMI_LEVELS[4];
  });
  // Dynamic field definitions
  const roleOptions = computed(() => [
    { value: "นักเรียน", label: langStore.t('role_student_school') },
    { value: "นักศึกษา", label: langStore.t('role_student_uni') },
    { value: "บุคลากรโรงพยาบาล", label: langStore.t('role_hospital_staff') },
    { value: "บุคลากรมหาวิทยาลัย", label: langStore.t('role_uni_staff') },
    { value: "บุคคลทั่วไป", label: langStore.t('role_general') },
  ]);
  const gradeOptions = computed(() => [
    { value: "ป.1 - ป.6", label: "ประถมศึกษา (ป.1 - ป.6)" },
    { value: "ม.1 - ม.6", label: "มัธยมศึกษา (ม.1 - ม.6)" },
  ]);
  const uniFaculties = computed(() => [
    "สำนักวิชาวิทยาศาสตร์",
    "สำนักวิชาเทคโนโลยีสังคม",
    "สำนักวิชาเทคโนโลยีการเกษตร",
    "สำนักวิชาวิศวกรรมศาสตร์",
    "สำนักวิชาแพทยศาสตร์",
    "สำนักวิชาพยาบาลศาสตร์",
    "สำนักวิชาทันตแพทยศาสตร์",
    "สำนักวิชาสาธารณสุขศาสตร์",
    "สำนักวิชาศาสตร์และศิลป์ดิจิทัล",
    langStore.t('others'),
  ]);
  const uniYears = computed(() => ["ปี 1", "ปี 2", "ปี 3", "ปี 4", "ปี 5", "ปี 6"]);
  const activityOptions = computed(() => [
    { value: "sedentary", label: langStore.t('act_sedentary') },
    { value: "light", label: langStore.t('act_light') },
    { value: "moderate", label: langStore.t('act_moderate') },
    { value: "very_active", label: langStore.t('act_very_active') },
    { value: "extra_active", label: langStore.t('act_extra_active') },
  ]);
  const goalOptions = computed(() => [
    { value: "ลดน้ำหนัก", label: langStore.t('goal_weight_loss') },
    { value: "เพิ่มกล้ามเนื้อ", label: langStore.t('goal_muscle_gain') },
    { value: "เพิ่มการเดิน", label: langStore.t('goal_walk_more') },
    { value: "นอนหลับให้ดีขึ้น", label: langStore.t('goal_sleep_better') },
    { value: "รักษาสุขภาพทั่วไป", label: langStore.t('goal_general_health') },
  ]);
  const generalFields = computed(() => {
    const fields: any[] = [
      { key: "fname_th", label: langStore.t('first_name'), icon: User },
      { key: "lname_th", label: langStore.t('last_name'), icon: User },
      { key: "nickname", label: langStore.t('nickname'), icon: User },
      {
        key: "role_type",
        label: langStore.t('user_type'),
        type: "select",
        options: roleOptions.value,
        icon: User,
      },
    ];
    const role = form.value.role_type || user.value?.role_type;
    if (role === "นักเรียน") {
      fields.push({
        key: "role_detail_1",
        label: langStore.t('school_name'),
        type: "text",
        icon: School,
      });
      fields.push({
        key: "role_detail_2",
        label: langStore.t('grade_level'),
        type: "select",
        options: gradeOptions.value,
        icon: GraduationCap,
      });
    } else if (role === "นักศึกษา") {
      fields.push({
        key: "role_detail_1",
        label: langStore.t('university'),
        type: "text",
        icon: School,
      });
      if (editing.value) {
        fields.push({
          key: "univ_faculty",
          label: langStore.t('faculty'),
          type: "select",
          options: uniFaculties.value,
          icon: GraduationCap,
        });
        if (
          form.value.univ_faculty === "อื่น ๆ" ||
          form.value.univ_faculty === "อื่นๆ" ||
          form.value.univ_faculty === langStore.t('others')
        ) {
          fields.push({
            key: "univ_faculty_other",
            label: langStore.t('specify_faculty'),
            type: "text",
            icon: GraduationCap,
          });
        }
        fields.push({
          key: "univ_year",
          label: langStore.t('year_level'),
          type: "select",
          options: uniYears.value,
          icon: GraduationCap,
        });
      } else {
        fields.push({
          key: "role_detail_2",
          label: langStore.t('faculty_year'),
          type: "text",
          icon: GraduationCap,
        });
      }
    } else if (role === "บุคลากรโรงพยาบาล" || role === "บุคลากรมหาวิทยาลัย") {
      const isUni = role === "บุคลากรมหาวิทยาลัย";
      fields.push({
        key: "role_detail_1",
        label: isUni ? langStore.t('department') : langStore.t('division'),
        type: isUni ? "select" : "text",
        options: isUni ? uniFaculties.value : [],
        icon: Building2,
      });
      if (
        isUni &&
        editing.value &&
        (form.value.role_detail_1 === "อื่น ๆ" ||
          form.value.role_detail_1 === "อื่นๆ" ||
          form.value.role_detail_1 === langStore.t('others'))
      ) {
        fields.push({
          key: "role_detail_1_other",
          label: langStore.t('specify_department'),
          type: "text",
          icon: Building2,
        });
      }
      fields.push({
        key: "role_detail_2",
        label: isUni ? langStore.t('position') : langStore.t('profession'),
        type: "text",
        icon: Briefcase,
      });
    }
    fields.push(
      {
        key: "gender",
        label: langStore.t('biological_sex'),
        type: "select",
        options: [
          { value: "male", label: langStore.t('gender_male') },
          { value: "female", label: langStore.t('gender_female') },
          { value: "other", label: langStore.t('gender_other') },
        ],
        icon: VenetianMask,
      },
      { key: "birth_date", label: langStore.t('date_of_birth'), type: "date_be", icon: Calendar },
      {
        key: "activity_level",
        label: langStore.t('activity_level'),
        type: "select",
        options: activityOptions.value,
        icon: Activity,
      },
      {
        key: "main_goal",
        label: langStore.t('main_goal'),
        type: "select",
        options: goalOptions.value,
        icon: Target,
      },
    );
    return fields;
  });
  const contactFields = computed(() => [
    { key: "email", label: langStore.t('email'), icon: Mail },
    { key: "phone", label: langStore.t('phone'), icon: Phone },
    { key: "id_code", label: langStore.t('id_card'), icon: IdCard },
    { key: "address", label: langStore.t('address'), icon: MapPin },
    { key: "underlying_disease", label: langStore.t('congenital_disease'), icon: Stethoscope },
  ]);
  function formatBE(dateStr) {
    if (!dateStr) return "–";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const d = date.getDate().toString().padStart(2, "0");
    const m = (date.getMonth() + 1).toString().padStart(2, "0");
    const y = date.getFullYear() + 543;
    return `${d}/${m}/${y}`;
  }
  function getFieldLabel(field, value) {
    if (!value) return "–";
    if (field.type === "select") {
      const opt = field.options.find(
        (o) => (typeof o === "string" ? o : o.value) === value,
      );
      return typeof opt === "string" ? opt : opt?.label || value;
    }
    return value;
  }
  return {
    form,
    form_be,
    editing,
    underlyingDiseaseState,
    isUploading,
    fileInput,
    dayOptions,
    monthOptions,
    yearOptions,
    generalFields,
    contactFields,
    goalOptions,
    activityOptions,
    profileBMI,
    accurateAge,
    latestWeight,
    latestHeight,
    idealWeight,
    recommendedCalories,
    fatStatus,
    bmiImage,
    initials,
    setDisease,
    startEdit,
    cancelEdit,
    saveEdit,
    fetchData,
    triggerUpload,
    handleFileChange,
    formatBE,
    getFieldLabel,
    formatPhone,
    isSubmitting,
  };
}

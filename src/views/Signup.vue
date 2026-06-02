<script setup lang="ts">
import { ref, onMounted, watch, computed } from "vue";
import { useRouter } from "vue-router";
import { authStore } from "../store/auth";
import { langStore } from "../store/lang";
import Swal from "sweetalert2";
import { swal } from "../lib/swal";
import CustomSelect from "../components/CustomSelect.vue";
import liff from "@line/liff";
const toast = {
    warning: (msg: string) =>
        Swal.fire({
            icon: "warning",
            title: msg,
            toast: true,
            position: "top-end",
            timer: 3000,
            showConfirmButton: false,
        }),
    error: (msg: string) =>
        Swal.fire({
            icon: "error",
            title: msg,
            toast: true,
            position: "top-end",
            timer: 3000,
            showConfirmButton: false,
        }),
    success: (msg: string) =>
        Swal.fire({
            icon: "success",
            title: msg,
            toast: true,
            position: "top-end",
            timer: 3000,
            showConfirmButton: false,
        }),
    info: (msg: string) =>
        Swal.fire({
            icon: "info",
            title: msg,
            toast: true,
            position: "top-end",
            timer: 3000,
            showConfirmButton: false,
        }),
};
const props = defineProps<{ initialData?: any }>();
const socialData = ref<any>(null);
const emit = defineEmits(["goToLogin", "goToHome"]);
const router = useRouter();
const step = ref(1);
const isUploading = ref(false);
const hasDisease = ref("no"); // Default to 'no'
const isAnalyzing = ref(false);
const isSubmitting = ref(false);
const errorMsg = ref("");
const loadingMessages = computed(() =>
  langStore.locale === 'th'
    ? [
        "กำลังอัปโหลดรูปภาพใบเสร็จ...",
        "AI กำลังสแกนตัวเลขบนหน้าจอ...",
        "กำลังวิเคราะห์ข้อมูลสุขภาพ...",
        "เกือบเสร็จแล้ว รออีกนิดนะ...",
        "กำลังจัดเรียงข้อมูลลงแบบฟอร์ม...",
      ]
    : [
        "Uploading receipt image...",
        "AI is scanning the numbers on the screen...",
        "Analyzing health data...",
        "Almost done, please wait...",
        "Organizing data into the form...",
      ]
);
const currentLoadingMessage = ref(loadingMessages.value[0]);
let messageInterval: any = null;
const startLoadingMessages = () => {
    let index = 0;
    currentLoadingMessage.value = loadingMessages.value[0];
    messageInterval = setInterval(() => {
        index = (index + 1) % loadingMessages.value.length;
        currentLoadingMessage.value = loadingMessages.value[index];
    }, 3500);
};
const stopLoadingMessages = () => {
    if (messageInterval) clearInterval(messageInterval);
};
const formData = ref({
    firstName: props.initialData?.firstName || "",
    lastName: props.initialData?.lastName || "",
    nickname: "",
    gender: "",
    dob: "",
    phone: "",
    email: "",
    password: "",
    userType: "",
    faculty: "",
    year: "",
    universityName: "",
    studentId: "",
    schoolName: "",
    grade: "",
    empId: "",
    department: "",
    profession: "",
    facultyOther: "",
    departmentOther: "",
    inputMethod: "manual",
    height: "",
    weight: "",
    waist: "",
    bodyType: "STANDARD",
    clothesWeight: "",
    fatPercent: "",
    fatMass: "",
    ffm: "",
    muscleMass: "",
    bodyWaterMass: "",
    bodyWaterPercent: "",
    boneMass: "",
    bmrKj: "",
    bmrKcal: "",
    metabolicAge: "",
    visceralFat: "",
    bmi: "",
    idealWeight: "",
    obesityDegree: "",
    physiqueRating: "",
    goals: [] as string[],
    underlying_disease: "ไม่มีโรคประจำตัว",
});
const faculties = [
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
const facultiesOptions = computed(() =>
    langStore.locale === 'th'
        ? faculties
        : [
            "Institute of Science",
            "Institute of Social Technology",
            "Institute of Agricultural Technology",
            "Institute of Engineering",
            "Institute of Medicine",
            "Institute of Nursing",
            "Institute of Dentistry",
            "Institute of Public Health",
            "Institute of Digital Arts and Science",
            "Other",
        ].map((label, i) => ({ value: faculties[i], label }))
);
onMounted(() => {
    const isAllowed = sessionStorage.getItem("allow_signup") === "true";
    const hasAuth = authStore.user || localStorage.getItem("vitalcare_user");
    const hasSocial = localStorage.getItem("social_login_data");
    if (!isAllowed && !hasAuth && !hasSocial) {
        router.replace("/login");
        return;
    }
    if (authStore.user) {
        const u = authStore.user;
        if (u.fname_th) formData.value.firstName = u.fname_th;
        if (u.lname_th) formData.value.lastName = u.lname_th;
        if (u.nickname) formData.value.nickname = u.nickname;
        if (u.email) formData.value.email = u.email;
        if (u.phone) formData.value.phone = u.phone;
        if (u.birth_date) formData.value.dob = u.birth_date.split("T")[0];
        if (u.gender) formData.value.gender = u.gender;
        if (u.role_type) formData.value.userType = u.role_type;
        // Role Details Mapping back
        if (u.role_type === "นักเรียน") {
            formData.value.schoolName = u.role_detail_1 || "";
            formData.value.grade = u.role_detail_2 || "";
        } else if (u.role_type === "นักศึกษา") {
            formData.value.universityName = u.role_detail_1 || "";
            if (u.role_detail_2 && u.role_detail_2.includes(" - ")) {
                const parts = u.role_detail_2.split(" - ");
                const fac = parts[0];
                if (fac && !faculties.includes(fac) && fac !== "อื่น ๆ") {
                    formData.value.faculty = "อื่น ๆ";
                    formData.value.facultyOther = fac;
                } else {
                    formData.value.faculty = fac;
                }
                formData.value.year = parts[1];
            } else {
                const fac = u.role_detail_1 || ""; // Fallback
                if (fac && !faculties.includes(fac) && fac !== "อื่น ๆ") {
                    formData.value.faculty = "อื่น ๆ";
                    formData.value.facultyOther = fac;
                } else {
                    formData.value.faculty = fac;
                }
                formData.value.year = u.role_detail_2 || "";
            }
        } else if (u.role_type === "บุคลากรโรงพยาบาล") {
            formData.value.department = u.role_detail_1 || "";
            formData.value.profession = u.role_detail_2 || "";
        } else if (u.role_type === "บุคลากรมหาวิทยาลัย") {
            const isOther =
                u.role_detail_1 &&
                !faculties.includes(u.role_detail_1) &&
                u.role_detail_1 !== "";
            if (isOther) {
                formData.value.department = "อื่น ๆ";
                formData.value.departmentOther = u.role_detail_1;
            } else {
                formData.value.department = u.role_detail_1 || "";
            }
        }
        if (u.id_code) {
            if (u.role_type === "นักเรียน" || u.role_type === "นักศึกษา")
                formData.value.studentId = u.id_code;
            else formData.value.empId = u.id_code;
        }
        if (u.underlying_disease) {
            formData.value.underlying_disease = u.underlying_disease;
            hasDisease.value =
                u.underlying_disease &&
                u.underlying_disease !== "ไม่มีโรคประจำตัว"
                    ? "yes"
                    : "no";
        }
        if (u.main_goal) formData.value.goals = [u.main_goal];
        if (u.height && !formData.value.height)
            formData.value.height = String(u.height);
        if (u.weight && !formData.value.weight)
            formData.value.weight = String(u.weight);
        if (u.waist && !formData.value.waist)
            formData.value.waist = String(u.waist);
    }
    const storedSocial = localStorage.getItem("social_login_data");
    if (storedSocial) {
        try {
            socialData.value = JSON.parse(storedSocial);
            if (socialData.value.email && !formData.value.email)
                formData.value.email = socialData.value.email;
            if (socialData.value.firstName && !formData.value.firstName)
                formData.value.firstName = socialData.value.firstName;
            if (socialData.value.lastName && !formData.value.lastName)
                formData.value.lastName = socialData.value.lastName;
        } catch (e) {}
        localStorage.removeItem("social_login_data");
    }
    if (socialData.value?.provider) {
        toast.success(
            langStore.locale === 'th' ? `ดึงข้อมูลตั้งต้นจาก ${socialData.value.provider} สำเร็จ! กรุณากรอกข้อมูลส่วนที่เหลือ` : `Successfully pulled initial data from ${socialData.value.provider}! Please fill out the rest.`,
        );
    }
});
const storedSocial = localStorage.getItem("social_login_data");
const genderOptions = computed(() => [
    { value: "male", label: langStore.locale === 'th' ? "ชาย" : "Male" },
    { value: "female", label: langStore.locale === 'th' ? "หญิง" : "Female" },
    { value: "other", label: langStore.locale === 'th' ? "อื่นๆ" : "Other" },
]);
const userTypeOptions = computed(() => [
    { value: "นักเรียน", label: langStore.locale === 'th' ? "นักเรียน (School Student)" : "School Student" },
    { value: "นักศึกษา", label: langStore.locale === 'th' ? "นักศึกษา (University Student)" : "University Student" },
    { value: "บุคลากรโรงพยาบาล", label: langStore.locale === 'th' ? "บุคลากรโรงพยาบาล (Hospital Staff)" : "Hospital Staff" },
    {
        value: "บุคลากรมหาวิทยาลัย",
        label: langStore.locale === 'th' ? "บุคลากรมหาวิทยาลัย (University Staff)" : "University Staff",
    },
    { value: "บุคคลทั่วไป", label: langStore.locale === 'th' ? "บุคคลทั่วไป (General Public)" : "General Public" },
]);
const gradeOptions = computed(() => [
    { value: "ป.1 - ป.6", label: langStore.locale === 'th' ? "ประถมศึกษา (ป.1 - ป.6)" : "Primary School (G1 - G6)" },
    { value: "ม.1 - ม.6", label: langStore.locale === 'th' ? "มัธยมศึกษา (ม.1 - ม.6)" : "High School (G7 - G12)" },
]);
const yearOptions = computed(() => [1, 2, 3, 4, 5, 6].map((y) => ({
    value: "ปี " + y,
    label: langStore.locale === 'th' ? "ปี " + y : "Year " + y,
})));
const goalsList = [
    "ลดน้ำหนัก",
    "เพิ่มกล้ามเนื้อ",
    "เพิ่มการเดิน",
    "นอนหลับให้ดีขึ้น",
    "รักษาสุขภาพทั่วไป",
];
const goalsOptions = computed(() => 
    goalsList.map((val, i) => ({
        value: val,
        label: langStore.locale === 'th' ? val : [
            "Lose Weight",
            "Gain Muscle",
            "Walk More",
            "Sleep Better",
            "General Health Maintenance",
        ][i]
    }))
);
const nextStep = () => {
    if (step.value === 1) {
        // Basic fields to check
        const requiredFields: Array<{
            id: string;
            val: any;
            condition?: boolean;
        }> = [
            { id: "fname_input", val: formData.value.firstName },
            { id: "lname_input", val: formData.value.lastName },
            { id: "dob_input", val: formData.value.dob },
            { id: "phone_input", val: formData.value.phone },
            { id: "gender_select", val: formData.value.gender },
            { id: "usertype_select", val: formData.value.userType },
        ];
        for (const field of requiredFields) {
            if (field.condition !== false && !field.val) {
                scrollToElement(field.id);
                return;
            }
        }
        // Phone length validation
        const phoneClean = formData.value.phone.replace(/\D/g, "");
        if (phoneClean.length !== 10) {
            scrollToElement("phone_input");
            return;
        }
        // Role Details Specific Validation
        if (formData.value.userType === "นักศึกษา") {
            if (!formData.value.universityName) {
                scrollToElement("uni_input");
                return;
            }
            if (!formData.value.faculty) {
                scrollToElement("faculty_select");
                return;
            }
            if (
                formData.value.faculty === "อื่น ๆ" &&
                !formData.value.facultyOther
            ) {
                scrollToElement("faculty_other_input");
                return;
            }
            if (!formData.value.year) {
                scrollToElement("year_select");
                return;
            }
        } else if (formData.value.userType === "นักเรียน") {
            if (!formData.value.schoolName) {
                scrollToElement("school_input");
                return;
            }
            if (!formData.value.grade) {
                scrollToElement("grade_select");
                return;
            }
        } else if (formData.value.userType === "บุคลากรโรงพยาบาล") {
            if (!formData.value.department) {
                scrollToElement("dept_input");
                return;
            }
            if (!formData.value.profession) {
                scrollToElement("profession_input");
                return;
            }
        } else if (formData.value.userType === "บุคลากรมหาวิทยาลัย") {
            if (!formData.value.department) {
                scrollToElement("dept_select");
                return;
            }
            if (
                formData.value.department === "อื่น ๆ" &&
                !formData.value.departmentOther
            ) {
                scrollToElement("dept_other_input");
                return;
            }
        }
        // Disease check
        if (
            hasDisease.value === "yes" &&
            (!formData.value.underlying_disease ||
                formData.value.underlying_disease === "ไม่มีโรคประจำตัว" ||
                formData.value.underlying_disease.trim() === "")
        ) {
            scrollToElement("disease_input");
            return;
        }
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
    step.value = 2;
};
// Data Type Watchers to enforce clean input
watch(
    () => formData.value.phone,
    (val) => {
        const clean = val.replace(/\D/g, "");
        let formatted = "";
        if (clean.length > 0) {
            formatted = clean.substring(0, 3);
            if (clean.length > 3) {
                formatted += "-" + clean.substring(3, 6);
            }
            if (clean.length > 6) {
                formatted += "-" + clean.substring(6, 10);
            }
        }
        formData.value.phone = formatted;
    },
);
const namePattern = /[^a-zA-Z\u0E00-\u0E7F\s]/g;
watch(
    () => formData.value.firstName,
    (val) => {
        formData.value.firstName = val.replace(namePattern, "");
    },
);
watch(
    () => formData.value.lastName,
    (val) => {
        formData.value.lastName = val.replace(namePattern, "");
    },
);
watch(
    () => formData.value.nickname,
    (val) => {
        formData.value.nickname = val.replace(namePattern, "");
    },
);
const diseasePattern = /[^a-zA-Z0-9\u0E00-\u0E7F\s-]/g;
watch(
    () => formData.value.underlying_disease,
    (val) => {
        if (val === "ไม่มีโรคประจำตัว") return;
        formData.value.underlying_disease = val.replace(diseasePattern, "");
    },
);
const scrollToElement = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        // Try to find a focusable element (input or the trigger in CustomSelect)
        const focusable =
            el.tagName === "INPUT" ||
            el.tagName === "SELECT" ||
            el.tagName === "TEXTAREA"
                ? el
                : (el.querySelector(
                      'input, select, textarea, [tabindex="0"]',
                  ) as HTMLElement);
        if (focusable) focusable.focus();
        // Pulse effect
        el.classList.add("error-pulse");
        setTimeout(() => el.classList.remove("error-pulse"), 2000);
    }
};
const prevStep = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    step.value = 1;
};
const handleBackTop = () => {
    if (step.value === 2) {
        prevStep();
    } else {
        localStorage.removeItem("vitalcare_user");
        localStorage.removeItem("social_login_data");
        localStorage.removeItem("vitalcare_signup_draft");
        authStore.user = null;
        // Clear LINE LIFF session to prevent auto-login loop when returning to Login page
        try {
            if (liff && liff.isLoggedIn && liff.isLoggedIn()) {
                liff.logout();
            }
        } catch (e) {}
        router.push("/login");
    }
};
const submitForm = async () => {
    // Step 2 Validations
    if (!formData.value.height) {
        scrollToElement("height_input");
        return;
    }
    if (!formData.value.weight) {
        scrollToElement("weight_input");
        return;
    }
    if (formData.value.goals.length === 0) {
        scrollToElement("goal_select");
        return;
    }
    if (isSubmitting.value) return;
    isSubmitting.value = true;
    try {
        const API_URL = (import.meta as any).env.VITE_API_URL || "/api";
        if (!authStore.user) {
            const userEmail = (
                socialData.value?.email ||
                formData.value.email ||
                (formData.value.phone
                    ? formData.value.phone + "@vitalcare.com"
                    : "")
            ).trim();
            const userPwd = (
                formData.value.password ||
                (socialData.value?.provider
                    ? "social_account"
                    : formData.value.phone || "password123")
            ).trim();
            if (!userEmail) {
                throw new Error("กรุณากรอกข้อมูลให้ครบถ้วน");
            }
            const regRes = await fetch(`${API_URL}/users/register-email`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: userEmail,
                    password: userPwd,
                    fname_th: formData.value.firstName || "",
                }),
            });
            if (regRes.ok) {
                const newUserData = await regRes.json();
                authStore.setUser(newUserData);
                localStorage.setItem(
                    "vitalcare_user",
                    JSON.stringify(newUserData),
                );
            } else {
                const errorData = await regRes.json();
                throw new Error(
                    errorData.error ||
                        "อีเมลนี้ถูกใช้งานแล้ว หรือ ล้มเหลวในการสร้างบัญชี",
                );
            }
        }
        if (authStore.user) {
            let roleDetail1 = "";
            let roleDetail2 = "";
            const finalFaculty =
                formData.value.faculty === "อื่น ๆ"
                    ? formData.value.facultyOther
                    : formData.value.faculty;
            const finalDept =
                formData.value.department === "อื่น ๆ"
                    ? formData.value.departmentOther
                    : formData.value.department;
            if (formData.value.userType === "นักศึกษา") {
                roleDetail1 = formData.value.universityName || "มหาวิทยาลัย";
                roleDetail2 = `${finalFaculty} - ${formData.value.year}`;
            } else if (formData.value.userType === "นักเรียน") {
                roleDetail1 = formData.value.schoolName;
                roleDetail2 = formData.value.grade;
            } else if (formData.value.userType === "บุคลากรโรงพยาบาล") {
                roleDetail1 = formData.value.department;
                roleDetail2 = formData.value.profession;
            } else if (formData.value.userType === "บุคลากรมหาวิทยาลัย") {
                roleDetail1 = finalDept;
            }
            const payload: Record<string, any> = {
                fname_th: formData.value.firstName,
                lname_th: formData.value.lastName,
                nickname: formData.value.nickname,
                email: formData.value.email,
                phone: formData.value.phone,
                birth_date: formData.value.dob,
                gender: formData.value.gender,
                role_type: formData.value.userType,
                id_code: formData.value.studentId || formData.value.empId,
                role_detail_1: roleDetail1,
                role_detail_2: roleDetail2,
                weight: formData.value.weight
                    ? parseFloat(formData.value.weight)
                    : null,
                height: formData.value.height
                    ? parseFloat(formData.value.height)
                    : null,
                main_goal:
                    formData.value.goals.length > 0
                        ? formData.value.goals[0]
                        : null,
                underlying_disease: formData.value.underlying_disease,
            };
            const patchRes = await fetch(
                `${API_URL}/users/${authStore.user.id}/profile`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                        "x-user-id": String(authStore.user.id),
                    },
                    body: JSON.stringify(payload),
                },
            );
            if (patchRes.ok) {
                const updatedUser = await patchRes.json();
                authStore.setUser(updatedUser);
                localStorage.setItem(
                    "vitalcare_user",
                    JSON.stringify(updatedUser),
                );
            }
            if (formData.value.weight && formData.value.height) {
                // คำนวณอายุจาก dob ที่กรอกใน step 1
                let realAge: number | null = null;
                if (formData.value.dob) {
                    const birth = new Date(formData.value.dob);
                    const today = new Date();
                    let a = today.getFullYear() - birth.getFullYear();
                    const m = today.getMonth() - birth.getMonth();
                    if (m < 0 || (m === 0 && today.getDate() < birth.getDate()))
                        a--;
                    realAge = a >= 0 ? a : null;
                }
                const tanitaPayload = {
                    user_id: authStore.user.id,
                    recorded_at: new Date().toISOString(),
                    age: realAge,
                    height: formData.value.height
                        ? parseFloat(formData.value.height)
                        : null,
                    weight: formData.value.weight
                        ? parseFloat(formData.value.weight)
                        : null,
                    waist_cm: formData.value.waist
                        ? parseFloat(formData.value.waist)
                        : null,
                    body_type: formData.value.bodyType || null,
                    clothes_weight: formData.value.clothesWeight || null,
                    fat_pc: formData.value.fatPercent || null,
                    fat_mass: formData.value.fatMass || null,
                    ffm: formData.value.ffm || null,
                    muscle_mass: formData.value.muscleMass || null,
                    tbw_mass: formData.value.bodyWaterMass || null,
                    tbw_pc: formData.value.bodyWaterPercent || null,
                    bone_mass: formData.value.boneMass || null,
                    bmr_kj: formData.value.bmrKj || null,
                    bmr_kcal: formData.value.bmrKcal || null,
                    metabolic_age: formData.value.metabolicAge || null,
                    visceral_fat: formData.value.visceralFat || null,
                    bmi: formData.value.bmi || null,
                    ideal_weight: formData.value.idealWeight || null,
                    obesity_degree: formData.value.obesityDegree || null,
                    physique_rating: formData.value.physiqueRating || null,
                };
                await fetch(`${API_URL}/tanita`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(tanitaPayload),
                });
            }
        }
        toast.success("สมัครสมาชิกสำเร็จ ยินดีต้อนรับสู่โปรแกรมของเรา!");
        router.push("/");
    } catch (err: any) {
        toast.error(err.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
        isSubmitting.value = false;
    }
};
const skipStep2 = async () => {
    if (isSubmitting.value) return;
    isSubmitting.value = true;
    try {
        const API_URL = (import.meta as any).env.VITE_API_URL || "/api";
        // Double check validation before skip
        if (
            !formData.value.firstName ||
            !formData.value.lastName ||
            !formData.value.userType ||
            !formData.value.dob ||
            !formData.value.phone
        ) {
            toast.warning("กรุณากรอกข้อมูลพื้นฐานให้ครบถ้วนก่อนข้าม");
            step.value = 1;
            return;
        }
        if (!authStore.user) {
            const userEmail = (
                socialData.value?.email ||
                formData.value.email ||
                (formData.value.phone
                    ? formData.value.phone + "@vitalcare.com"
                    : "")
            ).trim();
            const userPwd = (
                formData.value.password ||
                (socialData.value?.provider
                    ? "social_account"
                    : formData.value.phone || "password123")
            ).trim();
            if (!userEmail) {
                throw new Error("กรุณากรอกข้อมูลให้ครบถ้วน");
            }
            const regRes = await fetch(`${API_URL}/users/register-email`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: userEmail,
                    password: userPwd,
                    fname_th: formData.value.firstName,
                }),
            });
            if (regRes.ok) {
                const newUserData = await regRes.json();
                authStore.setUser(newUserData);
                localStorage.setItem(
                    "vitalcare_user",
                    JSON.stringify(newUserData),
                );
            } else {
                const errorData = await regRes.json();
                throw new Error(
                    errorData.error ||
                        "อีเมลนี้ถูกใช้งานแล้ว หรือ ล้มเหลวในการสร้างบัญชี",
                );
            }
        }
        if (authStore.user) {
            let roleDetail1 = "";
            let roleDetail2 = "";
            const finalFaculty =
                formData.value.faculty === "อื่น ๆ"
                    ? formData.value.facultyOther
                    : formData.value.faculty;
            const finalDept =
                formData.value.department === "อื่น ๆ"
                    ? formData.value.departmentOther
                    : formData.value.department;
            if (formData.value.userType === "นักศึกษา") {
                roleDetail1 = formData.value.universityName || "มหาวิทยาลัย";
                roleDetail2 = `${finalFaculty} - ${formData.value.year}`;
            } else if (formData.value.userType === "นักเรียน") {
                roleDetail1 = formData.value.schoolName;
                roleDetail2 = formData.value.grade;
            } else if (formData.value.userType === "บุคลากรโรงพยาบาล") {
                roleDetail1 = formData.value.department;
                roleDetail2 = formData.value.profession;
            } else if (formData.value.userType === "บุคลากรมหาวิทยาลัย") {
                roleDetail1 = finalDept;
            }
            const payload: Record<string, any> = {
                fname_th: formData.value.firstName,
                lname_th: formData.value.lastName,
                nickname: formData.value.nickname,
                email: formData.value.email,
                phone: formData.value.phone,
                birth_date: formData.value.dob,
                gender: formData.value.gender,
                role_type: formData.value.userType,
                id_code: formData.value.studentId || formData.value.empId,
                role_detail_1: roleDetail1,
                role_detail_2: roleDetail2,
                weight: formData.value.weight
                    ? parseFloat(formData.value.weight)
                    : null,
                height: formData.value.height
                    ? parseFloat(formData.value.height)
                    : null,
                underlying_disease: formData.value.underlying_disease,
                main_goal:
                    formData.value.goals.length > 0
                        ? formData.value.goals[0]
                        : null,
            };
            const patchRes = await fetch(
                `${API_URL}/users/${authStore.user.id}/profile`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                        "x-user-id": String(authStore.user.id),
                    },
                    body: JSON.stringify(payload),
                },
            );
            if (patchRes.ok) {
                const updatedUser = await patchRes.json();
                authStore.setUser(updatedUser);
                localStorage.setItem(
                    "vitalcare_user",
                    JSON.stringify(updatedUser),
                );
            }
        }
        toast.info("คุณทำการสมัครสมาชิกขั้นพื้นฐานและข้ามขั้นตอนเรียบร้อย");
        router.push("/");
    } catch (err: any) {
        toast.error(err.message || "เกิดข้อผิดพลาด");
    } finally {
        isSubmitting.value = false;
    }
};
const getBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
    });
};
const handleFileSelect = async (file: File) => {
    if (!file || !file.type.startsWith("image/")) {
        toast.error("กรุณาอัปโหลดไฟล์รูปภาพเท่านั้น");
        return;
    }
    isAnalyzing.value = true;
    isUploading.value = true;
    errorMsg.value = "";
    startLoadingMessages();
    try {
        const API_URL = (import.meta as any).env.VITE_API_URL || "/api";
        // Read raw file without compression to preserve AI reading quality
        const imageBase64 = await getBase64(file);
        if (!authStore.user?.id) {
            toast.error("กรุณากรอกข้อมูลพื้นฐานในขั้นตอนที่ 1 ก่อนใช้งาน AI");
            isAnalyzing.value = false;
            isUploading.value = false;
            stopLoadingMessages();
            return;
        }
        // Call our backend AI analysis endpoint
        const response = await fetch(`${API_URL}/ai/analyze-tanita`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-client-silent-errors": "1",
            },
            body: JSON.stringify({
                imageBase64: imageBase64,
                userId: authStore.user.id,
            }),
        });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            if (response.status === 422) {
                throw new Error(
                    errData.error ||
                        "รูปภาพที่ส่งมาไม่ใช่ใบตรวจสุขภาพ กรุณาลองใหม่อีกครั้ง หรือกรอกข้อมูลด้วยตนเองครับ",
                );
            }
            if (response.status === 429)
                throw new Error("โควต้า AI ประจำวันเต็มแล้ว กรุณากรอกเอง");
            throw new Error(errData.error || "AI ล้มเหลวในการวิเคราะห์ภาพ");
        }
        const aiData = await response.json();
        // Flatten nested AI response into flatData
        const flatData: Record<string, any> = {};
        const extractFlat = (obj: Record<string, any>) => {
            if (!obj || typeof obj !== "object") return;
            for (const key of Object.keys(obj)) {
                const val = obj[key];
                if (
                    val !== null &&
                    typeof val === "object" &&
                    !Array.isArray(val)
                ) {
                    extractFlat(val);
                } else if (val !== null && val !== undefined) {
                    flatData[key] = val;
                }
            }
        };
        extractFlat(aiData);
        const keyMap: Record<string, string> = {
            height: "height",
            weight: "weight",
            body_type: "bodyType",
            clothes_weight: "clothesWeight",
            fat_pc: "fatPercent",
            fat_mass: "fatMass",
            tbw_mass: "bodyWaterMass",
            tbw_pc: "bodyWaterPercent",
            bone_mass: "boneMass",
            bmr_kj: "bmrKj",
            bmr_kcal: "bmrKcal",
            metabolic_age: "metabolicAge",
            visceral_fat: "visceralFat",
            bmi: "bmi",
            ideal_weight: "idealWeight",
            obesity_degree: "obesityDegree",
            physique_rating: "physiqueRating",
            muscle_mass: "muscleMass",
            ffm: "ffm",
        };
        Object.keys(flatData).forEach((aiKey) => {
            const formKey = keyMap[aiKey] || aiKey;
            if (
                formKey in formData.value &&
                flatData[aiKey] !== null &&
                flatData[aiKey] !== ""
            ) {
                const val = flatData[aiKey];
                if (formKey === "gender") {
                    const lowVal = String(val).toLowerCase();
                    if (lowVal.includes("male") || lowVal.includes("ชาย"))
                        formData.value.gender = "male";
                    else if (
                        lowVal.includes("female") ||
                        lowVal.includes("หญิง")
                    )
                        formData.value.gender = "female";
                    else formData.value.gender = "other";
                } else if (
                    formKey === "bodyType" ||
                    formKey === "physiqueRating"
                ) {
                    (formData.value as any)[formKey] =
                        typeof val === "string" ? val : String(val);
                } else {
                    (formData.value as any)[formKey] =
                        typeof val === "string" ? parseFloat(val) : val;
                }
            }
        });
        toast.success(
            langStore.locale === 'th' ? "AI วิเคราะห์และกรอกข้อมูลให้คุณแล้ว! กรุณาตรวจสอบความถูกต้อง" : "AI has analyzed and filled out the data for you! Please verify.",
        );
    } catch (err: any) {
        const isInvalidImage =
            err.message && (err.message.includes("ไม่ใช่ใบตรวจสุขภาพ") || err.message.includes("not a health check receipt"));
        swal.fire({
            icon: isInvalidImage ? "error" : "warning",
            title: isInvalidImage
                ? (langStore.locale === 'th' ? "รูปภาพไม่ถูกต้อง" : "Invalid Image")
                : (langStore.locale === 'th' ? "AI ไม่สามารถระบุข้อมูลจากรูปภาพ" : "AI cannot extract data from the image"),
            text: err.message || (langStore.locale === 'th' ? "กรุณากรอกข้อมูลด้วยตนเอง" : "Please enter data manually"),
            confirmButtonText: langStore.locale === 'th' ? "ตกลง" : "OK",
            confirmButtonColor: "#356768",
        });
    } finally {
        isAnalyzing.value = false;
        isUploading.value = false;
        stopLoadingMessages();
    }
};
const handleImageUpload = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) handleFileSelect(file);
};
const isDragging = ref(false);
const handleDrop = (e: DragEvent) => {
    isDragging.value = false;
    const file = e.dataTransfer?.files[0];
    if (file) handleFileSelect(file);
};
const handlePaste = (e: ClipboardEvent) => {
    const item = e.clipboardData?.items[0];
    if (item?.type.indexOf("image") !== -1) {
        const file = item?.getAsFile();
        if (file) handleFileSelect(file);
    }
};
</script>
<template>
    <div class="signup-wrapper">
        <div class="bg-shape shape1"></div>
        <div class="bg-shape shape2"></div>
        <div class="signup-container">
            <div class="header-top">
                <button
                    type="button"
                    class="back-icon-btn"
                    @click="handleBackTop"
                >
                    <svg
                        width="28"
                        height="28"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <path d="M15 18l-6-6 6-6" />
                    </svg>
                </button>
            </div>
            <div class="header">
                <h1>{{ langStore.locale === 'th' ? 'สร้างบัญชีใหม่' : 'Create New Account' }}</h1>
                <div class="stepper">
                    <div
                        class="step-indicator"
                        :class="{ active: step === 1, completed: step === 2 }"
                    >
                        1
                    </div>
                    <div class="step-line"></div>
                    <div class="step-indicator" :class="{ active: step === 2 }">
                        2
                    </div>
                </div>
                <p class="step-title" v-if="step === 1">
                    {{ langStore.locale === 'th' ? 'ขั้นตอน 1: ข้อมูลส่วนตัวพื้นฐาน' : 'Step 1: Basic Personal Info' }}
                </p>
                <p class="step-title" v-if="step === 2">
                    {{ langStore.locale === 'th' ? 'ขั้นตอน 2: ข้อมูลสุขภาพ' : 'Step 2: Health Info' }}
                </p>
            </div>
            <form
                v-if="step === 1"
                @submit.prevent="nextStep"
                class="form-content fade-in"
            >
                <div v-if="socialData?.provider" class="provider-info-box">
                    {{ langStore.locale === 'th' ? 'กำลังสมัครสมาชิกบัญชีผู้ใช้ผ่าน' : 'Signing up via' }} {{ socialData.provider }}
                </div>
                <h3 class="section-title mt-4">{{ langStore.locale === 'th' ? 'ข้อมูลส่วนตัว' : 'Personal Information' }}</h3>
                <div class="grid-2">
                    <div class="premium-input-group">
                        <input
                            id="fname_input"
                            type="text"
                            v-model="formData.firstName"
                            placeholder=" "
                            required
                        />
                        <label>{{ langStore.locale === 'th' ? 'ชื่อจริง' : 'First Name' }}</label>
                    </div>
                    <div class="premium-input-group">
                        <input
                            id="lname_input"
                            type="text"
                            v-model="formData.lastName"
                            placeholder=" "
                            required
                        />
                        <label>{{ langStore.locale === 'th' ? 'นามสกุล' : 'Last Name' }}</label>
                    </div>
                </div>
                <div class="grid-2">
                    <div class="premium-input-group">
                        <input
                            type="text"
                            v-model="formData.nickname"
                            placeholder=" "
                        />
                        <label>{{ langStore.locale === 'th' ? 'ชื่อเล่น' : 'Nickname' }}</label>
                    </div>
                    <CustomSelect
                        id="gender_select"
                        v-model="formData.gender"
                        :options="genderOptions"
                        :label="langStore.locale === 'th' ? 'เพศ' : 'Gender'"
                        :required="true"
                    />
                </div>
                <div class="grid-2">
                    <div class="premium-input-group">
                        <input
                            id="dob_input"
                            type="date"
                            v-model="formData.dob"
                            required
                            class="date-input"
                            placeholder=" "
                        />
                        <label>{{ langStore.locale === 'th' ? 'วันเดือนปีเกิด พ.ศ.' : 'Date of Birth' }}</label>
                    </div>
                    <div class="premium-input-group">
                        <input
                            id="phone_input"
                            type="tel"
                            v-model="formData.phone"
                            placeholder=" "
                            required
                            maxlength="12"
                        />
                        <label>{{ langStore.locale === 'th' ? 'เบอร์โทรศัพท์' : 'Phone Number' }}</label>
                        <svg
                            class="trailing-icon"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <path
                                d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
                            />
                        </svg>
                    </div>
                </div>
                <!-- เพิ่มส่วนโรคประจำตัว -->
                <h3 class="section-title mt-4">{{ langStore.locale === 'th' ? 'ข้อมูลสุขภาพเพิ่มเติม' : 'Additional Health Info' }}</h3>
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2"
                        >{{ langStore.locale === 'th' ? 'คุณมีโรคประจำตัวหรือไม่?' : 'Do you have any underlying diseases?' }}</label
                    >
                    <div class="flex gap-4 mb-3">
                        <button
                            type="button"
                            class="choice-btn px-6 py-2 rounded-lg border-2 transition-all font-medium flex-1 text-center"
                            :class="
                                hasDisease === 'no'
                                    ? 'bg-orange-500 text-white border-orange-500'
                                    : 'bg-white text-gray-600 border-gray-200'
                            "
                            @click="
                                hasDisease = 'no';
                                formData.underlying_disease =
                                    'ไม่มีโรคประจำตัว';
                            "
                        >
                            {{ langStore.locale === 'th' ? 'ไม่มี' : 'No' }}
                        </button>
                        <button
                            type="button"
                            class="choice-btn px-6 py-2 rounded-lg border-2 transition-all font-medium flex-1 text-center"
                            :class="
                                hasDisease === 'yes'
                                    ? 'bg-orange-500 text-white border-orange-500'
                                    : 'bg-white text-gray-600 border-gray-200'
                            "
                            @click="
                                hasDisease = 'yes';
                                if (
                                    formData.underlying_disease ===
                                    'ไม่มีโรคประจำตัว'
                                )
                                    formData.underlying_disease = '';
                            "
                        >
                            {{ langStore.locale === 'th' ? 'มี' : 'Yes' }}
                        </button>
                    </div>
                    <transition name="slide-fade">
                        <div
                            v-if="hasDisease === 'yes'"
                            class="premium-input-group mt-3"
                        >
                            <input
                                id="disease_input"
                                type="text"
                                v-model="formData.underlying_disease"
                                placeholder=" "
                                required
                            />
                            <label>{{ langStore.locale === 'th' ? 'ระบุโรคประจำตัว' : 'Specify underlying disease' }}</label>
                        </div>
                    </transition>
                </div>
                <h3 class="section-title mt-4">{{ langStore.locale === 'th' ? 'สังกัดระดับผู้ใช้' : 'User Affiliation' }}</h3>
                <CustomSelect
                    id="usertype_select"
                    v-model="formData.userType"
                    :options="userTypeOptions"
                    :label="langStore.locale === 'th' ? 'ประเภทผู้ใช้' : 'User Type'"
                    :required="true"
                />
                <transition name="slide-fade">
                    <div
                        v-if="formData.userType === 'นักศึกษา'"
                        class="dynamic-group"
                    >
                        <div class="premium-input-group">
                            <input
                                id="uni_input"
                                type="text"
                                v-model="formData.universityName"
                                placeholder=" "
                                required
                            />
                            <label>{{ langStore.locale === 'th' ? 'ชื่อมหาวิทยาลัย' : 'University Name' }}</label>
                        </div>
                        <CustomSelect
                            id="faculty_select"
                            v-model="formData.faculty"
                            :options="facultiesOptions"
                            :label="langStore.locale === 'th' ? 'คณะ / สำนักวิชา' : 'Faculty / Institute'"
                            :required="true"
                        />
                        <div
                            class="premium-input-group"
                            v-if="formData.faculty === 'อื่น ๆ'"
                        >
                            <input
                                id="faculty_other_input"
                                type="text"
                                v-model="formData.facultyOther"
                                placeholder=" "
                                required
                            />
                            <label>{{ langStore.locale === 'th' ? 'โปรดระบุคณะ / สำนักวิชา' : 'Please specify Faculty / Institute' }}</label>
                        </div>
                        <div class="grid-2">
                            <CustomSelect
                                id="year_select"
                                v-model="formData.year"
                                :options="yearOptions"
                                :label="langStore.locale === 'th' ? 'ปีการศึกษา' : 'Year of Study'"
                                :required="true"
                            />
                            <div class="premium-input-group">
                                <input
                                    type="text"
                                    v-model="formData.studentId"
                                    placeholder=" "
                                />
                                <label>{{ langStore.locale === 'th' ? 'รหัสนักศึกษา' : 'Student ID' }}</label>
                            </div>
                        </div>
                    </div>
                </transition>
                <transition name="slide-fade">
                    <div
                        v-if="formData.userType === 'นักเรียน'"
                        class="dynamic-group"
                    >
                        <div class="premium-input-group">
                            <input
                                id="school_input"
                                type="text"
                                v-model="formData.schoolName"
                                placeholder=" "
                                required
                            />
                            <label>{{ langStore.locale === 'th' ? 'ชื่อโรงเรียน' : 'School Name' }}</label>
                        </div>
                        <CustomSelect
                            id="grade_select"
                            v-model="formData.grade"
                            :options="gradeOptions"
                            :label="langStore.locale === 'th' ? 'ระดับชั้น' : 'Grade Level'"
                            :required="true"
                        />
                    </div>
                </transition>
                <transition name="slide-fade">
                    <div
                        v-if="formData.userType === 'บุคลากรโรงพยาบาล'"
                        class="dynamic-group"
                    >
                        <div class="premium-input-group">
                            <input
                                type="text"
                                v-model="formData.empId"
                                placeholder=" "
                            />
                            <label>{{ langStore.locale === 'th' ? 'รหัสพนักงาน' : 'Employee ID' }}</label>
                        </div>
                        <div class="premium-input-group">
                            <input
                                id="dept_input"
                                type="text"
                                v-model="formData.department"
                                placeholder=" "
                                required
                            />
                            <label>{{ langStore.locale === 'th' ? 'แผนก / สังกัด' : 'Department' }}</label>
                        </div>
                        <div class="premium-input-group">
                            <input
                                id="profession_input"
                                type="text"
                                v-model="formData.profession"
                                placeholder=" "
                                required
                            />
                            <label>{{ langStore.locale === 'th' ? 'วิชาชีพ/ตำเเหน่ง' : 'Profession/Position' }}</label>
                        </div>
                    </div>
                </transition>
                <transition name="slide-fade">
                    <div
                        v-if="formData.userType === 'บุคลากรมหาวิทยาลัย'"
                        class="dynamic-group"
                    >
                        <div class="premium-input-group">
                            <input
                                type="text"
                                v-model="formData.empId"
                                placeholder=" "
                            />
                            <label>{{ langStore.locale === 'th' ? 'รหัสพนักงาน' : 'Employee ID' }}</label>
                        </div>
                        <CustomSelect
                            id="dept_select"
                            v-model="formData.department"
                            :options="facultiesOptions"
                            :label="langStore.locale === 'th' ? 'สังกัดหน่วยงาน / สำนักวิชา' : 'Department / Institute'"
                            :required="true"
                        />
                        <div
                            class="premium-input-group mt-3"
                            v-if="formData.department === 'อื่น ๆ'"
                        >
                            <input
                                id="dept_other_input"
                                type="text"
                                v-model="formData.departmentOther"
                                placeholder=" "
                            />
                            <label>{{ langStore.locale === 'th' ? 'โปรดระบุสังกัดหน่วยงาน' : 'Please specify Department' }}</label>
                        </div>
                    </div>
                </transition>
                <div class="bot-row mt-5">
                    <button
                        type="submit"
                        class="btn-primary-gradient"
                        :disabled="isSubmitting"
                    >
                        <template v-if="isSubmitting">
                            <span class="loader small mr-2"></span>
                            {{ langStore.locale === 'th' ? 'กำลังประมวลผล...' : 'Processing...' }}
                        </template>
                        <template v-else>
                            {{ langStore.locale === 'th' ? 'ขั้นตอนต่อไป' : 'Next Step' }}
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            >
                                <path d="M5 12h14" />
                                <path d="m12 5 7 7-7 7" />
                            </svg>
                        </template>
                    </button>
                </div>
            </form>
            <form
                v-if="step === 2"
                @submit.prevent="submitForm"
                class="form-content fade-in"
            >
                <!-- Skip button moved to top -->
                <div class="skip-section mb-2">
                    <button
                        type="button"
                        class="btn-secondary"
                        style="width: 100%"
                        @click="skipStep2"
                        :disabled="isSubmitting"
                    >
                        <span
                            v-if="isSubmitting"
                            class="loader small mr-2"
                        ></span>
                        {{ langStore.locale === 'th' ? 'ข้ามขั้นตอนนี้เพื่อเปิดใช้งานทันที' : 'Skip this step and activate now' }}
                    </button>
                </div>
                <div class="mode-selector">
                    <label
                        class="mode-card"
                        :class="{ active: formData.inputMethod === 'manual' }"
                    >
                        <input
                            type="radio"
                            value="manual"
                            v-model="formData.inputMethod"
                        />
                        <div class="mode-content">
                            <svg
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            >
                                <path d="M12 20h9" />
                                <path
                                    d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"
                                />
                            </svg>
                            <span>{{ langStore.locale === 'th' ? 'กรอกข้อมูลเอง' : 'Manual Entry' }}</span>
                        </div>
                    </label>
                    <label
                        class="mode-card"
                        :class="{ active: formData.inputMethod === 'ai' }"
                    >
                        <input
                            type="radio"
                            value="ai"
                            v-model="formData.inputMethod"
                        />
                        <div class="mode-content">
                            <svg
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            >
                                <rect
                                    width="18"
                                    height="18"
                                    x="3"
                                    y="3"
                                    rx="2"
                                    ry="2"
                                />
                                <circle cx="9" cy="9" r="2" />
                                <path
                                    d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"
                                />
                            </svg>
                            <span>{{ langStore.locale === 'th' ? 'AI ช่วยอ่านจากรูป' : 'AI Extraction' }}</span>
                        </div>
                    </label>
                </div>
                <transition name="slide-fade">
                    <div
                        v-if="formData.inputMethod === 'ai'"
                        class="ai-upload-box"
                    >
                        <div v-if="isUploading" class="ai-loading">
                            <div class="spinner"></div>
                            <p>{{ currentLoadingMessage }}</p>
                        </div>
                        <div v-else>
                            <input
                                type="file"
                                accept="image/*"
                                id="ai-upload"
                                @change="handleImageUpload"
                            />
                            <label
                                for="ai-upload"
                                class="upload-trigger"
                                :class="{ dragging: isDragging }"
                                @dragover.prevent="isDragging = true"
                                @dragleave.prevent="isDragging = false"
                                @drop.prevent="handleDrop"
                                @paste="handlePaste"
                                tabindex="0"
                            >
                                <svg
                                    width="40"
                                    height="40"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="1.5"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                >
                                    <path
                                        d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
                                    />
                                    <polyline points="17 8 12 3 7 8" />
                                    <line x1="12" x2="12" y1="3" y2="15" />
                                </svg>
                                <span class="upload-main-text">{{
                                    isDragging
                                        ? (langStore.locale === 'th' ? "วางรูปภาพที่นี่" : "Drop image here")
                                        : (langStore.locale === 'th' ? "ถ่ายภาพ, อัปโหลด หรือวางรูป (Paste)" : "Capture, Upload, or Paste Image")
                                }}</span>
                                <span class="upload-sub-text"
                                    >{{ langStore.locale === 'th' ? 'รองรับการลากวาง (Drag & Drop) และการคัดลอกวาง' : 'Supports Drag & Drop and Copy & Paste' }}</span
                                >
                            </label>
                        </div>
                    </div>
                </transition>
                <div class="form-scrollable-area">
                    <h3 class="section-title mt-4">{{ langStore.locale === 'th' ? 'ข้อมูลภาพรวม' : 'Overview Data' }}</h3>
                    <div class="grid-3">
                        <div class="premium-input-group">
                            <input
                                id="height_input"
                                type="number"
                                v-model="formData.height"
                                placeholder=" "
                                required
                            />
                            <label>{{ langStore.locale === 'th' ? 'ส่วนสูง (cm)' : 'Height (cm)' }}</label>
                        </div>
                        <div class="premium-input-group">
                            <input
                                id="weight_input"
                                type="number"
                                step="0.1"
                                v-model="formData.weight"
                                placeholder=" "
                                required
                            />
                            <label>{{ langStore.locale === 'th' ? 'น้ำหนัก (kg)' : 'Weight (kg)' }}</label>
                        </div>
                        <div class="premium-input-group">
                            <input
                                id="waist_input"
                                type="number"
                                step="0.1"
                                v-model="formData.waist"
                                placeholder=" "
                            />
                            <label>{{ langStore.locale === 'th' ? 'รอบเอว (cm)' : 'Waist (cm)' }}</label>
                        </div>
                        <div class="premium-input-group">
                            <input
                                type="text"
                                v-model="formData.bodyType"
                                readonly
                                class="readonly"
                                placeholder=" "
                            />
                            <label>{{ langStore.locale === 'th' ? 'รูปร่างมาตรฐาน' : 'Standard Body Type' }}</label>
                        </div>
                    </div>
                    <h3 class="section-title mt-4">
                        {{ langStore.locale === 'th' ? 'องค์ประกอบร่างกาย (Body Composition)' : 'Body Composition' }}
                    </h3>
                    <div class="grid-2">
                        <div class="premium-input-group small">
                            <input
                                type="number"
                                step="0.1"
                                v-model="formData.fatPercent"
                                placeholder=" "
                            /><label>{{ langStore.locale === 'th' ? 'ไขมัน (%)' : 'Fat (%)' }}</label>
                        </div>
                        <div class="premium-input-group small">
                            <input
                                type="number"
                                step="0.1"
                                v-model="formData.fatMass"
                                placeholder=" "
                            /><label>{{ langStore.locale === 'th' ? 'มวลไขมัน (kg)' : 'Fat Mass (kg)' }}</label>
                        </div>
                        <div class="premium-input-group small">
                            <input
                                type="number"
                                step="0.1"
                                v-model="formData.ffm"
                                placeholder=" "
                            /><label>{{ langStore.locale === 'th' ? 'มวลไร้ไขมัน FFM (kg)' : 'Fat-Free Mass (kg)' }}</label>
                        </div>
                        <div class="premium-input-group small">
                            <input
                                type="number"
                                step="0.1"
                                v-model="formData.muscleMass"
                                placeholder=" "
                            /><label>{{ langStore.locale === 'th' ? 'มวลกล้ามเนื้อ (kg)' : 'Muscle Mass (kg)' }}</label>
                        </div>
                        <div class="premium-input-group small">
                            <input
                                type="number"
                                step="0.1"
                                v-model="formData.bodyWaterMass"
                                placeholder=" "
                            /><label>{{ langStore.locale === 'th' ? 'มวลน้ำ (kg)' : 'Total Body Water (kg)' }}</label>
                        </div>
                        <div class="premium-input-group small">
                            <input
                                type="number"
                                step="0.1"
                                v-model="formData.bodyWaterPercent"
                                placeholder=" "
                            /><label>{{ langStore.locale === 'th' ? 'น้ำในร่างกาย (%)' : 'Total Body Water (%)' }}</label>
                        </div>
                        <div class="premium-input-group small">
                            <input
                                type="number"
                                step="0.1"
                                v-model="formData.boneMass"
                                placeholder=" "
                            /><label>{{ langStore.locale === 'th' ? 'มวลกระดูก (kg)' : 'Bone Mass (kg)' }}</label>
                        </div>
                        <div class="premium-input-group small">
                            <input
                                type="number"
                                step="0.1"
                                v-model="formData.clothesWeight"
                                placeholder=" "
                            /><label>{{ langStore.locale === 'th' ? 'น้ำหนักเสื้อผ้า (kg)' : 'Clothes Weight (kg)' }}</label>
                        </div>
                    </div>
                    <h3 class="section-title mt-4">
                        {{ langStore.locale === 'th' ? 'ระบบเผาผลาญ & ดัชนีสุขภาพ' : 'Metabolism & Health Index' }}
                    </h3>
                    <div class="grid-2">
                        <div class="premium-input-group small">
                            <input
                                type="number"
                                v-model="formData.bmrKj"
                                placeholder=" "
                            /><label>BMR (kJ)</label>
                        </div>
                        <div class="premium-input-group small">
                            <input
                                type="number"
                                v-model="formData.bmrKcal"
                                placeholder=" "
                            /><label>BMR (kcal)</label>
                        </div>
                        <div class="premium-input-group small">
                            <input
                                type="number"
                                v-model="formData.metabolicAge"
                                placeholder=" "
                            /><label>{{ langStore.locale === 'th' ? 'อายุเมตาบอลิก (ปี)' : 'Metabolic Age (years)' }}</label>
                        </div>
                        <div class="premium-input-group small">
                            <input
                                type="number"
                                step="0.1"
                                v-model="formData.visceralFat"
                                placeholder=" "
                            /><label>{{ langStore.locale === 'th' ? 'ไขมันช่องท้อง' : 'Visceral Fat' }}</label>
                        </div>
                        <div class="premium-input-group small">
                            <input
                                type="number"
                                step="0.1"
                                v-model="formData.bmi"
                                placeholder=" "
                            /><label>{{ langStore.locale === 'th' ? 'ค่าดัชนีมวลกาย (BMI)' : 'Body Mass Index (BMI)' }}</label>
                        </div>
                        <div class="premium-input-group small">
                            <input
                                type="number"
                                step="0.1"
                                v-model="formData.idealWeight"
                                placeholder=" "
                            /><label>{{ langStore.locale === 'th' ? 'น้ำหนักเหมาะสม (kg)' : 'Ideal Weight (kg)' }}</label>
                        </div>
                        <div class="premium-input-group small">
                            <input
                                type="number"
                                step="0.1"
                                v-model="formData.obesityDegree"
                                placeholder=" "
                            /><label>{{ langStore.locale === 'th' ? 'ระดับความอ้วน (%)' : 'Obesity Degree (%)' }}</label>
                        </div>
                        <div class="premium-input-group small">
                            <input
                                type="text"
                                v-model="formData.physiqueRating"
                                placeholder=" "
                            /><label>Physique Rating</label>
                        </div>
                    </div>
                    <h3 class="section-title mt-4">
                        {{ langStore.locale === 'th' ? 'เป้าหมายที่ต้องการรับการดูแล' : 'Care Goals' }}
                    </h3>
                    <div id="goal_select" class="goals-grid">
                        <label
                            v-for="goal in goalsOptions"
                            :key="goal.value"
                            class="luxury-checkbox-card"
                        >
                            <input
                                type="checkbox"
                                :value="goal.value"
                                v-model="formData.goals"
                            />
                            <div class="luxury-content">
                                <div class="check-circle">
                                    <svg
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="3"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                    >
                                        <path d="M20 6 9 17l-5-5" />
                                    </svg>
                                </div>
                                <span>{{ goal.label }}</span>
                            </div>
                        </label>
                    </div>
                </div>
                <div class="actions mt-5">
                    <button
                        type="submit"
                        class="btn-primary-gradient"
                        :disabled="isSubmitting"
                    >
                        <template v-if="isSubmitting">
                            <span class="loader small mr-2"></span>
                            {{ langStore.locale === 'th' ? 'กำลังบันทึกข้อมูล...' : 'Saving...' }}
                        </template>
                        <template v-else>
                            {{ langStore.locale === 'th' ? 'ยืนยันข้อมูลทั้งหมด และเข้าสู่หน้าหลัก' : 'Confirm and Enter Home Page' }}
                        </template>
                    </button>
                </div>
            </form>
        </div>
    </div>
</template>
<style scoped>
@import url("https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap");
.signup-wrapper {
    --bg-color: #f1f5f9;
    --surface-color: rgba(255, 255, 255, 0.98);
    --border-color: #cbd5e1;
    --primary-color: #f05a23;
    --primary-color-hover: #d84b1a;
    --primary-light: #f1f5f9;
    --accent-color: #356768;
    --accent-light: #e8f0f0;
    --text-main: #0f172a;
    --text-muted: #64748b;
    --glass-blur: 24px;
    position: relative;
    min-height: 100vh;
    width: 100vw;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 30px 20px;
    background-color: var(--bg-color);
    font-family: "Sarabun", sans-serif;
    overflow-y: auto;
}
.bg-shape {
    position: fixed;
    border-radius: 50%;
    filter: blur(100px);
    z-index: 0;
    opacity: 0.6;
    animation: pulseGradient 12s infinite alternate cubic-bezier(0.4, 0, 0.2, 1);
}
.shape1 {
    width: 450px;
    height: 450px;
    background: radial-gradient(
        circle,
        var(--primary-color) 0%,
        transparent 60%
    );
    top: -100px;
    left: -150px;
}
.shape2 {
    width: 400px;
    height: 400px;
    background: radial-gradient(
        circle,
        var(--accent-color) 0%,
        transparent 60%
    );
    bottom: -100px;
    right: -150px;
}
.signup-container {
    width: 100%;
    max-width: 650px;
    margin: auto;
    background: var(--surface-color);
    backdrop-filter: blur(var(--glass-blur));
    -webkit-backdrop-filter: blur(var(--glass-blur));
    border: 1px solid rgba(255, 255, 255, 0.7);
    border-radius: 24px;
    padding: 40px 32px;
    z-index: 1;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.1);
    position: relative;
}
.header-top {
    display: flex;
    align-items: center;
    margin-bottom: 8px;
}
.back-icon-btn {
    background: transparent;
    border: none;
    color: var(--text-main);
    cursor: pointer;
    padding: 8px;
    margin-left: -8px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: background 0.3s;
}
.back-icon-btn:hover {
    background: var(--primary-light);
    color: var(--primary-color);
}
.header {
    text-align: center;
    margin-bottom: 30px;
}
.header h1 {
    font-size: 26px;
    color: var(--text-main);
    margin: 0 0 16px;
    font-weight: 700;
}
.stepper {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-bottom: 12px;
}
.step-indicator {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f1f5f9;
    color: #94a3b8;
    font-weight: 600;
    font-size: 14px;
    transition: all 0.4s ease;
}
.step-indicator.active {
    background: var(--primary-color);
    color: white;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
.step-indicator.completed {
    background: var(--accent-color);
    color: white;
}
.step-line {
    height: 2px;
    width: 40px;
    background: #e2e8f0;
}
.step-title {
    color: var(--primary-color);
    font-weight: 500;
    margin: 0;
    font-size: 15px;
}
.section-title {
    font-size: 17px;
    color: var(--primary-color);
    margin: 0 0 16px;
    padding-bottom: 8px;
    border-bottom: 2px solid var(--primary-light);
    font-weight: 600;
}
.mt-4 {
    margin-top: 24px;
}
.mt-5 {
    margin-top: 36px;
}
.mt-2 {
    margin-top: 12px;
}
.form-content {
    display: flex;
    flex-direction: column;
    gap: 18px;
}
.grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
}
.grid-3 {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 16px;
}
.premium-input-group {
    position: relative;
    background: #fff;
    border-radius: 12px;
}
.premium-input-group input,
.premium-input-group select {
    width: 100%;
    padding: 22px 16px 10px;
    border: 1px solid var(--border-color);
    border-radius: 12px;
    font-size: 15px;
    font-family: inherit;
    color: var(--text-main);
    background: transparent;
    transition: all 0.3s ease-in-out;
    outline: none;
    appearance: none;
    -webkit-appearance: none;
}
.premium-input-group.small input {
    padding: 18px 12px 6px;
    font-size: 14px;
}
.premium-input-group label {
    position: absolute;
    top: 16px;
    left: 16px;
    font-size: 15px;
    color: var(--text-muted);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    pointer-events: none;
}
.premium-input-group.small label {
    left: 12px;
    top: 12px;
    font-size: 14px;
}
.premium-input-group input:not(:placeholder-shown),
.premium-input-group select.selected {
    border-color: var(--border-color);
}
.premium-input-group input:focus,
.premium-input-group select:focus {
    border-color: var(--primary-color);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}
.premium-input-group input:not(:placeholder-shown) ~ label,
.premium-input-group select.selected ~ label {
    top: 6px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
}
.premium-input-group input:focus ~ label,
.premium-input-group select:focus ~ label {
    top: 6px;
    font-size: 11px;
    color: var(--primary-color);
    font-weight: 600;
}
.select-arrow {
    position: absolute;
    right: 16px;
    top: 50%;
    transform: translateY(-50%);
    width: 12px;
    height: 12px;
    border: solid var(--text-muted);
    border-width: 0 2px 2px 0;
    display: inline-block;
    padding: 3px;
    transform: translateY(-70%) rotate(45deg);
    pointer-events: none;
    transition: border-color 0.3s;
}
.premium-input-group select:focus ~ .select-arrow {
    border-color: var(--primary-color);
    transform: translateY(-30%) rotate(225deg);
}
.date-input {
    position: relative;
    min-height: 56px;
    cursor: pointer;
}
.date-input::-webkit-calendar-picker-indicator {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    cursor: pointer;
    opacity: 0.6;
    z-index: 2;
}
.date-input::-webkit-datetime-edit {
    display: flex;
    padding-top: 4px;
}
/* Ensure the field looks like a premium input even when empty */
.date-input:empty::before {
    content: attr(placeholder);
    color: var(--text-muted);
}
.trailing-icon {
    position: absolute;
    right: 16px;
    top: 50%;
    transform: translateY(-50%);
    color: #94a3b8;
    pointer-events: none;
}
.readonly {
    background: #ffffff !important;
    color: #94a3b8 !important;
    border-color: #e2e8f0 !important;
}
.dynamic-group {
    margin-top: 8px;
    padding: 20px;
    border-radius: 16px;
    background: #ffffff;
    border: 1px solid rgba(203, 213, 225, 0.4);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
    display: flex;
    flex-direction: column;
    gap: 16px;
    transition: all 0.3s ease;
}
.mode-selector {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
}
.mode-card {
    position: relative;
    cursor: pointer;
}
.mode-card input {
    display: none;
}
.mode-content {
    padding: 20px;
    border: 2px solid var(--border-color);
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    background: transparent;
    color: var(--text-muted);
    transition: all 0.3s;
    font-weight: 500;
}
.mode-card.active .mode-content {
    border-color: var(--primary-color);
    background: var(--primary-light);
    color: var(--primary-color);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
}
.ai-upload-box {
    margin-top: 8px;
}
.upload-trigger {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    border: 2px dashed rgba(53, 103, 104, 0.5);
    border-radius: 16px;
    background: #ffffff;
    color: var(--accent-color);
    cursor: pointer;
    transition: all 0.3s;
}
.upload-trigger:hover,
.upload-trigger.dragging {
    background: rgba(53, 103, 104, 0.1);
    border-color: var(--accent-color);
    transform: scale(1.02);
}
.upload-trigger.dragging {
    border-style: solid;
}
.upload-main-text {
    font-size: 16px;
    font-weight: 600;
    margin-top: 12px;
}
.upload-sub-text {
    font-size: 13px;
    margin-top: 4px;
    opacity: 0.8;
}
#ai-upload {
    display: none;
}
.ai-loading {
    text-align: center;
    padding: 40px;
    color: var(--primary-color);
}
.spinner {
    width: 40px;
    height: 40px;
    border: 4px solid var(--primary-light);
    border-top-color: var(--primary-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 16px;
}
@keyframes spin {
    100% {
        transform: rotate(360deg);
    }
}
.goals-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
}
.luxury-checkbox-card input {
    display: none;
}
.luxury-content {
    display: flex;
    align-items: center;
    padding: 14px 16px;
    border: 1px solid var(--border-color);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
}
.check-circle {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 1.5px solid #cbd5e1;
    margin-right: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: transparent;
    transition: all 0.2s;
}
.luxury-checkbox-card input:checked + .luxury-content {
    border-color: var(--primary-color);
    background: var(--primary-light);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.08);
}
.luxury-checkbox-card input:checked + .luxury-content .check-circle {
    background: var(--primary-color);
    border-color: var(--primary-color);
    color: white;
}
.luxury-content span {
    font-size: 14.5px;
    font-weight: 500;
    color: var(--text-main);
}
.bot-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    gap: 12px;
}
.double-actions {
    flex-direction: column;
}
.btn-primary-gradient,
.btn-secondary,
.btn-text-cancel {
    border: none;
    cursor: pointer;
    font-family: inherit;
    font-weight: 600;
    transition: all 0.3s;
}
.btn-primary-gradient {
    width: 100%;
    padding: 16px;
    font-size: 16px;
    border-radius: 14px;
    background: linear-gradient(135deg, #f05a23 0%, #d84b1a 100%);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
}
.btn-primary-gradient:hover {
    box-shadow: 0 12px 25px rgba(0, 0, 0, 0.2);
    transform: translateY(-2px);
}
.btn-secondary {
    padding: 14px 20px;
    font-size: 14px;
    border-radius: 12px;
    flex: 1;
    background: #ffffff;
    color: var(--text-main);
    text-align: center;
    border: 1px solid var(--border-color);
}
.btn-secondary:hover {
    background: #f8fafc;
}
.btn-text-cancel {
    padding: 14px;
    background: transparent;
    color: var(--text-muted);
}
.btn-text-cancel:hover {
    color: var(--text-main);
}
.choice-btn {
    cursor: pointer;
    outline: none;
    font-size: 1rem;
}
.choice-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}
.choice-btn:active {
    transform: translateY(0);
}
.slide-fade-enter-active {
    transition: all 0.4s ease-out;
}
.slide-fade-leave-active {
    transition: all 0.2s cubic-bezier(1, 0.5, 0.8, 1);
}
.slide-fade-enter-from,
.slide-fade-leave-to {
    transform: translateY(10px);
    opacity: 0;
}
.fade-in {
    animation: fadeIn 0.5s ease-out forwards;
}
@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(15px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
.error-pulse {
    animation: errorPulse 1.2s ease-in-out;
    border-color: #ef4444 !important;
    box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.2) !important;
}
@keyframes errorPulse {
    0% {
        transform: scale(1);
    }
    25% {
        transform: scale(1.03);
    }
    50% {
        transform: scale(1);
    }
    75% {
        transform: scale(1.03);
    }
    100% {
        transform: scale(1);
    }
}
@media (max-width: 600px) {
    .signup-wrapper {
        padding: 0;
        background-color: var(--surface-color);
        align-items: flex-start;
        overflow-x: hidden;
    }
    .bg-shape {
        display: none;
    }
    .signup-container {
        padding: 20px 16px 120px;
        border-radius: 0;
        margin-top: 0;
        border: none;
        box-shadow: none;
        min-height: 100vh;
        width: 100%;
    }
    .grid-2,
    .grid-3,
    .goals-grid {
        grid-template-columns: 1fr;
    }
    .bot-row {
        flex-direction: column-reverse;
    }
    .btn-secondary {
        width: 100%;
    }
}
</style>
<style>
.custom-select-options li:hover,
.custom-select-options li.selected,
.custom-select-options li.active,
ul[class*="select"] li:hover,
ul[class*="select"] li.selected,
ul[class*="select"] li.active {
    background-color: #f1f5f9 !important;
    color: #0f172a !important;
}
</style>

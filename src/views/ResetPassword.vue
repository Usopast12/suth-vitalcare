<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import { User, Lock, Loader2, CheckCircle2, ArrowLeft, HelpCircle } from "lucide-vue-next";
import Swal from 'sweetalert2';
import MainFooter from '../components/MainFooter.vue';
import { langStore } from '../store/lang';
const router = useRouter();
const route = useRoute();
const API_URL = import.meta.env.VITE_API_URL || '/api';
const identifier = ref(""); // maps to email or phone
const token = ref("");
const newPassword = ref("");
const confirmPassword = ref("");
const isSubmitting = ref(false);
const step = ref<"forgot" | "reset" | "success">("forgot");
onMounted(() => {
  const queryToken = route.query.token as string;
  if (queryToken) {
    token.value = queryToken;
    step.value = "reset";
  }
});
const isForgotValid = computed(() => {
  return identifier.value.trim().length > 0;
});
const handleForgotPassword = async () => {
  if (!isForgotValid.value) return;
  isSubmitting.value = true;
  try {
    const res = await fetch(`${API_URL}/users/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: identifier.value }) // API likely takes email still
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "ไม่พบข้อมูลผู้ใช้ในระบบ");
    Swal.fire({
      icon: 'success',
      title: langStore.locale === 'th' ? 'ส่งลิงก์สำเร็จ' : 'Link Sent Successfully',
      text: langStore.locale === 'th' ? 'ระบบได้ส่งรหัสสำหรับรีเซ็ตรหัสผ่านไปให้คุณแล้ว' : 'We have sent you a password reset code.',
      confirmButtonColor: '#f05a23',
      timer: 3000
    });
    // For demo purposes, if the API returns a debug token we automatically jump to the next step
    if (data.debug_token) {
        token.value = data.debug_token;
        step.value = "reset";
    } else {
        // Since we don't have a real OTP flow in the mock, we assume success means check email
        // Or if testing locally, developer can just enter the new URL
        step.value = "success";
    }
  } catch (error: any) {
    Swal.fire({
      icon: 'error',
      title: langStore.t('error_title'),
      text: error.message,
      confirmButtonColor: '#f05a23'
    });
  } finally {
    isSubmitting.value = false;
  }
};
const handleResetPassword = async () => {
  if (newPassword.value !== confirmPassword.value) {
    Swal.fire({ icon: 'error', title: langStore.locale === 'th' ? 'รหัสผ่านไม่ตรงกัน' : 'Passwords do not match', confirmButtonColor: '#f05a23' });
    return;
  }
  if (newPassword.value.length < 6) {
    Swal.fire({ icon: 'error', title: langStore.locale === 'th' ? 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร' : 'Password must be at least 6 characters long', confirmButtonColor: '#f05a23' });
    return;
  }
  isSubmitting.value = true;
  try {
    const res = await fetch(`${API_URL}/users/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        token: token.value,
        newPassword: newPassword.value
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || (langStore.locale === 'th' ? "เซสชั่นหมดอายุ กรุณาทำรายการใหม่" : "Session expired. Please try again."));
    step.value = "success";
  } catch (error: any) {
    Swal.fire({ icon: 'error', title: langStore.t('error_title'), text: error.message, confirmButtonColor: '#f05a23' });
  } finally {
    isSubmitting.value = false;
  }
};
</script>
<template>
  <div class="reset-page">
    <!-- Mobile Header -->
    <header class="top-nav mobile-only">
      <button @click="step === 'reset' ? step = 'forgot' : router.push('/login')" class="icon-btn">
        <ArrowLeft class="text-primary" />
      </button>
      <h1 class="nav-title">
        <span v-if="step === 'forgot'">{{ langStore.locale === 'th' ? 'กู้คืนบัญชีผู้ใช้' : 'Recover Account' }}</span>
        <span v-if="step === 'reset'">{{ langStore.t('reset_password') }}</span>
        <span v-if="step === 'success'">{{ langStore.t('finish') }}</span>
      </h1>
      <button class="icon-btn">
        <HelpCircle class="text-primary" />
      </button>
    </header>
    <!-- Desktop Header -->
    <header class="desktop-header">
      <div class="header-inner">
        <div class="brand">
          <button @click="step === 'reset' ? step = 'forgot' : router.push('/login')" class="desktop-back-btn group hover:bg-slate-50 transition-colors p-2 rounded-full cursor-pointer flex items-center justify-center">
            <ArrowLeft class="text-primary group-hover:scale-110 transition-transform" />
          </button>
          <img src="/logo.png" alt="Logo" class="mini-logo" />
          <span class="header-title">
            <span v-if="step === 'forgot'">{{ langStore.locale === 'th' ? 'กู้คืนบัญชีผู้ใช้' : 'Recover Account' }}</span>
            <span v-if="step === 'reset'">{{ langStore.t('reset_password') }}</span>
            <span v-if="step === 'success'">{{ langStore.t('finish') }}</span>
          </span>
        </div>
        <a href="#" class="help-link">{{ langStore.locale === 'th' ? 'ต้องการความช่วยเหลือ?' : 'Need Help?' }}</a>
      </div>
    </header>
    <div class="content-wrapper">
      <div class="content-body">
        <!-- Step 1: Forgot -->
        <div v-if="step === 'forgot'" class="form-container">
          <div class="input-line-group">
            <User class="input-icon" :size="20" />
            <input 
              type="text" 
              v-model="identifier" 
              :placeholder="langStore.t('email_or_phone')" 
              class="input-line" 
            />
          </div>
          <button 
            class="btn-next" 
            :class="{ 'btn-active': isForgotValid }"
            :disabled="!isForgotValid || isSubmitting"
            @click="handleForgotPassword"
          >
            <Loader2 v-if="isSubmitting" class="animate-spin spin-icon" :size="20" />
            <span v-else>{{ langStore.t('next_step') }}</span>
          </button>
          <a href="#" class="change-phone-link">{{ langStore.locale === 'th' ? 'เปลี่ยนหมายเลขโทรศัพท์' : 'Change Phone Number' }}</a>
        </div>
        <!-- Step 2: Reset -->
        <div v-if="step === 'reset'" class="form-container">
          <div class="input-line-group">
            <Lock class="input-icon" :size="20" />
            <input 
              type="password" 
              v-model="newPassword" 
              :placeholder="langStore.t('new_password')" 
              class="input-line" 
            />
          </div>
          <div class="input-line-group mt-4">
            <Lock class="input-icon" :size="20" />
            <input 
              type="password" 
              v-model="confirmPassword" 
              :placeholder="langStore.locale === 'th' ? 'ยืนยันรหัสผ่านใหม่' : 'Confirm New Password'" 
              class="input-line" 
            />
          </div>
          <button 
            class="btn-next btn-active mt-6" 
            :disabled="isSubmitting"
            @click="handleResetPassword"
          >
            <Loader2 v-if="isSubmitting" class="animate-spin spin-icon" :size="20" />
            <span v-else>{{ langStore.locale === 'th' ? 'ยืนยันเปลี่ยนรหัสผ่าน' : 'Confirm Reset Password' }}</span>
          </button>
        </div>
        <!-- Step 3: Success -->
        <div v-if="step === 'success'" class="form-container text-center py-10">
          <div class="success-icon-wrap">
            <CheckCircle2 :size="72" />
          </div>
          <h2 class="success-title">{{ langStore.t('success') }}</h2>
          <p class="success-desc">{{ langStore.locale === 'th' ? 'กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่ของคุณ' : 'Please login with your new password.' }}</p>
          <button class="btn-next btn-active mt-8" @click="router.push('/login')">
            {{ langStore.t('login') }}
          </button>
        </div>
      </div>
    </div>
    <MainFooter />
  </div>
</template>
<style scoped>
.reset-page {
  position: relative;
  min-height: 100svh;
  width: 100vw;
  background-color: #ffffff;
  font-family: 'Sarabun', sans-serif;
  display: flex;
  flex-direction: column;
}
.content-wrapper {
  display: flex;
  flex-direction: column;
  flex: 1;
  width: 100%;
}
.top-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: #ffffff;
  border-bottom: 1px solid #f0f0f0;
}
.mobile-only {
  display: flex;
}
.desktop-header {
  display: none;
}
.icon-btn {
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.text-primary {
  color: #f05a23;
}
.nav-title {
  font-size: 18px;
  font-weight: 500;
  color: #333;
  margin: 0;
}
.content-body {
  flex: 1;
  padding: 24px 20px;
  display: flex;
  flex-direction: column;
}
.form-container {
  display: flex;
  flex-direction: column;
  max-width: 480px;
  width: 100%;
  margin: 0 auto;
}
.input-line-group {
  display: flex;
  align-items: center;
  border-bottom: 1.5px solid #eaeaea;
  padding-bottom: 10px;
  margin-bottom: 20px;
}
.input-icon {
  color: #a0a0a0;
  margin-right: 12px;
}
.input-line {
  flex: 1;
  border: none;
  outline: none;
  font-size: 16px;
  padding: 4px 0;
  color: #333;
  background: transparent;
}
.input-line::placeholder {
  color: #c0c0c0;
}
.btn-next {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 14px;
  border-radius: 4px;
  border: none;
  font-size: 16px;
  font-weight: 500;
  background-color: #e5e5e5;
  color: #a3a3a3;
  transition: all 0.3s ease;
  margin-bottom: 16px;
  margin-top: 4px;
}
.btn-next.btn-active {
  background-color: #f05a23;
  color: #ffffff;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(240, 90, 35, 0.2);
}
.change-phone-link {
  text-align: center;
  color: #3b82f6;
  font-size: 14px;
  text-decoration: none;
  margin-top: 8px;
}
.change-phone-link:hover {
  text-decoration: underline;
}
.mt-4 { margin-top: 16px; }
.mt-6 { margin-top: 24px; }
.mt-8 { margin-top: 32px; }
.text-center { text-align: center; }
.py-10 { padding-top: 40px; padding-bottom: 40px; }
.success-icon-wrap {
  color: #22c55e;
  margin-bottom: 20px;
  display: flex;
  justify-content: center;
}
.success-title {
  font-size: 20px;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
}
.success-desc {
  font-size: 15px;
  color: #666;
}
.spin-icon {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@media (min-width: 768px) {
  .reset-page {
    background-color: #ffffff;
  }
  .mobile-only {
    display: none !important;
  }
  .desktop-header {
    display: block;
    background: white;
    height: 84px;
    padding: 0 40px;
    width: 100%;
    flex-shrink: 0;
  }
  .header-inner {
    max-width: 1200px;
    margin: 0 auto;
    height: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .desktop-back-btn {
    border: none;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: -4px;
  }
  .mini-logo {
    height: 44px;
    object-fit: contain;
  }
  .header-title {
    font-size: 24px;
    font-weight: 500;
    color: #222;
  }
  .help-link {
    font-size: 14px;
    color: #f05a23;
    text-decoration: none;
  }
  .content-wrapper {
    background: #ffffff;
    max-width: 440px;
    width: 100%;
    margin: auto;
    margin-top: 8vh;
    margin-bottom: 8vh;
    border-radius: 12px;
    box-shadow: 0 0 30px rgba(150, 150, 150, 0.2);
    height: auto;
    flex: none;
    overflow: hidden;
  }
}
</style>
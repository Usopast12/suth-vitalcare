<template>
  <div class="app-wrap" :class="{ 'is-desktop': !isMobileScreen }">
    <input type="file" ref="fileInput" @change="handleFileChange" accept="image/*" style="display: none" />
    <div class="mobile-hero-section" v-if="isMobileScreen">
      <div v-if="user" class="hero-profile">
        <div class="avatar-wrap">
            <div class="avatar" :class="{ 'skeleton': !user }">
              <img v-if="user?.picture_url" :src="user.picture_url" alt="avatar" class="avatar-img" loading="lazy" />
              <span v-else-if="user">{{ initials }}</span>
            </div>
        </div>
        <div class="hero-info">
          <div class="hero-name">{{ user.fname_th }} {{ user.lname_th }}</div>
        </div>
        <div class="top-right">
          <LogOut class="top-icon" @click="handleLogout" />
        </div>
      </div>
    </div>
    <div class="layout-container" :class="{ 'calendar-fullscreen': !isMobileScreen && activeTab === 'calendar', 'sidebar-hidden': !isSidebarVisible }">
      <aside class="nav-sidebar" v-if="(!(!isMobileScreen && activeTab === 'calendar') || isSidebarVisible) && (isMobileScreen ? !activeTab : true)">
        <div class="pc-profile-brief" v-if="!isMobileScreen && user">
          <div class="pc-avatar" :class="{ 'skeleton': !user }">
            <img v-if="user?.picture_url" :src="user.picture_url" alt="avatar" loading="lazy" />
            <span v-else-if="user">{{ initials }}</span>
          </div>
          <div class="pc-brief-info">
            <div class="pc-username">{{ user.fname_th }}</div>
          </div>
        </div>
        <div class="menu-list" :class="{ 'mobile-grid': isMobileScreen }">
          <div class="menu-header" v-if="isMobileScreen">
            <div class="menu-title">{{ langStore.t('my_list') }}</div>
            <div class="menu-more pc-only">{{ langStore.t('view_all') }}</div>
          </div>
          <div class="menu-items-container" :class="{ 'horizontal-scroll': isMobileScreen }">
            <div class="menu-item mi-dashboard" :class="{ 'active': !isMobileScreen && activeTab === 'dashboard' }" @click="openTab('dashboard')">
              <div class="menu-icon-wrap m-purple-gradient"><LayoutDashboard class="menu-icon" /></div>
              <div class="menu-label">{{ langStore.t('dashboard_tab') }}</div>
            </div>
            <div class="menu-item mi-general" :class="{ 'active': !isMobileScreen && activeTab === 'general' }" @click="openTab('general')">
              <div class="menu-icon-wrap m-blue"><User class="menu-icon" /></div>
              <div class="menu-label">{{ langStore.t('my_info') }}</div>
            </div>
            <div class="menu-item mi-contact" :class="{ 'active': !isMobileScreen && activeTab === 'contact' }" @click="openTab('contact')">
              <div class="menu-icon-wrap m-orange"><Phone class="menu-icon" /></div>
              <div class="menu-label">{{ langStore.t('contact_info') }}</div>
            </div>
            <div class="menu-item mi-tanita" :class="{ 'active': !isMobileScreen && activeTab === 'tanita' }" @click="openTab('tanita')">
              <div class="menu-icon-wrap m-green"><Activity class="menu-icon" /></div>
              <div class="menu-label">{{ langStore.t('body_composition') }}</div>
            </div>
            <div class="menu-item mi-calendar" :class="{ 'active': !isMobileScreen && activeTab === 'calendar' }" @click="openTab('calendar')">
              <div class="menu-icon-wrap m-pink"><Calendar class="menu-icon" /></div>
              <div class="menu-label">{{ langStore.t('mission_calendar') }}</div>
            </div>
            <div class="menu-item mi-titles" :class="{ 'active': !isMobileScreen && activeTab === 'titles' }" @click="openTab('titles')">
              <div class="menu-icon-wrap m-yellow"><Award class="menu-icon" /></div>
              <div class="menu-label">{{ langStore.t('titles_tab') }}</div>
            </div>
            <div class="menu-item mi-events" :class="{ 'active': !isMobileScreen && activeTab === 'events' }" @click="openTab('events')">
              <div class="menu-icon-wrap m-red"><LayoutGrid class="menu-icon" /></div>
              <div class="menu-label">{{ langStore.t('registered_events') }}</div>
            </div>
            <div class="menu-item pc-only logout-item" @click="handleLogout" v-if="!isMobileScreen">
              <div class="menu-icon-wrap m-slate"><LogOut class="menu-icon" /></div>
              <div class="menu-label">{{ langStore.t('logout') }}</div>
            </div>
          </div>
        </div>
      </aside>
      <Transition :name="isMobileScreen ? 'fade' : 'fade'">
        <div v-if="activeTab" class="content-area" :class="{ 'is-full-page': isMobileScreen }">
          <div class="content-card" :class="{ 'full-view': isMobileScreen }">
            <div class="card-header">
              <div class="header-actions-left" v-if="isMobileScreen" @click="closeTab">
                <button class="icon-btn-back">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
              </div>
              <button v-if="!isMobileScreen && (activeTab === 'calendar' || activeTab === 'dashboard')" class="icon-btn-toggle" @click="toggleSidebar" :title="isSidebarVisible ? (langStore.t('hide_menu')) : (langStore.t('show_menu'))">
                <PanelLeftClose v-if="isSidebarVisible" />
                <PanelLeft v-else />
              </button>
              <div class="header-titles">
                <h2 class="card-title">{{ currentTabTitle }}</h2>
                <p class="card-subtitle" v-if="!isMobileScreen">{{ currentTabSubtitle }}</p>
              </div>
              <div class="header-actions">
                <!-- Streak Cool in Header -->
                <div v-if="activeTab === 'calendar' || activeTab === 'dashboard'" class="streak-cool-header">
                  <div class="streak-fire-wrap">
                    <span class="fire-emoji">🔥</span>
                    <div class="fire-glow"></div>
                  </div>
                  <div class="streak-info">
                    <div class="streak-count">{{ currentStreak }}×</div>
                   
                  </div>
                </div>

                <button v-if="canEditTab && !editing" class="btn-text text-o" @click="startEdit">{{ langStore.t('edit') }}</button>
              </div>
            </div>
            <!-- Stats Preview Bar -->
            <div class="stats-preview-bar" v-if="activeTab === 'general'">
              <div class="stat-item">
                <div class="stat-label">{{ langStore.t('weight_label') }}</div>
                <div class="stat-val">{{ latestWeight }} <small>{{ langStore.t('kg') }}</small></div>
              </div>
              <div class="stat-divider"></div>
              <div class="stat-item">
                <div class="stat-label">{{ langStore.t('height_label') }}</div>
                <div class="stat-val">{{ latestHeight }} <small>{{ langStore.t('cm') }}</small></div>
              </div>
              <div class="stat-divider"></div>
              <div class="stat-item">
                <div class="stat-label">BMI</div>
                <div class="stat-val-group">
                  <div class="stat-val">{{ profileBMI }}</div>
                  <div class="stat-badge" :style="bmiImage.badgeStyle" v-if="profileBMI !== '–'">
                    {{ bmiImage.label }}
                  </div>
                </div>
              </div>
            </div>
            <div class="card-body">
              <div v-if="activeTab === 'dashboard'" class="tab-content dashboard-tab">
                <ProfileDashboard 
                  :user="user" 
                  :registrations="registrations" 
                  :submissions="userSubmissions" 
                  :streak="currentStreak"
                  :points="liveTotalPoints"
                />
              </div>
              <div v-if="activeTab === 'general'" class="tab-content general-tab">
                <div class="profile-split-layout" :class="{ 'mobile-split': isMobileScreen }">
                  <div class="profile-avatar-area">
                    <div class="av-large" @click="triggerUpload" :class="{ 'skeleton': !user }">
                      <img v-if="user?.picture_url" :src="user.picture_url" alt="avatar" loading="lazy" />
                      <span v-else-if="user">{{ initials }}</span>
                      <div class="av-edit-overlay" v-if="isMobileScreen">
                        <Camera :size="24" />
                      </div>
                      <div class="uploading-overlay" v-if="isUploading">
                        <Loader2 class="spin" :size="24" />
                      </div>
                    </div>
                    <button class="btn-outline-sm mt-4" @click="triggerUpload" :disabled="isUploading" v-if="!isMobileScreen">
                      <span v-if="!isUploading">{{ langStore.t('change_profile_picture') }}</span>
                      <Loader2 v-else class="spin" :size="16" />
                    </button>
                  </div>
                  <div class="profile-form-area">
                    <div v-for="f in generalFields" :key="f.key" class="shopee-f-row" :class="{ 'editing-row': editing }">
                      <div class="shopee-f-label" v-if="!editing">{{ f.label }}</div>
                      <div class="shopee-f-val">
                        <template v-if="!editing">
                          <span v-if="f.key === 'birth_date'">{{ formatBE(form[f.key]) }}</span>
                          <span v-else-if="f.key === 'nickname'">{{ String(form[f.key] || '').startsWith('D:') ? '...' : (form[f.key] || '–') }}</span>
                          <span v-else>{{ getFieldLabel(f, form[f.key]) }}</span>
                        </template>
                        <template v-else-if="f.type === 'select'">
                          <div class="pc-custom-sel">
                            <CustomSelect 
                              v-model="form[f.key]"
                              :options="f.options"
                              :label="editing ? f.label : ''"
                            />
                          </div>
                        </template>
                        <template v-else-if="f.type === 'date_be'">
                          <div class="fi-date-be" :class="{'mobile-date-grid': isMobileScreen}">
                            <div class="pc-custom-sel s-d"><CustomSelect v-model="form_be.day" :options="dayOptions" :label="editing ? (langStore.t('day')) : ''" /></div>
                            <div class="pc-custom-sel s-m"><CustomSelect v-model="form_be.month" :options="monthOptions" :label="editing ? (langStore.t('month')) : ''" /></div>
                            <div class="pc-custom-sel s-y"><CustomSelect v-model="form_be.year" :options="yearOptions" :label="editing ? (langStore.t('year')) : ''" /></div>
                          </div>
                        </template>
                        <div v-else class="floating-input-group">
                          <input class="fi" :type="f.type || 'text'" v-model="form[f.key]" placeholder=" " />
                          <label class="floating-label" v-if="editing">{{ f.label }}</label>
                        </div>
                      </div>
                    </div>
                    <div class="shopee-f-row editing-row" v-if="editing && !isMobileScreen">
                      <div class="shopee-f-val flex gap-3">
                        <button class="btn-outline w-auto px-6" @click="cancelEdit">{{ langStore.t('cancel') }}</button>
                        <button class="btn-primary w-auto px-8" @click="saveEdit" :disabled="isSubmitting">
                          <Loader2 v-if="isSubmitting" class="spin mr-2" :size="16" />
                          <span v-else>{{ langStore.t('save') }}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div v-if="activeTab === 'contact'" class="tab-content">
                <div class="shopee-f-row" v-for="f in contactFields" :key="f.key" :class="{ 'editing-row': editing }">
                  <div class="shopee-f-label" v-if="!editing">{{ f.label }}</div>
                  <div class="shopee-f-val">
                    <span v-if="!editing">{{ f.key === 'underlying_disease' ? (form[f.key] || (langStore.t('no_underlying_disease'))) : (f.key === 'phone' ? formatPhone(form[f.key]) : (form[f.key] || '–')) }}</span>
                    <template v-else-if="f.key === 'underlying_disease'">
                      <div class="disease-selector">
                        <div class="disease-btns">
                          <button class="d-btn" :class="{active: underlyingDiseaseState === 'no'}" @click="setDisease('no')">{{ langStore.t('no') }}</button>
                          <button class="d-btn" :class="{active: underlyingDiseaseState === 'yes'}" @click="setDisease('yes')">{{ langStore.t('yes') }}</button>
                        </div>
                        <div v-if="underlyingDiseaseState === 'yes'" class="floating-input-group mt-2">
                          <input class="fi" type="text" v-model="form[f.key]" placeholder=" " />
                          <label class="floating-label" v-if="editing">{{ langStore.t('specify_underlying_disease') }}</label>
                        </div>
                      </div>
                    </template>
                    <div v-else-if="f.key === 'email'" class="floating-input-group">
                      <input class="fi" type="email" v-model="form[f.key]" placeholder=" " />
                      <label class="floating-label" v-if="editing">{{ langStore.t('email') }}</label>
                    </div>
                    <div v-else class="floating-input-group">
                      <input class="fi" :type="f.type || 'text'" v-model="form[f.key]" placeholder=" " />
                      <label class="floating-label" v-if="editing">{{ f.label }}</label>
                    </div>
                  </div>
                </div>
                <div class="shopee-f-row editing-row" v-if="editing && !isMobileScreen">
                  <div class="shopee-f-val flex gap-3">
                    <button class="btn-outline w-auto px-6" @click="cancelEdit">{{ langStore.t('cancel') }}</button>
                    <button class="btn-primary w-auto px-8" @click="saveEdit" :disabled="isSubmitting">
                      <Loader2 v-if="isSubmitting" class="spin mr-2" :size="16" />
                      <span v-else>{{ langStore.t('save') }}</span>
                    </button>
                  </div>
                </div>
              </div>
              <div v-if="activeTab === 'tanita'" class="tab-content">
                <div v-if="tanita" class="tanita-wrap-v2">
                  <!-- Header top row with last update and CTA button -->
                  <div class="tanita-top-bar">
                    <span class="update-time text-[11px] text-gray-400 font-medium">{{ langStore.t('last_update') }} {{ formatDate(tanita.recorded_at) }}</span>
                    <button class="btn-outline-tanita-v2" @click="openTanitaModal(true)">
                      <Pencil :size="13" class="mr-1.5" />
                      {{ langStore.t('update_body_data') }}
                    </button>
                  </div>

                  <!-- 2-column responsive layout -->
                  <div class="tanita-layout-grid">
                    <!-- Left Column: Core Fitness Targets (Calories, Water, Protein) & Simulator -->
                    <div class="tanita-dashboard-left flex flex-col gap-4">
                      <div class="section-title-wrap">
                        <Award :size="16" class="text-orange-500" />
                        <h3 class="section-title">{{ langStore.t('daily_consumption_target') }}</h3>
                      </div>
                      
                      <!-- Bento Grid for Core Fitness Targets -->
                      <div class="bento-fitness-targets">
                        <div class="bento-card bento-calories" v-if="insightSweetSpot">
                          <button class="tooltip-btn text-slate-400 hover:text-yellow-500 transition-colors" @click.stop="showInfoPopup(langStore.t('calorie_recommendation'), insightSweetSpot.action + langStore.t('tdee_ref'))">
                            <Lightbulb :size="14" />
                          </button>
                          <div class="bento-icon-bg bg-orange-50">
                            <Zap :size="18" class="text-orange-500" />
                          </div>
                          <div class="bento-label text-slate-500 pr-8">{{ langStore.t('calorie_target') }}</div>
                          <div class="bento-value text-slate-800">{{ insightSweetSpot.value }}</div>
                        </div>

                        <div class="bento-card bento-water">
                          <button class="tooltip-btn text-slate-400 hover:text-yellow-500 transition-colors" @click.stop="showInfoPopup(langStore.t('water_target'), langStore.t('water_recommendation'))">
                            <Lightbulb :size="14" />
                          </button>
                          <div class="bento-icon-bg bg-blue-50">
                            <Droplets :size="18" class="text-blue-500" />
                          </div>
                          <div class="bento-label text-slate-500 pr-8">{{ langStore.t('water_target') }}</div>
                          <div class="bento-value text-slate-800">{{ recommendedWater }}</div>
                        </div>

                        <div class="bento-card bento-protein" v-if="insightProtein">
                          <button class="tooltip-btn text-slate-400 hover:text-yellow-500 transition-colors" @click.stop="showInfoPopup(langStore.t('protein_target'), insightProtein.action + langStore.t('protein_ref'))">
                            <Lightbulb :size="14" />
                          </button>
                          <div class="bento-icon-bg bg-red-50">
                            <Flame :size="18" class="text-red-500" />
                          </div>
                          <div class="bento-label text-slate-500 pr-8">{{ langStore.t('protein_target') }}</div>
                          <div class="bento-value text-slate-800">{{ insightProtein.value }}</div>
                        </div>
                      </div>

                      <!-- Simulator Controls Card -->
                      <div class="simulator-card">
                        <div class="sim-header mb-3">
                          <Target :size="15" class="text-gray-500" />
                          <span>{{ langStore.t('simulate_target') }}</span>
                        </div>
                        <div class="sim-controls-grid">
                          <CustomSelect 
                            v-model="dashboardGoal" 
                            :options="goalOptions" 
                            :label="langStore.t('simulated_goal')"
                            class="sim-select"
                          />
                          <CustomSelect 
                            v-model="dashboardActivity" 
                            :options="activityOptions" 
                            :label="langStore.t('simulated_activity_level')"
                            class="sim-select"
                          />
                        </div>
                      </div>

                      <!-- BMI Visualizer (Moved to balance layout) -->
                      <div class="bmi-compact-card relative">
                        <button class="tooltip-btn text-slate-400 hover:text-yellow-500 transition-colors" @click.stop="showInfoPopup(langStore.t('bmi'), bmiImage.desc)">
                          <Lightbulb :size="14" />
                        </button>
                        <div class="bmi-compact-header pr-8">
                          <span class="bmi-compact-title">{{ langStore.t('bmi') }}</span>
                          <div class="bmi-compact-value-row">
                            <span class="bmi-compact-badge" :style="bmiImage.badgeStyle">{{ bmiImage.badge }}</span>
                            <span class="bmi-compact-num">BMI {{ profileBMI }}</span>
                          </div>
                        </div>
                        
                        <div class="bmi-scale-container mt-3 mb-2">
                          <div class="bmi-scale-line"></div>
                          <div class="bmi-marker" :style="{ left: (bmiImage.dotIndex * 25) + '%' }"></div>
                          
                          <!-- Numbers and Ranges Labeling for the scale -->
                          <div class="bmi-scale-labels mt-2.5 flex justify-between text-[9px] text-gray-400 font-semibold px-0.5 relative">
                            <span>{{ langStore.t('bmi_under') }} (&lt;18.5)</span>
                            <span>{{ langStore.t('bmi_normal') }} (18.5)</span>
                            <span>{{ langStore.t('bmi_over') }} (23.0)</span>
                            <span>{{ langStore.t('bmi_obese1') }} (25.0)</span>
                            <span>{{ langStore.t('bmi_obese2') }} (30.0+)</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- Right Column: Detailed Body Metrics Grid & BMI Scale -->
                    <div class="tanita-dashboard-right flex flex-col gap-4">
                      <div class="section-title-wrap">
                        <Scale :size="16" class="text-slate-500" />
                        <h3 class="section-title">{{ langStore.t('detailed_body_composition') }}</h3>
                      </div>

                      <!-- Grid for Metrics -->
                      <div class="metrics-grid">
                        <!-- Weight -->
                        <div class="metric-coach-card">
                          <button class="tooltip-btn text-slate-400 hover:text-yellow-500 transition-colors" @click.stop="showInfoPopup(langStore.t('body_weight'), weightRecommendation)">
                            <Lightbulb :size="14" />
                          </button>
                          <div class="m-card-header flex items-center mt-1 pr-10">
                            <div class="flex items-center gap-1.5 text-slate-500">
                              <Scale :size="14" class="shrink-0 text-blue-500" />
                              <span class="m-title-mini">{{ langStore.t('body_weight') }}</span>
                            </div>
                          </div>
                          <div class="m-val-mini mt-1 text-slate-800">
                            {{ latestWeight }} <span class="m-unit-mini text-slate-400">{{ langStore.t('kg') }}</span>
                          </div>
                          <span class="m-status-badge mt-1" :style="bmiImage.badgeStyle" v-if="profileBMI !== '–'">{{ bmiImage.badge }}</span>
                        </div>

                        <!-- Fat Percent -->
                        <div class="metric-coach-card">
                          <button class="tooltip-btn text-slate-400 hover:text-yellow-500 transition-colors" @click.stop="showInfoPopup(langStore.t('fat_percentage'), fatRecommendation)">
                            <Lightbulb :size="14" />
                          </button>
                          <div class="m-card-header flex items-center mt-1 pr-10">
                            <div class="flex items-center gap-1.5 text-slate-500">
                              <Flame :size="14" class="shrink-0 text-orange-500" />
                              <span class="m-title-mini">{{ langStore.t('fat_percentage') }}</span>
                            </div>
                          </div>
                          <div class="m-val-mini mt-1 text-slate-800">
                            {{ tanita.fat_pc || '–' }} <span class="m-unit-mini text-slate-400">%</span>
                          </div>
                          <span class="m-status-badge mt-1" :class="fatStatus" v-if="fatStatus">{{ fatStatus }}</span>
                        </div>

                        <!-- Visceral Fat -->
                        <div class="metric-coach-card">
                          <button class="tooltip-btn text-slate-400 hover:text-yellow-500 transition-colors" @click.stop="showInfoPopup(langStore.t('visceral_fat'), visceralRecommendation)">
                            <Lightbulb :size="14" />
                          </button>
                          <div class="m-card-header flex items-center mt-1 pr-10">
                            <div class="flex items-center gap-1.5 text-slate-500">
                              <Activity :size="14" class="shrink-0 text-orange-500" />
                              <span class="m-title-mini">{{ langStore.t('visceral_fat') }}</span>
                            </div>
                          </div>
                          <div class="m-val-mini mt-1 text-slate-800">
                            {{ langStore.t('level') }} {{ tanita.visceral_fat || '–' }}
                          </div>
                          <span class="m-status-badge mt-1" :class="tanita.visceral_fat >= 10 ? 'danger' : 'success'" v-if="tanita.visceral_fat">{{ tanita.visceral_fat >= 10 ? (langStore.t('reduce')) : (langStore.t('bmi_normal')) }}</span>
                        </div>

                        <!-- Total Body Water -->
                        <div class="metric-coach-card">
                          <button class="tooltip-btn text-slate-400 hover:text-yellow-500 transition-colors" @click.stop="showInfoPopup(langStore.t('total_body_water'), waterRecommendation)">
                            <Lightbulb :size="14" />
                          </button>
                          <div class="m-card-header flex items-center mt-1 pr-10">
                            <div class="flex items-center gap-1.5 text-slate-500">
                              <Droplets :size="14" class="shrink-0 text-blue-500" />
                              <span class="m-title-mini">{{ langStore.t('total_body_water') }}</span>
                            </div>
                          </div>
                          <div class="m-val-mini mt-1 text-slate-800">
                            {{ tanita.tbw_pc || '–' }} <span class="m-unit-mini text-slate-400">%</span>
                          </div>
                          <span class="m-status-badge mt-1" :class="insightHydration?.value?.includes('ต่ำ') ? 'danger' : 'success'" v-if="insightHydration">{{ insightHydration.value.includes('ต่ำ') ? (langStore.t('drink_more')) : (langStore.t('bmi_normal')) }}</span>
                        </div>

                        <!-- Muscle Mass -->
                        <div class="metric-coach-card">
                          <button class="tooltip-btn text-slate-400 hover:text-yellow-500 transition-colors" @click.stop="showInfoPopup(langStore.t('muscle_mass'), langStore.t('muscle_recommendation'))">
                            <Lightbulb :size="14" />
                          </button>
                          <div class="m-card-header flex items-center mt-1 pr-10">
                            <div class="flex items-center gap-1.5 text-slate-500">
                              <Dumbbell :size="14" class="shrink-0 text-red-500" />
                              <span class="m-title-mini">{{ langStore.t('muscle_mass') }}</span>
                            </div>
                          </div>
                          <div class="m-val-mini mt-1 text-slate-800">
                            {{ tanita.muscle_mass || '–' }} <span class="m-unit-mini text-slate-400">{{ langStore.t('kg') }}</span>
                          </div>
                          <span class="m-status-badge success mt-1">{{ langStore.t('bmi_normal') }}</span>
                        </div>

                        <!-- Metabolic Age -->
                        <div class="metric-coach-card">
                          <button class="tooltip-btn text-slate-400 hover:text-yellow-500 transition-colors" @click.stop="showInfoPopup(langStore.t('metabolic_age'), langStore.t('metabolic_recommendation'))">
                            <Lightbulb :size="14" />
                          </button>
                          <div class="m-card-header flex items-center mt-1 pr-10">
                            <div class="flex items-center gap-1.5 text-slate-500">
                              <Zap :size="14" class="shrink-0 text-orange-500" />
                              <span class="m-title-mini">{{ langStore.t('metabolic_age') }}</span>
                            </div>
                          </div>
                          <div class="m-val-mini mt-1 text-slate-800">
                            {{ tanita.metabolic_age || '–' }} <span class="m-unit-mini text-slate-400">{{ langStore.t('year') }}</span>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
                <div v-else class="empty-state">
                  <Activity :size="48" class="text-gray-300 mb-3" />
                  <span class="text-gray-500 mb-2">{{ langStore.t('no_body_data') }}</span>
                  <button class="btn-primary" @click="openTanitaModal(false)">+ {{ langStore.t('add_health_data') }}</button>
                </div>
              </div>
              <div v-if="activeTab === 'events'" class="tab-content">
                <div v-if="registrations.length" class="events-grid-wrapper">
                  <div class="flat-grid">
                    <div 
                      v-for="reg in registrations.slice(0, isMobileScreen ? 2 : 4)" 
                      :key="reg.id"
                      class="flat-card"
                      @click="viewEvent(reg.event); closeTab()"
                    >
                      <div class="img-box">
                        <img v-if="reg.event.poster" :src="reg.event.poster" :alt="reg.event.title" />
                        <div v-else class="img-fallback">
                          <ImageIcon :size="32" class="fallback-icon" />
                        </div>
                        <div class="dark-badge">
                          {{ getActivityStatus(reg.event) === 'full' ? (langStore.t('status_full')) : getActivityStatus(reg.event) === 'closed' ? (langStore.t('status_closed')) : (langStore.t('status_open')) }}
                        </div>
                        <button class="heart-btn" :class="{'active': favoriteIds.has(reg.event.id)}" @click.stop="toggleFavorite($event, reg.event.id)">
                          <Heart :size="18" :fill="favoriteIds.has(reg.event.id) ? '#F05A23' : 'none'" />
                        </button>
                      </div>
                      <div class="info-box">
                        <h4 class="title">{{ reg.event.title }}</h4>
                        <div class="meta-row text-primary">
                          <Award :size="14" />
                          <span>{{ langStore.t('points_label') }} {{ getEventScore(reg.event.id).toLocaleString() }} {{ langStore.t('points') }}</span>
                        </div>
                        <div class="meta-row" v-if="hasGoal(reg.event)">
                          <Target :size="14" /> 
                          <span>{{ langStore.t('goal_label') }} {{ formatGoalTarget(reg.event) }}</span>
                        </div>
                        <div class="meta-row">
                          <Calendar :size="14" />
                          <span>{{ formatEventRemaining(reg.event) }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="flex justify-center mt-8">
                    <button class="btn-outline-sm px-8" @click="router.push('/?section=mine')">{{ langStore.t('view_all') }}</button>
                  </div>
                </div>
                <div v-else class="empty-state">
                  <Calendar :size="48" class="text-gray-300 mb-3" />
                  <span class="text-gray-500 mb-4">{{ langStore.t('no_registered_events') }}</span>
                  <button class="btn-primary" @click="router.push('/'); activeTab = null">{{ langStore.t('browse_events') }}</button>
                </div>
              </div>

              <!-- Calendar Tab -->
              <div v-if="activeTab === 'calendar'" class="tab-content calendar-tab">
                <!-- Dropdown Backdrop -->
                <div v-if="isCalDropdownOpen" class="cal-dropdown-backdrop" @click="isCalDropdownOpen = false"></div>
                
                <div class="calendar-layout-v2">
                  <div class="calendar-top-bar mb-4">
                    <div class="cal-filter-wrap">
                      <button class="cal-dropdown-trigger" @click="isCalDropdownOpen = !isCalDropdownOpen">
                        <LayoutGrid v-if="!selectedEventId" :size="18" />
                        <div v-else class="cal-trigger-thumb">
                          <img :src="registrations.find(r => r.event.id === selectedEventId)?.event.poster" alt="" />
                        </div>
                        <span class="cal-trigger-text">{{ currentCalActivityTitle }}</span>
                        <ChevronDown :size="18" :class="{ 'rotate-180': isCalDropdownOpen }" />
                      </button>

                      <transition name="dropdown-fade">
                        <div v-if="isCalDropdownOpen" class="cal-activity-dropdown">
                          <div class="cal-dropdown-search">
                            <Search :size="16" />
                            <input v-model="calActivitySearch" type="text" :placeholder="langStore.t('search_events')" />
                          </div>
                          <div class="cal-dropdown-list">
                            <div 
                              class="cal-dropdown-item" 
                              :class="{ active: !selectedEventId }"
                              @click="handleSelectCalActivity(null)"
                            >
                              <div class="item-icon-box"><LayoutGrid :size="16" /></div>
                              <div class="item-info">
                                <div class="item-name">{{ langStore.t('show_all_missions') }}</div>
                                <div class="item-sub">VitalCare System</div>
                              </div>
                            </div>
                            <div 
                              v-for="reg in filteredCalActivities" 
                              :key="reg.id" 
                              class="cal-dropdown-item"
                              :class="{ active: selectedEventId === reg.event.id }"
                              @click="handleSelectCalActivity(reg.event.id)"
                            >
                              <div class="item-thumb-box">
                                <img v-if="reg.event.poster" :src="reg.event.poster" alt="" />
                                <ImageIcon v-else :size="14" />
                              </div>
                              <div class="item-info">
                                <div class="item-name" v-auto-translate="reg.event.title"></div>
                                <div class="item-sub">{{ langStore.t('your_registered_event') }}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </transition>
                    </div>
                  </div>

                  <div class="calendar-main-v2">
                    <MissionCalendar 
                      :days="calendarDays"
                      :monthLabel="calMonthLabel"
                      :yearLabel="calYearLabel"
                      :selectedDate="selectedDate"
                      @prevMonth="prevMonth"
                      @nextMonth="nextMonth"
                      @selectDay="handleSelectDay"
                    />

                    <!-- Color Tab Legend -->
                    <div class="calendar-legend mt-4">
                      <div class="legend-item">
                        <div class="legend-color" style="background: #10b981;"></div>
                        <span class="legend-text">{{ langStore.t('submitted') }}</span>
                      </div>
                      <div class="legend-item">
                        <div class="legend-color" style="background: #3b82f6;"></div>
                        <span class="legend-text">{{ langStore.t('due_today') }}</span>
                      </div>
                      <!-- <div class="legend-item">
                        <div class="legend-color" style="background: #f59e0b;"></div>
                        <span class="legend-text">รอตรวจ</span>
                      </div> -->
                      <div class="legend-item">
                        <div class="legend-color" style="background: #ef4444;"></div>
                        <span class="legend-text">{{ langStore.t('missed') }}</span>
                      </div>
                      <div class="legend-item">
                        <div class="legend-color" style="background: #94a3b8;"></div>
                        <span class="legend-text">{{ langStore.t('not_due_yet') }}</span>
                      </div>
                    </div>
                    
                    <!-- Mission Stats Summary -->
                    <div class="mission-stats-summary mt-6">
                      <div class="section-title-sm mb-4">{{ langStore.t('all_mission_summary') }}</div>
                      <div v-if="missionStats.length" class="stats-grid-simple">
                        <div v-for="stat in missionStats" :key="stat.taskId" class="stat-row">
                          <div class="stat-info">
                            <div class="stat-t-name" v-auto-translate="stat.taskName"></div>
                            <div class="stat-e-name" v-auto-translate="stat.eventName"></div>
                          </div>
                          <div class="stat-metrics">
                            <div class="metric">
                              <span class="m-label">{{ langStore.t('submitted') }}</span>
                              <span class="m-val success">{{ stat.completed }}</span>
                            </div>
                            <div class="metric">
                              <span class="m-label">{{ langStore.t('missed') }}</span>
                              <span class="m-val danger">{{ stat.missed }}</span>
                            </div>
                            <div class="metric">
                              <span class="m-label">{{ langStore.t('target') }}</span>
                              <span class="m-val">{{ stat.expected }}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div v-else class="empty-mini">
                        <p>{{ langStore.t('no_mission_summary') }}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Titles Tab -->
              <div v-if="activeTab === 'titles'" class="tab-content titles-tab">
                <div v-if="loadingTitles" class="loading-wrap">
                  <Loader2 class="spin" :size="32" />
                </div>
                <div v-else class="titles-container-compact">
                  <div class="titles-header-box">
                    <div class="titles-stats-row">
                      <div class="titles-count-info">
                        <span class="count-label">{{ langStore.t('titles_unlocked') }}</span>
                        <span class="count-value">{{ unlockedCount }} / {{ totalCount }}</span>
                      </div>
                      <div class="titles-progress-container">
                        <div class="titles-progress-bar">
                          <div class="titles-progress-fill" :style="{ width: unlockProgress + '%' }"></div>
                        </div>
                        <span class="progress-percent">{{ Math.round(unlockProgress) }}%</span>
                      </div>
                    </div>
                    
                    <div class="titles-search-wrap">
                      <input 
                        v-model="titleSearchQuery" 
                        type="text" 
                        :placeholder="langStore.t('search_title_name')" 
                        class="title-search-input"
                      />
                    </div>
                  </div>

                  <div class="titles-grid-compact">
                    <div 
                      v-for="title in filteredTitles" 
                      :key="title.id" 
                      class="title-box-compact"
                      :class="{ 
                        'is-locked': !title.is_unlocked, 
                        'is-equipped': title.is_equipped,
                        'rarity-common': title.rarity === 'common',
                        'rarity-rare': title.rarity === 'rare',
                        'rarity-secret': title.rarity === 'secret'
                      }"
                    >
                      <div class="title-main-info">
                        <UserTitle 
                          :name="title.name" 
                          :rarity="title.rarity" 
                          :color="title.color"
                          :isLocked="!title.is_unlocked"
                          size="sm"
                        />
                        <p v-if="title.is_unlocked" class="t-desc-mini">{{ title.description }}</p>
                        <p v-else-if="title.hint" class="t-hint-mini">
                          <Lock :size="10" /> {{ title.hint }}
                        </p>
                      </div>

                      <div class="title-action-wrap">
                        <button 
                          v-if="title.is_unlocked" 
                          class="btn-mini-action"
                          :class="{ 'equipped': title.is_equipped }"
                          @click="equipTitle(user.id, title.is_equipped ? null : title.id)"
                        >
                          <Check v-if="title.is_equipped" :size="14" />
                          {{ title.is_equipped ? (langStore.t('equipped')) : (langStore.t('equip')) }}
                        </button>
                        <button 
                          v-else-if="title.unlock_type === 'open' || title.unlock_type === 'conditions'" 
                          class="btn-mini-claim"
                          @click="handleClaim(title)"
                        >
                          {{ langStore.t('unlock') }}
                        </button>
                        <button 
                          v-else-if="title.unlock_type === 'code'" 
                          class="btn-mini-claim btn-mini-code"
                          @click="handleClaim(title)"
                        >
                          <Lock :size="12" /> {{ langStore.t('code') }}
                        </button>
                        <div v-else class="lock-icon-only">
                          <Lock :size="16" />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div v-if="filteredTitles.length === 0" class="empty-mini">
                    <Award :size="32" class="opacity-20" />
                    <p>{{ langStore.t('no_titles_found') }}</p>
                  </div>
                </div>
              </div>
            </div>
           <div class="card-footer" v-if="editing && isMobileScreen">
              <button class="btn-outline w-full" @click="cancelEdit">{{ langStore.t('cancel') }}</button>
              <button class="btn-primary w-full" @click="saveEdit" :disabled="isSubmitting">
                <Loader2 v-if="isSubmitting" class="spin mr-2" :size="18" />
                {{ langStore.t('save_data') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </div> <Teleport to="body"> <Transition name="modal-fade"> <div v-if="showTanitaModal" class="tn-overlay">
          <div class="tn-sheet">
            <div class="tn-header">
              <div class="header-actions-left" v-if="isMobileScreen" @click="showTanitaModal = false">
                <button class="icon-btn-back">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
              </div>
              <div class="tn-title">{{ tanita ? (langStore.t('edit_health_data')) : (langStore.t('add_health_data')) }}</div>
              <button class="tn-close" v-if="!isMobileScreen" @click="showTanitaModal = false" :aria-label="langStore.t('close')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div class="tn-mode-bar">
              <button class="tn-mode-btn" :class="{ active: tanitaInputMethod === 'manual' }" @click="tanitaInputMethod = 'manual'">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                {{ langStore.t('manual_input') }}
              </button>
              <button class="tn-mode-btn" :class="{ active: tanitaInputMethod === 'ai' }" @click="tanitaInputMethod = 'ai'">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                {{ langStore.t('ai_scan') }}
              </button>
            </div>
            <div class="tn-body">
              <div v-if="tanitaInputMethod === 'ai'" class="tn-ai-inline">
                <div v-if="isAnalyzingTanita" class="tn-ai-loading">
                  <Loader2 class="spin" :size="24" />
                  <span>{{ tanitaLoadingMsg }}</span>
                </div>
                <div v-else>
                  <input type="file" accept="image/*" id="tn-ai-upload" @change="handleTanitaImageUpload" style="display:none" />
                  <label for="tn-ai-upload" class="tn-upload-trigger"
                    :class="{ dragging: isTanitaDragging }"
                    @dragover.prevent="isTanitaDragging = true"
                    @dragleave.prevent="isTanitaDragging = false"
                    @drop.prevent="handleTanitaDrop"
                  >
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                    <span>{{ isTanitaDragging ? (langStore.t('drop_here')) : (langStore.t('upload_body_composition_sheet')) }}</span>
                    <span class="tn-sub">{{ langStore.t('supports_drag_drop') }}</span>
                  </label>
                </div>
              </div>
              <div class="tn-grid-3">
                <div class="tn-f-group"><input type="number" v-model="tanitaForm.height" placeholder=" "/><label>{{ langStore.t('height_cm') }}</label></div>
                <div class="tn-f-group"><input type="number" step="0.1" v-model="tanitaForm.weight" placeholder=" "/><label>{{ langStore.t('weight_kg') }}</label></div>
                <div class="tn-f-group"><input type="text" v-model="tanitaForm.bodyType" placeholder=" "/><label>{{ langStore.t('body_type') }}</label></div>
              </div>
              <div class="tn-grid-2" style="margin-bottom:4px">
                <div class="tn-f-group">
                  <input type="number" v-model="tanitaForm.age" placeholder=" "/>
                  <label>{{ langStore.t('age_years') }} <span style="font-size:10px;color:#94a3b8">({{ langStore.t('from_birthdate') }})</span></label>
                </div>
              </div>
              <div class="tn-divider-label">{{ langStore.t('body_composition') }}</div>
              <div class="tn-grid-2">
                <div class="tn-f-group"><input type="number" step="0.1" v-model="tanitaForm.fatPercent" placeholder=" "/><label>{{ langStore.t('fat_percent') }}</label></div>
                <div class="tn-f-group"><input type="number" step="0.1" v-model="tanitaForm.fatMass" placeholder=" "/><label>{{ langStore.t('fat_mass_kg') }}</label></div>
                <div class="tn-f-group"><input type="number" step="0.1" v-model="tanitaForm.ffm" placeholder=" "/><label>{{ langStore.t('ffm_kg') }}</label></div>
                <div class="tn-f-group"><input type="number" step="0.1" v-model="tanitaForm.muscleMass" placeholder=" "/><label>{{ langStore.t('muscle_mass_kg') }}</label></div>
                <div class="tn-f-group"><input type="number" step="0.1" v-model="tanitaForm.bodyWaterMass" placeholder=" "/><label>{{ langStore.t('body_water_mass_kg') }}</label></div>
                <div class="tn-f-group"><input type="number" step="0.1" v-model="tanitaForm.bodyWaterPercent" placeholder=" "/><label>{{ langStore.t('body_water_percent') }}</label></div>
                <div class="tn-f-group"><input type="number" step="0.1" v-model="tanitaForm.boneMass" placeholder=" "/><label>{{ langStore.t('bone_mass_kg') }}</label></div>
                <div class="tn-f-group"><input type="number" step="0.1" v-model="tanitaForm.clothesWeight" placeholder=" "/><label>{{ langStore.t('clothes_weight_kg') }}</label></div>
                <div class="tn-f-group"><input type="number" step="0.1" v-model="tanitaForm.waist_cm" placeholder=" "/><label>{{ langStore.t('waist_cm') }}</label></div>
              </div>
              <div class="tn-divider-label">{{ langStore.t('metabolism_health_index') }}</div>
              <div class="tn-grid-2">
                <div class="tn-f-group"><input type="number" v-model="tanitaForm.bmrKj" placeholder=" "/><label>BMR (kJ)</label></div>
                <div class="tn-f-group"><input type="number" v-model="tanitaForm.bmrKcal" placeholder=" "/><label>BMR (kcal)</label></div>
                <div class="tn-f-group"><input type="number" v-model="tanitaForm.metabolicAge" placeholder=" "/><label>{{ langStore.t('metabolic_age_years') }}</label></div>
                <div class="tn-f-group"><input type="number" step="0.1" v-model="tanitaForm.visceralFat" placeholder=" "/><label>{{ langStore.t('visceral_fat') }}</label></div>
                <div class="tn-f-group"><input type="number" step="0.1" v-model="tanitaForm.bmi" placeholder=" "/><label>BMI</label></div>
                <div class="tn-f-group"><input type="number" step="0.1" v-model="tanitaForm.idealWeight" placeholder=" "/><label>{{ langStore.t('ideal_weight_kg') }}</label></div>
                <div class="tn-f-group"><input type="number" step="0.1" v-model="tanitaForm.obesityDegree" placeholder=" "/><label>{{ langStore.t('obesity_degree') }}</label></div>
                <div class="tn-f-group"><input type="number" v-model="tanitaForm.physiqueRating" placeholder=" "/><label>Physique Rating</label></div>
              </div>
            </div>
            <div class="tn-footer">
              <button class="tn-btn-cancel" @click="showTanitaModal = false">{{ langStore.t('cancel') }}</button>
              <button class="tn-btn-save" @click="submitTanitaForm" :disabled="isSavingTanita">
                <Loader2 v-if="isSavingTanita" class="spin" :size="14" />
                {{ langStore.t('save_data') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showMissionPopup" class="tn-overlay" @click.self="showMissionPopup = false">
          <div class="tn-sheet popup-mission-sheet">
            <div class="tn-header">
              <div class="header-actions-left" v-if="isMobileScreen" @click="showMissionPopup = false">
                <button class="icon-btn-back">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
              </div>
              <div class="tn-title">{{ langStore.t('mission_date') }} {{ formatDate(selectedDate) }}</div>
              <button class="tn-close" v-if="!isMobileScreen" @click="showMissionPopup = false" :aria-label="langStore.t('close')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            
            <div class="tn-body popup-mission-body">
              <div v-if="selectedDateMissions.length" class="mission-list popup-list">
                <div v-for="m in paginatedPopupMissions" :key="m.id" class="mission-item popup-item">
                  <div class="m-status-icon-new">
                    <span v-if="m.status === 'approved' || m.status === 'pending'" class="m-emoji fire">🔥</span>
                    <span v-else-if="m.status === 'upcoming'" class="m-emoji upcoming">🕗</span>
                    <span v-else-if="m.status === 'missed'" class="m-emoji missed">✕</span>
                    <span v-else-if="m.status === 'active'" class="m-emoji fire">🕗</span>
                    <span v-else class="m-emoji">📋</span>
                  </div>
                  <div class="m-info">
                    <div class="m-title">{{ m.task?.note || langStore.t('mission') }}</div>
                    <div class="m-meta">{{ m.event?.title }}</div>
                  </div>
                  <div class="m-badge" :class="m.status">
                    {{ 
                      m.status === 'approved' ? langStore.t('submitted') : 
                      m.status === 'pending' ? langStore.t('mission_pending_review') : 
                      m.status === 'rejected' ? langStore.t('rejected') :
                      m.status === 'missed' ? langStore.t('missed') : 
                      m.status === 'active' ? langStore.t('due_today') : langStore.t('not_due_yet')
                    }}
                  </div>
                </div>
              </div>
              <div v-else class="empty-mini py-12">
                <VenetianMask :size="32" class="opacity-20 mb-2" />
                <span class="text-gray-500 font-medium">{{ langStore.t('no_activities_today') }}</span>
              </div>
            </div>

            <!-- Popup Footer Pagination -->
            <div v-if="selectedDateMissions.length > itemsPerPage" class="popup-pagination-footer">
              <div class="pagination-buttons">
                <button 
                  class="btn-pagination-prev" 
                  :disabled="currentPopupPage === 1" 
                  @click="currentPopupPage--"
                >
                  {{ langStore.t('prev_step') }}
                </button>
                <span class="pagination-indicator">
                  {{ langStore.t('page_label') }} {{ currentPopupPage }} / {{ totalPopupPages }}
                </span>
                <button 
                  class="btn-pagination-next" 
                  :disabled="currentPopupPage === totalPopupPages" 
                  @click="currentPopupPage++"
                >
                  {{ langStore.t('next_step') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { 
  Camera, ChevronRight, MapPin, Pencil, LogOut, Award, HeartPulse, Activity, 
  LayoutDashboard, Loader2, User, Users, Calendar, Target, Mail, Phone, IdCard, 
  Scale, Ruler, Stethoscope, School, GraduationCap, Building2, Briefcase, VenetianMask,
  Heart, ImageIcon, Droplets, Lock, LayoutGrid, Medal, Check, PanelLeft, PanelLeftClose, ChevronLeft, X, Clock,
  BookOpen, Info, Lightbulb, Zap, Flame, Dumbbell
} from 'lucide-vue-next'
import Swal from 'sweetalert2'
import { authStore } from '../store/auth'
import { uiStore } from '../store/ui'
import { langStore } from '../store/lang'
import { logoutLiff } from '../lib/liff'
import { useFavorites } from '../composables/useFavorites'
import CustomSelect from '../components/CustomSelect.vue'
import { useTanitaProfile, useTanitaInsights } from '../composables/useTanitaProfile'
import { useProfileForm } from '../composables/useProfileForm'
import { useProfileEvents } from '../composables/useProfileEvents'
import { useUserTitles } from '../composables/useUserTitles'
import MissionCalendar from '../components/MissionCalendar.vue'
import UserTitle from '../components/UserTitle.vue'
import ProfileDashboard from '../components/ProfileDashboard.vue'
const router = useRouter()
const user = computed(() => authStore.user)
const isMobileScreen = ref(true)
const activeTab = ref(null)
const isSidebarVisible = ref(true)
const toggleSidebar = () => { isSidebarVisible.value = !isSidebarVisible.value }
const selectedDate = ref(new Date())
const { favoriteIds, fetchFavorites, toggleFavorite: syncToggleFavorite } = useFavorites()
const { titles, loadingTitles, fetchAllTitles, equipTitle, claimTitle } = useUserTitles()
const titleSearchQuery = ref('')
const filteredTitles = computed(() => {
  if (!titleSearchQuery.value) return titles.value
  const q = titleSearchQuery.value.toLowerCase()
  return titles.value.filter(t => t.name.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q))
})
const unlockedCount = computed(() => titles.value.filter(t => t.is_unlocked).length)
const totalCount = computed(() => titles.value.length)
const unlockProgress = computed(() => totalCount.value ? (unlockedCount.value / totalCount.value * 100) : 0)

const showInfoPopup = (title, text) => {
  Swal.fire({
    title: title,
    html: text,
    icon: 'info',
    confirmButtonColor: '#F05A23',
    confirmButtonText: langStore.t('acknowledge_btn'),
    customClass: {
      popup: 'premium-swal-popup',
      confirmButton: 'premium-swal-confirm'
    }
  })
}

const handleClaim = async (title) => {
  if (title.unlock_type === 'code') {
    const { value: code } = await Swal.fire({
      title: langStore.t('enter_unlock_code'),
      input: 'text',
      inputPlaceholder: langStore.t('enter_code_placeholder'),
      showCancelButton: true,
      confirmButtonText: langStore.t('confirm'),
      cancelButtonText: langStore.t('cancel'),
      confirmButtonColor: '#F05A23',
      customClass: {
        popup: 'premium-swal-popup',
        confirmButton: 'premium-swal-confirm',
        cancelButton: 'premium-swal-cancel'
      }
    })
    
    if (!code) return
    
    const res = await claimTitle(title.id, code)
    if (res.success) {
      Swal.fire({
        icon: 'success',
        title: langStore.t('unlock_success'),
        text: langStore.t('unlocked_title_msg').replace('{title}', title.name),
        confirmButtonColor: '#F05A23'
      })
    } else {
      Swal.fire({
        icon: 'error',
        title: langStore.t('invalid_code'),
        text: res.error || langStore.t('check_code_again'),
        confirmButtonColor: '#F05A23'
      })
    }
  } else {
    // Open or Conditions
    const res = await claimTitle(title.id)
    if (res.success) {
      Swal.fire({
        icon: 'success',
        title: langStore.t('success'),
        text: langStore.t('unlocked_title_msg').replace('{title}', title.name),
        confirmButtonColor: '#F05A23'
      })
    } else {
      Swal.fire({
        icon: 'warning',
        title: langStore.t('cannot_unlock_yet'),
        text: res.error || langStore.t('requirements_not_met'),
        confirmButtonColor: '#F05A23'
      })
    }
  }
}

function toggleFavorite(e, id) {
  e.stopPropagation()
  syncToggleFavorite(id)
}
function checkScreen() {
  isMobileScreen.value = window.innerWidth < 768
  if (!isMobileScreen.value && !activeTab.value) {
    activeTab.value = 'dashboard'
  }
}
// ── Composables Setup ──
const { 
  tanita, isTanitaLoaded, showTanitaModal, isSavingTanita, isAnalyzingTanita, 
  isTanitaDragging, tanitaInputMethod, tanitaLoadingMsg, tanitaForm,
  openTanitaModal, fetchTanitaData, submitTanitaForm, handleTanitaFileSelect, 
  handleTanitaImageUpload, handleTanitaDrop 
} = useTanitaProfile(user, () => fetchData())
const {
  form, form_be, editing, underlyingDiseaseState, isUploading, fileInput,
  dayOptions, monthOptions, yearOptions, generalFields, contactFields, goalOptions, activityOptions,
  profileBMI, accurateAge, latestWeight, latestHeight, idealWeight,
  recommendedCalories, fatStatus, bmiImage, initials,
  setDisease, startEdit, cancelEdit, saveEdit, fetchData, triggerUpload, 
  handleFileChange, formatBE, getFieldLabel, formatPhone, isSubmitting
} = useProfileForm(user, tanita)
const dashboardGoal = ref(user.value?.main_goal || 'รักษาสุขภาพทั่วไป')
const dashboardActivity = ref(user.value?.activity_level || 'sedentary')
watch(() => user.value?.main_goal, (ng) => { if (ng) dashboardGoal.value = ng })
watch(() => user.value?.activity_level, (na) => { if (na) dashboardActivity.value = na })
const {
  insightSweetSpot, insightProtein, insightBodyType, insightVisceral, insightHydration, insightWeightGap
} = useTanitaInsights(tanita, user, { latestWeight, latestHeight, profileBMI, recommendedCalories, accurateAge }, dashboardGoal, dashboardActivity)

const recommendedWater = computed(() => {
  const w = parseFloat(String(latestWeight.value))
  if (isNaN(w) || w <= 0) return '2.0 - 3.0 ' + langStore.t('liters')
  return (Math.round(w * 33 / 100) / 10).toFixed(1) + ' ' + langStore.t('liters')
})

const genderLabel = computed(() => {
  const g = (user.value?.gender || '').toLowerCase()
  return g.includes('หญิง') || g.includes('female') ? 'female' : 'male'
})

const weightRecommendation = computed(() => {
  const w = parseFloat(String(latestWeight.value))
  const ideal = parseFloat(String(idealWeight.value))
  if (isNaN(w) || isNaN(ideal) || w <= 0) return '–'
  const diff = w - ideal
  if (diff > 0) {
    return langStore.t('lose_fat_more').replace('{val}', diff.toFixed(1)).replace('{target}', ideal.toFixed(1))
  } else if (diff < 0) {
    return langStore.t('gain_muscle_more').replace('{val}', Math.abs(diff).toFixed(1)).replace('{target}', ideal.toFixed(1))
  }
  return langStore.t('ideal_weight_excellent')
})

const fatRecommendation = computed(() => {
  const fat = parseFloat(String(tanita.value?.fat_pc))
  if (isNaN(fat) || fat <= 0) return '–'
  const isFemale = genderLabel.value === 'female'
  const maxNormal = isFemale ? 30 : 20
  const minNormal = isFemale ? 20 : 10
  if (fat > maxNormal) {
    return langStore.t('reduce_fat_more').replace('{val}', (fat - maxNormal).toFixed(1)).replace('{min}', minNormal).replace('{max}', maxNormal)
  } else if (fat < minNormal) {
    return langStore.t('increase_fat_more').replace('{val}', (minNormal - fat).toFixed(1)).replace('{min}', minNormal).replace('{max}', maxNormal)
  }
  return langStore.t('excellent_fat_level').replace('{min}', minNormal).replace('{max}', maxNormal)
})

const visceralRecommendation = computed(() => {
  const vis = parseFloat(String(tanita.value?.visceral_fat))
  if (isNaN(vis) || vis <= 0) return '–'
  if (vis >= 10) {
    return langStore.t('reduce_visceral_more').replace('{val}', (vis - 9))
  }
  return langStore.t('excellent_visceral_level')
})

const waterRecommendation = computed(() => {
  const tbw = parseFloat(String(tanita.value?.tbw_pc))
  if (isNaN(tbw) || tbw <= 0) return '–'
  const isFemale = genderLabel.value === 'female'
  const minNormal = isFemale ? 45 : 55
  const maxNormal = isFemale ? 60 : 65
  if (tbw < minNormal) {
    return langStore.t('drink_water_more').replace('{val}', (minNormal - tbw).toFixed(1)).replace('{min}', minNormal).replace('{max}', maxNormal)
  }
  return langStore.t('excellent_water_level').replace('{min}', minNormal).replace('{max}', maxNormal)
})
const {
  registrations, userSubmissions, team, memberCount, teamProgress, teamGoal,
  isEventsLoaded, isTeamLoaded, eventsPerPage, eventsCurrentPage, eventsTotalPages,
  paginatedEvents, liveTotalPoints, fetchTeamData, fetchEventsData, getActivityStatus,
  getMissionsForDate, formatDate, formatDateRange, formatEventRemaining, getEventScore, hasGoal, formatGoalTarget,
  calendarDays, calMonthLabel, calYearLabel, prevMonth, nextMonth, currentStreak, last7DaysData, selectedEventId, missionStats
} = useProfileEvents(user, activeTab)

const maxBarValue = computed(() => {
  if (!last7DaysData.value.length) return 100
  return Math.max(...last7DaysData.value.map(d => d.value), 10)
})

const selectedDateMissions = computed(() => {
  return getMissionsForDate(selectedDate.value)
})

// Popup Modal for Calendar Missions
const showMissionPopup = ref(false)
const currentPopupPage = ref(1)
const itemsPerPage = ref(3)

const totalPopupPages = computed(() => {
  return Math.ceil(selectedDateMissions.value.length / itemsPerPage.value) || 1
})

const paginatedPopupMissions = computed(() => {
  const start = (currentPopupPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return selectedDateMissions.value.slice(start, end)
})

const handleSelectDay = (day) => {
  selectedDate.value = day.date
  currentPopupPage.value = 1
  showMissionPopup.value = true
}

const isCalDropdownOpen = ref(false)
const calActivitySearch = ref('')
const currentCalActivityTitle = computed(() => {
  if (!selectedEventId.value) return langStore.t('show_all_missions')
  const reg = registrations.value.find(r => r.event.id === selectedEventId.value)
  return reg ? reg.event.title : langStore.t('show_all_missions')
})
const filteredCalActivities = computed(() => {
  if (!calActivitySearch.value) return registrations.value
  return registrations.value.filter(r => 
    r.event.title.toLowerCase().includes(calActivitySearch.value.toLowerCase())
  )
})
function handleSelectCalActivity(id) {
  selectedEventId.value = id
  isCalDropdownOpen.value = false
}
// ==========================
// Real-time Sync
// ==========================
watch(() => uiStore.lastRealtimeUpdate, () => {
  fetchData()
  fetchTanitaData()
  fetchFavorites()
  fetchEventsData()
})
function openTab(tabName) {
  activeTab.value = tabName
  editing.value = false
  if (isMobileScreen.value) document.body.style.overflow = 'hidden'
  if (tabName === 'tanita') fetchTanitaData()
  else if (tabName === 'team') fetchTeamData()
  else if (tabName === 'events' || tabName === 'dashboard') fetchEventsData()
  else if (tabName === 'titles') fetchAllTitles()
}
function closeTab() {
  if (isMobileScreen.value) {
    activeTab.value = null
    document.body.style.overflow = ''
  } else {
    activeTab.value = null
  }
  editing.value = false
}
const currentTabTitle = computed(() => {
  const titles = { 
    dashboard: langStore.t('dashboard_title'),
    general: langStore.t('my_info'), 
    contact: langStore.t('contact_info'), 
    tanita: langStore.t('body_composition'), 
    calendar: langStore.t('mission_calendar'),
    team: langStore.t('my_team'), 
    events: langStore.t('registered_events'),
    titles: langStore.t('my_titles')
  }
  return titles[activeTab.value] || ''
})
const currentTabSubtitle = computed(() => {
  if (activeTab.value === 'general' || activeTab.value === 'contact') return langStore.t('profile_management_subtitle')
  return ''
})
const canEditTab = computed(() => activeTab.value === 'general' || activeTab.value === 'contact')
function viewEvent(event) { router.push(`/activities/${event.id}`) }
function handleLogout() { logoutLiff(); router.push('/') }
onMounted(() => {
  checkScreen()
  window.addEventListener('resize', checkScreen)
  fetchData()
  fetchTanitaData()
  fetchFavorites()
  fetchEventsData()
})
onUnmounted(() => {
  window.removeEventListener('resize', checkScreen)
})
</script>
<style scoped>
*, *::before, *::after { box-sizing: border-box; }
:root {
  --primary: #FF6B00;
  --primary-dark: #d64a18;
  --primary-light: #fef0eb;
  --bg-page: #ffffff;
  --text-main: #333;
  --text-sub: #757575;
  --border-light: #efefef;
}
.layout-container.sidebar-hidden {
  /* Inherit max-width from .layout-container for consistency */
}
.layout-container.sidebar-hidden .content-area {
  padding-left: 0;
  max-width: 100%;
}
.icon-btn-toggle {
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  border-radius: 8px;
  transition: all 0.2s;
}
.icon-btn-toggle:hover {
  background: #f1f5f9;
  color: #F05A23;
}
.app-wrap {
  min-height: 100vh;
  width: 100%;
  max-width: 100vw;
  background-color: var(--bg-page, #ffffff);
  font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
  color: var(--text-main, #333);
  overflow-x: hidden;
}
.layout-container {
  display: flex;
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
  gap: 24px;
}
.layout-container.calendar-fullscreen {
  /* Inherit max-width from .layout-container to remain consistent with other tabs */
}
.layout-container.calendar-fullscreen .content-area {
  flex: 1;
  max-width: 100%;
}
@media (max-width: 768px) {
  .layout-container { padding: 0; gap: 0; }
}
.mobile-hero-section {
  background: linear-gradient(135deg, #FF6B00 0%, #FF8533 100%);
  box-shadow: 0 4px 20px rgba(255, 107, 0, 0.15);
  padding: 12px 16px;
  color: #fff;
  position: relative;
  z-index: 10;
}
.top-icon { width: 22px; height: 22px; color: #fff; cursor: pointer; opacity: 0.9; }
.top-icon:hover { opacity: 1; }
.hero-profile { display: flex; align-items: center; gap: 16px; }
.avatar-wrap { position: relative; }
.avatar { width: 48px; height: 48px; border-radius: 50% !important; background: rgba(255,255,255,0.2); border: 2px solid rgba(255,255,255,0.4); display: flex; align-items: center; justify-content: center; font-size: 16px; color: #fff; font-weight: bold; position: relative; overflow: hidden; flex-shrink: 0; aspect-ratio: 1/1; }
.avatar-img { width: 100%; height: 100%; object-fit: cover; }
.av-edit { position: absolute; bottom: 0; width: 100%; height: 20px; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; color: #fff; cursor: pointer; }
.hero-info { flex: 1; }
.hero-name { font-size: 1.1rem; font-weight: 700; color: #fff; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 200px; }
.top-right { display: flex; gap: 12px; }
.layout-container {
  padding: 0;
}
.nav-sidebar {
  background: transparent;
  width: 100%;
}
.menu-list.mobile-grid {
  background: #fff;
  margin: 0;
  border-radius: 0;
  border-top: 1px solid #f5f5f5;
  padding: 20px 0 16px;
  position: relative;
  z-index: 20;
}
.menu-title { font-size: 1rem; font-weight: 700; margin-bottom: 16px; }
.menu-items-container.horizontal-scroll {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px 10px;
  padding: 8px 16px 16px;
  width: 100%;
}
.menu-items-container.horizontal-scroll .menu-item {
  min-width: unset;
  width: 100%;
}
.menu-items-container.horizontal-scroll .menu-label {
  width: 100%;
  max-width: 90px;
  font-size: 0.78rem;
}
.menu-items-container.horizontal-scroll::-webkit-scrollbar { display: none; }
.menu-title { padding: 0 20px; }
/* Skeleton Loading Like Lazada */
.skeleton {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
}
@keyframes skeleton-loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
.menu-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.menu-title { font-size: 0.95rem; font-weight: 700; margin-bottom: 0; }
.menu-more { font-size: 0.8rem; color: #888; }
.menu-item { 
  display: flex; 
  flex-direction: column; 
  align-items: center; 
  gap: 12px; 
  cursor: pointer; 
  min-width: 70px; /* 🌟 กำหนดขนาดขั้นต่ำเพื่อให้เกิดการเลื่อนบนจอเล็ก 🌟 */
  flex-shrink: 0; 
}
.menu-icon-wrap { 
  width: 3.2rem; height: 3.2rem; min-width: 3.2rem; min-height: 3.2rem;
  aspect-ratio: 1/1 !important; border-radius: 50% !important; display: flex; align-items: center; justify-content: center; 
  transition: all 0.2s; border: 1.5px solid rgba(0,0,0,0.05); flex-shrink: 0; overflow: hidden; 
  box-shadow: none;
}
.m-blue { background: #1e88e5; color: #fff; border-color: transparent; }
.m-purple-gradient { background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); color: #fff; border-color: transparent; }
.m-orange { background: #FF6B00; color: #fff; border-color: transparent; }
.m-green { background: #43a047; color: #fff; border-color: transparent; }
.m-pink { background: #FFB6C1; color: #fff; border-color: transparent; }
.m-red { background: #e53935; color: #fff; border-color: transparent; }
.m-slate { background: #546e7a; color: #fff; border-color: transparent; }
.menu-icon { width: 22px; height: 22px; stroke-width: 2.5px; }
.menu-label { font-size: 0.8rem; text-align: center; color: #444; line-height: 1.2; font-weight: 500; width: 64px; }
.pc-only { display: none; }
.content-area.is-full-page {
  position: fixed; inset: 0; background: #fff; z-index: 100; display: flex; flex-direction: column;
  height: 100dvh; /* 🌟 ใช้ dvh เพื่อให้พอดีกับหน้าจอมือถือที่มี Address bar 🌟 */
}
.content-card.full-view {
  background: #fff; width: 100%; height: 100%; display: flex; flex-direction: column; border-radius: 0;
}
.card-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid #efefef; min-height: 56px; }
.header-actions-left { margin-right: 12px; cursor: pointer; }
.icon-btn-back { background: none; border: none; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; }
.icon-btn-back svg { width: 24px; height: 24px; color: #333; }
.card-title { font-size: 1.15rem; font-weight: 700; margin: 0; flex: 1; }
.header-actions { display: flex; align-items: center; gap: 12px; }
.btn-text { background: none; border: none; font-weight: 600; cursor: pointer; color: #F05A23; font-size: 0.95rem; }
.icon-btn-close { background: #f4f4f4; border: none; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.icon-btn-close svg { width: 16px; height: 16px; stroke: #222; fill: none; stroke-width: 2; }
/* --- Flat Grid & Card Styles (Activity Marketplace Style) --- */
.flat-grid { 
  display: grid; 
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); 
  gap: 24px 20px; 
}
@media (max-width: 768px) {
  .flat-grid {
    grid-template-columns: repeat(2, 1fr) !important;
    gap: 20px 12px;
  }
}
.flat-card { 
  display: flex; 
  flex-direction: column; 
  cursor: pointer; 
  transition: all 0.3s ease; 
  background: #fff;
  border-radius: 16px;
}
.flat-card:hover { transform: translateY(-4px); }
.img-box {
  position: relative; 
  width: 100%; 
  aspect-ratio: 1/1; 
  background: #f8fafc; 
  border-radius: 16px; 
  overflow: hidden; 
  margin-bottom: 12px;
}
.img-box img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s ease; }
.flat-card:hover .img-box img { transform: scale(1.05); }
.img-fallback { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #D1D5DB; }
.dark-badge {
  position: absolute; top: 12px; left: 12px; background: rgba(17, 24, 39, 0.85); backdrop-filter: blur(4px);
  color: #fff; font-size: 11px; font-weight: 600; padding: 6px 12px; border-radius: 8px; letter-spacing: 0.5px;
}
.heart-btn {
  position: absolute; bottom: 12px; right: 12px;
  width: 36px; height: 36px; min-width: 36px; min-height: 36px; flex-shrink: 0;
  background: #fff; border-radius: 50%; border: none;
  display: flex; align-items: center; justify-content: center;
  color: #6B7280; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.08); transition: transform 0.2s;
}
.heart-btn:active { transform: scale(0.9); }
.heart-btn.active { color: #F05A23; }
.info-box { padding: 0 4px; }
.info-box .title {
  font-size: 15px; font-weight: 700; color: #111; margin: 0 0 10px 0; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.meta-row { display: flex; align-items: center; gap: 6px; font-size: 13px; margin-bottom: 4px; color: #6B7280; font-weight: 500; }
.meta-row.text-primary { color: #F05A23; font-weight: 700; }
.meta-row.text-orange-600 { color: #F05A23; }
.card-body { 
  padding: 16px; 
  overflow-y: auto; 
  flex: 1; 
  /* 🌟 เพิ่ม Padding ด้านล่างเพื่อให้เลื่อนพ้น Bottom Nav (เพิ่มขึ้นเป็น 150px เพื่อความชัวร์) 🌟 */
  padding-bottom: calc(150px + env(safe-area-inset-bottom, 0px)); 
}
@media (min-width: 769px) {
  .card-body { padding-bottom: 16px; }
}
.card-footer { 
  padding: 16px; 
  border-top: 1px solid #efefef; 
  display: flex; 
  gap: 12px; 
  background: #fff; 
  /* 🌟 เพิ่ม Padding ด้านล่างสำหรับมือถือที่มี Bottom Nav 🌟 */
  padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
}
@media (max-width: 768px) {
  .card-footer {
    padding-bottom: calc(80px + env(safe-area-inset-bottom, 0px));
  }
}
.shopee-f-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 20px; width: 100%; }
.shopee-f-row.editing-row { display: block; margin-bottom: 20px; }
.shopee-f-label { font-size: 0.85rem; color: #757575; font-weight: 500; flex-shrink: 0; min-width: 80px; max-width: 40%; }
.shopee-f-val { font-size: 0.88rem; color: #222; text-align: right; flex: 1; min-width: 0; display: flex; justify-content: flex-end; word-break: break-word; }
.shopee-f-val span { overflow-wrap: anywhere; word-break: break-word; max-width: 100%; }
.editing-row .shopee-f-val { display: block; text-align: left; }
.mobile-split .shopee-f-val { padding-left: 0; }
.floating-input-group { position: relative; width: 100%; }
.floating-label { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); font-size: 14px; color: #94a3b8; pointer-events: none; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
.fi:focus + .floating-label, .fi:not(:placeholder-shown) + .floating-label { top: 12px; font-size: 11px; font-weight: 600; color: #ea580c; }
.fi:not(:placeholder-shown) + .floating-label { color: #64748b; }
.fi { padding: 24px 16px 8px; }
.fi { width: 100%; padding: 12px 16px; border: 1.5px solid #eaeaea; border-radius: 12px; font-size: 0.95rem; font-family: inherit; transition: all 0.2s; background: #fff; box-shadow: 0 6px 16px rgba(0,0,0,0.06); }
.fi:focus { border-color: #F05A23; outline: none; background: #fffaf8; box-shadow: 0 10px 25px rgba(240,90,35,0.15); }
.fi.readonly-input, .readonly-input { 
  background-color: transparent !important; 
  color: #64748b !important; 
  cursor: default !important; 
  border-color: transparent !important; 
  box-shadow: none !important; 
  pointer-events: none; 
}
.fi-date-be { display: flex; gap: 8px; }
.s-d { flex: 1; } .s-m { flex: 1.5; } .s-y { flex: 1.2; }
.pc-custom-sel { width: 100%; max-width: 100%; display: block; flex: 1; }
.pc-custom-sel :deep(.select-trigger) { min-height: 48px; padding: 14px 16px 6px; border-radius: 12px; border-color: #eaeaea; box-shadow: 0 6px 16px rgba(0,0,0,0.06); }
.pc-custom-sel :deep(label) { display: none; }
.pc-custom-sel :deep(.trigger-text) { padding-right: 18px; text-align: left; }
.disease-selector { width: 100%; max-width: 100%; }
.disease-btns { display: flex; gap: 8px; }
.d-btn { flex: 1; padding: 10px; border: 1.5px solid #eaeaea; border-radius: 8px; background: #fff; font-size: 0.95rem; font-weight: 500; color: #666; cursor: pointer; transition: all 0.2s; }
.d-btn.active { border-color: #F05A23; background: #F05A23; color: #fff; font-weight: 600; }
.btn-primary { background: #F05A23; color: #fff; border: none; padding: 10px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; text-align: center; transition: background 0.2s; }
.btn-primary:hover { background: #d64a18; }
.btn-outline { background: #fff; color: #F05A23; border: 1px solid #F05A23; padding: 10px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; text-align: center; transition: background 0.2s; }
.btn-outline:hover { background: #fff5f2; }
.w-full { width: 100%; } .w-auto { width: auto; min-width: 100px; }
.t-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.t-box { background: #fff; padding: 16px; border-radius: 14px; border: 1px solid #f0f0f0; box-shadow: 0 10px 25px rgba(0,0,0,0.07); }
.full-w { grid-column: span 2; }
.t-accent { background: #fef0eb; border-color: #fbd6c6; }
.t-box-l { font-size: 0.8rem; color: #757575; margin-bottom: 6px; }
.t-box-v { font-size: 1.25rem; font-weight: 700; color: #333; }
.t-box-u { font-size: 0.85rem; margin-left: 4px; font-weight: 400; color: #757575; }
.t-box-s { font-size: 0.75rem; color: #757575; margin-top: 6px; }
.tanita-wrap { display: flex; flex-direction: column; gap: 0; }
.btn-outline-tanita { align-self: flex-end; background: #fff; border: 1px solid #F05A23; color: #F05A23; padding: 6px 14px; border-radius: 4px; font-size: 0.82rem; font-weight: 600; cursor: pointer; margin-bottom: 12px; transition: background 0.2s; }
.btn-outline-tanita:hover { background: #fef0eb; }
.tanita-date { font-size: 0.85rem; color: #757575; text-align: right; margin-bottom: 16px; }
.bmi-zone { display: flex; flex-direction: column; align-items: center; background: #fff; border: 1px solid #efefef; border-radius: 8px; padding: 16px; text-align: center; box-shadow: 0 8px 25px rgba(0,0,0,0.03); }
.bmi-img { height: 100px; object-fit: contain; margin-bottom: 12px; }
.bmi-label { font-size: 1rem; font-weight: 700; }
.bmi-val { background: #f5f5f5; padding: 4px 10px; border-radius: 10px; font-size: 0.78rem; margin-top: 4px; }
.bmi-ideal { font-size: 0.85rem; margin-top: 12px; color: #757575; }
.bmi-badge { margin-top: 12px; padding: 4px 16px; border-radius: 16px; font-size: 0.75rem; font-weight: bold; align-self: flex-start; }
.bmi-scale-container { width: 100%; margin-top: 20px; position: relative; padding: 4px 0; }
.bmi-scale-line { height: 4px; border-radius: 2px; background: linear-gradient(to right, #e0f2fe, #dcfce7, #fef9c3, #ffedd5, #fee2e2); }
.bmi-marker { position: absolute; top: -1px; width: 10px; height: 10px; background: #fff; border: 2px solid #333; border-radius: 50%; transform: translateX(-50%); transition: left 0.3s ease; }
.bmi-dot { display: none; }
.bmi-dot-active { display: none; }
.bmi-desc-box { font-size: 0.8rem; padding: 12px; border-radius: 6px; margin-top: 20px; width: 100%; line-height: 1.5; }
.bmi-info-wrap { display: flex; flex-direction: column; align-items: center; width: 100%; }
.team-wrap { display: flex; align-items: center; gap: 16px; padding: 16px; background: #fff; border-radius: 14px; border: 1px solid #f0f0f0; cursor: pointer; box-shadow: 0 10px 30px rgba(0,0,0,0.08); }
.team-ico { width: 48px; height: 48px; background: #F05A23; color: #fff; display: flex; align-items: center; justify-content: center; border-radius: 10px; }
.team-details { flex: 1; }
.team-name { font-weight: 700; font-size: 1.05rem; margin-bottom: 4px; }
.team-sub { font-size: 0.85rem; color: #757575; }

/* Calendar Tab Layout */
.calendar-layout {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
@media (min-width: 1024px) {
  .calendar-layout {
    flex-direction: row;
    align-items: flex-start;
  }
}

.calendar-sidebar {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
}
@media (min-width: 1024px) {
  .calendar-sidebar {
    width: 280px;
  }
}

.calendar-main {
  flex: 1;
  min-width: 0;
}

/* Header Stats */
.calendar-header-stats {
  margin-bottom: 24px;
  display: flex;
  justify-content: center;
}

.streak-cool-header {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #fff;
  padding: 6px 16px;
  border-radius: 99px;
  box-shadow: 0 4px 15px rgba(244, 63, 94, 0.1);
  border: 1px solid #fff5f5;
  margin-right: 12px;
}

.streak-cool-header .streak-fire-wrap {
  width: 32px;
  height: 32px;
}

.streak-cool-header .fire-emoji {
  font-size: 20px;
}

.streak-cool-header .fire-glow {
  width: 24px;
  height: 24px;
}

.streak-cool-header .streak-count {
  font-size: 16px;
}

.tooltip-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fef9c3;
  border: 1px solid #fde047;
  color: #eab308;
  width: 26px;
  height: 26px;
  min-width: 26px;
  min-height: 26px;
  aspect-ratio: 1;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s;
  z-index: 10;
  flex-shrink: 0;
}
.tooltip-btn:hover {
  background: #facc15; /* yellow-400 */
  color: #fff;
  border-color: #facc15;
  transform: scale(1.05);
  box-shadow: 0 2px 6px rgba(250, 204, 21, 0.4);
}

.streak-cool-header {
  font-size: 9px;
}

@media (max-width: 768px) {
  .streak-cool-header {
    padding: 4px 12px;
    margin-right: 0;
  }
}

.streak-cool {
  display: flex;
  align-items: center;
  gap: 16px;
  background: #fff;
  padding: 12px 24px;
  border-radius: 99px;
  box-shadow: 0 10px 25px rgba(244, 63, 94, 0.1);
  border: 1px solid #fff5f5;
  animation: float 3s ease-in-out infinite;
}

.streak-fire-wrap {
  position: relative;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fire-emoji {
  font-size: 32px;
  position: relative;
  z-index: 2;
  animation: fire-vibe 0.5s ease-in-out infinite alternate;
}

.fire-glow {
  position: absolute;
  width: 40px;
  height: 40px;
  background: #f43f5e;
  filter: blur(15px);
  border-radius: 50%;
  opacity: 0.6;
  animation: pulse-glow 2s infinite;
}

.streak-count {
  font-size: 24px;
  font-weight: 900;
  color: #1e293b;
  line-height: 1;
}


@keyframes fire-vibe {
  from { transform: scale(1) rotate(-2deg); }
  to { transform: scale(1.1) rotate(2deg); }
}

@keyframes pulse-glow {
  0%, 100% { transform: scale(1); opacity: 0.4; }
  50% { transform: scale(1.3); opacity: 0.7; }
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}

/* Sidebar Filtering */
.sidebar-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 12px;
  padding-left: 8px;
}

.activity-filter-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filter-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.filter-item:hover {
  background: #f8fafc;
}

.filter-item.active {
  background: #fff;
  border-color: #F05A23;
  box-shadow: 0 4px 12px rgba(240, 90, 35, 0.08);
}

.filter-icon {
  width: 32px;
  height: 32px;
  background: #f1f5f9;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
}

.filter-item.active .filter-icon {
  background: #fef0eb;
  color: #F05A23;
}

.filter-thumb {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  overflow: hidden;
  background: #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #cbd5e1;
}

.filter-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.filter-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: #334155;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.filter-item.active .filter-name {
  color: #F05A23;
}

@media (max-width: 1023px) {
  .activity-filter-list {
    flex-direction: row;
    overflow-x: auto;
    padding-bottom: 8px;
    scrollbar-width: none;
  }
  .activity-filter-list::-webkit-scrollbar { display: none; }
  .filter-item {
    min-width: 140px;
    background: #f8fafc;
  }
}

.m-status-icon-new {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: #f8fafc;
  border-radius: 10px;
}

.m-emoji {
  font-size: 18px;
  line-height: 1;
}

.m-status-icon-new .fire { color: #f97316; }
.m-status-icon-new .upcoming { color: #64748b; }
.m-status-icon-new .missed { color: #ef4444; }

/* Day Missions */
.mission-list { display: flex; flex-direction: column; gap: 12px; }
.calendar-legend {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 12px;
  background: #f8fafc;
  border-radius: 12px;
  flex-wrap: wrap;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}
.legend-color {
  width: 16px;
  height: 16px;
  border-radius: 4px;
}
.legend-text {
  font-size: 0.85rem;
  font-weight: 600;
  color: #64748b;
}
.mission-item { display: flex; align-items: center; gap: 16px; padding: 14px; background: #f8fafc; border-radius: 12px; border: 1px solid #edf2f7; }
.m-status-icon { color: #94a3b8; display: flex; align-items: center; justify-content: center; width: 8px; height: 16px; margin-left: 0px; margin-right: 0px; }
.m-info { flex: 1; }
.m-title { font-size: 1rem; font-weight: 700; color: #1e293b; }
.m-meta { font-size: 0.85rem; color: #64748b; }
.m-badge { font-size: 0.75rem; font-weight: 700; padding: 4px 10px; border-radius: 6px; }
.m-badge.approved { background: #dcfce7; color: #166534; }
.m-badge.pending { background: #fef3c7; color: #92400e; }
.m-badge.rejected { background: #fee2e2; color: #991b1b; }
.m-badge.missed { background: #fee2e2; color: #ef4444; }
.m-badge.upcoming { background: #f8fafc; color: #94a3b8; border: 1px solid #e2e8f0; }
.m-badge.active { background: #fef3c7; color: #92400e; }

/* Titles Tab */
.titles-container-compact { display: flex; flex-direction: column; gap: 20px; }
.titles-header-box { background: #fff; padding: 20px; border-radius: 16px; border: 1.5px solid #edf2f7; display: flex; flex-direction: column; gap: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.02); }
.titles-stats-row { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.titles-count-info { display: flex; flex-direction: column; }
.count-label { font-size: 0.75rem; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
.count-value { font-size: 1.25rem; font-weight: 800; color: #1e293b; }
.titles-progress-container { flex: 1; display: flex; align-items: center; gap: 12px; max-width: 300px; }
.titles-progress-bar { flex: 1; height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden; }
.titles-progress-fill { height: 100%; background: linear-gradient(90deg, #F05A23 0%, #FF8533 100%); border-radius: 4px; transition: width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); }
.progress-percent { font-size: 0.85rem; font-weight: 700; color: #F05A23; min-width: 40px; text-align: right; }
.titles-search-wrap { width: 100%; }
.title-search-input { width: 100%; padding: 10px 16px; border-radius: 12px; border: 1.5px solid #f1f5f9; background: #f8fafc; font-size: 0.9rem; transition: all 0.2s; }
.title-search-input:focus { border-color: #F05A23; background: #fff; outline: none; box-shadow: 0 0 0 4px rgba(240, 90, 35, 0.1); }
.titles-grid-compact {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}
@media (max-width: 640px) {
  .titles-grid-compact { grid-template-columns: repeat(2, 1fr); gap: 8px; }
}
.title-box-compact {
  background: #fff; border: 1px solid #edf2f7; border-radius: 12px; padding: 12px;
  display: flex; flex-direction: column; justify-content: space-between; gap: 10px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); position: relative; overflow: hidden;
}
.title-box-compact:hover { transform: translateY(-2px); border-color: #cbd5e1; box-shadow: 0 6px 12px rgba(0,0,0,0.05); }
.title-box-compact.is-equipped { background: #fffaf5; border-color: #F05A23; box-shadow: 0 4px 12px rgba(240, 90, 35, 0.1); }
.title-box-compact.is-locked { background: #f8fafc; border-color: #e2e8f0; }
.t-desc-mini { font-size: 0.85rem; color: #64748b; margin: 4px 0 0; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; }
.t-hint-mini { font-size: 0.8rem; color: #94a3b8; margin: 4px 0 0; display: flex; align-items: center; gap: 4px; font-style: italic; }
.title-action-wrap { display: flex; gap: 4px; }
.btn-mini-action {
  flex: 1; padding: 6px; border-radius: 8px; border: 1px solid #F05A23; background: #fff;
  color: #F05A23; font-size: 0.75rem; font-weight: 700; cursor: pointer; transition: all 0.15s;
  display: flex; align-items: center; justify-content: center; gap: 4px;
}
.btn-mini-action:hover { background: #fff5f2; }
.btn-mini-action.equipped { background: #F05A23; color: #fff; border-color: #F05A23; }
.btn-mini-claim {
  flex: 1; padding: 6px; border-radius: 8px; border: none;
  background: linear-gradient(135deg, #F05A23 0%, #FF8533 100%);
  color: #fff; font-size: 0.75rem; font-weight: 700; cursor: pointer; transition: all 0.15s;
}
.btn-mini-claim:hover { opacity: 0.9; transform: scale(1.02); }
.btn-mini-code { background: linear-gradient(135deg, #1e293b 0%, #334155 100%); display: flex; align-items: center; justify-content: center; gap: 4px; }
.lock-icon-only { width: 100%; display: flex; justify-content: center; color: #cbd5e1; padding: 4px; }

/* Empty States */
.empty-mini {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px;
  background: #f8fafc;
  border-radius: 16px;
  border: 1px dashed #e2e8f0;
  color: #94a3b8;
  font-size: 0.9rem;
}
.section-title-sm { font-size: 1rem; font-weight: 700; color: #334155; }
.m-yellow { background: #f59e0b; color: #fff; border-color: transparent; }
.ev-list { display: flex; flex-direction: column; gap: 12px; }
.ev-card { display: flex; gap: 16px; padding: 12px; background: #fff; border-radius: 14px; border: 1px solid #f0f0f0; cursor: pointer; box-shadow: 0 10px 25px rgba(0,0,0,0.07); }
.ev-poster { width: 64px; height: 64px; border-radius: 8px; overflow: hidden; background: #eee; flex-shrink: 0; }
.ev-poster img { width: 100%; height: 100%; object-fit: cover; }
.ev-fallback { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #ccc; }
.ev-info { flex: 1; display: flex; flex-direction: column; justify-content: center; }
.ev-name { font-weight: 700; font-size: 0.95rem; margin-bottom: 4px; }
.ev-date { font-size: 0.75rem; color: #757575; margin-bottom: 6px; }
.ev-bottom { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.ev-score { background: #fef0eb; color: #F05A23; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; }
.ev-goal { background: #fff8e1; color: #f57f17; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; text-align: center; }
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.3s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
.modal-fade-enter-active .modal-sheet { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
.modal-fade-leave-active .modal-sheet { animation: slideDown 0.2s ease-in; }
@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
@keyframes slideDown { from { transform: translateY(0); } to { transform: translateY(100%); } }
.av-large { position: relative; width: 100px; height: 100px; border-radius: 50%; border: 1px solid #efefef; display: flex; align-items: center; justify-content: center; background: #fafafa; font-size: 36px; color: #ccc; overflow: hidden; margin: 0 auto 16px; cursor: pointer; }
.av-edit-overlay { position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.5); height: 32px; display: flex; align-items: center; justify-content: center; color: white; }
.uploading-overlay { position: absolute; inset: 0; background: rgba(255,255,255,0.7); display: flex; align-items: center; justify-content: center; color: #F05A23; }
.av-large img { width: 100%; height: 100%; object-fit: cover; }
.mobile-split .av-large { width: 100px; height: 100px; }
@media (min-width: 768px) {
  .app-wrap.is-desktop { padding: 40px 24px; }
  .layout-container {
    max-width: 1440px;
    margin: 0 auto;
    display: flex;
    gap: 32px;
    align-items: flex-start;
  }
  .nav-sidebar {
    width: 250px;
    flex-shrink: 0;
  }
  .pc-profile-brief {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-bottom: 24px;
    border-bottom: 1px solid #efefef;
    margin-bottom: 20px;
  }
  .pc-avatar {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: #f0f0f0;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    color: #F05A23;
  }
  .pc-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .pc-brief-info { flex: 1; }
  .pc-username { font-weight: 700; font-size: 0.95rem; color: #333; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 170px; }
  .pc-edit-link { font-size: 0.8rem; color: #888; display: flex; align-items: center; gap: 4px; cursor: pointer; transition: color 0.2s; }
  .pc-edit-link:hover { color: #F05A23; }
  .menu-items-container {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .menu-item {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.2s;
  }
  .menu-item:hover { background: transparent; }
  .menu-item.active .menu-label { font-weight: 700; }
  .menu-item.active .menu-icon-wrap { transform: scale(1.05); }
  
  .menu-item.mi-dashboard.active .menu-label { color: #a855f7; }
  .menu-item.mi-dashboard.active .menu-icon-wrap { border-color: #a855f7; }
  
  .menu-item.mi-general.active .menu-label { color: #3b82f6; }
  .menu-item.mi-general.active .menu-icon-wrap { border-color: #3b82f6; }
  
  .menu-item.mi-contact.active .menu-label { color: #f97316; }
  .menu-item.mi-contact.active .menu-icon-wrap { border-color: #f97316; }
  
  .menu-item.mi-tanita.active .menu-label { color: #22c55e; }
  .menu-item.mi-tanita.active .menu-icon-wrap { border-color: #22c55e; }
  
  .menu-item.mi-calendar.active .menu-label { color: #ec4899; }
  .menu-item.mi-calendar.active .menu-icon-wrap { border-color: #ec4899; }
  
  .menu-item.mi-titles.active .menu-label { color: #eab308; }
  .menu-item.mi-titles.active .menu-icon-wrap { border-color: #eab308; }
  
  .menu-item.mi-events.active .menu-label { color: #ef4444; }
  .menu-item.mi-events.active .menu-icon-wrap { border-color: #ef4444; }
  .menu-icon-wrap { width: 34px; height: 34px; border-radius: 10px; border: 1.5px solid #eaeaea; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
  .menu-icon { width: 17px; height: 17px; }
  .menu-label { font-size: 1rem; text-align: left; color: #334155; font-weight: 500; transition: color 0.2s; }
  .pc-only { display: flex; }
  .logout-item { margin-top: 24px; border-top: 1px solid #efefef; padding-top: 24px; border-radius: 0; }
  .logout-item:hover { background: transparent; }
  .logout-item .menu-label { color: #555; }
  .logout-item .menu-icon-wrap { color: #64748b; background: #f1f5f9; border-color: #cbd5e1; }
  .logout-item:hover .menu-label { color: #dc2626; }
  .content-area {
    flex: 1;
    min-width: 0;
  }
  .content-card {
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.08);
    padding: 64px;
  }
  .card-header { padding: 0 0 20px 0; align-items: flex-start; }
  .card-title { font-size: 1.5rem; font-weight: 800; color: #1e293b; }
  .card-subtitle { font-size: 0.95rem; color: #64748b; margin-top: 6px; }
  .card-body { padding: 20px 0 0 0; overflow-y: visible; }
  .profile-split-layout { display: flex; flex-direction: column; gap: 40px; align-items: center; }
  .profile-form-area { width: 100%; max-width: 500px; border-right: none; }
  .profile-avatar-area { width: 100%; display: flex; flex-direction: column; align-items: center; padding-bottom: 24px; }
  .av-large { width: 120px; height: 120px; margin-bottom: 0; }
  .btn-outline-sm { background: #fff; border: 1px solid #ddd; padding: 8px 16px; border-radius: 6px; font-size: 0.85rem; color: #555; cursor: pointer; transition: background 0.2s; display: flex; align-items: center; justify-content: center; min-width: 90px; }
  .btn-outline-sm:hover { background: #fafafa; }
  .av-hint { font-size: 0.75rem; color: #888; text-align: center; margin-top: 16px; line-height: 1.5; }
  .shopee-f-row { flex-direction: row; align-items: center; margin-bottom: 24px; gap: 20px; }
  .shopee-f-row.editing-row { flex-direction: column; align-items: stretch; gap: 4px; margin-bottom: 24px; display: flex; }
  .shopee-f-label { width: 140px; text-align: left; margin: 0; flex-shrink: 0; color: #555; }
  .shopee-f-val { flex: 1; min-height: auto; padding: 0; justify-content: flex-start; text-align: left; }
  .editing-row .shopee-f-val { max-width: 100%; width: 100%; display: flex; flex-direction: column; }
  .editing-row .shopee-f-val .flex { flex-direction: row; }
  .fi { max-width: 100%; padding: 24px 16px 8px; border-radius: 12px; }
  .fi-date-be { max-width: 100%; }
  .btn-primary { border-radius: 6px; padding: 10px 24px; }
  .t-grid { grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .t-box { padding: 20px; }
  .bmi-zone { padding: 32px; border-radius: 10px; flex-direction: column; gap: 24px; align-items: center; text-align: center; }
  .bmi-img { height: 180px; margin: 0; flex-shrink: 0; }
  .bmi-info-wrap { width: 100%; display: flex; flex-direction: column; align-items: center; }
  .bmi-top-row { display: flex; align-items: center; justify-content: center; gap: 12px; flex-wrap: wrap; width: 100%; text-align: center; }
  .bmi-tabs { display: none; }
  .bmi-scale-container { width: 100%; margin-top: 24px; position: relative; padding: 4px 0; }
  .bmi-scale-line { height: 6px; border-radius: 3px; background: linear-gradient(to right, #0369a1, #10b981, #ca8a04, #ea580c, #dc2626); }
  .bmi-marker { position: absolute; top: 0; width: 14px; height: 14px; background: #fff; border: 3px solid #333; border-radius: 50%; transform: translateX(-50%); transition: left 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
  .team-profile-wrap { padding: 4px; }
  .team-header-card { display: flex; align-items: center; gap: 20px; padding: 20px; background: #faf8ff; border-radius: 12px; border: 1px solid #f3e8ff; }
  .team-ico, .team-ico-placeholder { width: 72px; height: 72px; border-radius: 14px; }
  .team-name { font-size: 1.3rem; margin: 0 0 6px 0; }
  .team-stats-row { flex-direction: row; gap: 16px; }
  .ts-item { font-size: 0.85rem; }
  .progress-info { font-size: 0.9rem; }
  .progress-bar-bg { height: 10px; }
  .progress-footer { font-size: 0.8rem; }
  .list-title { font-size: 1rem; }
  .members-grid { grid-template-columns: repeat(auto-fill, minmax(60px, 1fr)); gap: 12px; }
  .m-avatar { width: 44px; height: 44px; }
  .m-name { font-size: 0.75rem; }
  .ev-card { padding: 16px; border-radius: 10px; }
  .ev-poster { width: 80px; height: 80px; border-radius: 8px; }
  .ev-name { font-size: 1.1rem; }
}
@media (min-width: 1024px) {
  .profile-split-layout { flex-direction: row; align-items: flex-start; justify-content: space-between; }
  .profile-form-area { flex: 1; padding-right: 40px; border-right: 1px solid #efefef; max-width: 600px; order: 1; }
  .profile-avatar-area { width: 280px; flex-shrink: 0; order: 2; padding-bottom: 0; }
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.tanita-header-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.btn-outline-tanita { background: #fff; border: 1px solid #F05A23; color: #F05A23; padding: 6px 14px; border-radius: 4px; font-size: 0.82rem; font-weight: 600; cursor: pointer; white-space: nowrap; transition: background 0.2s; }
.btn-outline-tanita:hover { background: #fef0eb; }
.mobile-recommended-section { padding: 16px 16px 80px; background: transparent; }
.section-divider-row { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding: 0 4px; }
.section-divider-row .line { flex: 1; height: 1px; background: #e0e0e0; }
.section-title-rec { font-size: 1.1rem; font-weight: 700; color: #F05A23; white-space: nowrap; }
.rec-grid-masonry { 
  display: flex; 
  gap: 12px;
  align-items: flex-start;
  width: 100%;
}
.masonry-col {
  flex: 1;
  width: 50%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.shopee-card {
  background: #fff; border: 1px solid rgba(0,0,0,0.1); border-radius: 8px; cursor: pointer;
  display: flex; flex-direction: column; overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  width: 100%;
}
.sc-poster { position: relative; width: 100%; aspect-ratio: 1/1; background: #e2e8f0; overflow: hidden; }
.shopee-card.is-tall .sc-poster { aspect-ratio: 1/1.4; }
.sc-poster img { width: 100%; height: 100%; object-fit: cover; display: block; }
.sc-body { padding: 8px; display: flex; flex-direction: column; flex: 1; gap: 4px; min-height: 100px; }
.sc-title-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 4px; }
.sc-title { font-size: 0.9rem; color: #111; line-height: 1.35; height: 2.7em; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; margin: 0; font-weight: 600; flex: 1; white-space: normal; }
.sc-heart-ico { width: 18px; height: 18px; color: #ccc; cursor: pointer; transition: all 0.2s; flex-shrink: 0; margin-top: 2px; stroke-width: 2.5px; }
.sc-heart-ico.active { color: #f53d2d; fill: #f53d2d; transform: scale(1.1); }
.sc-info-row { display: flex; flex-direction: column; gap: 2px; font-size: 0.78rem; color: #777; margin-top: 2px; }
.sc-info-line { display: flex; gap: 4px; align-items: center; }
.sc-info-label { font-weight: 600; color: #444; white-space: nowrap; font-size: 0.78rem; }
.text-truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; font-weight: 400; }
.rec-badge { position: absolute; top: 0; left: 0; background: #f53d2d; color: #fff; font-size: 11px; padding: 4px 8px; font-weight: 700; z-index: 1; border-top-left-radius: 2px; border-bottom-right-radius: 8px; }
.is-banner img { object-position: center; }
.is-banner .sc-poster { aspect-ratio: 1/1.65 !important; }
.banner-slider { position: relative; overflow: hidden; width: 100%; height: 100%; }
.banner-track { display: flex; transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1); height: 100%; }
.banner-slide { min-width: 100%; height: 100%; flex-shrink: 0; }
.banner-slide img { width: 100%; height: 100%; object-fit: cover; }
.banner-dots { position: absolute; bottom: 8px; left: 0; right: 0; display: flex; justify-content: center; gap: 5px; z-index: 2; }
.banner-dots .dot { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,0.4); }
.banner-dots .dot.active { background: #fff; width: 14px; border-radius: 3px; }
.rec-more-wrap { display: flex; justify-content: center; margin-top: 24px; }
.btn-rec-more { background: #fff; border: 1px solid #e0e0e0; color: #555; padding: 8px 32px; border-radius: 2px; font-size: 13px; cursor: pointer; transition: background 0.2s; }
.btn-rec-more:hover { background: #fafafa; }
.rec-more-wrap { display: flex; justify-content: center; margin-top: 24px; }
.btn-rec-more { background: #fff; border: 1px solid #e0e0e0; color: #555; padding: 8px 32px; border-radius: 2px; font-size: 13px; cursor: pointer; transition: background 0.2s; }
.btn-rec-more:hover { background: #fafafa; }
.profile-preview-section { width: 100%; }
.preview-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.preview-title { font-size: 1.1rem; font-weight: 700; color: #333; margin: 0; }
.mt-10 { margin-top: 40px; }
/* Stats Preview Bar */
.stats-preview-bar {
  display: flex;
  background: #f8fafc;
  border-bottom: 1px solid #edf2f7;
  padding: 14px 0;
  animation: fadeIn 0.3s ease;
}
.stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
}
.stat-divider {
  width: 1px;
  background: #e2e8f0;
  height: 28px;
  margin-top: 4px;
}
.stat-label {
  font-size: 0.65rem;
  color: #64748b;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.stat-val {
  font-size: 1.15rem;
  font-weight: 800;
  color: #1e293b;
  line-height: 1.2;
}
.stat-val small {
  font-size: 0.75rem;
  font-weight: 600;
  color: #94a3b8;
  margin-left: 1px;
}
.stat-val-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.stat-badge {
  font-size: 0.62rem;
  padding: 1px 8px;
  border-radius: 9999px;
  font-weight: 700;
  white-space: nowrap;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-5px); }
  to { opacity: 1; transform: translateY(0); }
}
@media (max-width: 640px) {
  .stats-preview-bar { padding: 12px 0; }
  .stat-val { font-size: 1.05rem; }
  .stat-label { font-size: 0.6rem; }
}
</style>
<style>
.tn-overlay { position: fixed; inset: 0; background: #fff; z-index: 200; display: block; overflow-y: auto; }
@media (min-width: 640px) { .tn-overlay { background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; } }
.tn-sheet {
  background: #fff;
  width: 100%;
  min-height: 100dvh;
  margin: 0;
  border-radius: 0;
  display: flex;
  flex-direction: column;
  animation: tnSlideUp 0.28s cubic-bezier(0.16,1,0.3,1);
}
@media (min-width: 640px) { 
  .tn-sheet { 
    max-width: 620px;
    min-height: auto;
    height: auto;
    border-radius: 12px; 
    max-height: 86vh; 
    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
  } 
}
@keyframes tnSlideUp { from { transform: translateY(32px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
.tn-header { display: flex; align-items: center; padding: 12px 16px; border-bottom: 1px solid #efefef; min-height: 56px; gap: 12px; flex-shrink: 0; }
.tn-title { font-size: 1.15rem; font-weight: 700; color: #333; flex: 1; }
.header-actions-left { cursor: pointer; display: flex; align-items: center; }
.tn-close { background: #f5f5f5; border: none; border-radius: 50%; width: 32px; height: 32px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #666; transition: background 0.15s; }
.tn-close:hover { background: #ebebeb; }
.tn-mode-bar { display: flex; gap: 8px; padding: 12px 20px; border-bottom: 1px solid #f0f0f0; flex-shrink: 0; }
.tn-mode-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 9px 12px; border: 1.5px solid #e5e5e5; border-radius: 8px; background: #fafafa; font-size: 0.84rem; cursor: pointer; font-weight: 500; color: #666; transition: all 0.15s; font-family: inherit; }
.tn-mode-btn:hover { border-color: #ccc; color: #333; }
.tn-mode-btn.active { background: #fef0eb; border-color: #F05A23; color: #F05A23; font-weight: 700; }
.tn-body { 
  flex: 1; 
  overflow-y: auto; 
  padding: 16px 20px 8px; 
  display: flex; 
  flex-direction: column; 
  gap: 12px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.tn-body::-webkit-scrollbar { display: none; }
.tn-ai-inline { margin-bottom: 4px; }
.tn-ai-loading { display: flex; align-items: center; gap: 10px; padding: 14px 0; color: #F05A23; font-size: 0.85rem; }
.tn-upload-trigger { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; border: 2px dashed #cbd5e1; border-radius: 16px; padding: 32px 16px; cursor: pointer; color: #64748b; font-size: 15px; font-weight: 500; background: #f8fafc; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
.tn-upload-trigger:hover, .tn-upload-trigger.dragging { border-color: #ea580c; background: #fffaf5; color: #ea580c; border-style: solid; box-shadow: 0 10px 25px rgba(234, 88, 12, 0.1); transform: translateY(-2px); }
.tn-sub { font-size: 0.8rem; color: #94a3b8; font-weight: 400; }
.tn-divider-label { font-size: 0.85rem; font-weight: 700; color: #64748b; margin-top: 12px; margin-bottom: 4px; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0; }
.tn-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.tn-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
.tn-f-group { display: flex; flex-direction: column; gap: 3px; position: relative; }
.tn-f-group label { position: absolute; top: 16px; left: 16px; font-size: 14px; color: #94a3b8; pointer-events: none; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
.tn-f-group input { width: 100%; padding: 24px 16px 8px; border: 1.5px solid #cbd5e1; border-radius: 14px; font-size: 1rem; box-sizing: border-box; transition: all 0.2s; background: #fff; font-family: inherit; color: #1e293b; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
.tn-f-group input:focus { border-color: #ea580c; outline: none; box-shadow: 0 8px 20px rgba(234, 88, 12, 0.12); }
.tn-f-group input:focus + label, .tn-f-group input:not(:placeholder-shown) + label { top: 6px; font-size: 11px; font-weight: 600; color: #ea580c; }
.tn-f-group input:not(:placeholder-shown) + label { color: #64748b; }
.tn-f-group input::placeholder { color: transparent; }
.tn-footer { padding: 14px 20px; border-top: 1px solid #f0f0f0; display: flex; gap: 10px; flex-shrink: 0; }
.tn-btn-cancel { flex: 1; padding: 10px; border: 1px solid #F05A23; border-radius: 8px; background: #fff; font-size: 0.9rem; cursor: pointer; color: #F05A23; font-weight: 600; font-family: inherit; transition: background 0.15s; }
.tn-btn-cancel:hover { background: #fff5f2; }
.tn-btn-save { flex: 2; padding: 10px; border: none; border-radius: 8px; background: #F05A23; color: #fff; font-size: 0.9rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: background 0.2s; font-family: inherit; }
.tn-btn-save:hover:not(:disabled) { background: #d64a18; }
.tn-btn-save:disabled { opacity: 0.65; cursor: not-allowed; }
.ai-insights-dashboard { margin-top: 16px; display: flex; flex-direction: column; gap: 20px; }
.ins-intro { margin-bottom: 8px; }
.ins-title { font-size: 1rem; font-weight: 700; color: #1f2937; }
.ins-sub { font-size: 0.82rem; color: #6b7280; margin-top: 2px; }
.ins-grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
.ins-card { padding: 16px; border-radius: 10px; border: 1px solid #efefef; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 8px 20px rgba(0,0,0,0.04); transition: transform 0.2s, box-shadow 0.2s; }
.ins-card:hover { transform: translateY(-4px); box-shadow: 0 12px 30px rgba(0,0,0,0.08); }
.ins-card.bg-orange { background: #fffaf5; border-color: #ffedd5; }
.ins-card.bg-blue { background: #f0f9ff; border-color: #e0f2fe; }
.ins-card.bg-purple { background: #faf5ff; border-color: #f3e8ff; }
.ins-card.bg-red { background: #fef2f2; border-color: #fee2e2; }
.ins-card.bg-teal { background: #f0fdfa; border-color: #ccfbf1; }
.ins-card.bg-green { background: #f0fdf4; border-color: #bbf7d0; }
.ins-head { font-size: 0.95rem; font-weight: 600; color: #374151; display: flex; align-items: center; gap: 8px; }
.ins-card.bg-orange .ins-head { color: #ea580c; }
.ins-card.bg-blue .ins-head { color: #0284c7; }
.ins-card.bg-purple .ins-head { color: #9333ea; }
.ins-card.bg-red .ins-head { color: #dc2626; }
.ins-card.bg-teal .ins-head { color: #0d9488; }
.ins-card.bg-green .ins-head { color: #16a34a; }
.ins-val { font-size: 1.35rem; font-weight: 700; color: #111827; }
.ins-desc, .ins-action { font-size: 0.82rem; color: #4b5563; line-height: 1.45; }
.ins-desc strong, .ins-action strong { color: #1f2937; }
.ins-summary-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.03); }
.is-sim-controls { display: flex; flex-direction: column; }
.is-goal-picker { flex: 1; min-width: 220px; }
.goal-mini-select :deep(.select-trigger) { min-height: 40px; padding: 10px 12px 2px; background: #fff; border-color: #e2e8f0; font-size: 0.85rem; border-radius: 8px; }
.goal-mini-select :deep(label) { display: none !important; }
.goal-mini-select :deep(.select-caret) { top: 20px; border-top-color: #94a3b8; }
.is-list { display: flex; flex-direction: column; gap: 12px; }
.is-title { font-size: 1.1rem; font-weight: 700; color: #0f172a; margin: 0; }
.is-item { font-size: 1rem; color: #334155; }
/* Mission Stats Summary */
.stats-grid-simple { display: flex; flex-direction: column; gap: 12px; }
.stat-row { background: #fff; border-radius: 12px; padding: 16px; border: 1px solid #f0f0f0; box-shadow: 0 4px 12px rgba(0,0,0,0.03); display: flex; justify-content: space-between; align-items: center; transition: transform 0.2s; }
.stat-row:hover { transform: translateY(-2px); border-color: #e2e8f0; }
.stat-t-name { font-weight: 700; color: #1e293b; font-size: 0.95rem; }
.stat-e-name { font-size: 0.75rem; color: #64748b; margin-top: 2px; }
.stat-metrics { display: flex; gap: 16px; text-align: right; }
.metric { display: flex; flex-direction: column; gap: 2px; }
.m-label { font-size: 0.7rem; color: #94a3b8; font-weight: 600; text-transform: uppercase; }
.m-val { font-size: 0.9rem; font-weight: 800; color: #334155; }
.m-val.success { color: #16a34a; }
.m-val.danger { color: #dc2626; }
/* Mission Stats – always horizontal; on mobile make text smaller & tighter */
@media (max-width: 640px) {
  .stat-row { padding: 12px; gap: 8px; align-items: center; }
  .stat-t-name { font-size: 0.82rem; }
  .stat-e-name { font-size: 0.68rem; }
  .stat-metrics { gap: 12px; flex-shrink: 0; }
  .m-label { font-size: 0.6rem; }
  .m-val { font-size: 0.85rem; }
}



/* Calendar Dropdown & Layout V2 */
.cal-dropdown-backdrop { position: fixed; inset: 0; z-index: 100; cursor: default; }
.calendar-layout-v2 { display: flex; flex-direction: column; gap: 0; position: relative; }
.calendar-main-v2 { flex: 1; min-width: 0; width: 100%; max-width: 1200px; margin: 0 auto; }
.cal-filter-wrap { position: relative; z-index: 110; max-width: 440px; margin: 0 auto; }
.cal-dropdown-trigger { width: 100%; display: flex; align-items: center; justify-content: center; gap: 12px; padding: 12px 16px; background: #fff; border: 1.5px solid #e2e8f0; border-radius: 14px; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
.cal-dropdown-trigger:hover { border-color: #F05A23; box-shadow: 0 6px 16px rgba(240,90,35,0.08); }
.cal-trigger-thumb { width: 24px; height: 24px; border-radius: 6px; overflow: hidden; flex-shrink: 0; border: 1px solid #eee; }
.cal-trigger-thumb img { width: 100%; height: 100%; object-fit: cover; }
.cal-trigger-text { text-align: center; font-weight: 700; color: #1e293b; font-size: 1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cal-activity-dropdown { position: absolute; top: calc(100% + 8px); left: 0; width: 340px; background: #fff; border-radius: 16px; box-shadow: 0 20px 50px rgba(0,0,0,0.15); border: 1px solid #e2e8f0; z-index: 120; overflow: hidden; }
.cal-dropdown-search { padding: 12px 16px; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; gap: 10px; color: #94a3b8; }
.cal-dropdown-search input { flex: 1; border: none; outline: none; font-size: 0.95rem; font-family: inherit; color: #1e293b; }
.cal-dropdown-list { max-height: 380px; overflow-y: auto; padding: 8px; }
.cal-dropdown-item { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 10px; cursor: pointer; transition: all 0.2s; margin-bottom: 2px; }
.cal-dropdown-item:hover { background: #f8fafc; }
.cal-dropdown-item.active { background: #fef0eb; }
.item-icon-box { width: 36px; height: 36px; background: #f1f5f9; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #64748b; }
.cal-dropdown-item.active .item-icon-box { background: #F05A23; color: #fff; }
.item-thumb-box { width: 36px; height: 36px; border-radius: 8px; overflow: hidden; border: 1px solid #eee; flex-shrink: 0; }
.item-thumb-box img { width: 100%; height: 100%; object-fit: cover; }
.item-info { flex: 1; min-width: 0; }
.item-name { font-weight: 600; font-size: 0.95rem; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cal-dropdown-item.active .item-name { color: #F05A23; }
.item-sub { font-size: 0.78rem; color: #64748b; margin-top: 1px; }
.dropdown-fade-enter-active, .dropdown-fade-leave-active { transition: opacity 0.2s, transform 0.2s; }
.dropdown-fade-enter-from, .dropdown-fade-leave-to { opacity: 0; transform: translateY(-10px); }

/* Responsive Expansion */
.sidebar-hidden .calendar-main-v2, .calendar-fullscreen .calendar-main-v2 {
  max-width: 100%;
}
.sidebar-hidden .calendar-tab, .calendar-fullscreen .calendar-tab {
  padding-left: 20px;
  padding-right: 20px;
}
.calendar-tab { font-family: 'Sarabun', sans-serif !important; }
.cal-trigger-text, .item-name, .item-sub, .m-label, .m-val, .stat-t-name { font-family: 'Sarabun', sans-serif !important; }

/* Mission Popup Modal Styles */
.popup-mission-sheet {
  min-height: 100dvh !important;
  width: 100% !important;
  border-radius: 0 !important;
  overflow: hidden;
  box-shadow: none !important;
  border: none !important;
}
@media (min-width: 640px) {
  .popup-mission-sheet {
    min-height: auto !important;
    max-width: 520px !important;
    border-radius: 20px !important;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15) !important;
    border: 1px solid #f0f0f0 !important;
  }
}
.popup-mission-body {
  padding: 24px 20px !important;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: #fdfdfd;
  flex: 1; /* Pushes the footer to the bottom on full-screen mobile */
}
.popup-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
}
.popup-item {
  background: #fff;
  border: 1.5px solid #f1f5f9;
  border-radius: 16px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.popup-item:hover {
  transform: translateY(-2px);
  border-color: #fef0eb;
  box-shadow: 0 8px 20px rgba(240, 90, 35, 0.05);
}
.popup-pagination-footer {
  padding: 16px 20px;
  border-top: 1px solid #f1f5f9;
  background: #fff;
  display: flex;
  justify-content: center;
  align-items: center;
  padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px)); /* Safe area support */
}
.pagination-buttons {
  display: flex;
  align-items: center;
  gap: 16px;
}
.btn-pagination-prev,
.btn-pagination-next {
  background: #fff;
  border: 1.5px solid #e2e8f0;
  border-radius: 10px;
  padding: 8px 16px;
  font-size: 0.85rem;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
  font-family: 'Sarabun', sans-serif !important;
}
.btn-pagination-prev:hover:not(:disabled),
.btn-pagination-next:hover:not(:disabled) {
  border-color: #F05A23;
  color: #F05A23;
  background: #fef0eb;
}
.btn-pagination-prev:disabled,
.btn-pagination-next:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: #f8fafc;
  color: #cbd5e1;
}
.pagination-indicator {
  font-size: 0.9rem;
  font-weight: 700;
  color: #334155;
  font-family: 'Sarabun', sans-serif !important;
}

/* ── New Tanita Responsive 2-Column Styles ── */
.tanita-wrap-v2 {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}
.tanita-top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #f1f5f9;
  padding-bottom: 12px;
}
.btn-outline-tanita-v2 {
  background: #fff;
  border: 1.5px solid #F05A23;
  color: #F05A23;
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: all 0.2s;
  font-family: 'Sarabun', sans-serif !important;
}
.btn-outline-tanita-v2:hover {
  background: #fef0eb;
  transform: translateY(-1px);
}
.tanita-layout-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
}
@media (min-width: 1024px) {
  .tanita-layout-grid {
    grid-template-columns: 1.15fr 0.85fr;
    gap: 24px;
  }
}
.section-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}
.section-title {
  font-size: 15px;
  font-weight: 700;
  color: #111 !important;
  margin: 0;
  font-family: 'Sarabun', sans-serif !important;
}
@media (min-width: 768px) {
  .section-title { font-size: 18px; }
}
@media (min-width: 1024px) {
  .section-title { font-size: 22px; }
}

/* Bento Targets Grid */
.bento-fitness-targets {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}
@media (min-width: 640px) {
  .bento-fitness-targets {
    grid-template-columns: repeat(3, 1fr);
  }
}
.bento-card {
  position: relative;
  background: #fff;
  border: 1.5px solid #f1f5f9;
  border-radius: 16px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.015);
  transition: all 0.2s ease;
  min-width: 0; /* prevent overflow */
}
.bento-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(15, 23, 42, 0.04);
  border-color: #e2e8f0;
}
.bento-icon-bg {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.bento-calories .bento-icon-bg { background: #fff7ed; }
.bento-water .bento-icon-bg { background: #eff6ff; }
.bento-protein .bento-icon-bg { background: #faf5ff; }

.bento-label {
  font-size: 11px;
  font-weight: 700;
  color: inherit;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-family: 'Sarabun', sans-serif !important;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-right: 28px; /* space for tooltip btn */
}
.bento-value {
  font-size: 18px;
  font-weight: 800;
  color: inherit;
  letter-spacing: -0.02em;
  font-family: 'Sarabun', sans-serif !important;
  word-break: break-word;
}
.bento-sub {
  font-size: 12px;
  color: #111 !important;
  line-height: 1.4;
  font-family: 'Sarabun', sans-serif !important;
}
@media (min-width: 768px) {
  .bento-label { font-size: 13px; }
  .bento-value { font-size: 22px; }
  .bento-sub { font-size: 13px; }
}
@media (min-width: 1024px) {
  .bento-label { font-size: 14px; }
  .bento-value { font-size: 24px; }
  .bento-sub { font-size: 14px; }
}

/* Simulator Card */
.simulator-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 16px;
}
.sim-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 700;
  color: #111 !important;
  margin-bottom: 6px;
  font-family: 'Sarabun', sans-serif !important;
}
.sim-desc {
  font-size: 13px;
  color: #111 !important;
  font-family: 'Sarabun', sans-serif !important;
}
@media (min-width: 1024px) {
  .sim-header { font-size: 18px; }
  .sim-desc { font-size: 14px; }
}
.sim-controls-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}
@media (min-width: 640px) {
  .sim-controls-grid {
    grid-template-columns: 1fr 1fr;
  }
}
.sim-select :deep(.select-trigger) {
  min-height: 38px;
  padding: 8px 10px 0px;
  background: #fff;
  border-color: #cbd5e1;
  font-size: 0.82rem;
  border-radius: 8px;
}
.sim-select :deep(label) {
  display: none !important;
}
.sim-select :deep(.select-caret) {
  top: 18px;
  border-top-color: #64748b;
}

/* Metrics Grid Right Column */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}
@media (max-width: 400px) {
  .metrics-grid {
    grid-template-columns: 1fr;
  }
}
.metric-coach-card {
  position: relative;
  background: #fff;
  border: 1.2px solid #e2e8f0;
  border-radius: 14px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  transition: all 0.2s ease;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.01);
  min-width: 0;
}
.metric-coach-card:hover {
  transform: translateY(-1px);
  border-color: #cbd5e1;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.03);
}
.m-title-mini {
  font-size: 11px;
  font-weight: 600;
  color: inherit;
  font-family: 'Sarabun', sans-serif !important;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.m-val-mini {
  font-size: 18px;
  font-weight: 800;
  color: inherit;
  display: flex;
  align-items: baseline;
  gap: 3px;
  flex-wrap: wrap;
  font-family: 'Sarabun', sans-serif !important;
  word-break: break-word;
}
.m-unit-mini {
  font-size: 12px;
  font-weight: 500;
  color: inherit;
  flex-shrink: 0;
}
.m-coach-rec {
  font-size: 12px;
  line-height: 1.45;
  color: #111 !important;
  border-top: 1px dashed #f1f5f9;
  padding-top: 6px;
  font-family: 'Sarabun', sans-serif !important;
}
@media (min-width: 768px) {
  .metric-coach-card { padding: 14px; }
  .m-title-mini { font-size: 12px; }
  .m-val-mini { font-size: 20px; }
  .m-unit-mini { font-size: 13px; }
}
@media (min-width: 1024px) {
  .m-title-mini { font-size: 14px; }
  .m-val-mini { font-size: 24px; }
  .m-unit-mini { font-size: 14px; }
  .m-coach-rec { font-size: 14px; }
}
.m-status-badge {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 6px;
  font-weight: 700;
  font-family: 'Sarabun', sans-serif !important;
  white-space: nowrap;
  align-self: flex-start;
}
.m-status-badge.ปกติ, .m-status-badge.success { background: #dcfce7; color: #15803d; }
.m-status-badge.เฝ้าระวัง { background: #fef9c3; color: #a16207; }
.m-status-badge.สูง, .m-status-badge.danger { background: #fee2e2; color: #b91c1c; }
.m-status-badge.ต่ำ { background: #e0f2fe; color: #0369a1; }
.m-status-badge.ควรดื่มเพิ่ม { background: #fee2e2; color: #b91c1c; }

/* BMI Compact Style */
.bmi-compact-card {
  background: #fff;
  border: 1.2px solid #e2e8f0;
  border-radius: 16px;
  padding: 16px;
}
.bmi-compact-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.bmi-compact-title {
  font-size: 13px;
  font-weight: 700;
  color: #111 !important;
  font-family: 'Sarabun', sans-serif !important;
}
.bmi-compact-value-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.bmi-compact-badge {
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 700;
  font-family: 'Sarabun', sans-serif !important;
}
.bmi-compact-num {
  font-size: 16px;
  font-weight: 800;
  color: #111 !important;
  font-family: 'Sarabun', sans-serif !important;
}
.bmi-compact-desc {
  font-size: 13px;
  color: #111 !important;
  padding: 10px;
  border-radius: 8px;
  line-height: 1.5;
  font-family: 'Sarabun', sans-serif !important;
}
@media (min-width: 1024px) {
  .bmi-compact-title { font-size: 14px; }
  .bmi-compact-badge { font-size: 12px; }
  .bmi-compact-num { font-size: 18px; }
  .bmi-compact-desc { font-size: 14px; }
}

/* Scoped BMI Scale Custom Overrides inside Tanita */
.tanita-wrap-v2 .bmi-scale-line {
  height: 8px !important;
  border-radius: 4px !important;
  background: linear-gradient(90deg, #10b981 0%, #ca8a04 35%, #ea580c 70%, #dc2626 100%) !important;
}
.tanita-wrap-v2 .bmi-marker {
  position: absolute !important;
  top: 1px !important;
  width: 14px !important;
  height: 14px !important;
  background: #fff !important;
  border: 3px solid #1e293b !important;
  border-radius: 50% !important;
  transform: translateX(-50%) !important;
  transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2) !important;
  z-index: 2;
}

/* Scientific References Card */
.references-card {
  background: #fff;
  border: 1.2px solid #e2e8f0;
  border-radius: 16px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.015);
}
.ref-title {
  font-size: 13px;
  color: #111 !important;
  font-family: 'Sarabun', sans-serif !important;
}
.ref-badge {
  font-size: 11px;
  font-family: 'Sarabun', sans-serif !important;
}
.ref-text {
  font-size: 13px;
  color: #111 !important;
  font-family: 'Sarabun', sans-serif !important;
}
.ref-link {
  font-size: 13px;
  transition: color 0.15s ease;
  font-family: 'Sarabun', sans-serif !important;
}
@media (min-width: 1024px) {
  .ref-title, .ref-text, .ref-link { font-size: 14px; }
}

/* ── Mobile-specific overrides ── */
@media (max-width: 480px) {
  /* Outer wrapper & date bar */
  .tanita-date { font-size: 0.75rem; }

  /* Simulator card: stack dropdowns */
  .simulator-card { padding: 12px; }
  .sim-header { font-size: 13px; }

  /* BMI compact card */
  .bmi-compact-card { padding: 12px; }
  .bmi-compact-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  .bmi-compact-value-row { flex-wrap: wrap; gap: 6px; }
  .bmi-compact-num { font-size: 14px; }
  .bmi-compact-badge { font-size: 10px; }

  /* BMI scale labels — hide middle ones to avoid cramping */
  .bmi-scale-labels span:nth-child(2),
  .bmi-scale-labels span:nth-child(3),
  .bmi-scale-labels span:nth-child(4) {
    display: none;
  }

  /* Status badges */
  .m-status-badge { font-size: 10px; padding: 2px 6px; }

  /* Section gaps */
  .tanita-dashboard-left,
  .tanita-dashboard-right { gap: 12px !important; }
}
</style>




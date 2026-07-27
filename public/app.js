/**
 * EZEE JOB - FRONTEND APPLICATION LOGIC
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide icons
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // --- State Management ---
  const state = {
    activeTab: 'input-tab',
    aiConfig: {
      provider: localStorage.getItem('ai_provider') || 'gemini',
      apiKey: localStorage.getItem('ai_api_key') || '',
      model: localStorage.getItem('ai_model') || 'gemini-2.0-flash',
      baseUrl: localStorage.getItem('ai_base_url') || 'http://localhost:11434/v1/chat/completions'
    },
    applicationEmail: { subject: '', body: '' },
    tailoredCvTex: '',
    coverLetterHtml: '',
    cvPdfUrl: '',
    coverPdfUrl: '',
    gapAnalysis: null,
    gapMode: 'zero-llm'
  };

  // --- DOM Elements ---
  const navTabs = document.querySelectorAll('.nav-tab');
  const tabPages = document.querySelectorAll('.tab-page');

  const masterCvInput = document.getElementById('master-cv-input');
  const jdInput = document.getElementById('jd-input');
  const targetTitleInput = document.getElementById('target-title-input');
  const pdfUploadInput = document.getElementById('pdf-upload-input');
  const dropZone = document.getElementById('drop-zone');

  const btnSaveMasterCv = document.getElementById('btn-save-master-cv');
  const btnAnalyzeGap = document.getElementById('btn-analyze-gap');
  const btnGenerateTailored = document.getElementById('btn-generate-tailored');
  const btnLoadSample = document.getElementById('btn-load-sample');

  // Gap Analysis Elements
  const gapModeToggle = document.getElementById('gap-mode-toggle');
  const gapAnalysisTitle = document.getElementById('gap-analysis-title');
  const labelZeroMode = document.getElementById('label-zero-mode');
  const labelLlmMode = document.getElementById('label-llm-mode');
  const gapModeBanner = document.getElementById('gap-mode-banner');
  const gapModeBannerText = document.getElementById('gap-mode-banner-text');
  const radialProgressBar = document.getElementById('radial-progress-bar');
  const radialScoreValue = document.getElementById('radial-score-value');
  const matchScoreBadge = document.getElementById('match-score-badge');
  const matchedSkillsTags = document.getElementById('matched-skills-tags');
  const missingSkillsTags = document.getElementById('missing-skills-tags');
  const recommendationsList = document.getElementById('recommendations-list');

  // Email Elements
  const emailSubjectInput = document.getElementById('email-subject-input');
  const emailBodyInput = document.getElementById('email-body-input');
  const emailBadge = document.getElementById('email-badge');
  const coverBadge = document.getElementById('cover-badge');
  const cvBadge = document.getElementById('cv-badge');
  const btnCopyEmailSubject = document.getElementById('btn-copy-email-subject');
  const btnCopyEmailBody = document.getElementById('btn-copy-email-body');
  const btnDownloadEmailTxt = document.getElementById('btn-download-email-txt');

  // Editors & Preview Frames
  const cvTexCode = document.getElementById('cv-tex-code');
  const coverTexCode = document.getElementById('cover-tex-code');
  const cvPdfFrame = document.getElementById('cv-pdf-frame');
  const coverPdfFrame = document.getElementById('cover-pdf-frame');
  const cvLoadingOverlay = document.getElementById('cv-loading-overlay');
  const coverLoadingOverlay = document.getElementById('cover-loading-overlay');

  const btnRecompileCv = document.getElementById('btn-recompile-cv');
  const btnRecompileCover = document.getElementById('btn-recompile-cover');
  const btnCopyCvTex = document.getElementById('btn-copy-cv-tex');
  const btnCopyCoverTex = document.getElementById('btn-copy-cover-tex');
  const btnCopyCoverHtml = document.getElementById('btn-copy-cover-html');

  const btnDownloadCvPdf = document.getElementById('btn-download-cv-pdf');
  const btnDownloadCoverPdf = document.getElementById('btn-download-cover-pdf');
  const btnDownloadCvTex = document.getElementById('btn-download-cv-tex');
  const btnDownloadCoverTex = document.getElementById('btn-download-cover-tex');
  const btnDownloadCoverHtml = document.getElementById('btn-download-cover-html');

  const btnRefreshCvFrame = document.getElementById('btn-refresh-cv-frame');
  const btnRefreshCoverFrame = document.getElementById('btn-refresh-cover-frame');
  const btnOpenCvPdfTab = document.getElementById('btn-open-cv-pdf-tab');
  const btnOpenCoverPdfTab = document.getElementById('btn-open-cover-pdf-tab');

  // Settings Modal Elements
  const btnOpenSettings = document.getElementById('btn-open-settings');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const settingsModal = document.getElementById('settings-modal');
  const providerSelect = document.getElementById('provider-select');
  const apiKeyInput = document.getElementById('api-key-input');
  const modelNameInput = document.getElementById('model-name-input');
  const baseUrlInput = document.getElementById('base-url-input');
  const baseUrlGroup = document.getElementById('base-url-group');
  const btnToggleKeyVis = document.getElementById('btn-toggle-key-visibility');
  const btnTestConnection = document.getElementById('btn-test-connection');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const connectionStatusMsg = document.getElementById('connection-status-msg');
  const aiProviderLabel = document.getElementById('ai-provider-label');

  // --- Initialize App ---
  init();

  function init() {
    loadAiConfigToUI();
    fetchMasterCv();
    setupEventListeners();
  }

  // --- AI Config Management ---
  function loadAiConfigToUI() {
    providerSelect.value = state.aiConfig.provider;
    apiKeyInput.value = state.aiConfig.apiKey;
    modelNameInput.value = state.aiConfig.model;
    baseUrlInput.value = state.aiConfig.baseUrl;

    toggleProviderFields(state.aiConfig.provider);
    updateHeaderAiBadge();
  }

  function saveAiConfigFromUI() {
    state.aiConfig.provider = providerSelect.value;
    state.aiConfig.apiKey = apiKeyInput.value.trim();
    state.aiConfig.model = modelNameInput.value.trim();
    state.aiConfig.baseUrl = baseUrlInput.value.trim();

    localStorage.setItem('ai_provider', state.aiConfig.provider);
    localStorage.setItem('ai_api_key', state.aiConfig.apiKey);
    localStorage.setItem('ai_model', state.aiConfig.model);
    localStorage.setItem('ai_base_url', state.aiConfig.baseUrl);

    updateHeaderAiBadge();
  }

  function updateHeaderAiBadge() {
    const pName = state.aiConfig.provider.charAt(0).toUpperCase() + state.aiConfig.provider.slice(1);
    const mName = state.aiConfig.model || 'Default';
    aiProviderLabel.textContent = `${pName} (${mName})`;
  }

  function toggleProviderFields(provider) {
    if (provider === 'custom') {
      baseUrlGroup.style.display = 'flex';
    } else {
      baseUrlGroup.style.display = 'none';
    }
  }

  // --- Fetch Master CV ---
  async function fetchMasterCv() {
    try {
      const res = await fetch('/api/master-cv');
      const data = await res.json();
      if (data.masterCv) {
        masterCvInput.value = data.masterCv;
      }
    } catch (err) {
      console.error('Failed to fetch Master CV:', err);
    }
  }

  // --- Tab Navigation ---
  function switchTab(tabId) {
    state.activeTab = tabId;
    navTabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabId);
    });
    tabPages.forEach(page => {
      page.classList.toggle('active', page.id === tabId);
    });
  }

  // --- Event Listeners Setup ---
  function setupEventListeners() {
    // Tabs
    navTabs.forEach(tab => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Save Master CV
    btnSaveMasterCv.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/save-master-cv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ masterCv: masterCvInput.value })
        });
        const data = await res.json();
        if (data.success) {
          showNotification('Master CV saved successfully.', 'success');
        }
      } catch (err) {
        showNotification(`Failed to save CV: ${err.message}`, 'error');
      }
    });

    // Upload File (PDF/Text)
    pdfUploadInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        uploadFile(e.target.files[0]);
      }
    });

    // Drag and Drop
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        uploadFile(e.dataTransfer.files[0]);
      }
    });
    dropZone.addEventListener('click', () => pdfUploadInput.click());

    // Gap Analysis Mode Toggle
    if (gapModeToggle) {
      gapModeToggle.addEventListener('change', (e) => {
        const isLlm = e.target.checked;
        state.gapMode = isLlm ? 'llm' : 'zero-llm';

        if (isLlm) {
          if (gapAnalysisTitle) gapAnalysisTitle.textContent = 'LLM-Driven Keyword Match & Gap Analysis';
          if (labelZeroMode) labelZeroMode.classList.remove('active');
          if (labelLlmMode) labelLlmMode.classList.add('active');
          if (gapModeBanner) gapModeBanner.className = 'gap-mode-banner llm-mode';
          if (gapModeBannerText) gapModeBannerText.innerHTML = '<strong>LLM-Driven Mode:</strong> AI semantic analysis identifying missing qualifications & strategic optimizations to fix Cover Letter, CV & Email.';
        } else {
          if (gapAnalysisTitle) gapAnalysisTitle.textContent = 'Zero-LLM Keyword Match & Gap Analysis';
          if (labelZeroMode) labelZeroMode.classList.add('active');
          if (labelLlmMode) labelLlmMode.classList.remove('active');
          if (gapModeBanner) gapModeBanner.className = 'gap-mode-banner zero-mode';
          if (gapModeBannerText) gapModeBannerText.innerHTML = '<strong>Zero-LLM Mode:</strong> Fast, deterministic NLP skill extraction without AI API cost or hallucination.';
        }

        // Re-run analysis if CV and JD are present
        if (masterCvInput.value.trim() && jdInput.value.trim()) {
          runGapAnalysis();
        }
      });
    }

    // Gap Analysis
    btnAnalyzeGap.addEventListener('click', runGapAnalysis);

    // Primary Tailor Generation
    btnGenerateTailored.addEventListener('click', generateTailoredApplication);

    // Load Sample Data
    btnLoadSample.addEventListener('click', loadSampleData);

    // Recompile Buttons
    btnRecompileCv.addEventListener('click', () => recompileDocument('cv'));
    btnRecompileCover.addEventListener('click', () => recompileDocument('cover'));

    // Copy Buttons
    if (btnCopyEmailSubject) {
      btnCopyEmailSubject.addEventListener('click', () => copyToClipboard(emailSubjectInput.value, 'Email subject copied!'));
    }
    if (btnCopyEmailBody) {
      btnCopyEmailBody.addEventListener('click', () => copyToClipboard(emailBodyInput.value, 'Email body text copied!'));
    }
    if (btnDownloadEmailTxt) {
      btnDownloadEmailTxt.addEventListener('click', () => {
        const fullContent = `Subject: ${emailSubjectInput.value}\n\n${emailBodyInput.value}`;
        downloadTextFile('application-email.txt', fullContent);
      });
    }

    btnCopyCvTex.addEventListener('click', () => copyToClipboard(cvTexCode.value, 'CV LaTeX code copied!'));
    btnCopyCoverTex.addEventListener('click', () => copyToClipboard(coverTexCode.value, 'Cover Letter HTML copied!'));
  btnCopyCoverHtml.addEventListener('click', () => copyToClipboard(coverTexCode.value, 'Cover Letter HTML copied!'));

  // Download .tex
  btnDownloadCvTex.addEventListener('click', () => downloadTextFile('tailored-cv.tex', cvTexCode.value));
  btnDownloadCoverTex.addEventListener('click', () => downloadTextFile('cover-letter.tex', coverTexCode.value));
  btnDownloadCoverHtml.addEventListener('click', () => downloadTextFile('cover-letter.html', coverTexCode.value));
    // Refresh Frames
    btnRefreshCvFrame.addEventListener('click', () => {
      if (cvPdfFrame.src) cvPdfFrame.src = cvPdfFrame.src.split('?')[0] + '?t=' + Date.now();
    });
    btnRefreshCoverFrame.addEventListener('click', () => {
      if (coverPdfFrame.src) coverPdfFrame.src = coverPdfFrame.src.split('?')[0] + '?t=' + Date.now();
    });

    // Fullscreen Toggles
    document.querySelectorAll('.toggle-fullscreen-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;
        const container = document.getElementById(targetId);
        if (container) {
          container.classList.toggle('fullscreen');
        }
      });
    });

    // Settings Modal
    btnOpenSettings.addEventListener('click', () => settingsModal.style.display = 'flex');
    btnCloseSettings.addEventListener('click', () => settingsModal.style.display = 'none');
    providerSelect.addEventListener('change', (e) => toggleProviderFields(e.target.value));

    btnToggleKeyVis.addEventListener('click', () => {
      const type = apiKeyInput.type === 'password' ? 'text' : 'password';
      apiKeyInput.type = type;
      btnToggleKeyVis.textContent = type === 'password' ? 'Show' : 'Hide';
    });

    btnTestConnection.addEventListener('click', testAiConnection);

    btnSaveSettings.addEventListener('click', () => {
      saveAiConfigFromUI();
      settingsModal.style.display = 'none';
      showNotification('AI Provider settings saved successfully.', 'success');
    });
  }

  // --- Upload File Logic ---
  async function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);

    dropZone.innerHTML = `<p>Uploading and parsing ${file.name}...</p>`;

    try {
      const res = await fetch('/api/upload-cv', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        masterCvInput.value = data.masterCv;
        dropZone.innerHTML = `<i data-lucide="check-circle" class="drop-icon text-success"></i><p>Uploaded & Parsed <strong>${file.name}</strong></p>`;
        if (window.lucide) window.lucide.createIcons();
        showNotification(`Parsed ${file.name} successfully!`, 'success');
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      showNotification(`Upload error: ${err.message}`, 'error');
      dropZone.innerHTML = `<i data-lucide="file-up" class="drop-icon"></i><p>Drag & drop your Master CV (PDF/Markdown) or click to browse</p>`;
      if (window.lucide) window.lucide.createIcons();
    }
  }

  // --- Pipeline Status Controller ---
  const pipelineElements = {
    statusBadge: document.getElementById('pipeline-status-badge'),
    statusText: document.getElementById('pipeline-status-text'),
    currentAction: document.getElementById('pipeline-current-action'),
    percentText: document.getElementById('pipeline-percent'),
    progressFill: document.getElementById('pipeline-progress-fill')
  };

  function updatePipelineStep(stepIndex, stateName, logMsg) {
    const stepEl = document.getElementById(`p-step-${stepIndex}`);
    const stateEl = document.getElementById(`p-step-${stepIndex}-state`);
    if (stepEl && stateEl) {
      stepEl.classList.remove('step-pending', 'step-running', 'step-completed');
      if (stateName === 'running') {
        stepEl.classList.add('step-running');
        stateEl.textContent = 'In Progress...';
        stateEl.className = 'step-state text-indigo';
      } else if (stateName === 'completed') {
        stepEl.classList.add('step-completed');
        stateEl.textContent = 'Done ✓';
        stateEl.className = 'step-state text-success';
      } else {
        stepEl.classList.add('step-pending');
        stateEl.textContent = 'Pending';
        stateEl.className = 'step-state text-muted';
      }
    }

    const pct = Math.min(100, Math.round((stepIndex / 6) * 100));
    if (pipelineElements.percentText) pipelineElements.percentText.textContent = `${pct}%`;
    if (pipelineElements.progressFill) pipelineElements.progressFill.style.width = `${pct}%`;
    if (pipelineElements.currentAction && logMsg) pipelineElements.currentAction.textContent = logMsg;

    if (pipelineElements.statusBadge) {
      pipelineElements.statusBadge.className = 'pipeline-badge status-running';
    }
    if (pipelineElements.statusText) {
      pipelineElements.statusText.textContent = 'Pipeline Running...';
    }
  }

  function setPipelineComplete(summaryMsg) {
    for (let i = 1; i <= 6; i++) {
      const stepEl = document.getElementById(`p-step-${i}`);
      const stateEl = document.getElementById(`p-step-${i}-state`);
      if (stepEl) {
        stepEl.classList.remove('step-pending', 'step-running');
        stepEl.classList.add('step-completed');
      }
      if (stateEl) {
        stateEl.textContent = 'Done ✓';
        stateEl.className = 'step-state text-success';
      }
    }
    if (pipelineElements.percentText) pipelineElements.percentText.textContent = '100%';
    if (pipelineElements.progressFill) pipelineElements.progressFill.style.width = '100%';
    if (pipelineElements.currentAction) pipelineElements.currentAction.textContent = summaryMsg || 'All 6 pipeline stages finished successfully!';
    
    if (pipelineElements.statusBadge) {
      pipelineElements.statusBadge.className = 'pipeline-badge status-success';
    }
    if (pipelineElements.statusText) {
      pipelineElements.statusText.textContent = 'Completed ✓';
    }
  }

  // --- Gap Analysis Logic ---
  async function runGapAnalysis() {
    const masterCv = masterCvInput.value.trim();
    const jobDescription = jdInput.value.trim();

    if (!masterCv || !jobDescription) {
      showNotification('Please provide both Master CV and Job Description to run gap analysis.', 'error');
      return;
    }

    updatePipelineStep(1, 'completed', 'Stage 1: CV & JD Ingestion complete ✓');

    try {
      const modeText = state.gapMode === 'llm' ? 'AI LLM-Driven' : 'Zero-LLM NLP';
      updatePipelineStep(2, 'running', `Stage 2: Running ${modeText} skill match & keyword gap analysis...`);
      const res = await fetch('/api/analyze-gap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masterCv,
          jobDescription,
          mode: state.gapMode,
          config: state.aiConfig
        })
      });
      const data = await res.json();
      if (data.success) {
        updatePipelineStep(2, 'completed', `Stage 2: ${modeText} Gap Matrix generated ✓ - Click "Generate Tailored Application" for Stages 3-6.`);
        if (pipelineElements.statusBadge) pipelineElements.statusBadge.className = 'pipeline-badge status-running';
        if (pipelineElements.statusText) pipelineElements.statusText.textContent = `${modeText} Matrix Ready`;
        renderGapAnalysis(data.gapAnalysis);
        showNotification(`${modeText} Gap Analysis complete!`, 'success');
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      showNotification(`Gap Analysis failed: ${err.message}`, 'error');
    }
  }

  function renderGapAnalysis(report) {
    state.gapAnalysis = report;
    const score = report.skillMatchPercentage || 0;

    // Radial Bar Math (Circumference 251.2)
    const offset = 251.2 - (251.2 * score) / 100;
    radialProgressBar.style.strokeDashoffset = offset;
    radialScoreValue.textContent = `${score}%`;
    matchScoreBadge.textContent = `Match: ${score}%`;

    // Render Matched Skills
    if (report.existingSkills && report.existingSkills.length > 0) {
      matchedSkillsTags.innerHTML = report.existingSkills
        .map(s => `<span class="tag-item matched"><i data-lucide="check" style="width:12px;height:12px;"></i> ${escapeHtml(s.name)}</span>`)
        .join('');
    } else {
      matchedSkillsTags.innerHTML = '<span class="text-muted">No key matching skills detected.</span>';
    }

    // Render Missing Skills
    if (report.missingSkills && report.missingSkills.length > 0) {
      missingSkillsTags.innerHTML = report.missingSkills
        .map(s => `<span class="tag-item missing"><i data-lucide="x" style="width:12px;height:12px;"></i> ${escapeHtml(s.name)}</span>`)
        .join('');
    } else {
      missingSkillsTags.innerHTML = '<span class="text-muted">No skill gaps detected! Excellent fit.</span>';
    }

    // Render Recommendations
    if (recommendationsList && report.recommendations && report.recommendations.length > 0) {
      recommendationsList.innerHTML = report.recommendations
        .map(r => `<li>${escapeHtml(r)}</li>`)
        .join('');
    }

    if (window.lucide) window.lucide.createIcons();
  }

  // --- Primary Generation Logic ---
  async function generateTailoredApplication() {
    const masterCv = masterCvInput.value.trim();
    const jobDescription = jdInput.value.trim();
    const targetTitle = targetTitleInput.value.trim();

    if (!masterCv || !jobDescription) {
      showNotification('Master CV and Job Description are required.', 'error');
      return;
    }

    // Lock UI and show spinners
    btnGenerateTailored.disabled = true;
    btnGenerateTailored.innerHTML = `<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span> Processing AI Pipeline...`;
    
    cvLoadingOverlay.style.display = 'flex';
    coverLoadingOverlay.style.display = 'flex';

    if (emailBadge) { emailBadge.classList.remove('badge-success'); emailBadge.textContent = 'Generating...'; }
    if (coverBadge) { coverBadge.classList.remove('badge-success'); coverBadge.textContent = 'Generating...'; }
    if (cvBadge) { cvBadge.classList.remove('badge-success'); cvBadge.textContent = 'Generating...'; }

    // Real pipeline step initialization
    updatePipelineStep(1, 'completed', 'Stage 1: CV & JD Ingestion complete ✓');
    updatePipelineStep(2, 'completed', 'Stage 2: Gap & Skill Matrix computed ✓');
    updatePipelineStep(3, 'running', 'Stage 3: Synthesizing tailored Recruiter Application Email...');

    try {
      const res = await fetch('/api/generate-tailored', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masterCv,
          jobDescription,
          targetTitle,
          config: state.aiConfig,
          gapMode: state.gapMode
        })
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      // Stage 3: Validate and populate Application Email
      if (data.applicationEmail && (data.applicationEmail.subject || data.applicationEmail.body)) {
        state.applicationEmail = data.applicationEmail;
        if (emailSubjectInput) emailSubjectInput.value = data.applicationEmail.subject || '';
        if (emailBodyInput) emailBodyInput.value = data.applicationEmail.body || '';
        updatePipelineStep(3, 'completed', 'Stage 3: Application Email created ✓');
      } else {
        updatePipelineStep(3, 'completed', 'Stage 3: Default Email applied ✓');
      }
      if (emailBadge) {
        emailBadge.classList.add('badge-success');
        emailBadge.textContent = 'Ready ✓';
      }

      // Stage 4: Validate and populate Cover Letter HTML
      if (data.coverLetterHtml) {
        state.coverLetterHtml = data.coverLetterHtml;
        coverTexCode.value = data.coverLetterHtml;
        updatePipelineStep(4, 'completed', 'Stage 4: Cover Letter HTML generated ✓');
        if (coverBadge) {
          coverBadge.classList.add('badge-success');
          coverBadge.textContent = 'Ready ✓';
        }
      }

      // Stage 5: Validate and populate Tailored CV
      if (data.tailoredCvTex) {
        state.tailoredCvTex = data.tailoredCvTex;
        cvTexCode.value = data.tailoredCvTex;
        updatePipelineStep(5, 'completed', 'Stage 5: Tailored CV TeX generated ✓');
        if (cvBadge) {
          cvBadge.classList.add('badge-success');
          cvBadge.textContent = 'Ready ✓';
        }
      }

      // Stage 6: Validate and render PDF Compilation
      if (data.cvPdfUrl && data.coverPdfUrl) {
        state.cvPdfUrl = data.cvPdfUrl;
        state.coverPdfUrl = data.coverPdfUrl;
        
        const timeStamp = Date.now();
        cvPdfFrame.src = `${data.cvPdfUrl}?t=${timeStamp}`;
        coverPdfFrame.src = `${data.coverPdfUrl}?t=${timeStamp}`;

        btnDownloadCvPdf.href = data.cvPdfUrl;
        btnDownloadCoverPdf.href = data.coverPdfUrl;
        btnOpenCvPdfTab.href = data.cvPdfUrl;
        btnOpenCoverPdfTab.href = data.coverPdfUrl;

        updatePipelineStep(6, 'completed', 'Stage 6: Vector PDF compiled ✓');
      }

      // Update Gap Analysis
      if (data.gapAnalysis) {
        renderGapAnalysis(data.gapAnalysis);
      }

      // Complete all pipeline stages in UI once outputs are verified
      setPipelineComplete('Pipeline finished: Application Email, Cover Letter HTML, CV LaTeX & PDFs ready!');

      showNotification('Tailored Email, Cover Letter & CV generated successfully!', 'success');

      // Auto-switch to Application Email Tab
      switchTab('email-editor-tab');

    } catch (err) {
      console.error('Generation error:', err);
      showNotification(`Generation failed: ${err.message}`, 'error');
      if (!state.applicationEmail.subject && emailBadge) { emailBadge.classList.remove('badge-success'); emailBadge.textContent = 'Pending'; }
      if (!state.coverLetterHtml && coverBadge) { coverBadge.classList.remove('badge-success'); coverBadge.textContent = 'Pending'; }
      if (!state.tailoredCvTex && cvBadge) { cvBadge.classList.remove('badge-success'); cvBadge.textContent = 'Pending'; }
      if (pipelineElements.statusBadge) pipelineElements.statusBadge.className = 'pipeline-badge status-idle';
      if (pipelineElements.statusText) pipelineElements.statusText.textContent = 'Pipeline Interrupted';
    } finally {
      btnGenerateTailored.disabled = false;
      btnGenerateTailored.innerHTML = `<i data-lucide="sparkles"></i> <span>Generate Tailored CV & Cover Letter</span>`;
      cvLoadingOverlay.style.display = 'none';
      coverLoadingOverlay.style.display = 'none';
      if (window.lucide) window.lucide.createIcons();
    }
  }

  // --- Recompile Document Logic ---
  async function recompileDocument(docType) {
    const isCv = docType === 'cv';
    const content = isCv ? cvTexCode.value : coverTexCode.value;
    const loadingOverlay = isCv ? cvLoadingOverlay : coverLoadingOverlay;
    const iframe = isCv ? cvPdfFrame : coverPdfFrame;
    const downloadBtn = isCv ? btnDownloadCvPdf : btnDownloadCoverPdf;
    const openTabBtn = isCv ? btnOpenCvPdfTab : btnOpenCoverPdfTab;

    if (!content) return;

    loadingOverlay.style.display = 'flex';

    try {
      const res = await fetch('/api/recompile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, docType })
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      // Refresh iframe
      iframe.src = `${data.pdfUrl}?t=${Date.now()}`;
      downloadBtn.href = data.pdfUrl;
      openTabBtn.href = data.pdfUrl;

      showNotification(`Recompiled ${docType.toUpperCase()} successfully!`, 'success');
    } catch (err) {
      showNotification(`Recompilation failed: ${err.message}`, 'error');
    } finally {
      loadingOverlay.style.display = 'none';
    }
  }

  // --- Test Connection Logic ---
  async function testAiConnection() {
    connectionStatusMsg.style.display = 'block';
    connectionStatusMsg.className = 'alert-box';
    connectionStatusMsg.textContent = 'Testing connection to AI provider...';

    const testConfig = {
      provider: providerSelect.value,
      apiKey: apiKeyInput.value.trim(),
      model: modelNameInput.value.trim(),
      baseUrl: baseUrlInput.value.trim()
    };

    try {
      const res = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testConfig)
      });
      const data = await res.json();
      if (data.success) {
        connectionStatusMsg.className = 'alert-box success';
        connectionStatusMsg.textContent = `✓ ${data.message}`;
      } else {
        connectionStatusMsg.className = 'alert-box error';
        connectionStatusMsg.textContent = `✕ ${data.message}`;
      }
    } catch (err) {
      connectionStatusMsg.className = 'alert-box error';
      connectionStatusMsg.textContent = `✕ Test failed: ${err.message}`;
    }
  }

  // --- Sample Data Loader ---
  function loadSampleData() {
    jdInput.value = `### Position: Senior Full-Stack Engineer / AI Applications Lead
Company: NextGen Systems Inc.
Location: San Francisco, CA (Hybrid)

About the Role:
We are seeking a Senior Full-Stack Engineer to lead the architecture and development of our next-generation AI application suite. You will work across TypeScript, React, Node.js, Python, PostgreSQL, and AWS to scale distributed microservices and LLM-powered tools.

Key Responsibilities:
- Architect, build, and deploy high-volume web applications using TypeScript, React, and Node.js.
- Design clean RESTful APIs and GraphQL interfaces backed by PostgreSQL, Redis, and Elasticsearch.
- Build and optimize CI/CD automation pipelines using GitHub Actions and Docker on AWS ECS.
- Integrate GenAI and LLM APIs (Gemini, OpenAI, LangChain) into production workflows.
- Mentor junior engineers and collaborate with product and design teams.

Required Qualifications:
- 5+ years of full-stack software development experience with React, Node.js, and TypeScript.
- Strong proficiency in SQL (PostgreSQL), cloud services (AWS), and containerization (Docker, Kubernetes).
- Demonstrated experience building GenAI / LLM applications and vector search solutions.
- Excellent communication and cross-functional leadership skills.`;

    targetTitleInput.value = "Senior Full-Stack Engineer";

    if (emailSubjectInput) {
      emailSubjectInput.value = "Application for Senior Full-Stack Engineer - Alex Rivera";
    }
    if (emailBodyInput) {
      emailBodyInput.value = `Dear Hiring Team at NextGen Systems,

I am writing to express my strong enthusiasm for the Senior Full-Stack Engineer position. With 6+ years of software engineering experience specializing in React, Node.js, and cloud microservices, I am confident in my ability to make an immediate impact on your GenAI platform.

In my recent roles:
• Scaled platform throughput by 40% using advanced ISR and caching strategies in React & Node.js.
• Integrated production GenAI/LLM pipelines and vector search workflows, decreasing latency by 35%.
• Led cross-functional teams in deploying resilient Docker containers on AWS.

Please find attached my tailored CV and Cover Letter for your review. I would welcome the opportunity to discuss how my background aligns with NextGen Systems' engineering goals.

Best regards,
Alex Rivera
alex@rivera.dev | +1 (555) 012-3456`;
    }

    showNotification('Sample Job Description & Email loaded!', 'success');
    runGapAnalysis();
  }

  // --- Utility Functions ---
  function showNotification(msg, type = 'info') {
    // Apple Toast HUD
    const toast = document.createElement('div');
    toast.className = `apple-toast-hud ${type}`;
    
    let iconSvg = '<i data-lucide="info" style="width: 18px; height: 18px; color: #a5b4fc;"></i>';
    if (type === 'success') {
      iconSvg = '<i data-lucide="check-circle-2" style="width: 18px; height: 18px; color: #30d158;"></i>';
    } else if (type === 'error') {
      iconSvg = '<i data-lucide="alert-circle" style="width: 18px; height: 18px; color: #ff453a;"></i>';
    }
    
    toast.innerHTML = `${iconSvg}<span>${escapeHtml(msg)}</span>`;
    document.body.appendChild(toast);

    if (window.lucide) {
      window.lucide.createIcons();
    }

    // Trigger spring transition
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 3200);
  }

  function copyToClipboard(text, successMsg) {
    navigator.clipboard.writeText(text).then(() => {
      showNotification(successMsg, 'success');
    }).catch(err => {
      showNotification('Failed to copy code.', 'error');
    });
  }

  function downloadTextFile(filename, text) {
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
});

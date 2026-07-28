import { GoogleGenAI } from '@google/genai';

/**
 * Tests connection to configured AI provider
 * @param {object} config { provider, apiKey, model, baseUrl }
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function testAiConnection(config) {
  const { provider = 'gemini', apiKey, model, baseUrl } = config;

  try {
    if (provider === 'gemini') {
      const key = apiKey || process.env.GEMINI_API_KEY;
      if (!key) {
        return { success: false, message: 'Gemini API key is missing. Set GEMINI_API_KEY env or enter key in Settings.' };
      }
      const ai = new GoogleGenAI({ apiKey: key });
      const targetModel = model || 'gemini-2.0-flash';
      const response = await ai.models.generateContent({
        model: targetModel,
        contents: 'Say "Connection successful!" in 3 words.',
      });
      return { success: true, message: `Connected successfully to Gemini (${targetModel})!` };
    }

    if (provider === 'openrouter') {
      if (!apiKey) return { success: false, message: 'OpenRouter API key is required.' };
      const targetModel = model || 'openai/gpt-4o-mini';
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: targetModel,
          messages: [{ role: 'user', content: 'Ping' }],
          max_tokens: 10
        })
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OpenRouter returned status ${res.status}: ${errText}`);
      }
      return { success: true, message: `Connected successfully to OpenRouter (${targetModel})!` };
    }

    if (provider === 'openai') {
      if (!apiKey) return { success: false, message: 'OpenAI API key is required.' };
      const targetModel = model || 'gpt-4o-mini';
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: targetModel,
          messages: [{ role: 'user', content: 'Ping' }],
          max_tokens: 10
        })
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OpenAI returned status ${res.status}: ${errText}`);
      }
      return { success: true, message: `Connected successfully to OpenAI (${targetModel})!` };
    }

    if (provider === 'custom') {
      const url = baseUrl || 'http://localhost:11434/v1/chat/completions';
      const targetModel = model || 'llama3';
      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: targetModel,
          messages: [{ role: 'user', content: 'Ping' }],
          max_tokens: 10
        })
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Custom endpoint returned status ${res.status}: ${errText}`);
      }
      return { success: true, message: `Connected successfully to custom endpoint (${targetModel})!` };
    }

    return { success: false, message: `Unsupported provider: ${provider}` };
  } catch (err) {
    console.error('Connection test failed:', err);
    return { success: false, message: `Connection failed: ${err.message}` };
  }
}

/**
 * Generates tailored HTML CV and HTML Cover Letter using the chosen AI provider
 * @param {object} params { masterCv, jobDescription, targetTitle, config, cvStyle }
 * @returns {Promise<{ tailoredCvHtml: string, coverLetterHtml: string }>}
 */
export async function generateTailoredDocument(params) {
  const { masterCv, jobDescription, targetTitle = '', config = {}, gapReport = null, cvStyle = 'cloyola' } = params;
  const { provider = 'gemini', apiKey, model, baseUrl } = config;

  const gapPromptSection = gapReport ? `
GAP ANALYSIS & COMPETENCY ALIGNMENT MATRIX (${gapReport.mode === 'llm' ? 'AI LLM-DRIVEN SEMANTIC GAP ANALYSIS' : 'ZERO-LLM KEYWORD MATCHER'}):
- Skill Match Score: ${gapReport.skillMatchPercentage}%
- Core Matched Skills to Emphasize: ${gapReport.existingSkills?.map(s => s.name || s).join(', ') || 'None identified'}
- Key Missing Skills / Identified Gaps: ${gapReport.missingSkills?.map(s => s.name || s).join(', ') || 'None'}
- Strategic Action Recommendations:
${gapReport.recommendations?.map(r => `  * ${r}`).join('\n') || 'None'}

MANDATORY GAP-FIXING DIRECTIVES:
1. ADDRESS & REFRAME MISSING SKILLS: Look at the identified gaps above. In the Tailored CV Summary, Technical Skills section, and Cover Letter, reframe related background, tools, or transferable experience from the Master CV to fill these exact gaps WITHOUT inventing false facts.
2. PROMINENTLY FEATURE MATCHED SKILLS: Highlight the core matched skills across the CV bullet points, Cover Letter, and Application Email to maximize ATS relevance.
3. ALIGNMENT IN OUTREACH EMAIL: Summarize the candidate's core matching strengths and address how their experience enables them to quickly excel in key domain requirements.
` : '';

  // Build the CV CSS theme to embed
  const isSidebarLayout = cvStyle.startsWith('sidebar_');

  const cvCssThemes = {
    // ─── Standard Themes (compact for 2-page fit) ──────────────────────────
    cloyola: `@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap');
body{font-family:'Roboto',sans-serif;line-height:1.3;color:#333;max-width:760px;margin:0 auto;padding:10px;font-size:8.5pt;}
header{text-align:left;margin-bottom:8px;background-color:#7c7c7c25;padding:10px 14px;border-radius:6px;}
h1{font-size:16pt;font-weight:700;margin:0 0 4px 0;}
.contact-info{display:flex;justify-content:left;flex-wrap:wrap;gap:8px;font-size:8pt;font-weight:normal;}
.contact-info p{margin:0;}
.contact-info a{color:#0077b5;text-decoration:none;}
.fab,.fas{margin-right:3px;}
span.entry-location{font-weight:normal;}
h2{font-size:10.5pt;font-weight:600;border-bottom:1px dotted #4c4c4c;padding-bottom:1px;margin:7px 0 4px 0;text-align:left;}
.entry{margin-bottom:6px;background-color:#fff;padding:7px 10px;border-radius:5px;box-shadow:1px 1px 3px rgba(0,0,0,0.12);}
.entry-header{display:flex;justify-content:space-between;font-weight:600;font-size:9pt;}
.entry-details{display:flex;justify-content:space-between;font-style:italic;margin-bottom:2px;font-size:8pt;}
.compact-list{margin:2px 0;padding-left:14px;}
.compact-list li{margin-bottom:1px;line-height:1.3;}
.two-column{display:flex;justify-content:space-between;}
.two-column ul{width:48%;margin:0;padding-left:14px;list-style-type:circle;}
a{color:#0077b5;text-decoration:none;}
a:hover{text-decoration:underline;}
section{margin-bottom:4px;}
@media print{body{padding:0;margin:0 12px;font-size:8pt;}@page{margin:6mm 0;}}`,

    josylad_blue: `@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap');
body{font-family:'Poppins',sans-serif;line-height:1.35;color:#2c3e50;max-width:820px;margin:0 auto;padding:10px;font-size:8.5pt;background-color:#f9f9f9;}
header{text-align:center;margin-bottom:8px;background-color:#3498db;padding:10px 14px;border-radius:6px;}
h1{font-size:20pt;font-weight:700;margin:0 0 4px 0;color:#fff;}
.contact-info{display:flex;justify-content:center;flex-wrap:wrap;gap:10px;font-size:8pt;font-weight:300;color:#ecf0f1;}
.contact-info p{margin:0;}
.contact-info a{color:#ecf0f1;text-decoration:none;}
.fab,.fas{margin-right:4px;}
h2{font-size:11pt;font-weight:600;border-bottom:2px solid #3498db;padding-bottom:2px;margin:8px 0 5px 0;color:#2c3e50;}
.entry{margin-bottom:6px;background-color:#fff;padding:7px 10px;border-radius:6px;box-shadow:0 1px 3px rgba(0,0,0,0.08);}
.entry-header{display:flex;justify-content:space-between;font-weight:600;color:#3498db;font-size:9pt;}
.entry-details{display:flex;justify-content:space-between;font-style:italic;margin-bottom:3px;font-size:7.5pt;color:#7f8c8d;}
.compact-list{margin:2px 0;padding-left:16px;}
.compact-list li{margin-bottom:1px;line-height:1.3;}
.two-column{display:flex;justify-content:space-between;flex-wrap:wrap;}
.two-column ul{width:48%;margin:0;padding-left:16px;}
a{color:#3498db;text-decoration:none;}
a:hover{color:#2980b9;text-decoration:underline;}
section{margin-bottom:4px;}
@media print{body{padding:0;margin:0 12px;font-size:8pt;background:#fff;}@page{margin:6mm 0;}}`,

    josylad_grey: `@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap');
body{font-family:'Poppins',sans-serif;line-height:1.35;color:#333;max-width:820px;margin:0 auto;padding:10px;font-size:8.5pt;background-color:#f9f9f9;}
header{text-align:center;margin-bottom:8px;background-color:#4a4a4a;padding:10px 14px;border-radius:6px;}
h1{font-size:20pt;font-weight:700;margin:0 0 4px 0;color:#fff;}
.contact-info{display:flex;justify-content:center;flex-wrap:wrap;gap:10px;font-size:8pt;font-weight:300;color:#e0e0e0;}
.contact-info p{margin:0;}
.contact-info a{color:#e0e0e0;text-decoration:none;}
.fab,.fas{margin-right:4px;}
h2{font-size:11pt;font-weight:600;border-bottom:2px solid #4a4a4a;padding-bottom:2px;margin:8px 0 5px 0;color:#333;}
.entry{margin-bottom:6px;background-color:#fff;padding:7px 10px;border-radius:6px;box-shadow:0 1px 3px rgba(0,0,0,0.08);}
.entry-header{display:flex;justify-content:space-between;font-weight:600;color:#4a4a4a;font-size:9pt;}
.entry-details{display:flex;justify-content:space-between;font-style:italic;margin-bottom:3px;font-size:7.5pt;color:#777;}
.compact-list{margin:2px 0;padding-left:16px;}
.compact-list li{margin-bottom:1px;line-height:1.3;}
.two-column{display:flex;justify-content:space-between;}
.two-column ul{width:48%;margin:0;padding-left:16px;}
a{color:#4a4a4a;text-decoration:none;}
a:hover{color:#333;text-decoration:underline;}
section{margin-bottom:4px;}
@media print{body{padding:0;margin:0 12px;font-size:8pt;background:#fff;}@page{margin:6mm 0;}}`,

    samodum_bold: `@import url('https://fonts.googleapis.com/css2?family=Josefin+Sans&family=Open+Sans:wght@400;600&display=swap');
:root{--accentColor:#1a56db;--HFont:"Josefin Sans",sans-serif;--PFont:"Open Sans",sans-serif;--textColor:#2d3748;--lineColorA:#cbd5e0;}
*{margin:0;padding:0;box-sizing:border-box;color:var(--textColor);font-size:8pt;}
body{max-width:48rem;padding:0.75rem 1rem;display:flex;font-family:var(--PFont);flex-direction:column;gap:0.6rem;margin:0 auto;line-height:1.35;}
a{text-decoration:none;}a:hover{color:var(--accentColor);}
header{display:flex;flex-direction:column;gap:0.4rem;border-bottom:2px solid var(--accentColor);padding-bottom:0.5rem;margin-bottom:0.3rem;}
h1{font-family:var(--HFont);font-size:1.4rem;font-weight:400;color:var(--accentColor);}
.contact-info{display:flex;flex-wrap:wrap;gap:0.5rem 1rem;font-size:7.5pt;}
section h2{font-family:var(--HFont);font-size:0.9rem;font-weight:bold;color:var(--accentColor);padding-bottom:2px;margin-bottom:4px;border-bottom:1px solid var(--lineColorA);}
.entry{padding-top:0.4rem;display:grid;grid-template-columns:9rem 1fr;column-gap:8px;}
.entry:first-of-type{padding-top:0.25rem;}
.entry-header{grid-column:1;font-family:var(--HFont);font-weight:600;display:flex;flex-direction:column;gap:2px;font-size:7.5pt;}
.entry-details,.compact-list{grid-column:2;}
.entry-title{font-family:var(--HFont);font-weight:600;}
.entry-year{font-style:italic;font-size:7pt;}
.compact-list{padding-left:10px;list-style-type:circle;margin:0;}
.compact-list li{margin-bottom:1px;line-height:1.3;}
.two-column{padding-top:0.2rem;display:grid;grid-template-columns:1fr 1fr;column-gap:10px;}
section{margin-bottom:2px;}
@media print{body{padding:0.5rem 0.75rem;}@page{margin:6mm 0;}}`,

    krishnavalliappan: `body{font-family:Arial,sans-serif;line-height:1.25;color:#333;max-width:760px;margin:0 auto;padding:8px;font-size:8.5pt;}
header{text-align:center;margin-bottom:6px;border-bottom:1px solid #333;padding-bottom:6px;}
h1{font-size:18pt;font-weight:700;margin:0 0 3px 0;}
.contact-info{display:flex;justify-content:center;flex-wrap:wrap;gap:8px;font-size:8pt;}
.contact-info p{margin:0;}
.contact-info a{color:#0077b5;text-decoration:none;}
.fab,.fas{margin-right:3px;}
h2{font-size:10.5pt;font-weight:600;border-bottom:1px solid #333;padding-bottom:1px;margin:7px 0 4px 0;text-align:center;}
.entry{margin-bottom:5px;}
.entry-header{display:flex;justify-content:space-between;font-weight:600;font-size:9pt;}
.entry-details{display:flex;justify-content:space-between;font-style:italic;margin-bottom:1px;font-size:7.5pt;}
.compact-list{margin:2px 0;padding-left:14px;}
.compact-list li{margin-bottom:1px;line-height:1.3;}
.two-column{display:flex;justify-content:space-between;}
.two-column ul{width:48%;margin:0;padding-left:14px;}
a{color:#0077b5;text-decoration:none;}
a:hover{text-decoration:underline;}
section{margin-bottom:4px;}
@media print{body{padding:0;margin:0 12px;font-size:8pt;}@page{margin:6mm 0;}}`,

    // ─── NEW: Sidebar with Photo Templates ─────────────────────────────────
    sidebar_dark: `@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@300;400;600;700;800&display=swap');
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Nunito',sans-serif;font-size:8pt;line-height:1.35;background:#fff;display:flex;min-height:100vh;}
.cv-container{display:flex;width:100%;min-height:100%;}
/* ─── SIDEBAR ─── */
.sidebar{width:29%;background:#1b2a4a;color:#d8e0f0;padding:14px 12px;display:flex;flex-direction:column;gap:10px;flex-shrink:0;}
.photo-area{text-align:center;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.15);}
.photo-circle{width:78px;height:78px;border-radius:50%;background:#2d3f6e;margin:0 auto 6px;overflow:hidden;border:3px solid rgba(255,255,255,0.25);display:flex;align-items:center;justify-content:center;}
.photo-circle svg{width:58px;height:58px;}
.candidate-name{font-size:10.5pt;font-weight:800;color:#fff;line-height:1.15;margin-top:4px;}
.candidate-title{font-size:7.5pt;color:#8fa3cc;font-style:italic;margin-top:2px;}
.sidebar-section{display:flex;flex-direction:column;gap:2px;}
.sidebar h3{font-size:7.5pt;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:0.7px;margin-bottom:4px;padding-bottom:2px;border-bottom:1px solid rgba(255,255,255,0.2);}
.sidebar p,.sidebar li{font-size:7pt;color:#b0bcd4;line-height:1.45;margin-bottom:1px;}
.sidebar ul{list-style:none;padding:0;}
.sidebar ul li{display:flex;align-items:flex-start;gap:4px;}
.sidebar ul li i,.sidebar ul li .fas,.sidebar ul li .fab{color:#5b85c5;font-size:6.5pt;margin-top:2px;flex-shrink:0;width:9px;}
.sidebar a{color:#6b9fd4;text-decoration:none;}
.skill-row{margin-bottom:3px;}
.skill-name{font-size:7pt;color:#c0cce0;margin-bottom:2px;}
.skill-bar{background:rgba(255,255,255,0.1);border-radius:2px;height:3px;}
.skill-fill{background:#4e7dc7;height:3px;border-radius:2px;}
.lang-item{display:flex;justify-content:space-between;align-items:center;font-size:7pt;margin-bottom:2px;}
.lang-name{color:#b0bcd4;}
.lang-level{color:#6b9fd4;font-style:italic;}
/* ─── MAIN CONTENT ─── */
.main-content{flex:1;padding:14px 14px;background:#fff;display:flex;flex-direction:column;}
.main-content h2{font-size:9.5pt;font-weight:700;color:#1b2a4a;border-bottom:2px solid #1b2a4a;padding-bottom:2px;margin:8px 0 4px;text-transform:uppercase;letter-spacing:0.4px;}
.main-content>section:first-child h2{margin-top:0;}
.entry{margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid #eef0f5;}
.entry:last-child{border-bottom:none;margin-bottom:0;}
.entry-header{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:1px;}
.entry-name{font-weight:700;font-size:8.5pt;color:#1b2a4a;}
.entry-location{font-size:7pt;color:#9ca3af;}
.entry-details{display:flex;justify-content:space-between;font-size:7.5pt;font-style:italic;color:#555;margin-bottom:2px;}
.compact-list{padding-left:12px;margin:2px 0;}
.compact-list li{margin-bottom:1px;font-size:7.5pt;line-height:1.35;}
.two-column{display:flex;gap:10px;}
.two-column ul{width:48%;padding-left:12px;font-size:7.5pt;}
section{margin-bottom:2px;}
@media print{body{font-size:7.5pt;}@page{margin:0;size:A4;}}`,

    sidebar_light: `@import url('https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700;900&display=swap');
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Lato',sans-serif;font-size:8pt;line-height:1.35;background:#fff;display:flex;min-height:100vh;}
.cv-container{display:flex;width:100%;min-height:100%;}
/* ─── SIDEBAR ─── */
.sidebar{width:29%;background:#eef2f8;color:#374151;padding:14px 12px;display:flex;flex-direction:column;gap:10px;flex-shrink:0;border-right:3px solid #1d4ed8;}
.photo-area{text-align:center;padding-bottom:8px;border-bottom:1px solid #d1d5db;}
.photo-circle{width:78px;height:78px;border-radius:50%;background:#cbd5e1;margin:0 auto 6px;overflow:hidden;border:3px solid #1d4ed8;display:flex;align-items:center;justify-content:center;}
.photo-circle svg{width:58px;height:58px;}
.candidate-name{font-size:10.5pt;font-weight:900;color:#1e3a5f;line-height:1.15;margin-top:4px;}
.candidate-title{font-size:7.5pt;color:#1d4ed8;font-style:italic;margin-top:2px;}
.sidebar-section{display:flex;flex-direction:column;gap:2px;}
.sidebar h3{font-size:7.5pt;font-weight:700;color:#1d4ed8;text-transform:uppercase;letter-spacing:0.7px;margin-bottom:4px;padding-bottom:2px;border-bottom:1px solid #c7d2fe;}
.sidebar p,.sidebar li{font-size:7pt;color:#4b5563;line-height:1.45;margin-bottom:1px;}
.sidebar ul{list-style:none;padding:0;}
.sidebar ul li{display:flex;align-items:flex-start;gap:4px;}
.sidebar ul li i,.sidebar ul li .fas,.sidebar ul li .fab{color:#1d4ed8;font-size:6.5pt;margin-top:2px;flex-shrink:0;width:9px;}
.sidebar a{color:#1d4ed8;text-decoration:none;}
.skill-row{margin-bottom:3px;}
.skill-name{font-size:7pt;color:#374151;margin-bottom:2px;}
.skill-bar{background:#dbeafe;border-radius:2px;height:3px;}
.skill-fill{background:#1d4ed8;height:3px;border-radius:2px;}
.lang-item{display:flex;justify-content:space-between;align-items:center;font-size:7pt;margin-bottom:2px;}
.lang-name{color:#374151;}
.lang-level{color:#1d4ed8;font-style:italic;}
/* ─── MAIN CONTENT ─── */
.main-content{flex:1;padding:14px 14px;background:#fff;}
.main-content h2{font-size:9.5pt;font-weight:700;color:#1e3a5f;border-left:3px solid #1d4ed8;padding-left:7px;margin:8px 0 4px;}
.main-content>section:first-child h2{margin-top:0;}
.entry{margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid #f3f4f6;}
.entry:last-child{border-bottom:none;margin-bottom:0;}
.entry-header{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:1px;}
.entry-name{font-weight:700;font-size:8.5pt;color:#1e3a5f;}
.entry-location{font-size:7pt;color:#9ca3af;}
.entry-details{display:flex;justify-content:space-between;font-size:7.5pt;font-style:italic;color:#6b7280;margin-bottom:2px;}
.compact-list{padding-left:12px;margin:2px 0;}
.compact-list li{margin-bottom:1px;font-size:7.5pt;line-height:1.35;}
.two-column{display:flex;gap:10px;}
.two-column ul{width:48%;padding-left:12px;font-size:7.5pt;}
section{margin-bottom:2px;}
@media print{body{font-size:7.5pt;}@page{margin:0;size:A4;}}`
  };

  const selectedCss = cvCssThemes[cvStyle] || cvCssThemes.cloyola;

  // SVG placeholder avatar for sidebar templates
  const AVATAR_SVG = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="36" r="23" fill="#9ca3af"/><ellipse cx="50" cy="92" rx="38" ry="28" fill="#9ca3af"/></svg>`;

  // HTML structure guidance depending on layout type
  const sidebarStructureGuide = isSidebarLayout ? `
HTML STRUCTURE FOR SIDEBAR TEMPLATE (MUST USE THIS EXACT STRUCTURE):
Use this outer wrapper instead of a plain <body>:
  <body>
    <div class="cv-container">
      <aside class="sidebar">
        <div class="photo-area">
          <div class="photo-circle">${AVATAR_SVG.replace(/</g, '<').replace(/>/g, '>')}</div>
          <div class="candidate-name">[Full Name]</div>
          <div class="candidate-title">[Job Title / Target Role]</div>
        </div>
        <div class="sidebar-section">
          <h3>Contact</h3>
          <ul>
            <li><i class="fas fa-map-marker-alt"></i> [City, Country]</li>
            <li><i class="fas fa-phone"></i> [Phone]</li>
            <li><i class="fas fa-envelope"></i> [Email]</li>
            <li><i class="fab fa-linkedin"></i> [LinkedIn URL short form]</li>
            <li><i class="fab fa-github"></i> [GitHub URL short form]</li>
          </ul>
        </div>
        <div class="sidebar-section">
          <h3>Skills</h3>
          <!-- Use skill-row divs with skill-bar/skill-fill for top 6-8 skills -->
          <div class="skill-row"><div class="skill-name">[Skill]</div><div class="skill-bar"><div class="skill-fill" style="width:90%"></div></div></div>
        </div>
        <div class="sidebar-section">
          <h3>Languages</h3>
          <!-- Use lang-item divs -->
          <div class="lang-item"><span class="lang-name">[Language]</span><span class="lang-level">[Level]</span></div>
        </div>
        <!-- Add Education section in sidebar if compact -->
        <div class="sidebar-section">
          <h3>Education</h3>
          <p><strong>[Degree]</strong></p>
          <p>[University Name]</p>
          <p>[Year Range]</p>
        </div>
      </aside>
      <main class="main-content">
        <section id="work-experience">
          <h2>Work Experience</h2>
          <!-- entries -->
        </section>
        <section id="achievements">
          <h2>Key Achievements</h2>
          <!-- ul compact-list -->
        </section>
        <section id="side-projects">
          <h2>Projects</h2>
          <!-- entries -->
        </section>
        <section id="certifications">
          <h2>Certifications</h2>
          <!-- ul compact-list -->
        </section>
      </main>
    </div>
  </body>
NOTE: For sidebar layout - put contact, skills, languages, education in the sidebar. Put work experience, achievements, projects in main. Do NOT use a <header> tag at the top level.
` : `
HTML STRUCTURE (STANDARD LAYOUT):
- <header> with <h1>[Full Name]</h1> and <div class="contact-info"> with <p class="fas fa-..."> for each contact item
- <section id="work-experience"> with <h2>Work Experience</h2>
- <section id="education"> with <h2>Education</h2>
- <section id="side-projects"> (only if projects exist)
- <section id="achievements"> (only if achievements exist)
- <section id="certifications"> (only if certifications exist)
- <section id="skills-languages"> with <h2>Additional Skills</h2>
Each entry uses: <div class="entry"> > <div class="entry-header"> + <div class="entry-details"> + <ul class="compact-list">
Skills section uses: <div class="two-column"> with two <ul class="compact-list"> columns`;

  const systemPrompt = `
You are an expert Executive Resume Specialist & HTML CV Architect for Ezee Job.
Your task is to analyze the user's Master CV and a target Job Description (JD), and produce:
1. A tailored HTML CV (self-contained, fits within 2 A4 pages)
2. An HTML Cover Letter
3. A professional Application Email
${gapPromptSection}
STRICT TAILORING CONSTRAINTS (MUST FOLLOW OR TASK FAILS):
1. ZERO-FABRICATION RULE: You must NEVER invent skills, job titles, company names, degrees, projects, or metrics. All facts MUST originate from the Master CV.
2. NO PLACEHOLDERS: Never use "[Insert Date]", "[Company Name]", etc. Use real data from the CV or omit.
3. TWO-PAGE MAXIMUM: The CV MUST fit within 2 A4 pages. To achieve this:
   - Use MAX 3-4 bullet points per job role (pick the most impactful ones)
   - Keep bullet points SHORT (1 line ideally, 2 lines maximum)
   - Include only the most recent 3-4 work positions
   - For older/less relevant experience, shorten drastically or omit
   - Sidebar layouts naturally use space better — lean on them
4. CV HTML FORMAT: Complete self-contained HTML. Include the provided CSS in a <style> tag. Include Font Awesome 6 CDN for icons.
5. CV STRUCTURE:
${sidebarStructureGuide}
6. COVER LETTER: Must include "Cover Letter" as bold centered heading. Start with "To," then recipient. Include subject line: <strong>Application for [Target Role]</strong>.
7. JSON OUTPUT ONLY: Return a single valid JSON object with exactly three keys:
   - "applicationEmail": object with "subject" and "body" strings
   - "coverLetterHtml": complete self-contained HTML string for the Cover Letter
   - "tailoredCvHtml": complete self-contained HTML string for the CV (embed this CSS verbatim in <style>: ${selectedCss.replace(/`/g, '\\`')})

MASTER CV DATA:
${masterCv}

TARGET JOB DESCRIPTION:
${jobDescription}

TARGET JOB TITLE:
${targetTitle || 'Target Role'}

Return ONLY a valid JSON object.
`;

  let responseText = '';

  if (provider === 'gemini') {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY is missing.');
    const ai = new GoogleGenAI({ apiKey: key });
    const targetModel = model || 'gemini-2.0-flash';
    const response = await ai.models.generateContent({
      model: targetModel,
      contents: systemPrompt,
      config: {
        responseMimeType: 'application/json'
      }
    });
    responseText = response.text;
  } else if (provider === 'openrouter') {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model || 'openai/gpt-4o-mini',
        messages: [{ role: 'user', content: systemPrompt }],
        temperature: 0.2
      })
    });
    if (!res.ok) throw new Error(`OpenRouter Error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    responseText = data.choices?.[0]?.message?.content || '';
  } else if (provider === 'openai') {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages: [{ role: 'user', content: systemPrompt }],
        temperature: 0.2
      })
    });
    if (!res.ok) throw new Error(`OpenAI Error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    responseText = data.choices?.[0]?.message?.content || '';
  } else if (provider === 'custom') {
    const url = baseUrl || 'http://localhost:11434/v1/chat/completions';
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: model || 'llama3',
        messages: [{ role: 'user', content: systemPrompt }],
        temperature: 0.2
      })
    });
    if (!res.ok) throw new Error(`Custom Endpoint Error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    responseText = data.choices?.[0]?.message?.content || '';
  }

  // Parse JSON from codeblock
  return parseAiJsonResponse(responseText);
}

/**
 * Cleanly extracts and parses JSON from AI markdown response with backslash auto-repair and direct field scanner
 * @param {string} text 
 * @returns {{ applicationEmail: object, tailoredCvTex: string, coverLetterHtml: string }}
 */
function parseAiJsonResponse(text) {
  if (!text) throw new Error('AI returned an empty response.');

  let jsonStr = text.trim();

  // Strip markdown json codeblock if present
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }

  // Extract JSON payload between first '{' and last '}'
  const firstBrace = jsonStr.indexOf('{');
  const lastBrace = jsonStr.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
  }

  let parsed = null;

  // Attempt 1: Direct JSON.parse
  try {
    parsed = JSON.parse(jsonStr);
  } catch (err1) {
    console.warn('Direct JSON parse failed, attempting auto-repair...', err1.message);
  }

  // Attempt 2: Auto-repair unescaped LaTeX backslashes & newlines for standard JSON.parse
  if (!parsed || (!parsed.tailoredCvTex && !parsed.coverLetterHtml)) {
    try {
      const repaired = sanitizeJsonLatex(jsonStr);
      parsed = JSON.parse(repaired);
    } catch (err2) {
      console.warn('Sanitized JSON parse failed, attempting custom field extraction...', err2.message);
    }
  }

  // Attempt 3: Direct string scanner for JSON fields
  if (!parsed || (!parsed.tailoredCvTex && !parsed.coverLetterHtml)) {
    parsed = extractJsonFields(jsonStr);
  }

  // Attempt 4: Direct fallback regex extraction of LaTeX documents and email content
  if (!parsed || (!parsed.tailoredCvTex && !parsed.coverLetterHtml)) {
    parsed = fallbackExtractLatexAndEmail(text);
  }

  // Normalize application email
  let applicationEmail = {
    subject: 'Application for Target Role',
    body: 'Dear Hiring Manager,\n\nPlease find attached my tailored CV and Cover Letter for your review.\n\nBest regards,'
  };

  if (parsed && parsed.applicationEmail) {
    if (typeof parsed.applicationEmail === 'string') {
      applicationEmail.body = parsed.applicationEmail;
    } else if (typeof parsed.applicationEmail === 'object') {
      applicationEmail.subject = parsed.applicationEmail.subject || applicationEmail.subject;
      applicationEmail.body = parsed.applicationEmail.body || applicationEmail.body;
    }
  }

  let tailoredCvHtml = (parsed && (parsed.tailoredCvHtml || parsed.tailoredCvTex)) || '';
  let coverLetterHtml = (parsed && parsed.coverLetterHtml) || '';

  // Ensure documents are non-empty using fallback if needed
  if (!tailoredCvHtml || !coverLetterHtml) {
    const fallback = fallbackExtractHtmlAndEmail(text);
    if (!tailoredCvHtml) tailoredCvHtml = fallback.tailoredCvHtml;
    if (!coverLetterHtml) coverLetterHtml = fallback.coverLetterHtml;
  }

  if (applicationEmail.body) applicationEmail.body = applicationEmail.body.replace(/\\n/g, '\n');

  return {
    applicationEmail,
    tailoredCvHtml,
    coverLetterHtml
  };
}

/**
  * Safely repairs unescaped backslashes in LaTeX JSON string literals
  */
function sanitizeJsonLatex(jsonStr) {
  if (!jsonStr) return '';
  let s = jsonStr;
  // Replace invalid single backslashes in JSON string values
  s = s.replace(/\\(?!["\\/bfnrtu])/g, '\\\\');
  // Escape LaTeX commands starting with \b, \f, \n, \r, \t followed by 2+ letters
  s = s.replace(/\\(b|f|n|r|t)(?=[a-zA-Z]{2,})/g, '\\\\$1');
  return s;
}

/**
 * Extracts specific JSON field string values directly from raw string without calling JSON.parse
 */
function extractJsonField(jsonStr, key) {
  if (!jsonStr) return null;
  const keyRegex = new RegExp(`"${key}"\\s*:\\s*"`, 'i');
  const match = keyRegex.exec(jsonStr);
  if (!match) return null;

  const startIdx = match.index + match[0].length;
  let result = '';
  let i = startIdx;
  let escaped = false;

  while (i < jsonStr.length) {
    const char = jsonStr[i];
    if (escaped) {
      if (char === 'n') result += '\n';
      else if (char === 't') result += '\t';
      else if (char === 'r') result += '\r';
      else if (char === '"') result += '"';
      else if (char === '\\') result += '\\';
      else result += '\\' + char; // Preserve unescaped backslashes (\s, \d, \b, \f, etc)
      escaped = false;
    } else if (char === '\\') {
      escaped = true;
    } else if (char === '"') {
      // Lookahead to check if this quote terminates the JSON string value
      const rest = jsonStr.slice(i + 1).trim();
      if (rest.startsWith(',') || rest.startsWith('}') || rest.startsWith('\n') || rest.startsWith('\r') || rest.length === 0) {
        break; // Reached end of field value
      } else {
        result += '"';
      }
    } else {
      result += char;
    }
    i++;
  }

  return result.trim();
}

/**
 * Extracts all required fields from raw JSON string using extractJsonField
 */
function extractJsonFields(jsonStr) {
  const tailoredCvHtml = extractJsonField(jsonStr, 'tailoredCvHtml') || extractJsonField(jsonStr, 'tailoredCvTex');
  const coverLetterHtml = extractJsonField(jsonStr, 'coverLetterHtml');
  const subject = extractJsonField(jsonStr, 'subject') || 'Application for Target Role';
  const body = extractJsonField(jsonStr, 'body') || 'Dear Hiring Manager,\n\nPlease find attached my tailored CV and Cover Letter for your review.\n\nBest regards,';

  if (tailoredCvHtml || coverLetterHtml) {
    return {
      applicationEmail: { subject, body },
      tailoredCvHtml: tailoredCvHtml || '',
      coverLetterHtml: coverLetterHtml || ''
    };
  }
  return null;
}

/**
 * State-machine JSON sanitizer that properly escapes unescaped LaTeX backslashes inside JSON string literals
 */
function fixJsonLatexEscapes(jsonStr) {
  if (!jsonStr) return '';
  let result = '';
  let inString = false;
  let i = 0;

  while (i < jsonStr.length) {
    const char = jsonStr[i];

    if (!inString) {
      if (char === '"') {
        inString = true;
      }
      result += char;
      i++;
      continue;
    }

    // Inside JSON string literal
    if (char === '"') {
      let backslashCount = 0;
      let j = i - 1;
      while (j >= 0 && jsonStr[j] === '\\') {
        backslashCount++;
        j--;
      }
      if (backslashCount % 2 === 0) {
        inString = false;
      }
      result += char;
      i++;
      continue;
    }

    if (char === '\n') {
      result += '\\n';
      i++;
      continue;
    }
    if (char === '\r') {
      i++;
      continue;
    }

    if (char === '\\') {
      const next = jsonStr[i + 1] || '';

      if (next === '\\') {
        result += '\\\\';
        i += 2;
        continue;
      }

      if (next === '"' || next === '/') {
        result += '\\' + next;
        i += 2;
        continue;
      }

      if (['b', 'f', 'n', 'r', 't'].includes(next)) {
        const afterNext = jsonStr[i + 2] || '';
        if (/[a-zA-Z]/.test(afterNext)) {
          // LaTeX macro like \begin, \frac, \noindent, \ref, \textbf
          result += '\\\\' + next;
          i += 2;
          continue;
        } else {
          result += '\\' + next;
          i += 2;
          continue;
        }
      }

      if (next === 'u') {
        const hex = jsonStr.slice(i + 2, i + 6);
        if (/^[0-9a-fA-F]{4}$/.test(hex)) {
          result += '\\u' + hex;
          i += 6;
          continue;
        }
      }

      // Any other single backslash (e.g. \d, \s, \v, \h, \%, \&, \_, \#, \{, \})
      result += '\\\\';
      i++;
      continue;
    }

    result += char;
    i++;
  }

  return result;
}

/**
 * Fallback parser when JSON structure is damaged or unparseable
 */
function fallbackExtractHtmlAndEmail(text) {
  if (!text) text = '';

  // Try to extract HTML blocks from the response
  const htmlRegex = /<!doctype html[\s\S]*?<\/html>/gi;
  let htmlMatches = [...text.matchAll(htmlRegex)].map(m => m[0]);

  let coverLetterHtml = '';
  let tailoredCvHtml = '';

  if (htmlMatches.length >= 2) {
    // Heuristic: cover letter typically contains 'Cover Letter' heading or 'Dear'
    if (htmlMatches[0].toLowerCase().includes('cover letter') || htmlMatches[0].toLowerCase().includes('dear hiring')) {
      coverLetterHtml = htmlMatches[0];
      tailoredCvHtml = htmlMatches[1];
    } else {
      tailoredCvHtml = htmlMatches[0];
      coverLetterHtml = htmlMatches[1];
    }
  } else if (htmlMatches.length === 1) {
    const h = htmlMatches[0];
    if (h.toLowerCase().includes('cover letter') || h.toLowerCase().includes('dear hiring')) {
      coverLetterHtml = h;
    } else {
      tailoredCvHtml = h;
    }
  }

  let subject = 'Application for Target Role';
  let body = 'Dear Hiring Manager,\n\nPlease find attached my tailored CV and Cover Letter for your review.\n\nBest regards,';

  const subjMatch = text.match(/"subject"\s*:\s*"([^"]+)"/i) || text.match(/Subject:\s*([^\n]+)/i);
  if (subjMatch) subject = subjMatch[1].trim();

  const bodyMatch = text.match(/"body"\s*:\s*"([\s\S]*?)"\s*(?:,|\n\s*\}|\n\s*")/i);
  if (bodyMatch) {
    body = bodyMatch[1]
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\t/g, '\t')
      .trim();
  }

  if (!tailoredCvHtml) {
    tailoredCvHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; color: #333; max-width: 700px; margin: 0 auto; padding: 20px; font-size: 10pt; }
    header { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    h1 { font-size: 22pt; margin: 0 0 8px; }
    h2 { font-size: 14pt; border-bottom: 1px solid #333; padding-bottom: 4px; margin: 16px 0 8px; }
    .entry { margin-bottom: 12px; }
    .entry-header { display: flex; justify-content: space-between; font-weight: 600; }
    .entry-details { display: flex; justify-content: space-between; font-style: italic; font-size: 9pt; }
    .compact-list { padding-left: 16px; margin: 4px 0; }
    .compact-list li { margin-bottom: 3px; }
    .two-column { display: flex; gap: 20px; }
    .two-column ul { width: 48%; padding-left: 16px; }
  </style>
</head>
<body>
  <header><h1>Tailored Candidate CV</h1><div class="contact-info"></div></header>
  <section id="work-experience"><h2>Work Experience</h2><p>Experience tailored for target role.</p></section>
  <section id="skills-languages"><h2>Additional Skills</h2><div class="two-column"><ul class="compact-list"><li>Skills will appear here</li></ul></div></section>
</body>
</html>`;
  }

  if (!coverLetterHtml) {
    coverLetterHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; color: #111827; margin: 0; padding: 0px; line-height: 1.55; }
    h1 { text-align: center; font-size: 22px; margin: 0 0 24px; font-weight: bold; }
    .content { font-size: 12.5pt; }
    .paragraph { margin: 0 0 14px; }
  </style>
</head>
<body>
  <h1><strong>Cover Letter</strong></h1>
  <div class="content">
    <p class="paragraph">To,</p>
    <p class="paragraph">Hiring Manager</p>
    <p class="paragraph"><strong>Subject: Application for Target Role</strong></p>
    <p class="paragraph">Dear Hiring Manager,</p>
    <p class="paragraph">Please find attached my application for the target role.</p>
    <p class="paragraph">Sincerely,<br>Candidate</p>
  </div>
</body>
</html>`;
  }

  return {
    applicationEmail: { subject, body },
    coverLetterHtml,
    tailoredCvHtml
  };
}


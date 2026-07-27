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
 * Generates tailored LaTeX CV and HTML Cover Letter using the chosen AI provider
 * @param {object} params { masterCv, jobDescription, targetTitle, config }
 * @returns {Promise<{ tailoredCvTex: string, coverLetterHtml: string }>}
 */
export async function generateTailoredDocument(params) {
  const { masterCv, jobDescription, targetTitle = '', config = {}, gapReport = null } = params;
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

  const systemPrompt = `
You are an expert Executive Resume Specialist & document generator for Ezee Job.
Your task is to analyze the user's Master CV and a target Job Description (JD), and produce a tailored LaTeX CV and a cover letter rendered as clean HTML specifically optimized for the role.
${gapPromptSection}
STRICT TAILORING CONSTRAINTS (MUST FOLLOW OR TASK FAILS):
1. ZERO-FABRICATION RULE: You must NEVER invent new skills, job titles, company names, degrees, open-source projects, or quantitative metric numbers. All facts, achievements, metrics, and dates MUST originate exclusively from the provided Master CV. You may reword, prioritize, and highlight relevant achievements from the Master CV to match the Job Description, but NEVER invent untrue facts.
2. NO PLACEHOLDERS: Never output placeholders like "[Insert Date]", "[Company Name]", "[Hiring Manager]", or "[Insert Skill]". Infer actual names and details from the Master CV and JD, or omit the phrase completely.
3. COMPLETE LATEX COMPILABILITY: The CV must be complete, syntactically flawless LaTeX code starting with \documentclass and ending with \end{document}.
4. STRICT NO '\n' RULE: You MUST NEVER use or output literal '\n' characters, '\\n' text strings, or raw 'n' escape characters inside any LaTeX fields, contact lines, address blocks, or email bodies. For line breaks in LaTeX, ALWAYS use double backslashes (\\\\). NEVER write '\n' as a text string anywhere.
5. LATEX ESCAPING: Ensure all LaTeX special characters in textual fields are properly escaped:
   - Escape % as \%
   - Escape & as \&
   - Escape $ as \$
   - Escape # as \#
   - Escape _ as \_
   - Escape { as \{ and } as \}
6. COVER LETTER LAYOUT RULE: The cover letter must be HTML that mirrors a classic business-letter layout: centered bold title, sender block aligned to the right, recipient block aligned to the left, date aligned to the right, bold subject line, greeting, body paragraphs, closing, and signature.
7. JSON OUTPUT ONLY: You MUST return a single valid JSON object.
In JSON strings, escape all LaTeX backslashes as double-backslashes (e.g. \\\\documentclass, \\\\begin{document}, \\\\section, \\\\textbf, \\\\%).
The JSON object MUST contain three keys:
- "applicationEmail": An object with "subject" (e.g. "Application for [Target Role] - [Candidate Name]") and "body" (a complete, highly professional, tailored 3-paragraph outreach email addressing the recruiter/hiring manager, summarizing key matching qualifications and enthusiasm for the role).
- "coverLetterHtml": Complete, self-contained HTML string for the Cover Letter in the exact business-letter layout described above.
- "tailoredCvTex": Complete, compilable LaTeX string for the CV (using sb2nov style with sections: Summary, Technical Skills, Work Experience, Projects, Education).

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

  // Parse JSON from codeblock and normalize the cover letter into the fixed HTML layout.
  return parseAiJsonResponse(responseText, { masterCv, jobDescription, targetTitle });
}

/**
 * Cleanly extracts and parses JSON from AI markdown response with backslash auto-repair and direct field scanner
 * @param {string} text 
 * @returns {{ applicationEmail: object, tailoredCvTex: string, coverLetterHtml: string }}
 */
function parseAiJsonResponse(text, context = {}) {
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

  let tailoredCvTex = (parsed && parsed.tailoredCvTex) || '';
  let coverLetterHtml = (parsed && parsed.coverLetterHtml) || '';

  // Ensure documents are non-empty using fallback if needed
  if (!tailoredCvTex || !coverLetterHtml) {
    const fallback = fallbackExtractLatexAndEmail(text);
    if (!tailoredCvTex) tailoredCvTex = fallback.tailoredCvTex;
    if (!coverLetterHtml) coverLetterHtml = fallback.coverLetterHtml;
  }

  // Normalize double backslashes on LaTeX macro commands if present (e.g. \\documentclass -> \documentclass)
  // WITHOUT destroying LaTeX line breaks (\\) and ensure NO literal \n strings exist
  const fixMacroBackslashes = (tex) => {
    if (!tex) return '';
    let cleaned = tex.replace(/\\\\(documentclass|begin|end|section|subsection|subsubsection|textbf|textit|item|usepackage|pagestyle|geometry|href|url|vspace|hspace|small|large|Large|bfseries|itshape|raggedright|centering|noindent|par|definecolor|color|setlength|addtolength|renewenvironment|newcommand|author|title|date|maketitle|input|include|RequirePackage|ProcessOptions|LoadClass)/g, '\\$1');
    // Convert any literal '\n' string to LaTeX line breaks (\\) if in address/header or replace with newline
    cleaned = cleaned.replace(/\\n/g, ' \\\\ ');
    return cleaned;
  };

  if (tailoredCvTex) tailoredCvTex = fixMacroBackslashes(tailoredCvTex);
  if (applicationEmail.body) applicationEmail.body = applicationEmail.body.replace(/\\n/g, '\n');

  coverLetterHtml = normalizeCoverLetterHtml(coverLetterHtml, {
    masterCv: context.masterCv || '',
    jobDescription: context.jobDescription || '',
    targetTitle: context.targetTitle || '',
    applicationEmail,
    sourceText: text
  });

  return {
    applicationEmail,
    tailoredCvTex,
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
  const tailoredCvTex = extractJsonField(jsonStr, 'tailoredCvTex');
  const coverLetterHtml = extractJsonField(jsonStr, 'coverLetterHtml');
  const subject = extractJsonField(jsonStr, 'subject') || 'Application for Target Role';
  const body = extractJsonField(jsonStr, 'body') || 'Dear Hiring Manager,\n\nPlease find attached my tailored CV and Cover Letter for your review.\n\nBest regards,';

  if (tailoredCvTex || coverLetterHtml) {
    return {
      applicationEmail: { subject, body },
      tailoredCvTex: tailoredCvTex || '',
      coverLetterHtml: coverLetterHtml || ''
    };
  }
  return null;
}

function normalizeCoverLetterHtml(sourceHtml, context = {}) {
  const candidateProfile = extractCandidateProfile(context.masterCv || '');
  const recipientProfile = extractRecipientProfile(context.jobDescription || '', context.targetTitle || '');
  const subjectText = cleanSubjectLine((context.applicationEmail && context.applicationEmail.subject) || `Application for ${context.targetTitle || 'Target Role'} Position`);
  const bodyParagraphs = extractLetterParagraphs(htmlToPlainText(sourceHtml || context.sourceText || ''), context.applicationEmail?.body || '');
  const dateText = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date());

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page { size: Letter; margin: 0.7in 0.75in; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #111827;
      font-size: 11pt;
      line-height: 1.45;
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
    }
    .page { min-height: 100%; }
    .title {
      text-align: center;
      font-size: 23px;
      font-weight: 700;
      margin: 4px 0 18px;
    }
    .header-area {
      width: 100%;
      min-height: 170px;
      margin-bottom: 14px;
      position: relative;
    }
    .sender {
      float: right;
      text-align: left;
      min-width: 220px;
      white-space: pre-line;
      margin-top: 6px;
    }
    .sender .name { font-weight: 700; }
    .recipient {
      clear: both;
      display: inline-block;
      white-space: pre-line;
      margin-top: 64px;
      max-width: 52%;
    }
    .date {
      text-align: right;
      margin: 10px 0 18px;
      white-space: nowrap;
    }
    .subject {
      font-weight: 700;
      font-size: 12.5pt;
      margin: 0 0 18px;
      padding-top: 2px;
    }
    .body p { margin: 0 0 14px; }
    .closing { margin-top: 18px; }
    .signature { margin-top: 28px; font-weight: 700; }
    .enclosure { margin-top: 18px; }
  </style>
</head>
<body>
  <div class="page">
    <div class="title">Cover Letter</div>

    <div class="header-area">
      <div class="sender">
        <div class="name">${escapeHtml(candidateProfile.name)}</div>
        ${candidateProfile.address ? `<div>${escapeHtml(candidateProfile.address).replace(/\n/g, '<br>')}</div>` : ''}
        ${candidateProfile.location ? `<div>${escapeHtml(candidateProfile.location)}</div>` : ''}
        ${candidateProfile.email ? `<div>${escapeHtml(candidateProfile.email)}</div>` : ''}
        ${candidateProfile.phone ? `<div>${escapeHtml(candidateProfile.phone)}</div>` : ''}
      </div>

      <div class="recipient">${escapeHtml(recipientProfile.recipientName)}${recipientProfile.companyName ? `\n${escapeHtml(recipientProfile.companyName)}` : ''}${recipientProfile.companyAddress ? `\n${escapeHtml(recipientProfile.companyAddress)}` : ''}</div>

      <div class="date">${escapeHtml(dateText)}</div>
    </div>

    <div class="subject">${escapeHtml(subjectText)}</div>

    <div class="body">
      ${(bodyParagraphs.length > 0 ? bodyParagraphs : [
        'Dear Hiring Manager,',
        'Please find attached my application for the target role.',
        'Sincerely,\nCandidate'
      ]).map(paragraph => `<p>${paragraph}</p>`).join('\n')}
    </div>

    <div class="closing">Yours sincerely</div>
    <div class="signature">${escapeHtml(candidateProfile.name)}</div>
    <div class="enclosure">Enclosure: CV</div>
  </div>
</body>
</html>`;
}

function extractCandidateProfile(masterCv) {
  const text = String(masterCv || '').replace(/\r/g, '\n');
  const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const phoneMatch = text.match(/(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)?\d{3,4}[\s-]?\d{3,4}/);
  const lines = text
    .split('\n')
    .map(line => line.replace(/^#+\s*/, '').trim())
    .filter(Boolean)
    .filter(line => !/^(summary|skills|experience|education|projects|contact)/i.test(line));

  const name = lines.find(line => /^[A-Za-z][A-Za-z.'\- ]{2,}$/.test(line) && line.split(/\s+/).length <= 5) || 'Candidate Name';
  const location = lines.find(line => /,|\b(?:city|state|country|india|usa|uk|germany|canada|australia)\b/i.test(line) && line !== name) || '';
  const addressLines = lines.slice(0, 3).filter(line => line !== name && line !== location);

  return {
    name,
    email: emailMatch ? emailMatch[0] : '',
    phone: phoneMatch ? phoneMatch[0] : '',
    location,
    address: addressLines.join('\n')
  };
}

function extractRecipientProfile(jobDescription, targetTitle) {
  const companyMatch = String(jobDescription || '').match(/^(?:company|organization|employer)[:\-]\s*(.+)$/im);
  const addressMatch = String(jobDescription || '').match(/^(?:location|address)[:\-]\s*(.+)$/im);

  return {
    recipientName: 'Hiring Manager',
    companyName: companyMatch ? companyMatch[1].trim() : (targetTitle ? `${targetTitle} Team` : ''),
    companyAddress: addressMatch ? addressMatch[1].trim() : ''
  };
}

function htmlToPlainText(input) {
  if (!input) return '';
  return String(input)
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li>/gi, '- ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractLetterParagraphs(text, emailBody = '') {
  const source = String(text || emailBody || '')
    .replace(/^(cover letter|re:\s*application.*)$/im, '')
    .trim();

  const blocks = source
    .split(/\n\s*\n/)
    .map(block => block.trim())
    .filter(Boolean)
    .filter(block => !/^cover letter$/i.test(block))
    .filter(block => !/^application for .* position$/i.test(block));

  const usableBlocks = blocks.length > 0 ? blocks : (emailBody ? emailBody.split(/\n\s*\n/) : []);
  const filtered = [];
  let started = false;

  for (const block of usableBlocks) {
    const normalized = block.replace(/\s+/g, ' ').trim();
    if (!started) {
      if (/^dear\b/i.test(normalized)) {
        started = true;
        filtered.push(normalized);
      }
      continue;
    }

    if (/^(yours sincerely|sincerely|best regards|regards|kind regards)$/i.test(normalized)) {
      break;
    }
    if (/^(cover letter|re:|subject:|enclosure:)/i.test(normalized)) {
      continue;
    }
    filtered.push(normalized);
  }

  if (filtered.length === 0) {
    return [
      'Dear Hiring Manager,',
      'Please find attached my application for the target role.',
      'Sincerely,\nCandidate'
    ].map(item => escapeHtml(item).replace(/\n/g, '<br>'));
  }

  return filtered.map(item => escapeHtml(item).replace(/\n/g, '<br>'));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cleanSubjectLine(value) {
  return String(value ?? '')
    .replace(/^subject:\s*/i, '')
    .replace(/^re:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim() || 'Application for Target Role Position';
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
function fallbackExtractLatexAndEmail(text) {
  if (!text) text = '';

  const docRegex = /(?:\\{1,2})documentclass[\s\S]*?(?:\\{1,2})end\{document\}/gi;
  let matches = [...text.matchAll(docRegex)].map(m => m[0].replace(/\\\\/g, '\\'));

  let coverLetterHtml = '';
  let tailoredCvTex = '';

  if (matches.length >= 2) {
    if (matches[0].toLowerCase().includes('letter') || matches[0].toLowerCase().includes('dear')) {
      coverLetterHtml = convertFallbackCoverLetterToHtml(matches[0]);
      tailoredCvTex = matches[1];
    } else {
      tailoredCvTex = matches[0];
      coverLetterHtml = convertFallbackCoverLetterToHtml(matches[1]);
    }
  } else if (matches.length === 1) {
    tailoredCvTex = matches[0];
    coverLetterHtml = convertFallbackCoverLetterToHtml(matches[0]);
  }

  let subject = 'Application for Target Role';
  let body = 'Dear Hiring Manager,\n\nPlease find attached my tailored CV and Cover Letter for your review.\n\nBest regards,';

  const subjMatch = text.match(/"subject"\s*:\s*"([^"]+)"/i) || text.match(/Subject:\s*([^\n]+)/i);
  if (subjMatch) subject = subjMatch[1].trim();

  const bodyMatch = text.match(/"body"\s*:\s*"([\s\S]*?)"\s*(?:,|\n\s*\}|\n\s*")/i) || text.match(/Body:\s*([\s\S]*?)(?:\\end\{document\}|$)/i);
  if (bodyMatch) {
    body = bodyMatch[1]
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
      .replace(/\\t/g, '\t')
      .trim();
  }

  if (!tailoredCvTex) {
    tailoredCvTex = `\\documentclass[11pt,a4paper]{article}
\\usepackage[margin=0.75in]{geometry}
\\usepackage{hyperref}
\\begin{document}
\\begin{center}
{\\Huge \\textbf{Tailored Candidate CV}}
\\end{center}
\\section*{Professional Summary}
Candidate summary tailored for target role.
\\end{document}`;
  }

  if (!coverLetterHtml) {
    coverLetterHtml = normalizeCoverLetterHtml('', {
      masterCv,
      jobDescription,
      targetTitle,
      applicationEmail
    });
  }

  return {
    applicationEmail: { subject, body },
    coverLetterHtml,
    tailoredCvTex
  };
}

function convertFallbackCoverLetterToHtml(source) {
  return normalizeCoverLetterHtml(source, {});
}

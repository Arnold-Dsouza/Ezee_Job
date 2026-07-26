import { GoogleGenAI } from '@google/genai';

/**
 * Zero-LLM Keyword Matcher & Gap Analyzer
 * Compares Master CV against Target Job Description
 */

// Common tech, frameworks, languages, methodologies, and professional keywords lexicon
const COMMON_SKILLS_LEXICON = new Set([
  // Programming Languages
  'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'golang', 'go', 'rust', 'ruby', 'php', 'swift', 'kotlin', 'sql', 'html', 'css', 'bash', 'shell', 'r', 'scala',
  // Frameworks & Libraries
  'react', 'react native', 'vue', 'vue.js', 'angular', 'next.js', 'nuxt', 'node.js', 'express', 'express.js', 'nest.js', 'django', 'flask', 'fastapi', 'spring', 'spring boot', 'laravel', 'rails', 'asp.net', 'tailwind', 'bootstrap', 'jquery', 'redux', 'graphql', 'rest api', 'restful api', 'microservices',
  // Databases & Storage
  'postgresql', 'postgres', 'mysql', 'mongodb', 'redis', 'dynamodb', 'elasticsearch', 'oracle', 'sqlite', 'cassandra', 'firebase', 'firestore', 'supabase', 'snowflake', 'bigquery',
  // Cloud & DevOps
  'aws', 'amazon web services', 'azure', 'gcp', 'google cloud', 'docker', 'kubernetes', 'k8s', 'terraform', 'ansible', 'jenkins', 'github actions', 'gitlab ci', 'ci/cd', 'nginx', 'linux', 'cloudformation', 'helm', 'serverless', 'lambda',
  // AI, ML & Data Science
  'machine learning', 'deep learning', 'artificial intelligence', 'ai', 'llm', 'large language models', 'generative ai', 'pytorch', 'tensorflow', 'scikit-learn', 'pandas', 'numpy', 'nlp', 'natural language processing', 'computer vision', 'opencv', 'langchain', 'gemini', 'openai', 'prompt engineering', 'data analysis',
  // Architecture & Methodologies
  'agile', 'scrum', 'kanban', 'devops', 'sysops', 'oop', 'object oriented', 'system design', 'cloud architecture', 'unit testing', 'integration testing', 'jest', 'cypress', 'playwright', 'tdd', 'test driven development', 'security', 'oauth', 'jwt', 'web security', 'performance optimization',
  // Tools & Soft Skills
  'git', 'github', 'gitlab', 'bitbucket', 'jira', 'confluence', 'figma', 'docker', 'postman', 'vscode', 'leadership', 'project management', 'cross-functional', 'communication', 'problem solving', 'code review', 'mentorship'
]);

/**
 * Normalizes text for keyword tokenization
 * @param {string} text 
 * @returns {string[]}
 */
function tokenizeText(text) {
  if (!text) return [];
  const lower = text.toLowerCase();
  
  // Extract words and hyphenated/dotted tech terms
  const rawTokens = lower.match(/[a-z0-9\+\#\.\-]+/g) || [];
  
  return rawTokens.map(t => t.replace(/^[.\-]+|[.\-]+$/g, '')).filter(Boolean);
}

/**
 * Extracts key technical and domain skills from a body of text
 * @param {string} text 
 * @returns {{ skill: string, count: number }[]}
 */
function extractSkills(text) {
  if (!text) return [];
  const lowerText = text.toLowerCase();
  const skillCounts = new Map();

  // 1. Check known multi-word & single-word skills from lexicon
  COMMON_SKILLS_LEXICON.forEach(skill => {
    // Regex boundary check for clean word matching
    const regex = new RegExp(`(?:^|[^a-z0-9])${escapeRegex(skill)}(?:$|[^a-z0-9])`, 'gi');
    const matches = lowerText.match(regex);
    if (matches && matches.length > 0) {
      skillCounts.set(skill, matches.length);
    }
  });

  // 2. Extract capitalized tech buzzwords / acronyms (e.g. AWS, CI/CD, K8s, SDK)
  const capitalizedTerms = text.match(/\b[A-Z0-9]{2,10}\b/g) || [];
  capitalizedTerms.forEach(term => {
    const lower = term.toLowerCase();
    if (!['AND', 'FOR', 'THE', 'WITH', 'YOU', 'OUR', 'NOT', 'ARE', 'THIS'].includes(term)) {
      skillCounts.set(lower, (skillCounts.get(lower) || 0) + 1);
    }
  });

  // Convert to array and sort by frequency
  return Array.from(skillCounts.entries())
    .map(([skill, count]) => ({ skill, count }))
    .sort((a, b) => b.count - a.count);
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Analyzes gaps between Master CV and Job Description
 * @param {string} masterCv 
 * @param {string} jobDescription 
 * @returns {object} Gap analysis report
 */
export function analyzeGap(masterCv, jobDescription) {
  const cvSkills = extractSkills(masterCv);
  const jdSkills = extractSkills(jobDescription);

  const cvSkillSet = new Set(cvSkills.map(s => s.skill));
  const jdSkillSet = new Set(jdSkills.map(s => s.skill));

  const existingSkills = [];
  const missingSkills = [];

  jdSkills.forEach(({ skill, count }) => {
    // Format label nicely (e.g., "node.js" -> "Node.js", "react" -> "React")
    const formattedSkill = formatSkillName(skill);
    if (cvSkillSet.has(skill)) {
      existingSkills.push({ name: formattedSkill, raw: skill, frequency: count });
    } else {
      missingSkills.push({ name: formattedSkill, raw: skill, frequency: count });
    }
  });

  const totalJdSkillsCount = jdSkills.length;
  const matchedCount = existingSkills.length;
  
  const skillMatchPercentage = totalJdSkillsCount > 0 
    ? Math.min(100, Math.round((matchedCount / totalJdSkillsCount) * 100))
    : 100;

  // Generate actionable recommendations
  const recommendations = [];
  if (missingSkills.length > 0) {
    const topMissing = missingSkills.slice(0, 5).map(s => s.name).join(', ');
    recommendations.push(`Highlight any related exposure to top missing target skills: ${topMissing}.`);
  }
  if (existingSkills.length > 0) {
    recommendations.push(`Emphasize your strong experience with core requirements: ${existingSkills.slice(0, 4).map(s => s.name).join(', ')}.`);
  }
  recommendations.push('Ensure experience bullet points use action verbs and quantify outcomes where possible.');

  return {
    skillMatchPercentage,
    existingSkills,
    missingSkills,
    topJdKeywords: jdSkills.slice(0, 10).map(s => ({ name: formatSkillName(s.skill), frequency: s.count })),
    recommendations
  };
}

function formatSkillName(skill) {
  const map = {
    'javascript': 'JavaScript',
    'typescript': 'TypeScript',
    'python': 'Python',
    'java': 'Java',
    'golang': 'Go / Golang',
    'c++': 'C++',
    'c#': 'C#',
    'react': 'React.js',
    'vue': 'Vue.js',
    'angular': 'Angular',
    'node.js': 'Node.js',
    'express': 'Express.js',
    'next.js': 'Next.js',
    'aws': 'AWS',
    'gcp': 'Google Cloud (GCP)',
    'azure': 'Azure',
    'docker': 'Docker',
    'kubernetes': 'Kubernetes',
    'postgresql': 'PostgreSQL',
    'mongodb': 'MongoDB',
    'graphql': 'GraphQL',
    'ci/cd': 'CI/CD Pipelines',
    'rest api': 'REST APIs',
    'ai': 'AI / GenAI',
    'llm': 'LLMs'
  };
  if (map[skill]) return map[skill];
  return skill.charAt(0).toUpperCase() + skill.slice(1);
}

/**
 * AI LLM-Driven Keyword Matcher & Gap Analyzer
 * Performs deep semantic match evaluation beyond simple word tokens.
 * @param {object} params { masterCv, jobDescription, config }
 * @returns {Promise<object>}
 */
export async function analyzeGapLlm({ masterCv, jobDescription, config = {} }) {
  const { provider = 'gemini', apiKey, model, baseUrl } = config;

  const systemPrompt = `
You are an expert AI Executive Recruiter & ATS Gap Analysis Specialist.
Analyze the provided Master CV against the Target Job Description (JD).
Perform a deep semantic match evaluation beyond simple keyword token matching.
Identify:
1. "skillMatchPercentage": Integer (0-100) representing semantic qualification match score based on experience, core technical stack, and domain alignment.
2. "existingSkills": Array of objects [{ "name": "Skill Name", "raw": "skill_id", "frequency": number }] for skills present in CV that directly match or satisfy JD requirements.
3. "missingSkills": Array of objects [{ "name": "Skill Name", "raw": "skill_id", "frequency": number }] for key JD requirements that are missing, weak, or implicit in the CV.
4. "topJdKeywords": Array of objects [{ "name": "Keyword/Skill", "frequency": number }] representing top 8-10 essential JD requirements.
5. "recommendations": Array of strings (3-5 actionable recommendations explaining specifically how to reframe CV experience, emphasize transferable skills, and address gaps in the Cover Letter and Application Email).

MASTER CV:
${masterCv}

TARGET JOB DESCRIPTION:
${jobDescription}

Return ONLY a valid JSON object matching the requested schema.
`;

  let responseText = '';

  try {
    if (provider === 'gemini') {
      const key = apiKey || process.env.GEMINI_API_KEY;
      if (!key) throw new Error('GEMINI_API_KEY is missing.');
      const ai = new GoogleGenAI({ apiKey: key });
      const targetModel = model || 'gemini-2.0-flash';
      const response = await ai.models.generateContent({
        model: targetModel,
        contents: systemPrompt,
        config: { responseMimeType: 'application/json' }
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

    // Parse JSON
    let jsonStr = responseText.trim();
    const codeBlock = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeBlock) jsonStr = codeBlock[1].trim();
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
    }

    const parsed = JSON.parse(jsonStr);
    return {
      mode: 'llm',
      skillMatchPercentage: typeof parsed.skillMatchPercentage === 'number' ? parsed.skillMatchPercentage : 80,
      existingSkills: Array.isArray(parsed.existingSkills) ? parsed.existingSkills : [],
      missingSkills: Array.isArray(parsed.missingSkills) ? parsed.missingSkills : [],
      topJdKeywords: Array.isArray(parsed.topJdKeywords) ? parsed.topJdKeywords : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : []
    };
  } catch (err) {
    console.warn('LLM Gap Analysis failed, falling back to Zero-LLM matcher:', err.message);
    const zeroReport = analyzeGap(masterCv, jobDescription);
    return {
      ...zeroReport,
      mode: 'zero-llm',
      fallbackNotice: `LLM analysis fallback (${err.message}). Showing Zero-LLM algorithmic report.`
    };
  }
}


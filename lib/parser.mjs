/**
 * Parses a PDF buffer into structured Markdown.
 *
 * Uses `unpdf` — a pure-JS, zero-native-deps wrapper around pdfjs-dist
 * that is safe on Vercel, Cloudflare Workers, and other serverless runtimes.
 * No DOMMatrix, no @napi-rs/canvas, no worker threads required.
 *
 * @param {Buffer|Uint8Array} pdfBuffer
 * @returns {Promise<{text: string, markdown: string, pageCount: number}>}
 */
export async function parsePdfToMarkdown(pdfBuffer) {
  try {
    // unpdf requires a plain Uint8Array (not a Node Buffer subclass)
    const uint8Array = Buffer.isBuffer(pdfBuffer)
      ? new Uint8Array(pdfBuffer.buffer, pdfBuffer.byteOffset, pdfBuffer.byteLength)
      : pdfBuffer instanceof Uint8Array
        ? new Uint8Array(pdfBuffer.buffer, pdfBuffer.byteOffset, pdfBuffer.byteLength)
        : new Uint8Array(pdfBuffer);

    const { extractText } = await import('unpdf');

    // mergePages: true → returns a single string for the whole document
    const { text: rawText, totalPages } = await extractText(uint8Array, {
      mergePages: true,
    });

    const pageCount = totalPages || 1;
    const structuredMarkdown = structureTextToMarkdown(rawText || '');

    return { text: rawText || '', markdown: structuredMarkdown, pageCount };

  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw new Error(`Failed to parse PDF document: ${error.message}`);
  }
}

/**
 * Converts raw unstructured resume text into clean Markdown
 * @param {string} text
 * @returns {string}
 */
export function structureTextToMarkdown(text) {
  if (!text || typeof text !== 'string') return '';

  let cleaned = text
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');

  const lines = cleaned.split('\n');
  const markdownLines = [];

  const sectionRegexes = [
    { header: '## Contact Information',  pattern: /^(contact|personal info|address|get in touch)/i },
    { header: '## Professional Summary', pattern: /^(summary|profile|about me|objective|executive summary)/i },
    { header: '## Work Experience',      pattern: /^(experience|work experience|employment|career history|work history|professional experience)/i },
    { header: '## Education',            pattern: /^(education|academic background|qualifications|academic history)/i },
    { header: '## Skills',               pattern: /^(skills|technical skills|competencies|technologies|expertise|skills & tools)/i },
    { header: '## Projects',             pattern: /^(projects|key projects|personal projects|notable projects)/i },
    { header: '## Certifications',       pattern: /^(certifications|certificates|licenses|courses)/i },
    { header: '## Awards & Achievements',pattern: /^(awards|achievements|honors|publications)/i }
  ];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    let matchedHeader = false;
    for (const { header, pattern } of sectionRegexes) {
      if (pattern.test(line) && line.length < 40) {
        markdownLines.push(`\n${header}\n`);
        matchedHeader = true;
        break;
      }
    }

    if (!matchedHeader) {
      if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*')) {
        markdownLines.push(`- ${line.replace(/^[•\-\*]\s*/, '')}`);
      } else if (line.match(/^(19|20)\d{2}\s*[\-\–]\s*((19|20)\d{2}|Present|Current)/i)) {
        markdownLines.push(`*${line}*`);
      } else {
        markdownLines.push(line);
      }
    }
  }

  let finalMd = markdownLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();

  if (!finalMd.includes('##')) {
    finalMd = `## Master Resume\n\n${finalMd}`;
  }

  return finalMd;
}

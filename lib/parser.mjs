import { PDFParse } from 'pdf-parse';

/**
 * Parses a PDF buffer or string into structured Markdown
 * @param {Buffer|Uint8Array} pdfBuffer
 * @returns {Promise<{text: string, markdown: string, pageCount: number}>}
 */
export async function parsePdfToMarkdown(pdfBuffer) {
  try {
    let rawText = '';
    let pageCount = 1;

    if (typeof PDFParse === 'function' && PDFParse.prototype && PDFParse.prototype.getText) {
      const parser = new PDFParse({ data: pdfBuffer });
      const result = await parser.getText();
      rawText = result.text || '';
      pageCount = result.total || result.pages?.length || 1;
    } else {
      const pdfParseModule = await import('pdf-parse');
      const parseFn = pdfParseModule.default || pdfParseModule.pdfParse || pdfParseModule;
      if (typeof parseFn === 'function') {
        const data = await parseFn(pdfBuffer);
        rawText = data.text || '';
        pageCount = data.numpages || 1;
      } else {
        throw new Error('PDFParse class or function unavailable');
      }
    }

    const structuredMarkdown = structureTextToMarkdown(rawText);

    return {
      text: rawText,
      markdown: structuredMarkdown,
      pageCount
    };
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

  // Clean up common PDF formatting artifacts & literal \n string sequences
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
    { header: '## Contact Information', pattern: /^(contact|personal info|address|get in touch)/i },
    { header: '## Professional Summary', pattern: /^(summary|profile|about me|objective|executive summary)/i },
    { header: '## Work Experience', pattern: /^(experience|work experience|employment|career history|work history|professional experience)/i },
    { header: '## Education', pattern: /^(education|academic background|qualifications|academic history)/i },
    { header: '## Skills', pattern: /^(skills|technical skills|competencies|technologies|expertise|skills & tools)/i },
    { header: '## Projects', pattern: /^(projects|key projects|personal projects|notable projects)/i },
    { header: '## Certifications', pattern: /^(certifications|certificates|licenses|courses)/i },
    { header: '## Awards & Achievements', pattern: /^(awards|achievements|honors|publications)/i }
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
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
      // Check if line looks like a bullet point or company header
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

  // If no Markdown headers were matched, add default structure
  if (!finalMd.includes('##')) {
    finalMd = `## Master Resume\n\n${finalMd}`;
  }

  return finalMd;
}

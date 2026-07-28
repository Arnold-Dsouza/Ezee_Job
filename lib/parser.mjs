/**
 * Parses a PDF buffer or string into structured Markdown.
 * Vercel-safe: polyfills browser globals (DOMMatrix etc.) before loading pdfjs-dist.
 *
 * @param {Buffer|Uint8Array} pdfBuffer
 * @returns {Promise<{text: string, markdown: string, pageCount: number}>}
 */
export async function parsePdfToMarkdown(pdfBuffer) {
  try {
    // ── Polyfill browser globals missing in Node.js / Vercel serverless ──
    // pdfjs-dist references these at module evaluation time; they must exist.
    if (typeof globalThis.DOMMatrix === 'undefined') {
      // Minimal no-op stub — pdfjs uses DOMMatrix only for canvas rendering,
      // which we disable below. The stub just prevents the ReferenceError.
      globalThis.DOMMatrix = class DOMMatrix {
        constructor() {
          this.a=1;this.b=0;this.c=0;this.d=1;this.e=0;this.f=0;
          this.m11=1;this.m12=0;this.m13=0;this.m14=0;
          this.m21=0;this.m22=1;this.m23=0;this.m24=0;
          this.m31=0;this.m32=0;this.m33=1;this.m34=0;
          this.m41=0;this.m42=0;this.m43=0;this.m44=1;
          this.is2D=true;this.isIdentity=true;
        }
        multiply() { return this; }
        translate() { return this; }
        scale() { return this; }
        rotate() { return this; }
        skewX() { return this; }
        skewY() { return this; }
        inverse() { return this; }
        flipX() { return this; }
        flipY() { return this; }
        toString() { return `matrix(1,0,0,1,0,0)`; }
        static fromMatrix(m) { return new globalThis.DOMMatrix(); }
        static fromFloat32Array() { return new globalThis.DOMMatrix(); }
        static fromFloat64Array() { return new globalThis.DOMMatrix(); }
      };
    }
    if (typeof globalThis.Path2D === 'undefined') {
      globalThis.Path2D = class Path2D {
        constructor() {}
        addPath() {}
        closePath() {}
        moveTo() {}
        lineTo() {}
        arc() {}
        arcTo() {}
        bezierCurveTo() {}
        quadraticCurveTo() {}
        rect() {}
        roundRect() {}
      };
    }
    if (typeof globalThis.ImageData === 'undefined') {
      globalThis.ImageData = class ImageData {
        constructor(w, h) { this.width=w; this.height=h; this.data=new Uint8ClampedArray(w*h*4); }
      };
    }
    if (typeof globalThis.CanvasPattern === 'undefined') {
      globalThis.CanvasPattern = class CanvasPattern {};
    }
    if (typeof globalThis.CanvasGradient === 'undefined') {
      globalThis.CanvasGradient = class CanvasGradient {
        addColorStop() {}
      };
    }

    // ── Import pdfjs-dist (legacy build = broader Node compat) ───────────
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

    // Point workerSrc at the bundled legacy worker — must be a file:// URL for ESM
    const { createRequire } = await import('module');
    const { pathToFileURL } = await import('url');
    const require = createRequire(import.meta.url);
    const pdfjsWorkerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
    pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(pdfjsWorkerPath).href;

    // Convert input to a plain Uint8Array (pdfjs-dist v4 rejects Buffer subclasses)
    const uint8Array = Buffer.isBuffer(pdfBuffer)
      ? new Uint8Array(pdfBuffer.buffer, pdfBuffer.byteOffset, pdfBuffer.byteLength)
      : pdfBuffer instanceof Uint8Array
        ? new Uint8Array(pdfBuffer.buffer, pdfBuffer.byteOffset, pdfBuffer.byteLength)
        : new Uint8Array(pdfBuffer);

    // Load the PDF document — disable streaming & range requests
    const loadingTask = pdfjsLib.getDocument({
      data: uint8Array,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
      disableRange: true,
      disableStream: true,
      disableAutoFetch: true,
    });

    const pdf = await loadingTask.promise;
    const pageCount = pdf.numPages;
    const pageTexts = [];

    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map(item => ('str' in item ? item.str : ''))
        .join(' ');
      pageTexts.push(pageText);
    }

    const rawText = pageTexts.join('\n\n');
    const structuredMarkdown = structureTextToMarkdown(rawText);

    return { text: rawText, markdown: structuredMarkdown, pageCount };

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

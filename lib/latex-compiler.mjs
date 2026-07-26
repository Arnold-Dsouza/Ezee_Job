import fs from 'fs';
import path from 'path';
import latex from 'node-latex';
import PDFDocument from 'pdfkit';

const isVercel = Boolean(process.env.VERCEL);
const OUTPUT_DIR = isVercel ? path.join('/tmp', 'output') : path.join(process.cwd(), 'output');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Compiles a LaTeX string into a PDF file in /output
 * @param {string} latexCode 
 * @param {'cv'|'cover'} docType 
 * @returns {Promise<{ pdfUrl: string, texUrl: string, fileName: string }>}
 */
export async function compileLatexToPdf(latexCode, docType = 'cv') {
  const timestamp = Date.now();
  const baseName = `${docType}-${timestamp}`;
  const texFilePath = path.join(OUTPUT_DIR, `${baseName}.tex`);
  const pdfFilePath = path.join(OUTPUT_DIR, `${baseName}.pdf`);

  // Write .tex file
  fs.writeFileSync(texFilePath, latexCode, 'utf8');

  try {
    // Attempt compilation using pdflatex / node-latex first
    await compileWithNodeLatex(latexCode, pdfFilePath);
    console.log(`[node-latex] Successfully compiled ${baseName}.pdf`);
  } catch (err) {
    console.warn(`[node-latex] Native pdflatex compilation unavailable or failed: ${err.message}. Using high-fidelity PDFKit renderer fallback.`);
    // Fallback to high-quality TeX-structure PDFKit renderer
    await compileWithPdfKitFallback(latexCode, pdfFilePath, docType);
  }

  return {
    pdfUrl: `/output/${baseName}.pdf`,
    texUrl: `/output/${baseName}.tex`,
    fileName: `${baseName}.pdf`
  };
}

/**
 * Native node-latex compilation stream wrapper
 */
function compileWithNodeLatex(latexCode, outputPath) {
  return new Promise((resolve, reject) => {
    const input = fs.createReadStream(path.join(OUTPUT_DIR, path.basename(outputPath, '.pdf') + '.tex'));
    const output = fs.createWriteStream(outputPath);

    const pdfStream = latex(input, {
      cmd: 'pdflatex',
      passes: 1,
      errorLogs: path.join(OUTPUT_DIR, 'latex-error.log')
    });

    pdfStream.pipe(output);
    pdfStream.on('error', (err) => reject(err));
    pdfStream.on('finish', () => resolve());
  });
}

/**
 * Fallback PDFKit renderer that converts LaTeX syntax & structure into a beautiful PDF
 */
async function compileWithPdfKitFallback(latexCode, outputPath, docType) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        margin: 36 // 0.5 inch margins
      });

      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      // Clean TeX unescaped strings, literal \n, and convert LaTeX linebreaks \\ to space/newlines
      const cleanText = (str) => {
        if (!str) return '';
        return str
          .replace(/\\n/g, ' ')
          .replace(/\\\\n/g, ' ')
          .replace(/\\\\/g, ' ')
          .replace(/\\%/g, '%')
          .replace(/\\&/g, '&')
          .replace(/\\\$/g, '$')
          .replace(/\\#/g, '#')
          .replace(/\\_/g, '_')
          .replace(/\\\{/g, '{')
          .replace(/\\\}/g, '}')
          .replace(/\\textbf\{([^}]+)\}/g, '$1')
          .replace(/\\textit\{([^}]+)\}/g, '$1')
          .replace(/\\underline\{([^}]+)\}/g, '$1')
          .replace(/\\href\{[^}]+\}\{([^}]+)\}/g, '$1')
          .replace(/\s+/g, ' ')
          .trim();
      };

      const lines = latexCode.split('\n');
      let inDocument = false;

      for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();

        if (line.includes('\\begin{document}')) {
          inDocument = true;
          continue;
        }
        if (line.includes('\\end{document}')) {
          break;
        }

        if (!inDocument) continue;

        // Header / Name
        if (line.includes('\\Huge') || line.includes('\\scshape')) {
          const nameMatch = line.match(/\\textbf\{\\Huge\s*\\scshape\s*\{?([^}]+)\}?\}/i) || line.match(/\\Huge\s*\\scshape\s*\{?([^}]+)\}?/i) || line.match(/\{([^}]+)\}/);
          const name = nameMatch ? cleanText(nameMatch[1]) : 'CURRICULUM VITAE';
          doc.fontSize(22).font('Helvetica-Bold').fillColor('#0f172a').text(name.toUpperCase(), { align: 'center' });
          doc.moveDown(0.2);
          continue;
        }

        // Contact bar line
        if (line.includes('\\small') && (line.includes('|') || line.includes('mailto:'))) {
          const contact = cleanText(line.replace(/\\small/g, '').replace(/\\href\{[^}]+\}/g, ''));
          doc.fontSize(9.5).font('Helvetica').fillColor('#475569').text(contact, { align: 'center' });
          doc.moveDown(0.8);
          // Divider rule
          doc.moveTo(36, doc.y).lineTo(576, doc.y).strokeColor('#cbd5e1').lineWidth(1).stroke();
          doc.moveDown(0.6);
          continue;
        }

        // Section header
        if (line.startsWith('\\section{')) {
          const secMatch = line.match(/\\section\{([^}]+)\}/);
          if (secMatch) {
            const secTitle = cleanText(secMatch[1]).toUpperCase();
            doc.moveDown(0.4);
            doc.fontSize(12).font('Helvetica-Bold').fillColor('#1e3a8a').text(secTitle);
            doc.moveTo(36, doc.y + 2).lineTo(576, doc.y + 2).strokeColor('#2563eb').lineWidth(1.2).stroke();
            doc.moveDown(0.4);
          }
          continue;
        }

        // Subheadings / Job titles (e.g. \resumeSubheading{Title}{Date}{Company}{Location})
        if (line.includes('\\resumeSubheading')) {
          // Extract parameters from TeX macro
          const matches = [...line.matchAll(/\{([^}]+)\}/g)].map(m => cleanText(m[1]));
          if (matches.length >= 2) {
            const title = matches[0] || '';
            const date = matches[1] || '';
            const company = matches[2] || '';
            const loc = matches[3] || '';

            doc.fontSize(10.5).font('Helvetica-Bold').fillColor('#0f172a').text(title, { continued: true });
            doc.fontSize(9.5).font('Helvetica-Oblique').fillColor('#64748b').text(`  |  ${company}`, { continued: true });
            doc.fontSize(9.5).font('Helvetica').fillColor('#334155').text(date ? `   (${date})` : '', { align: 'right' });
            if (loc) {
              doc.fontSize(9).font('Helvetica-Oblique').fillColor('#64748b').text(loc);
            }
            doc.moveDown(0.2);
          }
          continue;
        }

        // Bullet items
        if (line.includes('\\resumeItem{') || line.startsWith('\\item')) {
          const itemMatch = line.match(/\\resumeItem\{([\s\S]+)\}/) || line.match(/\\item\s*\{?([^}]+)\}?/);
          if (itemMatch) {
            const itemText = cleanText(itemMatch[1]);
            doc.fontSize(9.5).font('Helvetica').fillColor('#1e293b').text(`•  ${itemText}`, {
              indent: 10,
              lineGap: 2.5
            });
            doc.moveDown(0.15);
          }
          continue;
        }

        // Regular paragraphs
        const plain = cleanText(line);
        if (plain && !plain.startsWith('\\') && !plain.startsWith('%') && plain.length > 2) {
          doc.fontSize(9.5).font('Helvetica').fillColor('#1e293b').text(plain, {
            lineGap: 3
          });
          doc.moveDown(0.3);
        }
      }

      doc.end();

      writeStream.on('finish', () => resolve());
      writeStream.on('error', (err) => reject(err));
    } catch (err) {
      reject(err);
    }
  });
}

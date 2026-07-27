import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import dotenv from 'dotenv';
import { parsePdfToMarkdown, structureTextToMarkdown } from './lib/parser.mjs';
import { analyzeGap, analyzeGapLlm } from './lib/gap-analyzer.mjs';
import { testAiConnection, generateTailoredDocument } from './lib/tailor-engine.mjs';
import { compileLatexToPdf } from './lib/latex-compiler.mjs';
import { compileHtmlToPdf } from './lib/html-compiler.mjs';

dotenv.config();

const app = express();
const PORT = 3000;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Directories
const isVercel = Boolean(process.env.VERCEL);
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const OUTPUT_DIR = isVercel ? path.join('/tmp', 'output') : path.join(process.cwd(), 'output');
const DATA_DIR = isVercel ? path.join('/tmp', 'data') : path.join(process.cwd(), 'data');

[PUBLIC_DIR, OUTPUT_DIR, DATA_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Serve static assets
app.use('/output', express.static(OUTPUT_DIR));
app.use(express.static(PUBLIC_DIR));

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Get Master CV
app.get('/api/master-cv', (req, res) => {
  try {
    const cvPath = path.join(DATA_DIR, 'master-cv.md');
    if (fs.existsSync(cvPath)) {
      const content = fs.readFileSync(cvPath, 'utf8');
      return res.json({ masterCv: content });
    }
    return res.json({ masterCv: '' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save Master CV
app.post('/api/save-master-cv', (req, res) => {
  try {
    const { masterCv } = req.body;
    const cvPath = path.join(DATA_DIR, 'master-cv.md');
    fs.writeFileSync(cvPath, masterCv || '', 'utf8');
    res.json({ success: true, message: 'Master CV saved successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload CV (PDF or Text)
app.post('/api/upload-cv', upload.single('file'), async (req, res) => {
  try {
    if (req.file) {
      if (req.file.mimetype === 'application/pdf' || req.file.originalname.endsWith('.pdf')) {
        const parsed = await parsePdfToMarkdown(req.file.buffer);
        const cvPath = path.join(DATA_DIR, 'master-cv.md');
        fs.writeFileSync(cvPath, parsed.markdown, 'utf8');
        return res.json({
          success: true,
          masterCv: parsed.markdown,
          pageCount: parsed.pageCount,
          message: 'PDF parsed and structured into Markdown.'
        });
      } else {
        const textContent = req.file.buffer.toString('utf8');
        const structured = structureTextToMarkdown(textContent);
        const cvPath = path.join(DATA_DIR, 'master-cv.md');
        fs.writeFileSync(cvPath, structured, 'utf8');
        return res.json({
          success: true,
          masterCv: structured,
          message: 'Text file converted to Markdown.'
        });
      }
    } else if (req.body.text) {
      const structured = structureTextToMarkdown(req.body.text);
      const cvPath = path.join(DATA_DIR, 'master-cv.md');
      fs.writeFileSync(cvPath, structured, 'utf8');
      return res.json({
        success: true,
        masterCv: structured,
        message: 'Master CV updated from text input.'
      });
    }

    res.status(400).json({ error: 'No file or text payload received.' });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: `Failed to parse CV: ${err.message}` });
  }
});

// Gap Analysis
app.post('/api/analyze-gap', async (req, res) => {
  try {
    const { masterCv, jobDescription, mode = 'zero-llm', config } = req.body;
    if (!masterCv || !jobDescription) {
      return res.status(400).json({ error: 'Both Master CV and Job Description are required for gap analysis.' });
    }

    let report;
    if (mode === 'llm') {
      report = await analyzeGapLlm({ masterCv, jobDescription, config });
    } else {
      report = analyzeGap(masterCv, jobDescription);
      report.mode = 'zero-llm';
    }

    res.json({ success: true, gapAnalysis: report });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Test Connection
app.post('/api/test-connection', async (req, res) => {
  try {
    const config = req.body;
    const result = await testAiConnection(config);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Generate Tailored Application (LaTeX CV & Cover Letter + PDF Compilation)
app.post('/api/generate-tailored', async (req, res) => {
  try {
    const { masterCv, jobDescription, targetTitle, config, gapMode = 'zero-llm' } = req.body;

    if (!masterCv || !jobDescription) {
      return res.status(400).json({ error: 'Master CV and Job Description are required.' });
    }

    // 1. Perform Gap Analysis first based on requested gapMode
    let gapReport;
    if (gapMode === 'llm') {
      gapReport = await analyzeGapLlm({ masterCv, jobDescription, config });
    } else {
      gapReport = analyzeGap(masterCv, jobDescription);
      gapReport.mode = 'zero-llm';
    }

    // 2. Run AI Tailor Engine with computed gap matrix
    const { applicationEmail, tailoredCvTex, coverLetterHtml } = await generateTailoredDocument({
      masterCv,
      jobDescription,
      targetTitle,
      config,
      gapReport
    });

    // 3. Compile LaTeX to PDFs
    const cvCompilation = await compileLatexToPdf(tailoredCvTex, 'cv');
    const coverCompilation = await compileHtmlToPdf(coverLetterHtml, 'cover');

    res.json({
      success: true,
      applicationEmail,
      tailoredCvTex,
      coverLetterHtml,
      cvPdfUrl: cvCompilation.pdfUrl,
      coverPdfUrl: coverCompilation.pdfUrl,
      cvTexUrl: cvCompilation.texUrl,
      coverHtmlUrl: coverCompilation.htmlUrl,
      gapAnalysis: gapReport
    });
  } catch (err) {
    console.error('Generation error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate tailored application.' });
  }
});

// Recompile LaTeX preview
app.post('/api/recompile', async (req, res) => {
  try {
    const { content, docType = 'cv' } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'content is required.' });
    }

    if (docType === 'cover') {
      const compilation = await compileHtmlToPdf(content, docType);
      return res.json({
        success: true,
        pdfUrl: compilation.pdfUrl,
        htmlUrl: compilation.htmlUrl,
        fileName: compilation.fileName
      });
    }

    const compilation = await compileLatexToPdf(content, docType);
    res.json({
      success: true,
      pdfUrl: compilation.pdfUrl,
      texUrl: compilation.texUrl,
      fileName: compilation.fileName
    });
  } catch (err) {
    console.error('Recompilation error:', err);
    res.status(500).json({ error: err.message || 'Failed to recompile LaTeX document.' });
  }
});

// API route fallback for undefined /api/* endpoints
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `API route ${req.method} ${req.path} not found.` });
});

// Fallback to index.html for SPA frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

if (!isVercel) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Ezee Job] Server running on http://0.0.0.0:${PORT}`);
  });
}

export default app;

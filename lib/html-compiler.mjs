import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

const isVercel = Boolean(process.env.VERCEL);
const OUTPUT_DIR = isVercel ? path.join('/tmp', 'output') : path.join(process.cwd(), 'output');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

export async function compileHtmlToPdf(htmlCode, docType = 'cover') {
  const timestamp = Date.now();
  const baseName = `${docType}-${timestamp}`;
  const htmlFilePath = path.join(OUTPUT_DIR, `${baseName}.html`);
  const pdfFilePath = path.join(OUTPUT_DIR, `${baseName}.pdf`);

  fs.writeFileSync(htmlFilePath, htmlCode, 'utf8');

  const executablePath = await resolveExecutablePath();
  const browser = await puppeteer.launch({
    args: isVercel ? chromium.args : ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: isVercel ? chromium.defaultViewport : { width: 1280, height: 1600 },
    executablePath,
    headless: true,
    ignoreHTTPSErrors: true
  });

  try {
    const page = await browser.newPage();
    await page.setContent(htmlCode, { waitUntil: 'networkidle0' });
    await page.pdf({
      path: pdfFilePath,
      preferCSSPageSize: true,
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' }
    });
  } finally {
    await browser.close();
  }

  return {
    pdfUrl: `/output/${baseName}.pdf`,
    htmlUrl: `/output/${baseName}.html`,
    fileName: `${baseName}.pdf`
  };
}

async function resolveExecutablePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  if (isVercel) {
    return await chromium.executablePath();
  }

  const localCandidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
  ];

  for (const candidate of localCandidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return await chromium.executablePath();
}
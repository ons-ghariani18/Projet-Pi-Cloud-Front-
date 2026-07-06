import { Injectable } from '@angular/core';
import JSZip from 'jszip';
export interface ExtractedContent {
  text: string;
  sentences: string[];
  keywords: string[];
  paragraphs: string[];
}

@Injectable({ providedIn: 'root' })
export class PdfExtractorService {

  // Get the globally loaded PDF.js from index.html CDN
  private get pdfjsLib(): any {
    return (window as any)['pdfjsLib'] || (window as any)['pdfjs-dist/build/pdf'];
  }

  /**
   * Reads the raw text from a File (PDF or TXT).
   * Returns ExtractedContent with sentences, keywords, paragraphs.
   */
  async extractFromFile(file: File): Promise<ExtractedContent> {
    const name = file.name.toLowerCase();

    if (name.endsWith('.txt')) {
      return this.extractFromText(await this.readAsText(file));
    }

    if (name.endsWith('.pdf')) {
      return this.extractFromPdf(file);
    }

    // VIDEO files — simulate content extraction
    if (name.endsWith('.mp4') || name.endsWith('.mov') ||
        name.endsWith('.avi') || name.endsWith('.mkv') || name.endsWith('.webm')) {
      return this.simulateExtraction(file.name, 'video');
    }

    // PPT/PPTX — vraie extraction du texte grâce à JSZip
    if (name.endsWith('.ppt') || name.endsWith('.pptx')) {
      return this.extractFromPptx(file);
    }

    // Unknown — fallback to filename
    return this.simulateExtraction(file.name, 'document');
  }

  // ── Read PPTX text using JSZip ───────────────────────────────
  private async extractFromPptx(file: File): Promise<ExtractedContent> {
    try {
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(file);
      let fullText = '';

      // Récupérer toutes les slides (fichiers xml dans ppt/slides/)
      const slideFiles = Object.keys(zipContent.files).filter(name => name.startsWith('ppt/slides/slide') && name.endsWith('.xml'));

      for (const slideFile of slideFiles) {
        const xmlFile = zipContent.file(slideFile);
        if (xmlFile) {
          const xml = await xmlFile.async('string');
          // Extraire le texte à l'intérieur des balises <a:t>
          // Note : on utilise un Regex simple pour capturer le texte
          const matches = xml.match(/<a:t.*?>(.*?)<\/a:t>/g);
          if (matches) {
            matches.forEach((match: string) => {
              const text = match.replace(/<[^>]+>/g, '');
              fullText += text + ' ';
            });
            fullText += '\n';
          }
        }
      }

      if (fullText.trim().length === 0) {
        throw new Error("Aucun texte lisible trouvé dans le diaporama.");
      }

      return this.extractFromText(fullText);
    } catch (err: any) {
      console.error('PPTX extraction error:', err);
      throw err;
    }
  }

  // ── Simulate extraction for unreadable/binary files ─────────────
  private simulateExtraction(filename: string, type: string, errorMsg?: string): ExtractedContent {
    let cleanName = filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
    // Strip possible UUID prefixes
    cleanName = cleanName.replace(/^[0-9a-f]{8} [0-9a-f]{4} [0-9a-f]{4} [0-9a-f]{4} [0-9a-f]{12} /i, '').trim();
    
    // Create a meaningful fake text block so the AI algorithms have real structure to parse
    let text = `Ce module aborde le sujet : ${cleanName}. L'objectif principal est de comprendre l'importance fondamentale de ce domaine dans un contexte professionnel. Il est crucial d'étudier les différentes facettes de la stratégie, la planification, et l'exécution de ces compétences. En maîtrisant ces axes, on s'assure d'une progression continue et d'un avantage comparatif indéniable. La leçon démontre par plusieurs exemples que les bonnes pratiques autour de ${cleanName} garantissent l'atteinte des objectifs.`;
    
    if (errorMsg) {
       text = `[ERREUR DE LECTURE DU DOCUMENT PDF: ${errorMsg}] ` + text;
    }
    
    return this.extractFromText(text + " " + cleanName.repeat(3));
  }


  // ── Read TXT as plain text ──────────────────────────────────────
  private readAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file, 'UTF-8');
    });
  }

  // ── Extract from PDF using pdf.js ──────────────────────────────
  private async extractFromPdf(file: File): Promise<ExtractedContent> {
    try {
      const pdfjs = this.pdfjsLib;
      if (!pdfjs) {
        throw new Error("Librairie PDF.js non chargée dans le navigateur.");
      }

      // Configure Worker from the exact same CDN
      pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

      let fullText = '';
      const maxPages = Math.min(pdf.numPages, 20); // Cap at 20 pages

      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += pageText + '\n';
      }

      if (fullText.trim().length === 0) {
        throw new Error("No readable text found in PDF (might be scanned images).");
      }

      return this.extractFromText(fullText);
    } catch (err: any) {
      console.error('PDF extraction error:', err);
      // Relancer l'erreur pour que l'appelant (admin dashboard) puisse la gérer correctement
      // (au lieu de retourner un faux texte qui tromperait l'IA)
      throw err;
    }
  }

  // ── Parse raw text into structured content ──────────────────────
  extractFromText(rawText: string): ExtractedContent {
    // Clean text
    const text = rawText
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s.,!?;:éèêëàâùûüôîïçÉÈÊËÀÂÙÛÜÔÎÏÇ'-]/g, ' ')
      .trim();

    // Split into sentences
    const sentences = text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 20 && s.split(' ').length > 4)
      .slice(0, 60);

    // Split into paragraphs (by newline or long gaps)
    const paragraphs = rawText
      .split(/\n{2,}/)
      .map(p => p.replace(/\s+/g, ' ').trim())
      .filter(p => p.length > 30)
      .slice(0, 20);

    // Extract meaningful keywords (TF-IDF light)
    const keywords = this.extractKeywords(text);

    return { text, sentences, keywords, paragraphs };
  }

  // ── Keyword extraction ──────────────────────────────────────────
  extractKeywords(text: string): string[] {
    const stopWords = new Set([
      'de','du','la','le','les','et','en','à','au','aux','un','une','des','par','sur',
      'pour','que','qui','dans','avec','est','sont','être','avoir','il','elle','ils',
      'elles','on','nous','vous','ce','cet','cette','ces','se','sa','son','ses','leur',
      'leurs','mais','ou','car','donc','or','ni','si','tout','tous','toute','toutes',
      'plus','bien','aussi','très','comme','sans','encore','même','dont','où','the','a',
      'an','is','are','was','were','be','been','being','have','has','had','do','does',
      'did','will','would','could','should','may','might','shall','can','not','and','or',
      'but','in','on','at','to','for','of','with','by','from','this','that','it','its'
    ]);

    // Extract words, filter stop words, count frequency
    const wordFreq: Record<string, number> = {};
    text.toLowerCase().split(/\W+/).forEach(word => {
      if (word.length > 3 && !stopWords.has(word) && !/^\d+$/.test(word)) {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      }
    });

    // Sort by frequency, take top 15
    return Object.entries(wordFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 15)
      .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));
  }

  // ── Pick N random sentences from specific content ───────────────
  pickSentences(sentences: string[], n: number): string[] {
    if (sentences.length <= n) return sentences;
    const shuffled = [...sentences].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n);
  }

  // ── Get a meaningful excerpt ────────────────────────────────────
  getExcerpt(text: string, maxChars = 300): string {
    if (text.length <= maxChars) return text;
    const cut = text.lastIndexOf(' ', maxChars);
    return text.substring(0, cut > 0 ? cut : maxChars) + '...';
  }
}

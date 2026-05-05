import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel, AlignmentType, BorderStyle } from 'docx';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import { COMPETITION_META } from './SportsMatchesWidget';

// ─── Types ──────────────────────────────────────────────────────────────────

interface MatchNoteReport {
  id: string;
  matchKey: string;
  content: string;
  status?: 'VERT' | 'ORANGE' | 'ROUGE';
  matchDate: string;
  competition: string;
  homeTeam: string;
  awayTeam: string;
  matchTime: string;
  venue?: string;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
  broadcasterLogo?: string;
  author: { id: string; name: string };
}

interface WeekReportResponse {
  weekNumber: number;
  year: number;
  startOfWeek: string;
  endOfWeek: string;
  notes: MatchNoteReport[];
}

type DocxImageType = 'png' | 'jpg' | 'gif' | 'bmp';

interface FetchedImage {
  data: Uint8Array;
  type: DocxImageType;
}

// ─── Day names ──────────────────────────────────────────────────────────────

const DAY_NAMES_FULL = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];

// ─── Traffic light PNG generator (canvas) ───────────────────────────────────

async function createTrafficLightPng(status: 'VERT' | 'ORANGE' | 'ROUGE'): Promise<Uint8Array> {
  return new Promise((resolve) => {
    const W = 22, H = 56;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    // Housing
    ctx.fillStyle = '#1c1c1c';
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, 5);
    ctx.fill();

    // Border
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(0.5, 0.5, W - 1, H - 1, 5);
    ctx.stroke();

    const lights: { cy: number; on: string; off: string; active: 'ROUGE' | 'ORANGE' | 'VERT' }[] = [
      { cy: 10, on: '#FF2222', off: '#3a0a0a', active: 'ROUGE' },
      { cy: 28, on: '#FF9900', off: '#3a2200', active: 'ORANGE' },
      { cy: 46, on: '#00DD44', off: '#003310', active: 'VERT' },
    ];

    for (const l of lights) {
      const isOn = l.active === status;
      if (isOn) {
        // Glow
        const grd = ctx.createRadialGradient(W / 2, l.cy, 1, W / 2, l.cy, 9);
        grd.addColorStop(0, l.on);
        grd.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(W / 2, l.cy, 9, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(W / 2, l.cy, 7, 0, Math.PI * 2);
      ctx.fillStyle = isOn ? l.on : l.off;
      ctx.fill();
      if (isOn) {
        // Highlight
        ctx.beginPath();
        ctx.arc(W / 2 - 2, l.cy - 2, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fill();
      }
    }

    canvas.toBlob((blob) => {
      blob!.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)));
    }, 'image/png');
  });
}

// ─── Image fetch via proxy (contourne CORS) ──────────────────────────────────

async function fetchImageForDocx(url: string): Promise<FetchedImage | null> {
  if (!url) return null;
  try {
    const response = await fetch(
      `/api/sports/match-notes/proxy-image?url=${encodeURIComponent(url)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || '';

    // ICO, WebP, SVG : non supportés nativement dans docx v9 sans fallback → skip
    if (
      contentType.includes('x-icon') ||
      contentType.includes('vnd.microsoft.icon') ||
      contentType.includes('webp') ||
      contentType.includes('svg')
    ) {
      return null;
    }

    const buffer = await response.arrayBuffer();
    const data = new Uint8Array(buffer);

    if (contentType.includes('jpeg') || contentType.includes('jpg')) {
      return { data, type: 'jpg' };
    }
    if (contentType.includes('gif')) {
      return { data, type: 'gif' };
    }
    if (contentType.includes('bmp')) {
      return { data, type: 'bmp' };
    }
    // Défaut PNG
    return { data, type: 'png' };
  } catch {
    return null;
  }
}

function makeImageRun(img: FetchedImage, size: number): ImageRun {
  return new ImageRun({
    data: img.data,
    transformation: { width: size, height: size },
    type: img.type,
  });
}

// ─── HTML to docx paragraphs ───────────────────────────────────────────────

function parseInlineRuns(node: Node): TextRun[] {
  const runs: TextRun[] = [];

  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent || '';
      if (text) {
        runs.push(new TextRun({ text }));
      }
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element;
      const tag = el.tagName.toLowerCase();
      const innerText = el.textContent || '';

      if (tag === 'strong' || tag === 'b') {
        runs.push(new TextRun({ text: innerText, bold: true }));
      } else if (tag === 'em' || tag === 'i') {
        runs.push(new TextRun({ text: innerText, italics: true }));
      } else if (tag === 'br') {
        runs.push(new TextRun({ text: '', break: 1 }));
      } else {
        runs.push(...parseInlineRuns(el));
      }
    }
  }

  return runs;
}

function htmlToDocxParagraphs(html: string): Paragraph[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const paragraphs: Paragraph[] = [];

  function processNode(node: Element, listLevel?: { type: 'bullet' | 'numbered'; level: number }) {
    const tag = node.tagName.toLowerCase();

    if (tag === 'ul') {
      for (const li of Array.from(node.children)) {
        processNode(li as Element, { type: 'bullet', level: 0 });
      }
    } else if (tag === 'ol') {
      for (const li of Array.from(node.children)) {
        processNode(li as Element, { type: 'numbered', level: 0 });
      }
    } else if (tag === 'li') {
      const runs = parseInlineRuns(node);
      if (listLevel?.type === 'bullet') {
        paragraphs.push(new Paragraph({ children: runs.length > 0 ? runs : [new TextRun('')], bullet: { level: listLevel.level } }));
      } else if (listLevel?.type === 'numbered') {
        paragraphs.push(new Paragraph({ children: runs.length > 0 ? runs : [new TextRun('')], numbering: { reference: 'default-numbering', level: listLevel.level } }));
      }
      for (const child of Array.from(node.children)) {
        const childTag = (child as Element).tagName?.toLowerCase();
        if (childTag === 'ul' || childTag === 'ol') {
          processNode(child as Element, { type: childTag === 'ul' ? 'bullet' : 'numbered', level: (listLevel?.level ?? 0) + 1 });
        }
      }
    } else if (tag === 'p' || tag === 'div') {
      const runs = parseInlineRuns(node);
      paragraphs.push(new Paragraph({ children: runs.length > 0 ? runs : [new TextRun('')] }));
    } else if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
      paragraphs.push(new Paragraph({ children: parseInlineRuns(node), heading: tag === 'h1' ? HeadingLevel.HEADING_1 : tag === 'h2' ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3 }));
    } else {
      const runs = parseInlineRuns(node);
      if (runs.length > 0) paragraphs.push(new Paragraph({ children: runs }));
    }
  }

  for (const child of Array.from(doc.body.children)) processNode(child as Element);

  if (paragraphs.length === 0 && doc.body.textContent?.trim()) {
    paragraphs.push(new Paragraph({ children: parseInlineRuns(doc.body) }));
  }

  return paragraphs;
}

function getCompetitionFavicon(competition: string): string | undefined {
  const meta = COMPETITION_META[competition as keyof typeof COMPETITION_META];
  return meta?.favicon;
}

function getCompetitionLabel(competition: string): string {
  const meta = COMPETITION_META[competition as keyof typeof COMPETITION_META];
  return meta?.label || competition;
}

function formatNoteDate(dateStr: string, time: string): string {
  const d = new Date(dateStr);
  const day = DAY_NAMES_FULL[d.getDay()];
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  if (!time) return `${day} ${dd}/${mm}`;
  const formattedTime = time.replace(':', 'h');
  return `${day} ${dd}/${mm} \u00B7 ${formattedTime}`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function MatchReportExport() {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await api.get('/sports/match-notes/report/week');
      const { weekNumber, year, notes } = response.data.data as WeekReportResponse;

      const validNotes = notes.filter((n) => {
        const status = n.status ?? 'VERT';
        // Pour VERT : afficher même sans contenu (RAS)
        if (status === 'VERT') return true;
        // Pour ORANGE/ROUGE : exiger un contenu non vide
        const stripped = n.content?.replace(/<[^>]*>/g, '').trim();
        return stripped && stripped.length > 0;
      });

      if (validNotes.length === 0) {
        toast.error('Aucune note à exporter cette semaine');
        setIsExporting(false);
        return;
      }

      // ── Generate traffic light PNGs ─────────────────────────────────────
      const [tlVert, tlOrange, tlRouge] = await Promise.all([
        createTrafficLightPng('VERT'),
        createTrafficLightPng('ORANGE'),
        createTrafficLightPng('ROUGE'),
      ]);
      const trafficLights: Record<'VERT' | 'ORANGE' | 'ROUGE', Uint8Array> = {
        VERT: tlVert,
        ORANGE: tlOrange,
        ROUGE: tlRouge,
      };

      // ── Prefetch all images concurrently ────────────────────────────────
      const allImageUrls = new Set<string>();
      for (const note of validNotes) {
        const favicon = getCompetitionFavicon(note.competition);
        if (favicon) allImageUrls.add(favicon);
        if (note.homeTeamLogo) allImageUrls.add(note.homeTeamLogo);
        if (note.awayTeamLogo) allImageUrls.add(note.awayTeamLogo);
        if (note.broadcasterLogo) allImageUrls.add(note.broadcasterLogo);
      }

      const imageCache = new Map<string, FetchedImage | null>();
      await Promise.all(
        Array.from(allImageUrls).map(async (url) => {
          imageCache.set(url, await fetchImageForDocx(url));
        })
      );

      const getImg = (url?: string): FetchedImage | null =>
        url ? (imageCache.get(url) ?? null) : null;

      // ── Build document sections ──────────────────────────────────────────
      const sections: Paragraph[] = [];

      // Title
      sections.push(
        new Paragraph({
          children: [new TextRun({ text: `CR SUPPORT SEMAINE ${weekNumber} \u2014 ${year}`, bold: true, size: 32 })],
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 200 },
        })
      );

      // Metadata fields (editable by user)
      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Techniciens : ', bold: true, size: 22 }),
            new TextRun({ text: '', size: 22 }),
          ],
          spacing: { after: 300 },
        })
      );

      // Grouper les notes par compétition (l'API les retourne déjà triées)
      const grouped = validNotes.reduce((acc, note) => {
        const comp = note.competition;
        if (!acc[comp]) acc[comp] = [];
        acc[comp].push(note);
        return acc;
      }, {} as Record<string, MatchNoteReport[]>);

      const competitionEntries = Object.entries(grouped);
      let globalIdx = 0;
      const totalNotes = validNotes.length;

      for (const [competition, compNotes] of competitionEntries) {
        const competitionLabel = getCompetitionLabel(competition);
        const faviconImg = getImg(getCompetitionFavicon(competition));

        // Heading compétition (H2) — une seule fois par groupe
        const compHeadingChildren: (TextRun | ImageRun)[] = [];
        if (faviconImg) {
          compHeadingChildren.push(makeImageRun(faviconImg, 20));
          compHeadingChildren.push(new TextRun({ text: '  ' }));
        }
        compHeadingChildren.push(new TextRun({ text: competitionLabel, bold: true, size: 30 }));

        sections.push(
          new Paragraph({
            children: compHeadingChildren,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 },
          })
        );

        for (const note of compNotes) {
          const homeImg = getImg(note.homeTeamLogo);
          const awayImg = getImg(note.awayTeamLogo);
          const noteStatus = note.status ?? 'VERT';
          const shouldIncludeContent = noteStatus !== 'VERT';

          // Feu tricolore : image canvas + libellé
          const statusTextColor = { VERT: '007700', ORANGE: 'CC6600', ROUGE: 'BB0000' }[noteStatus];
          const statusLabel =
            noteStatus === 'VERT' ? 'RAS' : noteStatus === 'ORANGE' ? 'À surveiller' : "Point d'attention";

          sections.push(
            new Paragraph({
              children: [
                new ImageRun({
                  data: trafficLights[noteStatus],
                  transformation: { width: 16, height: 40 },
                  type: 'png',
                }),
                new TextRun({ text: '  ' + statusLabel, color: statusTextColor, size: 20, bold: true }),
              ],
              spacing: { before: 200, after: 100 },
            })
          );

          // Heading du match : homeTeam vs awayTeam
          const headingChildren: (TextRun | ImageRun)[] = [];
          if (homeImg) {
            headingChildren.push(makeImageRun(homeImg, 20));
            headingChildren.push(new TextRun({ text: ' ' }));
          }
          headingChildren.push(new TextRun({ text: note.homeTeam, bold: true, size: 26 }));
          headingChildren.push(new TextRun({ text: '  vs  ', bold: false, size: 26, color: '888888' }));
          if (awayImg) {
            headingChildren.push(makeImageRun(awayImg, 20));
            headingChildren.push(new TextRun({ text: ' ' }));
          }
          headingChildren.push(new TextRun({ text: note.awayTeam, bold: true, size: 26 }));

          sections.push(
            new Paragraph({
              children: headingChildren,
              heading: HeadingLevel.HEADING_3,
              spacing: { before: 200, after: 100 },
            })
          );

          // Date/time
          sections.push(
            new Paragraph({
              children: [new TextRun({ text: formatNoteDate(note.matchDate, note.matchTime), italics: true, color: '888888', size: 20 })],
              spacing: { after: 200 },
            })
          );

          // Diffuseur TV (si disponible)
          const broadcasterImg = getImg(note.broadcasterLogo);
          if (broadcasterImg) {
            sections.push(
              new Paragraph({
                children: [
                  new TextRun({ text: 'Diffuseur : ', bold: true, size: 20, color: '555555' }),
                  makeImageRun(broadcasterImg, 20),
                ],
                spacing: { after: 200 },
              })
            );
          }

          // Contenu de la note — uniquement si status != VERT
          if (shouldIncludeContent) {
            sections.push(...htmlToDocxParagraphs(note.content));
          }

          // Separator
          if (globalIdx < totalNotes - 1) {
            sections.push(
              new Paragraph({
                children: [],
                spacing: { before: 200, after: 200 },
                border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' } },
              })
            );
          }
          globalIdx++;
        }
      }

      const doc = new Document({
        numbering: {
          config: [{ reference: 'default-numbering', levels: [{ level: 0, format: 'decimal' as any, text: '%1.', alignment: AlignmentType.LEFT }] }],
        },
        sections: [
          {
            children: sections,
            footers: {
              default: {
                options: {
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: `Généré le ${new Date().toLocaleDateString('fr-FR')} \u2014 VOGO Support`, italics: true, color: '999999', size: 16 })],
                      alignment: AlignmentType.CENTER,
                    }),
                  ],
                },
              },
            },
          },
        ],
      });

      const blob = await Packer.toBlob(doc);
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `CR_S${String(weekNumber).padStart(2, '0')}.docx`;
      a.click();
      URL.revokeObjectURL(blobUrl);

      toast.success('Rapport exporté avec succès');
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Erreur lors de l'export du rapport");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={handleExport}
      disabled={isExporting}
      className="h-11 sm:h-8 text-sm sm:text-xs gap-1.5 px-3"
    >
      {isExporting ? <Loader2 className="h-4 w-4 sm:h-3.5 sm:w-3.5 animate-spin" /> : <Download className="h-4 w-4 sm:h-3.5 sm:w-3.5" />}
      Exporter CR
    </Button>
  );
}

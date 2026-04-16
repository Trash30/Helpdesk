import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } from 'docx';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import { COMPETITION_META } from './SportsMatchesWidget';

// ─── Types ──────────────────────────────────────────────────────────────────

interface MatchNoteReport {
  id: string;
  matchKey: string;
  content: string;
  matchDate: string;
  competition: string;
  homeTeam: string;
  awayTeam: string;
  matchTime: string;
  venue?: string;
  author: { id: string; name: string };
}

interface WeekReportResponse {
  weekNumber: number;
  year: number;
  notes: MatchNoteReport[];
}

// ─── Day names ──────────────────────────────────────────────────────────────

const DAY_NAMES_FULL = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];

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
        // Recurse for nested elements
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
        paragraphs.push(
          new Paragraph({
            children: runs.length > 0 ? runs : [new TextRun('')],
            bullet: { level: listLevel.level },
          })
        );
      } else if (listLevel?.type === 'numbered') {
        paragraphs.push(
          new Paragraph({
            children: runs.length > 0 ? runs : [new TextRun('')],
            numbering: { reference: 'default-numbering', level: listLevel.level },
          })
        );
      }
      // Process nested lists inside li
      for (const child of Array.from(node.children)) {
        const childTag = (child as Element).tagName?.toLowerCase();
        if (childTag === 'ul' || childTag === 'ol') {
          processNode(child as Element, {
            type: childTag === 'ul' ? 'bullet' : 'numbered',
            level: (listLevel?.level ?? 0) + 1,
          });
        }
      }
    } else if (tag === 'p' || tag === 'div') {
      const runs = parseInlineRuns(node);
      paragraphs.push(
        new Paragraph({
          children: runs.length > 0 ? runs : [new TextRun('')],
        })
      );
    } else if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
      paragraphs.push(
        new Paragraph({
          children: parseInlineRuns(node),
          heading: tag === 'h1' ? HeadingLevel.HEADING_1 : tag === 'h2' ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
        })
      );
    } else {
      // Fallback: treat as paragraph
      const runs = parseInlineRuns(node);
      if (runs.length > 0) {
        paragraphs.push(new Paragraph({ children: runs }));
      }
    }
  }

  for (const child of Array.from(doc.body.children)) {
    processNode(child as Element);
  }

  // If no block elements found, treat entire content as single paragraph
  if (paragraphs.length === 0 && doc.body.textContent?.trim()) {
    paragraphs.push(new Paragraph({ children: parseInlineRuns(doc.body) }));
  }

  return paragraphs;
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
      const { data } = await api.get<WeekReportResponse>('/sports/match-notes/report/week');
      const { weekNumber, year, notes } = data;

      // Filter notes with actual content (not empty)
      const validNotes = notes.filter((n) => {
        const stripped = n.content?.replace(/<[^>]*>/g, '').trim();
        return stripped && stripped.length > 0;
      });

      if (validNotes.length === 0) {
        toast.error('Aucune note a exporter cette semaine');
        setIsExporting(false);
        return;
      }

      const sections: Paragraph[] = [];

      // Title
      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `CR SUPPORT SEMAINE ${weekNumber} \u2014 ${year}`,
              bold: true,
              size: 32,
            }),
          ],
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 300 },
        })
      );

      for (let i = 0; i < validNotes.length; i++) {
        const note = validNotes[i];
        const competitionLabel = getCompetitionLabel(note.competition);

        // Match heading
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${competitionLabel} \u2014 ${note.homeTeam} vs ${note.awayTeam}`,
                bold: true,
                size: 26,
              }),
            ],
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 100 },
          })
        );

        // Date/time subtitle
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: formatNoteDate(note.matchDate, note.matchTime),
                italics: true,
                color: '888888',
                size: 20,
              }),
            ],
            spacing: { after: 200 },
          })
        );

        // Note content
        const contentParagraphs = htmlToDocxParagraphs(note.content);
        sections.push(...contentParagraphs);

        // Separator (except for last note)
        if (i < validNotes.length - 1) {
          sections.push(
            new Paragraph({
              children: [],
              spacing: { before: 200, after: 200 },
              border: {
                bottom: {
                  style: BorderStyle.SINGLE,
                  size: 1,
                  color: 'CCCCCC',
                },
              },
            })
          );
        }
      }

      const doc = new Document({
        numbering: {
          config: [
            {
              reference: 'default-numbering',
              levels: [
                {
                  level: 0,
                  format: 'decimal' as any,
                  text: '%1.',
                  alignment: AlignmentType.LEFT,
                },
              ],
            },
          ],
        },
        sections: [
          {
            children: sections,
            footers: {
              default: {
                options: {
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: `Genere le ${new Date().toLocaleDateString('fr-FR')} \u2014 VOGO Support`,
                          italics: true,
                          color: '999999',
                          size: 16,
                        }),
                      ],
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
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CR_SUPPORT_SEMAINE_${weekNumber}_${year}.docx`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success('Rapport exporte avec succes');
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
      className="h-8 text-xs gap-1.5"
    >
      {isExporting ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Download className="h-3.5 w-3.5" />
      )}
      Exporter CR
    </Button>
  );
}

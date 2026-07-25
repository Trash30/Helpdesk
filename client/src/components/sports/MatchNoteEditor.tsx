import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import Image from '@tiptap/extension-image';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  StickyNote,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Image as ImageIcon,
  Loader2,
  Trash2,
  Save,
  X,
} from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import api from '@/lib/axios';
import toast from 'react-hot-toast';

// ─── Types ──────────────────────────────────────────────────────────────────

interface MatchData {
  competition: string;
  homeTeam: string;
  awayTeam: string;
  date: string;
  time: string;
  venue?: string;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
  broadcasterLogo?: string;
}

type NoteStatus = 'VERT' | 'ORANGE' | 'ROUGE';

interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
}

interface MatchNoteEditorProps {
  matchKey: string;
  match: MatchData;
  initialContent?: string;
  initialStatus?: NoteStatus;
  initialProduction?: string | null;
  initialChaperonnage?: boolean;
  initialChaperonneTechnicienId?: string | null;
}

// Sentinel value for the "Aucune" option in the production select
// (Radix Select v2 ne permet pas les SelectItem avec value="").
const PRODUCTION_NONE = '__NONE__';

// ─── Component ──────────────────────────────────────────────────────────────

export function MatchNoteEditor({
  matchKey,
  match,
  initialContent,
  initialStatus,
  initialProduction,
  initialChaperonnage,
  initialChaperonneTechnicienId,
}: MatchNoteEditorProps) {
  const { t } = useTranslation('sports');
  const [isOpen, setIsOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [status, setStatus] = useState<NoteStatus>(initialStatus ?? 'VERT');
  const [production, setProduction] = useState<string | null>(initialProduction ?? null);
  const [chaperonnage, setChaperonnage] = useState<boolean>(initialChaperonnage ?? false);
  const [chaperonneTechnicienId, setChaperonneTechnicienId] = useState<string | null>(
    initialChaperonneTechnicienId ?? null
  );
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const hasNote = !!initialContent;

  // Fetch des techniciens de l'équipe (utilisé par le select chaperonnage)
  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: ['team-members'],
    queryFn: async () => (await api.get('/sports/match-notes/team-members')).data,
    staleTime: 5 * 60 * 1000,
  });

  // Upload d'une image vers le backend, retourne l'URL publique (ou null en cas d'echec).
  // Gere l'etat de chargement local pour desactiver le bouton image.
  const uploadImage = async (file: File): Promise<string | null> => {
    setIsUploading(true);
    const formData = new FormData();
    formData.append('image', file);
    try {
      const res = await fetch('/api/sports/match-notes/upload-image', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!res.ok) {
        toast.error(t('noteEditor.imageUploadError'));
        return null;
      }
      const data = (await res.json()) as { url: string };
      return data.url;
    } catch {
      toast.error("Erreur lors de l'envoi de l'image");
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Image.configure({ inline: false, allowBase64: true }),
      Placeholder.configure({
        placeholder: t('noteEditor.placeholder'),
      }),
    ],
    content: initialContent || '',
    editorProps: {
      attributes: {
        // min-h plus grand sur mobile pour saisie confortable, taille police 16px pour éviter zoom iOS
        class:
          'prose prose-base sm:prose-sm max-w-none min-h-[200px] sm:min-h-[120px] outline-none p-3 sm:p-2 text-base sm:text-sm',
      },
      // Coller une image depuis le presse-papier (Ctrl+V) -> upload + insertion
      handlePaste: (_view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (const item of Array.from(items)) {
          if (item.type.startsWith('image/')) {
            event.preventDefault();
            const file = item.getAsFile();
            if (!file) return true;
            void uploadImage(file).then((url) => {
              if (url) editorRef.current?.chain().focus().setImage({ src: url }).run();
            });
            return true;
          }
        }
        return false;
      },
      // Glisser-deposer une image -> upload + insertion
      handleDrop: (_view, event) => {
        const files = event.dataTransfer?.files;
        if (!files?.length) return false;
        for (const file of Array.from(files)) {
          if (file.type.startsWith('image/')) {
            event.preventDefault();
            void uploadImage(file).then((url) => {
              if (url) editorRef.current?.chain().focus().setImage({ src: url }).run();
            });
            return true;
          }
        }
        return false;
      },
    },
  });

  // Ref vers l'editor pour acceder a l'instance dans les callbacks editorProps
  // (definis avant que `editor` ne soit assigne).
  const editorRef = useRef(editor);
  editorRef.current = editor;

  // Sync editor content when the saved note is loaded/updated from the server
  useEffect(() => {
    if (editor && !editor.isFocused) {
      editor.commands.setContent(initialContent || '');
    }
  }, [editor, initialContent]);

  // Sync status when the note is loaded/updated from the server
  useEffect(() => {
    if (initialStatus) {
      setStatus(initialStatus);
    }
  }, [initialStatus]);

  // Sync production / chaperonnage / technicien when the note is reloaded
  useEffect(() => {
    setProduction(initialProduction ?? null);
  }, [initialProduction]);

  useEffect(() => {
    setChaperonnage(initialChaperonnage ?? false);
  }, [initialChaperonnage]);

  useEffect(() => {
    setChaperonneTechnicienId(initialChaperonneTechnicienId ?? null);
  }, [initialChaperonneTechnicienId]);

  const saveMutation = useMutation({
    mutationFn: async (content: string) => {
      const encodedKey = encodeURIComponent(matchKey);
      return (
        await api.put(`/sports/match-notes/${encodedKey}`, {
          content,
          status,
          production: production || null,
          chaperonnage,
          chaperonneTechnicienId: chaperonnage ? (chaperonneTechnicienId || null) : null,
          matchDate: match.date,
          competition: match.competition,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          matchTime: match.time,
          venue: match.venue,
          homeTeamLogo: match.homeTeamLogo,
          awayTeamLogo: match.awayTeamLogo,
          broadcasterLogo: match.broadcasterLogo,
        })
      ).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match-notes'] });
      toast.success(t('noteEditor.noteSaved'));
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error ?? t('noteEditor.saveError'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const encodedKey = encodeURIComponent(matchKey);
      return (await api.delete(`/sports/match-notes/${encodedKey}`)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match-notes'] });
      editor?.commands.clearContent();
      setIsOpen(false);
      toast.success(t('noteEditor.noteDeleted'));
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error ?? t('noteEditor.deleteError'));
    },
  });

  const handleSave = () => {
    if (!editor) return;
    const html = editor.getHTML();
    saveMutation.mutate(html);
  };

  const handleClose = () => {
    // Reset editor to initial content on close without saving
    if (editor && initialContent !== undefined) {
      editor.commands.setContent(initialContent);
    } else if (editor) {
      editor.commands.clearContent();
    }
    setIsOpen(false);
  };

  // Declenche le selecteur de fichier cache
  const handleInsertImage = () => {
    fileInputRef.current?.click();
  };

  // Quand un fichier est selectionne via le bouton : upload + insertion
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // reset pour permettre de re-selectionner le meme fichier
    e.target.value = '';
    if (!file || !editor) return;
    const url = await uploadImage(file);
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };

  return (
    <div className="w-full">
      {/* Toggle button — zone tactile min 44px sur mobile */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className={`inline-flex items-center gap-1.5 text-sm sm:text-xs transition-colors rounded min-h-[40px] sm:min-h-0 px-3 py-2 sm:px-1.5 sm:py-0.5 ${
                hasNote
                  ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50'
                  : 'text-muted-foreground/80 sm:text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50 border border-dashed border-muted-foreground/30 hover:border-muted-foreground/50'
              }`}
            >
              <StickyNote className="h-4 w-4 sm:h-3.5 sm:w-3.5 shrink-0" />
              <span>{hasNote ? t('noteEditor.note') : t('noteEditor.addNotes')}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent>
            {hasNote ? t('noteEditor.viewEditTooltip') : t('noteEditor.addTooltip')}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Expandable editor panel */}
      {isOpen && editor && (
        <div className="mt-2 bg-amber-50/50 border border-amber-200/60 rounded-md p-2 sm:p-3 space-y-2">
          {/* Status selector — feu tricolore */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setStatus('VERT')}
              className={`text-xs px-2 py-1 rounded-full transition-colors ${
                status === 'VERT'
                  ? 'bg-green-500 text-white'
                  : 'border border-green-500 text-green-700 hover:bg-green-50'
              }`}
              aria-pressed={status === 'VERT'}
            >
              {t('noteEditor.green')}
            </button>
            <button
              type="button"
              onClick={() => setStatus('ORANGE')}
              className={`text-xs px-2 py-1 rounded-full transition-colors ${
                status === 'ORANGE'
                  ? 'bg-orange-500 text-white'
                  : 'border border-orange-500 text-orange-700 hover:bg-orange-50'
              }`}
              aria-pressed={status === 'ORANGE'}
            >
              {t('noteEditor.orange')}
            </button>
            <button
              type="button"
              onClick={() => setStatus('ROUGE')}
              className={`text-xs px-2 py-1 rounded-full transition-colors ${
                status === 'ROUGE'
                  ? 'bg-red-500 text-white'
                  : 'border border-red-500 text-red-700 hover:bg-red-50'
              }`}
              aria-pressed={status === 'ROUGE'}
            >
              {t('noteEditor.red')}
            </button>
          </div>

          {/* Ligne PRODUCTION + CHAPERONNAGE */}
          <div className="flex flex-wrap items-center gap-3">
            {/* PRODUCTION select */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">{t('noteEditor.productionLabel')}</span>
              <Select
                value={production ?? PRODUCTION_NONE}
                onValueChange={(v) =>
                  setProduction(v === PRODUCTION_NONE ? null : v)
                }
              >
                <SelectTrigger className="h-7 text-xs w-36 bg-white">
                  <SelectValue placeholder={t('noteEditor.productionNone')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PRODUCTION_NONE}>{t('noteEditor.productionNone')}</SelectItem>
                  <SelectItem value="BeIN">BeIN</SelectItem>
                  <SelectItem value="Via Storia">Via Storia</SelectItem>
                  <SelectItem value="AMP Visual">AMP Visual</SelectItem>
                  <SelectItem value="IXI Live">IXI Live</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* CHAPERONNAGE checkbox */}
            <div className="flex items-center gap-1.5">
              <input
                type="checkbox"
                id={`chaperon-${matchKey}`}
                checked={chaperonnage}
                onChange={(e) => {
                  setChaperonnage(e.target.checked);
                  if (!e.target.checked) setChaperonneTechnicienId(null);
                }}
                className="h-4 w-4 rounded border-gray-300 accent-amber-500"
              />
              <label
                htmlFor={`chaperon-${matchKey}`}
                className="text-xs font-medium text-muted-foreground cursor-pointer"
              >
                {t('noteEditor.chaperonnage')}
              </label>
            </div>

            {/* Technicien select — affiché seulement si chaperonnage est coché */}
            {chaperonnage && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">{t('noteEditor.technicianLabel')}</span>
                <Select
                  value={chaperonneTechnicienId ?? ''}
                  onValueChange={(v) => setChaperonneTechnicienId(v === '' ? null : v)}
                >
                  <SelectTrigger className="h-7 text-xs w-40 bg-white">
                    <SelectValue placeholder={t('noteEditor.technicianPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.firstName} {m.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Toolbar — boutons plus grands sur mobile (zone tactile confortable) */}
          <div className="flex items-center gap-1 sm:gap-0.5 flex-wrap">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={`h-10 w-10 sm:h-7 sm:w-7 p-0 ${editor.isActive('bold') ? 'bg-amber-200/60' : ''}`}
              onClick={() => editor.chain().focus().toggleBold().run()}
              aria-label={t('noteEditor.bold')}
            >
              <Bold className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={`h-10 w-10 sm:h-7 sm:w-7 p-0 ${editor.isActive('italic') ? 'bg-amber-200/60' : ''}`}
              onClick={() => editor.chain().focus().toggleItalic().run()}
              aria-label={t('noteEditor.italic')}
            >
              <Italic className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={`h-10 w-10 sm:h-7 sm:w-7 p-0 ${editor.isActive('underline') ? 'bg-amber-200/60' : ''}`}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              aria-label={t('noteEditor.underline')}
            >
              <UnderlineIcon className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={`h-10 w-10 sm:h-7 sm:w-7 p-0 ${editor.isActive('bulletList') ? 'bg-amber-200/60' : ''}`}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              aria-label={t('noteEditor.bulletList')}
            >
              <List className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={`h-10 w-10 sm:h-7 sm:w-7 p-0 ${editor.isActive('orderedList') ? 'bg-amber-200/60' : ''}`}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              aria-label={t('noteEditor.numberedList')}
            >
              <ListOrdered className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-10 w-10 sm:h-7 sm:w-7 p-0"
              onClick={handleInsertImage}
              disabled={isUploading}
              aria-label={t('noteEditor.insertImage')}
              title={t('noteEditor.insertImageTitle')}
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 sm:h-3.5 sm:w-3.5 animate-spin" />
              ) : (
                <ImageIcon className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
              )}
            </Button>
            {/* Input fichier cache, declenche par le bouton image ci-dessus */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelected}
            />
          </div>

          {/* Editor */}
          <div className="border rounded bg-white focus-within:ring-1 focus-within:ring-amber-300">
            <EditorContent editor={editor} />
          </div>

          {/* Actions — hauteur tactile confortable sur mobile */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="h-10 sm:h-7 text-sm sm:text-xs gap-1.5 sm:gap-1 flex-1 sm:flex-none justify-center"
            >
              <Save className="h-4 w-4 sm:h-3 sm:w-3" />
              {saveMutation.isPending ? t('noteEditor.saving') : t('noteEditor.save')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleClose}
              className="h-10 sm:h-7 text-sm sm:text-xs gap-1.5 sm:gap-1 justify-center"
            >
              <X className="h-4 w-4 sm:h-3 sm:w-3" />
              {t('noteEditor.close')}
            </Button>
            {can('admin.access') && hasNote && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deleteMutation.isPending}
                className="h-10 sm:h-7 text-sm sm:text-xs gap-1.5 sm:gap-1 justify-center text-red-600 hover:text-red-700 hover:bg-red-50 sm:ml-auto"
              >
                <Trash2 className="h-4 w-4 sm:h-3 sm:w-3" />
                {t('noteEditor.delete')}
              </Button>
            )}
          </div>

          <ConfirmDialog
            open={showDeleteConfirm}
            onOpenChange={(open) => { if (!open) setShowDeleteConfirm(false); }}
            title={t('noteEditor.deleteNoteTitle')}
            description={t('noteEditor.deleteNoteDescription')}
            confirmLabel={t('noteEditor.confirmDelete')}
            variant="destructive"
            loading={deleteMutation.isPending}
            onConfirm={() => {
              deleteMutation.mutate(undefined, {
                onSettled: () => setShowDeleteConfirm(false),
              });
            }}
          />
        </div>
      )}
    </div>
  );
}

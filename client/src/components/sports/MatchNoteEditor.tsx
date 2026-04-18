import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { StickyNote, Bold, Italic, List, ListOrdered, Trash2, Save, X } from 'lucide-react';
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
}

interface MatchNoteEditorProps {
  matchKey: string;
  match: MatchData;
  initialContent?: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function MatchNoteEditor({ matchKey, match, initialContent }: MatchNoteEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const hasNote = !!initialContent;

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Ajouter vos notes de support pour ce match...',
      }),
    ],
    content: initialContent || '',
    editorProps: {
      attributes: {
        // min-h plus grand sur mobile pour saisie confortable, taille police 16px pour éviter zoom iOS
        class:
          'prose prose-sm max-w-none min-h-[160px] sm:min-h-[80px] outline-none p-3 sm:p-2 text-base sm:text-sm',
      },
    },
  });

  // Sync editor content when the saved note is loaded/updated from the server
  useEffect(() => {
    if (editor && !editor.isFocused) {
      editor.commands.setContent(initialContent || '');
    }
  }, [editor, initialContent]);

  const saveMutation = useMutation({
    mutationFn: async (content: string) => {
      const encodedKey = encodeURIComponent(matchKey);
      return (
        await api.put(`/sports/match-notes/${encodedKey}`, {
          content,
          matchDate: match.date,
          competition: match.competition,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          matchTime: match.time,
          venue: match.venue,
          homeTeamLogo: match.homeTeamLogo,
          awayTeamLogo: match.awayTeamLogo,
        })
      ).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match-notes'] });
      toast.success('Note sauvegardee');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error ?? 'Erreur lors de la sauvegarde');
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
      toast.success('Note supprimee');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error ?? 'Erreur lors de la suppression');
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

  return (
    <div className="w-full">
      {/* Toggle button — zone tactile min 44px sur mobile */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className={`inline-flex items-center gap-1.5 text-sm sm:text-xs transition-colors rounded min-h-[44px] sm:min-h-0 px-3 sm:px-1.5 py-2 sm:py-0.5 ${
                hasNote
                  ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50'
                  : 'text-muted-foreground/80 sm:text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50 border border-dashed border-muted-foreground/30 hover:border-muted-foreground/50'
              }`}
            >
              <StickyNote className="h-4 w-4 sm:h-3.5 sm:w-3.5 shrink-0" />
              <span>{hasNote ? 'Note' : 'Ajouter des notes'}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent>
            {hasNote ? 'Voir/modifier la note' : 'Ajouter une note de support'}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Expandable editor panel */}
      {isOpen && editor && (
        <div className="mt-2 bg-amber-50/50 border border-amber-200/60 rounded-md p-2 sm:p-3 space-y-2">
          {/* Toolbar — boutons plus grands sur mobile (zone tactile 44px min) */}
          <div className="flex items-center gap-1 sm:gap-0.5 flex-wrap">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={`h-11 w-11 sm:h-7 sm:w-7 p-0 ${editor.isActive('bold') ? 'bg-amber-200/60' : ''}`}
              onClick={() => editor.chain().focus().toggleBold().run()}
              aria-label="Gras"
            >
              <Bold className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={`h-11 w-11 sm:h-7 sm:w-7 p-0 ${editor.isActive('italic') ? 'bg-amber-200/60' : ''}`}
              onClick={() => editor.chain().focus().toggleItalic().run()}
              aria-label="Italique"
            >
              <Italic className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={`h-11 w-11 sm:h-7 sm:w-7 p-0 ${editor.isActive('bulletList') ? 'bg-amber-200/60' : ''}`}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              aria-label="Liste à puces"
            >
              <List className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={`h-11 w-11 sm:h-7 sm:w-7 p-0 ${editor.isActive('orderedList') ? 'bg-amber-200/60' : ''}`}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              aria-label="Liste numérotée"
            >
              <ListOrdered className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
            </Button>
          </div>

          {/* Editor */}
          <div className="border rounded bg-white focus-within:ring-1 focus-within:ring-amber-300">
            <EditorContent editor={editor} />
          </div>

          {/* Actions — boutons stack vertical mobile, hauteur tactile ≥44px */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="h-11 sm:h-7 text-sm sm:text-xs gap-1.5 sm:gap-1 w-full sm:w-auto justify-center"
            >
              <Save className="h-4 w-4 sm:h-3 sm:w-3" />
              {saveMutation.isPending ? 'Sauvegarde...' : 'Enregistrer'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleClose}
              className="h-11 sm:h-7 text-sm sm:text-xs gap-1.5 sm:gap-1 w-full sm:w-auto justify-center"
            >
              <X className="h-4 w-4 sm:h-3 sm:w-3" />
              Fermer
            </Button>
            {can('admin.access') && hasNote && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deleteMutation.isPending}
                className="h-11 sm:h-7 text-sm sm:text-xs gap-1.5 sm:gap-1 w-full sm:w-auto justify-center text-red-600 hover:text-red-700 hover:bg-red-50 sm:ml-auto"
              >
                <Trash2 className="h-4 w-4 sm:h-3 sm:w-3" />
                Supprimer
              </Button>
            )}
          </div>

          <ConfirmDialog
            open={showDeleteConfirm}
            onOpenChange={(open) => { if (!open) setShowDeleteConfirm(false); }}
            title="Supprimer la note"
            description="Cette action est irreversible. La note sera definitivement supprimee."
            confirmLabel="Supprimer"
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

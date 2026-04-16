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
        class: 'prose prose-sm max-w-none min-h-[80px] outline-none p-2',
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
      {/* Toggle button */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className={`inline-flex items-center gap-1.5 text-xs transition-colors rounded px-1.5 py-0.5 ${
                hasNote
                  ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50'
                  : 'text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50 border border-dashed border-muted-foreground/30 hover:border-muted-foreground/50'
              }`}
            >
              <StickyNote className="h-3.5 w-3.5 shrink-0" />
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
        <div className="mt-2 bg-amber-50/50 border border-amber-200/60 rounded-md p-3 space-y-2">
          {/* Toolbar */}
          <div className="flex items-center gap-0.5">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={`h-7 w-7 p-0 ${editor.isActive('bold') ? 'bg-amber-200/60' : ''}`}
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              <Bold className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={`h-7 w-7 p-0 ${editor.isActive('italic') ? 'bg-amber-200/60' : ''}`}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              <Italic className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={`h-7 w-7 p-0 ${editor.isActive('bulletList') ? 'bg-amber-200/60' : ''}`}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
              <List className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={`h-7 w-7 p-0 ${editor.isActive('orderedList') ? 'bg-amber-200/60' : ''}`}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            >
              <ListOrdered className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Editor */}
          <div className="border rounded bg-white focus-within:ring-1 focus-within:ring-amber-300">
            <EditorContent editor={editor} />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="h-7 text-xs gap-1"
            >
              <Save className="h-3 w-3" />
              {saveMutation.isPending ? 'Sauvegarde...' : 'Enregistrer'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleClose}
              className="h-7 text-xs gap-1"
            >
              <X className="h-3 w-3" />
              Fermer
            </Button>
            {can('admin.access') && hasNote && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deleteMutation.isPending}
                className="h-7 text-xs gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 ml-auto"
              >
                <Trash2 className="h-3 w-3" />
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

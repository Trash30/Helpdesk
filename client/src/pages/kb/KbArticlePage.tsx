import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import ImageExt from '@tiptap/extension-image';
import LinkExt from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import {
  ArrowLeft, Edit2, Trash2, Save, X,
  Bold, Italic, Heading2, Heading3, List, ListOrdered,
  Link as LinkIcon, ImageIcon, Eye, FileEdit, Calendar, User,
} from 'lucide-react';
import toast from 'react-hot-toast';

import api from '@/lib/axios';
import { usePermissions } from '@/hooks/usePermissions';
import { timeAgo } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogFooter,
  DialogTitle, DialogDescription,
} from '@/components/ui/dialog';

// -- Types ---------------------------------------------------------------

interface KbArticle {
  id: string;
  title: string;
  content: string;
  status: 'DRAFT' | 'PUBLISHED';
  tags: string[];
  category: { id: string; name: string; color: string } | null;
  categoryId: string | null;
  author: { firstName: string; lastName: string };
  sourceTicket: { id: string; ticketNumber: string; title: string } | null;
  updatedAt: string;
  publishedAt: string | null;
}

interface Category {
  id: string;
  name: string;
  color: string;
}

// -- Toolbar button ------------------------------------------------------

interface ToolbarBtnProps {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}

function ToolbarBtn({ onClick, active, title, children }: ToolbarBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${
        active ? 'bg-gray-200 dark:bg-gray-700 text-primary' : 'text-gray-600 dark:text-gray-400'
      }`}
    >
      {children}
    </button>
  );
}

// -- Editor Toolbar ------------------------------------------------------

interface EditorToolbarProps {
  editor: ReturnType<typeof useEditor>;
  onImageUpload: () => void;
}

function EditorToolbar({ editor, onImageUpload }: EditorToolbarProps) {
  if (!editor) return null;

  const addLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL du lien', previousUrl || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 dark:border-gray-700 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-t-md">
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        title="Gras"
      >
        <Bold className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        title="Italique"
      >
        <Italic className="h-4 w-4" />
      </ToolbarBtn>

      <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1" />

      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive('heading', { level: 2 })}
        title="Titre H2"
      >
        <Heading2 className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive('heading', { level: 3 })}
        title="Titre H3"
      >
        <Heading3 className="h-4 w-4" />
      </ToolbarBtn>

      <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1" />

      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
        title="Liste a puces"
      >
        <List className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
        title="Liste numerotee"
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarBtn>

      <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1" />

      <ToolbarBtn onClick={addLink} active={editor.isActive('link')} title="Lien">
        <LinkIcon className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn onClick={onImageUpload} title="Image">
        <ImageIcon className="h-4 w-4" />
      </ToolbarBtn>
    </div>
  );
}

// -- Tag Input -----------------------------------------------------------

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

function TagInput({ tags, onChange }: TagInputProps) {
  const [value, setValue] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const tag = value.trim();
      if (tag && !tags.includes(tag)) {
        onChange([...tags, tag]);
      }
      setValue('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    onChange(tags.filter((t) => t !== tagToRemove));
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1 pr-1">
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="ml-0.5 hover:text-red-600 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ajouter un tag puis Entree..."
        className="text-sm"
      />
    </div>
  );
}

// -- Main page component -------------------------------------------------

export function KbArticlePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isNew = !id || id === 'new';
  const [editing, setEditing] = useState(isNew);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // -- Form state --------------------------------------------------------
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED'>('DRAFT');
  const [draftArticleId, setDraftArticleId] = useState<string | null>(null);

  const articleId = isNew ? draftArticleId : id;

  // -- Queries -----------------------------------------------------------

  const { data: article, isLoading } = useQuery<KbArticle>({
    queryKey: ['kb-article', id],
    queryFn: () => api.get(`/kb/${id}`).then((r) => r.data?.data),
    enabled: !isNew,
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => r.data?.data ?? []),
  });

  // -- TipTap editor -----------------------------------------------------

  const editor = useEditor({
    extensions: [
      StarterKit,
      ImageExt.configure({ inline: false, allowBase64: false }),
      LinkExt.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: 'Commencez a rediger votre article...' }),
    ],
    content: '',
    editable: editing,
    editorProps: {
      attributes: {
        class:
          'prose prose-sm dark:prose-invert max-w-none min-h-[300px] p-4 focus:outline-none',
      },
    },
  });

  // Sync article data into form state when loaded
  useEffect(() => {
    if (article && !isNew) {
      setTitle(article.title);
      setCategoryId(article.categoryId);
      setTags(article.tags ?? []);
      setStatus(article.status);
      if (editor && !editing) {
        editor.commands.setContent(article.content || '');
      }
    }
  }, [article, isNew, editor, editing]);

  // When switching to edit mode, load content into editor
  useEffect(() => {
    if (editor) {
      editor.setEditable(editing);
      if (editing && article) {
        editor.commands.setContent(article.content || '');
      }
    }
  }, [editing, editor, article]);

  // -- Mutations ---------------------------------------------------------

  const createMutation = useMutation({
    mutationFn: (data: {
      title: string;
      content: string;
      status: string;
      tags: string[];
      categoryId: string | null;
    }) => api.post('/kb', data).then((r) => r.data?.data),
    onSuccess: (data: KbArticle) => {
      queryClient.invalidateQueries({ queryKey: ['kb-articles'] });
      toast.success('Article cree !');
      navigate(`/kb/${data.id}`, { replace: true });
    },
    onError: (error: { response?: { data?: { error?: string } } }) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la creation');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: {
      title: string;
      content: string;
      status: string;
      tags: string[];
      categoryId: string | null;
    }) => api.put(`/kb/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kb-article', id] });
      queryClient.invalidateQueries({ queryKey: ['kb-articles'] });
      toast.success('Article mis a jour !');
      setEditing(false);
    },
    onError: (error: { response?: { data?: { error?: string } } }) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la mise a jour');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/kb/${id}`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kb-articles'] });
      toast.success('Article supprime');
      navigate('/kb', { replace: true });
    },
    onError: (error: { response?: { data?: { error?: string } } }) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la suppression');
    },
  });

  const createDraftMutation = useMutation({
    mutationFn: () =>
      api
        .post('/kb', {
          title: title || 'Brouillon',
          content: '',
          status: 'DRAFT',
          tags: [],
          categoryId: null,
        })
        .then((r) => r.data?.data),
    onSuccess: (data: KbArticle) => {
      setDraftArticleId(data.id);
    },
  });

  const uploadImageMutation = useMutation({
    mutationFn: (params: { targetId: string; file: File }) => {
      const formData = new FormData();
      formData.append('file', params.file);
      return api
        .post(`/kb/${params.targetId}/images`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        .then((r) => r.data?.data);
    },
    onSuccess: (data: { url: string }) => {
      if (editor) {
        editor.chain().focus().setImage({ src: data.url }).run();
      }
    },
    onError: (error: { response?: { data?: { error?: string } } }) => {
      toast.error(
        error.response?.data?.error || "Erreur lors de l'upload de l'image"
      );
    },
  });

  // -- Handlers ----------------------------------------------------------

  const handleSave = () => {
    if (!title.trim()) {
      toast.error('Le titre est obligatoire');
      return;
    }
    const content = editor?.getHTML() || '';
    const payload = { title: title.trim(), content, status, tags, categoryId };

    if (isNew && !draftArticleId) {
      createMutation.mutate(payload);
    } else if (draftArticleId) {
      api
        .put(`/kb/${draftArticleId}`, payload)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['kb-articles'] });
          toast.success('Article cree !');
          navigate(`/kb/${draftArticleId}`, { replace: true });
        })
        .catch(() => {
          toast.error('Erreur lors de la creation');
        });
    } else {
      updateMutation.mutate(payload);
    }
  };

  const handleImageUpload = useCallback(async () => {
    let targetId = articleId;
    if (!targetId && isNew) {
      try {
        const draft = await createDraftMutation.mutateAsync();
        targetId = draft.id;
      } catch {
        toast.error("Impossible de creer le brouillon pour l'upload");
        return;
      }
    }
    if (!targetId) return;
    fileInputRef.current?.click();
  }, [articleId, isNew, createDraftMutation]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const targetId = articleId;
    if (!targetId) return;
    uploadImageMutation.mutate({ targetId, file });
    e.target.value = '';
  };

  const handleCancel = () => {
    if (isNew) {
      navigate('/kb', { replace: true });
    } else {
      setEditing(false);
      if (article) {
        setTitle(article.title);
        setCategoryId(article.categoryId);
        setTags(article.tags ?? []);
        setStatus(article.status);
        editor?.commands.setContent(article.content || '');
      }
    }
  };

  const startEditing = () => {
    setEditing(true);
    if (article && editor) {
      editor.commands.setContent(article.content || '');
    }
  };

  // -- Loading / not found -----------------------------------------------

  if (!isNew && isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  if (!isNew && !isLoading && !article) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground mb-4">Article introuvable</p>
        <Button variant="outline" onClick={() => navigate('/kb')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour a la base de connaissances
        </Button>
      </div>
    );
  }

  // -- Render ------------------------------------------------------------

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/kb')}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Retour
        </Button>

        <div className="flex-1" />

        {!editing && can('kb.write') && (
          <>
            <Button variant="outline" size="sm" onClick={startEditing}>
              <Edit2 className="h-4 w-4 mr-1" />
              Modifier
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Supprimer
            </Button>
          </>
        )}
      </div>

      {/* READ MODE */}
      {!editing && article && (
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge
                variant={article.status === 'PUBLISHED' ? 'default' : 'secondary'}
                className={
                  article.status === 'PUBLISHED'
                    ? 'bg-green-50 text-green-800 border-green-200'
                    : 'bg-gray-100 text-gray-600'
                }
              >
                {article.status === 'PUBLISHED' ? (
                  <><Eye className="h-3 w-3 mr-1" /> Publie</>
                ) : (
                  <><FileEdit className="h-3 w-3 mr-1" /> Brouillon</>
                )}
              </Badge>
              {article.category && (
                <Badge
                  style={{
                    backgroundColor: `${article.category.color}20`,
                    color: article.category.color,
                    borderColor: `${article.category.color}40`,
                  }}
                  className="border"
                >
                  {article.category.name}
                </Badge>
              )}
            </div>

            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              {article.title}
            </h1>

            <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                {article.author.firstName} {article.author.lastName}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                <span title={new Date(article.updatedAt).toLocaleDateString('fr-FR')}>
                  {timeAgo(article.updatedAt)}
                </span>
              </span>
              {article.publishedAt && (
                <span className="text-xs">
                  Publie le{' '}
                  {new Date(article.publishedAt).toLocaleDateString('fr-FR')}
                </span>
              )}
            </div>

            {article.tags && article.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {article.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {article.sourceTicket && (
            <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
              <CardContent className="py-3 px-4">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  Cree a partir du ticket{' '}
                  <Link
                    to={`/tickets/${article.sourceTicket.id}`}
                    className="font-medium underline hover:no-underline"
                  >
                    #{article.sourceTicket.ticketNumber} -{' '}
                    {article.sourceTicket.title}
                  </Link>
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-6">
              <div
                className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: article.content }}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* EDIT / CREATE MODE */}
      {editing && (
        <div className="space-y-5">
          <h2 className="text-xl font-semibold">
            {isNew ? 'Nouvel article' : "Modifier l'article"}
          </h2>

          <div className="space-y-1.5">
            <Label htmlFor="kb-title">Titre</Label>
            <Input
              id="kb-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titre de l'article"
              className="text-lg font-medium"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Contenu</Label>
            <div className="border rounded-md border-gray-200 dark:border-gray-700 overflow-hidden">
              <EditorToolbar editor={editor} onImageUpload={handleImageUpload} />
              <EditorContent editor={editor} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Categorie</Label>
              <Select
                value={categoryId ?? 'none'}
                onValueChange={(v) => setCategoryId(v === 'none' ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Aucune categorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune categorie</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                        {cat.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Statut</Label>
              <div className="flex items-center gap-3 h-10">
                <Switch
                  checked={status === 'PUBLISHED'}
                  onCheckedChange={(checked) =>
                    setStatus(checked ? 'PUBLISHED' : 'DRAFT')
                  }
                />
                <span className="text-sm font-medium">
                  {status === 'PUBLISHED' ? 'Publie' : 'Brouillon'}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Tags</Label>
            <TagInput tags={tags} onChange={setTags} />
          </div>

          <div className="flex items-center gap-3 pt-2 border-t">
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="h-4 w-4 mr-1" />
              {isSaving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
            <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
              <X className="h-4 w-4 mr-1" />
              Annuler
            </Button>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer l'article</DialogTitle>
            <DialogDescription>
              Cette action est irreversible. L'article sera definitivement
              supprime.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleteMutation.isPending}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Suppression...' : 'Supprimer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

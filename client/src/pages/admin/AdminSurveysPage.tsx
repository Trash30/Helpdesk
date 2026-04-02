import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import api from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

// ── Types ────────────────────────────────────────────────────────────────────

interface CsatData {
  score: number;
  satisfied: number;
  neutral: number;
  unsatisfied: number;
  total: number;
  vsLastMonth?: number;
}

interface NpsWeek { week: string; score: number }

interface SurveyResponse {
  id: string;
  createdAt: string;
  npsScore: number | null;
  vocScore: number | null;
  clientEmail: string;
  answers: any[];
  surveySend: {
    ticket: { ticketNumber: string; title: string };
  };
}

interface SurveySend {
  id: string;
  createdAt: string;
  clientEmail: string;
  status: string;
  sentAt: string | null;
  token: string;
  ticket: { ticketNumber: string; title: string };
  response: { id: string } | null;
}

interface Question {
  id: string;
  type: string;
  label: string;
  required: boolean;
  order: number;
  helpText?: string;
  config?: Record<string, any>;
  options?: string[];
  showIf?: { questionId: string; operator: string; value: number };
}

// ── Default template ─────────────────────────────────────────────────────────

const DEFAULT_QUESTIONS: Question[] = [
  {
    id: 'q1', type: 'csat', required: true, order: 1,
    label: 'Comment évaluez-vous votre satisfaction globale concernant le traitement de votre demande ?',
  },
  {
    id: 'q1b', type: 'textarea', required: false, order: 2,
    label: "Qu'est-ce qui vous a déplu ou pourrait être amélioré ?",
    helpText: 'Votre retour nous aide à progresser',
    showIf: { questionId: 'q1', operator: 'lte', value: 3 },
  },
  {
    id: 'q2', type: 'nps', required: true, order: 3,
    label: 'Sur une échelle de 0 à 10, quelle est la probabilité que vous nous recommandiez à un proche ou un collègue ?',
  },
  {
    id: 'q3', type: 'rating', required: true, order: 4,
    label: 'Comment évaluez-vous la rapidité de traitement de votre demande ?',
    config: { scale: 5, legendLeft: 'Très lent', legendRight: 'Très rapide' },
  },
  {
    id: 'q4', type: 'rating', required: true, order: 5,
    label: 'Comment évaluez-vous la qualité de la solution apportée ?',
    config: { scale: 5, legendLeft: 'Insuffisante', legendRight: 'Excellente' },
  },
  {
    id: 'q5', type: 'select', required: false, order: 6,
    label: 'Le technicien qui a traité votre demande était-il ?',
    options: ['Très professionnel', 'Professionnel', 'Correct', 'Peu professionnel'],
  },
  {
    id: 'q6', type: 'textarea', required: false, order: 7,
    label: 'Avez-vous des commentaires ou suggestions pour améliorer notre service ?',
    helpText: 'Votre retour nous aide à progresser',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function npsColor(score: number | null): string {
  if (score === null) return '#5F5E5A';
  if (score < 0) return '#E24B4A';
  if (score < 30) return '#EF9F27';
  if (score < 70) return '#185FA5';
  return '#639922';
}

function csatColor(score: number): string {
  if (score < 50) return '#E24B4A';
  if (score < 75) return '#EF9F27';
  return '#639922';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ── CsatCard ─────────────────────────────────────────────────────────────────

function CsatCard({ data, title }: { data: CsatData; title: string }) {
  const color = csatColor(data.score);
  const satisfied = data.total > 0 ? (data.satisfied / data.total) * 100 : 0;
  const neutral = data.total > 0 ? (data.neutral / data.total) * 100 : 0;
  const unsatisfied = data.total > 0 ? (data.unsatisfied / data.total) * 100 : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end gap-2">
          <span className="text-3xl font-bold" style={{ color }}>
            {data.score.toFixed(1)}%
          </span>
          {data.vsLastMonth !== undefined && (
            <span className={`text-sm mb-1 ${data.vsLastMonth >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {data.vsLastMonth >= 0 ? '+' : ''}{data.vsLastMonth}% vs mois dernier
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{data.total} réponse(s)</p>
        <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
          {satisfied > 0 && (
            <div className="bg-green-500 transition-all" style={{ width: `${satisfied}%` }}
              title={`Satisfaits : ${data.satisfied}`} />
          )}
          {neutral > 0 && (
            <div className="bg-orange-400 transition-all" style={{ width: `${neutral}%` }}
              title={`Neutres : ${data.neutral}`} />
          )}
          {unsatisfied > 0 && (
            <div className="bg-red-500 transition-all" style={{ width: `${unsatisfied}%` }}
              title={`Non satisfaits : ${data.unsatisfied}`} />
          )}
          {data.total === 0 && <div className="bg-muted w-full" />}
        </div>
        <div className="flex gap-3 text-xs">
          <span className="text-green-600">■ Satisfaits {data.satisfied}</span>
          <span className="text-orange-500">■ Neutres {data.neutral}</span>
          <span className="text-red-500">■ Non satisfaits {data.unsatisfied}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Results tab ───────────────────────────────────────────────────────────────

function ResultsTab() {
  const [datePreset, setDatePreset] = useState('30');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [selectedResponse, setSelectedResponse] = useState<SurveyResponse | null>(null);

  const getDateRange = () => {
    if (datePreset === 'custom') return { dateFrom: customFrom, dateTo: customTo };
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - parseInt(datePreset));
    return {
      dateFrom: from.toISOString().split('T')[0],
      dateTo: to.toISOString().split('T')[0],
    };
  };

  const { data: csatLive, dataUpdatedAt } = useQuery<{ data: CsatData }>({
    queryKey: ['surveys-csat-live'],
    queryFn: async () => (await api.get('/admin/surveys/csat-live')).data,
    refetchInterval: 30000,
  });

  const dateRange = getDateRange();
  const { data: results } = useQuery<{
    data: {
      csatGlobal: CsatData;
      csatFiltered: CsatData;
      npsScore: number | null;
      npsBreakdown: { promoters: number; passives: number; detractors: number };
      npsPerWeek: NpsWeek[];
      responses: SurveyResponse[];
      total: number;
    };
  }>({
    queryKey: ['surveys-results', dateRange],
    queryFn: async () => (await api.get('/admin/surveys/results', { params: dateRange })).data,
  });

  const r = results?.data;
  const liveData = csatLive?.data;

  return (
    <div className="space-y-6">
      {/* CSAT live (global, no date filter) */}
      {liveData && (
        <CsatCard data={{ ...liveData, vsLastMonth: liveData.vsLastMonth }}
          title="CSAT global (toutes périodes)" />
      )}

      {/* Date filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {['7', '30', '90', 'custom'].map(p => (
          <button key={p} onClick={() => setDatePreset(p)}
            className={`text-sm px-3 py-1.5 rounded border transition-colors ${
              datePreset === p
                ? 'bg-primary text-primary-foreground border-primary'
                : 'hover:bg-muted border-input'
            }`}>
            {p === '7' ? '7 jours' : p === '30' ? '30 jours' : p === '90' ? '90 jours' : 'Personnalisé'}
          </button>
        ))}
        {datePreset === 'custom' && (
          <div className="flex items-center gap-2">
            <Input type="date" value={customFrom}
              onChange={e => setCustomFrom(e.target.value)} className="h-9 w-36" />
            <span className="text-muted-foreground">→</span>
            <Input type="date" value={customTo}
              onChange={e => setCustomTo(e.target.value)} className="h-9 w-36" />
          </div>
        )}
      </div>

      {r && (
        <>
          {/* CSAT filtered */}
          <CsatCard data={r.csatFiltered} title={`CSAT (période sélectionnée)`} />

          {/* NPS */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Score NPS</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {r.npsScore !== null ? (
                <>
                  <div className="flex items-end gap-3">
                    <span className="text-3xl font-bold" style={{ color: npsColor(r.npsScore) }}>
                      {r.npsScore}
                    </span>
                    <div className="flex gap-3 text-xs mb-1">
                      <span className="text-green-600">Promoteurs {r.npsBreakdown.promoters}</span>
                      <span className="text-orange-500">Passifs {r.npsBreakdown.passives}</span>
                      <span className="text-red-500">Détracteurs {r.npsBreakdown.detractors}</span>
                    </div>
                  </div>
                  {r.npsPerWeek.length > 0 && (
                    <div className="h-32">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={r.npsPerWeek}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="week" tick={{ fontSize: 11 }}
                            tickFormatter={v => v.slice(5)} />
                          <YAxis domain={[-100, 100]} tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v: any) => [v, 'NPS']} />
                          <Line type="monotone" dataKey="score" stroke="#185FA5" dot={false} strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground text-sm">Pas encore de données NPS.</p>
              )}
            </CardContent>
          </Card>

          {/* Responses table */}
          <div>
            <h3 className="text-sm font-medium mb-3">Réponses ({r.total})</h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left p-3 font-medium">Date</th>
                    <th className="text-left p-3 font-medium">Ticket</th>
                    <th className="text-left p-3 font-medium">Email</th>
                    <th className="text-left p-3 font-medium">NPS</th>
                    <th className="text-left p-3 font-medium">CSAT</th>
                    <th className="w-10 p-3" />
                  </tr>
                </thead>
                <tbody>
                  {r.responses.map(resp => (
                    <tr key={resp.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3 text-muted-foreground text-xs">
                        {formatDate(resp.createdAt)}
                      </td>
                      <td className="p-3">
                        <span className="font-mono text-xs text-primary">
                          {resp.surveySend.ticket.ticketNumber}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground text-xs">{resp.clientEmail}</td>
                      <td className="p-3">
                        {resp.npsScore !== null ? (
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded text-white"
                            style={{ backgroundColor: npsColor(resp.npsScore) }}>
                            {resp.npsScore}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="p-3">
                        {resp.vocScore !== null ? (
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                            style={{
                              backgroundColor: resp.vocScore >= 4 ? '#dcfce7' : resp.vocScore >= 3 ? '#fef9c3' : '#fee2e2',
                              color: resp.vocScore >= 4 ? '#16a34a' : resp.vocScore >= 3 ? '#d97706' : '#dc2626',
                            }}>
                            {resp.vocScore}/5
                          </span>
                        ) : '—'}
                      </td>
                      <td className="p-3">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedResponse(resp)}>
                          Voir
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {r.responses.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        Aucune réponse sur cette période.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Response detail slide-over */}
      <Sheet open={!!selectedResponse} onOpenChange={open => !open && setSelectedResponse(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              Détail — {selectedResponse?.surveySend.ticket.ticketNumber}
            </SheetTitle>
          </SheetHeader>
          {selectedResponse && (
            <div className="mt-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                {selectedResponse.clientEmail} · {formatDate(selectedResponse.createdAt)}
              </p>
              {(selectedResponse.answers as any[]).map((a, i) => (
                <div key={i} className="border-b pb-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Question {i + 1}
                  </p>
                  <p className="text-sm mt-0.5">
                    {typeof a.value === 'object' ? JSON.stringify(a.value) : String(a.value ?? '—')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── Sends tab ─────────────────────────────────────────────────────────────────

function SendsTab() {
  const [page, setPage] = useState(1);

  const { data } = useQuery<{
    data: SurveySend[];
    total: number;
    totalPages: number;
  }>({
    queryKey: ['surveys-sends', page],
    queryFn: async () => (await api.get('/admin/surveys/sends', { params: { page } })).data,
  });

  const sends = data?.data ?? [];

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      PENDING: { label: 'En attente', cls: 'bg-yellow-100 text-yellow-700' },
      SENT: { label: 'Envoyé', cls: 'bg-green-100 text-green-700' },
      FAILED: { label: 'Échec', cls: 'bg-red-100 text-red-700' },
    };
    const s = map[status] ?? { label: status, cls: 'bg-muted text-muted-foreground' };
    return <span className={`text-xs px-1.5 py-0.5 rounded ${s.cls}`}>{s.label}</span>;
  };

  return (
    <div className="space-y-4">
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left p-3 font-medium">Date</th>
              <th className="text-left p-3 font-medium">Ticket</th>
              <th className="text-left p-3 font-medium">Email</th>
              <th className="text-left p-3 font-medium">Statut</th>
              <th className="text-left p-3 font-medium">Répondu</th>
            </tr>
          </thead>
          <tbody>
            {sends.map(send => (
              <tr key={send.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="p-3 text-muted-foreground text-xs">
                  {formatDate(send.createdAt)}
                </td>
                <td className="p-3">
                  <span className="font-mono text-xs text-primary">
                    {send.ticket.ticketNumber}
                  </span>
                </td>
                <td className="p-3 text-muted-foreground text-xs">{send.clientEmail}</td>
                <td className="p-3">{statusBadge(send.status)}</td>
                <td className="p-3">
                  {send.response ? (
                    <span className="text-xs text-green-600">✓ Oui</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Non</span>
                  )}
                </td>
              </tr>
            ))}
            {sends.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                  Aucun envoi.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}>
            Précédent
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} / {data.totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= data.totalPages}
            onClick={() => setPage(p => p + 1)}>
            Suivant
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Template tab ──────────────────────────────────────────────────────────────

function SortableQuestion({
  q, onEdit, onDelete, canConfigure,
}: {
  q: Question;
  onEdit: (q: Question) => void;
  onDelete: (id: string) => void;
  canConfigure: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: q.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const typeLabel: Record<string, string> = {
    csat: 'CSAT', nps: 'NPS', rating: 'Note', text: 'Texte',
    textarea: 'Commentaire', select: 'Choix', multiselect: 'Multi-choix',
  };
  return (
    <div ref={setNodeRef} style={style}
      className="flex items-start gap-3 p-3 bg-card border rounded-lg group">
      {canConfigure && (
        <button {...listeners} {...attributes}
          className="cursor-grab text-muted-foreground hover:text-foreground touch-none mt-0.5">
          <GripVertical className="h-4 w-4" />
        </button>
      )}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
            {typeLabel[q.type] ?? q.type}
          </span>
          {q.required && (
            <span className="text-xs text-destructive">Requis</span>
          )}
          {q.showIf && (
            <span className="text-xs text-muted-foreground italic">Conditionnel</span>
          )}
        </div>
        <p className="text-sm line-clamp-2">{q.label}</p>
      </div>
      {canConfigure && (
        <div className="flex gap-1 flex-shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(q)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(q.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

const newQuestionDefault: Omit<Question, 'id' | 'order'> = {
  type: 'text', label: '', required: false,
};

function TemplateTab() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canConfigure = can('surveys.configure');

  const [questions, setQuestions] = useState<Question[]>([]);
  const [editQ, setEditQ] = useState<Question | null>(null);
  const [newQ, setNewQ] = useState<Omit<Question, 'id' | 'order'>>({ ...newQuestionDefault });
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);

  const { data: templateData } = useQuery<{ data: { questions: Question[] } | null }>({
    queryKey: ['surveys-template'],
    queryFn: async () => (await api.get('/admin/surveys/template')).data,
  });

  useEffect(() => {
    if (templateData?.data?.questions) setQuestions(templateData.data.questions);
    else if (templateData !== undefined) setQuestions(DEFAULT_QUESTIONS);
  }, [templateData]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = questions.findIndex(q => q.id === active.id);
    const newIndex = questions.findIndex(q => q.id === over.id);
    const reordered = arrayMove(questions, oldIndex, newIndex).map((q, i) => ({
      ...q, order: i + 1,
    }));
    setQuestions(reordered);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/admin/surveys/template', { questions });
      toast.success('Modèle sauvegardé');
      queryClient.invalidateQueries({ queryKey: ['surveys-template'] });
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Erreur lors de la sauvegarde');
    } finally { setSaving(false); }
  };

  const handleRestore = async () => {
    setSaving(true);
    try {
      await api.put('/admin/surveys/template', { questions: DEFAULT_QUESTIONS });
      setQuestions(DEFAULT_QUESTIONS);
      toast.success('Modèle restauré par défaut');
      queryClient.invalidateQueries({ queryKey: ['surveys-template'] });
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Erreur lors de la restauration');
    } finally { setSaving(false); setConfirmRestore(false); }
  };

  const handleDeleteQ = (id: string) => {
    setQuestions(prev => prev.filter(q => q.id !== id).map((q, i) => ({ ...q, order: i + 1 })));
  };

  const handleAddQ = () => {
    if (!newQ.label.trim()) { toast.error('Le libellé est requis'); return; }
    const id = `q_${Date.now()}`;
    setQuestions(prev => [...prev, { ...newQ, id, order: prev.length + 1 }]);
    setNewQ({ ...newQuestionDefault });
    setAddOpen(false);
  };

  const handleEditSave = () => {
    if (!editQ) return;
    if (!editQ.label.trim()) { toast.error('Le libellé est requis'); return; }
    setQuestions(prev => prev.map(q => q.id === editQ.id ? editQ : q));
    setEditQ(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{questions.length} question(s)</p>
        {canConfigure && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmRestore(true)}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" />Restaurer
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />Ajouter
            </Button>
          </div>
        )}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={questions.map(q => q.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {questions.map(q => (
              <SortableQuestion key={q.id} q={q}
                onEdit={setEditQ}
                onDelete={handleDeleteQ}
                canConfigure={canConfigure}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {canConfigure && questions.length > 0 && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Sauvegarde...' : 'Sauvegarder le modèle'}
          </Button>
        </div>
      )}

      {/* Add question dialog */}
      <Dialog open={addOpen} onOpenChange={open => { if (!saving) setAddOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Ajouter une question</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Type</Label>
              <select value={newQ.type}
                onChange={e => setNewQ(q => ({ ...q, type: e.target.value }))}
                className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none">
                {['nps', 'csat', 'rating', 'text', 'textarea', 'select', 'multiselect'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Libellé <span className="text-destructive">*</span></Label>
              <Input value={newQ.label}
                onChange={e => setNewQ(q => ({ ...q, label: e.target.value }))}
                placeholder="Intitulé de la question" className="mt-1" />
            </div>
            <div>
              <Label>Texte d'aide</Label>
              <Input value={newQ.helpText ?? ''}
                onChange={e => setNewQ(q => ({ ...q, helpText: e.target.value }))}
                className="mt-1" />
            </div>
            <div className="flex items-center gap-2">
              <Switch id="q-required" checked={newQ.required}
                onCheckedChange={v => setNewQ(q => ({ ...q, required: v }))} />
              <Label htmlFor="q-required">Requis</Label>
            </div>
            {(newQ.type === 'select' || newQ.type === 'multiselect') && (
              <div>
                <Label>Options (une par ligne)</Label>
                <textarea
                  value={(newQ.options ?? []).join('\n')}
                  onChange={e => setNewQ(q => ({
                    ...q, options: e.target.value.split('\n').filter(Boolean),
                  }))}
                  rows={4}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none resize-none" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Annuler</Button>
            <Button onClick={handleAddQ}>Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit question dialog */}
      {editQ && (
        <Dialog open={!!editQ} onOpenChange={open => !open && setEditQ(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Modifier la question</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <Label>Libellé <span className="text-destructive">*</span></Label>
                <Input value={editQ.label}
                  onChange={e => setEditQ(q => q ? { ...q, label: e.target.value } : q)}
                  className="mt-1" />
              </div>
              <div>
                <Label>Texte d'aide</Label>
                <Input value={editQ.helpText ?? ''}
                  onChange={e => setEditQ(q => q ? { ...q, helpText: e.target.value } : q)}
                  className="mt-1" />
              </div>
              <div className="flex items-center gap-2">
                <Switch id="eq-required" checked={editQ.required}
                  onCheckedChange={v => setEditQ(q => q ? { ...q, required: v } : q)} />
                <Label htmlFor="eq-required">Requis</Label>
              </div>
              {(editQ.type === 'select' || editQ.type === 'multiselect') && (
                <div>
                  <Label>Options (une par ligne)</Label>
                  <textarea
                    value={(editQ.options ?? []).join('\n')}
                    onChange={e => setEditQ(q => q ? {
                      ...q, options: e.target.value.split('\n').filter(Boolean),
                    } : q)}
                    rows={4}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none resize-none" />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditQ(null)}>Annuler</Button>
              <Button onClick={handleEditSave}>Enregistrer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <ConfirmDialog
        open={confirmRestore}
        onOpenChange={open => !open && setConfirmRestore(false)}
        title="Restaurer le modèle par défaut"
        description="Le modèle actuel sera remplacé par les 7 questions par défaut. Cette action ne peut pas être annulée."
        confirmLabel="Restaurer"
        variant="destructive"
        loading={saving}
        onConfirm={handleRestore}
      />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function AdminSurveysPage() {
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: async () => (await api.get('/admin/settings')).data.data as Record<string, string>,
  });

  const surveyEnabled = settings?.survey_enabled !== 'false';

  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      api.put('/admin/settings', { survey_enabled: enabled ? 'true' : 'false' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-settings'] }),
    onError: () => toast.error('Erreur lors de la mise à jour'),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Enquêtes de satisfaction</h1>
        <div className="flex items-center gap-3 px-4 py-2 rounded-lg border bg-card">
          <Switch
            id="survey-global-toggle"
            checked={surveyEnabled}
            disabled={toggleMutation.isPending}
            onCheckedChange={v => toggleMutation.mutate(v)}
          />
          <Label htmlFor="survey-global-toggle" className="cursor-pointer">
            {surveyEnabled ? 'Envois activés' : 'Envois désactivés'}
          </Label>
        </div>
      </div>
      <Tabs defaultValue="results">
        <TabsList>
          <TabsTrigger value="results">Résultats</TabsTrigger>
          <TabsTrigger value="sends">Envois</TabsTrigger>
          <TabsTrigger value="template">Modèle</TabsTrigger>
        </TabsList>
        <TabsContent value="results" className="mt-4"><ResultsTab /></TabsContent>
        <TabsContent value="sends" className="mt-4"><SendsTab /></TabsContent>
        <TabsContent value="template" className="mt-4"><TemplateTab /></TabsContent>
      </Tabs>
    </div>
  );
}

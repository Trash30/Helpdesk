import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

// Public axios instance (no auth header)
const publicApi = axios.create({ baseURL: '/api' });

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

interface SurveyData {
  ticket: { ticketNumber: string; title: string };
  questions: Question[];
  companyName: string;
  logoUrl: string | null;
}

// ── Button scale renderer ─────────────────────────────────────────────────────

function NumericButtons({
  min, max, value, onChange,
}: { min: number; max: number; value: number | null; onChange: (v: number) => void }) {
  const numbers = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <div className="flex flex-wrap gap-2">
      {numbers.map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className="w-11 h-11 rounded border text-sm font-medium transition-colors"
          style={{
            backgroundColor: value === n ? '#185FA5' : '#ffffff',
            color: value === n ? '#ffffff' : '#374151',
            borderColor: value === n ? '#185FA5' : '#d1d5db',
          }}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

// ── Question renderer ─────────────────────────────────────────────────────────

function QuestionField({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: any;
  onChange: (v: any) => void;
}) {
  if (question.type === 'nps') {
    const legendLeft = question.config?.legendLeft ?? '0 = Pas du tout probable';
    const legendRight = question.config?.legendRight ?? '10 = Très probable';
    return (
      <div className="space-y-2">
        <NumericButtons min={0} max={10} value={value} onChange={onChange} />
        <div className="flex justify-between text-xs text-gray-500">
          <span>{legendLeft}</span>
          <span>{legendRight}</span>
        </div>
      </div>
    );
  }

  if (question.type === 'csat') {
    return (
      <div className="space-y-2">
        <NumericButtons min={1} max={5} value={value} onChange={onChange} />
        <div className="flex justify-between text-xs text-gray-500">
          <span>1 = Très insatisfait</span>
          <span>5 = Très satisfait</span>
        </div>
      </div>
    );
  }

  if (question.type === 'rating') {
    const scale = question.config?.scale ?? 5;
    const legendLeft = question.config?.legendLeft ?? `1 = Insuffisant`;
    const legendRight = question.config?.legendRight ?? `${scale} = Excellent`;
    return (
      <div className="space-y-2">
        <NumericButtons min={1} max={scale} value={value} onChange={onChange} />
        <div className="flex justify-between text-xs text-gray-500">
          <span>{legendLeft}</span>
          <span>{legendRight}</span>
        </div>
      </div>
    );
  }

  if (question.type === 'textarea') {
    return (
      <textarea
        value={value ?? ''}
        onChange={e => onChange(e.target.value || null)}
        placeholder="Votre réponse..."
        rows={4}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5] resize-none"
      />
    );
  }

  if (question.type === 'text') {
    return (
      <input
        type="text"
        value={value ?? ''}
        onChange={e => onChange(e.target.value || null)}
        placeholder="Votre réponse..."
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5]"
      />
    );
  }

  if (question.type === 'select') {
    return (
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value || null)}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5] bg-white"
      >
        <option value="">Sélectionner...</option>
        {(question.options ?? []).map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }

  if (question.type === 'multiselect') {
    const selected: string[] = value ?? [];
    return (
      <div className="space-y-2">
        {(question.options ?? []).map(opt => (
          <label key={opt} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selected.includes(opt)}
              onChange={e => {
                if (e.target.checked) onChange([...selected, opt]);
                else onChange(selected.filter(s => s !== opt));
              }}
              className="h-4 w-4 rounded border-gray-300 accent-[#185FA5]"
            />
            <span className="text-sm">{opt}</span>
          </label>
        ))}
      </div>
    );
  }

  return null;
}

// ── Main SurveyPage ───────────────────────────────────────────────────────────

export function SurveyPage() {
  const { token } = useParams<{ token: string }>();
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data, error, isLoading } = useQuery<{ data: SurveyData }>({
    queryKey: ['survey', token],
    queryFn: async () => (await publicApi.get(`/survey/${token}`)).data,
    retry: false,
  });

  const setAnswer = (questionId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500 text-sm">Chargement...</p>
      </div>
    );
  }

  if (error || !data?.data) {
    const errCode = (error as any)?.response?.data?.error;
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
            <span className="text-2xl">⚠️</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-800">
            {errCode === 'already_answered'
              ? 'Enquête déjà complétée'
              : errCode === 'expired'
              ? 'Lien expiré'
              : 'Lien invalide'}
          </h1>
          <p className="text-gray-500 text-sm">
            {errCode === 'already_answered'
              ? 'Vous avez déjà répondu à cette enquête. Merci pour votre participation !'
              : errCode === 'expired'
              ? 'Ce lien de satisfaction a expiré (valable 30 jours).'
              : "Ce lien n'est pas valide ou a déjà été utilisé."}
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <span className="text-2xl">✓</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-800">Merci pour votre réponse !</h1>
          <p className="text-gray-500 text-sm">
            Votre avis a bien été enregistré. Il nous aide à améliorer notre service.
          </p>
        </div>
      </div>
    );
  }

  const { ticket, questions, companyName, logoUrl } = data.data;

  // Sort questions by order
  const sortedQuestions = [...questions].sort((a, b) => a.order - b.order);

  // Check visibility
  const isVisible = (q: Question): boolean => {
    if (!q.showIf) return true;
    const { questionId, operator, value } = q.showIf;
    const refAnswer = answers[questionId];
    if (refAnswer === null || refAnswer === undefined) return false;
    const num = Number(refAnswer);
    if (operator === 'lte') return num <= value;
    if (operator === 'gte') return num >= value;
    if (operator === 'eq') return num === value;
    if (operator === 'lt') return num < value;
    if (operator === 'gt') return num > value;
    return false;
  };

  const visibleQuestions = sortedQuestions.filter(isVisible);
  const requiredVisible = visibleQuestions.filter(q => q.required);
  const requiredAnswered = requiredVisible.filter(q => {
    const v = answers[q.id];
    return v !== null && v !== undefined && v !== '';
  });
  const canSubmit = requiredAnswered.length === requiredVisible.length;
  const progress = requiredVisible.length > 0
    ? Math.round((requiredAnswered.length / requiredVisible.length) * 100)
    : 100;

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const answersList = visibleQuestions
        .map(q => ({ questionId: q.id, value: answers[q.id] ?? null }));
      await publicApi.post(`/survey/${token}/respond`, { answers: answersList });
      setSubmitted(true);
    } catch (err: any) {
      setSubmitError(err.response?.data?.error ?? 'Erreur lors de la soumission. Veuillez réessayer.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          {logoUrl && (
            <img src={logoUrl} alt={companyName}
              className="max-w-[200px] max-h-[80px] object-contain mx-auto" />
          )}
          <h1 className="text-xl font-bold text-gray-800">{companyName}</h1>
          <div className="bg-white border rounded-lg px-4 py-2 inline-block">
            <p className="text-sm text-gray-600">
              Enquête de satisfaction — Ticket <span className="font-mono font-semibold text-[#185FA5]">
                {ticket.ticketNumber}
              </span>
            </p>
            <p className="text-xs text-gray-400 truncate max-w-xs mx-auto">{ticket.title}</p>
          </div>
        </div>

        {/* Progress bar */}
        {requiredVisible.length > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-500">
              <span>{requiredAnswered.length} / {requiredVisible.length} question(s) requise(s)</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#185FA5] rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Questions */}
        <div className="space-y-4">
          {sortedQuestions.map(q => {
            const visible = isVisible(q);
            return (
              <div
                key={q.id}
                style={{
                  overflow: 'hidden',
                  maxHeight: visible ? '1000px' : '0',
                  opacity: visible ? 1 : 0,
                  transition: 'max-height 0.3s ease, opacity 0.3s ease',
                }}
              >
                <div className="bg-white border rounded-lg p-5 space-y-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800 leading-snug">
                      {q.label}
                      {q.required && <span className="text-red-500 ml-1">*</span>}
                    </p>
                    {q.helpText && (
                      <p className="text-xs text-gray-400 mt-0.5">{q.helpText}</p>
                    )}
                  </div>
                  <QuestionField
                    question={q}
                    value={answers[q.id] ?? null}
                    onChange={v => setAnswer(q.id, v)}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Submit */}
        {submitError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
            {submitError}
          </div>
        )}
        <div className="flex justify-center pb-8">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="px-8 py-3 rounded-lg text-sm font-semibold transition-colors"
            style={{
              backgroundColor: canSubmit ? '#185FA5' : '#d1d5db',
              color: '#ffffff',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
            }}
          >
            {submitting ? 'Envoi en cours...' : 'Envoyer mes réponses'}
          </button>
        </div>
      </div>
    </div>
  );
}

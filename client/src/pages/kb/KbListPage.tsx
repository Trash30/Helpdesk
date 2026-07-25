import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Search, Plus, BookOpen, FileText } from 'lucide-react';
import api from '@/lib/axios';
import { usePermissions } from '@/hooks/usePermissions';
import { useDebounce } from '@/hooks/useDebounce';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// -- Types -------------------------------------------------------------------

interface KbArticle {
  id: string;
  title: string;
  status: 'DRAFT' | 'PUBLISHED';
  tags: string[];
  category: { name: string; color: string } | null;
  author: { firstName: string; lastName: string };
  updatedAt: string;
  publishedAt: string | null;
}

interface KbListResponse {
  data: KbArticle[];
  total: number;
  page: number;
  totalPages: number;
}

interface Category {
  id: string;
  name: string;
  color: string;
}

// -- Helpers -----------------------------------------------------------------

function relativeTime(dateStr: string, t: TFunction): string {
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  const min = Math.floor(diff / 60000);
  const hour = Math.floor(min / 60);
  const day = Math.floor(hour / 24);
  if (min < 1) return t('list.time.now');
  if (min < 60) return t('list.time.minutes', { count: min });
  if (hour < 24) return t('list.time.hours', { count: hour });
  if (day === 1) return t('list.time.yesterday');
  if (day < 30) return t('list.time.days', { count: day });
  return date.toLocaleDateString('fr-FR');
}

// -- Skeleton ----------------------------------------------------------------

function TableSkeleton() {
  return (
    <div className="rounded-lg border overflow-x-auto">
      <table className="w-full min-w-[600px]">
        <thead>
          <tr className="bg-muted/50">
            <th className="px-4 py-3"><Skeleton className="h-4 w-48" /></th>
            <th className="px-4 py-3"><Skeleton className="h-4 w-20" /></th>
            <th className="px-4 py-3"><Skeleton className="h-4 w-16" /></th>
            <th className="px-4 py-3 hidden md:table-cell"><Skeleton className="h-4 w-24" /></th>
            <th className="px-4 py-3 hidden lg:table-cell"><Skeleton className="h-4 w-20" /></th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 8 }).map((_, i) => (
            <tr key={i} className="border-t">
              <td className="px-4 py-3"><Skeleton className="h-4 w-52" /></td>
              <td className="px-4 py-3"><Skeleton className="h-5 w-20 rounded-full" /></td>
              <td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
              <td className="px-4 py-3 hidden md:table-cell"><Skeleton className="h-4 w-24" /></td>
              <td className="px-4 py-3 hidden lg:table-cell"><Skeleton className="h-4 w-20" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// -- Main Page ---------------------------------------------------------------

const LIMIT = 20;

export function KbListPage() {
  const { t } = useTranslation('kb');
  const navigate = useNavigate();
  const { can } = usePermissions();

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryId, setCategoryId] = useState<string>('ALL');
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounce(search, 300);

  // Fetch categories for dropdown
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => r.data?.data ?? []),
  });

  // Fetch articles
  const { data, isLoading } = useQuery<KbListResponse>({
    queryKey: ['kb', debouncedSearch, statusFilter, categoryId, page],
    queryFn: () =>
      api
        .get('/kb', {
          params: {
            search: debouncedSearch || undefined,
            status: statusFilter !== 'ALL' ? statusFilter : undefined,
            categoryId: categoryId !== 'ALL' ? categoryId : undefined,
            page,
            limit: LIMIT,
          },
        })
        .then((r) => r.data),
  });

  const articles = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  // Reset page on filter change
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleCategoryChange = (value: string) => {
    setCategoryId(value);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <BookOpen className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">{t('list.title')}</h1>
        </div>

        {can('kb.write') && (
          <Button onClick={() => navigate('/kb/new')}>
            <Plus className="h-4 w-4 mr-2" />
            {t('list.newArticle')}
          </Button>
        )}
      </div>

      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={t('list.searchPlaceholder')}
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          />
        </div>

        {/* Status filter */}
        <Select value={statusFilter} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder={t('list.statusPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t('list.allStatuses')}</SelectItem>
            <SelectItem value="DRAFT">{t('list.draft')}</SelectItem>
            <SelectItem value="PUBLISHED">{t('list.published')}</SelectItem>
          </SelectContent>
        </Select>

        {/* Category filter */}
        <Select value={categoryId} onValueChange={handleCategoryChange}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder={t('list.categoryPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t('list.allCategories')}</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton />
      ) : articles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <FileText className="h-12 w-12 mb-4 opacity-40" />
          <p className="text-lg font-medium">{t('list.noArticlesFound')}</p>
          <p className="text-sm mt-1">
            {debouncedSearch
              ? t('list.refineSearch')
              : t('list.createFirst')}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="bg-muted/50 text-left text-sm font-medium text-muted-foreground">
                <th className="px-4 py-3">{t('list.colTitle')}</th>
                <th className="px-4 py-3">{t('list.colCategory')}</th>
                <th className="px-4 py-3">{t('list.colStatus')}</th>
                <th className="px-4 py-3 hidden md:table-cell">{t('list.colAuthor')}</th>
                <th className="px-4 py-3 hidden lg:table-cell">{t('list.colUpdated')}</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((article) => (
                <tr
                  key={article.id}
                  className="border-t hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => navigate(`/kb/${article.id}`)}
                >
                  <td className="px-4 py-3">
                    <span className="font-medium text-sm">{article.title}</span>
                    {article.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {article.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground"
                          >
                            {tag}
                          </span>
                        ))}
                        {article.tags.length > 3 && (
                          <span className="text-xs text-muted-foreground">
                            +{article.tags.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {article.category ? (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold text-white"
                        style={{ backgroundColor: article.category.color }}
                      >
                        {article.category.name}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">--</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={
                        article.status === 'PUBLISHED'
                          ? 'bg-green-50 text-green-800 border-green-200'
                          : 'bg-yellow-50 text-yellow-800 border-yellow-200'
                      }
                    >
                      {article.status === 'PUBLISHED' ? t('list.published') : t('list.draft')}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-sm text-muted-foreground">
                    {article.author.firstName} {article.author.lastName}
                  </td>
                  <td
                    className="px-4 py-3 hidden lg:table-cell text-sm text-muted-foreground"
                    title={new Date(article.updatedAt).toLocaleDateString('fr-FR')}
                  >
                    {relativeTime(article.updatedAt, t)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t('list.pageOf', { page, totalPages })}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              {t('list.previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              {t('list.next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

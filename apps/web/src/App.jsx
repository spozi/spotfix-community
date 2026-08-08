import { useEffect, useMemo, useState } from 'react';
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import {
  assignCleaner,
  bootstrapSession,
  createCleaner,
  createReport,
  getPublicStatusBoard,
  getMyReports,
  listCleaners,
  listReports,
  listUsers,
  login,
  loginWithGoogle,
  loginMaster,
  logout,
  provisionUser,
  registerAndLogin,
  updateReport,
} from './lib/api.js';
import {
  LANGUAGE_OPTIONS,
  LANGUAGE_STORAGE_KEY,
  accountStatusLabel,
  categoryLabel,
  formatCoordinates,
  prettyDate,
  prettyDateShort,
  priorityLabel,
  readInitialLanguage,
  roleLabel,
  statusLabel,
  translate,
  workforceStatusLabel,
} from './i18n.js';

const initialRegister = {
  name: '',
  email: '',
  idNumber: '',
  phone: '',
  password: '',
};

const initialUserLogin = {
  identifier: '',
  password: '',
};

const initialMasterLogin = {
  username: '',
  password: '',
};

const initialStaffProvision = {
  name: '',
  email: '',
  idNumber: '',
  phone: '',
  workLocation: '',
  password: '',
  role: 'cleaner',
  workId: '',
  supervisorId: '',
};

const initialReport = {
  category: 'Litter',
  priority: 'Medium',
  location: '',
  details: '',
  reporterPhone: '',
  coordinates: undefined,
  evidencePhoto: '',
  photos: [],
};

const runtimeConfig = window.__APP_CONFIG__ || {};
const GOOGLE_CLIENT_ID = String(
  runtimeConfig.GOOGLE_CLIENT_ID || import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
).trim();
const PUBLIC_PENDING_STATUSES = new Set(['Reported']);
const TOAST_ICONS = {
  success: 'check_circle',
  warn: 'warning',
  error: 'error',
  info: 'info',
};
const PUBLIC_OPEN_STATUSES = new Set(['Assigned', 'In Progress']);
const PUBLIC_URGENT_PRIORITIES = new Set(['High', 'Critical']);

function statusTone(status) {
  if (status === 'Resolved') return 'good';
  if (status === 'In Progress') return 'warn';
  if (status === 'Assigned') return 'info';
  return 'hot';
}

function DashboardStat({ label, value }) {
  return (
    <article>
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  );
}

function EmptyState({ title, copy }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{copy}</p>
    </div>
  );
}

function AuthFeature({ title, copy }) {
  return (
    <article className="feature-card">
      <strong>{title}</strong>
      <p>{copy}</p>
    </article>
  );
}

function AppIcon({ name, className = '' }) {
  return (
    <span className={`material-symbols-outlined ${className}`.trim()} aria-hidden="true">
      {name}
    </span>
  );
}

function LanguageSwitch({ language, onChange, compact = false, ariaLabel }) {
  return (
    <div className={compact ? 'language-chip compact' : 'language-chip'} role="group" aria-label={ariaLabel}>
      <AppIcon name="language" />
      <div className="language-options">
        {LANGUAGE_OPTIONS.map((option) => (
          <button
            key={option.code}
            type="button"
            className={language === option.code ? 'language-option active' : 'language-option'}
            onClick={() => onChange(option.code)}
            aria-pressed={language === option.code}
            title={option.label}
          >
            {option.shortLabel}
          </button>
        ))}
      </div>
    </div>
  );
}

function PortalFooter({ language, muted = false }) {
  return (
    <footer className={muted ? 'portal-footer muted' : 'portal-footer'}>
      <span className="portal-footer-brand">SpotFix</span>
      <span className="portal-footer-copy">
        {translate(language, 'footer.copy')}
      </span>
    </footer>
  );
}

function PortalHero({ eyebrow, title, copy, metrics, action, accent = 'teal' }) {
  return (
    <section className={`card portal-hero ${accent} full-span`}>
      <div className="portal-hero-copy">
        <p className="kicker">{eyebrow}</p>
        <h2>{title}</h2>
        <p className="muted portal-copy">{copy}</p>
        {action}
      </div>
      <div className="hero-metrics">
        {metrics.map((metric) => (
          <DashboardStat key={metric.label} label={metric.label} value={metric.value} />
        ))}
      </div>
    </section>
  );
}

function collectReportImages(report) {
  return [
    ...(report.evidencePhoto ? [report.evidencePhoto] : []),
    ...(Array.isArray(report.photos) ? report.photos : []),
    ...(report.resolutionPhoto ? [report.resolutionPhoto] : []),
  ].filter((entry, index, all) => typeof entry === 'string' && entry && all.indexOf(entry) === index);
}

function ReportRow({ report, children, onClick, selected = false, language }) {
  const reportImages = collectReportImages(report);
  const previewImages = reportImages.slice(0, 3);

  function handleKeyDown(event) {
    if (!onClick) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  }

  return (
    <article
      className={onClick ? `report-item clickable${selected ? ' selected' : ''}` : 'report-item'}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-pressed={onClick ? selected : undefined}
    >
      <header>
        <div>
          <h3>{report.id || report._id}</h3>
          <p>{categoryLabel(report.category || 'General', language)} • {priorityLabel(report.priority || 'Medium', language)}</p>
        </div>
        <span className={`pill ${statusTone(report.status)}`}>{statusLabel(report.status || 'Reported', language)}</span>
      </header>
      <p>{report.location || '-'}</p>
      <p>{report.details || translate(language, 'common.noDetails')}</p>
      {previewImages.length > 0 ? (
        <div className="report-photo-strip">
          {previewImages.map((imageUrl, index) => (
            <img
              key={`${report.id || report._id}-photo-${index}`}
              className="report-photo report-photo-compact"
              src={imageUrl}
              alt={translate(language, 'reportRow.photoEvidenceAlt', { index: index + 1 })}
              loading="lazy"
            />
          ))}
          {reportImages.length > previewImages.length ? (
            <div className="report-photo-more">{translate(language, 'reportRow.additionalPhotos', { count: reportImages.length - previewImages.length })}</div>
          ) : null}
        </div>
      ) : null}
      <time>{prettyDate(report.timestamp || report.createdAt || report.updatedAt, language)}</time>
      {children ? (
        <div onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
          {children}
        </div>
      ) : null}
    </article>
  );
}

function buildStatusBoardMetrics(summary, language) {
  return [
    { id: 'pending', label: translate(language, 'supervisor.metricPending'), value: summary.pending, tone: 'orange' },
    { id: 'urgent', label: translate(language, 'supervisor.metricUrgent'), value: summary.urgent, tone: 'plum' },
    { id: 'cleaners', label: translate(language, 'supervisor.metricCleaners'), value: summary.cleaners, tone: 'teal' },
    { id: 'open', label: translate(language, 'public.metricOpen'), value: summary.open, tone: 'blue' },
    { id: 'resolved', label: translate(language, 'public.metricResolved'), value: summary.resolved, tone: 'green' },
    { id: 'total', label: translate(language, 'public.metricTotal'), value: summary.total, tone: 'ink' },
  ];
}

function filterStatusBoardReports(reports, metricId) {
  if (metricId === 'pending') {
    return reports.filter((report) => PUBLIC_PENDING_STATUSES.has(report.status));
  }
  if (metricId === 'urgent') {
    return reports.filter((report) => report.status !== 'Resolved' && PUBLIC_URGENT_PRIORITIES.has(report.priority));
  }
  if (metricId === 'open') {
    return reports.filter((report) => PUBLIC_OPEN_STATUSES.has(report.status));
  }
  if (metricId === 'resolved') {
    return reports.filter((report) => report.status === 'Resolved');
  }
  return reports;
}

function StatusMetricButton({ label, value, tone, active, onClick }) {
  return (
    <button
      type="button"
      className={`status-metric-button ${tone}${active ? ' active' : ''}`.trim()}
      onClick={onClick}
      aria-pressed={active}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </button>
  );
}

function PublicStatusBoard({
  board,
  busy,
  error,
  activeMetric,
  onMetricChange,
  onRefresh,
  language,
  title,
  copy,
}) {
  const summary = board?.summary || {
    total: 0,
    open: 0,
    pending: 0,
    resolved: 0,
    urgent: 0,
    cleaners: 0,
    availableCleaners: 0,
    busyCleaners: 0,
  };
  const metrics = buildStatusBoardMetrics(summary, language);
  const activeEntry = metrics.find((metric) => metric.id === activeMetric) || metrics[0];
  const reports = Array.isArray(board?.reports) ? board.reports : [];
  const cleaners = Array.isArray(board?.cleaners) ? board.cleaners : [];
  const visibleReports = filterStatusBoardReports(reports, activeEntry.id);
  const busyCleaners = cleaners.filter((cleaner) => cleaner.status === 'Busy');
  const availableCleaners = cleaners.filter((cleaner) => cleaner.status !== 'Busy');
  const updatedAt = board?.generatedAt ? prettyDateShort(board.generatedAt, language) : null;
  const t = (key, values) => translate(language, key, values);

  return (
    <section className="card status-board-panel">
      <div className="row-between status-board-head">
        <div>
          <h2>{title}</h2>
          <p className="muted">{copy}</p>
        </div>
        <button className="ghost" type="button" onClick={onRefresh} disabled={busy}>
          <AppIcon name="refresh" />
          {t('common.refresh')}
        </button>
      </div>

      <div className="status-metric-grid">
        {metrics.map((metric) => (
          <StatusMetricButton
            key={metric.id}
            label={metric.label}
            value={metric.value}
            tone={metric.tone}
            active={activeEntry.id === metric.id}
            onClick={() => onMetricChange(metric.id)}
          />
        ))}
      </div>

      {error ? <div className="status-board-error">{error}</div> : null}

      {busy && !board ? (
        <p className="muted">{t('public.statusLoading')}</p>
      ) : activeEntry.id === 'cleaners' ? (
        <div className="status-board-groups">
          <div className="row-between status-board-summary">
            <div>
              <h3>{t('public.statusCleanersTitle')}</h3>
              <p className="muted">{t('public.statusCleanersCopy')}</p>
            </div>
            {updatedAt ? <span className="status-board-timestamp">{t('public.statusUpdatedAt', { time: updatedAt })}</span> : null}
          </div>

          <div className="status-cleaner-grid">
            <section className="status-cleaner-column">
              <div className="status-column-head">
                <h3>{t('public.statusBusyTitle')}</h3>
                <p className="muted">{t('public.statusBusyCopy')}</p>
              </div>
              <div className="report-list">
                {busyCleaners.length === 0 ? (
                  <EmptyState title={t('public.statusEmptyTitle')} copy={t('public.statusEmptyCopy')} />
                ) : (
                  busyCleaners.map((cleaner) => (
                    <article key={cleaner._id} className="report-item cleaner-status-card">
                      <header>
                        <div>
                          <h3>{cleaner.name}</h3>
                          <p>{t('supervisor.workLocation')}: {cleaner.workLocation || '-'}</p>
                        </div>
                        <span className="pill warn">{workforceStatusLabel(cleaner.status, language)}</span>
                      </header>
                      <p>{t('public.statusAssignedTask')}: {cleaner.assignedTaskId || t('public.statusNoTask')}</p>
                    </article>
                  ))
                )}
              </div>
            </section>

            <section className="status-cleaner-column">
              <div className="status-column-head">
                <h3>{t('public.statusAvailableTitle')}</h3>
                <p className="muted">{t('public.statusAvailableCopy')}</p>
              </div>
              <div className="report-list">
                {availableCleaners.length === 0 ? (
                  <EmptyState title={t('public.statusEmptyTitle')} copy={t('public.statusEmptyCopy')} />
                ) : (
                  availableCleaners.map((cleaner) => (
                    <article key={cleaner._id} className="report-item cleaner-status-card">
                      <header>
                        <div>
                          <h3>{cleaner.name}</h3>
                          <p>{t('supervisor.workLocation')}: {cleaner.workLocation || '-'}</p>
                        </div>
                        <span className="pill good">{workforceStatusLabel(cleaner.status, language)}</span>
                      </header>
                      <p>{t('public.statusAssignedTask')}: {cleaner.assignedTaskId || t('public.statusNoTask')}</p>
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      ) : (
        <div className="status-board-groups">
          <div className="row-between status-board-summary">
            <div>
              <h3>{t('public.statusReportsTitle', { label: activeEntry.label })}</h3>
              <p className="muted">{t('public.statusReportsCopy')}</p>
            </div>
            {updatedAt ? <span className="status-board-timestamp">{t('public.statusUpdatedAt', { time: updatedAt })}</span> : null}
          </div>

          <div className="report-list wide-list status-report-list">
            {visibleReports.length === 0 ? (
              <EmptyState title={t('public.statusEmptyTitle')} copy={t('public.statusEmptyCopy')} />
            ) : (
              visibleReports.map((report) => (
                <ReportRow key={report._id || report.id} report={report} language={language}>
                  <div className="status-report-meta">
                    <span>{t('supervisor.detailAssignedCleaner')}: {report.assignedTo || t('public.statusNoTask')}</span>
                    {report.resolutionTimestamp ? (
                      <span>{t('supervisor.detailResolvedAt')}: {prettyDate(report.resolutionTimestamp, language)}</span>
                    ) : null}
                  </div>
                </ReportRow>
              ))
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function PortalSectionNav({ items, activeView, onChange, ariaLabel }) {
  const columns = `repeat(${items.length}, minmax(0, 1fr))`;

  return (
    <nav className="supervisor-nav" style={{ gridTemplateColumns: columns }} aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={activeView === item.id ? 'supervisor-nav-button active' : 'supervisor-nav-button'}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}

function DetailField({ label, value }) {
  return (
    <div className="detail-field">
      <span>{label}</span>
      <strong>{value || '-'}</strong>
    </div>
  );
}

function SupervisorTaskDetailPanel({ report, cleaner, language, onBack }) {
  if (!report) {
    return (
      <aside className="task-detail-panel empty">
        <p className="kicker">{translate(language, 'supervisor.detailKicker')}</p>
        <h2>{translate(language, 'supervisor.detailEmptyTitle')}</h2>
        <p className="muted">{translate(language, 'supervisor.detailEmptyCopy')}</p>
      </aside>
    );
  }

  const reportImages = collectReportImages(report);
  const mapCenter = report.coordinates
    ? [report.coordinates.lat, report.coordinates.lng]
    : null;

  return (
    <aside className="task-detail-panel">
      {onBack ? (
        <button type="button" className="ghost small task-detail-back" onClick={onBack}>
          <AppIcon name="arrow_back" />
          {translate(language, 'supervisor.backToList')}
        </button>
      ) : null}
      <div className="task-detail-header">
        <div>
          <p className="kicker">{translate(language, 'supervisor.detailKicker')}</p>
          <h2>{report.id || report._id}</h2>
        </div>
        <span className={`pill ${statusTone(report.status)}`}>{statusLabel(report.status || 'Reported', language)}</span>
      </div>

      <div className="detail-grid">
        <DetailField label={translate(language, 'supervisor.detailPriority')} value={priorityLabel(report.priority || 'Medium', language)} />
        <DetailField label={translate(language, 'supervisor.detailCategory')} value={categoryLabel(report.category || 'General', language)} />
        <DetailField label={translate(language, 'supervisor.detailLocation')} value={report.location || '-'} />
        <DetailField label={translate(language, 'supervisor.detailAssignedCleaner')} value={cleaner?.name || report.assignedTo || '-'} />
        <DetailField label={translate(language, 'supervisor.detailCleanerStaffId')} value={cleaner?.workId || '-'} />
        <DetailField label={translate(language, 'supervisor.detailReportedAt')} value={prettyDate(report.timestamp || report.createdAt, language)} />
        <DetailField label={translate(language, 'supervisor.detailResolvedAt')} value={prettyDate(report.resolutionTimestamp, language)} />
        <DetailField label={translate(language, 'supervisor.detailCoordinates')} value={report.coordinates ? formatCoordinates(report.coordinates, language) : '-'} />
      </div>

      <div className="detail-copy">
        <h3>{translate(language, 'supervisor.detailInfoTitle')}</h3>
        <p>{report.details || translate(language, 'common.noDetails')}</p>
      </div>

      {reportImages.length > 0 ? (
        <div className="detail-copy">
          <h3>{translate(language, 'supervisor.detailPhotosTitle')}</h3>
          <div className="modal-photo-gallery">
            {reportImages.map((imageUrl, index) => (
              <img
                key={`${report.id || report._id}-detail-photo-${index}`}
                className="modal-report-photo"
                src={imageUrl}
                alt={translate(language, 'reportRow.photoAlt', { index: index + 1 })}
                loading="lazy"
              />
            ))}
          </div>
        </div>
      ) : null}

      {mapCenter ? (
        <div className="detail-copy">
          <h3>{translate(language, 'supervisor.detailMapTitle')}</h3>
          <div className="modal-map-wrap">
            <MapContainer center={mapCenter} zoom={17} scrollWheelZoom={false} dragging={false} doubleClickZoom={false} touchZoom={false} zoomControl={false} className="leaflet-map modal-map">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <RecenterMap center={mapCenter} />
              <CircleMarker
                center={mapCenter}
                radius={9}
                pathOptions={{ color: '#0050cb', fillColor: '#0066ff', fillOpacity: 0.35, weight: 2 }}
              />
            </MapContainer>
          </div>
        </div>
      ) : null}
    </aside>
  );
}

function LocationMapEvents({ onPick }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng);
    },
  });

  return null;
}

function RecenterMap({ center }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center);
  }, [center, map]);

  return null;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) {
        reject(new Error('Failed to read image file.'));
        return;
      }
      resolve(dataUrl);
    };
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

export default function App() {
  const [authTab, setAuthTab] = useState('staff-login');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [user, setUser] = useState(null);
  const [language, setLanguage] = useState(readInitialLanguage);

  const [reports, setReports] = useState([]);
  const [cleaners, setCleaners] = useState([]);
  const [users, setUsers] = useState([]);

  const [registerForm, setRegisterForm] = useState(initialRegister);
  const [userLoginForm, setUserLoginForm] = useState(initialUserLogin);
  const [masterLoginForm, setMasterLoginForm] = useState(initialMasterLogin);
  const [staffProvisionForm, setStaffProvisionForm] = useState(initialStaffProvision);
  const [reportForm, setReportForm] = useState(initialReport);
  const [googleReady, setGoogleReady] = useState(false);
  const [mapCenter, setMapCenter] = useState([6.4654, 100.5067]);
  const [mapInteractive, setMapInteractive] = useState(false);
  const [locating, setLocating] = useState(false);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [supervisorCleanerLocation, setSupervisorCleanerLocation] = useState('');
  const [resolutionEvidenceByReport, setResolutionEvidenceByReport] = useState({});
  const [supervisorView, setSupervisorView] = useState('task-board');
  const [publicView, setPublicView] = useState('submit-report');
  const [cleanerView, setCleanerView] = useState('my-tasks');
  const [adminView, setAdminView] = useState('overview');
  const [selectedSupervisorReportId, setSelectedSupervisorReportId] = useState(null);
  const [publicStatusBoard, setPublicStatusBoard] = useState(null);
  const [publicStatusBusy, setPublicStatusBusy] = useState(false);
  const [publicStatusError, setPublicStatusError] = useState('');
  const [publicStatusMetric, setPublicStatusMetric] = useState('pending');

  const portalRole = user?.role === 'master' ? 'admin' : user?.role;
  const t = (key, values) => translate(language, key, values);
  const showToast = (text, tone = 'info') => setToast({ text, tone });

  const publicOpenCount = useMemo(
    () => reports.filter((report) => report.status !== 'Resolved').length,
    [reports]
  );

  const adminMetrics = useMemo(() => {
    const resolved = reports.filter((report) => report.status === 'Resolved').length;
    const pending = reports.filter((report) => report.status !== 'Resolved').length;
    const urgent = reports.filter((report) => report.priority === 'High' || report.priority === 'Critical').length;
    return { resolved, pending, urgent };
  }, [reports]);

  const supervisorUsers = useMemo(
    () => users.filter((entry) => entry.role === 'supervisor'),
    [users]
  );

  const cleanerLocations = useMemo(() => {
    const locations = cleaners
      .map((cleaner) => (typeof cleaner.workLocation === 'string' ? cleaner.workLocation.trim() : ''))
      .filter(Boolean);
    return Array.from(new Set(locations));
  }, [cleaners]);

  const visibleSupervisorCleaners = useMemo(() => {
    if (!supervisorCleanerLocation) return cleaners;
    const normalized = supervisorCleanerLocation.trim().toLowerCase();
    return cleaners.filter((cleaner) => (cleaner.workLocation || '').trim().toLowerCase() === normalized);
  }, [cleaners, supervisorCleanerLocation]);

  const cleanersById = useMemo(
    () => Object.fromEntries(cleaners.map((cleaner) => [cleaner._id, cleaner])),
    [cleaners]
  );

  const selectedSupervisorReport = useMemo(
    () => reports.find((report) => (report.id || report._id) === selectedSupervisorReportId) || null,
    [reports, selectedSupervisorReportId]
  );

  useEffect(() => {
    if (portalRole !== 'supervisor') return;
    if (reports.length === 0) {
      if (selectedSupervisorReportId) setSelectedSupervisorReportId(null);
      return;
    }

    const existing = reports.some((report) => (report.id || report._id) === selectedSupervisorReportId);
    if (!existing) {
      setSelectedSupervisorReportId(reports[0].id || reports[0]._id);
    }
  }, [portalRole, reports, selectedSupervisorReportId]);

  useEffect(() => {
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // Ignore storage failures; switching still works for the current session.
    }
  }, [language]);

  const cleanerReports = useMemo(() => {
    if (!user) return [];
    if (user.role === 'cleaner') return reports;
    return reports.filter((report) => {
      if (report.assignedToCleanerId && user.id) {
        return report.assignedToCleanerId === user.id;
      }
      return report.assignedTo === user.name;
    });
  }, [reports, user]);

  async function loadPublicStatusPanel({ silent = false } = {}) {
    if (!silent) setPublicStatusBusy(true);

    try {
      const board = await getPublicStatusBoard();
      setPublicStatusBoard(board);
      setPublicStatusError('');
    } catch (error) {
      setPublicStatusError(error.message);
    } finally {
      if (!silent) setPublicStatusBusy(false);
    }
  }

  async function loadPortalData(currentUser = user) {
    if (!currentUser) return;

    if (currentUser.role === 'public') {
      const ownReports = await getMyReports(currentUser.id);
      setReports(ownReports);
      setCleaners([]);
      setUsers([]);
      return;
    }

    const [reportsResult, cleanersResult, usersResult] = await Promise.allSettled([
      listReports(),
      (currentUser.role === 'supervisor' || currentUser.role === 'master')
        ? listCleaners({ workLocation: currentUser.workLocation || undefined })
        : Promise.resolve([]),
      currentUser.role === 'master' ? listUsers() : Promise.resolve([]),
    ]);

    if (reportsResult.status === 'rejected') {
      throw reportsResult.reason;
    }

    setReports(reportsResult.value);

    if (cleanersResult.status === 'fulfilled') {
      setCleaners(cleanersResult.value);
    } else {
      setCleaners([]);
      showToast(t('toasts.cleanersUnavailable'), 'warn');
    }

    if (usersResult.status === 'fulfilled') {
      setUsers(usersResult.value);
    } else {
      setUsers([]);
      showToast(t('toasts.usersUnavailable'), 'warn');
    }
  }

  useEffect(() => {
    loadPublicStatusPanel();
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      setBusy(true);
      try {
        const sessionUser = await bootstrapSession();
        if (!alive || !sessionUser) return;
        setUser(sessionUser);
        setReportForm((prev) => ({ ...prev, reporterPhone: sessionUser.phone || '' }));
        await loadPortalData(sessionUser);
      } catch (error) {
        if (alive) showToast(error.message, 'error');
      } finally {
        if (alive) setBusy(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (user || authTab !== 'reporter-login' || !GOOGLE_CLIENT_ID) {
      setGoogleReady(false);
      return;
    }

    let cancelled = false;
    let timerId;

    const mountGoogleButton = () => {
      if (cancelled) return true;
      const googleId = window.google?.accounts?.id;
      const container = document.getElementById('google-signin-button');
      if (!googleId || !container) return false;

      googleId.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
          if (!response?.credential) {
            showToast(t('toasts.googleFailed'), 'error');
            return;
          }

          setBusy(true);
          try {
            const nextUser = await loginWithGoogle(response.credential);
            setUser(nextUser);
            setReportForm((prev) => ({ ...prev, reporterPhone: nextUser.phone || '' }));
            await loadPortalData(nextUser);
            showToast(t('toasts.googleSuccess'), 'success');
          } catch (error) {
            showToast(error.message, 'error');
          } finally {
            setBusy(false);
          }
        },
      });

      container.innerHTML = '';
      googleId.renderButton(container, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'pill',
        width: 320,
      });

      setGoogleReady(true);
      return true;
    };

    if (!mountGoogleButton()) {
      timerId = window.setInterval(() => {
        if (mountGoogleButton()) {
          window.clearInterval(timerId);
        }
      }, 250);
    }

    return () => {
      cancelled = true;
      if (timerId) window.clearInterval(timerId);
    };
  }, [authTab, user, language]);

  async function handleRegister(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const nextUser = await registerAndLogin(registerForm);
      setUser(nextUser);
      setRegisterForm(initialRegister);
      setReportForm((prev) => ({ ...prev, reporterPhone: nextUser.phone || '' }));
      await loadPortalData(nextUser);
      showToast(t('toasts.registerSuccess'), 'success');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleUserLogin(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const nextUser = await login(userLoginForm);
      setUser(nextUser);
      setUserLoginForm(initialUserLogin);
      setReportForm((prev) => ({ ...prev, reporterPhone: nextUser.phone || '' }));
      await loadPortalData(nextUser);
      showToast(t('toasts.loginSuccess'), 'success');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleMasterLogin(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const nextUser = await loginMaster(masterLoginForm);
      setUser(nextUser);
      setMasterLoginForm(initialMasterLogin);
      await loadPortalData(nextUser);
      showToast(t('toasts.masterReady'), 'success');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleProvisionStaff(event) {
    event.preventDefault();
    if (!user) return;

    const nextRole = user.role === 'supervisor' ? 'cleaner' : staffProvisionForm.role;
    if (nextRole === 'cleaner' && !staffProvisionForm.workId.trim()) {
      showToast(t('toasts.cleanerWorkIdRequired'), 'warn');
      return;
    }
    if (user.role === 'master' && nextRole === 'cleaner' && !staffProvisionForm.supervisorId) {
      showToast(t('toasts.cleanerSupervisorRequired'), 'warn');
      return;
    }

    setBusy(true);
    try {
      await provisionUser({
        name: staffProvisionForm.name,
        email: staffProvisionForm.email.trim(),
        idNumber: staffProvisionForm.idNumber,
        phone: staffProvisionForm.phone,
        workLocation: staffProvisionForm.workLocation,
        password: staffProvisionForm.password,
        role: nextRole,
      });

      if (nextRole === 'cleaner') {
        await createCleaner({
          name: staffProvisionForm.name,
          workId: staffProvisionForm.workId,
          phone: staffProvisionForm.phone,
          workLocation: staffProvisionForm.workLocation,
          supervisorId: user.role === 'master' ? staffProvisionForm.supervisorId : user.id,
        });
      }

      setStaffProvisionForm((prev) => ({
        ...initialStaffProvision,
        role: user.role === 'supervisor' ? 'cleaner' : prev.role,
      }));
      await loadPortalData();
      await loadPublicStatusPanel({ silent: true });
      showToast(t('toasts.roleAccountCreated', { role: roleLabel(nextRole, language) }), 'success');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmitReport(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await createReport({
        ...reportForm,
        photoTimestamp: reportForm.photos.length > 0 ? new Date().toISOString() : undefined,
      });
      setReportForm((prev) => ({
        ...prev,
        location: '',
        details: '',
        coordinates: undefined,
        evidencePhoto: '',
        photos: [],
      }));
      setPhotoPreviews([]);
      await loadPortalData();
      await loadPublicStatusPanel({ silent: true });
      showToast(t('toasts.reportSubmitted'), 'success');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function processSelectedPhotos(files, { append = false } = {}) {
    if (files.length === 0) {
      if (!append) {
        setPhotoPreviews([]);
        setReportForm((prev) => ({ ...prev, evidencePhoto: '', photos: [] }));
      }
      return;
    }

    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        showToast(t('toasts.chooseImagesOnly'), 'warn');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        showToast(t('toasts.imageTooLarge'), 'warn');
        return;
      }
    }

    try {
      const dataUrls = await Promise.all(files.map((file) => readFileAsDataUrl(file)));
      setPhotoPreviews((prevPreviews) => {
        const nextPreviews = append ? [...prevPreviews, ...dataUrls] : dataUrls;
        setReportForm((prev) => ({
          ...prev,
          evidencePhoto: nextPreviews[0] || '',
          photos: nextPreviews,
        }));
        return nextPreviews;
      });
    } catch {
      showToast(t('toasts.imageReadFailed'), 'error');
    }
  }

  async function handlePhotoSelect(event) {
    const files = Array.from(event.target.files || []);
    await processSelectedPhotos(files, { append: true });
    event.target.value = '';
  }

  function removeSelectedPhoto(indexToRemove) {
    setPhotoPreviews((prevPreviews) => {
      const nextPreviews = prevPreviews.filter((_, index) => index !== indexToRemove);
      setReportForm((prev) => ({
        ...prev,
        evidencePhoto: nextPreviews[0] || '',
        photos: nextPreviews,
      }));
      return nextPreviews;
    });
  }

  function clearSelectedPhotos() {
    setPhotoPreviews([]);
    setReportForm((prev) => ({ ...prev, evidencePhoto: '', photos: [] }));
  }

  function handleMapPick(latlng) {
    const nextCoordinates = {
      lat: Number(latlng.lat.toFixed(6)),
      lng: Number(latlng.lng.toFixed(6)),
    };

    setMapCenter([nextCoordinates.lat, nextCoordinates.lng]);
    setReportForm((prev) => ({ ...prev, coordinates: nextCoordinates }));
    setMapInteractive(true);
  }

  function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      showToast(t('toasts.geolocationUnsupported'), 'warn');
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextCoordinates = {
          lat: Number(position.coords.latitude.toFixed(6)),
          lng: Number(position.coords.longitude.toFixed(6)),
        };
        setMapCenter([nextCoordinates.lat, nextCoordinates.lng]);
        setReportForm((prev) => ({ ...prev, coordinates: nextCoordinates }));
        setLocating(false);
      },
      (error) => {
        setLocating(false);
        if (error.code === error.PERMISSION_DENIED) {
          showToast(t('toasts.locationPermissionDenied'), 'warn');
          return;
        }
        showToast(t('toasts.locationReadFailed'), 'error');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );
  }

  async function handleAssign(cleanerId, reportId) {
    setBusy(true);
    try {
      await assignCleaner(cleanerId, reportId);
      await loadPortalData();
      await loadPublicStatusPanel({ silent: true });
      showToast(t('toasts.cleanerAssigned'), 'success');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleResolutionEvidenceSelect(reportId, event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast(t('toasts.resolutionImageOnly'), 'warn');
      event.target.value = '';
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showToast(t('toasts.resolutionImageTooLarge'), 'warn');
      event.target.value = '';
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setResolutionEvidenceByReport((prev) => ({
        ...prev,
        [reportId]: dataUrl,
      }));
    } catch {
      showToast(t('toasts.resolutionImageReadFailed'), 'error');
    } finally {
      event.target.value = '';
    }
  }

  async function handleStartTask(reportId) {
    setBusy(true);
    try {
      await updateReport(reportId, { status: 'In Progress' });
      await loadPortalData();
      await loadPublicStatusPanel({ silent: true });
      showToast(t('toasts.taskStarted'), 'success');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleResolve(reportId) {
    const evidencePhoto = resolutionEvidenceByReport[reportId];
    if (!evidencePhoto) {
      showToast(t('toasts.resolutionPhotoRequired'), 'warn');
      return;
    }

    setBusy(true);
    try {
      await updateReport(reportId, {
        status: 'Resolved',
        resolutionPhoto: evidencePhoto,
        resolutionTimestamp: new Date().toISOString(),
      });
      setResolutionEvidenceByReport((prev) => {
        const next = { ...prev };
        delete next[reportId];
        return next;
      });
      await loadPortalData();
      await loadPublicStatusPanel({ silent: true });
      showToast(t('toasts.taskResolved'), 'success');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    setBusy(true);
    try {
      await logout();
    } finally {
      setUser(null);
      setReports([]);
      setCleaners([]);
      setUsers([]);
      setSelectedSupervisorReportId(null);
      setPublicView('submit-report');
      setCleanerView('my-tasks');
      setSupervisorView('task-board');
      setAdminView('overview');
      setBusy(false);
      setAuthTab('staff-login');
    }
  }

  const shellClassName = ['shell', 'app-shell', user ? `${portalRole}-mode` : 'auth-mode'].join(' ');
  const activeSupervisorReport = selectedSupervisorReport || reports[0] || null;
  const activeSupervisorCleaner = activeSupervisorReport?.assignedToCleanerId
    ? cleanersById[activeSupervisorReport.assignedToCleanerId]
    : null;

  if (!user) {
    return (
      <div className={shellClassName}>
        <main className={authTab === 'public-status' ? 'auth-screen status-screen' : 'auth-screen'}>
          <section className="auth-brand-panel">
            <div className="auth-brand-noise" aria-hidden="true" />
            <div className="auth-brand-bar">
              <span className="auth-brand-mark">SpotFix</span>
              <LanguageSwitch language={language} onChange={setLanguage} ariaLabel={t('language.selector')} />
            </div>

            <div className="auth-brand-copy">
              <p className="kicker inverse">{t('auth.kicker')}</p>
              <h1>{t('auth.heading')}</h1>
              <p className="muted inverse auth-lead">{t('auth.lead')}</p>

              <div className="feature-grid auth-feature-grid">
                <AuthFeature title={t('auth.featurePublicTitle')} copy={t('auth.featurePublicCopy')} />
                <AuthFeature title={t('auth.featureStaffTitle')} copy={t('auth.featureStaffCopy')} />
                <AuthFeature title={t('auth.featureRoutingTitle')} copy={t('auth.featureRoutingCopy')} />
                <AuthFeature title={t('auth.featureAdminTitle')} copy={t('auth.featureAdminCopy')} />
              </div>
            </div>
          </section>

          <section className="auth-panel">
            <div className={authTab === 'public-status' ? 'card auth-card accent-card wide' : 'card auth-card accent-card'}>
              <div className="auth-card-head">
                <h2>
                  {authTab === 'register'
                    ? t('auth.registerTitle')
                    : authTab === 'master-login'
                      ? t('auth.masterTitle')
                      : authTab === 'public-status'
                        ? t('public.statusBoardTitle')
                      : t('auth.signInTitle')}
                </h2>
                <p className="muted">
                  {authTab === 'master-login'
                    ? t('auth.masterDescription')
                    : authTab === 'public-status'
                      ? t('public.statusBoardCopy')
                    : t('auth.defaultDescription')}
                </p>
              </div>

              <nav className="auth-tab-strip" aria-label={t('auth.tabsAria')}>
                <button className={authTab === 'staff-login' ? 'auth-tab active' : 'auth-tab'} type="button" onClick={() => setAuthTab('staff-login')}>{t('auth.staffLoginTab')}</button>
                <button className={authTab === 'reporter-login' ? 'auth-tab active' : 'auth-tab'} type="button" onClick={() => setAuthTab('reporter-login')}>{t('auth.reporterLoginTab')}</button>
                <button className={authTab === 'register' ? 'auth-tab active' : 'auth-tab'} type="button" onClick={() => setAuthTab('register')}>{t('auth.registerTab')}</button>
                <button className={authTab === 'master-login' ? 'auth-tab active' : 'auth-tab'} type="button" onClick={() => setAuthTab('master-login')}>{t('auth.masterLoginTab')}</button>
                <button className={authTab === 'public-status' ? 'auth-tab active' : 'auth-tab'} type="button" onClick={() => setAuthTab('public-status')}>{t('auth.publicStatusTab')}</button>
              </nav>

              {authTab === 'staff-login' && (
                <form onSubmit={handleUserLogin} className="stack auth-form">
                  <label>
                    {t('auth.staffIdentifier')}
                    <input required value={userLoginForm.identifier} onChange={(event) => setUserLoginForm((prev) => ({ ...prev, identifier: event.target.value }))} placeholder={t('auth.staffIdentifierPlaceholder')} />
                  </label>
                  <label>
                    {t('auth.password')}
                    <input required type="password" value={userLoginForm.password} onChange={(event) => setUserLoginForm((prev) => ({ ...prev, password: event.target.value }))} placeholder="••••••••" />
                  </label>
                  <button className="primary" disabled={busy}>{busy ? t('auth.working') : t('auth.enterStaffPortal')}</button>
                </form>
              )}

              {authTab === 'reporter-login' && (
                <>
                  <form onSubmit={handleUserLogin} className="stack auth-form">
                    <label>
                      {t('auth.reporterIdentifier')}
                      <input required value={userLoginForm.identifier} onChange={(event) => setUserLoginForm((prev) => ({ ...prev, identifier: event.target.value }))} placeholder={t('auth.reporterIdentifierPlaceholder')} />
                    </label>
                    <label>
                      {t('auth.password')}
                      <input required type="password" value={userLoginForm.password} onChange={(event) => setUserLoginForm((prev) => ({ ...prev, password: event.target.value }))} placeholder="••••••••" />
                    </label>
                    <button className="primary" disabled={busy}>{busy ? t('auth.working') : t('auth.enterPortal')}</button>
                  </form>

                  <div className="auth-separator" aria-hidden="true">
                    <span>{t('auth.or')}</span>
                  </div>

                  {GOOGLE_CLIENT_ID ? (
                    <div className="google-auth-block">
                      <div id="google-signin-button" />
                      {!googleReady && <p className="google-help">{t('auth.googleLoading')}</p>}
                    </div>
                  ) : (
                    <p className="google-help">{t('auth.googleUnavailable')}</p>
                  )}
                </>
              )}

              {authTab === 'register' && (
                <form onSubmit={handleRegister} className="stack auth-form">
                  <label>
                    {t('auth.fullName')}
                    <input required value={registerForm.name} onChange={(event) => setRegisterForm((prev) => ({ ...prev, name: event.target.value }))} />
                  </label>
                  <div className="field-grid">
                    <label>
                      {t('auth.email')}
                      <input required type="email" value={registerForm.email} onChange={(event) => setRegisterForm((prev) => ({ ...prev, email: event.target.value }))} />
                    </label>
                    <label>
                      {t('auth.idNumber')}
                      <input required value={registerForm.idNumber} onChange={(event) => setRegisterForm((prev) => ({ ...prev, idNumber: event.target.value }))} />
                    </label>
                  </div>
                  <div className="field-grid">
                    <label>
                      {t('auth.phone')}
                      <input required value={registerForm.phone} onChange={(event) => setRegisterForm((prev) => ({ ...prev, phone: event.target.value }))} />
                    </label>
                    <label>
                      {t('auth.password')}
                      <input required minLength={6} type="password" value={registerForm.password} onChange={(event) => setRegisterForm((prev) => ({ ...prev, password: event.target.value }))} />
                    </label>
                  </div>
                  <button className="primary" disabled={busy}>{busy ? t('auth.working') : t('auth.createAndSignIn')}</button>
                </form>
              )}

              {authTab === 'master-login' && (
                <form onSubmit={handleMasterLogin} className="stack auth-form">
                  <label>
                    {t('auth.username')}
                    <input required value={masterLoginForm.username} onChange={(event) => setMasterLoginForm((prev) => ({ ...prev, username: event.target.value }))} />
                  </label>
                  <label>
                    {t('auth.password')}
                    <input required type="password" value={masterLoginForm.password} onChange={(event) => setMasterLoginForm((prev) => ({ ...prev, password: event.target.value }))} />
                  </label>
                  <button className="primary" disabled={busy}>{busy ? t('auth.working') : t('auth.enterControlRoom')}</button>
                </form>
              )}

              {authTab === 'public-status' && (
                <PublicStatusBoard
                  board={publicStatusBoard}
                  busy={publicStatusBusy}
                  error={publicStatusError}
                  activeMetric={publicStatusMetric}
                  onMetricChange={setPublicStatusMetric}
                  onRefresh={() => loadPublicStatusPanel()}
                  language={language}
                  title={t('public.statusBoardTitle')}
                  copy={t('public.statusBoardCopy')}
                />
              )}
            </div>
          </section>
        </main>

        <PortalFooter language={language} muted />

        {toast && (
          <aside
            className={`toast ${toast.tone}`}
            role={toast.tone === 'error' ? 'alert' : 'status'}
            onAnimationEnd={() => setToast(null)}
          >
            <AppIcon name={TOAST_ICONS[toast.tone] || 'info'} />
            <span>{toast.text}</span>
          </aside>
        )}
      </div>
    );
  }

  return (
    <div className={shellClassName}>
      <header className={`topbar ${portalRole === 'admin' ? 'admin-topbar' : ''}`}>
        <div>
          <p className="kicker">SpotFix</p>
          <h1>
            {portalRole === 'admin'
              ? t('topbar.adminTitle')
              : portalRole === 'supervisor'
                ? t('topbar.supervisorTitle')
                : portalRole === 'cleaner'
                  ? t('topbar.cleanerTitle')
                  : t('topbar.publicTitle')}
          </h1>
          <p className="muted compact">
            {portalRole === 'public'
              ? t('topbar.publicCopy')
              : portalRole === 'supervisor'
                ? t('topbar.supervisorCopy')
                : portalRole === 'cleaner'
                  ? t('topbar.cleanerCopy')
                  : t('topbar.adminCopy')}
          </p>
        </div>

        <div className="topbar-actions">
          <LanguageSwitch compact language={language} onChange={setLanguage} ariaLabel={t('language.selector')} />
          <div className="identity">
            <AppIcon name="account_circle" className="identity-icon" />
            <div className="identity-copy">
              <span>{user.name}</span>
              <small>{roleLabel(user.role, language)}</small>
              {(user.role === 'supervisor' || user.role === 'cleaner') && (
                <small>{t('common.staffId')}: {user.idNumber || '-'}</small>
              )}
            </div>
          </div>
          <button className="ghost" onClick={handleLogout} disabled={busy}>
            <AppIcon name="logout" />
            {t('common.signOut')}
          </button>
        </div>
      </header>

      {portalRole === 'public' && (
        <main className="layout single-column portal-shell public-shell">
          <PortalHero
            eyebrow="SpotFix"
            title={t('public.greeting', { name: user.name.split(' ')[0] || user.name })}
            copy={t('public.heroCopy')}
            metrics={[
              { label: t('public.metricOpen'), value: publicOpenCount },
              { label: t('public.metricResolved'), value: reports.length - publicOpenCount },
              { label: t('public.metricTotal'), value: reports.length },
            ]}
            action={<span className="role-chip">{roleLabel(user.role, language)}</span>}
            accent="blue"
          />

          <PortalSectionNav
            activeView={publicView}
            onChange={setPublicView}
            ariaLabel={t('common.portalSections')}
            items={[
              { id: 'submit-report', label: t('public.navSubmit') },
              { id: 'status-board', label: t('public.navStatus') },
              { id: 'my-reports', label: t('public.navMyReports') },
            ]}
          />

          {publicView === 'submit-report' && (
            <section className="card public-form-panel">
              <h2>{t('public.submitTitle')}</h2>
              <p className="muted">{t('public.submitCopy')}</p>
              <form onSubmit={handleSubmitReport} className="stack">
                <div className="field-grid">
                  <label>
                    {t('public.category')}
                    <select value={reportForm.category} onChange={(event) => setReportForm((prev) => ({ ...prev, category: event.target.value }))}>
                      <option value="Litter">{categoryLabel('Litter', language)}</option>
                      <option value="Spill">{categoryLabel('Spill', language)}</option>
                      <option value="Restroom">{categoryLabel('Restroom', language)}</option>
                      <option value="Floor">{categoryLabel('Floor', language)}</option>
                      <option value="Damage">{categoryLabel('Damage', language)}</option>
                    </select>
                  </label>
                  <label>
                    {t('public.priority')}
                    <select value={reportForm.priority} onChange={(event) => setReportForm((prev) => ({ ...prev, priority: event.target.value }))}>
                      <option value="Low">{priorityLabel('Low', language)}</option>
                      <option value="Medium">{priorityLabel('Medium', language)}</option>
                      <option value="High">{priorityLabel('High', language)}</option>
                      <option value="Critical">{priorityLabel('Critical', language)}</option>
                    </select>
                  </label>
                </div>

                <label>
                  {t('public.location')}
                  <input required value={reportForm.location} onChange={(event) => setReportForm((prev) => ({ ...prev, location: event.target.value }))} placeholder={t('public.locationPlaceholder')} />
                </label>

                <div className="stack map-picker-wrap">
                  <div className="row-between map-picker-header">
                    <label className="map-label" htmlFor="map-picker">{t('public.mapLabel')}</label>
                    <button type="button" className="ghost small" onClick={handleUseCurrentLocation} disabled={locating || busy}>
                      <AppIcon name="my_location" />
                      {locating ? t('public.locating') : t('public.useCurrentLocation')}
                    </button>
                  </div>
                  <div
                    id="map-picker"
                    className={`map-picker${mapInteractive ? ' is-active' : ''}`}
                    role="application"
                    aria-label={t('public.mapPickerAria')}
                  >
                    <MapContainer
                      center={mapCenter}
                      zoom={17}
                      scrollWheelZoom={mapInteractive}
                      dragging={mapInteractive}
                      touchZoom={mapInteractive}
                      doubleClickZoom={mapInteractive}
                      className="leaflet-map"
                    >
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <RecenterMap center={mapCenter} />
                      <LocationMapEvents onPick={handleMapPick} />
                      {reportForm.coordinates && (
                        <CircleMarker
                          center={[reportForm.coordinates.lat, reportForm.coordinates.lng]}
                          radius={9}
                          pathOptions={{ color: '#0050cb', fillColor: '#0066ff', fillOpacity: 0.35, weight: 2 }}
                        />
                      )}
                    </MapContainer>
                    {!mapInteractive && (
                      <button
                        type="button"
                        className="map-interaction-overlay"
                        onClick={() => setMapInteractive(true)}
                      >
                        <span>
                          <AppIcon name="touch_app" />
                          {t('public.mapInteractTap')}
                        </span>
                      </button>
                    )}
                  </div>
                  {mapInteractive && (
                    <div className="map-lock-row">
                      <button type="button" className="ghost small" onClick={() => setMapInteractive(false)}>
                        <AppIcon name="lock" />
                        {t('public.mapInteractLock')}
                      </button>
                    </div>
                  )}
                  <p className="map-coordinates">{t('public.selectedCoordinates', { coords: formatCoordinates(reportForm.coordinates, language) })}</p>
                </div>

                <label>
                  {t('public.details')}
                  <textarea required rows={4} value={reportForm.details} onChange={(event) => setReportForm((prev) => ({ ...prev, details: event.target.value }))} placeholder={t('public.detailsPlaceholder')} />
                </label>

                <label>
                  {t('public.reporterPhone')}
                  <input value={reportForm.reporterPhone} onChange={(event) => setReportForm((prev) => ({ ...prev, reporterPhone: event.target.value }))} />
                </label>

                <div className="stack">
                  <div className="photo-input-block">
                    <span className="photo-input-label">{t('public.photos')}</span>
                    <div className="photo-input-actions">
                      <label className="ghost small photo-input-button">
                        <AppIcon name="photo_camera" />
                        <span>{t('public.takePhoto')}</span>
                        <input type="file" accept="image/*" capture="environment" onChange={handlePhotoSelect} />
                      </label>
                      <label className="ghost small photo-input-button">
                        <AppIcon name="photo_library" />
                        <span>{t('public.chooseFromGallery')}</span>
                        <input type="file" accept="image/*" multiple onChange={handlePhotoSelect} />
                      </label>
                    </div>
                  </div>
                  {photoPreviews.length > 0 ? (
                    <div className="photo-preview-wrap">
                      <div className="photo-preview-grid">
                        {photoPreviews.map((preview, index) => (
                          <div className="photo-preview-card" key={`preview-${index}`}>
                            <img className="photo-preview" src={preview} alt={t('public.selectedEvidenceAlt', { index: index + 1 })} />
                            <button type="button" className="ghost small" onClick={() => removeSelectedPhoto(index)}>
                              <AppIcon name="delete" />
                              {t('public.removePhoto')}
                            </button>
                          </div>
                        ))}
                      </div>
                      <button type="button" className="ghost small" onClick={clearSelectedPhotos}>{t('public.clearPhotos')}</button>
                    </div>
                  ) : null}
                </div>

                <div className="mini-note">
                  <strong>{t('public.noteTitle')}</strong>
                  <span>{t('public.noteCopy')}</span>
                </div>

                <button className="primary" disabled={busy}>{busy ? t('public.submitting') : t('public.submitButton')}</button>
              </form>
            </section>
          )}

          {publicView === 'status-board' && (
            <PublicStatusBoard
              board={publicStatusBoard}
              busy={publicStatusBusy}
              error={publicStatusError}
              activeMetric={publicStatusMetric}
              onMetricChange={setPublicStatusMetric}
              onRefresh={() => loadPublicStatusPanel()}
              language={language}
              title={t('public.statusBoardTitle')}
              copy={t('public.statusBoardCopy')}
            />
          )}

          {publicView === 'my-reports' && (
            <section className="card tall">
              <div className="row-between">
                <div>
                  <h2>{t('public.myReportsTitle')}</h2>
                  <p className="muted">{t('public.myReportsCopy')}</p>
                </div>
                <button className="ghost" onClick={() => loadPortalData()} disabled={busy}>
                  <AppIcon name="refresh" />
                  {t('common.refresh')}
                </button>
              </div>
              <div className="report-list">
                {reports.length === 0 && <EmptyState title={t('public.myReportsEmptyTitle')} copy={t('public.myReportsEmptyCopy')} />}
                {reports.map((report) => <ReportRow key={report._id || report.id} report={report} language={language} />)}
              </div>
            </section>
          )}

          <PortalFooter language={language} />
        </main>
      )}

      {portalRole === 'supervisor' && (
        <div className="workspace-frame supervisor-frame">
          <aside className="portal-rail">
            <div className="portal-rail-head">
              <h2>{t('supervisor.railTitle')}</h2>
              <p>{t('supervisor.railSubtitle')}</p>
            </div>
            <button type="button" className={supervisorView === 'task-board' ? 'portal-rail-link active' : 'portal-rail-link'} onClick={() => setSupervisorView('task-board')}>
              <AppIcon name="assignment" />
              <span>{t('supervisor.railTaskBoard')}</span>
            </button>
            <button type="button" className={supervisorView === 'workforce' ? 'portal-rail-link active' : 'portal-rail-link'} onClick={() => setSupervisorView('workforce')}>
              <AppIcon name="group" />
              <span>{t('supervisor.railRoster')}</span>
            </button>
            <button type="button" className={supervisorView === 'onboard-cleaner' ? 'portal-rail-link active' : 'portal-rail-link'} onClick={() => setSupervisorView('onboard-cleaner')}>
              <AppIcon name="manage_accounts" />
              <span>{t('supervisor.railStaff')}</span>
            </button>
          </aside>

          <main className="layout single-column supervisor-shell">
            <PortalHero
              eyebrow={t('supervisor.heroEyebrow')}
              title={t('supervisor.heroTitle')}
              copy={t('supervisor.heroCopy')}
              metrics={[
                { label: t('supervisor.metricPending'), value: adminMetrics.pending },
                { label: t('supervisor.metricUrgent'), value: adminMetrics.urgent },
                { label: t('supervisor.metricCleaners'), value: cleaners.length },
              ]}
              action={<button className="ghost" onClick={() => loadPortalData()} disabled={busy}><AppIcon name="refresh" />{t('supervisor.refreshBoard')}</button>}
              accent="teal"
            />

            <PortalSectionNav
              activeView={supervisorView}
              onChange={setSupervisorView}
              ariaLabel={t('common.portalSections')}
              items={[
                { id: 'task-board', label: t('supervisor.navTaskBoard') },
                { id: 'workforce', label: t('supervisor.navWorkforce') },
                { id: 'onboard-cleaner', label: t('supervisor.navOnboard') },
              ]}
            />

            {supervisorView === 'task-board' && (
              <section className="card tall supervisor-panel">
                <div className="row-between">
                  <div>
                    <h2>{t('supervisor.taskBoardTitle')}</h2>
                    <p className="muted">{t('supervisor.taskBoardCopy')}</p>
                  </div>
                  <button className="ghost" onClick={() => loadPortalData()} disabled={busy}>
                    <AppIcon name="refresh" />
                    {t('common.refresh')}
                  </button>
                </div>

                <div className="inline-actions wrap-actions">
                  <label>
                    {t('supervisor.cleanerLocationFilter')}
                    <select value={supervisorCleanerLocation} onChange={(event) => setSupervisorCleanerLocation(event.target.value)}>
                      <option value="">{t('supervisor.allLocations')}</option>
                      {cleanerLocations.map((location) => (
                        <option key={location} value={location}>{location}</option>
                      ))}
                    </select>
                  </label>
                  <div className="mini-note compact-note">
                    <strong>{t('common.staffId')}</strong>
                    <span>{user.idNumber || '-'}</span>
                  </div>
                </div>

                <div className="task-board-layout">
                  <div className="report-list wide-list board-list">
                    {reports.length === 0 && <EmptyState title={t('supervisor.noReportsTitle')} copy={t('supervisor.noReportsCopy')} />}
                    {reports.map((report) => (
                      <ReportRow
                        key={report._id || report.id}
                        report={report}
                        language={language}
                        onClick={() => setSelectedSupervisorReportId(report.id || report._id)}
                        selected={(report.id || report._id) === (activeSupervisorReport?.id || activeSupervisorReport?._id)}
                      >
                        {report.status !== 'Resolved' && visibleSupervisorCleaners.length > 0 && (
                          <div className="inline-actions">
                            <select defaultValue="" onChange={(event) => {
                              if (event.target.value) handleAssign(event.target.value, report.id || report._id);
                              event.target.value = '';
                            }}>
                              <option value="">{t('supervisor.selectCleaner')}</option>
                              {visibleSupervisorCleaners.map((cleaner) => (
                                <option key={cleaner._id} value={cleaner._id}>{cleaner.name} • {cleaner.workLocation || '-'} • {workforceStatusLabel(cleaner.status, language)}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </ReportRow>
                    ))}
                  </div>

                  <SupervisorTaskDetailPanel
                    report={activeSupervisorReport}
                    cleaner={activeSupervisorCleaner}
                    language={language}
                    onBack={selectedSupervisorReportId ? () => setSelectedSupervisorReportId(null) : undefined}
                  />
                </div>
              </section>
            )}

            {supervisorView === 'workforce' && (
              <section className="card tall supervisor-panel">
                <h2>{t('supervisor.workforceTitle')}</h2>
                <p className="muted">{t('supervisor.workforceCopy')}</p>
                <div className="report-list">
                  {cleaners.map((cleaner) => (
                    <article key={cleaner._id} className="report-item">
                      <header>
                        <h3>{cleaner.name}</h3>
                        <span className={`pill ${cleaner.status === 'Busy' ? 'warn' : 'good'}`}>{workforceStatusLabel(cleaner.status, language)}</span>
                      </header>
                      <p>{t('common.staffId')}: {cleaner.workId || '-'}</p>
                      <p>{t('supervisor.workLocation')}: {cleaner.workLocation || '-'}</p>
                      <p>{t('supervisor.phone')}: {cleaner.phone || '-'}</p>
                    </article>
                  ))}
                  {cleaners.length === 0 && <EmptyState title={t('supervisor.workforceEmptyTitle')} copy={t('supervisor.workforceEmptyCopy')} />}
                </div>
              </section>
            )}

            {supervisorView === 'onboard-cleaner' && (
              <section className="card supervisor-panel">
                <h2>{t('supervisor.onboardTitle')}</h2>
                <p className="muted">{t('supervisor.onboardCopy')}</p>
                <form onSubmit={handleProvisionStaff} className="stack">
                  <div className="field-grid">
                    <label>
                      {t('supervisor.fullName')}
                      <input required value={staffProvisionForm.name} onChange={(event) => setStaffProvisionForm((prev) => ({ ...prev, name: event.target.value }))} />
                    </label>
                    <label>
                      {t('supervisor.workId')}
                      <input required value={staffProvisionForm.workId} onChange={(event) => setStaffProvisionForm((prev) => ({ ...prev, workId: event.target.value }))} />
                    </label>
                  </div>
                  <div className="field-grid">
                    <label>
                      {t('supervisor.loginId')}
                      <input required value={staffProvisionForm.idNumber} onChange={(event) => setStaffProvisionForm((prev) => ({ ...prev, idNumber: event.target.value }))} />
                    </label>
                    <label>
                      {t('supervisor.phone')}
                      <input required value={staffProvisionForm.phone} onChange={(event) => setStaffProvisionForm((prev) => ({ ...prev, phone: event.target.value }))} />
                    </label>
                  </div>
                  <label>
                    {t('supervisor.workLocation')}
                    <input required value={staffProvisionForm.workLocation} onChange={(event) => setStaffProvisionForm((prev) => ({ ...prev, workLocation: event.target.value }))} placeholder="SOC" />
                  </label>
                  <label>
                    {t('supervisor.emailOptional')}
                    <input type="email" value={staffProvisionForm.email} onChange={(event) => setStaffProvisionForm((prev) => ({ ...prev, email: event.target.value }))} />
                  </label>
                  <label>
                    {t('supervisor.tempPassword')}
                    <input required minLength={6} type="password" value={staffProvisionForm.password} onChange={(event) => setStaffProvisionForm((prev) => ({ ...prev, password: event.target.value }))} />
                  </label>
                  <button className="primary" disabled={busy}>{busy ? t('supervisor.creating') : t('supervisor.createCleanerAccount')}</button>
                </form>
              </section>
            )}
          </main>
        </div>
      )}

      {portalRole === 'cleaner' && (
        <main className="layout single-column portal-shell cleaner-shell">
          <PortalHero
            eyebrow={t('cleaner.eyebrow')}
            title={t('cleaner.heroTitle')}
            copy={t('cleaner.heroCopy')}
            metrics={[
              { label: t('cleaner.metricAssigned'), value: cleanerReports.length },
              { label: t('cleaner.metricResolved'), value: cleanerReports.filter((report) => report.status === 'Resolved').length },
              { label: t('cleaner.metricActive'), value: cleanerReports.filter((report) => report.status !== 'Resolved').length },
            ]}
            action={<span className="role-chip">{roleLabel(user.role, language)}</span>}
            accent="gold"
          />

          <PortalSectionNav
            activeView={cleanerView}
            onChange={setCleanerView}
            ariaLabel={t('common.portalSections')}
            items={[
              { id: 'my-tasks', label: t('cleaner.navTasks') },
              { id: 'account', label: t('cleaner.navAccount') },
            ]}
          />

          {cleanerView === 'account' && (
            <section className="card">
              <h2>{t('cleaner.accountTitle')}</h2>
              <p className="muted">{t('common.staffId')}: {user.idNumber || '-'}</p>
              <p className="muted">{t('cleaner.workLocation')}: {user.workLocation || '-'}</p>
            </section>
          )}

          {cleanerView === 'my-tasks' && (
            <section className="card tall">
              <div className="row-between">
                <div>
                  <h2>{t('cleaner.tasksTitle')}</h2>
                  <p className="muted">{t('cleaner.tasksCopy')}</p>
                </div>
                <button className="ghost" onClick={() => loadPortalData()} disabled={busy}>
                  <AppIcon name="refresh" />
                  {t('common.refresh')}
                </button>
              </div>
              <div className="report-list wide-list">
                {cleanerReports.length === 0 && <EmptyState title={t('cleaner.tasksEmptyTitle')} copy={t('cleaner.tasksEmptyCopy')} />}
                {cleanerReports.map((report) => (
                  <ReportRow key={report._id || report.id} report={report} language={language}>
                    {report.status !== 'Resolved' && (
                      <div className="inline-actions resolution-actions">
                        {report.status === 'Reported' ? (
                          <button className="ghost small" disabled={busy} onClick={() => handleStartTask(report.id || report._id)}>
                            <AppIcon name="cleaning_services" />
                            {t('cleaner.startTask')}
                          </button>
                        ) : (
                          <>
                            <label className="resolution-upload">
                              <AppIcon name="photo_camera" />
                              <span>{t('cleaner.takePhoto')}</span>
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={(event) => handleResolutionEvidenceSelect(report.id || report._id, event)}
                              />
                            </label>
                            <label className="resolution-upload">
                              <AppIcon name="photo_library" />
                              <span>{resolutionEvidenceByReport[report.id || report._id] ? t('cleaner.replacePhoto') : t('cleaner.chooseFromGallery')}</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(event) => handleResolutionEvidenceSelect(report.id || report._id, event)}
                              />
                            </label>
                            {resolutionEvidenceByReport[report.id || report._id] ? (
                              <img className="report-photo-thumb" src={resolutionEvidenceByReport[report.id || report._id]} alt={t('cleaner.resolutionPreviewAlt')} />
                            ) : null}
                            <button className="primary small" disabled={busy} onClick={() => handleResolve(report.id || report._id)}>
                              {t('cleaner.markResolved')}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </ReportRow>
                ))}
              </div>
            </section>
          )}
        </main>
      )}

      {portalRole === 'admin' && (
        <div className="workspace-frame admin-frame">
          <aside className="portal-rail admin-rail">
            <div className="portal-rail-head">
              <h2>{t('admin.railTitle')}</h2>
              <p>{t('admin.railSubtitle')}</p>
            </div>
            <button type="button" className={adminView === 'overview' ? 'portal-rail-link active' : 'portal-rail-link'} onClick={() => setAdminView('overview')}>
              <AppIcon name="dashboard" />
              <span>{t('admin.railControlCenter')}</span>
            </button>
            <button type="button" className={adminView === 'registry' ? 'portal-rail-link active' : 'portal-rail-link'} onClick={() => setAdminView('registry')}>
              <AppIcon name="badge" />
              <span>{t('admin.railIdentity')}</span>
            </button>
            <button type="button" className={adminView === 'onboard' ? 'portal-rail-link active' : 'portal-rail-link'} onClick={() => setAdminView('onboard')}>
              <AppIcon name="manage_accounts" />
              <span>{t('admin.onboardTitle')}</span>
            </button>
          </aside>

          <main className="layout single-column admin-shell">
            <PortalHero
              eyebrow={t('admin.heroEyebrow')}
              title={t('admin.heroTitle')}
              copy={t('admin.heroCopy')}
              metrics={[
                { label: t('admin.metricReports'), value: reports.length },
                { label: t('admin.metricResolved'), value: adminMetrics.resolved },
                { label: t('admin.metricUsers'), value: users.length },
              ]}
              action={<button className="ghost" onClick={() => loadPortalData()} disabled={busy}><AppIcon name="refresh" />{t('admin.refreshControlRoom')}</button>}
              accent="plum"
            />

            <PortalSectionNav
              activeView={adminView}
              onChange={setAdminView}
              ariaLabel={t('common.portalSections')}
              items={[
                { id: 'overview', label: t('admin.railControlCenter') },
                { id: 'registry', label: t('admin.railIdentity') },
                { id: 'onboard', label: t('admin.onboardTitle') },
              ]}
            />

            {adminView === 'overview' && (
            <section className="card tall">
              <div className="row-between">
                <div>
                  <h2>{t('admin.overviewTitle')}</h2>
                  <p className="muted">{t('admin.overviewCopy')}</p>
                </div>
                <button className="ghost" onClick={() => loadPortalData()} disabled={busy}>
                  <AppIcon name="refresh" />
                  {t('common.refresh')}
                </button>
              </div>
              {reports.length === 0 ? (
                <EmptyState title={t('admin.noReportsTitle')} copy={t('admin.noReportsCopy')} />
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>{t('admin.tableId')}</th>
                        <th>{t('admin.tableCategory')}</th>
                        <th>{t('admin.tableLocation')}</th>
                        <th>{t('admin.tableStatus')}</th>
                        <th>{t('admin.tableDate')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reports.slice(0, 12).map((report) => (
                        <tr key={report._id || report.id}>
                          <td>{report.id || report._id}</td>
                          <td>{categoryLabel(report.category || 'General', language)}</td>
                          <td>{report.location || '-'}</td>
                          <td>
                            <span className={`pill ${statusTone(report.status)}`}>{statusLabel(report.status || 'Reported', language)}</span>
                          </td>
                          <td>{prettyDateShort(report.timestamp || report.createdAt || report.updatedAt, language)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            )}

            {adminView === 'registry' && (
            <section className="card tall">
              <h2>{t('admin.registryTitle')}</h2>
              <p className="muted">{t('admin.registryCopy')}</p>
              <div className="report-list">
                {users.map((entry) => (
                  <article key={entry._id} className="report-item">
                    <header>
                      <h3>{entry.name}</h3>
                      <span className="pill neutral">{roleLabel(entry.role, language)}</span>
                    </header>
                    <p>{t('admin.registryId')}: {entry.idNumber || '-'}</p>
                    <p>{t('admin.registryLocation')}: {entry.workLocation || '-'}</p>
                    <p>{t('admin.registryEmail')}: {entry.email || '-'}</p>
                    <p>{t('admin.registryStatus')}: {accountStatusLabel(entry.status, language)}</p>
                  </article>
                ))}
                {users.length === 0 && <EmptyState title={t('admin.registryEmptyTitle')} copy={t('admin.registryEmptyCopy')} />}
              </div>
            </section>
            )}

            {adminView === 'onboard' && (
            <section className="card">
              <h2>{t('admin.onboardTitle')}</h2>
              <p className="muted">{t('admin.onboardCopy')}</p>
              {staffProvisionForm.role === 'cleaner' && supervisorUsers.length === 0 && (
                <div className="mini-note">
                  <strong>{t('admin.supervisorRequiredTitle')}</strong>
                  <span>{t('admin.supervisorRequiredCopy')}</span>
                </div>
              )}
              <form onSubmit={handleProvisionStaff} className="stack">
                <div className="field-grid">
                  <label>
                    {t('admin.fullName')}
                    <input required value={staffProvisionForm.name} onChange={(event) => setStaffProvisionForm((prev) => ({ ...prev, name: event.target.value }))} />
                  </label>
                  <label>
                    {t('admin.role')}
                    <select value={staffProvisionForm.role} onChange={(event) => setStaffProvisionForm((prev) => ({ ...prev, role: event.target.value }))}>
                      <option value="cleaner">{roleLabel('cleaner', language)}</option>
                      <option value="supervisor">{roleLabel('supervisor', language)}</option>
                    </select>
                  </label>
                </div>
                {staffProvisionForm.role === 'cleaner' && (
                  <>
                    <label>
                      {t('admin.workId')}
                      <input required value={staffProvisionForm.workId} onChange={(event) => setStaffProvisionForm((prev) => ({ ...prev, workId: event.target.value }))} />
                    </label>
                    <label>
                      {t('admin.supervisor')}
                      <select value={staffProvisionForm.supervisorId} onChange={(event) => setStaffProvisionForm((prev) => ({ ...prev, supervisorId: event.target.value }))}>
                        <option value="">{t('admin.selectSupervisor')}</option>
                        {supervisorUsers.map((entry) => (
                          <option key={entry._id} value={entry._id}>{entry.name} • {entry.idNumber}</option>
                        ))}
                      </select>
                    </label>
                  </>
                )}
                <div className="field-grid">
                  <label>
                    {t('admin.loginId')}
                    <input required value={staffProvisionForm.idNumber} onChange={(event) => setStaffProvisionForm((prev) => ({ ...prev, idNumber: event.target.value }))} />
                  </label>
                  <label>
                    {t('admin.phone')}
                    <input required value={staffProvisionForm.phone} onChange={(event) => setStaffProvisionForm((prev) => ({ ...prev, phone: event.target.value }))} />
                  </label>
                </div>
                <label>
                  {t('admin.workLocation')}
                  <input required value={staffProvisionForm.workLocation} onChange={(event) => setStaffProvisionForm((prev) => ({ ...prev, workLocation: event.target.value }))} placeholder="SOC" />
                </label>
                <label>
                  {t('admin.emailOptional')}
                  <input type="email" value={staffProvisionForm.email} onChange={(event) => setStaffProvisionForm((prev) => ({ ...prev, email: event.target.value }))} />
                </label>
                <label>
                  {t('admin.tempPassword')}
                  <input required minLength={6} type="password" value={staffProvisionForm.password} onChange={(event) => setStaffProvisionForm((prev) => ({ ...prev, password: event.target.value }))} />
                </label>
                <button className="primary" disabled={busy || (staffProvisionForm.role === 'cleaner' && supervisorUsers.length === 0)}>{busy ? t('admin.creating') : t('admin.createRoleAccount', { role: roleLabel(staffProvisionForm.role, language) })}</button>
              </form>
            </section>
            )}
          </main>
        </div>
      )}

      {toast && (
        <aside
          className={`toast ${toast.tone}`}
          role={toast.tone === 'error' ? 'alert' : 'status'}
          onAnimationEnd={() => setToast(null)}
        >
          <AppIcon name={TOAST_ICONS[toast.tone] || 'info'} />
          <span>{toast.text}</span>
        </aside>
      )}
    </div>
  );
}

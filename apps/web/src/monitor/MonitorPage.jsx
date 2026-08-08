import { useEffect, useMemo, useState } from 'react';
import { CircleMarker, MapContainer, Polygon, Popup, TileLayer, Tooltip } from 'react-leaflet';
import { fetchMonitorOrgs, fetchOrgOverview, fetchOrgReports } from '../lib/monitorApi.js';

// Portal palette (styles.css tokens) as concrete hexes — Leaflet writes these
// into SVG attributes, where CSS variables don't resolve. Semantics mirror the
// portal pills: new = red, assigned = blue, in progress = orange, done = green.
const STATUS_COLORS = {
  submitted: '#ba1a1a',
  assigned: '#0066ff',
  accepted_by_cleaner: '#0050cb',
  in_progress: '#a33200',
  resolved_by_cleaner: '#006a6a',
  endorsed_by_supervisor: '#006e2d',
  closed: '#0b1320',
  rejected_by_cleaner: '#5d2b89',
  rejected_by_supervisor: '#5d2b89',
  cancelled: '#727687',
};

const STATUS_LABELS = {
  submitted: 'Submitted',
  assigned: 'Assigned',
  accepted_by_cleaner: 'Accepted',
  in_progress: 'In progress',
  resolved_by_cleaner: 'Awaiting review',
  endorsed_by_supervisor: 'Endorsed',
  closed: 'Closed',
  rejected_by_cleaner: 'Rejected (cleaner)',
  rejected_by_supervisor: 'Rejected (supervisor)',
  cancelled: 'Cancelled',
};

// Shares the portal design system: styles.css is loaded globally, so its
// tokens (fonts, surfaces, radii, shadows) apply here via var().
const styles = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg)',
    fontFamily: 'var(--font-sans)',
    color: 'var(--text)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '18px 28px',
    background: 'var(--surface)',
    borderBottom: '1px solid var(--surface-stroke)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 20,
    padding: 28,
  },
  card: {
    background: 'var(--surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--surface-stroke)',
    padding: 22,
    cursor: 'pointer',
    boxShadow: 'var(--shadow-1)',
    transition: 'transform 0.12s ease, box-shadow 0.12s ease',
  },
  statRow: { display: 'flex', gap: 14, marginTop: 14, flexWrap: 'wrap' },
  stat: { display: 'flex', flexDirection: 'column', minWidth: 70 },
  statValue: { fontSize: 22, fontWeight: 700 },
  statLabel: { fontSize: 12, color: 'var(--text-muted)' },
  detailLayout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.4fr) minmax(320px, 1fr)',
    gap: 20,
    padding: 28,
    alignItems: 'start',
  },
  panel: {
    background: 'var(--surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--surface-stroke)',
    overflow: 'hidden',
  },
  chip: (active, color) => ({
    padding: '5px 12px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    border: `1px solid ${active ? color : 'var(--surface-stroke)'}`,
    background: active ? color : 'var(--surface)',
    color: active ? '#ffffff' : 'var(--text-soft)',
    cursor: 'pointer',
  }),
  reportRow: {
    padding: '12px 16px',
    borderTop: '1px solid var(--surface-mid)',
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  badge: (color) => ({
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    color: '#ffffff',
    background: color,
    whiteSpace: 'nowrap',
  }),
  button: {
    padding: '8px 16px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--surface-stroke)',
    background: 'var(--surface)',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--text)',
  },
};

function statusColor(status) {
  return STATUS_COLORS[status] || '#727687';
}

function statusLabel(status) {
  return STATUS_LABELS[status] || status;
}

function OrgCard({ org, onOpen }) {
  return (
    <div
      style={styles.card}
      onClick={() => onOpen(org.slug)}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(org.slug)}
      role="button"
      tabIndex={0}
    >
      <div style={{ fontSize: 18, fontWeight: 700 }}>{org.name}</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
        {org.display_name || 'No campus profile configured'}
      </div>
      <div style={styles.statRow}>
        <div style={styles.stat}>
          <span style={styles.statValue}>{org.stats.total}</span>
          <span style={styles.statLabel}>Total reports</span>
        </div>
        <div style={styles.stat}>
          <span style={{ ...styles.statValue, color: '#a33200' }}>{org.stats.open}</span>
          <span style={styles.statLabel}>Open</span>
        </div>
        <div style={styles.stat}>
          <span style={{ ...styles.statValue, color: '#006a6a' }}>{org.stats.awaiting_review}</span>
          <span style={styles.statLabel}>Awaiting review</span>
        </div>
        <div style={styles.stat}>
          <span style={{ ...styles.statValue, color: '#006e2d' }}>{org.stats.resolved}</span>
          <span style={styles.statLabel}>Resolved</span>
        </div>
      </div>
      <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
        {org.stats.resolved_last_7_days} resolved in the last 7 days
      </div>
    </div>
  );
}

function OrgDetail({ slug, onBack }) {
  const [overview, setOverview] = useState(null);
  const [reports, setReports] = useState([]);
  const [statusFilter, setStatusFilter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedReportId, setSelectedReportId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([fetchOrgOverview(slug), fetchOrgReports(slug, { status: statusFilter || undefined })])
      .then(([ov, rep]) => {
        if (cancelled) return;
        setOverview(ov);
        setReports(rep.reports || []);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, statusFilter]);

  const boundaryLatLngs = useMemo(() => {
    const ring = overview?.boundary;
    if (!Array.isArray(ring)) return [];
    return ring
      .filter((p) => Array.isArray(p) && p.length >= 2)
      .map(([lng, lat]) => [lat, lng]);
  }, [overview]);

  const mappableReports = reports.filter(
    (r) => typeof r.location_lat === 'number' && typeof r.location_lng === 'number'
  );

  const center = overview?.org?.center_lat != null
    ? [overview.org.center_lat, overview.org.center_lng]
    : [6.4631, 100.5068];
  const zoom = overview?.org?.default_zoom || 15;

  const summary = overview?.status_summary || {};
  const filterChips = Object.keys(STATUS_LABELS).filter((s) => (summary[s] || 0) > 0);

  return (
    <div>
      <div style={{ padding: '18px 28px 0', display: 'flex', gap: 12, alignItems: 'center' }}>
        <button type="button" style={styles.button} onClick={onBack}>
          ← Organizations
        </button>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            {overview?.org?.display_name || overview?.org?.name || slug}
          </div>
          {overview?.org && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {overview.org.stats.total} reports · {overview.org.stats.open} open ·{' '}
              {overview.org.stats.resolved} resolved
            </div>
          )}
        </div>
      </div>

      {error && (
        <div style={{ margin: '16px 28px', padding: 14, borderRadius: 10, background: 'rgba(186, 26, 26, 0.08)', color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      <div style={styles.detailLayout}>
        <div style={{ ...styles.panel, height: 520 }}>
          <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {boundaryLatLngs.length >= 3 && (
              <Polygon
                positions={boundaryLatLngs}
                pathOptions={{ color: '#0066ff', weight: 2, fillOpacity: 0.05, dashArray: '6 6' }}
              />
            )}
            {(overview?.landmarks || []).map((lm) => (
              <CircleMarker
                key={`lm-${lm.name}`}
                center={[lm.lat, lm.lng]}
                radius={5}
                pathOptions={{ color: '#727687', fillColor: '#c2c6d8', fillOpacity: 0.9, weight: 1 }}
              >
                <Tooltip direction="top">{lm.name}</Tooltip>
              </CircleMarker>
            ))}
            {mappableReports.map((report) => (
              <CircleMarker
                key={report.id}
                center={[report.location_lat, report.location_lng]}
                radius={selectedReportId === report.id ? 12 : 8}
                pathOptions={{
                  color: '#ffffff',
                  weight: 2,
                  fillColor: statusColor(report.status),
                  fillOpacity: 0.95,
                }}
                eventHandlers={{ click: () => setSelectedReportId(report.id) }}
              >
                <Popup>
                  <strong>{report.title}</strong>
                  <br />
                  <span style={styles.badge(statusColor(report.status))}>{statusLabel(report.status)}</span>
                  <br />
                  {report.location_address || 'No address'}
                  <br />
                  <small>{new Date(report.created_at).toLocaleString()}</small>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>

        <div style={styles.panel}>
          <div style={{ padding: 16, borderBottom: '1px solid #eef1f7' }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>
              Reports {loading ? '· loading…' : `(${reports.length})`}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" style={styles.chip(!statusFilter, '#141b2b')} onClick={() => setStatusFilter(null)}>
                All
              </button>
              {filterChips.map((s) => (
                <button
                  key={s}
                  type="button"
                  style={styles.chip(statusFilter === s, statusColor(s))}
                  onClick={() => setStatusFilter(statusFilter === s ? null : s)}
                >
                  {statusLabel(s)} ({summary[s]})
                </button>
              ))}
            </div>
          </div>
          <div style={{ maxHeight: 430, overflowY: 'auto' }}>
            {reports.length === 0 && !loading && (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                No reports for this filter.
              </div>
            )}
            {reports.map((report) => (
              <div
                key={report.id}
                style={{
                  ...styles.reportRow,
                  background: selectedReportId === report.id ? 'var(--surface-mid)' : 'transparent',
                  cursor: 'pointer',
                }}
                onClick={() => setSelectedReportId(report.id)}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {report.title}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {report.location_address || 'No address'} · {new Date(report.created_at).toLocaleDateString()}
                  </div>
                </div>
                <span style={styles.badge(statusColor(report.status))}>{statusLabel(report.status)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MonitorPage() {
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSlug, setSelectedSlug] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchMonitorOrgs()
      .then((data) => {
        if (cancelled) return;
        setOrgs(data.orgs || []);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>SpotFix Monitoring</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Live overview of every organization using the system
          </div>
        </div>
        <a href="#/" style={{ ...styles.button, textDecoration: 'none' }}>
          Open portal
        </a>
      </header>

      {selectedSlug ? (
        <OrgDetail slug={selectedSlug} onBack={() => setSelectedSlug(null)} />
      ) : (
        <>
          {error && (
            <div style={{ margin: '20px 28px', padding: 14, borderRadius: 10, background: 'rgba(186, 26, 26, 0.08)', color: 'var(--danger)' }}>
              {error}
            </div>
          )}
          {loading && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading organizations…</div>
          )}
          <div style={styles.grid}>
            {orgs.map((org) => (
              <OrgCard key={org.slug} org={org} onOpen={setSelectedSlug} />
            ))}
          </div>
          {!loading && orgs.length === 0 && !error && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              No organizations found.
            </div>
          )}
        </>
      )}
    </div>
  );
}

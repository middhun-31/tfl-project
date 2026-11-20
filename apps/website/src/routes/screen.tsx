import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, type CSSProperties } from 'react';

import {
    connectTflSync,
    formatWindowStart,
    stationMetrics,
    useTflStore,
    type StationMetric,
    type TflViewMode
} from '../lib/tfl/observatory';

type BarDatum = {
    key: string;
    label: string;
    detail: string;
    value: number;
    color: string;
};

const lineColors = ['#55d6be', '#69a9ff', '#f4b860', '#d98cff', '#ff7b82'];
const directionColors: Record<string, string> = {
    inbound: '#55d6be',
    outbound: '#69a9ff'
};

const modeTitles: Record<TflViewMode, string> = {
    overview: 'Network overview',
    'wait-times': 'Congestion & wait times',
    bunching: 'Bunching hotspots',
    countdown: 'Live countdown board'
};

export const Route = createFileRoute('/screen')({
    component: ScreenPage
});

function ScreenPage() {
    const state = useTflStore();

    useEffect(() => connectTflSync(), []);

    const filteredRows = useMemo(
        () =>
            stationMetrics.filter(
                (metric) =>
                    metric.window_start === state.windowStart &&
                    state.selectedLines.includes(metric.line_name) &&
                    (state.direction === 'all' || metric.direction === state.direction)
            ),
        [state.direction, state.selectedLines, state.windowStart]
    );

    const waitChartData = useMemo(() => buildWaitData(filteredRows).slice(0, 15), [filteredRows]);

    const hotspotChartData = useMemo(() => buildHotspotData(filteredRows), [filteredRows]);

    const countdownRows = useMemo(
        () =>
            [...filteredRows]
                .filter(
                    (metric) => state.viewMode !== 'bunching' || metric.imminent_arrivals_count > 0
                )
                .sort((a, b) => a.next_bus_sec - b.next_bus_sec),
        [filteredRows, state.viewMode]
    );

    const averageWait =
        filteredRows.length === 0
            ? 0
            : filteredRows.reduce((total, row) => total + row.avg_wait_sec, 0) /
              filteredRows.length /
              60;
    const monitoredStops = new Set(filteredRows.map((row) => row.station_name)).size;
    const activeBuses = filteredRows.reduce((total, row) => total + row.active_buses, 0);
    const imminentArrivals = filteredRows.reduce(
        (total, row) => total + row.imminent_arrivals_count,
        0
    );

    const isCountdown = state.viewMode === 'countdown';
    const showWaitChart = state.viewMode === 'overview' || state.viewMode === 'wait-times';
    const showHotspotChart = state.viewMode === 'overview' || state.viewMode === 'bunching';
    const selectedRoutesLabel =
        state.selectedLines.length === 0
            ? 'No routes selected'
            : `Route${state.selectedLines.length > 1 ? 's' : ''} ${state.selectedLines.join(', ')}`;

    return (
        <main className={`tfl-display${isCountdown ? ' tfl-display-countdown' : ''}`}>
            <header className="tfl-display-header">
                <div className="tfl-display-brand">
                    <div className="tfl-roundel" aria-hidden="true">
                        <span>BUS</span>
                    </div>
                    <div>
                        <p className="tfl-eyebrow">TRANSPORT FOR LONDON · NETWORK INTELLIGENCE</p>
                        <h1>TfL Live Bus Network Observatory</h1>
                    </div>
                </div>
                <div className="tfl-window-badge">
                    <span className="tfl-live-dot" />
                    <div>
                        <span className="tfl-window-caption">SELECTED 5-MINUTE WINDOW</span>
                        <strong>{formatWindowStart(state.windowStart)}</strong>
                    </div>
                </div>
            </header>

            <div className="tfl-display-subhead">
                <h2>{modeTitles[state.viewMode]}</h2>
                <span>
                    {selectedRoutesLabel}
                    {' · '}
                    {state.direction === 'all' ? 'All directions' : state.direction}
                </span>
            </div>

            {!isCountdown && (
                <section className="tfl-kpi-grid" aria-label="Network summary">
                    <KpiCard
                        label="Active buses tracked"
                        value={activeBuses.toLocaleString()}
                        accent="#55d6be"
                        annotation="vehicle appearances in window"
                    />
                    <KpiCard
                        label="Monitored stops"
                        value={monitoredStops.toLocaleString()}
                        accent="#69a9ff"
                        annotation="distinct stations"
                    />
                    <KpiCard
                        label="Avg network wait"
                        value={`${averageWait.toFixed(1)} min`}
                        accent="#f4b860"
                        annotation="mean across filtered records"
                    />
                    <KpiCard
                        label="Imminent arrivals ≤ 3m"
                        value={imminentArrivals.toLocaleString()}
                        accent="#ff7b82"
                        annotation="buses due within 180 seconds"
                    />
                </section>
            )}

            {showWaitChart && (
                <section
                    className={`tfl-chart-card${
                        state.viewMode === 'wait-times' ? ' tfl-chart-expanded' : ''
                    }`}
                >
                    <div className="tfl-card-heading">
                        <div>
                            <p className="tfl-eyebrow">WAIT-TIME ANALYSIS</p>
                            <h3>Longest average waits</h3>
                        </div>
                        <span className="tfl-chart-unit">TOP {waitChartData.length} · MINUTES</span>
                    </div>
                    <BarChart
                        data={waitChartData}
                        emptyLabel="No wait-time records match these filters."
                        valueLabel={(value) => `${value.toFixed(1)} min`}
                    />
                </section>
            )}

            {showHotspotChart && (
                <section
                    className={`tfl-chart-card${
                        state.viewMode === 'bunching' ? ' tfl-chart-expanded' : ''
                    }`}
                >
                    <div className="tfl-card-heading">
                        <div>
                            <p className="tfl-eyebrow">BUS BUNCHING · ≤ 3 MINUTES</p>
                            <h3>Arrival hotspots by direction</h3>
                        </div>
                        <span className="tfl-chart-unit">STOPS WITH IMMINENT ARRIVALS</span>
                    </div>
                    <BarChart
                        data={hotspotChartData.slice(0, 15)}
                        emptyLabel="No imminent arrivals in this window."
                        valueLabel={(value) => `${value} ${value === 1 ? 'bus' : 'buses'}`}
                    />
                </section>
            )}

            {state.viewMode === 'wait-times' && <WaitDetailTable rows={filteredRows} />}

            {(isCountdown || state.viewMode === 'bunching' || state.viewMode === 'overview') && (
                <CountdownTable rows={countdownRows} compact={!isCountdown} />
            )}

            <footer className="tfl-display-footer">
                <span>GOLD LAYER SNAPSHOT</span>
                <span>
                    {filteredRows.length.toLocaleString()} line · station · direction records
                </span>
                <span>5-minute aggregation</span>
            </footer>
        </main>
    );
}

function KpiCard({
    label,
    value,
    accent,
    annotation
}: {
    label: string;
    value: string;
    accent: string;
    annotation: string;
}) {
    const accentStyle: CSSProperties & { '--kpi-accent': string } = {
        '--kpi-accent': accent
    };

    return (
        <article className="tfl-kpi-card" style={accentStyle}>
            <p>{label}</p>
            <strong>{value}</strong>
            <span>{annotation}</span>
        </article>
    );
}

function BarChart({
    data,
    emptyLabel,
    valueLabel
}: {
    data: BarDatum[];
    emptyLabel: string;
    valueLabel: (value: number) => string;
}) {
    if (data.length === 0) return <p className="tfl-empty-state">{emptyLabel}</p>;

    const maximum = Math.max(...data.map((datum) => datum.value), 0);
    return (
        <div className="tfl-bar-chart">
            {data.map((datum) => (
                <div
                    className="tfl-bar-row"
                    key={datum.key}
                    title={`${datum.label} · ${datum.detail}`}
                >
                    <div className="tfl-bar-label">
                        <span>{datum.label}</span>
                        <small>{datum.detail}</small>
                    </div>
                    <div className="tfl-bar-track">
                        <span
                            className="tfl-bar-fill"
                            style={{
                                width: `${maximum > 0 ? (datum.value / maximum) * 100 : 0}%`,
                                backgroundColor: datum.color
                            }}
                        />
                    </div>
                    <strong className="tfl-bar-value">{valueLabel(datum.value)}</strong>
                </div>
            ))}
        </div>
    );
}

function CountdownTable({ rows, compact }: { rows: StationMetric[]; compact: boolean }) {
    return (
        <section className={`tfl-table-card${compact ? ' is-compact' : ' is-full'}`}>
            <div className="tfl-card-heading">
                <div>
                    <p className="tfl-eyebrow">LIVE ARRIVAL MONITOR</p>
                    <h3>Station countdown board</h3>
                </div>
                <span className="tfl-chart-unit">{rows.length} ARRIVALS</span>
            </div>
            {rows.length === 0 ? (
                <p className="tfl-empty-state">No arrivals match the selected filters.</p>
            ) : (
                <div className="tfl-table-scroll">
                    <table className="tfl-arrivals-table">
                        <thead>
                            <tr>
                                <th>Line</th>
                                <th>Station</th>
                                <th>Direction</th>
                                <th>Next bus (s)</th>
                                <th>Avg wait (min)</th>
                                <th>Active buses</th>
                                <th>Imminent</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr key={`${row.line_name}-${row.station_name}-${row.direction}`}>
                                    <td>
                                        <span className="tfl-table-line">{row.line_name}</span>
                                    </td>
                                    <td className="tfl-station-cell">{row.station_name}</td>
                                    <td>
                                        <span className={`tfl-direction-tag ${row.direction}`}>
                                            {row.direction}
                                        </span>
                                    </td>
                                    <td className="tfl-countdown-cell">
                                        {Math.round(row.next_bus_sec)}
                                    </td>
                                    <td>{(row.avg_wait_sec / 60).toFixed(1)}</td>
                                    <td>{row.active_buses}</td>
                                    <td className={row.imminent_arrivals_count > 0 ? 'is-hot' : ''}>
                                        {row.imminent_arrivals_count}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}

function WaitDetailTable({ rows }: { rows: StationMetric[] }) {
    const longestWaits = [...rows].sort((a, b) => b.avg_wait_sec - a.avg_wait_sec).slice(0, 20);
    return (
        <section className="tfl-table-card">
            <div className="tfl-card-heading">
                <div>
                    <p className="tfl-eyebrow">DETAILED CONGESTION</p>
                    <h3>Wait and service pressure</h3>
                </div>
            </div>
            <div className="tfl-table-scroll">
                <table className="tfl-arrivals-table">
                    <thead>
                        <tr>
                            <th>Station</th>
                            <th>Direction</th>
                            <th>Avg wait (min)</th>
                            <th>Max wait (min)</th>
                            <th>Next bus (s)</th>
                            <th>Active buses</th>
                        </tr>
                    </thead>
                    <tbody>
                        {longestWaits.map((row) => (
                            <tr key={`${row.line_name}-${row.station_name}-${row.direction}`}>
                                <td className="tfl-station-cell">{row.station_name}</td>
                                <td>
                                    <span className={`tfl-direction-tag ${row.direction}`}>
                                        {row.direction}
                                    </span>
                                </td>
                                <td className="tfl-countdown-cell">
                                    {(row.avg_wait_sec / 60).toFixed(1)}
                                </td>
                                <td>{(row.max_wait_sec / 60).toFixed(1)}</td>
                                <td>{Math.round(row.next_bus_sec)}</td>
                                <td>{row.active_buses}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

function buildHotspotData(rows: StationMetric[]): BarDatum[] {
    const totals = new Map<string, BarDatum>();
    for (const row of rows) {
        const key = `${row.station_name}-${row.direction}`;
        const existing = totals.get(key);
        const value = (existing?.value ?? 0) + row.imminent_arrivals_count;
        if (value === 0) continue;

        totals.set(key, {
            key,
            label: row.station_name,
            detail: row.direction,
            value,
            color: directionColors[row.direction] ?? '#69a9ff'
        });
    }

    return [...totals.values()].sort((a, b) => b.value - a.value);
}

function buildWaitData(rows: StationMetric[]): BarDatum[] {
    const totals = new Map<
        string,
        { line: string; station: string; waitTotal: number; count: number }
    >();
    for (const row of rows) {
        const key = `${row.line_name}-${row.station_name}`;
        const aggregate = totals.get(key) ?? {
            line: row.line_name,
            station: row.station_name,
            waitTotal: 0,
            count: 0
        };
        aggregate.waitTotal += row.avg_wait_sec;
        aggregate.count += 1;
        totals.set(key, aggregate);
    }

    return [...totals.entries()]
        .map(([key, aggregate]) => ({
            key,
            label: aggregate.station,
            detail: `Route ${aggregate.line}`,
            value: aggregate.waitTotal / aggregate.count / 60,
            color: colorForLine(aggregate.line)
        }))
        .sort((a, b) => b.value - a.value);
}

function colorForLine(line: string) {
    let hash = 0;
    for (const character of line) hash = (hash * 31 + character.charCodeAt(0)) | 0;
    return lineColors[Math.abs(hash) % lineColors.length] ?? lineColors[0] ?? '#55d6be';
}

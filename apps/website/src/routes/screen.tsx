import { createFileRoute, useLocation } from '@tanstack/react-router';
import { useEffect, useMemo, type CSSProperties, type ReactNode } from 'react';

import {
    connectTflSync,
    formatWindowStart,
    stationMetrics,
    useTflStore,
    windowStarts,
    type TflDirection,
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

type WallTileNumber = 1 | 2 | 3 | 4 | 5 | 6;

type TrendDatum = {
    windowStart: string;
    value: number | null;
};

type RoutePerformanceDatum = {
    lineName: string;
    averageWait: number;
    activeBuses: number;
};

const lineColors = ['#55d6be', '#69a9ff', '#f4b860', '#d98cff', '#ff7b82'];
const directionColors: Record<string, string> = {
    inbound: '#55d6be',
    outbound: '#69a9ff'
};

const tileTitles: Record<WallTileNumber, string> = {
    1: 'Network KPIs',
    2: 'Congestion & Wait Times',
    3: 'Bus Bunching Hotspots',
    4: 'Network Wait Trend',
    5: 'Route Performance',
    6: 'Live Countdown Board'
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
    const { search } = useLocation();
    const searchParams = (search as Record<string, unknown>) ?? {};
    const tile = parseWallTile(searchParams.tile);

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

    const trendData = useMemo(
        () => buildTrendData(state.selectedLines, state.direction),
        [state.direction, state.selectedLines]
    );

    const routePerformanceData = useMemo(
        () => buildRoutePerformanceData(filteredRows),
        [filteredRows]
    );

    const selectedIndex = Math.max(0, windowStarts.indexOf(state.windowStart));

    const arrivalsByCountdown = useMemo(
        () => [...filteredRows].sort((a, b) => a.next_bus_sec - b.next_bus_sec),
        [filteredRows]
    );

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

    if (tile !== null) {
        return (
            <WallTile
                tile={tile}
                title={tileTitles[tile]}
                windowStart={state.windowStart}
                routesLabel={selectedRoutesLabel}
                direction={state.direction}
            >
                {tile === 1 && (
                    <div className="tfl-wall-kpi-grid">
                        <KpiCard
                            label="Active buses tracked"
                            value={activeBuses.toLocaleString()}
                            accent="#55d6be"
                            annotation="vehicle appearances in this window"
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
                            annotation="mean wait across filtered records"
                        />
                        <KpiCard
                            label="Imminent arrivals ≤ 3m"
                            value={imminentArrivals.toLocaleString()}
                            accent="#ff7b82"
                            annotation="buses due within 180 seconds"
                        />
                    </div>
                )}
                {tile === 2 && (
                    <BarChart
                        data={waitChartData.slice(0, 12)}
                        emptyLabel="No wait-time records match these filters."
                        valueLabel={(value) => `${value.toFixed(1)} min`}
                    />
                )}
                {tile === 3 && (
                    <BarChart
                        data={hotspotChartData.slice(0, 12)}
                        emptyLabel="No imminent arrivals in this window."
                        valueLabel={(value) => `${value} ${value === 1 ? 'bus' : 'buses'}`}
                    />
                )}
                {tile === 4 && <TrendChart data={trendData} selectedIndex={selectedIndex} />}
                {tile === 5 && <RoutePerformanceChart data={routePerformanceData} />}
                {tile === 6 && <WallCountdownBoard rows={arrivalsByCountdown.slice(0, 10)} />}
            </WallTile>
        );
    }

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

function WallTile({
    tile,
    title,
    windowStart,
    routesLabel,
    direction,
    children
}: {
    tile: WallTileNumber;
    title: string;
    windowStart: string;
    routesLabel: string;
    direction: TflDirection;
    children: ReactNode;
}) {
    return (
        <main className={`tfl-display tfl-wall-tile tfl-wall-tile-${tile}`}>
            <header className="tfl-wall-tile-header">
                <div>
                    <p className="tfl-eyebrow">TRANSPORT FOR LONDON · TILE 0{tile}</p>
                    <h1>{title}</h1>
                </div>
                <div className="tfl-wall-tile-context">
                    <strong>{formatWindowStart(windowStart)}</strong>
                    <span>
                        {routesLabel} · {direction === 'all' ? 'All directions' : direction}
                    </span>
                </div>
            </header>
            <section className="tfl-wall-tile-content">{children}</section>
        </main>
    );
}

function TrendChart({ data, selectedIndex }: { data: TrendDatum[]; selectedIndex: number }) {
    const values = data
        .map((datum) => datum.value)
        .filter((value): value is number => value !== null);
    if (values.length === 0) {
        return <p className="tfl-empty-state">No trend data matches these filters.</p>;
    }

    const minimumValue = Math.min(...values);
    const maximumValue = Math.max(...values);
    const rangePadding = Math.max((maximumValue - minimumValue) * 0.12, 1);
    const minimum = Math.max(0, minimumValue - rangePadding);
    const maximum = maximumValue + rangePadding;
    const left = 95;
    const right = 960;
    const top = 38;
    const bottom = 425;
    const xForIndex = (index: number) =>
        left + (index / Math.max(data.length - 1, 1)) * (right - left);
    const yForValue = (value: number) =>
        top + ((maximum - value) / Math.max(maximum - minimum, 1)) * (bottom - top);

    const paths: string[] = [];
    let activePath = '';
    data.forEach((datum, index) => {
        if (datum.value === null) {
            if (activePath) paths.push(activePath);
            activePath = '';
            return;
        }

        activePath += `${activePath ? ' L' : 'M'}${xForIndex(index)} ${yForValue(datum.value)}`;
    });
    if (activePath) paths.push(activePath);

    const selectedPoint = data[selectedIndex];
    const yTicks = Array.from({ length: 5 }, (_, index) => {
        const ratio = index / 4;
        const value = maximum - ratio * (maximum - minimum);
        return { y: top + ratio * (bottom - top), value };
    });
    const xTickIndexes = [...new Set([0, Math.floor((data.length - 1) / 2), data.length - 1])];

    return (
        <div className="tfl-trend-chart">
            <svg
                viewBox="0 0 1000 500"
                role="img"
                aria-label="Mean network wait time across all snapshot windows"
            >
                <defs>
                    <linearGradient id="tfl-trend-line" x1="0" x2="1" y1="0" y2="0">
                        <stop offset="0%" stopColor="#69a9ff" />
                        <stop offset="100%" stopColor="#55d6be" />
                    </linearGradient>
                </defs>
                {yTicks.map((tick) => (
                    <g key={tick.y}>
                        <line
                            x1={left}
                            x2={right}
                            y1={tick.y}
                            y2={tick.y}
                            stroke="#294052"
                            strokeDasharray="5 8"
                        />
                        <text x={left - 16} y={tick.y + 6} textAnchor="end">
                            {tick.value.toFixed(1)}
                        </text>
                    </g>
                ))}
                <text className="tfl-trend-axis-label" x={left} y={top - 12}>
                    AVG WAIT · MINUTES
                </text>
                {paths.map((path, index) => (
                    <path
                        key={index}
                        d={path}
                        fill="none"
                        stroke="url(#tfl-trend-line)"
                        strokeWidth={5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                ))}
                <line
                    x1={xForIndex(selectedIndex)}
                    x2={xForIndex(selectedIndex)}
                    y1={top}
                    y2={bottom}
                    stroke="#f4b860"
                    strokeWidth={3}
                    strokeDasharray="8 8"
                />
                {selectedPoint?.value !== null && selectedPoint?.value !== undefined && (
                    <circle
                        cx={xForIndex(selectedIndex)}
                        cy={yForValue(selectedPoint.value)}
                        r={11}
                        fill="#f4b860"
                        stroke="#07111b"
                        strokeWidth={5}
                    />
                )}
                {xTickIndexes.map((index) => {
                    const datum = data[index];
                    if (!datum) return null;
                    return (
                        <text
                            key={index}
                            x={xForIndex(index)}
                            y={bottom + 36}
                            textAnchor={
                                index === 0 ? 'start' : index === data.length - 1 ? 'end' : 'middle'
                            }
                        >
                            {formatWindowClock(datum.windowStart)}
                        </text>
                    );
                })}
                {selectedPoint?.value !== null && selectedPoint?.value !== undefined && (
                    <text
                        className="tfl-trend-selected-label"
                        x={Math.min(xForIndex(selectedIndex) + 18, right - 145)}
                        y={yForValue(selectedPoint.value) - 18}
                    >
                        {selectedPoint.value.toFixed(1)} min
                    </text>
                )}
            </svg>
        </div>
    );
}

function RoutePerformanceChart({ data }: { data: RoutePerformanceDatum[] }) {
    if (data.length === 0) {
        return <p className="tfl-empty-state">No route performance data matches these filters.</p>;
    }

    const maximumWait = Math.max(...data.map((route) => route.averageWait), 1);
    const maximumBuses = Math.max(...data.map((route) => route.activeBuses), 1);

    return (
        <div className="tfl-route-performance">
            {data.map((route) => (
                <article className="tfl-route-performance-row" key={route.lineName}>
                    <div className="tfl-route-performance-heading">
                        <strong>Route {route.lineName}</strong>
                        <span>{route.averageWait.toFixed(1)} min avg wait</span>
                        <span>{route.activeBuses.toLocaleString()} active buses</span>
                    </div>
                    <div className="tfl-route-performance-metric">
                        <span>AVERAGE WAIT</span>
                        <div className="tfl-route-performance-track">
                            <span
                                className="wait"
                                style={{ width: `${(route.averageWait / maximumWait) * 100}%` }}
                            />
                        </div>
                    </div>
                    <div className="tfl-route-performance-metric">
                        <span>ACTIVE BUSES</span>
                        <div className="tfl-route-performance-track">
                            <span
                                className="buses"
                                style={{ width: `${(route.activeBuses / maximumBuses) * 100}%` }}
                            />
                        </div>
                    </div>
                </article>
            ))}
        </div>
    );
}

function WallCountdownBoard({ rows }: { rows: StationMetric[] }) {
    if (rows.length === 0) {
        return <p className="tfl-empty-state">No arrivals match the selected filters.</p>;
    }

    return (
        <div className="tfl-wall-countdown-board">
            <div className="tfl-wall-countdown-row tfl-wall-countdown-heading">
                <span>LINE</span>
                <span>STATION</span>
                <span>DIRECTION</span>
                <span>NEXT BUS</span>
            </div>
            {rows.map((row) => (
                <div
                    className="tfl-wall-countdown-row"
                    key={`${row.line_name}-${row.station_name}-${row.direction}`}
                >
                    <strong className="tfl-wall-countdown-line">{row.line_name}</strong>
                    <span className="tfl-wall-countdown-station">{row.station_name}</span>
                    <span className={`tfl-wall-countdown-direction ${row.direction}`}>
                        {row.direction}
                    </span>
                    <strong className="tfl-wall-countdown-time">
                        {Math.round(row.next_bus_sec)}s
                    </strong>
                </div>
            ))}
        </div>
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

function buildTrendData(selectedLines: string[], direction: TflDirection): TrendDatum[] {
    const lineFilter = new Set(selectedLines);
    const totals = new Map<string, { waitTotal: number; count: number }>();

    for (const metric of stationMetrics) {
        if (
            !lineFilter.has(metric.line_name) ||
            (direction !== 'all' && metric.direction !== direction)
        ) {
            continue;
        }

        const aggregate = totals.get(metric.window_start) ?? { waitTotal: 0, count: 0 };
        aggregate.waitTotal += metric.avg_wait_sec;
        aggregate.count += 1;
        totals.set(metric.window_start, aggregate);
    }

    return windowStarts.map((windowStart) => {
        const aggregate = totals.get(windowStart);
        return {
            windowStart,
            value: aggregate ? aggregate.waitTotal / aggregate.count / 60 : null
        };
    });
}

function buildRoutePerformanceData(rows: StationMetric[]): RoutePerformanceDatum[] {
    const totals = new Map<string, { waitTotal: number; count: number; activeBuses: number }>();

    for (const row of rows) {
        const aggregate = totals.get(row.line_name) ?? {
            waitTotal: 0,
            count: 0,
            activeBuses: 0
        };
        aggregate.waitTotal += row.avg_wait_sec;
        aggregate.count += 1;
        aggregate.activeBuses += row.active_buses;
        totals.set(row.line_name, aggregate);
    }

    return [...totals.entries()]
        .map(([lineName, aggregate]) => ({
            lineName,
            averageWait: aggregate.waitTotal / aggregate.count / 60,
            activeBuses: aggregate.activeBuses
        }))
        .sort((a, b) => b.averageWait - a.averageWait);
}

function parseWallTile(value: unknown): WallTileNumber | null {
    const tileNumbers: Record<string, WallTileNumber> = {
        '1': 1,
        '2': 2,
        '3': 3,
        '4': 4,
        '5': 5,
        '6': 6
    };

    const tileKey = typeof value === 'number' && Number.isInteger(value) ? String(value) : value;
    return typeof tileKey === 'string' ? (tileNumbers[tileKey] ?? null) : null;
}

function formatWindowClock(windowStart: string) {
    return windowStart.slice(11, 16) || windowStart;
}

function colorForLine(line: string) {
    let hash = 0;
    for (const character of line) hash = (hash * 31 + character.charCodeAt(0)) | 0;
    return lineColors[Math.abs(hash) % lineColors.length] ?? lineColors[0] ?? '#55d6be';
}

import { Store, useStore } from '@tanstack/react-store';

import rawMetrics from '../../data/tfl_gold_insights.json';

export interface StationMetric {
    window_start: string;
    window_end: string;
    line_name: string;
    station_name: string;
    direction: string;
    avg_wait_sec: number;
    next_bus_sec: number;
    max_wait_sec: number;
    active_buses: number;
    imminent_arrivals_count: number;
}

export type TflDirection = 'all' | 'inbound' | 'outbound';
export type TflViewMode = 'overview' | 'wait-times' | 'bunching' | 'countdown';

export interface TflSharedState {
    windowStart: string;
    selectedLines: string[];
    direction: TflDirection;
    viewMode: TflViewMode;
}

export const stationMetrics: StationMetric[] = rawMetrics;
export const windowStarts = [
    ...new Set(stationMetrics.map((metric) => metric.window_start))
].sort();
export const busLines = [...new Set(stationMetrics.map((metric) => metric.line_name))].sort();

const initialState: TflSharedState = {
    windowStart: windowStarts[0] ?? '',
    selectedLines: busLines,
    direction: 'all',
    viewMode: 'overview'
};
const syncChannels = new Set<BroadcastChannel>();

export const tflStore = new Store<TflSharedState>(initialState);

export function useTflStore(): TflSharedState;
export function useTflStore<T>(selector: (state: TflSharedState) => T): T;
export function useTflStore<T>(selector?: (state: TflSharedState) => T) {
    return useStore(tflStore, (state) => (selector ? selector(state) : state));
}

export function updateTflState(patch: Partial<TflSharedState>) {
    tflStore.setState((previous) => ({
        ...previous,
        ...patch
    }));

    const message = { type: 'tfl/state', state: tflStore.state };
    for (const channel of syncChannels) {
        channel.postMessage(message);
    }
}

export function connectTflSync() {
    if (typeof BroadcastChannel === 'undefined') return () => {};

    const channel = new BroadcastChannel('tfl-bus-observatory');
    syncChannels.add(channel);
    channel.onmessage = (event: MessageEvent<unknown>) => {
        if (!isRecord(event.data)) return;

        if (event.data.type === 'tfl/request-state') {
            channel.postMessage({ type: 'tfl/state', state: tflStore.state });
            return;
        }

        if (event.data.type !== 'tfl/state') return;
        const state = parseSharedState(event.data.state);
        if (state) tflStore.setState(() => state);
    };
    channel.postMessage({ type: 'tfl/request-state' });

    return () => {
        syncChannels.delete(channel);
        channel.close();
    };
}

export function formatWindowStart(windowStart: string) {
    const isoTimestamp = windowStart.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00');
    const date = new Date(isoTimestamp);
    if (Number.isNaN(date.getTime())) return windowStart;

    return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
        timeZoneName: 'short'
    }).format(date);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function parseSharedState(value: unknown): TflSharedState | null {
    if (!isRecord(value)) return null;

    const selectedLines = value.selectedLines;
    const direction = value.direction;
    const viewMode = value.viewMode;
    const windowStart = value.windowStart;

    if (
        typeof windowStart !== 'string' ||
        !windowStarts.includes(windowStart) ||
        !Array.isArray(selectedLines) ||
        !selectedLines.every((line): line is string => typeof line === 'string') ||
        (direction !== 'all' && direction !== 'inbound' && direction !== 'outbound') ||
        (viewMode !== 'overview' &&
            viewMode !== 'wait-times' &&
            viewMode !== 'bunching' &&
            viewMode !== 'countdown')
    ) {
        return null;
    }

    return {
        windowStart,
        selectedLines: selectedLines.filter((line) => busLines.includes(line)),
        direction,
        viewMode
    };
}

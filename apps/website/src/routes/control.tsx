import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';

import {
    busLines,
    connectTflSync,
    formatWindowStart,
    tflStore,
    updateTflState,
    useTflStore,
    windowStarts,
    type TflDirection,
    type TflViewMode
} from '../lib/tfl/observatory';

const viewModes: Array<{ value: TflViewMode; label: string }> = [
    { value: 'overview', label: 'Overview' },
    { value: 'wait-times', label: 'Congestion & Wait Times' },
    { value: 'bunching', label: 'Bunching Hotspots' },
    { value: 'countdown', label: 'Live Countdown Board' }
];

const directions: Array<{ value: TflDirection; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'inbound', label: 'Inbound' },
    { value: 'outbound', label: 'Outbound' }
];

export const Route = createFileRoute('/control')({
    component: ControlPage
});

function ControlPage() {
    const state = useTflStore();
    const [isPlaying, setIsPlaying] = useState(false);
    const selectedIndex = useMemo(
        () => Math.max(0, windowStarts.indexOf(state.windowStart)),
        [state.windowStart]
    );

    useEffect(() => connectTflSync(), []);

    useEffect(() => {
        if (!isPlaying || windowStarts.length < 2) return;

        const timer = window.setInterval(() => {
            const currentIndex = windowStarts.indexOf(tflStore.state.windowStart);
            const nextIndex = (currentIndex + 1) % windowStarts.length;
            updateTflState({ windowStart: windowStarts[nextIndex] ?? windowStarts[0] ?? '' });
        }, 3000);

        return () => window.clearInterval(timer);
    }, [isPlaying]);

    const toggleLine = (line: string) => {
        const nextLines = state.selectedLines.includes(line)
            ? state.selectedLines.filter((selectedLine) => selectedLine !== line)
            : [...state.selectedLines, line];
        updateTflState({ selectedLines: nextLines });
    };

    return (
        <main className="tfl-panel">
            <header className="tfl-panel-header">
                <div>
                    <p className="tfl-eyebrow">DATA OBSERVATORY · OPERATOR PANEL</p>
                    <h1>TfL Bus Network Controls</h1>
                </div>
                <a className="tfl-open-link" href="/screen" target="_blank" rel="noreferrer">
                    Open display ↗
                </a>
            </header>

            <section className="tfl-control-card">
                <div className="tfl-section-heading">
                    <div>
                        <p className="tfl-eyebrow">TIME WINDOW</p>
                        <h2>{formatWindowStart(state.windowStart)}</h2>
                    </div>
                    <button
                        type="button"
                        className={`tfl-play-button${isPlaying ? ' is-playing' : ''}`}
                        onClick={() => setIsPlaying((playing) => !playing)}
                        aria-pressed={isPlaying}
                    >
                        <span aria-hidden="true">{isPlaying ? 'Ⅱ' : '▶'}</span>
                        {isPlaying ? 'Pause' : 'Play'}
                    </button>
                </div>
                <input
                    className="tfl-range"
                    type="range"
                    min={0}
                    max={Math.max(0, windowStarts.length - 1)}
                    step={1}
                    value={selectedIndex}
                    onChange={(event) => {
                        const nextWindow = windowStarts[Number(event.currentTarget.value)];
                        if (nextWindow) updateTflState({ windowStart: nextWindow });
                    }}
                    aria-label="Select five-minute data window"
                />
                <div className="tfl-range-captions">
                    <span>{formatWindowStart(windowStarts[0] ?? '')}</span>
                    <span>{formatWindowStart(windowStarts[windowStarts.length - 1] ?? '')}</span>
                </div>
                <p className="tfl-control-hint">
                    {windowStarts.length} five-minute snapshots · playback advances every 3 seconds
                </p>
            </section>

            <section className="tfl-control-card">
                <div className="tfl-section-heading">
                    <div>
                        <p className="tfl-eyebrow">BUS LINE FILTER</p>
                        <h2>Choose routes</h2>
                    </div>
                    <div className="tfl-inline-actions">
                        <button
                            type="button"
                            onClick={() => updateTflState({ selectedLines: busLines })}
                        >
                            Select All
                        </button>
                        <button type="button" onClick={() => updateTflState({ selectedLines: [] })}>
                            Clear
                        </button>
                    </div>
                </div>
                <div className="tfl-pill-list">
                    {busLines.map((line) => {
                        const isSelected = state.selectedLines.includes(line);
                        return (
                            <button
                                type="button"
                                key={line}
                                className={`tfl-pill${isSelected ? ' is-selected' : ''}`}
                                onClick={() => toggleLine(line)}
                                aria-pressed={isSelected}
                            >
                                <span className="tfl-line-dot" />
                                Route {line}
                            </button>
                        );
                    })}
                    {busLines.length === 0 && (
                        <p className="tfl-control-hint">
                            No bus lines are present in this snapshot.
                        </p>
                    )}
                </div>
            </section>

            <section className="tfl-control-card">
                <p className="tfl-eyebrow">DIRECTION</p>
                <div className="tfl-segmented-control" role="group" aria-label="Direction filter">
                    {directions.map((direction) => (
                        <button
                            type="button"
                            key={direction.value}
                            className={state.direction === direction.value ? 'is-selected' : ''}
                            onClick={() => updateTflState({ direction: direction.value })}
                            aria-pressed={state.direction === direction.value}
                        >
                            {direction.label}
                        </button>
                    ))}
                </div>
            </section>

            <section className="tfl-control-card">
                <p className="tfl-eyebrow">DISPLAY MODE</p>
                <div className="tfl-mode-list" role="group" aria-label="Display mode">
                    {viewModes.map((mode, index) => (
                        <button
                            type="button"
                            key={mode.value}
                            className={`tfl-mode-option${
                                state.viewMode === mode.value ? ' is-selected' : ''
                            }`}
                            onClick={() => updateTflState({ viewMode: mode.value })}
                            aria-pressed={state.viewMode === mode.value}
                        >
                            <span className="tfl-mode-index">0{index + 1}</span>
                            <span>{mode.label}</span>
                            <span className="tfl-mode-arrow" aria-hidden="true">
                                →
                            </span>
                        </button>
                    ))}
                </div>
            </section>

            <footer className="tfl-panel-footer">
                <span className="tfl-live-dot" />
                Changes sync to open displays in this browser
            </footer>
        </main>
    );
}

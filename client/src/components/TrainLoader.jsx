import React from 'react';
import oneCoolieLogo from '../assets/onecoolie-logo.png';

/**
 * TrainLoader — OneCoolie Apple & Swiss Style Contextual Loading System
 *
 * Combines Apple-level typography & minimalism with Swiss International layout principles.
 * Contextual loading modes:
 * - 'inline' (default): Embedded loader for specific UI components
 * - 'card': Bordered container loader for cards & panels
 * - 'button': Micro dot loader for inside buttons [ ● Confirming... ]
 * - 'fullscreen': Full-page application initialization loader
 *
 * @param {'inline'|'card'|'button'|'fullscreen'} mode - Loading display mode
 * @param {string} text - Operation title (e.g. 'Finding Trains...')
 * @param {string} subtext - Supporting status message
 * @param {number|null} progress - Optional numeric progress percentage (0 - 100)
 * @param {boolean} fullScreen - Backward-compatible flag for fullscreen mode
 * @param {string} className - Optional custom container classes
 */
export default function TrainLoader({
    mode,
    text = 'Loading...',
    subtext = '',
    progress = null,
    fullScreen,
    className = '',
}) {
    // Backward-compatibility resolution:
    // If mode is omitted, fullScreen=true maps to 'fullscreen', otherwise defaults to 'inline'
    const resolvedMode = mode || (fullScreen === true ? 'fullscreen' : 'inline');

    return (
        <React.Fragment>
            {/* Embedded Native Apple & Swiss Typography + Smooth Animations */}
            <style>{`
                .oc-font-apple {
                    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Helvetica Neue", Helvetica, Arial, sans-serif;
                    -webkit-font-smoothing: antialiased;
                    -moz-osx-font-smoothing: grayscale;
                }

                @keyframes ocJourneyGlide {
                    0% { left: -25%; }
                    50% { left: 42%; }
                    100% { left: 105%; }
                }

                @keyframes ocDotPulse {
                    0%, 100% { opacity: 0.4; transform: scale(0.9); }
                    50% { opacity: 1; transform: scale(1.1); }
                }

                .oc-journey-glide {
                    animation: ocJourneyGlide 1.9s cubic-bezier(0.16, 1, 0.3, 1) infinite;
                }

                .oc-dot-pulse {
                    animation: ocDotPulse 1.4s ease-in-out infinite;
                }

                @media (prefers-reduced-motion: reduce) {
                    .oc-journey-glide,
                    .oc-dot-pulse {
                        animation: none !important;
                        left: 50% !important;
                        transform: translateX(-50%) !important;
                        opacity: 1 !important;
                    }
                }
            `}</style>

            {/* ── MODE 1: BUTTON ── */}
            {resolvedMode === 'button' && (
                <span
                    className={`inline-flex items-center justify-center gap-2 oc-font-apple text-xs font-semibold tracking-wide select-none text-current ${className}`}
                    role="status"
                    aria-live="polite"
                    aria-label={text}
                >
                    <span className="w-2 h-2 rounded-full bg-[#2563EB] oc-dot-pulse shrink-0" />
                    <span>{text}</span>
                </span>
            )}

            {/* ── MODE 2: INLINE (DEFAULT CONTEXTUAL) ── */}
            {resolvedMode === 'inline' && (
                <div
                    className={`w-full py-6 px-4 flex flex-col items-center justify-center text-center oc-font-apple select-none bg-transparent ${className}`}
                    role="status"
                    aria-live="polite"
                    aria-label={text}
                >
                    {/* Prominent Official Logo */}
                    <div className="w-14 h-14 sm:w-16 sm:h-16 mb-3 relative flex items-center justify-center shrink-0">
                        <img
                            src={oneCoolieLogo || '/onecoolie-logo.png'}
                            alt="OneCoolie"
                            className="w-full h-full object-contain rounded-full"
                        />
                    </div>

                    {/* Apple/Swiss Typography Title */}
                    <div className="font-bold text-sm sm:text-base tracking-tight text-[#000000] dark:text-[#FFFFFF]">
                        {text}
                    </div>

                    {/* Journey Line Indicator */}
                    <div className="w-48 sm:w-56 h-[2px] bg-[#E5E5E5] dark:bg-[#333333] relative my-3 overflow-hidden rounded-full">
                        {typeof progress === 'number' ? (
                            <div
                                className="h-full bg-[#2563EB] transition-all duration-300 rounded-full"
                                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                            />
                        ) : (
                            <div className="absolute top-0 bottom-0 w-8 bg-[#2563EB] rounded-full oc-journey-glide" />
                        )}
                    </div>

                    {/* Subtext / Progress Status */}
                    {typeof progress === 'number' ? (
                        <div className="text-xs font-semibold tracking-wide text-[#2563EB]">
                            {Math.round(progress)}% Completed
                        </div>
                    ) : subtext ? (
                        <div className="text-xs sm:text-sm font-medium text-[#666666] dark:text-[#999999] tracking-normal">
                            {subtext}
                        </div>
                    ) : null}
                </div>
            )}

            {/* ── MODE 3: CARD ── */}
            {resolvedMode === 'card' && (
                <div
                    className={`w-full max-w-md p-6 sm:p-8 rounded-2xl border border-[#E5E5E5] dark:border-[#333333] bg-[#FFFFFF] dark:bg-[#111111] text-[#000000] dark:text-[#FFFFFF] flex flex-col items-center text-center oc-font-apple select-none my-4 shadow-none ${className}`}
                    role="status"
                    aria-live="polite"
                    aria-label={text}
                >
                    {/* Prominent Official Logo */}
                    <div className="w-16 h-16 sm:w-20 sm:h-20 mb-4 relative flex items-center justify-center shrink-0">
                        <img
                            src={oneCoolieLogo || '/onecoolie-logo.png'}
                            alt="OneCoolie"
                            className="w-full h-full object-contain rounded-full"
                        />
                    </div>

                    {/* Apple/Swiss Typography Title */}
                    <div className="font-bold text-base sm:text-lg tracking-tight text-[#000000] dark:text-[#FFFFFF]">
                        {text}
                    </div>

                    {/* Journey Line Indicator */}
                    <div className="w-full max-w-[260px] h-[2px] bg-[#E5E5E5] dark:bg-[#333333] relative my-4 overflow-hidden rounded-full">
                        {typeof progress === 'number' ? (
                            <div
                                className="h-full bg-[#2563EB] transition-all duration-300 rounded-full"
                                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                            />
                        ) : (
                            <div className="absolute top-0 bottom-0 w-10 bg-[#2563EB] rounded-full oc-journey-glide" />
                        )}
                    </div>

                    {/* Subtext / Progress Status */}
                    {typeof progress === 'number' ? (
                        <div className="text-xs sm:text-sm font-semibold tracking-wide text-[#2563EB]">
                            Progress — {Math.round(progress)}%
                        </div>
                    ) : subtext ? (
                        <div className="text-xs sm:text-sm font-medium text-[#666666] dark:text-[#999999] tracking-normal">
                            {subtext}
                        </div>
                    ) : null}

                    {/* System Journey Route Stages */}
                    <div className="w-full max-w-[280px] pt-4 mt-4 border-t border-[#E5E5E5] dark:border-[#333333] flex justify-between items-center text-[10px] sm:text-[11px] font-semibold tracking-wider uppercase text-[#999999] dark:text-[#666666]">
                        <span className="text-[#2563EB] font-bold">STATION</span>
                        <span>─</span>
                        <span>TRAIN</span>
                        <span>─</span>
                        <span>ASSISTANCE</span>
                        <span>─</span>
                        <span>READY</span>
                    </div>
                </div>
            )}

            {/* ── MODE 4: FULLSCREEN ── */}
            {resolvedMode === 'fullscreen' && (
                <div
                    className={`min-h-screen w-full relative flex flex-col items-center justify-center p-6 bg-[#FFFFFF] dark:bg-[#000000] text-[#000000] dark:text-[#FFFFFF] oc-font-apple select-none ${className}`}
                    role="status"
                    aria-live="polite"
                    aria-label={text}
                >
                    <div className="flex flex-col items-center max-w-md w-full text-center">
                        {/* Prominent Official Logo */}
                        <div className="w-24 h-24 sm:w-28 sm:h-28 mb-5 relative flex items-center justify-center shrink-0">
                            <img
                                src={oneCoolieLogo || '/onecoolie-logo.png'}
                                alt="OneCoolie - Making Every Journey Easier"
                                className="w-full h-full object-contain rounded-full"
                            />
                        </div>

                        {/* Brand Title */}
                        <div className="font-extrabold text-xl sm:text-2xl tracking-tight text-[#000000] dark:text-[#FFFFFF]">
                            OneCoolie
                        </div>
                        <div className="text-xs sm:text-sm font-medium text-[#666666] dark:text-[#999999] tracking-normal mt-1 mb-6">
                            Making Every Journey Easier.
                        </div>

                        {/* Operation Status */}
                        <div className="font-bold text-sm sm:text-base tracking-tight text-[#2563EB] mb-2">
                            {text}
                        </div>

                        {/* Journey Line Indicator */}
                        <div className="w-64 sm:w-72 h-[2px] bg-[#E5E5E5] dark:bg-[#333333] relative my-3 overflow-hidden rounded-full">
                            {typeof progress === 'number' ? (
                                <div
                                    className="h-full bg-[#2563EB] transition-all duration-300 rounded-full"
                                    style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                                />
                            ) : (
                                <div className="absolute top-0 bottom-0 w-12 bg-[#2563EB] rounded-full oc-journey-glide" />
                            )}
                        </div>

                        {/* Subtext or Progress % */}
                        {typeof progress === 'number' ? (
                            <div className="text-xs sm:text-sm font-semibold tracking-wide text-[#2563EB] mt-2">
                                Progress — {Math.round(progress)}%
                            </div>
                        ) : subtext ? (
                            <div className="text-xs sm:text-sm font-medium text-[#666666] dark:text-[#999999] tracking-normal mt-2">
                                {subtext}
                            </div>
                        ) : (
                            <div className="text-xs font-medium text-[#666666] dark:text-[#999999] tracking-normal mt-2">
                                Connecting to dispatch...
                            </div>
                        )}

                        {/* System Route Bar */}
                        <div className="w-full max-w-[280px] pt-6 mt-6 border-t border-[#E5E5E5] dark:border-[#333333] flex justify-between items-center text-[10px] sm:text-[11px] font-semibold tracking-wider uppercase text-[#999999] dark:text-[#666666]">
                            <span className="text-[#2563EB] font-bold">STATION</span>
                            <span>━━━━</span>
                            <span>TRAIN</span>
                            <span>━━━━</span>
                            <span>ASSISTANCE</span>
                        </div>
                    </div>
                </div>
            )}
        </React.Fragment>
    );
}

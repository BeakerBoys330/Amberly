import { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense } from "react";
import { Search, Plus, ArrowLeft } from "lucide-react";
import GrowPlanner from "./GrowPlanner.jsx";
import { store, GROWS_KEY } from "./planner.js";
import { analyzeImage } from "./trichomes.js";
import LegalGate, { hasConsent, CONSENT_KEY } from "./LegalGate.jsx";
import STRAIN_DB from "./strain-database.json";
import ShareSheet, { useCloudUser } from "./ShareSheet.jsx";
const Community = lazy(() => import("./Social.jsx")); // loaded only when someone opens Following
import { cloudEnabled, AUTH_KEY, shareItem, unshare, signOut, deleteAccount } from "./cloud.js";

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
// Warm light palette: background #faf6f0, cards #fffdfa, text #2b2622,
// single amber accent #d99a3c. Font: Inter, self-hosted (imported in main.jsx).

const STYLES = `

  html, body { overflow-x: hidden; width: 100%; }
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }

  /* ── PALETTE ──
     Warm off-white paper, soft cream cards, ink-brown text, single amber accent.
     Rounded, airy, friendly. Inter for that clean Apple-adjacent feel. */
  .tv-root {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #faf6f0;
    color: #2b2622;
    min-height: 100vh;
    min-height: 100dvh; /* the part of the screen you can actually see on a phone */
    width: 100%;
    overflow-x: hidden;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }

  .tv-root input, .tv-root select, .tv-root textarea, .tv-root button {
    font-family: inherit;
  }

  .tv-container {
    max-width: 540px;
    width: 100%;
    margin: 0 auto;
    /* env(...) keeps content clear of the notch and the home-indicator bar */
    padding: calc(28px + env(safe-area-inset-top)) calc(20px + env(safe-area-inset-right))
             calc(56px + env(safe-area-inset-bottom)) calc(20px + env(safe-area-inset-left));
    position: relative;
  }

  @media (min-width: 480px) {
    .tv-container { padding-top: calc(48px + env(safe-area-inset-top)); padding-bottom: calc(72px + env(safe-area-inset-bottom)); }
  }

  /* ── HEADER ── */
  .tv-header { text-align: center; margin-bottom: 36px; }

  .tv-eyebrow {
    font-size: 13px;
    font-weight: 500;
    color: #8f6128;
    letter-spacing: 0.01em;
    margin-bottom: 10px;
  }

  .tv-title {
    font-size: clamp(40px, 11vw, 56px);
    font-weight: 800;
    color: #2b2622;
    line-height: 1.0;
    letter-spacing: -0.04em;
  }

  .tv-subtitle {
    font-size: 15px;
    color: #766b60;
    margin-top: 14px;
    line-height: 1.5;
    max-width: 30em;
    margin-left: auto;
    margin-right: auto;
  }

  /* ── HERO STEP HEADING (big, friendly, Apple-style question) ── */
  .tv-hero {
    text-align: center;
    margin-bottom: 28px;
  }
  .tv-hero-title {
    font-size: clamp(26px, 6.5vw, 34px);
    font-weight: 700;
    letter-spacing: -0.03em;
    color: #2b2622;
    line-height: 1.1;
  }
  .tv-hero-sub {
    font-size: 15px;
    color: #766b60;
    margin-top: 10px;
    line-height: 1.5;
  }

  /* ── CARD ── */
  .tv-card {
    background: #fffdfa;
    border: 1px solid #efe7dc;
    border-radius: 20px;
    box-shadow: 0 1px 2px rgba(80,60,40,0.04), 0 8px 24px rgba(80,60,40,0.05);
    overflow: hidden;
    margin-bottom: 14px;
  }
  .tv-card-pad { padding: 22px; }

  /* ── BIG CHOICE BUTTONS (plant type, effect) ── */
  .tv-choice {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 16px;
  }

  .tv-choice-btn {
    width: 100%;
    text-align: left;
    background: #fffdfa;
    border: 2px solid #efe7dc;
    border-radius: 18px;
    padding: 20px 22px;
    cursor: pointer;
    transition: border-color 0.18s, background 0.18s, transform 0.08s;
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .tv-choice-btn:hover { border-color: #e0cdb0; }
  .tv-choice-btn:active { transform: scale(0.99); }
  .tv-choice-btn.active {
    border-color: #d99a3c;
    background: #fff8ee;
  }

  .tv-choice-emoji {
    font-size: 30px;
    line-height: 1;
    flex-shrink: 0;
  }
  .tv-choice-text { flex: 1; min-width: 0; }
  .tv-choice-name {
    display: block;
    font-size: 18px;
    font-weight: 600;
    color: #2b2622;
    letter-spacing: -0.02em;
  }
  .tv-choice-desc {
    display: block;
    font-size: 13.5px;
    color: #766b60;
    margin-top: 3px;
  }
  .tv-choice-check {
    width: 24px; height: 24px;
    border-radius: 50%;
    border: 2px solid #e0d6c8;
    flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.18s, border-color 0.18s;
  }
  .tv-choice-btn.active .tv-choice-check {
    background: #d99a3c; border-color: #d99a3c;
  }
  .tv-choice-check svg { opacity: 0; transition: opacity 0.18s; }
  .tv-choice-btn.active .tv-choice-check svg { opacity: 1; }

  /* ── PRIMARY / SECONDARY BUTTONS ── */
  .tv-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 16px 22px;
    border-radius: 16px;
    border: none;
    font-size: 16px;
    font-weight: 600;
    letter-spacing: -0.01em;
    cursor: pointer;
    transition: background 0.18s, transform 0.08s, opacity 0.18s;
  }
  .tv-btn:active { transform: scale(0.985); }

  .tv-btn-primary { background: #d99a3c; color: #2b2622; } /* dark ink: white on amber is too faint to read */
  .tv-btn-primary:hover { background: #cf8f30; }
  .tv-btn-primary:disabled { background: #ece3d6; color: #766b60; cursor: not-allowed; transform: none; }

  .tv-btn-ghost { background: transparent; color: #766b60; }
  .tv-btn-ghost:hover { background: #f1e9dd; color: #5c5249; }

  .tv-btn-soft { background: #f4ece0; color: #6b5d4c; }
  .tv-btn-soft:hover { background: #ede2d2; }

  .tv-btn-row { display: flex; gap: 10px; margin-top: 14px; }
  .tv-btn-row .tv-btn { width: auto; flex: 1; }

  /* ── TEXT LINK (subtle, for secondary actions like "add your own") ── */
  .tv-link {
    display: inline-block;
    background: none;
    border: none;
    color: #8f6128;
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    padding: 12px 10px;
    min-height: 44px; /* thumb-sized tap target */
    text-decoration: none;
  }
  .tv-link:hover { color: #6b4718; text-decoration: underline; }

  /* ── BACK ── */
  .tv-back {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    color: #766b60;
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    padding: 0 12px 0 0;
    min-height: 44px;
    margin-bottom: 8px;
  }
  .tv-back:hover { color: #5c5249; }

  /* ── SEARCH ── */
  .tv-search-wrap { position: relative; margin-bottom: 16px; }
  .tv-search-icon { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: #766b60; pointer-events: none; }
  .tv-search-input {
    width: 100%;
    background: #fffdfa;
    border: 1px solid #efe7dc;
    border-radius: 14px;
    color: #2b2622;
    padding: 14px 16px 14px 44px;
    font-size: 16px;
    outline: none;
    transition: border-color 0.18s, box-shadow 0.18s;
  }
  .tv-search-input::placeholder { color: #766b60; }
  .tv-search-input:focus { border-color: #d99a3c; box-shadow: 0 0 0 4px rgba(217,154,60,0.12); }

  /* ── STRAIN GALLERY ── */
  .tv-gallery {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 16px;
  }
  @media (min-width: 460px) {
    .tv-gallery { grid-template-columns: 1fr 1fr 1fr; }
  }

  .tv-strain-card {
    background: #fffdfa;
    border: 2px solid #efe7dc;
    border-radius: 16px;
    overflow: hidden;
    cursor: pointer;
    text-align: left;
    transition: border-color 0.15s, transform 0.08s;
    padding: 14px;
    min-height: 68px;
  }
  .tv-strain-card:hover { border-color: #e0cdb0; }
  .tv-strain-card:active { transform: scale(0.98); }
  .tv-strain-name {
    font-size: 14px; font-weight: 600; color: #2b2622;
    line-height: 1.25; letter-spacing: -0.01em;
    overflow-wrap: anywhere;
  }
  .tv-strain-breeder {
    font-size: 11.5px; color: #766b60; margin-top: 2px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .tv-strain-trending {
    display: inline-block; margin-top: 6px;
    font-size: 10px; font-weight: 600; color: #8f6128;
    background: #fbf0dd; border-radius: 6px; padding: 2px 7px;
  }

  /* ── ADD-YOUR-OWN INLINE CARD (replaces the heavy modal) ── */
  .tv-addown {
    background: #fffdfa;
    border: 1.5px dashed #e0d2bd;
    border-radius: 16px;
    padding: 18px;
    text-align: center;
  }
  .tv-addown-q { font-size: 15px; color: #766b60; margin-bottom: 12px; }

  /* ── FIELDS ── */
  .tv-field { margin-bottom: 16px; }
  .tv-field:last-child { margin-bottom: 0; }
  .tv-field-label {
    display: block; font-size: 14px; font-weight: 600;
    color: #5c5249; margin-bottom: 7px; letter-spacing: -0.01em;
  }
  .tv-field-hint { font-size: 13px; color: #766b60; font-weight: 400; }

  .tv-input, .tv-select, .tv-textarea {
    width: 100%;
    background: #fffdfa;
    border: 1px solid #e7ddd0;
    border-radius: 13px;
    color: #2b2622;
    padding: 14px 15px;
    font-size: 16px;
    outline: none;
    transition: border-color 0.18s, box-shadow 0.18s;
  }
  .tv-input::placeholder, .tv-textarea::placeholder { color: #766b60; }
  .tv-input:focus, .tv-select:focus, .tv-textarea:focus {
    border-color: #d99a3c; box-shadow: 0 0 0 4px rgba(217,154,60,0.12);
  }
  .tv-textarea { resize: none; min-height: 84px; line-height: 1.5; }
  .tv-select {
    appearance: none; -webkit-appearance: none; cursor: pointer;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23a4988a' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 15px center; padding-right: 40px;
  }

  /* ── SEGMENTED PILLS (type chooser inside add-your-own) ── */
  .tv-seg { display: flex; gap: 8px; flex-wrap: wrap; }
  .tv-seg-btn {
    flex: 1; min-width: 70px;
    background: #f4ece0; border: 2px solid transparent; border-radius: 12px;
    padding: 11px 8px; min-height: 44px; font-size: 14px; font-weight: 500; color: #6b5d4c;
    cursor: pointer; transition: all 0.15s; text-align: center;
  }
  .tv-seg-btn.active { background: #fff8ee; border-color: #d99a3c; color: #8f6128; font-weight: 600; }

  /* ── SELECTED STRAIN BANNER ── */
  .tv-banner {
    display: flex; align-items: center; gap: 14px;
    background: #fff8ee; border: 1px solid #f0e0c6; border-radius: 16px;
    padding: 12px 16px; margin-bottom: 14px;
  }
  .tv-banner-img { width: 46px; height: 46px; border-radius: 11px; object-fit: cover; flex-shrink: 0; background: #f1e9dd; }
  .tv-banner-name { font-size: 16px; font-weight: 600; color: #2b2622; letter-spacing: -0.01em; }
  .tv-banner-meta { font-size: 13px; color: #766b60; margin-top: 2px; }

  /* ── EFFECT DIAL ── */
  .tv-dial { display: flex; flex-direction: column; gap: 10px; }
  .tv-dial-opt {
    width: 100%; text-align: left;
    background: #fffdfa; border: 2px solid #efe7dc; border-radius: 16px;
    padding: 16px 18px; cursor: pointer; transition: all 0.15s;
    display: flex; align-items: center; gap: 14px;
  }
  .tv-dial-opt:hover { border-color: #e0cdb0; }
  .tv-dial-opt.active { border-color: #d99a3c; background: #fff8ee; }
  .tv-dial-emoji { font-size: 24px; flex-shrink: 0; }
  .tv-dial-text { flex: 1; }
  .tv-dial-label { display: block; font-size: 16px; font-weight: 600; color: #2b2622; letter-spacing: -0.01em; }
  .tv-dial-blurb { display: block; font-size: 13px; color: #766b60; margin-top: 2px; }
  .tv-dial-amber { font-size: 12.5px; color: #8f6128; font-weight: 500; flex-shrink: 0; }

  /* ── UPLOAD ── */
  .tv-upload {
    display: block; width: 100%; color: inherit;
    border: 2px dashed #e0d2bd; border-radius: 18px;
    background: #fffdfa; padding: 38px 22px; text-align: center; cursor: pointer;
    transition: border-color 0.18s, background 0.18s;
  }
  .tv-upload:hover { border-color: #d99a3c; background: #fff8ee; }
  .tv-upload-emoji { font-size: 34px; margin-bottom: 12px; }
  .tv-upload-text { font-size: 16px; font-weight: 600; color: #2b2622; }
  .tv-upload-hint { font-size: 13.5px; color: #766b60; margin-top: 6px; line-height: 1.5; }

  .tv-img-preview { width: 100%; max-height: 240px; object-fit: cover; display: block; border-radius: 16px; }

  .tv-tip {
    font-size: 13px; color: #766b60; line-height: 1.55;
    background: #f7f0e6; border-radius: 13px; padding: 13px 15px; margin-top: 12px;
  }
  .tv-tip b { color: #6b5d4c; font-weight: 600; }

  /* ── ANALYSIS BARS ── */
  .tv-section-title { font-size: 18px; font-weight: 700; letter-spacing: -0.02em; color: #2b2622; margin-bottom: 4px; }
  .tv-section-meta { font-size: 13px; color: #766b60; margin-bottom: 18px; }

  .tv-bar-row { margin-bottom: 18px; }
  .tv-bar-row:last-child { margin-bottom: 0; }
  .tv-bar-meta { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
  .tv-bar-name { font-size: 14px; font-weight: 500; color: #5c5249; }
  .tv-bar-pct { font-size: 17px; font-weight: 700; color: #2b2622; letter-spacing: -0.01em; }
  .tv-bar-track { height: 8px; background: #f1e9dd; border-radius: 99px; overflow: hidden; }
  .tv-bar-fill { height: 100%; border-radius: 99px; transition: width 0.7s cubic-bezier(0.2,0.8,0.2,1); }
  .tv-fill-clear { background: #d8cdbb; }
  .tv-fill-cloudy { background: #9fb0a0; }
  .tv-fill-amber { background: #d99a3c; }

  /* ── RECOMMENDATION CARD ── */
  .tv-rec { border-radius: 20px; padding: 26px; margin-bottom: 14px; border: 1.5px solid; }
  .tv-rec-emoji { font-size: 36px; margin-bottom: 10px; }
  .tv-rec-stage { font-size: 26px; font-weight: 700; letter-spacing: -0.03em; line-height: 1.1; color: #2b2622; }
  .tv-rec-timing { font-size: 14px; font-weight: 600; margin-top: 4px; margin-bottom: 16px; }
  .tv-rec-note { font-size: 15px; color: #4a4138; line-height: 1.55; }
  .tv-rec-effect { font-size: 13.5px; color: #766b60; margin-top: 10px; }
  .tv-rec-detail { font-size: 13px; color: #766b60; margin-top: 6px; }

  .tv-rec-early  { background: #f6f1ea; border-color: #e8ddcc; }
  .tv-rec-early  .tv-rec-timing { color: #766b60; }
  .tv-rec-window { background: #fff8ee; border-color: #f0e0c6; }
  .tv-rec-window .tv-rec-timing { color: #8f6128; }
  .tv-rec-peak   { background: #f0f5ee; border-color: #d6e4d0; }
  .tv-rec-peak   .tv-rec-timing { color: #4f6e44; }
  .tv-rec-late   { background: #fbefe6; border-color: #f0d6bf; }
  .tv-rec-late   .tv-rec-timing { color: #a05a2c; }

  /* ── WARN / DISCLAIMER / ERROR ── */
  .tv-warn {
    background: #fdf3e3; border: 1px solid #f2dcb6; border-radius: 14px;
    padding: 15px 17px; font-size: 13.5px; color: #8c5f25; line-height: 1.55; margin-bottom: 14px;
  }
  .tv-disclaimer { font-size: 12.5px; color: #766b60; line-height: 1.55; text-align: center; padding: 4px 8px; margin-bottom: 14px; }
  .tv-error {
    background: #fceeec; border: 1px solid #f3d2cc; border-radius: 16px;
    padding: 18px; display: flex; gap: 13px; align-items: flex-start; margin-bottom: 14px;
  }
  .tv-error-emoji { font-size: 22px; flex-shrink: 0; }
  .tv-error-title { font-size: 15px; font-weight: 600; color: #c0492f; margin-bottom: 3px; }
  .tv-error-msg { font-size: 13.5px; color: #9a4a3a; line-height: 1.5; }

  .tv-loading { text-align: center; padding: 36px; font-size: 15px; color: #766b60; }

  /* ── COUNT / STATUS ── */
  .tv-count { font-size: 13px; color: #766b60; }
  .tv-status-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding: 0 4px; }

  /* ── MODAL (kept minimal, used only for tiny confirmations now) ── */
  .tv-overlay { position: fixed; inset: 0; background: rgba(43,38,34,0.4); backdrop-filter: blur(4px); z-index: 50; display: flex; align-items: center; justify-content: center; padding: 20px; }
  .tv-modal { background: #fffdfa; border-radius: 22px; max-width: 420px; width: 100%; max-height: 88vh; max-height: 88dvh; overflow-y: auto; box-shadow: 0 20px 60px rgba(60,40,20,0.25); }
  .tv-modal-pad { padding: 24px; }
  .tv-modal-title { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; color: #2b2622; margin-bottom: 16px; }

  /* ── PROGRESS DOTS ── */
  .tv-dots { display: flex; gap: 7px; justify-content: center; margin-bottom: 26px; }
  .tv-dot { width: 7px; height: 7px; border-radius: 50%; background: #e3d8c8; transition: background 0.25s, width 0.25s; }
  .tv-dot.active { background: #d99a3c; width: 22px; }
  .tv-dot.done { background: #d99a3c; }

  /* ── TOGGLE SWITCH ── */
  .tv-toggle-row {
    display: flex; align-items: center; gap: 14px;
    background: #fffdfa; border: 1px solid #efe7dc; border-radius: 16px;
    padding: 16px 18px; margin-bottom: 12px; cursor: pointer;
    width: 100%; text-align: left; color: inherit;
  }
  .tv-toggle-text { flex: 1; }
  .tv-toggle-label { font-size: 15px; font-weight: 600; color: #2b2622; letter-spacing: -0.01em; }
  .tv-toggle-desc { font-size: 13px; color: #766b60; margin-top: 2px; line-height: 1.45; }
  .tv-switch {
    width: 48px; height: 28px; border-radius: 99px; background: #e3d8c8;
    flex-shrink: 0; position: relative; transition: background 0.2s;
  }
  .tv-switch.on { background: #d99a3c; }
  .tv-switch-knob {
    position: absolute; top: 3px; left: 3px; width: 22px; height: 22px;
    border-radius: 50%; background: #fff; transition: transform 0.2s;
    box-shadow: 0 1px 3px rgba(0,0,0,0.18);
  }
  .tv-switch.on .tv-switch-knob { transform: translateX(20px); }

  /* ── DIARY ── */
  .tv-diary-empty {
    text-align: center; padding: 40px 20px; color: #766b60;
  }
  .tv-diary-empty-emoji { font-size: 40px; margin-bottom: 14px; }
  .tv-diary-entry {
    background: #fffdfa; border: 1px solid #efe7dc; border-radius: 18px;
    padding: 16px; margin-bottom: 12px; display: flex; gap: 14px;
  }
  .tv-diary-thumb {
    width: 64px; height: 64px; border-radius: 12px; object-fit: cover;
    flex-shrink: 0; background: #f1e9dd;
  }
  .tv-diary-thumb-ph {
    width: 64px; height: 64px; border-radius: 12px; flex-shrink: 0;
    background: #f1e9dd; display: flex; align-items: center; justify-content: center; font-size: 26px;
  }
  .tv-diary-body { flex: 1; min-width: 0; }
  .tv-diary-strain { font-size: 15px; font-weight: 600; color: #2b2622; letter-spacing: -0.01em; }
  .tv-diary-date { font-size: 12px; color: #766b60; margin-top: 1px; }
  .tv-diary-reading { font-size: 13px; color: #6b5d4c; margin-top: 7px; line-height: 1.4; }
  .tv-diary-amber { color: #8f6128; font-weight: 600; }
  .tv-diary-note { font-size: 13.5px; color: #5c5249; margin-top: 7px; line-height: 1.5; font-style: italic; }
  .tv-diary-tags { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 9px; }
  .tv-diary-tag { font-size: 11px; font-weight: 500; color: #6b5d4c; background: #f4ece0; border-radius: 7px; padding: 3px 9px; }
  .tv-diary-tag.shared { color: #4f6e44; background: #eef4ea; }
  .tv-diary-del {
    background: none; border: none; color: #766b60; cursor: pointer;
    font-size: 15px; min-width: 44px; min-height: 44px; margin: -10px -10px 0 0; align-self: flex-start;
  }
  .tv-diary-del:hover { color: #c0492f; }

  /* ── DIARY NOTE FIELD (on results) ── */
  .tv-note-box {
    background: #fffdfa; border: 1px solid #efe7dc; border-radius: 16px; padding: 16px; margin-bottom: 12px;
  }
  .tv-note-title { font-size: 15px; font-weight: 600; color: #2b2622; margin-bottom: 10px; }

  /* ── ACCESSIBILITY ── keyboard focus ring; no motion for people who turn it off */
  button:focus-visible, a:focus-visible { outline: 3px solid #8f6128; outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) {
    * { transition: none !important; animation: none !important; }
  }
`;

// Make a small JPEG data URL (max ~160px) from a decoded image — used as a compact
// diary thumbnail that's safe to store in localStorage without blowing the quota.
const makeThumb = (img, max = 160) => {
  try {
    const ratio = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * ratio));
    canvas.height = Math.max(1, Math.round(img.height * ratio));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.7);
  } catch { return null; }
};

// Combine several per-photo analyses into one averaged result. Research is explicit
// that a single bud is misleading (tops mature faster than lower buds), so the app
// samples multiple shots and averages them. Returns whole-number percentages.
const combineSamples = (samples) => {
  const sum = samples.reduce((a, s) => ({
    clear: a.clear + s.clear,
    milky: a.milky + s.milky,
    amber: a.amber + s.amber,
    total: a.total + s.total,
  }), { clear: 0, milky: 0, amber: 0, total: 0 });
  if (!sum.total) return null;
  const clear = Math.round((sum.clear / sum.total) * 100);
  const amber = Math.round((sum.amber / sum.total) * 100);
  const milky = Math.max(0, 100 - clear - amber); // force the three to total 100
  const avgCoverage = samples.reduce((a, s) => a + (s.coverage || 0), 0) / samples.length;
  return { clear, milky, amber, samples: samples.length, coverage: avgCoverage };
};

// The "Effect Dial". Research is clear there is no single correct harvest point —
// it depends on the effect the grower wants. So the recommendation is a function of
// BOTH the measured trichomes AND a chosen target. Each profile defines its own
// ideal amber band (per Ed Rosenthal / GrowWeedEasy / Royal Queen Seeds consensus):
//   energetic = mostly cloudy, minimal amber (<8%)   -> daytime, cerebral
//   balanced  = cloudy + 10-20% amber                -> hybrid, all-purpose
//   relaxed   = 30%+ amber                            -> nighttime, sedative
const EFFECT_PROFILES = {
  energetic: { label: "Energetic",  blurb: "Daytime, heady and clear",    amberMin: 1,  amberIdeal: 5,  amberMax: 10 },
  balanced:  { label: "Balanced",   blurb: "All-purpose, body and mind",  amberMin: 10, amberIdeal: 15, amberMax: 22 },
  relaxed:   { label: "Relaxed",    blurb: "Nighttime, heavy and sleepy", amberMin: 25, amberIdeal: 35, amberMax: 55 },
};

// Decide the harvest recommendation given measured trichomes + chosen effect goal.
const getRecommendation = ({ clear, milky, amber }, effectKey = "balanced") => {
  const p = EFFECT_PROFILES[effectKey] || EFFECT_PROFILES.balanced;

  // Still immature: too many clear heads / not enough cloudy, regardless of goal.
  if (milky < 50 || clear > 40) {
    return { stage:"Not ready", timing:"About 1–2 weeks", cls:"tv-rec-early",
      note:"Trichomes are still mostly clear, so potency hasn't peaked. Keep checking.",
      effect:"Low potency if harvested now", detail:`${clear}% clear · ${milky}% cloudy · ${amber}% amber` };
  }

  // Past the chosen window: more amber than this profile wants = over-ripe for the goal.
  if (amber > p.amberMax) {
    const veryLate = amber > 50;
    return { stage: veryLate ? "Over-ripe" : "Past the window", timing: veryLate ? "Harvest right away" : "Harvest now",
      cls:"tv-rec-late",
      note: veryLate
        ? "Heavy CBN conversion. Expect a strong, narcotic, couch-lock effect."
        : `More amber than a ${p.label.toLowerCase()} harvest calls for. Leaning sedative.`,
      effect:"Sedative, body-heavy", detail:`${amber}% amber (CBN accumulating)` };
  }

  // Inside the chosen window: ideal harvest for this goal.
  if (amber >= p.amberMin) {
    return { stage:"Harvest window", timing:"Harvest now", cls:"tv-rec-peak",
      note:`Trichomes match your ${p.label.toLowerCase()} target (${p.amberMin}–${p.amberMax}% amber). This is your window.`,
      effect:p.blurb, detail:`${milky}% cloudy · ${amber}% amber` };
  }

  // Cloudy-dominant but not yet enough amber for the chosen goal: approaching.
  const daysOut = effectKey === "energetic" ? "0–3 days" : effectKey === "balanced" ? "2–6 days" : "5–10 days";
  return { stage:"Almost there", timing:daysOut, cls:"tv-rec-window",
    note:`Cloudy and potent now. Wait for amber to reach ~${p.amberIdeal}% for your ${p.label.toLowerCase()} target, or harvest now for a more energetic effect.`,
    effect:"High THC, aromatic", detail:`${milky}% cloudy · ${amber}% amber` };
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// ON-DEVICE KEYS (all reads/writes go through `store` in planner.js)
// ─────────────────────────────────────────────────────────────────────────────
const LEGACY_PREFS_KEY = "amberly.prefs.v1"; // old "always share" setting; only deleted now
const DIARY_KEY = "amberly.diary.v1";

// A diary entry is "social-ready": id, timestamp, an author placeholder, and a
// `shared` flag that is true once the grower has shared it (followers, training, or both).
const makeDiaryEntry = ({ strain, strainType, effect, analysis, rec, note, photo, growId }) => ({
  growId: growId || null,
  id: `e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  createdAt: new Date().toISOString(),
  author: null,            // reserved: a future public handle
  shared: false,           // true once shared (cloud.js)
  strainName: strain?.name || "Unknown strain",
  strainType: strainType === "autos" ? "auto" : "photo",
  breeder: strain?.breeder || null,
  effectTarget: effect,
  reading: analysis ? { clear: analysis.clear, cloudy: analysis.milky, amber: analysis.amber, samples: analysis.samples } : null,
  recommendation: rec ? { stage: rec.stage, timing: rec.timing } : null,
  note: (note || "").slice(0, 2000),
  photo: photo || null,    // a data URL thumbnail (kept small) or null
});

// Invite links look like amberly.app/?u=username: open that grower's profile.
const INVITED_BY = new URLSearchParams(window.location.search).get("u");
// Start every launch on a clean history entry (a reload would otherwise remember an old screen).
if (INVITED_BY || window.history.state) window.history.replaceState(null, "", "/");
const LAUNCH = Date.now(); // stamps this launch's history entries; older ones just lead home

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB upload ceiling
const PHOTO_TYPES = ["indica", "sativa", "hybrid"]; // everything that isn't an autoflower

export default function Amberly() {
  const [accepted, setAccepted] = useState(hasConsent);
  const [step, setStep] = useState(cloudEnabled && INVITED_BY ? "community" : "welcome");
  const [strainType, setStrainType] = useState(null);
  const [database, setDatabase] = useState(STRAIN_DB.strains); // bundled: works offline, no fetch
  const [query, setQuery] = useState("");
  const [strain, setStrain] = useState(null);
  const [customStrain, setCustomStrain] = useState("");
  const [image, setImage] = useState(null);
  const [analysis, setAnalysis] = useState(null);  // combined/averaged result
  const [photoError, setPhotoError] = useState(""); // why the last photo(s) couldn't be read
  const [samples, setSamples] = useState([]);       // raw per-photo counts
  const [analyzing, setAnalyzing] = useState(false);
  const [effect, setEffect] = useState("balanced"); // Effect Dial selection
  const [sharing, setSharing] = useState(false);     // share sheet open
  const [signingIn, setSigningIn] = useState(false); // optional sign-in from About
  const [addingOwn, setAddingOwn] = useState(false); // inline "add your own" toggle
  const [showAbout, setShowAbout] = useState(false);
  const [accountMsg, setAccountMsg] = useState("");
  const cloudUser = useCloudUser();
  const [diary, setDiary] = useState(() => { const d = store.get(DIARY_KEY, []); return Array.isArray(d) ? d : []; });
  const [diaryNote, setDiaryNote] = useState("");        // note being typed on results
  const [savedToDiary, setSavedToDiary] = useState(null); // id of the entry saved from this reading
  const [diaryError, setDiaryError] = useState("");
  const [activeGrowId, setActiveGrowId] = useState(null); // scan launched from a grow
  const fileRef = useRef(null);
  const objectUrlsRef = useRef([]); // every blob URL we create, revoked on cleanup
  const lastFileRef = useRef(null); // most recent File, for an optional diary thumbnail
  const photosRef = useRef([]);     // this reading's decoded photos, full size, in case it's shared

  useEffect(() => { if (accepted) store.persist(); }, [accepted]);

  // Every screen is a browser-history entry, so Android's Back button and the iPhone
  // edge swipe step back through Amberly instead of closing it. `depth` counts how
  // many screens deep we are, so "Done" can jump all the way home.
  const go = useCallback((next) => {
    window.history.pushState({ step: next, depth: (window.history.state?.depth || 0) + 1, launch: LAUNCH }, "");
    setStep(next);
    window.scrollTo(0, 0);
  }, []);
  const leave = useCallback((screens = 1) => {
    const depth = window.history.state?.depth || 0;
    if (depth) window.history.go(-Math.min(screens, depth));
    else { setActiveGrowId(null); setStep("welcome"); } // opened from an invite link: nothing to go back to
  }, []);
  useEffect(() => {
    const onPop = (e) => {
      const next = e.state?.launch === LAUNCH ? e.state.step : "welcome";
      if (next === "welcome") setActiveGrowId(null);
      setStep(next);
      window.scrollTo(0, 0);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Revoke every blob URL we created when the component unmounts (no leaks).
  useEffect(() => () => {
    objectUrlsRef.current.forEach(u => { try { URL.revokeObjectURL(u); } catch {} });
    objectUrlsRef.current = [];
  }, []);

  // `filtered` is fully derived from database/type/query — compute it, don't store it.
  const filtered = useMemo(() => {
    if (!database.length) return [];
    let f = database;
    if (strainType === "autos") f = f.filter(s => s.type === "auto");
    else if (strainType === "photos") f = f.filter(s => PHOTO_TYPES.includes(s.type));
    const q = query.trim().toLowerCase();
    if (q) f = f.filter(s =>
      s.name?.toLowerCase().includes(q) || (s.breeder || "").toLowerCase().includes(q)
    );
    return f;
  }, [database, strainType, query]);

  // Decode a picked file into an <img> we can analyze, or throw a friendly error.
  // iPhone HEIC photos: Safari decodes them natively (iOS 17+), and the iOS photo
  // picker hands "image/*" inputs a JPEG anyway. Browsers that can't read HEIC get
  // the "Most Compatible" tip instead of a bundled converter.
  const decodeFile = useCallback(async (file) => {
    if (file.size > MAX_FILE_BYTES) {
      throw new Error(`"${file.name || "That photo"}" is over 10 MB. Try a smaller one.`);
    }

    const name = (file.name || "").toLowerCase();
    const looksHeic =
      file.type === "image/heic" || file.type === "image/heif" ||
      name.endsWith(".heic") || name.endsWith(".heif");

    if (!file.type.startsWith("image/") && !looksHeic) {
      throw new Error(`"${file.name || "That file"}" isn't a photo.`);
    }

    const dataUrl = await new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onerror = () => rej(new Error("Couldn't read that photo from your device."));
      reader.onload = () => res(reader.result);
      reader.readAsDataURL(file);
    });

    return new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error(looksHeic
        ? 'This browser can\'t open iPhone HEIC photos. Use Safari, or on your iPhone set Settings → Camera → Formats → "Most Compatible".'
        : "That photo's format isn't supported. Try a JPEG or PNG."));
      im.src = dataUrl;
    });
  }, []);

  // Each upload ADDS a sample (research: never trust a single bud — tops mature
  // faster than lower buds). A small blob URL is kept only for the thumbnail.
  const analyzeOneFile = useCallback(async (file) => {
    const img = await decodeFile(file);
    const counts = await analyzeImage(img);
    const preview = URL.createObjectURL(file);
    objectUrlsRef.current.push(preview);
    const thumb = makeThumb(img); // compact data URL for the diary
    return { img, counts, preview, thumb };
  }, [decodeFile]);

  // Grow-planner photos: same safe decode, bigger thumbnail, nothing analyzed.
  const fileToThumb = useCallback(async (file) => {
    const t = makeThumb(await decodeFile(file), 480);
    if (!t) throw new Error("Couldn't process that photo.");
    return t;
  }, [decodeFile]);

  // Handle one OR MANY files at once. Each is analyzed and added as a sample;
  // we report how many succeeded and surface a clear message if some failed.
  const handleFile = useCallback(async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ""; // allow re-selecting the same files later
    if (!files.length) return;

    setAnalyzing(true);

    const newCounts = [], newPhotos = [];
    let lastPreview = null;
    let lastThumb = null;
    let firstError = "";
    let noTrichomeCount = 0;

    for (const file of files) {
      try {
        const { img, counts, preview, thumb } = await analyzeOneFile(file);
        if (counts.total === 0) { noTrichomeCount++; continue; }
        newCounts.push(counts);
        newPhotos.push(img);
        lastPreview = preview;
        if (thumb) lastThumb = thumb;
      } catch (err) {
        if (!firstError) firstError = err?.message || "Couldn't read that photo.";
      }
    }

    if (newCounts.length) {
      if (lastPreview) setImage(lastPreview);
      if (lastThumb) lastFileRef.current = lastThumb; // remember for the diary
      setSavedToDiary(null);
      photosRef.current = [...photosRef.current, ...newPhotos];
      const next = [...samples, ...newCounts];
      setSamples(next);
      setAnalysis(combineSamples(next));
      setPhotoError(firstError);
    } else {
      // Nothing usable came through: say why, and keep any reading already on screen.
      setPhotoError(firstError || (noTrichomeCount
        ? "No trichomes detected. Get closer (a macro lens or loupe helps) and fill the frame with bud, not leaf."
        : "Couldn't read those photos. Please try different ones."));
    }

    setAnalyzing(false);
  }, [analyzeOneFile, samples]);

  // Throw away the current reading and its photos.
  const clearSamples = useCallback(() => {
    objectUrlsRef.current.forEach(u => { try { URL.revokeObjectURL(u); } catch {} });
    objectUrlsRef.current = [];
    photosRef.current = [];
    lastFileRef.current = null;
    setSamples([]); setAnalysis(null); setImage(null);
    setPhotoError(""); setDiaryNote(""); setSavedToDiary(null);
  }, []);

  // Lightweight "add your own": just a name. Everything else is optional and filled
  // with sensible defaults. Adds the strain, selects it, and moves on to the photo step.
  const handleAddOwn = useCallback((typed) => {
    const name = typed.trim().slice(0, 60);
    if (!name) return;
    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "strain";
    const taken = new Set(database.map(s => s.id));
    let id = base, n = 2;
    while (taken.has(id)) id = `${base}-${n++}`;
    const entry = {
      id, name,
      type: strainType === "autos" ? "auto" : "hybrid",
      breeder: "Your strain",
      rating: 0, effects: [], flavors: [], description: "",
      source: "user-added",
    };
    setDatabase(prev => [...prev, entry]);
    clearSamples();
    setStrain(entry);
    setCustomStrain(""); setQuery("");
    setAddingOwn(false);
    go("form");
  }, [strainType, database, clearSamples, go]);

  // Finished: back to the grow this scan came from, otherwise all the way home.
  const reset = useCallback(() => {
    clearSamples();
    setStrainType(null); setStrain(null); setCustomStrain(""); setQuery(""); setDiaryError("");
    leave(activeGrowId && step === "form" ? 1 : Infinity);
  }, [clearSamples, leave, activeGrowId, step]);

  const rec = analysis ? getRecommendation(analysis, effect) : null;
  const lowCoverage = analysis && analysis.coverage != null && analysis.coverage < 0.04;

  // Write the diary to storage first; only show it as saved if that worked
  // (a full device would otherwise lose entries silently).
  const persistDiary = useCallback((next) => {
    if (!store.set(DIARY_KEY, next)) {
      setDiaryError("Your device storage is full. Delete old diary entries or grow photos, then try again.");
      return false;
    }
    setDiary(next);
    setDiaryError("");
    return true;
  }, []);

  // Save the current reading to the on-device grow diary. Newest entries first,
  // capped at 200 so storage doesn't fill up; oldest entries fall off the end.
  const putInDiary = useCallback((entry) => {
    if (persistDiary([entry, ...diary.filter(e => e.id !== entry.id)].slice(0, 200))) setSavedToDiary(entry.id);
  }, [diary, persistDiary]);
  const newEntry = () => makeDiaryEntry({ strain, strainType, effect, analysis, rec, note: diaryNote, photo: lastFileRef.current, growId: activeGrowId });
  const savedEntry = diary.find(e => e.id === savedToDiary);

  const saveToDiary = () => { if (analysis) putInDiary(newEntry()); };

  // Share this reading (saving it to the diary too) with its full-size photos,
  // or change who sees it. Both switches off = stop sharing (server copy deleted).
  const shareReading = async (audience) => {
    const entry = savedEntry || newEntry();
    if (!audience.followers && !audience.training) {
      await unshare("local_id", [entry.id]);
      return putInDiary({ ...entry, shared: false, sharing: null });
    }
    const { photo, author, shared, sharing, ...data } = entry;
    // Shared on its own, not as part of a grow: stopping a grow's sharing must not delete it.
    // (Which grow it came from is still in data.growId.)
    await shareItem({ kind: "reading", localId: entry.id, data, audience,
      photos: photosRef.current.length ? photosRef.current : photo ? [photo] : [] });
    putInDiary({ ...entry, shared: true, sharing: audience });
  };

  // Jump from a grow straight into a trichome scan, pre-filled.
  const scanForGrow = useCallback((g) => {
    clearSamples();
    setActiveGrowId(g.id);
    setStrainType(g.plantType === "auto" ? "autos" : "photos");
    setStrain({ id: `grow-${g.id}`, name: g.strainName || g.name, breeder: g.breeder || "Your grow" });
    setEffect(g.effect || "balanced");
    go("form");
  }, [clearSamples, go]);
  const strainNames = useMemo(() => database.map(s => s.name), [database]);

  // Deleting a shared entry also removes the shared copy (best effort if offline).
  const deleteDiaryEntry = useCallback((id) => {
    const shared = diary.find(e => e.id === id)?.shared;
    if (!window.confirm(`Delete this diary entry?${shared ? " Its shared copy will be deleted too." : ""}`)) return;
    if (cloudEnabled && shared) unshare("local_id", [id]).catch(() => {});
    persistDiary(diary.filter(e => e.id !== id));
  }, [diary, persistDiary]);

  // Wipes everything Amberly stored on this device (privacy: right to delete).
  const deleteAllData = () => {
    if (!window.confirm("Delete all your grows, diary entries, photos, and settings from this device? This can't be undone."
      + (cloudUser ? "\n\nThings you've shared stay with BeakerBoys until you delete your account." : ""))) return;
    [LEGACY_PREFS_KEY, DIARY_KEY, GROWS_KEY, CONSENT_KEY, AUTH_KEY].forEach(store.remove);
    window.location.reload();
  };

  const removeAccount = async () => {
    if (!window.confirm("Delete your Amberly account and everything you've shared with BeakerBoys? Your grows stay on this device. This can't be undone.")) return;
    setAccountMsg("Deleting…");
    try {
      await deleteAccount();
      // Nothing is shared any more: clear the "shared" marks so the app stops showing
      // them (and stops trying to upload new grow entries).
      persistDiary(diary.map(({ sharing, ...e }) => ({ ...e, shared: false })));
      const grows = store.get(GROWS_KEY, []);
      if (Array.isArray(grows)) store.set(GROWS_KEY, grows.map(({ sharing, ...g }) => ({ ...g, shared: false, logs: (g.logs || []).map(({ synced, ...l }) => l) })));
      setAccountMsg("Your account and shared data were deleted.");
    } catch (e) { setAccountMsg(e.message); }
  };

  if (!accepted) return (
    <>
      <style>{STYLES}</style>
      <div className="tv-root"><div className="tv-container"><LegalGate onAccept={() => setAccepted(true)} /></div></div>
    </>
  );

  return (
    <>
      <style>{STYLES}</style>
      <div className="tv-root">
        <div className="tv-container">

          {/* ═══════════════════════════════════════════
              STEP: WELCOME — big, friendly, one decision
          ═══════════════════════════════════════════ */}
          {step === "welcome" && (
            <>
              <div className="tv-header">
                <div className="tv-eyebrow">Know the moment to harvest</div>
                <div className="tv-title">Amberly</div>
                <div className="tv-subtitle">
                  Point your camera at the buds. We read the trichomes and tell you when to chop.
                </div>
              </div>

              <div className="tv-hero">
                <div className="tv-hero-title">What are you growing?</div>
                <div className="tv-hero-sub">This helps us show the right strains.</div>
              </div>

              {/* One tap picks the type and moves on: no separate Continue button. */}
              <div className="tv-choice">
                <button className="tv-choice-btn" onClick={() => { setStrainType("autos"); go("strain-select"); }}>
                  <span className="tv-choice-emoji">🌱</span>
                  <span className="tv-choice-text">
                    <span className="tv-choice-name">Autoflower</span>
                    <span className="tv-choice-desc">Flowers on its own, about 8–10 weeks</span>
                  </span>
                </button>

                <button className="tv-choice-btn" onClick={() => { setStrainType("photos"); go("strain-select"); }}>
                  <span className="tv-choice-emoji">☀️</span>
                  <span className="tv-choice-text">
                    <span className="tv-choice-name">Photoperiod</span>
                    <span className="tv-choice-desc">Flowers on a light schedule, about 8–12 weeks</span>
                  </span>
                </button>
              </div>

              <button className="tv-btn tv-btn-soft" style={{ marginTop: 12 }} onClick={() => go("grows")}>
                🗓️ Grow planner &amp; calendar
              </button>

              {cloudEnabled && (
                <button className="tv-btn tv-btn-soft" style={{ marginTop: 12 }} onClick={() => go("community")}>
                  👥 Following
                </button>
              )}

              {diary.length > 0 && (
                <button className="tv-btn tv-btn-soft" style={{ marginTop: 12 }} onClick={() => go("diary")}>
                  📖 My grow diary ({diary.length})
                </button>
              )}

              <div style={{ textAlign: "center", marginTop: 14 }}>
                <button className="tv-link" onClick={() => setShowAbout(true)}>About</button>
                <a className="tv-link" href="/privacy.html" target="_blank" rel="noreferrer">Privacy</a>
                <a className="tv-link" href="/terms.html" target="_blank" rel="noreferrer">Terms</a>
              </div>
            </>
          )}

          {/* ═══════════════════════════════════════════
              STEP: STRAIN SELECTION — search, tap a card, or add your own
          ═══════════════════════════════════════════ */}
          {step === "strain-select" && (
            <>
              <button className="tv-back" onClick={() => { setAddingOwn(false); leave(); }}>
                <ArrowLeft size={17} /> Back
              </button>

              <div className="tv-dots">
                <span className="tv-dot done" />
                <span className="tv-dot active" />
                <span className="tv-dot" />
              </div>

              <div className="tv-hero">
                <div className="tv-hero-title">Pick your strain</div>
                <div className="tv-hero-sub">Tap yours to continue. Not listed? Add it below.</div>
              </div>

              <div className="tv-search-wrap">
                <Search className="tv-search-icon" size={18} />
                <input
                  className="tv-search-input"
                  placeholder="Search strains…"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                />
              </div>

              <div className="tv-gallery">
                {filtered.map(s => (
                  <button
                    key={s.id}
                    className="tv-strain-card"
                    onClick={() => { if (s.id !== strain?.id) clearSamples(); setStrain(s); go("form"); }}
                  >
                    <div className="tv-strain-name">{s.name}</div>
                    <div className="tv-strain-breeder">{s.breeder || "Unknown"}</div>
                    {s.trending && <span className="tv-strain-trending">Popular</span>}
                  </button>
                ))}
              </div>

              {/* Nothing matched the search: offer to use what they typed. */}
              {!filtered.length && query.trim() && (
                <div className="tv-addown" style={{ marginBottom: 16 }}>
                  <div className="tv-addown-q">We don't have "{query.trim()}" yet.</div>
                  <button className="tv-btn tv-btn-primary" onClick={() => handleAddOwn(query)}>Use "{query.trim().slice(0, 60)}"</button>
                </div>
              )}

              {/* Add your own: inline, just one field. */}
              {!addingOwn ? (
                <div style={{ textAlign: "center", marginBottom: 16 }}>
                  <button className="tv-link" onClick={() => setAddingOwn(true)}>
                    + Add your own strain
                  </button>
                </div>
              ) : (
                <div className="tv-addown" style={{ marginBottom: 16 }}>
                  <div className="tv-addown-q">What's it called?</div>
                  <input
                    className="tv-input"
                    placeholder="Strain name"
                    autoFocus
                    value={customStrain}
                    onChange={e => setCustomStrain(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleAddOwn(customStrain); }}
                    style={{ marginBottom: 12 }}
                  />
                  <div className="tv-btn-row" style={{ marginTop: 0 }}>
                    <button className="tv-btn tv-btn-soft" onClick={() => { setAddingOwn(false); setCustomStrain(""); }}>
                      Cancel
                    </button>
                    <button className="tv-btn tv-btn-primary" disabled={!customStrain.trim()} onClick={() => handleAddOwn(customStrain)}>
                      Add &amp; use
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ═══════════════════════════════════════════
              STEP: CAPTURE + ANALYSIS
          ═══════════════════════════════════════════ */}
          {step === "form" && (
            <>
              <button className="tv-back" onClick={() => leave()}>
                <ArrowLeft size={17} /> Back
              </button>

              <div className="tv-dots">
                <span className="tv-dot done" />
                <span className="tv-dot done" />
                <span className="tv-dot active" />
              </div>

              {strain && (
                <div className="tv-banner">
                  <div className="tv-banner-img" style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🌿</div>
                  <div>
                    <div className="tv-banner-name">{strain.name}</div>
                    <div className="tv-banner-meta">{strain.breeder || "Your strain"}</div>
                  </div>
                </div>
              )}

              {/* Effect dial */}
              <div className="tv-hero" style={{ marginBottom: 18 }}>
                <div className="tv-hero-title">What feeling do you want?</div>
                <div className="tv-hero-sub">We'll aim your harvest window for it.</div>
              </div>

              <div className="tv-dial" style={{ marginBottom: 24 }}>
                {Object.entries(EFFECT_PROFILES).map(([key, p]) => (
                  <button
                    key={key}
                    className={`tv-dial-opt ${effect === key ? "active" : ""}`}
                    onClick={() => setEffect(key)}
                  >
                    <span className="tv-dial-emoji">{key === "energetic" ? "⚡" : key === "balanced" ? "⚖️" : "🌙"}</span>
                    <span className="tv-dial-text">
                      <span className="tv-dial-label">{p.label}</span>
                      <span className="tv-dial-blurb">{p.blurb}</span>
                    </span>
                    <span className="tv-dial-amber">{p.amberMin}–{p.amberMax}%</span>
                  </button>
                ))}
              </div>

              {/* Capture */}
              <div className="tv-hero" style={{ marginBottom: 18 }}>
                <div className="tv-hero-title">Add a close-up</div>
                <div className="tv-hero-sub">{samples.length > 0 ? `${samples.length} ${samples.length === 1 ? "photo" : "photos"} added` : "A macro lens or loupe helps a lot."}</div>
              </div>

              <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFile} style={{ display: "none" }} />

              {!image ? (
                <button type="button" className="tv-upload" onClick={() => fileRef.current?.click()}>
                  <div className="tv-upload-emoji">📷</div>
                  <div className="tv-upload-text">Take or choose photos</div>
                  <div className="tv-upload-hint">One photo or several. Get close on the buds.</div>
                </button>
              ) : (
                <>
                  <img src={image} className="tv-img-preview" alt="Your most recent sample" />
                  <div className="tv-btn-row">
                    <button className="tv-btn tv-btn-soft" onClick={() => fileRef.current?.click()}>
                      <Plus size={16} /> Add another
                    </button>
                    <button className="tv-btn tv-btn-soft" onClick={clearSamples}>
                      Clear
                    </button>
                  </div>
                </>
              )}

              <div className="tv-tip">
                <b>Tip:</b> snap 3 buds: top, middle, and lower. Tops ripen first, so a few photos give a truer read than one.
              </div>

              {/* States */}
              {analyzing && <div className="tv-loading" role="status">Reading trichomes…</div>}

              {photoError && !analyzing && (
                <div className="tv-error" role="alert" style={{ marginTop: 14 }}>
                  <span className="tv-error-emoji">🔍</span>
                  <div>
                    <div className="tv-error-title">Couldn't read that one</div>
                    <div className="tv-error-msg">{photoError}</div>
                  </div>
                </div>
              )}

              {analysis && (
                <div style={{ marginTop: 24 }}>
                  {lowCoverage && (
                    <div className="tv-warn">
                      Not many trichomes in view, so this reading may be off. Try getting closer and adding another photo.
                    </div>
                  )}

                  <div className="tv-card">
                    <div className="tv-card-pad">
                      <div className="tv-section-title">Trichome reading</div>
                      <div className="tv-section-meta">
                        {analysis.samples === 1 ? "From 1 photo" : `Average of ${analysis.samples} photos`}. Orange hairs are left out.
                      </div>

                      <div className="tv-bar-row">
                        <div className="tv-bar-meta">
                          <span className="tv-bar-name">Clear · not ready</span>
                          <span className="tv-bar-pct">{analysis.clear}%</span>
                        </div>
                        <div className="tv-bar-track"><div className="tv-bar-fill tv-fill-clear" style={{ width: `${analysis.clear}%` }} /></div>
                      </div>
                      <div className="tv-bar-row">
                        <div className="tv-bar-meta">
                          <span className="tv-bar-name">Cloudy · peak THC</span>
                          <span className="tv-bar-pct">{analysis.milky}%</span>
                        </div>
                        <div className="tv-bar-track"><div className="tv-bar-fill tv-fill-cloudy" style={{ width: `${analysis.milky}%` }} /></div>
                      </div>
                      <div className="tv-bar-row">
                        <div className="tv-bar-meta">
                          <span className="tv-bar-name">Amber · relaxing</span>
                          <span className="tv-bar-pct" style={{ color: "#8f6128" }}>{analysis.amber}%</span>
                        </div>
                        <div className="tv-bar-track"><div className="tv-bar-fill tv-fill-amber" style={{ width: `${analysis.amber}%` }} /></div>
                      </div>
                    </div>
                  </div>

                  {rec && (
                    <div className={`tv-rec ${rec.cls}`}>
                      <div className="tv-rec-emoji">
                        {rec.cls === "tv-rec-peak" ? "✅" : rec.cls === "tv-rec-late" ? "🌙" : rec.cls === "tv-rec-window" ? "⏳" : "🌱"}
                      </div>
                      <div className="tv-rec-stage">{rec.stage}</div>
                      <div className="tv-rec-timing">{rec.timing}</div>
                      <div className="tv-rec-note">{rec.note}</div>
                      <div className="tv-rec-effect">{rec.effect}</div>
                      {rec.detail && <div className="tv-rec-detail">{rec.detail}</div>}
                    </div>
                  )}

                  <div className="tv-disclaimer">
                    A helpful guide, not a lab test. Trust your own eyes on the calyxes for the final call.
                  </div>

                  {/* Save to grow diary — add an optional note, then keep it on-device */}
                  {!savedToDiary ? (
                    <div className="tv-note-box">
                      <div className="tv-note-title">📖 Save to your grow diary</div>
                      <textarea
                        className="tv-textarea"
                        placeholder="Optional note, like 'Week 8, frosty, giving it 4 more days'"
                        value={diaryNote}
                        onChange={e => setDiaryNote(e.target.value)}
                        style={{ marginBottom: 12 }}
                      />
                      <button className="tv-btn tv-btn-primary" onClick={saveToDiary}>
                        Save entry
                      </button>
                      {diaryError && <div className="tv-error-msg" style={{ marginTop: 10 }}>{diaryError}</div>}
                    </div>
                  ) : (
                    <div className="tv-note-box" style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 15, color: "#4f6e44", fontWeight: 600, marginBottom: 4 }}>
                        ✓ Saved to your diary
                      </div>
                      <div style={{ fontSize: 13, color: "#766b60" }}>
                        {!savedEntry?.shared ? "Kept on this device."
                          : [savedEntry.sharing?.followers && "Shared with your followers", savedEntry.sharing?.training && "helping train Amberly"].filter(Boolean).join(" · ")}
                      </div>
                      {diaryError && <div className="tv-error-msg" style={{ marginTop: 8 }}>{diaryError}</div>}
                    </div>
                  )}

                  {/* Opt-in sharing (only when the backend is configured) */}
                  {cloudEnabled && (savedEntry?.shared ? (
                    <div style={{ textAlign: "center", marginBottom: 8 }}>
                      <button className="tv-link" onClick={() => setSharing(true)}>Change who sees this reading</button>
                    </div>
                  ) : (
                    <button className="tv-btn tv-btn-soft" style={{ marginBottom: 10 }} onClick={() => setSharing(true)}>
                      👥 Share this reading
                    </button>
                  ))}
                  {sharing && <ShareSheet what="this reading" audience={savedEntry?.sharing || undefined}
                    onShare={shareReading} onClose={() => setSharing(false)} />}

                  <button className="tv-btn tv-btn-primary" onClick={reset}>
                    Done
                  </button>
                </div>
              )}
            </>
          )}

          {step === "community" && (
            <Suspense fallback={<div className="tv-field-hint">Loading…</div>}>
              <Community openUsername={INVITED_BY} onBack={() => leave()} />
            </Suspense>
          )}

          {step === "grows" && (
            <GrowPlanner
              diary={diary}
              strainNames={strainNames}
              openId={activeGrowId}
              fileToThumb={fileToThumb}
              onScan={scanForGrow}
              onBack={() => leave()}
            />
          )}

          {/* ═══════════════════════════════════════════
              STEP: GROW DIARY
          ═══════════════════════════════════════════ */}
          {step === "diary" && (
            <>
              <button className="tv-back" onClick={() => leave()}>
                <ArrowLeft size={17} /> Home
              </button>

              <div className="tv-hero">
                <div className="tv-hero-title">Your grow diary</div>
                <div className="tv-hero-sub">
                  {diary.length > 0
                    ? `${diary.length} ${diary.length === 1 ? "entry" : "entries"}, saved on this device`
                    : "Your saved readings will appear here"}
                </div>
              </div>

              {diary.length === 0 ? (
                <div className="tv-diary-empty">
                  <div className="tv-diary-empty-emoji">🌱</div>
                  <div>After you analyze a plant, tap <b>Save entry</b> to start your diary.</div>
                </div>
              ) : (
                diary.map(e => (
                  <div key={e.id} className="tv-diary-entry">
                    {e.photo
                      ? <img className="tv-diary-thumb" src={e.photo} alt={e.strainName} />
                      : <div className="tv-diary-thumb-ph">🌿</div>}
                    <div className="tv-diary-body">
                      <div className="tv-diary-strain">{e.strainName}</div>
                      <div className="tv-diary-date">
                        {new Date(e.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                        {" · "}
                        {new Date(e.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                      </div>
                      {e.reading && (
                        <div className="tv-diary-reading">
                          {e.reading.cloudy}% cloudy · <span className="tv-diary-amber">{e.reading.amber}% amber</span>
                          {e.recommendation ? ` · ${e.recommendation.stage}` : ""}
                        </div>
                      )}
                      {e.note && <div className="tv-diary-note">"{e.note}"</div>}
                      <div className="tv-diary-tags">
                        <span className="tv-diary-tag">{e.strainType === "auto" ? "Autoflower" : "Photoperiod"}</span>
                        {EFFECT_PROFILES[e.effectTarget] && <span className="tv-diary-tag">{EFFECT_PROFILES[e.effectTarget].label}</span>}
                        {e.shared && <span className="tv-diary-tag shared">Shared</span>}
                      </div>
                    </div>
                    <button className="tv-diary-del" onClick={() => deleteDiaryEntry(e.id)} aria-label="Delete entry">✕</button>
                  </div>
                ))
              )}

              <button className="tv-btn tv-btn-primary" style={{ marginTop: 8 }} onClick={reset}>
                New analysis
              </button>
            </>
          )}

        </div>
      </div>

      {/* ═══════════════════════════════════════════
          MODAL: ABOUT (account, credits, delete data)
      ═══════════════════════════════════════════ */}
      {showAbout && (
        <div className="tv-overlay" onClick={() => setShowAbout(false)}>
          <div className="tv-modal" onClick={e => e.stopPropagation()}>
            <div className="tv-modal-pad">
              <div className="tv-modal-title">About Amberly</div>
              <p style={{ fontSize: 15, color: "#6b5d4c", lineHeight: 1.6, marginBottom: 18 }}>
                Amberly reads the color of your trichomes (the tiny resin glands on the
                buds) to estimate the best moment to harvest. Everything runs on your
                device, and nothing is shared unless you choose to share it.
              </p>
              {cloudEnabled && (
                <div className="tv-tip" style={{ marginTop: 0, marginBottom: 14 }}>
                  <b>Account</b><br />
                  {cloudUser ? <>Signed in as {cloudUser.email}<br />
                    <button className="tv-link" style={{ paddingLeft: 0 }} onClick={() => signOut().catch(e => setAccountMsg(e.message))}>Sign out</button>
                    <button className="tv-link" onClick={removeAccount}>Delete account &amp; shared data</button></>
                    : <>Not signed in. Everything works without an account; sign in only if you want to share.<br />
                      <button className="tv-link" style={{ paddingLeft: 0 }} onClick={() => setSigningIn(true)}>Sign in or create account</button></>}
                  {accountMsg && <div style={{ marginTop: 6 }}>{accountMsg}</div>}
                </div>
              )}
              <p className="tv-field-hint" style={{ marginBottom: 14 }}>
                Color rules tuned with the "trichome colour detection" and "trichomes" datasets
                from Roboflow Universe (CC BY 4.0).
              </p>
              <button className="tv-btn tv-btn-primary" onClick={() => setShowAbout(false)}>Close</button>
              <button className="tv-btn tv-btn-ghost" style={{ marginTop: 8 }} onClick={deleteAllData}>Delete all data on this device</button>
            </div>
          </div>
        </div>
      )}
      {signingIn && <ShareSheet onClose={() => setSigningIn(false)} />}
    </>
  );
}

/**
 * managed-ups-card  v1.0.0
 * Universal Lovelace card for UPS devices in Home Assistant.
 * Logic and visual DNA faithful to the original UPS rack card.
 * Works with any UPS brand/model — all entity names configurable.
 *
 * License: MIT
 */

// ─────────────────────────────────────────────────────────────────────────────
//  DEFAULTS — all neutral, no brand/model/entity hardcoded
// ─────────────────────────────────────────────────────────────────────────────
const UPS_DEFAULTS = {
  // Header
  title:    'UPS',
  logo_url: '',    // optional: /local/logo.png
  model:    '',    // shown as "Modello: X" — leave empty to hide

  // input_select for INFO panel toggle (optional)
  input_select:      '',
  input_select_none: 'None',
  info_option:       'INFO',

  // Entities — all empty, set via editor
  entity_status:    '',   // text sensor: e.g. "OL", "OL CHRG", "LB"
  entity_charge:    '',   // numeric: battery charge %
  entity_low_limit: '',   // numeric: low battery threshold %
  entity_runtime:   '',   // numeric: runtime in minutes
  entity_power:     '',   // W (display slot 0)
  entity_apparent:  '',   // VA (display slot 1)
  entity_volt_out:  '',   // V output (display slot 2)
  entity_freq_out:  '',   // Hz output (display slot 3)

  // Status values considered "online" (case-insensitive, prefix match)
  online_values: ['OL', 'ONLINE'],

  // Display cycle labels — matches order of entity_power/apparent/volt_out/freq_out
  display_slots: [
    { label: 'W',  unit: 'W'   },
    { label: 'VA', unit: 'VA'  },
    { label: 'V',  unit: 'V'   },
    { label: 'Hz', unit: 'Hz'  },
  ],

  // Runtime format — 'auto' converts minutes to Xm Ys, 'raw' shows value+unit as-is
  runtime_format: 'auto',
  runtime_label:  'Runtime:',

  // Colors
  color_body_bg:    '#1a1a1a',
  color_body_border:'#2a2a2a',
  color_lcd_bg:     '#001a33',
  color_lcd_border: '#5dade2',
  color_lcd_glow:   '#003366',
  color_lcd_text:   '#5dade2',
  color_btn_bg1:    '#222',
  color_btn_bg2:    '#111',
  color_btn_border: '#444',
  color_status_ok:  '#00ff41',
  color_status_err: '#f44336',
  color_low_line:   '#ff4d4d',
};

// ─────────────────────────────────────────────────────────────────────────────
//  CARD
// ─────────────────────────────────────────────────────────────────────────────
class ManagedUpsCard extends HTMLElement {

  constructor() {
    super();
    this.displayMode = 0;
  }

  // ── Lovelace ───────────────────────────────────────────────────────────────
  static getConfigElement() {
    return document.createElement('managed-ups-card-editor');
  }

  static getStubConfig() {
    return {
      title: 'UPS',
      model: '',
    };
  }

  setConfig(config) {
    this._config = { ...UPS_DEFAULTS, ...config };
    if (!this._config.display_slots?.length) {
      this._config.display_slots = UPS_DEFAULTS.display_slots;
    }
  }

  getCardSize() { return 8; }

  // ── connectedCallback — original reset logic ───────────────────────────────
  connectedCallback() {
    this._firstRender = undefined;
    if (this._hass && this._config?.input_select) {
      this._hass.callService('input_select', 'select_option', {
        entity_id: this._config.input_select,
        option:    this._config.input_select_none,
      });
    }
  }

  // ── hass setter — original _firstRender pattern ───────────────────────────
  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;

    if (this._firstRender === undefined) {
      this._infoStateLocal = this._config.input_select_none;
      this._firstRender    = false;
    } else {
      this._infoStateLocal = this._config.input_select
        ? (hass.states[this._config.input_select]?.state || this._config.input_select_none)
        : this._config.input_select_none;
    }

    // Original container pattern — no shadowRoot
    if (!this.content) {
      this.innerHTML = `<ha-card style="background:none;border:none;box-shadow:none;"><div id="ups-container"></div></ha-card>`;
      this.content = this.querySelector('#ups-container');
    }

    this._render(hass);
  }

  // ── State helpers ──────────────────────────────────────────────────────────
  _s(entityId) {
    if (!entityId || !this._hass) return 'N/A';
    return this._hass.states[entityId]?.state ?? 'N/A';
  }

  _isOnline(statusStr) {
    // statusStr from NUT/HA can be 'OL', 'OL CHRG', 'ol chrg', etc.
    const s = (statusStr || '').toUpperCase().trim();
    if (!s || s === 'N/A') return false;
    // online_values can be array (from JS) or space-separated string (from YAML edge case)
    const vals = Array.isArray(this._config.online_values)
      ? this._config.online_values
      : String(this._config.online_values || 'OL').split(',').map(v => v.trim());
    return vals.some(v => s.startsWith(v.toUpperCase().trim()));
  }

  _formatRuntime(rawVal) {
    const cfg = this._config;
    if (cfg.runtime_format !== 'auto') return `${rawVal} min`;
    const minutes  = parseFloat(rawVal) || 0;
    const totalSec = Math.round(minutes * 60);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${cfg.runtime_label} ${m}m ${s}s`;
  }

  // ── _render ────────────────────────────────────────────────────────────────
  _render(hass) {
    const cfg       = this._config;
    const infoState = this._infoStateLocal;

    // Read state values
    const statusRaw = this._s(cfg.entity_status);
    const isOnline  = this._isOnline(statusRaw);
    const charge    = parseFloat(this._s(cfg.entity_charge))    || 0;
    const lowLimit  = parseFloat(this._s(cfg.entity_low_limit)) || 20;
    const runtimeRaw = this._s(cfg.entity_runtime);
    const runtimeStr = this._formatRuntime(runtimeRaw);

    // Display slot cycle — entities in order: power, apparent, volt_out, freq_out
    const slotEntities = [
      cfg.entity_power,
      cfg.entity_apparent,
      cfg.entity_volt_out,
      cfg.entity_freq_out,
    ];
    const slotDefs = cfg.display_slots;
    const mode     = Math.min(this.displayMode, slotEntities.length - 1);
    const current  = {
      val:  this._s(slotEntities[mode]),
      unit: slotDefs[mode]?.unit ?? '',
    };

    // Colors — explicit fallbacks in case saved config is missing these keys
    const statusColor = isOnline
      ? (cfg.color_status_ok  || '#00ff41')
      : (cfg.color_status_err || '#f44336');
    const infoActive  = infoState === cfg.info_option;

    // Logo
    const logoHtml = cfg.logo_url
      ? `<img src="${cfg.logo_url}" alt="" onerror="this.style.display='none'"
              style="height:22px;max-width:90px;width:auto;object-fit:contain;display:block;margin-bottom:2px;">`
      : '';

    // Model line
    const modelHtml = cfg.model
      ? `<span class="model">Modello: ${cfg.model}</span>`
      : '';

    // Vent holes — 8×6 grid = 48 holes (original)
    const ventsHtml = Array(48).fill('<div class="vent-hole"></div>').join('');

    this.content.innerHTML = `
      <style>
        .ups-body {
          background: ${cfg.color_body_bg};
          width: 330px; height: 720px;
          border-radius: 12px; margin: auto; position: relative;
          color: white; padding: 25px;
          box-shadow: 20px 20px 50px rgba(0,0,0,0.8);
          overflow: hidden;
          border: 1px solid ${cfg.color_body_border};
          display: flex; flex-direction: column;
          font-family: Arial, sans-serif;
        }
        .header-row { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:35px; }
        .brand      { font-weight:800; font-size:20px; text-transform:uppercase; letter-spacing:1px; color:white; line-height:1; }
        .model      { color:${cfg.color_lcd_border}; font-size:11px; font-weight:bold; opacity:0.9; line-height:1.4; display:block; margin-top:4px; }
        .status-box { padding:6px 12px; border-radius:6px; border:2px solid; font-weight:bold; font-size:0.9em; text-transform:uppercase; color:${statusColor}; border-color:${statusColor}; }

        .main-ui  { display:flex; gap:15px; align-items:center; margin-top:10px; }
        .lcd {
          flex-grow:1;
          background:${cfg.color_lcd_bg}; border:3px solid ${cfg.color_lcd_border};
          border-radius:4px; padding:15px; color:${cfg.color_lcd_text};
          box-shadow: inset 0 0 15px ${cfg.color_lcd_glow};
          height:230px; display:flex; flex-direction:column; justify-content:space-between;
        }
        .batt-labels { display:flex; justify-content:space-between; font-size:0.75em; font-weight:bold; margin-bottom:2px; }
        .batt-bar    { height:18px; background:#000; border:1px solid ${cfg.color_lcd_border}; position:relative; }
        .batt-fill   { height:100%; background:${cfg.color_lcd_border}; width:${charge}%; transition:width 1s; }
        .low-line    { position:absolute; left:${lowLimit}%; top:-5px; bottom:-5px; width:4px; background:${cfg.color_low_line}; z-index:2; }
        .low-val     { position:absolute; left:${lowLimit}%; top:28px; font-size:11px; color:${cfg.color_low_line}; transform:translateX(-50%); font-weight:bold; }

        .display-center { text-align:center; margin-top:50px; flex-grow:1; display:flex; flex-direction:column; justify-content:center; }
        .display-val    { font-size:4.5em; font-weight:bold; line-height:1; }
        .display-unit   { font-size:0.35em; margin-left:5px; opacity:0.8; }
        .runtime        { font-size:1.1em; font-weight:bold; text-align:center; border-top:1px solid rgba(93,173,226,0.3); padding-top:10px; }

        .buttons { display:flex; flex-direction:column; gap:20px; }
        .btn {
          width:50px; height:50px; border-radius:50%;
          border:2px solid ${cfg.color_btn_border};
          background: linear-gradient(145deg, ${cfg.color_btn_bg1}, ${cfg.color_btn_bg2});
          color:${cfg.color_lcd_border}; cursor:pointer;
          display:flex; align-items:center; justify-content:center;
          box-shadow:4px 4px 8px #000; transition:all 0.1s ease; outline:none;
        }
        .btn:active { border-color:${cfg.color_lcd_border}; box-shadow:0 0 15px ${cfg.color_lcd_border}, inset 0 0 5px ${cfg.color_lcd_border}; transform:scale(0.92); }
        .btn-info   { font-size:11px; font-weight:bold;
                      color:${infoActive ? cfg.color_lcd_border : '#888'};
                      border-color:${infoActive ? cfg.color_lcd_border : cfg.color_btn_border}; }

        .vents-bottom { margin-top:auto; display:grid; grid-template-columns:repeat(8,1fr); gap:8px; padding:35px 15px; }
        .vent-hole    { height:20px; background:#080808; border-radius:2px; }

        .blink { animation:blinker 1.5s linear infinite; }
        @keyframes blinker { 50% { opacity:0.3; } }
      </style>

      <div class="ups-body">
        <div class="header-row">
          <div>
            ${logoHtml}
            <span class="brand">${cfg.title}</span>
            ${modelHtml}
          </div>
          <div class="status-box ${!isOnline ? 'blink' : ''}">${isOnline ? 'ONLINE' : statusRaw || 'OFFLINE'}</div>
        </div>

        <div class="main-ui">
          <div class="lcd">
            <div class="batt-area">
              <div class="batt-labels"><span>0%</span><span>100%</span></div>
              <div class="batt-bar">
                <div class="batt-fill"></div>
                <div class="low-line"></div>
                <div class="low-val">${lowLimit}%</div>
              </div>
            </div>
            <div class="display-center">
              <div class="display-val">${current.val}<span class="display-unit">${current.unit}</span></div>
            </div>
            <div class="runtime">${runtimeStr}</div>
          </div>

          <div class="buttons">
            <button class="btn" id="btn-up"><ha-icon icon="mdi:chevron-up"></ha-icon></button>
            <button class="btn" id="btn-down"><ha-icon icon="mdi:chevron-down"></ha-icon></button>
            <button class="btn btn-info" id="btn-info">INFO</button>
          </div>
        </div>

        <div class="vents-bottom">${ventsHtml}</div>
      </div>
    `;

    // Listeners — recreated on each render (original pattern)
    this.content.querySelector('#btn-up').onclick   = () => this._cycle(-1);
    this.content.querySelector('#btn-down').onclick = () => this._cycle(1);
    this.content.querySelector('#btn-info').onclick = () => this._toggleInfo(infoState);
  }

  // ── Cycle display mode — original pattern ──────────────────────────────────
  _cycle(dir) {
    const total = (this._config?.display_slots?.length) || 4;
    this.displayMode = (this.displayMode + dir + total) % total;
    this.render();
  }

  // Support render — original pattern for instant local update on cycle
  render() { this.hass = this._hass; }

  // ── Toggle INFO — original pattern ─────────────────────────────────────────
  _toggleInfo(currentState) {
    if (!this._config?.input_select) return;
    const nextOption = currentState === this._config.info_option
      ? this._config.input_select_none
      : this._config.info_option;
    this._hass.callService('input_select', 'select_option', {
      entity_id: this._config.input_select,
      option:    nextOption,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  VISUAL EDITOR
// ─────────────────────────────────────────────────────────────────────────────
class ManagedUpsCardEditor extends HTMLElement {

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._step = 1;
  }

  setConfig(config) {
    const prevStep = this._step;
    this._config = { ...UPS_DEFAULTS, ...config };
    if (Object.keys(config).length > 2 && this._step === 1) this._step = 2;
    // Only re-render if step changed or shadowRoot is empty (first load).
    // This prevents the editor from jumping to another page on every keystroke.
    if (this._step !== prevStep || !this.shadowRoot?.children.length) {
      this._render();
    } else {
      // Update existing picker values without re-rendering
      this._syncPickerValues();
    }
  }

  set hass(h) {
    this._hass = h;
    if (this.shadowRoot) {
      this.shadowRoot.querySelectorAll('ha-entity-picker').forEach(p => {
        p.hass = h;
        this._attachPickers();
      });
    }
  }

  _fire(cfg) {
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: cfg }, bubbles: true, composed: true,
    }));
  }

  _goStep(n) { this._step = n; this._render(); }

  // ── Helpers ────────────────────────────────────────────────────────────────
  _css() {
    return `<style>
      :host{display:block;font-family:Arial,sans-serif;font-size:13px;color:#eee;}
      .steps{display:flex;gap:0;margin-bottom:18px;border-radius:8px;overflow:hidden;}
      .step-btn{flex:1;padding:8px 4px;text-align:center;font-size:11px;font-weight:bold;
        text-transform:uppercase;letter-spacing:.5px;cursor:pointer;border:none;
        background:#1e1e1e;color:#555;transition:.2s;border-right:1px solid #333;}
      .step-btn:last-child{border-right:none;}
      .step-btn.active{background:#5dade2;color:#fff;}
      .step-btn.done{background:#0a1a2a;color:#5dade2;}
      h4{margin:16px 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:.6px;
         color:#5dade2;border-top:1px solid #2a2a2a;padding-top:12px;}
      h4.first{border-top:none;margin-top:0;}
      .row{margin-bottom:10px;}
      label{display:block;font-size:11px;color:#888;margin-bottom:3px;}
      input,select{width:100%;padding:6px 8px;border-radius:6px;border:1px solid #444;
        background:#1a1a1a;color:#fff;font-size:13px;box-sizing:border-box;}
      small{display:block;font-size:10px;color:#555;margin-top:3px;}
      .picker-row{margin-bottom:12px;}
      .picker-row label{margin-bottom:4px;}
      ha-entity-picker{display:block;}
      details{margin:6px 0 10px;}
      summary{font-size:11px;color:#5dade2;cursor:pointer;user-select:none;margin-bottom:8px;}
      .nav{display:flex;gap:8px;margin-top:16px;}
      .nav-btn{flex:1;padding:8px;border-radius:6px;border:none;cursor:pointer;font-size:13px;font-weight:bold;}
      .nav-btn.prev{background:#2a2a2a;color:#aaa;}
      .nav-btn.next{background:#5dade2;color:#fff;}
      .color-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
      .color-row{display:flex;align-items:center;gap:8px;}
      .color-row label{flex:1;margin:0;}
      .color-row input[type=color]{width:36px;height:28px;padding:2px;border-radius:4px;flex-shrink:0;}
      .hint{font-size:11px;color:#555;margin:0 0 10px;line-height:1.5;}
    </style>`;
  }

  _stepBar() {
    const labels = ['1 · Aspetto', '2 · Sensori', '3 · Opzioni'];
    return `<div class="steps">${labels.map((l, i) => {
      const n = i + 1;
      const cls = this._step === n ? 'active' : n < this._step ? 'done' : '';
      return `<button class="step-btn ${cls}" tabindex="-1" onclick="this.getRootNode().host._goStep(${n})">${l}</button>`;
    }).join('')}</div>`;
  }

  _picker(label, key, domain, hint) {
    return `<div class="picker-row" data-picker-key="${key}" data-picker-domain="${domain||''}">
      <label>${label}</label>
      <div class="picker-slot" id="picker-${key}"></div>
      ${hint ? `<small>${hint}</small>` : ''}
    </div>`;
  }

  _input(label, key, type='text', hint='') {
    const v = String(this._config?.[key] ?? '');
    return `<div class="row"><label>${label}</label>
      <input type="${type}" value="${v.replace(/"/g,'&quot;')}" data-key="${key}"
             onchange="this.getRootNode().host._ch(event)"/>
      ${hint ? `<small>${hint}</small>` : ''}</div>`;
  }

  _color(label, key) {
    const v = this._config?.[key] || '#000000';
    return `<div class="color-row"><label>${label}</label>
      <input type="color" value="${v}" data-key="${key}"
             onchange="this.getRootNode().host._ch(event)"/></div>`;
  }

  // ── Step 1: Aspetto ────────────────────────────────────────────────────────
  _renderStep1() {
    return `${this._css()}<div style="padding:16px">
      ${this._stepBar()}
      <h4 class="first">Identità</h4>
      ${this._input('Titolo', 'title')}
      ${this._input('Logo (URL immagine)', 'logo_url', 'text',
          'es. /local/logo.png — altezza fissa ~22px, non si scontra col titolo')}
      ${this._input('Modello', 'model', 'text', 'es. Ellipse PRO 1600 — lascia vuoto per nascondere')}

      <h4>Input select (pannello INFO)</h4>
      <p class="hint">Opzionale — collega la card a un input_select per attivare il pannello INFO nella tua dashboard.</p>
      ${this._picker('Input select', 'input_select', 'input_select')}
      ${this._input('Valore nessuna selezione', 'input_select_none', 'text', 'es. None oppure Nessuna')}
      ${this._input('Valore opzione INFO', 'info_option', 'text', 'es. INFO')}

      <h4>Stato online</h4>
      ${this._input('Valori "online" (virgola)', 'online_values_raw', 'text',
          'es. OL,ONLINE — stati del sensore status considerati "in rete"')}

      <div class="nav">
        <button class="nav-btn next" tabindex="-1" onclick="this.getRootNode().host._goStep(2)">Avanti → Sensori</button>
      </div>
    </div>`;
  }

  // ── Step 2: Sensori ────────────────────────────────────────────────────────
  _renderStep2() {
    return `${this._css()}<div style="padding:16px">
      ${this._stepBar()}
      <h4 class="first">Sensori principali</h4>
      ${this._picker('Stato UPS', 'entity_status', 'sensor',
          'es. OL, OL CHRG, LB — testo che indica lo stato')}
      ${this._picker('Carica batteria (%)', 'entity_charge', 'sensor')}
      ${this._picker('Soglia batteria bassa (%)', 'entity_low_limit', 'sensor',
          'Linea rossa sulla barra batteria')}
      ${this._picker('Autonomia (minuti)', 'entity_runtime', 'sensor',
          'Valore numerico in minuti — convertito automaticamente in Xm Ys')}

      <h4>Display LCD (ciclo con tasti ▲ ▼)</h4>
      ${this._picker('Slot 1 — Potenza reale', 'entity_power',    'sensor', 'es. W')}
      ${this._picker('Slot 2 — Potenza apparente', 'entity_apparent', 'sensor', 'es. VA')}
      ${this._picker('Slot 3 — Tensione uscita', 'entity_volt_out', 'sensor', 'es. V')}
      ${this._picker('Slot 4 — Frequenza uscita', 'entity_freq_out', 'sensor', 'es. Hz')}

      <div class="nav">
        <button class="nav-btn prev" tabindex="-1" onclick="this.getRootNode().host._goStep(1)">← Aspetto</button>
        <button class="nav-btn next" tabindex="-1" onclick="this.getRootNode().host._goStep(3)">→ Opzioni</button>
      </div>
    </div>`;
  }

  // ── Step 3: Opzioni & Colori ───────────────────────────────────────────────
  _renderStep3() {
    return `${this._css()}<div style="padding:16px">
      ${this._stepBar()}
      <h4 class="first">Runtime</h4>
      <div class="row"><label>Formato autonomia</label>
        <select data-key="runtime_format" onchange="this.getRootNode().host._ch(event)">
          <option value="auto"${this._config.runtime_format==='auto'?' selected':''}>Auto — converti in Xm Ys</option>
          <option value="raw"${this._config.runtime_format==='raw'?' selected':''}>Raw — mostra valore grezzo</option>
        </select>
      </div>
      ${this._input('Etichetta autonomia', 'runtime_label', 'text', 'es. Runtime: oppure Autonomia:')}

      <h4>Colori corpo</h4>
      <div class="color-grid">
        ${this._color('Sfondo UPS',      'color_body_bg')}
        ${this._color('Bordo UPS',       'color_body_border')}
        ${this._color('Bottone sfondo 1','color_btn_bg1')}
        ${this._color('Bottone sfondo 2','color_btn_bg2')}
        ${this._color('Bottone bordo',   'color_btn_border')}
        ${this._color('Linea batt. bassa','color_low_line')}
        ${this._color('Stato OK',        'color_status_ok')}
        ${this._color('Stato errore',    'color_status_err')}
      </div>

      <h4>Colori LCD</h4>
      <div class="color-grid">
        ${this._color('Sfondo LCD',   'color_lcd_bg')}
        ${this._color('Bordo LCD',    'color_lcd_border')}
        ${this._color('Glow LCD',     'color_lcd_glow')}
        ${this._color('Testo LCD',    'color_lcd_text')}
      </div>

      <div class="nav">
        <button class="nav-btn prev" tabindex="-1" onclick="this.getRootNode().host._goStep(2)">← Sensori</button>
      </div>
    </div>`;
  }

  // ── Main render ────────────────────────────────────────────────────────────

  // Update text input values without re-rendering (called on every config change
  // that doesn't change the step — prevents losing focus while typing).
  _syncPickerValues() {
    if (!this.shadowRoot) return;
    // Update text/number/select/color inputs
    this.shadowRoot.querySelectorAll('input[data-key], select[data-key]').forEach(el => {
      const key = el.dataset.key;
      const val = String(this._config?.[key] ?? '');
      if (el.type === 'color' || el.tagName === 'SELECT') {
        if (el.value !== val) el.value = val;
      } else {
        // Don't overwrite if user is actively typing (document.activeElement check)
        if (el !== document.activeElement && el.value !== val) el.value = val;
      }
    });
    // Update picker values
    this.shadowRoot.querySelectorAll('ha-entity-picker').forEach(p => {
      const row = p.closest('[data-picker-key]');
      if (!row) return;
      const key = row.dataset.pickerKey;
      const val = this._config?.[key] || '';
      if (p.value !== val) p.value = val;
    });
  }

  _render() {
    if (!this.shadowRoot) return;

    // Preserve open <details>
    const open = new Set();
    this.shadowRoot.querySelectorAll('details[open] > summary').forEach(s =>
      open.add(s.textContent.trim()));

    this.shadowRoot.innerHTML =
      this._step === 1 ? this._renderStep1() :
      this._step === 2 ? this._renderStep2() :
                         this._renderStep3();

    if (open.size) {
      this.shadowRoot.querySelectorAll('details > summary').forEach(s => {
        if (open.has(s.textContent.trim())) s.parentElement.setAttribute('open', '');
      });
    }

    requestAnimationFrame(() => this._attachPickers());
  }

  _attachPickers() {
    if (!this.shadowRoot) return;
    this.shadowRoot.querySelectorAll('[data-picker-key]').forEach(row => {
      const key    = row.dataset.pickerKey;
      const domain = row.dataset.pickerDomain;
      const slot   = row.querySelector('.picker-slot');
      if (!slot || slot.querySelector('ha-entity-picker')) return;

      const picker = document.createElement('ha-entity-picker');
      picker.setAttribute('allow-custom-entity', '');
      if (domain) picker.includeDomains = [domain];
      if (this._hass) picker.hass = this._hass;
      const current = this._config?.[key] || '';
      if (current) picker.value = current;

      picker.addEventListener('value-changed', e => {
        const val = e.detail?.value ?? '';
        if (val === (this._config?.[key] || '')) return;
        this._config = { ...this._config, [key]: val };
        this._fire(this._config);
        picker.value = val;
      });

      slot.appendChild(picker);
    });
  }

  _ch(e) {
    const key = e.target.dataset.key;
    const val = e.target.value;
    const cfg = { ...this._config };

    if (key === 'online_values_raw') {
      cfg.online_values = val.split(',').map(v => v.trim()).filter(Boolean);
      this._config = cfg; this._fire(cfg); return;
    }
    cfg[key] = val;
    this._config = cfg;
    this._fire(cfg);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  REGISTRATION
// ─────────────────────────────────────────────────────────────────────────────
customElements.define('managed-ups-card', ManagedUpsCard);
customElements.define('managed-ups-card-editor', ManagedUpsCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type:             'managed-ups-card',
  name:             'Managed UPS Card',
  description:      'Card universale per UPS in Home Assistant. Qualsiasi brand/modello, display LCD con ciclo di valori, barra batteria con soglia, pulsante INFO collegabile a pannello dashboard.',
  preview:          true,
  documentationURL: 'https://github.com/YOUR_USERNAME/managed-ups-card',
});

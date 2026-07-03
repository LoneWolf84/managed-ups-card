# 🔋 Managed UPS Card

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/integration)
[![GitHub release](https://img.shields.io/github/v/release/YOUR_USERNAME/managed-ups-card)](https://github.com/YOUR_USERNAME/managed-ups-card/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Card Lovelace universale per UPS in Home Assistant — qualsiasi brand e modello, editor visivo in 3 step.

## Caratteristiche

| | |
|---|---|
| **Display LCD retro** | Ciclo di 4 valori (W, VA, V, Hz) con tasti ▲ ▼ |
| **Barra batteria** | Livello carica con indicatore rosso soglia bassa |
| **Runtime automatico** | Converte minuti in Xm Ys |
| **Badge stato** | ONLINE (verde) / OFFLINE (rosso lampeggiante) |
| **Pulsante INFO** | Collega a un input_select per mostrare un pannello dettagli |
| **Logo personalizzabile** | URL immagine locale |
| **Colori configurabili** | Corpo, LCD, bottoni, stato — tutto personalizzabile |
| **Editor visivo 3 step** | Niente YAML a mano necessario |

## Installazione

### HACS (consigliato)

1. HACS → Frontend → menu (⋮) → Repository personalizzati
2. Aggiungi questo repository come tipo **Dashboard**
3. Cerca **Managed UPS Card** e installa

### Manuale

1. Scarica `managed-ups-card.js` dall'[ultima release](https://github.com/YOUR_USERNAME/managed-ups-card/releases/latest)
2. Copialo in `config/www/managed-ups-card.js`
3. Aggiungi la risorsa in Impostazioni → Dashboard → Risorse:
   ```yaml
   url: /local/managed-ups-card.js
   type: module
   ```

## Configurazione

### Tramite editor visivo

1. **Add card** → cerca **Managed UPS Card**
2. **Step 1 — Aspetto**: titolo, logo, modello, input_select per INFO, valori "online"
3. **Step 2 — Sensori**: stato UPS, carica batteria, soglia bassa, runtime, 4 slot display LCD
4. **Step 3 — Opzioni**: formato runtime, colori corpo e LCD

### Esempio YAML minimo

```yaml
type: custom:managed-ups-card
title: UPS
model: Ellipse PRO 1600
entity_status:    sensor.ups_status
entity_charge:    sensor.ups_battery_charge
entity_low_limit: sensor.ups_battery_low_threshold
entity_runtime:   sensor.ups_runtime
entity_power:     sensor.ups_real_power
entity_apparent:  sensor.ups_apparent_power
entity_volt_out:  sensor.ups_output_voltage
entity_freq_out:  sensor.ups_output_frequency
online_values:
  - OL
  - ONLINE
runtime_label: "Autonomia:"
```

### Esempio YAML con INFO e logo

```yaml
type: custom:managed-ups-card
title: UPS
logo_url: /local/ups-logo.png
model: Ellipse PRO 1600
input_select:      input_select.ups_info_toggle
input_select_none: Nessuna
info_option:       INFO
entity_status:    sensor.ups_status
entity_charge:    sensor.ups_battery_charge
entity_low_limit: sensor.ups_battery_low_threshold
entity_runtime:   sensor.ups_runtime
entity_power:     sensor.ups_real_power
entity_apparent:  sensor.ups_apparent_power
entity_volt_out:  sensor.ups_output_voltage
entity_freq_out:  sensor.ups_output_frequency
online_values:
  - OL
  - OL CHRG
  - ONLINE
runtime_format: auto
runtime_label: "Autonomia:"
```

## Opzioni di configurazione

| Opzione | Default | Descrizione |
|---|---|---|
| `title` | `UPS` | Titolo mostrato in alto |
| `logo_url` | `""` | URL immagine logo (es. `/local/logo.png`) |
| `model` | `""` | Modello UPS — lascia vuoto per nascondere |
| `input_select` | `""` | Entità input_select per toggle INFO |
| `input_select_none` | `None` | Valore "nessuna selezione" |
| `info_option` | `INFO` | Valore che attiva il pannello INFO |
| `entity_status` | `""` | Sensore stato UPS (es. `OL`, `LB`) |
| `entity_charge` | `""` | Sensore carica batteria (%) |
| `entity_low_limit` | `""` | Sensore soglia batteria bassa (%) |
| `entity_runtime` | `""` | Sensore autonomia (minuti) |
| `entity_power` | `""` | Sensore potenza reale (W) |
| `entity_apparent` | `""` | Sensore potenza apparente (VA) |
| `entity_volt_out` | `""` | Sensore tensione uscita (V) |
| `entity_freq_out` | `""` | Sensore frequenza uscita (Hz) |
| `online_values` | `[OL, ONLINE]` | Valori stato considerati "online" |
| `runtime_format` | `auto` | `auto` = converti min in Xm Ys, `raw` = valore grezzo |
| `runtime_label` | `Runtime:` | Etichetta riga autonomia |
| `color_body_bg` | `#1a1a1a` | Sfondo corpo UPS |
| `color_lcd_bg` | `#001a33` | Sfondo LCD |
| `color_lcd_border` | `#5dade2` | Bordo e colore testo LCD |
| `color_status_ok` | `#00ff41` | Colore badge ONLINE |
| `color_status_err` | `#f44336` | Colore badge OFFLINE |

## Pannello INFO

Il pulsante **INFO** sulla card non mostra un pannello interno — attiva invece un `input_select` in Home Assistant. Puoi usarlo nella tua dashboard per condizionare la visibilità di una card con i dettagli dell'UPS:

```yaml
# input_select.yaml
ups_info_toggle:
  name: UPS Info Toggle
  options:
    - Nessuna
    - INFO
  icon: mdi:information
```

```yaml
# Dashboard — card condizionale
type: conditional
conditions:
  - condition: state
    entity: input_select.ups_info_toggle
    state: INFO
card:
  type: entities
  title: Informazioni UPS
  entities:
    - sensor.ups_battery_chemistry
    - sensor.ups_nominal_power
    # ... altri sensori
```

## Struttura repository

```
managed-ups-card/
├── managed-ups-card.js    ← la card
├── hacs.json
├── info.md
├── README.md
└── LICENSE
```

## Licenza

MIT

import { UIHelpers } from '../UIHelpers.js';
import { Calendar } from '../Calendar.js';

export class RadioKitsModule {
    constructor(container, firebaseService, user, userRoles, isAdmin, courseId) {
        this.courseId = courseId;
        this.container = container;
        this.firebaseService = firebaseService;
        this.user = user;
        this.userRoles = userRoles;
        this.isAdmin = isAdmin;
        this.isTic = userRoles.includes('equipo_tic') || isAdmin;

        this.currentDate = new Date();

        // Navigation from Calendar
        const pendingDate = localStorage.getItem('pendingDate');
        if (pendingDate) {
            this.currentDate = new Date(pendingDate);
            localStorage.removeItem('pendingDate');
        }
        this.radioKits = [];
        this.reservations = [];

        window.currentRadioKitsModule = this;

        // Interactive Mixer logic from tic2
        window.mixerMessages = {
            'phantom': '🔴 <strong>Phantom Power (48V)</strong>: ¡Cuidado! Enciende los micrófonos de condensador. Baja los faders antes de tocarlo para evitar ruidos fuertes.',
            'gain': '🎛️ <strong>Ganancia (Gain)</strong>: Sensibilidad de entrada. Si hablas bajo, súbela. Si saturas (rojo), bájala. NO se usa para mezclar volúmenes musicales.',
            'eq_hi': '🔵 <strong>EQ High (Agudos)</strong>: Gíralo a la derecha para dar "brillo" a la voz, o a la izquierda para quitar sonidos sibilantes (la "S").',
            'eq_low': '🔵 <strong>EQ Low (Graves)</strong>: Súbelo para conseguir esa "voz profunda" de radio, bájalo para eliminar zumbidos graves de la sala.',
            'mute': '🔇 <strong>MUTE</strong>: ¡Corta la señal de golpe! Úsalo si el locutor de este micro empieza a toser repentinamente.',
            'pfl': '🎧 <strong>PFL (Pre-Fade Listen)</strong>: Pulsa esto para escuchar este micro por tus auriculares ANTES de subirle el Fader. Perfecto para pruebas de sonido secretas.',
            'fader': '🎚️ <strong>Fader de Volumen</strong>: La herramienta principal. Súbelo hasta el 0 (verde) para que el locutor salga en directo. Súbelo y bájalo con suavidad.'
        };
        window.mixerState = { phantom: false, mute: false, pfl: false, knobs: { gain: 0, eq_hi: 0, eq_low: 0 } };

        window.showMixerInfo = function(control) {
            const box = document.getElementById('mixer-info-box');
            if(!box) return;
            box.innerHTML = window.mixerMessages[control];
            box.style.transform = 'scale(1.02)';
            setTimeout(() => box.style.transform = 'scale(1)', 150);
        };
        window.togglePhantom = function() {
            window.mixerState.phantom = !window.mixerState.phantom;
            const btn = document.getElementById('btn-phantom');
            if(window.mixerState.phantom) {
              btn.style.boxShadow = '0 1px 0 #900, 0 2px 3px rgba(0,0,0,0.3)';
              btn.style.transform = 'translateY(2px)';
              btn.style.background = '#ff6b6b';
            } else {
              btn.style.boxShadow = '0 3px 0 #900, 0 4px 6px rgba(0,0,0,0.3)';
              btn.style.transform = 'translateY(0)';
              btn.style.background = '#e74c3c';
            }
            window.showMixerInfo('phantom');
        };
        window.toggleButton = function(id, color) {
            window.mixerState[id] = !window.mixerState[id];
            const btn = document.getElementById('btn-' + id);
            if(window.mixerState[id]) {
              btn.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.5)';
              btn.style.transform = 'translateY(3px)';
              btn.style.background = '#fff';
            } else {
              btn.style.boxShadow = '0 3px 0 rgba(0,0,0,0.5)';
              btn.style.transform = 'translateY(0)';
              btn.style.background = color;
            }
            window.showMixerInfo(id);
        };
        window.turnKnob = function(id) {
            window.mixerState.knobs[id] = (window.mixerState.knobs[id] + 45) % 360;
            if(window.mixerState.knobs[id] > 135 && window.mixerState.knobs[id] < 225) window.mixerState.knobs[id] = 225;
            document.getElementById('knob-' + id).style.transform = 'rotate(' + window.mixerState.knobs[id] + 'deg)';
            window.showMixerInfo(id);
        };
        window.updateFader = function(val) {
            document.getElementById('fader-cap').style.bottom = val + '%';
        };

        // Define fixed slots
        this.slots = [
            { index: 0, label: '08:00 - 09:00' },
            { index: 1, label: '09:00 - 10:00' },
            { index: 2, label: '10:00 - 11:00' },
            { index: 3, label: '11:00 - 11:30 (R)' },
            { index: 4, label: '11:30 - 12:30' },
            { index: 5, label: '12:30 - 13:30' },
            { index: 6, label: '13:30 - 14:30' }
        ];

        this.render();
    }

    async render() {
        this.container.innerHTML = `
            <div class="module-header mb-4">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <h2><i class="fas fa-microphone-alt me-2"></i>Reserva de Kits de Radio</h2>
                        <p class="text-muted">Reserva kits de radio para tus clases.</p>
                    </div>
                    <button class="btn btn-outline-info" data-bs-toggle="modal" data-bs-target="#radio-info-modal">
                        <i class="fas fa-info-circle me-1"></i> Ver más información
                    </button>
                </div>
            </div>

            <!-- Info Modal -->
            <div class="modal fade" id="radio-info-modal" tabindex="-1">
                <div class="modal-dialog modal-xl modal-dialog-scrollable">
                    <div class="modal-content">
                        <div class="modal-header">
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body text-start" style="padding: 0;">
                            
<style>

    :root {
      --primary: #4a90e2;
      --secondary: #2c3e50;
      --accent: #e67e22;
      --bg: #f8f9fa;
    }
    .radio-theory-block { 
      font-family: system-ui, -apple-system, sans-serif; 
      line-height: 1.7; 
      padding: 30px; 
      max-width: 800px; 
      margin: auto; 
      color: #333; 
      background-color: var(--bg);
    }
    .topic-header {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 3px solid var(--primary);
    }
    .radio-theory-block h1 { color: var(--secondary); margin-bottom: 5px; font-size: 2.2rem; }
    .subtitle { color: #666; font-size: 1.2rem; margin-top: 0; font-style: italic; }
    .header-img { margin-top: 20px; }
    .radio-theory-block h2 { color: var(--primary); margin-top: 40px; border-left: 4px solid var(--primary); padding-left: 10px; }
    .radio-theory-block h3 { color: var(--secondary); }
    .radio-theory-block p { margin-bottom: 15px; font-size: 1.05rem; }
    .radio-theory-block ul, .radio-theory-block ol { margin-bottom: 20px; font-size: 1.05rem; }
    .radio-theory-block li { margin-bottom: 10px; }
    .radio-theory-block code { background: #e9ecef; padding: 3px 6px; border-radius: 4px; color: #c0392b; font-family: monospace; }
    .radio-theory-block pre { background: #2c3e50; color: #ecf0f1; padding: 15px; border-radius: 8px; overflow-x: auto; font-size: 0.95rem; }
    pre .radio-theory-block code { background: none; color: inherit; padding: 0; }
    .info-box { background: #fff; border: 1px solid #dee2e6; border-left: 5px solid var(--accent); padding: 20px; border-radius: 4px; margin: 25px 0; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
    .info-box .radio-theory-block h3 { margin-top: 0; color: var(--accent); }
    .task-link { margin-top: 40px; text-align: center; padding: 20px; background: #e8f4f8; border-radius: 8px; font-size: 1.1rem; color: #0056b3; border: 1px dashed #4a90e2; }
  
</style>
<div class="radio-theory-block">
<header class="topic-header">
      <h1>3. Producción de Radio y Edición (Audacity)</h1>
      <p class="subtitle">Hardware, grabación en directo y postproducción sonora.</p>
      <div style="font-size: 5rem; text-align: center; margin-top: 20px; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.2));">🎙️🎛️</div>
    </header>
    
    <section>
      <h2>1. El Estudio de Radio (Hardware y Conexiones)</h2>
      <p>Para grabar un podcast profesional en directo, no basta con un micrófono USB. Necesitamos centralizar todas las entradas y salidas en una <strong>Mesa de Mezclas</strong>.</p>
      
      <div style="background: #2c3e50; padding: 25px; border-radius: 8px; margin: 25px 0; color: white;">
        <h3 style="color: #3498db; margin-top: 0; text-align: center;">Croquis de Conexión del Estudio</h3>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 20px; flex-wrap: wrap; gap: 15px;">
          
          <!-- Izquierda: Micros y PC Out -->
          <div style="display: flex; flex-direction: column; gap: 15px; flex: 1;">
            <div style="background: #34495e; padding: 10px; border-radius: 5px; border-right: 4px solid #e74c3c; text-align: center;">
              <strong>🎙️ 4 Micrófonos</strong><br>
              <small>Cables XLR (Canon) a Canales 1-4</small>
            </div>
            <div style="background: #34495e; padding: 10px; border-radius: 5px; border-right: 4px solid #f1c40f; text-align: center;">
              <strong>💻 Salida Audio PC</strong><br>
              <small>Cable Minijack a doble Jack 6.3mm</small>
            </div>
          </div>
          
          <!-- Centro: Mesa -->
          <div style="flex: 1.5; text-align: center; background: #ecf0f1; color: #333; padding: 20px; border-radius: 10px; border: 3px solid #7f8c8d; box-shadow: 0 5px 15px rgba(0,0,0,0.3);">
            <img src="docs/EFX8-2-1.png" alt="Mesa de mezclas Soundcraft EFX8" style="width: 100%; max-width: 250px; border-radius: 5px; margin-bottom: 10px; mix-blend-mode: multiply;">
            <h3 style="margin: 0;">Mesa de Mezclas</h3>
            <p style="font-size: 0.8rem; margin: 5px 0 0 0;">Procesa, ecualiza y suma todas las señales de audio en una sola mezcla estéreo.</p>
          </div>

          <!-- Derecha: PC In -->
          <div style="display: flex; flex-direction: column; gap: 15px; flex: 1;">
            <div style="background: #34495e; padding: 10px; border-radius: 5px; border-left: 4px solid #2ecc71; text-align: center; height: 100%; display: flex; flex-direction: column; justify-content: center;">
              <strong>🎧 Audacity (PC)</strong><br>
              <small>Recibe la mezcla final por USB</small>
            </div>
          </div>
          
        </div>
      </div>

      <ul>
        <li><strong>Los Micrófonos (Phantom Power):</strong> Usamos cables <strong>XLR (Canon)</strong>. Como son micrófonos de condensador de alta calidad, necesitan energía eléctrica para funcionar. La mesa tiene un botón general llamado <strong>Phantom Power (48V)</strong> que envía corriente a los micros por el propio cable de audio. ¡Sin este botón encendido, no graban nada!</li>
        <li><strong>Entrada de efectos (Canal 8):</strong> La salida de auriculares del ordenador se conecta con un cable <strong>Minijack a doble Jack 6.3mm</strong> a un canal estéreo (ej. 7/8) de la mesa. Por aquí entrará la música y los aplausos.</li>
        <li><strong>Salida de grabación (USB):</strong> La mesa envía todo el batiburrillo sonoro ya mezclado por un cable digital USB de vuelta al ordenador. Ese cable USB es el que seleccionamos como "Micrófono" dentro del programa <strong>Audacity</strong> para grabarlo.</li>
      </ul>

      <div style="margin: 30px 0; background: #fff; padding: 20px; border-radius: 8px; border: 1px solid #ddd;">
        <h3 style="color: #2c3e50; margin-top: 0; border-bottom: 2px solid #ecf0f1; padding-bottom: 10px;">🔌 Tipos de cables del Estudio</h3>
        <p style="font-size: 0.95rem; color: #555;">Es vital que sepáis identificar qué cable va en cada agujero de la mesa para no romper ningún pin:</p>
        
        <div style="display: flex; gap: 20px; flex-wrap: wrap; margin-top: 20px;">
          
          <!-- XLR -->
          <div style="flex: 1; min-width: 200px; text-align: center; padding: 15px; background: #f8f9fa; border-radius: 6px;">
            <svg viewBox="0 0 100 100" style="width: 60px; height: 60px; margin: 0 auto; display: block;">
              <!-- Exterior -->
              <circle cx="50" cy="50" r="45" fill="#bdc3c7" stroke="#7f8c8d" stroke-width="4"/>
              <circle cx="50" cy="50" r="35" fill="#2c3e50"/>
              <!-- Muesca -->
              <rect x="45" y="10" width="10" height="15" fill="#bdc3c7"/>
              <!-- Pines -->
              <circle cx="50" cy="35" r="4" fill="#ecf0f1"/>
              <circle cx="35" cy="60" r="4" fill="#ecf0f1"/>
              <circle cx="65" cy="60" r="4" fill="#ecf0f1"/>
            </svg>
            <h4 style="margin: 10px 0 5px 0; color: #c0392b;">Cable XLR (Canon)</h4>
            <p style="font-size: 0.8rem; margin: 0; color: #666;">Tiene 3 pines. Es el cable balanceado profesional que usamos para los <strong>Micrófonos</strong>. Permite enviar la corriente Phantom (48V).</p>
          </div>

          <!-- Minijack a Jack -->
          <div style="flex: 1; min-width: 200px; text-align: center; padding: 15px; background: #f8f9fa; border-radius: 6px;">
            <svg viewBox="0 0 100 100" style="width: 60px; height: 60px; margin: 0 auto; display: block;">
              <!-- Minijack Central (Arriba) -->
              <rect x="45" y="0" width="10" height="20" fill="#333" rx="1"/>
              <rect x="47.5" y="-15" width="5" height="15" fill="#bdc3c7"/>
              <rect x="47.5" y="-10" width="5" height="1" fill="#2c3e50"/>
              <rect x="47.5" y="-5" width="5" height="1" fill="#2c3e50"/>
              <!-- Cables Y -->
              <path d="M 50 20 Q 50 40 25 50" fill="none" stroke="#333" stroke-width="3"/>
              <path d="M 50 20 Q 50 40 75 50" fill="none" stroke="#333" stroke-width="3"/>
              <!-- Jack Izquierdo -->
              <rect x="17" y="50" width="16" height="30" fill="#333" rx="2"/>
              <rect x="21" y="80" width="8" height="20" fill="#bdc3c7"/>
              <rect x="21" y="90" width="8" height="2" fill="#2c3e50"/>
              <!-- Jack Derecho -->
              <rect x="67" y="50" width="16" height="30" fill="#333" rx="2"/>
              <rect x="71" y="80" width="8" height="20" fill="#bdc3c7"/>
              <rect x="71" y="90" width="8" height="2" fill="#c0392b"/> <!-- Red ring for right channel -->
            </svg>
            <h4 style="margin: 10px 0 5px 0; color: #2980b9;">Minijack a Doble Jack</h4>
            <p style="font-size: 0.8rem; margin: 0; color: #666;">El extremo pequeño (Minijack estéreo) va a la salida de auriculares del PC. Los dos extremos grandes (Jacks 6.3mm) van a las estradas L y R del canal estéreo de la mesa.</p>
          </div>

          <!-- Jack -->
          <div style="flex: 1; min-width: 200px; text-align: center; padding: 15px; background: #f8f9fa; border-radius: 6px;">
            <svg viewBox="0 0 100 100" style="width: 60px; height: 60px; margin: 0 auto; display: block; transform: rotate(45deg);">
              <!-- Base -->
              <rect x="40" y="50" width="20" height="50" fill="#333" rx="3"/>
              <!-- Clavija -->
              <rect x="45" y="15" width="10" height="35" fill="#bdc3c7"/>
              <path d="M 45 15 L 50 5 L 55 15 Z" fill="#bdc3c7"/>
              <!-- Anillos negros -->
              <rect x="45" y="25" width="10" height="2" fill="#2c3e50"/>
              <rect x="45" y="35" width="10" height="2" fill="#2c3e50"/>
            </svg>
            <h4 style="margin: 10px 0 5px 0; color: #27ae60;">Jack 6.3mm (1/4")</h4>
            <p style="font-size: 0.8rem; margin: 0; color: #666;">El clásico "Jack gordo" de toda la vida. Lo utilizamos en la salida frontal de la mesa para enchufar nuestros <strong>auriculares</strong>.</p>
          </div>

        </div>
      </div>

    </section>

    <section>
      <h2>2. Anatomía de la Mesa de Mezclas del Instituto</h2>
      <p>Nuestra mesa analógica profesional tiene muchísimas ruletas y botones, pero nos centraremos en los controles vitales del panel frontal. Cada canal por el que entra un micrófono tiene una tira vertical de controles. De arriba abajo, estos son los más importantes:</p>
      
      
      <!-- Display Box Interactivo (Visor superior) -->
      <div id="mixer-info-box" style="background: #1a1a2e; color: #4cd137; padding: 15px 25px; border-radius: 8px; font-size: 1.05rem; min-height: 50px; display: flex; align-items: center; border: 2px solid #2f3640; box-shadow: inset 0 0 10px rgba(0,0,0,0.8), 0 5px 15px rgba(0,0,0,0.1); margin-bottom: 25px; font-family: monospace;">
        <em>&gt; SISTEMA LISTO. Haz clic y arrastra el fader, gira las ruletas o pulsa los botones de la mesa...</em>
      </div>
      <div style="display: flex; gap: 20px; flex-wrap: wrap;">
        
        <!-- Diagrama del Canal de Mezcla REAL INTERACTIVO -->
        <div style="flex: 0 0 200px; display: flex; flex-direction: column; gap: 15px; user-select: none;">
          
          <div style="background: linear-gradient(to bottom, #ecf0f1, #bdc3c7); border-radius: 8px; padding: 20px 15px; border: 2px solid #7f8c8d; display: flex; flex-direction: column; align-items: center; justify-content: space-between; height: 450px; box-shadow: inset 0 0 10px rgba(0,0,0,0.1), 0 10px 25px rgba(0,0,0,0.2);">
            
            <div style="background: #f1c40f; color: #000; width: 100%; text-align: center; font-size: 0.85rem; font-weight: bold; font-family: monospace; padding: 4px; box-shadow: 1px 1px 3px rgba(0,0,0,0.2); transform: rotate(-2deg); margin-bottom: 10px;">CH 1 (MIC)</div>
            
            <div style="text-align: right; width: 100%; margin-bottom: 5px;">
               <button id="btn-phantom" onclick="togglePhantom()" style="background: #e74c3c; color: white; border: 2px solid #c0392b; border-radius: 4px; font-size: 0.6rem; font-weight: bold; cursor: pointer; padding: 4px 6px; box-shadow: 0 3px 0 #900, 0 4px 6px rgba(0,0,0,0.3); transition: all 0.1s;">+48V Phantom</button>
            </div>

            <div style="text-align: center; margin-bottom: 15px; cursor: pointer;" onclick="turnKnob('gain')">
              <div style="font-size: 0.75rem; color: #2c3e50; font-weight: bold; margin-bottom: 4px;">GAIN</div>
              <div id="knob-gain" style="width: 36px; height: 36px; border-radius: 50%; background: #c0392b; border: 3px solid #2c3e50; position: relative; box-shadow: 0 4px 6px rgba(0,0,0,0.3); margin: 0 auto; transition: transform 0.2s;">
                <div style="width: 4px; height: 12px; background: #fff; position: absolute; top: 2px; left: 13px; border-radius: 2px;"></div>
              </div>
            </div>
            
            <div style="display:flex; flex-direction: column; gap: 10px; margin-bottom: 15px;">
              <div style="text-align: center; cursor: pointer;" onclick="turnKnob('eq_hi')">
                <div style="font-size: 0.65rem; color: #7f8c8d; font-weight: bold;">EQ HI</div>
                <div id="knob-eq_hi" style="width: 28px; height: 28px; border-radius: 50%; background: #2980b9; border: 2px solid #2c3e50; position: relative; margin: 0 auto; box-shadow: 0 2px 4px rgba(0,0,0,0.2); transition: transform 0.2s;">
                   <div style="width: 3px; height: 10px; background: #fff; position: absolute; top: 2px; left: 10.5px; border-radius: 2px;"></div>
                </div>
              </div>
              <div style="text-align: center; cursor: pointer;" onclick="turnKnob('eq_low')">
                <div style="font-size: 0.65rem; color: #7f8c8d; font-weight: bold;">EQ LOW</div>
                <div id="knob-eq_low" style="width: 28px; height: 28px; border-radius: 50%; background: #2980b9; border: 2px solid #2c3e50; position: relative; margin: 0 auto; box-shadow: 0 2px 4px rgba(0,0,0,0.2); transition: transform 0.2s;">
                   <div style="width: 3px; height: 10px; background: #fff; position: absolute; top: 2px; left: 10.5px; border-radius: 2px;"></div>
                </div>
              </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 12px; width: 100%; margin-bottom: 15px;">
              <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.4); padding: 5px; border-radius: 4px;">
                <div style="font-size: 0.8rem; color: #2c3e50; font-weight: bold;">MUTE</div>
                <div id="btn-mute" onclick="toggleButton('mute', '#e74c3c')" style="width: 24px; height: 14px; background: #e74c3c; border-radius: 3px; box-shadow: 0 3px 0 #900; border: 1px solid #c0392b; cursor: pointer; transition: all 0.1s;"></div>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.4); padding: 5px; border-radius: 4px;">
                <div style="font-size: 0.8rem; color: #2c3e50; font-weight: bold;">PFL</div>
                <div id="btn-pfl" onclick="toggleButton('pfl', '#f1c40f')" style="width: 24px; height: 14px; background: #f1c40f; border-radius: 3px; box-shadow: 0 3px 0 #b8860b; border: 1px solid #d35400; cursor: pointer; transition: all 0.1s;"></div>
              </div>
            </div>

            <div style="text-align: center; width: 100%; flex-grow: 1; display: flex; flex-direction: column; justify-content: flex-end;">
              <div style="width: 10px; height: 120px; background: #2c3e50; margin: 0 auto; border-radius: 5px; position: relative; box-shadow: inset 0 3px 6px rgba(0,0,0,0.8);">
                <div style="width: 2px; height: 110px; background: #000; position: absolute; left: 4px; top: 5px;"></div>
                
                <!-- HTML5 Range input (vertical) for the fader -->
                <input type="range" min="0" max="100" value="70" id="fader-input" style="writing-mode: bt-lr; -webkit-appearance: slider-vertical; appearance: slider-vertical; width: 34px; height: 120px; position: absolute; left: -12px; top: 0; margin: 0; opacity: 0; cursor: pointer; z-index: 10;" oninput="updateFader(this.value)" onchange="showMixerInfo('fader')">
                
                <div id="fader-cap" style="width: 34px; height: 20px; background: linear-gradient(to bottom, #ecf0f1, #95a5a6); border-radius: 3px; position: absolute; bottom: 70%; left: -12px; box-shadow: 0 4px 8px rgba(0,0,0,0.4); border: 1px solid #7f8c8d; pointer-events: none; z-index: 5;">
                  <div style="width: 100%; height: 3px; background: #c0392b; margin-top: 8px;"></div>
                </div>
                
                <div style="position: absolute; left: -25px; top: 10px; font-size: 0.6rem; color: #34495e; font-weight:bold;">+10</div>
                <div style="position: absolute; left: -20px; top: 80px; font-size: 0.6rem; color: #27ae60; font-weight:bold;">0</div>
                <div style="position: absolute; left: -22px; top: 100px; font-size: 0.6rem; color: #34495e; font-weight:bold;">-∞</div>
              </div>
              <div style="font-size: 0.8rem; color: #2c3e50; font-weight: bold; margin-top: 15px;">FADER</div>
            </div>
            
          </div>

        </div>

        <script>
          const mixerMessages = {
            'phantom': '🔴 <strong>Phantom Power (48V)</strong>: ¡Cuidado! Enciende los micrófonos de condensador. Baja los faders antes de tocarlo para evitar ruidos fuertes.',
            'gain': '🎛️ <strong>Ganancia (Gain)</strong>: Sensibilidad de entrada. Si hablas bajo, súbela. Si saturas (rojo), bájala. NO se usa para mezclar volúmenes musicales.',
            'eq_hi': '🔵 <strong>EQ High (Agudos)</strong>: Gíralo a la derecha para dar "brillo" a la voz, o a la izquierda para quitar sonidos sibilantes (la "S").',
            'eq_low': '🔵 <strong>EQ Low (Graves)</strong>: Súbelo para conseguir esa "voz profunda" de radio, bájalo para eliminar zumbidos graves de la sala.',
            'mute': '🔇 <strong>MUTE</strong>: ¡Corta la señal de golpe! Úsalo si el locutor de este micro empieza a toser repentinamente.',
            'pfl': '🎧 <strong>PFL (Pre-Fade Listen)</strong>: Pulsa esto para escuchar este micro por tus auriculares ANTES de subirle el Fader. Perfecto para pruebas de sonido secretas.',
            'fader': '🎚️ <strong>Fader de Volumen</strong>: La herramienta principal. Súbelo hasta el 0 (verde) para que el locutor salga en directo. Súbelo y bájalo con suavidad.'
          };

          const state = {
            phantom: false,
            mute: false,
            pfl: false,
            knobs: { gain: 0, eq_hi: 0, eq_low: 0 }
          };

          function showMixerInfo(control) {
            const box = document.getElementById('mixer-info-box');
            box.innerHTML = mixerMessages[control];
            box.style.transform = 'scale(1.02)';
            setTimeout(() => box.style.transform = 'scale(1)', 150);
          }

          function togglePhantom() {
            state.phantom = !state.phantom;
            const btn = document.getElementById('btn-phantom');
            if(state.phantom) {
              btn.style.boxShadow = '0 1px 0 #900, 0 2px 3px rgba(0,0,0,0.3)';
              btn.style.transform = 'translateY(2px)';
              btn.style.background = '#ff6b6b';
            } else {
              btn.style.boxShadow = '0 3px 0 #900, 0 4px 6px rgba(0,0,0,0.3)';
              btn.style.transform = 'translateY(0)';
              btn.style.background = '#e74c3c';
            }
            showMixerInfo('phantom');
          }

          function toggleButton(id, color) {
            state[id] = !state[id];
            const btn = document.getElementById('btn-' + id);
            if(state[id]) {
              btn.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.5)';
              btn.style.transform = 'translateY(3px)';
              btn.style.background = '#fff'; // Iluminado
            } else {
              btn.style.boxShadow = '0 3px 0 rgba(0,0,0,0.5)';
              btn.style.transform = 'translateY(0)';
              btn.style.background = color;
            }
            showMixerInfo(id);
          }

          function turnKnob(id) {
            state.knobs[id] = (state.knobs[id] + 45) % 360;
            if(state.knobs[id] > 135 && state.knobs[id] < 225) state.knobs[id] = 225; // Skip bottom part
            document.getElementById('knob-' + id).style.transform = 'rotate(' + state.knobs[id] + 'deg)';
            showMixerInfo(id);
          }

          function updateFader(val) {
            document.getElementById('fader-cap').style.bottom = val + '%';
          }
        </script>
        <div style="flex: 1; min-width: 250px;">
          <ul>
            <li>🔴 <strong>Alimentación Phantom (48V):</strong> <em>(Botón global en la parte superior derecha)</em>. Este botón es crítico. Los micrófonos de condensador profesionales del estudio no funcionan por sí solos; necesitan recibir +48 voltios de corriente continua a través del propio cable de audio XLR. <strong>¡Asegúrate siempre de tener todos los faders al mínimo antes de encenderlo o apagarlo para evitar un "petardazo" en los altavoces!</strong></li>
            
            <li>🎛️ <strong>Ganancia (Gain):</strong> Es la primera ruleta superior del canal. Ajusta la sensibilidad de entrada. <strong>Principio fundamental:</strong> Si la ganancia es muy baja, se colará ruido de fondo al intentar subir el volumen; si es demasiado alta, la señal saturará y el audio quedará <em>distorsionado</em> para siempre (clipping rojo).</li>
            
            <li>🎧 <strong>PFL (Pre-Fade Listen):</strong> Si un locutor tiene el fader bajado y pulsamos PFL, la mesa enviará el audio de ese canal a la salida "Control Room" (los auriculares del técnico) <em>antes</em> de pasar por el fader. Sirve para probar cómo suena un micro sin que salga al aire.</li>
            
            <li>🔇 <strong>Mute (Silenciar):</strong> Un botón rojo que corta todas las salidas del canal de inmediato. Muy útil si el invitado empieza a toser o mover papeles.</li>
            
            <li>🎚️ <strong>Fader de canal:</strong> El potenciómetro deslizante inferior. Este NO sirve para solucionar problemas de sensibilidad de entrada (eso lo hace la Ganancia), este sirve simplemente para <strong>mezclar</strong>. Controla de forma suave cuánto sonido enviamos a la grabación final.</li>
          </ul>
        </div>
        
        
      </div>

  

      <div style="background: #e8f6f3; padding: 15px 20px; border-radius: 8px; border: 1px solid #1abc9c; margin-top: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
        <div>
          <h3 style="color: #16a085; margin: 0 0 5px 0; font-size: 1.1rem;">📚 Documentación Oficial de la Mesa</h3>
          <p style="font-size: 0.9rem; color: #333; margin: 0; max-width: 500px;">Consulta el manual completo en PDF para ver detalles avanzados (subcanal USB, sección Máster y efectos Lexicon).</p>
        </div>
        <a href="docs/controles_mesa_mezclas.pdf" target="_blank" style="background: #16a085; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 0.9rem; white-space: nowrap;">📄 Abrir Manual Técnico</a>
      </div>
      <div style="margin-top: 25px; text-align: center;">
        <h4 style="color: #7f8c8d; margin-bottom: 10px;">Vista general de la Mesa de Mezclas del Estudio</h4>
        <img src="docs/EFX8-2-1.png" alt="Mesa de Mezclas en Alta Calidad" style="max-width: 100%; border-radius: 8px; box-shadow: 0 10px 20px rgba(0,0,0,0.15); border: 1px solid #ddd;">
      </div>

  
    </section>

    <section>
      <h2>3. Preproducción y Escaleta</h2>
      <p>Un podcast en directo no se puede improvisar. El éxito depende al 90% de lo preparado que esté el equipo antes de darle al REC.</p>
      <div class="info-box" style="border-left-color: #f39c12; background-color: #fdf5e6;">
        <h3>La Escaleta y la Tableta de Sonidos</h3>
        <p>Todo el equipo debe tener delante una <strong>escaleta de tiempos</strong> (una tabla en Google Docs como aprendimos en el bloque anterior) indicando en qué minuto y segundo exacto habla cada persona y qué efecto de sonido debe sonar.</p>
        <p>El técnico del ordenador (conectado al Canal 8) debe tener todos los cortes de música, ráfagas, risas y aplausos perfectamente localizados y cargados en una <strong>Tableta de Sonidos (Soundboard)</strong> para poder lanzarlos con un solo clic. <em>(Más adelante en el curso, ¡nosotros mismos programaremos nuestra propia tableta de sonidos en HTML y Javascript!)</em>.</p>
      </div>
    </section>

    <section>
      <h2>4. Postproducción en Audacity: La Magia de la Edición</h2>
      <p>Aunque hayáis hecho un directo casi perfecto usando bien los faders de la mesa, el archivo de audio "en crudo" que graba Audacity siempre necesita un pulido final antes de publicarse. A esta fase la llamamos <strong>Postproducción</strong>.</p>

      <div style="margin: 25px 0; background: #e0e4e8; border: 1px solid #7f8c8d; border-radius: 4px; padding: 2px; font-family: sans-serif;">
        <!-- Pista 1 (Locutor) -->
        <div style="display: flex; height: 100px; border-bottom: 1px solid #bdc3c7; background: #fff;">
          <div style="width: 150px; background: #dcdde1; border-right: 1px solid #bdc3c7; padding: 5px; display: flex; flex-direction: column; justify-content: space-between;">
            <div style="font-size: 0.75rem; font-weight: bold; color: #2c3e50;">Pista 1: Locutor</div>
            <div style="display: flex; gap: 5px;">
              <div style="flex: 1; background: #ecf0f1; border: 1px solid #bdc3c7; font-size: 0.6rem; text-align: center; cursor: pointer; padding: 2px;">Silencio</div>
              <div style="flex: 1; background: #ecf0f1; border: 1px solid #bdc3c7; font-size: 0.6rem; text-align: center; cursor: pointer; padding: 2px;">Solo</div>
            </div>
            <div style="font-size: 0.6rem; color: #7f8c8d;">Volumen: <input type="range" style="width: 50px;"></div>
          </div>
          <div style="flex: 1; background: #ecf0f1; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 100%; height: 1px; background: #bdc3c7;"></div> <!-- Centro -->
            <svg viewBox="0 0 500 100" preserveAspectRatio="none" style="width: 100%; height: 90%; opacity: 0.8;">
              <path d="M 0 50 L 10 50 L 20 20 L 30 80 L 40 40 L 50 60 L 60 10 L 70 90 L 80 30 L 90 70 L 100 50 L 110 50 L 120 40 L 130 60 L 140 10 L 150 90 L 160 50 L 170 50 L 180 50 L 190 20 L 200 80 L 210 30 L 220 70 L 230 10 L 240 90 L 250 50 L 500 50" fill="none" stroke="#2980b9" stroke-width="2"/>
              <path d="M 0 50 L 10 50 L 20 20 L 30 80 L 40 40 L 50 60 L 60 10 L 70 90 L 80 30 L 90 70 L 100 50 L 110 50 L 120 40 L 130 60 L 140 10 L 150 90 L 160 50 L 170 50 L 180 50 L 190 20 L 200 80 L 210 30 L 220 70 L 230 10 L 240 90 L 250 50 L 500 50" fill="#3498db" opacity="0.3"/>
            </svg>
          </div>
        </div>
        
        <!-- Pista 2 (Música) -->
        <div style="display: flex; height: 100px; background: #fff;">
          <div style="width: 150px; background: #dcdde1; border-right: 1px solid #bdc3c7; padding: 5px; display: flex; flex-direction: column; justify-content: space-between;">
            <div style="font-size: 0.75rem; font-weight: bold; color: #2c3e50;">Pista 2: Sintonía (Estéreo)</div>
            <div style="display: flex; gap: 5px;">
              <div style="flex: 1; background: #ecf0f1; border: 1px solid #bdc3c7; font-size: 0.6rem; text-align: center; cursor: pointer; padding: 2px;">Silencio</div>
              <div style="flex: 1; background: #ecf0f1; border: 1px solid #bdc3c7; font-size: 0.6rem; text-align: center; cursor: pointer; padding: 2px;">Solo</div>
            </div>
            <div style="font-size: 0.6rem; color: #7f8c8d;">Volumen: <input type="range" style="width: 50px;"></div>
          </div>
          <div style="flex: 1; background: #ecf0f1; position: relative; overflow: hidden; display: flex; flex-direction: column;">
            <!-- Canal L -->
            <div style="flex: 1; border-bottom: 1px solid #bdc3c7; position: relative; display: flex; align-items: center; justify-content: center;">
              <div style="position: absolute; width: 100%; height: 1px; background: #bdc3c7;"></div>
              <svg viewBox="0 0 500 50" preserveAspectRatio="none" style="width: 100%; height: 90%; opacity: 0.8;">
                <path d="M 0 25 L 50 25 L 60 5 L 70 45 L 80 15 L 90 35 L 100 10 L 110 40 L 120 20 L 130 30 L 140 5 L 150 45 L 160 25 L 500 25" fill="none" stroke="#27ae60" stroke-width="2"/>
              </svg>
            </div>
            <!-- Canal R -->
            <div style="flex: 1; position: relative; display: flex; align-items: center; justify-content: center;">
              <div style="position: absolute; width: 100%; height: 1px; background: #bdc3c7;"></div>
              <svg viewBox="0 0 500 50" preserveAspectRatio="none" style="width: 100%; height: 90%; opacity: 0.8;">
                <path d="M 0 25 L 50 25 L 60 8 L 70 42 L 80 18 L 90 32 L 100 12 L 110 38 L 120 22 L 130 28 L 140 8 L 150 42 L 160 25 L 500 25" fill="none" stroke="#27ae60" stroke-width="2"/>
              </svg>
            </div>
          </div>
        </div>
      </div>
      <p style="font-size: 0.85rem; color: #7f8c8d; text-align: center; margin-top: -15px; margin-bottom: 20px;"><em>Ejemplo de interfaz multipista: Una pista Mono para la voz (azul) y una pista Estéreo para la música de fondo (verde con dos canales).</em></p>

      
      <h3>Herramientas Básicas de Edición</h3>
      <ul>
        <li>✂️ <strong>Cortar y Pegar:</strong> Selecciona con el ratón los silencios largos, los tartamudeos o los errores y pulsa <code>Suprimir</code> para borrarlos. Puedes mover los clips de audio libremente en la línea de tiempo para ajustar los ritmos.</li>
        <li>📉 <strong>Herramienta Envolvente (Ducking):</strong> Permite poner nodos en una pista de música de fondo para bajarle el volumen manualmente justo cuando los locutores empiezan a hablar, y volvérselo a subir en los silencios.</li>
      </ul>

      
      <h3 style="margin-top: 30px;">Identificando Ondas de Audio Visualmente</h3>
      <div style="display: flex; gap: 15px; margin: 20px 0; flex-wrap: wrap;">
        
        <!-- Saturado -->
        <div style="flex: 1; min-width: 200px; background: #fff; padding: 15px; border-radius: 6px; border: 1px solid #e74c3c; text-align: center; box-shadow: 0 4px 6px rgba(231,76,60,0.1);">
          <div style="height: 60px; background: #ecf0f1; position: relative; display: flex; align-items: center; border-top: 2px solid #e74c3c; border-bottom: 2px solid #e74c3c; margin-bottom: 10px;">
            <svg viewBox="0 0 200 60" preserveAspectRatio="none" style="width: 100%; height: 100%;">
              <path d="M 0 30 L 20 0 L 40 60 L 60 0 L 80 60 L 100 0 L 120 60 L 140 0 L 160 60 L 180 0 L 200 30" fill="#e74c3c" opacity="0.3"/>
              <path d="M 0 30 L 20 0 L 40 60 L 60 0 L 80 60 L 100 0 L 120 60 L 140 0 L 160 60 L 180 0 L 200 30" fill="none" stroke="#c0392b" stroke-width="2"/>
            </svg>
          </div>
          <h4 style="margin: 0; color: #c0392b;">Onda Saturada (Clipping)</h4>
          <p style="font-size: 0.8rem; color: #555; margin-top: 5px;">El volumen entró tan fuerte que la onda "choca" contra los bordes, rompiendo los picos. El audio sonará distorsionado y roto. <strong>¡No se puede arreglar en postproducción!</strong></p>
        </div>

        <!-- Normalizado -->
        <div style="flex: 1; min-width: 200px; background: #fff; padding: 15px; border-radius: 6px; border: 1px solid #2ecc71; text-align: center; box-shadow: 0 4px 6px rgba(46,204,113,0.1);">
          <div style="height: 60px; background: #ecf0f1; position: relative; display: flex; align-items: center; margin-bottom: 10px;">
            <div style="position: absolute; width: 100%; height: 1px; background: #bdc3c7;"></div>
            <svg viewBox="0 0 200 60" preserveAspectRatio="none" style="width: 100%; height: 80%;">
              <path d="M 0 30 L 20 10 L 40 50 L 60 15 L 80 45 L 100 5 L 120 55 L 140 20 L 160 40 L 180 15 L 200 30" fill="#3498db" opacity="0.3"/>
              <path d="M 0 30 L 20 10 L 40 50 L 60 15 L 80 45 L 100 5 L 120 55 L 140 20 L 160 40 L 180 15 L 200 30" fill="none" stroke="#2980b9" stroke-width="2"/>
            </svg>
          </div>
          <h4 style="margin: 0; color: #27ae60;">Onda Normalizada</h4>
          <p style="font-size: 0.8rem; color: #555; margin-top: 5px;">La onda es sana y dinámica. Ocupa aproximadamente un 80-90% del espacio vertical pero sin tocar jamás los bordes. Volumen potente y limpio.</p>
        </div>

        <!-- No se escucha -->
        <div style="flex: 1; min-width: 200px; background: #fff; padding: 15px; border-radius: 6px; border: 1px solid #f39c12; text-align: center; box-shadow: 0 4px 6px rgba(243,156,18,0.1);">
          <div style="height: 60px; background: #ecf0f1; position: relative; display: flex; align-items: center; margin-bottom: 10px;">
            <div style="position: absolute; width: 100%; height: 1px; background: #bdc3c7;"></div>
            <svg viewBox="0 0 200 60" preserveAspectRatio="none" style="width: 100%; height: 100%;">
              <path d="M 0 30 L 20 28 L 40 32 L 60 29 L 80 31 L 100 28 L 120 32 L 140 29 L 160 31 L 180 28 L 200 30" fill="none" stroke="#f39c12" stroke-width="2"/>
            </svg>
          </div>
          <h4 style="margin: 0; color: #f39c12;">Demasiado Bajo</h4>
          <p style="font-size: 0.8rem; color: #555; margin-top: 5px;">Apenas es una línea temblorosa en el centro. Si aplicamos normalización en postproducción para que se escuche, multiplicaremos el ruido de fondo (siseo).</p>
        </div>

      </div>

      <h3>Efectos Clave para limpiar el Audio</h3>
      <p>Selecciona toda la pista de audio (<code>Ctrl+A</code>) y aplica los siguientes efectos desde el menú superior <strong>Efecto</strong>:</p>
      <div class="info-box" style="border-left-color: #9b59b6; background-color: #f4ecf7;">
        <ul style="margin-bottom:0;">
          <li><strong>1. Reducción de Ruido:</strong> El proceso tiene dos pasos. Primero, seleccionas un par de segundos donde no hable nadie (solo se escuche el zumbido de la clase o del PC) y le das a "Obtener perfil de ruido". Luego seleccionas TODO el audio, vuelves al efecto y le das a "Aceptar". ¡Audacity restará ese zumbido de toda la pista dejando la voz limpia!</li>
          <li><strong>2. Compresor / Normalización:</strong> Sirve para igualar el volumen. Si alguien habló muy bajo y otro gritó, esto sube los picos bajos y baja los altos, logrando que todo el podcast suene uniforme y potente.</li>
          <li><strong>3. Ecualización Gráfica:</strong> Puedes realzar un poco los graves (Bass Boost) para que vuestras voces suenen más profundas y profesionales, al estilo locutor de radio.</li>
        </ul>
      </div>

      <h3>Exportar a MP3 (El paso final)</h3>
      <p>Cuando guardas tu trabajo (Archivo > Guardar proyecto), Audacity crea un archivo <code>.aup3</code>. <strong>¡Ojo! Ese archivo NO es un archivo de audio</strong>, es el archivo de trabajo del programa y no se puede subir a iVoox ni reproducir en el móvil.</p>
      <p>Para crear el archivo de audio final que se subirá a internet, debes ir a <strong>Archivo > Exportar > Exportar como MP3</strong>.</p>
      <ul>
        <li><strong>Formato MP3:</strong> Es el estándar de internet. Comprime el tamaño del archivo un 90% perdiendo muy poca calidad, lo que permite a los oyentes descargarlo rápido en sus móviles.</li>
        <li><strong>Calidad (Bitrate):</strong> Te pedirá elegir la calidad. Para un podcast hablado, una calidad constante de <strong>128 kbps o 192 kbps</strong> es más que suficiente y dará como resultado un archivo ligero y perfecto para subir a plataformas.</li>
      </ul>
    </section>
    
    
</div>

                        </div>
                    </div>
                </div>
            </div>

            <ul class="nav nav-tabs mb-4" id="radioKits-tabs" role="tablist">
                <li class="nav-item">
                    <a class="nav-link active" id="tab-reservations-link" data-bs-toggle="tab" href="#tab-reservations" role="tab">Reservas</a>
                </li>
                ${this.isTic ? `
                <li class="nav-item">
                    <a class="nav-link" id="tab-inventory-link" data-bs-toggle="tab" href="#tab-inventory" role="tab">Gestión Kits (TIC)</a>
                </li>
                ` : ''}
            </ul>

            <div class="tab-content" id="radioKits-tab-content">
                <!-- Reservations Tab -->
                <div class="tab-pane fade show active" id="tab-reservations" role="tabpanel">
                    <!-- Calendar Section -->
                    <div class="row mb-4">
                        <div class="col-lg-12">
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <button id="radioKits-prev-month" class="btn btn-outline-primary btn-sm"><i class="fas fa-chevron-left"></i></button>
                                <h4 id="radioKits-month-label" class="m-0 fw-bold text-primary"></h4>
                                <button id="radioKits-next-month" class="btn btn-outline-primary btn-sm"><i class="fas fa-chevron-right"></i></button>
                            </div>
                            <div class="card shadow-sm border-0 mb-4">
                                <div class="card-body p-0">
                                    <div id="radioKits-calendar-grid" class="calendar-grid calendar-compact"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div id="radioKits-grid-container" class="table-responsive">
                         <div class="text-center py-5"><div class="spinner-border text-primary"></div></div>
                    </div>
                </div>

                <!-- Inventory Tab (TIC) -->
                <div class="tab-pane fade" id="tab-inventory" role="tabpanel">
                    <div class="d-flex justify-content-end mb-3">
                        <button class="btn btn-primary" onclick="window.currentRadioKitsModule.showAddRadioKitModal()">
                            <i class="fas fa-plus me-2"></i>Nuevo Kit
                        </button>
                    </div>
                    <div id="radioKits-list-container">
                        <div class="text-center py-5"><div class="spinner-border text-primary"></div></div>
                    </div>
                </div>
            </div>
        `;

        // Initialize Calendar
        this.calendar = new Calendar({
            grid: document.getElementById('radioKits-calendar-grid'),
            monthLabel: document.getElementById('radioKits-month-label'),
            prevBtn: document.getElementById('radioKits-prev-month'),
            nextBtn: document.getElementById('radioKits-next-month')
        }, this.firebaseService, this.user, this.userRoles, {
            fetchData: async (year, month) => {
                return await this.firebaseService.getMonthAvailability(year, month, this.courseId);
            },
            onDateSelect: (dateStr) => {
                this.currentDate = new Date(dateStr);
                this.loadReservationsView();
            },
            renderCell: (cell, dateStr, dayData, isWeekend) => {
                const day = parseInt(dateStr.split('-')[2]);
                const isSelected = this.formatDateForInput(this.currentDate) === dateStr;

                const number = document.createElement('span');
                number.className = 'day-number';
                number.textContent = day;
                cell.appendChild(number);

                if (isWeekend || (dayData && dayData.isHoliday)) {
                    cell.classList.add('day-red');
                    if (dayData && dayData.isHoliday) cell.title = "Festivo";
                }

                if (isSelected) {
                    cell.classList.remove('day-red');
                    cell.classList.add('bg-primary', 'text-white');
                    number.style.color = 'white';
                } else if (!isWeekend && !(dayData && dayData.isHoliday)) {
                    cell.style.cursor = 'pointer';
                }
            }
        }, this.courseId);

        // Initial Load
        await this.loadReservationsView();

        if (this.isTic) {
            document.getElementById('tab-inventory-link').addEventListener('shown.bs.tab', () => this.loadInventoryView());
        }
    }

    formatDateForInput(date) {
        return date.toISOString().split('T')[0];
    }

    // --- Reservations View ---

    async loadReservationsView() {
        this.updateCalendarSelection();

        const container = document.getElementById('radioKits-grid-container');
        const dateStr = this.formatDateForInput(this.currentDate);

        const dayOfWeek = this.currentDate.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            container.innerHTML = `<div class="alert alert-warning text-center">No hay reservas los fines de semana.</div>`;
            return;
        }

        try {
            // Loading
            container.innerHTML = `<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>`;

            // Load radioKits and reservations locally
            // Ideally should check cache or verify if radioKits list changed
            this.radioKits = await this.firebaseService.getRadioKits();
            this.radioKits.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
            this.reservations = await this.firebaseService.getRadioKitReservations(dateStr, this.courseId);
            this.renderGrid(container);
        } catch (error) {
            console.error(error);
            container.innerHTML = `<div class="alert alert-danger">Error al cargar reservas</div>`;
        }
    }

    updateCalendarSelection() {
        if (!this.calendar || !this.calendar.grid) return;
        this.calendar.render();
    }

    renderGrid(container) {
        if (this.radioKits.length === 0) {
            container.innerHTML = '<div class="alert alert-info">No hay kits disponibles en el sistema.</div>';
            return;
        }

        // Filter active radioKits only
        const activeRadioKits = this.radioKits.filter(c => c.active);

        let html = `
            <table class="table table-bordered text-center align-middle">
                <thead class="table-light">
                    <tr>
                        <th style="width: 15%">Horario (${UIHelpers.formatDate(this.currentDate)})</th>
                        ${activeRadioKits.map(radioKit => `
                            <th>
                                <div>${radioKit.name}</div>
                                <small class="text-muted fw-normal">${radioKit.location}</small>
                            </th>
                        `).join('')}
                    </tr>
                </thead>
                <tbody>
        `;

        this.slots.forEach(slot => {
            html += `<tr><th class="table-light">${slot.label}</th>`;

            activeRadioKits.forEach(radioKit => {
                const reservation = this.reservations.find(r => r.slotIndex === slot.index && r.radioKitId === radioKit.id);
                const isReserved = !!reservation;
                const isMyReservation = isReserved && reservation.userId === this.user.uid;

                if (isReserved) {
                    const cellClass = isMyReservation ? 'table-primary' : 'table-secondary';
                    const canManage = isMyReservation || this.isTic;
                    const cursor = canManage ? 'pointer' : 'default';
                    const clickAction = canManage ? `onclick="window.currentRadioKitsModule.cancelReservation('${reservation.id}')"` : '';
                    const tooltip = isMyReservation ? 'Click para cancelar' : (this.isTic ? 'Click para cancelar (Admin/TIC)' : 'Reservado');

                    html += `
                        <td class="${cellClass}" style="cursor: ${cursor}" ${clickAction} title="${tooltip}">
                            <div class="fw-bold small">${reservation.userName}</div>
                            ${reservation.comment ? `<div class="x-small text-muted fst-italic">${reservation.comment}</div>` : ''}
                            ${canManage ? '<i class="fas fa-times text-danger mt-1"></i>' : ''}
                        </td>
                    `;
                } else {
                    html += `
                        <td class="" style="cursor: pointer" onclick="window.currentRadioKitsModule.makeReservation(${slot.index}, '${slot.label}', '${radioKit.id}', '${radioKit.name}')">
                            <span class="text-success opacity-50"><i class="fas fa-plus-circle"></i></span>
                        </td>
                    `;
                }
            });

            html += `</tr>`;
        });

        html += `</tbody></table>`;
        container.innerHTML = html;
    }

    async makeReservation(slotIndex, slotLabel, radioKitId, radioKitName) {
        this.showReservationTypeModal(slotIndex, slotLabel, radioKitId, radioKitName);
    }

    showReservationTypeModal(slotIndex, slotLabel, radioKitId, radioKitName) {
        const existingModal = document.getElementById('reservation-type-modal');
        if (existingModal) existingModal.remove();

        const dateStr = this.formatDateForInput(this.currentDate);
        const dayName = this.currentDate.toLocaleDateString('es-ES', { weekday: 'long' });

        const endDate = this.getEndOfSchoolYear();
        const endDateStr = endDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

        const modal = document.createElement('div');
        modal.id = 'reservation-type-modal';
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Confirmar Reserva</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p><strong>Kit:</strong> ${radioKitName}</p>
                        <p><strong>Hora:</strong> ${slotLabel}</p>
                        
                        <div class="form-check mb-3">
                            <input class="form-check-input" type="radio" name="resType" id="res-single" value="single" checked>
                            <label class="form-check-label" for="res-single">
                                Solo el día <strong>${dateStr}</strong>
                            </label>
                        </div>
                        
                        <div class="form-check mb-3">
                            <input class="form-check-input" type="radio" name="resType" id="res-mass" value="mass">
                            <label class="form-check-label" for="res-mass">
                                Todas las semanas (cada ${dayName})<br>
                                <small class="text-muted">Hasta fin de curso (${endDateStr})</small>
                            </label>
                        </div>

                        <hr>

                        <div class="form-check mb-2">
                             <input class="form-check-input" type="checkbox" id="res-for-other">
                             <label class="form-check-label" for="res-for-other">
                                 Reservar para otra persona / Comentario
                             </label>
                        </div>
                        <div class="mb-3 d-none" id="res-comment-container">
                             <input type="text" class="form-control" id="res-comment" placeholder="Nombre de la persona o motivo">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="btn-confirm-res">Reservar</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();

        const checkOther = document.getElementById('res-for-other');
        const commentContainer = document.getElementById('res-comment-container');
        const commentInput = document.getElementById('res-comment');

        checkOther.addEventListener('change', () => {
            if (checkOther.checked) {
                commentContainer.classList.remove('d-none');
                commentInput.focus();
            } else {
                commentContainer.classList.add('d-none');
            }
        });

        document.getElementById('btn-confirm-res').addEventListener('click', async () => {
            const type = document.querySelector('input[name="resType"]:checked').value;
            const comment = checkOther.checked ? commentInput.value.trim() : '';

            if (checkOther.checked && !comment) {
                alert('Por favor, indica el nombre o comentario.');
                return;
            }

            bsModal.hide();

            if (type === 'single') {
                await this.processSingleReservation(dateStr, slotIndex, slotLabel, radioKitId, radioKitName, comment);
            } else {
                await this.processMassReservation(slotIndex, slotLabel, radioKitId, radioKitName, comment);
            }
        });

        modal.addEventListener('hidden.bs.modal', () => modal.remove());
    }

    getEndOfSchoolYear() {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth(); // 0-11
        let endYear = currentYear;
        // If August or later, end is next year
        if (currentMonth >= 7) {
            endYear = currentYear + 1;
        }
        return new Date(endYear, 5, 30); // Month 5 is June
    }

    async processSingleReservation(dateStr, slotIndex, slotLabel, radioKitId, radioKitName, comment = '') {
        try {
            await this.firebaseService.reserveRadioKit(
                dateStr,
                slotIndex,
                slotLabel,
                radioKitId,
                this.user.uid,
                this.user.displayName || this.user.email.split('@')[0],
                comment,
                this.courseId
            );
            UIHelpers.showToast('Reserva realizada', 'success');
            await this.loadReservationsView();
        } catch (error) {
            console.error(error);
            UIHelpers.showToast('Error al reservar: ' + error.message, 'error');
        }
    }

    async processMassReservation(slotIndex, slotLabel, radioKitId, radioKitName, comment = '') {
        // Use noon to avoid DST midnight issues
        const startDate = new Date(this.currentDate);
        startDate.setHours(12, 0, 0, 0);

        const endDate = this.getEndOfSchoolYear();
        endDate.setHours(12, 0, 0, 0);

        const targetDates = [];

        // Avoid infinite loops
        let count = 0;
        let diffWeeks = 0;

        while (count < 60) {
            // Calculate next date based on original startDate + weeks, 
            // instead of accumulating on iterDate to avoid drift.
            const nextDate = new Date(startDate);
            nextDate.setDate(startDate.getDate() + (diffWeeks * 7));

            if (nextDate > endDate) break;

            targetDates.push(this.formatDateForInput(nextDate));
            diffWeeks++;
            count++;
        }

        if (targetDates.length === 0) return;

        if (!confirm(`Se comprobará la disponibilidad para ${targetDates.length} días. ¿Continuar?`)) return;

        UIHelpers.showToast('Verificando disponibilidad...', 'info');

        try {
            const rangeStart = targetDates[0];
            const rangeEnd = targetDates[targetDates.length - 1];

            const existingReservations = await this.firebaseService.getRadioKitReservationsInRange(rangeStart, rangeEnd, this.courseId);

            const conflicts = [];

            targetDates.forEach(date => {
                const conflict = existingReservations.find(r =>
                    r.date === date &&
                    r.slotIndex === slotIndex &&
                    r.radioKitId === radioKitId
                );
                if (conflict) {
                    conflicts.push(date);
                }
            });

            if (conflicts.length > 0) {
                const conflictStr = conflicts.slice(0, 3).join(', ') + (conflicts.length > 3 ? '...' : '');
                alert(`No se puede realizar la reserva masiva.\n\nHay conflictos en las siguientes fechas:\n${conflictStr}\n\nNo se ha realizado ninguna reserva.`);
                return;
            }

            UIHelpers.showToast('Realizando reservas...', 'info');

            const promises = targetDates.map(date =>
                this.firebaseService.reserveRadioKit(
                    date,
                    slotIndex,
                    slotLabel,
                    radioKitId,
                    this.user.uid,
                    this.user.displayName || this.user.email.split('@')[0],
                comment,
                this.courseId
                )
            );

            await Promise.all(promises);

            UIHelpers.showToast(`Reservado correctamente para ${targetDates.length} semanas.`, 'success');
            await this.loadReservationsView();

        } catch (e) {
            console.error(e);
            UIHelpers.showToast('Error en el proceso: ' + e.message, 'error');
        }
    }

    async cancelReservation(reservationId) {
        const reservation = this.reservations.find(r => r.id === reservationId);
        if (!reservation) return;

        // Show Modal for Delete options
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = 'delete-reservation-modal';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header bg-danger text-white">
                        <h5 class="modal-title">Eliminar Reserva</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p>¿Qué deseas eliminar?</p>
                        <div class="form-check mb-2">
                            <input class="form-check-input" type="radio" name="delType" id="del-single" value="single" checked>
                            <label class="form-check-label" for="del-single">
                                Solo esta reserva (${reservation.date})
                            </label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="radio" name="delType" id="del-mass" value="mass">
                            <label class="form-check-label" for="del-mass">
                                Esta y todas las futuras<br>
                                <small class="text-muted">Todas las reservas de este hueco/kit a partir de hoy.</small>
                            </label>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-danger" id="btn-confirm-delete">Eliminar</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();

        document.getElementById('btn-confirm-delete').addEventListener('click', async () => {
            const type = document.querySelector('input[name="delType"]:checked').value;
            bsModal.hide();

            try {
                if (type === 'single') {
                    await this.firebaseService.cancelRadioKitReservation(reservationId, this.courseId);
                    UIHelpers.showToast('Reserva cancelada', 'success');
                } else {
                    if (!confirm('¿Estás seguro de que quieres borrar TODAS las reservas futuras de esta serie?')) return;

                    UIHelpers.showToast('Buscando reservas...', 'info');
                    const futureReservations = await this.firebaseService.getReservationsForRadioKitInRange(
                        reservation.radioKitId,
                        reservation.slotIndex,
                        reservation.date,
                        this.user.uid
                    , this.courseId);

                    if (futureReservations.length === 0) {
                        UIHelpers.showToast('No se encontraron reservas futuras.', 'info');
                        return;
                    }

                    UIHelpers.showToast(`Eliminando ${futureReservations.length} reservas...`, 'info');
                    const promises = futureReservations.map(r => this.firebaseService.cancelRadioKitReservation(r.id, this.courseId));
                    await Promise.all(promises);
                    UIHelpers.showToast('Reservas eliminadas correctamente', 'success');
                }
                await this.loadReservationsView();
            } catch (error) {
                console.error(error);
                UIHelpers.showToast('Error al cancelar', 'error');
            }
        });

        modal.addEventListener('hidden.bs.modal', () => modal.remove());
    }

    // --- Inventory View (TIC) ---

    async loadInventoryView() {
        const container = document.getElementById('radioKits-list-container');
        try {
            this.radioKits = await this.firebaseService.getRadioKits();
            this.radioKits.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

            if (this.radioKits.length === 0) {
                container.innerHTML = '<p class="text-muted text-center">No hay kits registrados.</p>';
                return;
            }

            container.innerHTML = `
                <div class="list-group">
                    ${this.radioKits.map(radioKit => `
                        <div class="list-group-item d-flex justify-content-between align-items-center">
                            <div>
                                <h5 class="mb-1">${radioKit.name} ${!radioKit.active ? '<span class="badge bg-danger">Inactivo</span>' : ''}</h5>
                                <p class="mb-1 text-muted">${radioKit.description}</p>
                                <small class="text-primary"><i class="fas fa-map-marker-alt me-1"></i>${radioKit.location}</small>
                            </div>
                            <div>
                                <button class="btn btn-sm btn-outline-secondary me-2" onclick="window.currentRadioKitsModule.editRadioKit('${radioKit.id}')">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-danger" onclick="window.currentRadioKitsModule.deleteRadioKit('${radioKit.id}')">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;

        } catch (error) {
            console.error(error);
            container.innerHTML = '<div class="alert alert-danger">Error al cargar inventario</div>';
        }
    }

    showAddRadioKitModal() {
        this.showRadioKitModal(); // Mode create
    }

    editRadioKit(radioKitId) {
        const radioKit = this.radioKits.find(c => c.id === radioKitId);
        if (radioKit) this.showRadioKitModal(radioKit);
    }

    async deleteRadioKit(radioKitId) {
        if (!confirm('¿Eliminar este kit? Se perderán las reservas históricas asociadas (si no se borraron antes).')) return;
        try {
            await this.firebaseService.deleteRadioKit(radioKitId);
            UIHelpers.showToast('Kit eliminado', 'success');
            this.loadInventoryView();
        } catch (e) {
            UIHelpers.showToast('Error al eliminar', 'error');
        }
    }

    showRadioKitModal(radioKit = null) {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">${radioKit ? 'Editar Kit' : 'Nuevo Kit'}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                         <div class="mb-3">
                            <label class="form-label">Nombre</label>
                            <input type="text" class="form-control" id="radioKit-name" value="${radioKit ? radioKit.name : ''}" placeholder="Ej: Kit 1">
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Ubicación</label>
                            <input type="text" class="form-control" id="radioKit-location" value="${radioKit ? radioKit.location : ''}" placeholder="Ej: Planta 1">
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Descripción</label>
                            <textarea class="form-control" id="radioKit-desc" rows="2">${radioKit ? radioKit.description : ''}</textarea>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="radioKit-active" ${(!radioKit || radioKit.active) ? 'checked' : ''}>
                            <label class="form-check-label">Activo (Disponible para reservas)</label>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="btn-save-radioKit">Guardar</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();

        document.getElementById('btn-save-radioKit').addEventListener('click', async () => {
            const name = document.getElementById('radioKit-name').value;
            const location = document.getElementById('radioKit-location').value;
            const description = document.getElementById('radioKit-desc').value;
            const active = document.getElementById('radioKit-active').checked;

            if (!name || !location) {
                UIHelpers.showToast('Nombre y Ubicación son obligatorios', 'error');
                return;
            }

            try {
                if (radioKit) {
                    await this.firebaseService.updateRadioKit(radioKit.id, { name, location, description, active });
                } else {
                    await this.firebaseService.createRadioKit({ name, location, description, active });
                }
                UIHelpers.showToast('Guardado correctamente', 'success');
                bsModal.hide();
                this.loadInventoryView();
            } catch (e) {
                console.error(e);
                UIHelpers.showToast('Error al guardar', 'error');
            }
        });

        modal.addEventListener('hidden.bs.modal', () => modal.remove());
    }

    destroy() {
        delete window.currentRadioKitsModule;
    }
}

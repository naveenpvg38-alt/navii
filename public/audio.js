/**
 * Synthesizes a clean, pleasant two-tone hospital chime using Web Audio API
 * and optional Text-to-Speech voice announcement.
 */

class SoundEffects {
  constructor() {
    this.audioCtx = null;
    this.soundEnabled = true;
    this.voiceEnabled = true;
  }

  initContext() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  // Play pleasant hospital ding-dong chime
  playChime() {
    if (!this.soundEnabled) return;
    try {
      this.initContext();
      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;

      // Note 1: E5 (659.25 Hz)
      const osc1 = this.audioCtx.createOscillator();
      const gain1 = this.audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      osc1.connect(gain1);
      gain1.connect(this.audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.8);

      // Note 2: C5 (523.25 Hz) - 0.25s later (the "dong")
      const osc2 = this.audioCtx.createOscillator();
      const gain2 = this.audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(523.25, now + 0.25);
      gain2.gain.setValueAtTime(0.35, now + 0.25);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
      osc2.connect(gain2);
      gain2.connect(this.audioCtx.destination);
      osc2.start(now + 0.25);
      osc2.stop(now + 1.2);
    } catch (e) {
      console.warn('Audio chime failed:', e);
    }
  }

  // Voice announcement using browser SpeechSynthesis
  announce(token, roomNumber = 'Room 1') {
    this.playChime();

    if (!this.voiceEnabled || !('speechSynthesis' in window)) return;

    // Delay slightly so chime plays first
    setTimeout(() => {
      try {
        window.speechSynthesis.cancel(); // Cancel any ongoing speech
        
        // Format token for speech: "A-014" -> "Token A 14"
        const cleanToken = token.replace('-', ' ');
        const text = `Token ${cleanToken}, please proceed to ${roomNumber}`;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.lang = 'en-US';

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn('Speech synthesis error:', err);
      }
    }, 900);
  }
}

window.soundEffects = new SoundEffects();

/**
 * SoundEffects - Web Audio API synthesizer for clean hospital chimes
 * and multi-language SpeechSynthesis announcements (English / Hindi / Regional).
 */

class SoundEffects {
  constructor() {
    this.audioCtx = null;
    this.soundEnabled = true;
    this.voiceEnabled = true;
    this.currentLanguage = 'en-US';
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

  setLanguage(lang) {
    if (lang) this.currentLanguage = lang;
  }

  // Pleasant hospital ding-dong chime
  playChime(isEmergency = false) {
    if (!this.soundEnabled) return;
    try {
      this.initContext();
      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;

      if (isEmergency) {
        // Urgent high-pitch double pulse
        [0, 0.22, 0.44].forEach((delay, i) => {
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(i % 2 === 0 ? 880 : 660, now + delay);
          gain.gain.setValueAtTime(0.4, now + delay);
          gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.35);
          osc.connect(gain);
          gain.connect(this.audioCtx.destination);
          osc.start(now + delay);
          osc.stop(now + delay + 0.35);
        });
        return;
      }

      // Standard hospital chime: E5 (659.25 Hz)
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

      // Note 2: C5 (523.25 Hz) - 0.25s later
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

  // Voice announcement using browser SpeechSynthesis with language localization
  announce(token, roomNumber = 'Room 1', isEmergency = false, customLang = null) {
    this.playChime(isEmergency);

    if (!this.voiceEnabled || !('speechSynthesis' in window)) return;

    const lang = customLang || this.currentLanguage || 'en-US';

    setTimeout(() => {
      try {
        window.speechSynthesis.cancel();

        const cleanToken = token.replace('-', ' ');
        let text = `Token ${cleanToken}, please proceed to ${roomNumber}`;

        if (lang.startsWith('hi')) {
          text = `कृपया ध्यान दें: टोकन ${cleanToken}, कृपया ${roomNumber} में पधारें।`;
        } else if (isEmergency) {
          text = `Emergency alert: Priority Token ${cleanToken}, please proceed immediately to ${roomNumber}`;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = lang.startsWith('hi') ? 0.85 : 0.9;
        utterance.pitch = 1.0;
        utterance.lang = lang;

        // Try selecting matching voice if available
        if (typeof window.speechSynthesis.getVoices === 'function') {
          const voices = window.speechSynthesis.getVoices();
          const matchedVoice = voices.find(v => v.lang && v.lang.toLowerCase().startsWith(lang.toLowerCase().slice(0, 2)));
          if (matchedVoice) utterance.voice = matchedVoice;
        }

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn('Speech synthesis error:', err);
      }
    }, isEmergency ? 1100 : 900);
  }
}

window.soundEffects = new SoundEffects();

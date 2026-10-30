document.addEventListener('DOMContentLoaded', () => {
    // === CONFIG : tes sons ===
    const SOUNDS = {
      change: 'https://cdn.prod.website-files.com/69fb53371d5b8e9c3f4e4c69/6a1931adeeccb22ae319671f_a05ee47a5e61560727f7dfe21194a4b9_CIAO-ENERGY-defilementui.mp3', // changement de canette
      enter: 'https://cdn.prod.website-files.com/69fb53371d5b8e9c3f4e4c69/6a1932a8b13b5bf33b3a1339_c5c6e6976127365d417e66b413c7973e_CIAO-ENERGY-doubleclic-canette.mp3', // 1ère -> 2e section
      benefits: 'https://cdn.prod.website-files.com/69fb53371d5b8e9c3f4e4c69/6a19377501bbf3759e07daeb_3c593ea845e9d3018a1e70a20d53b230_CIAO-ENERGY-transition2.mp3', // transition vers section benefits
      click: 'https://cdn.prod.website-files.com/69fb53371d5b8e9c3f4e4c69/6a193703d7e9f8e098677ed1_dd3a7d784cae6dde94102dfd0857c348_CIAO-ENERGY-Clickui.mp3', // bouton menu + liens menu
    };

    const VOLUME = 0.5; // 0 à 1

    // === Moteur Web Audio ===
    let ctx = null;
    const buffers = {};
    let unlocked = false;

    const initCtx = () => {
      if (ctx) return;
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    };

    const loadSound = async (name, url) => {
      try {
        const res = await fetch(url);
        const arrayBuffer = await res.arrayBuffer();
        buffers[name] = await ctx.decodeAudioData(arrayBuffer);
      } catch (e) {
        console.warn('[ciaoSound] échec chargement', name, e);
      }
    };

    const preload = () => {
      initCtx();
      Object.entries(SOUNDS).forEach(([name, url]) => loadSound(name, url));
    };

    // Respecte le bouton son de la navbar (.navbar_sound.is-muted)
    const isMuted = () => {
      const btn = document.querySelector('.navbar_sound');
      return btn ? btn.classList.contains('is-muted') : false;
    };

    const play = (name, { volume = 1, rate = 1 } = {}) => {
      if (!ctx || !buffers[name] || !unlocked || isMuted()) return;

      const source = ctx.createBufferSource();
      source.buffer = buffers[name];
      source.playbackRate.value = rate;

      const gain = ctx.createGain();
      gain.gain.value = VOLUME * volume;

      source.connect(gain).connect(ctx.destination);
      source.start(0);
    };

    // === Déblocage au 1er geste (autoplay policy) ===
    const unlock = () => {
      initCtx();
      if (ctx.state === 'suspended') ctx.resume();
      unlocked = true;
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('wheel', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('touchstart', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('wheel', unlock);

    preload();

    // Contrôle manuel : window.ciaoSound.play('change')
    window.ciaoSound = { play };

    // === Verrou navigation menu : coupe les sons de scroll pendant un scrollTo programmatique ===
    const nav = { lock: false, timer: null };
    const lockNav = (ms = 1800) => {
      nav.lock = true;
      clearTimeout(nav.timer);
      nav.timer = setTimeout(() => (nav.lock = false), ms);
    };

    // === 1. Son au changement de canette active ===
    const bindCarousel = () => {
      if (!window.carousel || !window.carousel.changed) return false;
      window.carousel.changed.connect(() => play('change'));
      return true;
    };
    if (!bindCarousel()) {
      window.addEventListener('carousel:ready', bindCarousel, { once: true });
    }

    // === 2. Son au DÉBUT de la transition 1ère -> 2e section ===
    const bindSectionEnter = () => {
      if (!window.lenis) return false;

      let boundary = 0; // top de la section 2 = hauteur de la section 1
      const computeBoundary = () => {
        const first = document.querySelector('section');
        boundary = first ? first.clientHeight : 0;
      };
      computeBoundary();
      window.addEventListener('resize', computeBoundary);

      const fireAt = () => Math.max(boundary * 0.03, 24);

      let inHome = true;
      let last = window.lenis.animatedScroll || 0;

      window.lenis.on('scroll', () => {
        const cur = window.lenis.animatedScroll;
        const goingDown = cur > last;
        const threshold = fireAt();

        if (inHome && cur >= threshold) {
          inHome = false;
          if (goingDown && !nav.lock) play('enter');
        } else if (!inHome && cur < threshold) {
          inHome = true;
        }
        last = cur;
      });

      return true;
    };
    if (!bindSectionEnter()) {
      window.addEventListener('carousel:ready', bindSectionEnter, { once: true });
    }

    // === 3. Son à chaque transition vers une section benefits (montée ET descente) ===
    const bindBenefits = () => {
      if (!window.lenis) return false;

      const wrap = (v, min, max) => {
        const size = max - min;
        v = v % size;
        if (v < 0) v += size;
        return v + min;
      };

      let sections = [];
      const buildSections = () => {
        let top = 0;
        sections = [...document.querySelectorAll('section')].map((el) => {
          const item = { top, isBenefits: el.classList.contains('is-benefits') };
          top += el.clientHeight;
          return item;
        });
      };
      buildSections();
      window.addEventListener('resize', buildSections);

      const currentIndex = (pos) => {
        let best = 0;
        let dist = Infinity;
        sections.forEach((it, i) => {
          const d = Math.abs(it.top - pos);
          if (d < dist) {
            dist = d;
            best = i;
          }
        });
        return best;
      };

      let lastIdx = currentIndex(0);

      window.lenis.on('scroll', () => {
        const max = window.lenis.dimensions.scrollHeight - window.lenis.dimensions.height;
        if (max <= 0) return;
        const pos = wrap(window.lenis.animatedScroll, 0, max);
        const idx = currentIndex(pos);

        if (idx !== lastIdx) {
          // |delta| === 1 => déplacement section par section (filtre le saut de loop infini)
          const adjacent = Math.abs(idx - lastIdx) === 1;
          if (adjacent && sections[idx]?.isBenefits && !nav.lock) play('benefits');
          lastIdx = idx;
        }
      });

      return true;
    };

    if (!bindBenefits()) {
      window.addEventListener('carousel:ready', bindBenefits, { once: true });
    }

    // === 4. Son au clic sur le bouton menu et les liens du menu ===
    const initMenuClicks = () => {
      document.querySelector('.navbar_menu-button')?.addEventListener('click', () => play('click'));

      document.querySelectorAll('.navbar_link').forEach((link) => {
        link.addEventListener('click', () => {
          play('click'); // seul le son de clic part
          lockNav(); // verrouille les sons de scroll le temps du scrollTo
        });
      });

      // Nav benefits : son + verrou (scrollTo vers benefits)
      document.querySelectorAll('.benefits_icon-wrapper').forEach((icon) => {
        icon.addEventListener('click', () => {
          play('benefits');
          lockNav();
        });
      });

      // FAQ : son seul (accordéon, pas de scroll)
      document.querySelectorAll('.faq_question').forEach((q) => {
        q.addEventListener('click', () => play('click'));
      });
    };
    initMenuClicks();
  });

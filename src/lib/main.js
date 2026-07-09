/* =============================================================================
   UAK Trade — main.js
   Один IIFE. Каждая фича обёрнута проверкой наличия узлов: страница без блока
   просто пропускает его. Всё дегрейдится в читаемую статику без JS.
   ============================================================================= */
(function () {
  "use strict";

  const mq = (q) => window.matchMedia(q);
  const prefersReduced = mq("(prefers-reduced-motion: reduce)").matches;
  const header = document.querySelector("[data-header]");

  /* --------------------------------------------------------------------------
     Lenis smooth-scroll (самохостинг). Отключается при reduced-motion.
     -------------------------------------------------------------------------- */
  let lenis = null;
  if (typeof Lenis !== "undefined" && !prefersReduced) {
    lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),   // expo-out — как в dasigna, мягче инерция
      smoothWheel: true,
      touchMultiplier: 1.5,
    });
    const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
    window.lenis = lenis;                                   // доступ снаружи (напр. отладка)
  }
  // Пауза/возобновление плавного скролла (модалки, оверлей-меню)
  const lenisPause = () => { if (lenis) lenis.stop(); };
  const lenisResume = () => { if (lenis) lenis.start(); };

  /* --------------------------------------------------------------------------
     Прелоадер (десктоп): круг с подсветкой + счётчик процентов при загрузке.
     На мобиле (скрыт CSS) сразу убираем и не блокируем скролл.
     -------------------------------------------------------------------------- */
  const initPreloader = () => {
    const pre = document.querySelector("[data-preloader]");
    if (!pre) return;
    const percentEl = pre.querySelector("[data-preloader-percent]");
    if (mq("(max-width: 600px)").matches) { pre.remove(); return; }   // только десктоп

    document.documentElement.style.overflow = "hidden";               // блок скролла на время загрузки
    lenisPause();

    let loaded = false;
    let pct = 0;
    window.addEventListener("load", () => { loaded = true; });

    const finish = () => {
      if (percentEl) percentEl.textContent = "100%";
      setTimeout(() => {
        pre.classList.add("is-hidden");
        document.documentElement.style.overflow = "";                 // возврат к CSS (overflow-x: clip)
        lenisResume();
        pre.addEventListener("transitionend", () => pre.remove(), { once: true });
      }, 250);
    };

    const tick = () => {
      const target = loaded ? 100 : 90;                               // до полной загрузки не доходим до 100
      pct += Math.max(0.6, (target - pct) * 0.06);
      if (pct >= 100) { pct = 100; finish(); return; }
      if (percentEl) percentEl.textContent = Math.floor(pct) + "%";
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  initPreloader();

  /* --------------------------------------------------------------------------
     Шапка: тень при скролле
     -------------------------------------------------------------------------- */
  if (header) {
    const expand = () => header.classList.remove("is-scrolled");
    const collapse = () => header.classList.add("is-scrolled");
    // Разворот по направлению скролла: движемся вверх к верхней зоне — разворачиваем
    // СРАЗУ, не дожидаясь, пока инерция Lenis доедет до нуля (иначе кажется запоздалым).
    // Защёлка: класс меняем только при реальном движении → в покое не мерцает.
    let lastY = window.scrollY;
    const onScroll = (y) => {
      const goingUp = y < lastY;
      lastY = y;
      if (y <= 8) expand();                        // у самого верха — всегда полная
      else if (goingUp && y < 100) expand();       // вверх в зоне 100px до верха → разворот сразу
      else if (!goingUp) collapse();               // вниз → компактная
    };
    header.classList.toggle("is-scrolled", window.scrollY > 8);
    if (lenis) {
      lenis.on("scroll", ({ scroll }) => onScroll(scroll));
    } else {
      window.addEventListener("scroll", () => onScroll(window.scrollY), { passive: true });
    }
  }

  /* --------------------------------------------------------------------------
     Оверлей-меню (кнопка «Меню»)
     -------------------------------------------------------------------------- */
  const menu = document.querySelector("[data-menu]");
  const menuToggle = document.querySelector("[data-menu-toggle]");
  if (menu && menuToggle) {
    const label = menuToggle.querySelector("[data-menu-label]");
    const setLabel = (text) => {
      if (!label) return;
      label.querySelectorAll("span").length
        ? label.querySelectorAll("span").forEach((s) => (s.textContent = text))
        : (label.textContent = text);
    };
    const setMenu = (open) => {
      menu.classList.toggle("is-open", open);
      menuToggle.classList.toggle("is-open", open);            // кнопка → акцент
      menuToggle.setAttribute("aria-expanded", String(open));
      setLabel(open ? "Закрыть" : "Меню");                     // текст «Меню ↔ Закрыть»
      open ? lenisPause() : lenisResume();                     // при открытом меню — стоп плавного скролла
    };
    menuToggle.addEventListener("click", () =>
      setMenu(menuToggle.getAttribute("aria-expanded") !== "true")
    );
    // закрытие по клику вне и по выбору пункта
    menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
    document.addEventListener("click", (e) => {
      if (menu.classList.contains("is-open") && !menu.contains(e.target) && !menuToggle.contains(e.target)) setMenu(false);
    });
    window.addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });
  }

  /* --------------------------------------------------------------------------
     Якорная навигация с учётом липкой шапки
     -------------------------------------------------------------------------- */
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    const hash = link.getAttribute("href");
    if (hash === "#" || hash.length < 2) return;
    link.addEventListener("click", (e) => {
      const target = document.querySelector(hash);
      if (!target) return;
      e.preventDefault();
      const offset = header ? header.offsetHeight + 12 : 0;
      if (lenis) lenis.scrollTo(target, { offset: -offset });
      else window.scrollTo({
        top: target.getBoundingClientRect().top + window.scrollY - offset,
        behavior: prefersReduced ? "auto" : "smooth",
      });
    });
  });

  /* --------------------------------------------------------------------------
     Reveal-on-scroll (IntersectionObserver с фолбэком)
     -------------------------------------------------------------------------- */
  const revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && revealEls.length && !prefersReduced) {
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add("is-visible"); obs.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.1 });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("is-visible"));
  }

  /* --------------------------------------------------------------------------
     Маска телефона +7 (___) ___ ____ — модуль (студийный паттерн initX + вызов)
     -------------------------------------------------------------------------- */
  const initPhoneMask = () => {
    const inputs = document.querySelectorAll('input[type="tel"]');
    if (!inputs.length) return;

    const matrix = "+7 (___) ___ ____";

    const mask = function (event) {
      const key = event.key;
      const pos = this.selectionStart ?? this.value.length;

      // Статичный префикс «+7 (» защищён от правок/удаления
      if (pos < 3 && event.type === "keydown") {
        event.preventDefault();
        return;
      }

      const def = matrix.replace(/\D/g, "");
      let val = this.value.replace(/\D/g, "");
      if (def.length >= val.length) val = def;

      let i = 0;
      let newValue = matrix.replace(/[_\d]/g, (a) =>
        i < val.length ? val.charAt(i++) : a
      );

      // Обрезаем незаполненный хвост — каретка остаётся на «живом» слоте
      i = newValue.indexOf("_");
      if (i !== -1) {
        if (i < 5) i = 3;
        newValue = newValue.slice(0, i);
      }

      let reg = matrix.substring(0, this.value.length)
        .replace(/_+/g, (a) => `\\d{1,${a.length}}`)
        .replace(/[+()]/g, "\\$&");
      reg = new RegExp(`^${reg}$`);

      if (
        !reg.test(this.value) ||
        this.value.length < 5 ||
        (key && key.length === 1 && /\d/.test(key))
      ) {
        this.value = newValue;
      }

      if (event.type === "blur" && this.value.length < 5) this.value = "";
    };

    inputs.forEach((input) => {
      ["input", "focus", "blur", "keydown"].forEach((ev) =>
        input.addEventListener(ev, mask, false)
      );
    });
  };
  initPhoneMask();

  /* --------------------------------------------------------------------------
     Модалка: focus-trap + возврат фокуса + пауза скролла
     -------------------------------------------------------------------------- */
  const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';
  let modalReturnFocus = null;

  const openModalEl = (el) => {
    modalReturnFocus = document.activeElement;
    el.classList.add("is-open");
    if (lenis) lenis.stop();
    const t = el.querySelector("[data-modal-close]") || el.querySelector(FOCUSABLE);
    if (t) requestAnimationFrame(() => t.focus());
  };
  const closeModalEl = (el) => {
    el.classList.remove("is-open");
    if (lenis) lenis.start();
    if (modalReturnFocus) modalReturnFocus.focus();
  };

  document.querySelectorAll("[data-modal-open]").forEach((trigger) => {
    trigger.addEventListener("click", () => {
      const el = document.querySelector(trigger.getAttribute("data-modal-open"));
      if (el) openModalEl(el);
    });
  });
  document.querySelectorAll(".modal").forEach((modal) => {
    modal.querySelectorAll("[data-modal-close]").forEach((btn) =>
      btn.addEventListener("click", () => closeModalEl(modal))
    );
    const overlay = modal.querySelector(".modal__overlay");
    if (overlay) overlay.addEventListener("click", () => closeModalEl(modal));
    modal.addEventListener("keydown", (e) => {
      if (e.key !== "Tab") return;
      const items = [...modal.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") document.querySelectorAll(".modal.is-open").forEach(closeModalEl);
  });

  /* --------------------------------------------------------------------------
     Валидация формы заявки (нативная off, своя разметка ошибок)
     -------------------------------------------------------------------------- */
  document.querySelectorAll("[data-form]").forEach((form) => {
    form.setAttribute("novalidate", "");
    const successModal = document.querySelector(form.getAttribute("data-success") || "#modal-success");

    const setError = (field, msg) => {
      const control = field.querySelector(".field__control");
      if (control) control.setAttribute("aria-invalid", msg ? "true" : "false");
      const err = field.querySelector(".field__error");
      if (err) err.textContent = msg || "";
    };

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      let ok = true;

      const nameField = form.querySelector('[data-field="name"]');
      if (nameField) {
        const val = nameField.querySelector(".field__control").value.trim();
        if (val.length < 2) { setError(nameField, "Введите имя"); ok = false; }
        else setError(nameField, "");
      }

      const phoneField = form.querySelector('[data-field="phone"]');
      if (phoneField) {
        const digits = phoneField.querySelector(".field__control").value.replace(/\D/g, "");
        if (digits.length < 11) { setError(phoneField, "Введите корректный номер"); ok = false; }
        else setError(phoneField, "");
      }

      if (!ok) { const bad = form.querySelector('[aria-invalid="true"]'); if (bad) bad.focus(); return; }

      // Отправка: POST на бэкенд / WordPress REST
      form.reset();
      if (successModal) openModalEl(successModal);
    });
  });
})();

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
    lenis = new Lenis({ duration: 1.1, smoothWheel: true, touchMultiplier: 1.5 });
    const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }

  /* --------------------------------------------------------------------------
     Шапка: тень при скролле
     -------------------------------------------------------------------------- */
  if (header) {
    const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
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
     Маска телефона +7 (___) ___ ____
     -------------------------------------------------------------------------- */
  const MATRIX = "+7 (___) ___ ____";
  function maskPhone(event) {
    const input = event.target;
    let val = input.value.replace(/\D/g, "");
    if (val && val[0] !== "7") val = "7" + val;         // нормализуем префикс
    let out = "", vi = 0;
    for (const ch of MATRIX) {
      if (ch === "_") { if (vi < val.length) out += val[vi++]; else break; }
      else out += ch;
    }
    input.value = out;
    if (event.type === "blur" && val.length < 2) input.value = "";
  }
  document.querySelectorAll('input[type="tel"]').forEach((input) => {
    ["input", "focus", "blur"].forEach((ev) => input.addEventListener(ev, maskPhone, false));
  });

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

      // TODO(prod): POST на бэкенд / WordPress REST
      form.reset();
      if (successModal) openModalEl(successModal);
    });
  });
})();

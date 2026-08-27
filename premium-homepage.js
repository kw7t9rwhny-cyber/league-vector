(() => {
  "use strict";

  const root = document.documentElement;
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
  root.classList.add("js-enhanced");

  const revealElements = [...document.querySelectorAll("[data-reveal]")];
  const revealAll = () => revealElements.forEach((element) => element.classList.add("is-visible"));

  if (motionQuery.matches || !("IntersectionObserver" in window)) {
    revealAll();
  } else {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    }, { rootMargin: "0px 0px -8%", threshold: 0.12 });
    revealElements.forEach((element) => revealObserver.observe(element));
  }

  const interactiveCards = [...document.querySelectorAll("[data-spotlight]")];
  const clearSpotlight = (card) => {
    card.style.removeProperty("--spotlight-x");
    card.style.removeProperty("--spotlight-y");
  };

  const bindCardSpotlights = () => {
    for (const card of interactiveCards) {
      card.addEventListener("pointermove", (event) => {
        if (!finePointerQuery.matches || motionQuery.matches) return;
        const bounds = card.getBoundingClientRect();
        const x = ((event.clientX - bounds.left) / bounds.width) * 100;
        const y = ((event.clientY - bounds.top) / bounds.height) * 100;
        card.style.setProperty("--spotlight-x", `${x.toFixed(1)}%`);
        card.style.setProperty("--spotlight-y", `${y.toFixed(1)}%`);
      }, { passive: true });
      card.addEventListener("pointerleave", () => clearSpotlight(card), { passive: true });
    }
  };
  bindCardSpotlights();

  const heroVisual = document.querySelector(".hero-visual");
  let scrollFrame = 0;
  const updateScrollProgress = () => {
    scrollFrame = 0;
    if (!heroVisual || motionQuery.matches) {
      root.style.setProperty("--hero-scroll", "0");
      return;
    }
    const bounds = heroVisual.getBoundingClientRect();
    const progress = Math.min(1, Math.max(0, -bounds.top / Math.max(bounds.height, 1)));
    root.style.setProperty("--hero-scroll", progress.toFixed(3));
  };
  const requestScrollUpdate = () => {
    if (scrollFrame) return;
    scrollFrame = window.requestAnimationFrame(updateScrollProgress);
  };
  window.addEventListener("scroll", requestScrollUpdate, { passive: true });
  window.addEventListener("resize", requestScrollUpdate, { passive: true });
  updateScrollProgress();

  const canvas = document.querySelector("#vectorField");
  if (!canvas || motionQuery.matches) return;

  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return;

  let width = 0;
  let height = 0;
  let density = 1;
  let nodes = [];
  let animationFrame = 0;
  let active = true;
  let visible = true;
  let lastTime = 0;
  const pointer = { x: 0, y: 0, active: false };

  const randomBetween = (minimum, maximum) => minimum + Math.random() * (maximum - minimum);

  const createNodes = () => {
    const targetCount = Math.max(26, Math.min(82, Math.round((width * height) / 14500)));
    nodes = Array.from({ length: targetCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: randomBetween(-0.055, 0.055),
      vy: randomBetween(-0.035, 0.035),
      radius: randomBetween(0.7, 1.8),
      phase: Math.random() * Math.PI * 2,
    }));
  };

  const resizeCanvas = () => {
    const bounds = canvas.getBoundingClientRect();
    width = Math.max(1, Math.round(bounds.width));
    height = Math.max(1, Math.round(bounds.height));
    density = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * density);
    canvas.height = Math.round(height * density);
    context.setTransform(density, 0, 0, density, 0, 0);
    createNodes();
  };

  const draw = (time) => {
    animationFrame = 0;
    if (!active || !visible) return;

    const delta = Math.min(32, Math.max(8, time - lastTime || 16));
    lastTime = time;
    context.clearRect(0, 0, width, height);

    for (const node of nodes) {
      node.x += node.vx * delta;
      node.y += node.vy * delta;
      node.phase += delta * 0.0007;

      if (node.x < -20) node.x = width + 20;
      if (node.x > width + 20) node.x = -20;
      if (node.y < -20) node.y = height + 20;
      if (node.y > height + 20) node.y = -20;

      if (pointer.active) {
        const dx = pointer.x - node.x;
        const dy = pointer.y - node.y;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared > 1 && distanceSquared < 52000) {
          const pull = 0.000012 * delta;
          node.x += dx * pull;
          node.y += dy * pull;
        }
      }
    }

    const connectionDistance = Math.min(155, Math.max(105, width * 0.12));
    const connectionDistanceSquared = connectionDistance * connectionDistance;
    for (let first = 0; first < nodes.length; first += 1) {
      const a = nodes[first];
      for (let second = first + 1; second < nodes.length; second += 1) {
        const b = nodes[second];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared >= connectionDistanceSquared) continue;
        const opacity = (1 - distanceSquared / connectionDistanceSquared) * 0.22;
        context.beginPath();
        context.moveTo(a.x, a.y);
        context.lineTo(b.x, b.y);
        context.strokeStyle = `rgba(227, 174, 67, ${opacity.toFixed(3)})`;
        context.lineWidth = 0.65;
        context.stroke();
      }
    }

    for (const node of nodes) {
      const pulse = 0.65 + Math.sin(node.phase) * 0.25;
      context.beginPath();
      context.arc(node.x, node.y, node.radius * pulse, 0, Math.PI * 2);
      context.fillStyle = `rgba(247, 205, 112, ${(0.32 + pulse * 0.28).toFixed(3)})`;
      context.fill();
    }

    animationFrame = window.requestAnimationFrame(draw);
  };

  const start = () => {
    if (animationFrame || !active || !visible) return;
    lastTime = performance.now();
    animationFrame = window.requestAnimationFrame(draw);
  };
  const stop = () => {
    if (!animationFrame) return;
    window.cancelAnimationFrame(animationFrame);
    animationFrame = 0;
  };

  canvas.addEventListener("pointermove", (event) => {
    if (!finePointerQuery.matches) return;
    const bounds = canvas.getBoundingClientRect();
    pointer.x = event.clientX - bounds.left;
    pointer.y = event.clientY - bounds.top;
    pointer.active = true;
  }, { passive: true });
  canvas.addEventListener("pointerleave", () => { pointer.active = false; }, { passive: true });

  if ("IntersectionObserver" in window) {
    const canvasObserver = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      if (visible) start();
      else stop();
    }, { rootMargin: "160px" });
    canvasObserver.observe(canvas);
  }

  document.addEventListener("visibilitychange", () => {
    active = !document.hidden;
    if (active && visible) start();
    else stop();
  });

  const resizeObserver = "ResizeObserver" in window ? new ResizeObserver(resizeCanvas) : null;
  if (resizeObserver) resizeObserver.observe(canvas);
  else window.addEventListener("resize", resizeCanvas, { passive: true });

  const disableMotion = (event) => {
    if (!event.matches) return;
    stop();
    revealAll();
    pointer.active = false;
    root.style.setProperty("--hero-scroll", "0");
  };
  if (typeof motionQuery.addEventListener === "function") motionQuery.addEventListener("change", disableMotion);

  resizeCanvas();
  start();
})();

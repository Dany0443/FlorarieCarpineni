(function () {
  var PRAG = 30;

  // verificam daca utilizatorul e pe mobil
  function eMobil() { return window.innerWidth <= 768; }

  function init() {
    var ctrl = document.querySelector('.lb-controls');
    if (!ctrl) return;

    var inner = ctrl.querySelector('.lb-controls-inner');
    if (!inner) return;

    if (ctrl.querySelector('.lb-controls-tab')) return;

    var wrapper = document.createElement('div');
    wrapper.className = 'lb-controls-wrapper';

    var tab = document.createElement('button');
    tab.className = 'lb-controls-tab';
    tab.setAttribute('aria-label', 'Arata controalele');
    tab.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="8,2 4,6 8,10"/></svg>';

    ctrl.appendChild(wrapper);
    wrapper.appendChild(tab);
    wrapper.appendChild(inner);

    var ascuns = true;

    try {
      var salvat = sessionStorage.getItem('lb ascuns');
      if (salvat !== null) {
        ascuns = salvat === '1';
      }
    } catch (_) {}

    if (ascuns && eMobil()) ctrl.classList.add('controls-hidden');

    function seteaza(val) {
      ascuns = val;
      if (eMobil()) {
        ctrl.classList.toggle('controls-hidden', ascuns);
      }
      try {
        sessionStorage.setItem('lb ascuns', ascuns ? '1' : '0');
      } catch (_) {}
    }

    tab.addEventListener('click', function () { seteaza(!ascuns); });

    var startX = 0, startY = 0;
    var activ = false;
    var orizontal = false;

    // logica de baza pentru swipe
    ctrl.addEventListener('touchstart', function (e) {
      if (!eMobil()) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      activ = true;
      orizontal = false;
    }, { passive: true });

    ctrl.addEventListener('touchmove', function (e) {
      if (!eMobil() || !activ) return;
      var dx = e.touches[0].clientX - startX;
      var dy = e.touches[0].clientY - startY;
      
      if (!orizontal && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
        orizontal = true;
      }
      if (orizontal) e.preventDefault();
    }, { passive: false });

    ctrl.addEventListener('touchend', function (e) {
      if (!eMobil() || !activ) return;
      activ = false;
      var dx = e.changedTouches[0].clientX - startX;
      var dy = e.changedTouches[0].clientY - startY;

      if (Math.abs(dx) < Math.abs(dy) || Math.abs(dx) < PRAG) return;

      if (dx > 0 && !ascuns) {
        seteaza(true);
      } else if (dx < 0 && ascuns) {
        seteaza(false);
      }
    }, { passive: true });

    window.addEventListener('resize', function () {
      if (!eMobil()) {
        ctrl.classList.remove('controls-hidden');
      } else {
        ctrl.classList.toggle('controls-hidden', ascuns);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();